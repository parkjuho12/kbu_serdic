"""
backend/tests.py
 
LLM Only / LLM + Ontology / Controlled LLM
3가지 구조 비교 실험
 
- SCR: 긍정 키워드 + 부정 키워드 교차 검증
- HR:  극단적 표현 + 상태 불일치 과장 표현 감지
 
실행: python tests.py
"""
 
import csv
import requests
import pymysql
import pymysql.cursors
from dotenv import load_dotenv
 
from sensor import load_room_mapping
from rule_engine import rule_engine
from llm import llm_explain
from config import OLLAMA_URL, OLLAMA_MODEL, DB_CONFIG
 
load_dotenv(override=True)
 
OUTPUT_CSV = '../notebooks/llm_compare_results.csv'
 
 
# ── DB ───────────────────────────────────────────────────
def get_conn():
    return pymysql.connect(**DB_CONFIG, cursorclass=pymysql.cursors.DictCursor)
 
 
def avg_value(rows, key):
    vals = [r[key] for r in rows if r.get(key) is not None]
    return round(sum(vals) / len(vals), 2) if vals else None
 
 
# ── 샘플 수집 ─────────────────────────────────────────────
def fetch_samples(room_id='3F-LEFT', limit=30):
    mapping    = load_room_mapping()
    room       = mapping[room_id]
    conn       = get_conn()
    samples    = []
    rep_sensor = room['EDC'][0]
 
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT COUNT(*) as cnt FROM telemetry_cal
                WHERE device_id = %s
            """, (rep_sensor,))
            total = cur.fetchone()['cnt']
        print(f'[{room_id}] {rep_sensor} 전체 {total:,}건 중 {limit}건 샘플링')
 
        with conn.cursor() as cur:
            cur.execute("""
                SELECT created_at FROM telemetry_cal
                WHERE device_id = %s
                ORDER BY RAND()
                LIMIT %s
            """, (rep_sensor, limit * 2))
            time_rows = cur.fetchall()
 
        for t in time_rows:
            if len(samples) >= limit:
                break
            ts = t['created_at']
            edc_rows = []
            for d in room['EDC']:
                with conn.cursor() as cur:
                    cur.execute("""
                        SELECT co2, aerosol, temp, hum
                        FROM telemetry_cal
                        WHERE device_id = %s
                          AND ABS(TIMESTAMPDIFF(SECOND, created_at, %s)) < 30
                        LIMIT 1
                    """, (d, ts))
                    row = cur.fetchone()
                    if row:
                        edc_rows.append(row)
 
            if not edc_rows:
                continue
 
            samples.append({
                'room_id':       room_id,
                'type':          room['type'],
                'hasMeasurement': {
                    'co2':       avg_value(edc_rows, 'co2'),
                    'aerosol':   avg_value(edc_rows, 'aerosol'),
                    'temp':      avg_value(edc_rows, 'temp'),
                    'hum':       avg_value(edc_rows, 'hum'),
                    'stats_max': None,
                    'stats_avg': None,
                },
                'hasOccupancy':  None,
                'occupantCount': 0,
                'hasLocation':   [],
                '_trend':        [],
                'hasState':      None,
                'reason':        [],
                'prediction':    None,
            })
    finally:
        conn.close()
 
    return samples
 
 
# ── 프롬프트 ──────────────────────────────────────────────
def prompt_uncontrolled(o):
    m = o['hasMeasurement']
    return f"""실내 환경 센서 데이터를 해석해줘.
 
CO2: {m.get('co2')}ppm
PM2.5: {m.get('aerosol')}μg/m³
온도: {m.get('temp')}°C
습도: {m.get('hum')}%
 
현재 환경 상태를 설명하고 필요한 행동 지침을 알려줘."""
 
 
def prompt_ontology(o):
    m = o['hasMeasurement']
    return f"""다음은 ontology 기반으로 구조화된 실내 환경 context 정보이다.
 
공간 유형: {o['type']}
 
환경 정보
- CO2: {m.get('co2')}
- PM2.5: {m.get('aerosol')}
- 온도: {m.get('temp')}
- 습도: {m.get('hum')}
 
재실 정보
- 재실 인원: {o['occupantCount']}
 
위 context를 기반으로 현재 실내 환경 상태를 설명해줘."""
 
 
def call_llm(prompt):
    try:
        res = requests.post(
            OLLAMA_URL,
            json={'model': OLLAMA_MODEL, 'prompt': prompt, 'stream': False},
            timeout=300,
        )
        return res.json().get('response', '').strip()
    except Exception as e:
        return f'오류: {e}'
 
 
# ── SCR 계산 ──────────────────────────────────────────────
def calc_scr(text, state):
    """
    상태 일치율 (State Consistency Rate)
    - 해당 상태 키워드 존재 AND 반대 상태 키워드 없음
    """
    text = text.lower()
 
    positive = {
        'comfortable': ['쾌적', '양호', '안정', '적절'],
        'normal':      ['보통', '일반', '무난'],
        'danger':      ['위험', '주의', '나쁨'],
        'abnormal':    ['비정상', '이상', '오류'],
    }
    negative = {
        'comfortable': ['위험', '주의', '나쁨', '비정상'],
        'normal':      ['위험', '비정상'],
        'danger':      ['쾌적', '양호', '정상'],
        'abnormal':    ['쾌적', '양호', '정상'],
    }
 
    # 긍정 키워드 존재 여부
    if not any(k in text for k in positive.get(state, [])):
        return 0
 
    # 부정 키워드 존재 시 실패
    if any(k in text for k in negative.get(state, [])):
        return 0
 
    return 1
 
 
# ── HR 계산 ──────────────────────────────────────────────
def detect_hallucination(text, state):
    """
    Hallucination 발생 여부
    기준:
    ① 극단적 과장 표현 (모든 상태 공통)
    ② normal/danger/abnormal 상태인데 과도한 긍정 표현
    ③ comfortable 상태인데 과도한 부정 표현
    """
    t = text.lower()
 
    # ① 극단적 표현
    extreme = [
        '대피', '폭발', '화재', '응급', '치명적',
        '즉시 탈출', '생명 위험', '중독 위험',
        '외부 오염', '심각한 오염', '구조 요청',
    ]
    for k in extreme:
        if k in t:
            return 1
 
    # ② normal/danger/abnormal인데 과도한 긍정 표현
    if state in ('normal', 'danger', 'abnormal'):
        overpositive = [
            '매우 쾌적', '최상급', '최적 수준', '매우 훌륭',
            '매우 양호', '최상으로 양호', '이상적', '완벽',
            '훌륭하고 깨끗', '매우 좋음', '매우 낮아 쾌적',
            '최상의 환경', '아주 좋', '매우 좋은 상태',
        ]
        for k in overpositive:
            if k in t:
                return 1
 
    # ③ comfortable인데 과도한 부정 표현
    if state == 'comfortable':
        negative = ['위험', '즉시', '심각', '나쁨', '매우 나쁨']
        for k in negative:
            if k in t:
                return 1
 
    return 0
 
 
# ── CSV 저장 ──────────────────────────────────────────────
def save_csv(rows):
    with open(OUTPUT_CSV, 'w', newline='', encoding='utf-8-sig') as f:
        writer = csv.writer(f)
        writer.writerow([
            'sample_id', 'rule_state',
            'co2', 'pm25', 'temp', 'hum',
            'llm_only', 'llm_ontology', 'controlled_llm',
            'scr_llm_only', 'scr_ontology', 'scr_controlled',
            'hr_llm_only', 'hr_ontology', 'hr_controlled',
        ])
        for r in rows:
            writer.writerow(r)
 
 
# ── 요약 출력 ─────────────────────────────────────────────
def print_summary(rows):
    n = len(rows)
    if n == 0:
        return
 
    scr_only = sum(r[9]  for r in rows) / n * 100
    scr_onto = sum(r[10] for r in rows) / n * 100
    scr_ctrl = sum(r[11] for r in rows) / n * 100
    hr_only  = sum(r[12] for r in rows) / n * 100
    hr_onto  = sum(r[13] for r in rows) / n * 100
    hr_ctrl  = sum(r[14] for r in rows) / n * 100
 
    print('\n' + '='*60)
    print(f'총 샘플: {n}개')
    print(f'{"":20} {"LLM Only":>12} {"LLM+Ontology":>14} {"Controlled":>12}')
    print(f'{"SCR (상태일치율)":20} {scr_only:>11.1f}% {scr_onto:>13.1f}% {scr_ctrl:>11.1f}%')
    print(f'{"HR  (환각발생률)":20} {hr_only:>11.1f}% {hr_onto:>13.1f}% {hr_ctrl:>11.1f}%')
    print('='*60)
 
 
# ── 실행 ─────────────────────────────────────────────────
def run():
    print(f'모델: {OLLAMA_MODEL}')
    print(f'Ollama: {OLLAMA_URL}')
    print('='*60)
 
    samples = fetch_samples(room_id='3F-LEFT', limit=30)
 
    if not samples:
        print('샘플 없음')
        return
 
    rows = []
 
    for idx, o in enumerate(samples, 1):
        print(f'\n[{idx}/{len(samples)}]')
 
        judged = rule_engine(o)
        state  = judged['hasState']
        m      = judged['hasMeasurement']
 
        print(f'  상태: {state} | CO₂={m.get("co2")} 온도={m.get("temp")} 습도={m.get("hum")}')
 
        print('  [1/3] LLM Only...')
        unc  = call_llm(prompt_uncontrolled(o))
 
        print('  [2/3] LLM + Ontology...')
        onto = call_llm(prompt_ontology(o))
 
        print('  [3/3] Controlled LLM...')
        ctrl = llm_explain(judged)
 
        scr_only = calc_scr(unc,  state)
        scr_onto = calc_scr(onto, state)
        scr_ctrl = calc_scr(ctrl, state)
 
        hr_only  = detect_hallucination(unc,  state)
        hr_onto  = detect_hallucination(onto, state)
        hr_ctrl  = detect_hallucination(ctrl, state)
 
        print(f'  SCR: {scr_only} / {scr_onto} / {scr_ctrl} | HR: {hr_only} / {hr_onto} / {hr_ctrl}')
 
        rows.append([
            idx, state,
            m.get('co2'), m.get('aerosol'), m.get('temp'), m.get('hum'),
            unc, onto, ctrl,
            scr_only, scr_onto, scr_ctrl,
            hr_only, hr_onto, hr_ctrl,
        ])
 
    save_csv(rows)
    print_summary(rows)
    print(f'\nCSV 저장 완료: {OUTPUT_CSV}')
 
 
if __name__ == '__main__':
    run()