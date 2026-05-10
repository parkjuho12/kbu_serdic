"""
backend/test.py
통제 없는 LLM vs 통제된 LLM 실제 출력 비교
논문 표 9 생성용

실행: python test.py
"""
import requests
import pymysql
import pymysql.cursors
import os
from dotenv import load_dotenv

load_dotenv(override=True)

OLLAMA_URL   = f"http://{os.getenv('OLLAMA_HOST')}:{os.getenv('OLLAMA_PORT')}/api/generate"
OLLAMA_MODEL = os.getenv('OLLAMA_MODEL')
DB_CONFIG = {
    'host':     os.getenv('DB_HOST'),
    'user':     os.getenv('DB_USER', 'kbu'),
    'password': os.getenv('DB_PASSWORD', ''),
    'db':       os.getenv('DB_NAME', 'kbu_sensor'),
    'port':     int(os.getenv('DB_PORT', 3306)),
    'charset':  'utf8mb4',
    'cursorclass': pymysql.cursors.DictCursor,
}

THRESHOLDS = {
    'classroom': {
        'co2':     {'comfortable': 700, 'normal': 1000},
        'aerosol': {'comfortable': 15,  'normal': 35},
        'temp':    {'min': 18, 'max': 28},
        'hum':     {'min': 30, 'max': 80},
    },
    'hall': {
        'co2':     {'comfortable': 700, 'normal': 1000},
        'aerosol': {'comfortable': 25,  'normal': 50},
        'temp':    None,
        'hum':     None,
    },
    'lab': {
        'co2':     {'comfortable': 700, 'normal': 1000},
        'aerosol': {'comfortable': 15,  'normal': 35},
        'temp':    {'min': 18, 'max': 28},
        'hum':     {'min': 30, 'max': 80},
    },
}

STATUS_KR = {
    'comfortable': '쾌적',
    'normal':      '보통',
    'danger':      '위험',
    'abnormal':    '비정상',
}

# 레이더 정상 범위 (이상값 필터)
MAX_OCCUPANT = 200


def get_conn():
    return pymysql.connect(**DB_CONFIG)


def load_room_mapping():
    conn = get_conn()
    mapping = {}
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT room_id, name, floor, type FROM rooms")
            rooms = cur.fetchall()
            cur.execute("SELECT room_id, sensor_type, device_id FROM room_sensors ORDER BY room_id, sensor_type, device_id")
            sensors = cur.fetchall()

        sensor_map = {}
        for s in sensors:
            rid = s['room_id']
            if rid not in sensor_map:
                sensor_map[rid] = {'EDC': [], 'IRC': [], 'RDC': []}
            stype = s['sensor_type'].upper()
            if stype in sensor_map[rid]:
                sensor_map[rid][stype].append(s['device_id'])

        for r in rooms:
            rid = r['room_id']
            s = sensor_map.get(rid, {'EDC': [], 'IRC': [], 'RDC': []})
            mapping[rid] = {
                'floor': r['floor'], 'type': r['type'], 'name': r['name'],
                'EDC': s['EDC'], 'IRC': s['IRC'], 'RDC': s['RDC'],
            }
    finally:
        conn.close()
    return mapping


def fetch_samples(room_id='3F-LEFT', room_type='classroom'):
    conn = get_conn()
    samples = []
    th = THRESHOLDS[room_type]

    mapping = load_room_mapping()
    edc_devices = mapping[room_id]['EDC']
    rdc_devices = mapping[room_id]['RDC']

    try:
        with conn.cursor() as cur:
            edc_list = ', '.join([f"'{d}'" for d in edc_devices])
            cur.execute(f"""
                SELECT
                    DATE_FORMAT(created_at, '%Y-%m-%d %H:00:00') AS hour,
                    ROUND(AVG(co2), 1)     AS co2,
                    ROUND(AVG(aerosol), 1) AS aerosol,
                    ROUND(AVG(temp), 1)    AS temp,
                    ROUND(AVG(hum), 1)     AS hum
                FROM telemetry_cal
                WHERE device_id IN ({edc_list})
                  AND co2 IS NOT NULL AND aerosol IS NOT NULL
                GROUP BY hour
                ORDER BY hour DESC
                LIMIT 500
            """)
            edc_rows = cur.fetchall()

            rdc_map = {}
            if rdc_devices:
                rdc_list = ', '.join([f"'{d}'" for d in rdc_devices])
                cur.execute(f"""
                    SELECT
                        DATE_FORMAT(created_at, '%Y-%m-%d %H:00:00') AS hour,
                        MAX(target_count) AS occupant_count
                    FROM radar_frame
                    WHERE device_id IN ({rdc_list})
                      AND target_count < {MAX_OCCUPANT}
                    GROUP BY hour
                    ORDER BY hour DESC
                    LIMIT 500
                """)
                rdc_map = {r['hour']: r['occupant_count'] for r in cur.fetchall()}
    finally:
        conn.close()

    for row in edc_rows:
        co2     = row['co2']
        aerosol = row['aerosol']
        temp    = row['temp']
        hum     = row['hum']
        count   = rdc_map.get(row['hour'], 0)
        occupied = count > 0 if rdc_devices else None

        anomaly = 0
        status  = 'comfortable'

        if co2:
            if co2 > th['co2']['normal']:      status = 'danger';  anomaly += 1
            elif co2 > th['co2']['comfortable']:
                if status != 'danger': status = 'normal'
                anomaly += 1
        if aerosol:
            if aerosol > th['aerosol']['normal']:      status = 'danger';  anomaly += 1
            elif aerosol > th['aerosol']['comfortable']:
                if status != 'danger': status = 'normal'
                anomaly += 1
        if temp and th['temp']:
            if not (th['temp']['min'] <= temp <= th['temp']['max']):
                if status != 'danger': status = 'normal'
                anomaly += 1
        if hum and th['hum']:
            if not (th['hum']['min'] <= hum <= th['hum']['max']):
                if status != 'danger': status = 'normal'
                anomaly += 1
        if anomaly >= 2 and status == 'normal':
            status = 'danger'
        if status == 'danger' and occupied is False:
            status = 'abnormal'

        samples.append({
            'hour': row['hour'], 'co2': co2, 'aerosol': aerosol,
            'temp': temp, 'hum': hum,
            'occupant_count': count, 'occupied': occupied,
            'rule_status': status,
        })

    return samples


def prompt_uncontrolled(s):
    return f"""실내 환경 센서 데이터를 해석해줘.

CO2: {s['co2']}ppm
PM2.5: {s['aerosol']}μg/m³
온도: {s['temp']}°C
습도: {s['hum']}%
재실 인원: {s['occupant_count']}명

현재 환경 상태를 설명하고 필요한 행동 지침을 알려줘."""


def prompt_controlled(s):
    status_kr = STATUS_KR.get(s['rule_status'], s['rule_status'])
    reasons = []
    if s['co2'] and s['co2'] > 1000:
        reasons.append(f"CO2 위험: {s['co2']}ppm (기준 > 1000)")
    elif s['co2'] and s['co2'] > 700:
        reasons.append(f"CO2 보통: {s['co2']}ppm")
    if s['hum'] and not (30 <= s['hum'] <= 80):
        reasons.append(f"습도 이상: {s['hum']}%")
    if s['rule_status'] == 'danger' and s['occupant_count'] > 0:
        reasons.append("재실 + 위험 → 즉각 조치 필요")
    if s['rule_status'] == 'abnormal':
        reasons.append("무재실 위험 → 비정상")
    if not reasons:
        reasons.append("모든 환경 기준 정상")
    reason_str = ' / '.join(reasons)

    return f"""당신은 실내 환경 모니터링 시스템의 음성 안내를 생성합니다.

아래 센서 데이터와 판단 결과만을 기반으로 안내하세요.
절대 데이터에 없는 원인이나 상황을 추측하지 마세요.

[공간 정보] 공간: 3층 왼쪽 교실 / 재실 인원: {s['occupant_count']}명
[센서 데이터] CO2: {s['co2']}ppm / PM2.5: {s['aerosol']}μg/m³ / 온도: {s['temp']}°C / 습도: {s['hum']}%
[판단 결과] 상태: {status_kr} / 근거: {reason_str}

출력 규칙:
- TTS로 읽기 좋게 2문장 이내로 작성
- 쾌적/보통 상태에서는 수치를 말하지 말 것
- 위험/비정상 상태에서는 핵심 위험 항목 1개만 자연어로 설명할 것
- CO2 또는 PM2.5 문제가 있으면 환기 안내를 할 수 있음
- 온도 문제가 있으면 냉난방 조절 안내를 할 수 있음
- 행동 지침은 필요한 경우 가장 중요한 1가지만 제시
- ppm, μg/m³ 같은 단위 표현은 가능한 읽지 말 것
- 번호, 목록, 특수기호 없이 자연스러운 문장으로 작성"""


def call_llm(prompt, timeout=120):
    try:
        res = requests.post(
            OLLAMA_URL,
            json={'model': OLLAMA_MODEL, 'prompt': prompt, 'stream': False},
            timeout=timeout,
        )
        return res.json().get('response', '').strip()
    except Exception as e:
        return f'오류: {e}'


def run():
    print(f'모델: {OLLAMA_MODEL}')
    print(f'Ollama: {OLLAMA_URL}')
    print('=' * 70)

    all_samples = fetch_samples(room_id='3F-LEFT', room_type='classroom')

    # 상태별 1개씩 선택 (이상값 제외된 샘플 기반)
    selected = {}
    for s in all_samples:
        status = s['rule_status']
        if status not in selected:
            selected[status] = s
        if len(selected) == 4:
            break

    # 선택된 샘플 현황 출력
    print('\n선택된 샘플:')
    for status in ['comfortable', 'normal', 'danger', 'abnormal']:
        s = selected.get(status)
        if s:
            print(f"  [{STATUS_KR[status]}] CO₂={s['co2']}  PM2.5={s['aerosol']}  온도={s['temp']}  습도={s['hum']}  재실={s['occupant_count']}명")
        else:
            print(f"  [{STATUS_KR[status]}] 샘플 없음")
    print()

    results = []
    for status in ['comfortable', 'normal', 'danger', 'abnormal']:
        s = selected.get(status)
        if not s:
            print(f'[{STATUS_KR[status]}] 샘플 없음 — 스킵')
            continue

        status_kr = STATUS_KR[status]
        print(f"\n[{status_kr}] CO₂={s['co2']}  PM2.5={s['aerosol']}  재실={s['occupant_count']}명")

        print('  통제X 생성 중...')
        out_unc = call_llm(prompt_uncontrolled(s))

        print('  통제O 생성 중...')
        out_ctrl = call_llm(prompt_controlled(s))

        results.append({
            'status': status_kr, 'co2': s['co2'], 'aerosol': s['aerosol'],
            'temp': s['temp'], 'hum': s['hum'], 'occupant': s['occupant_count'],
            'unc': out_unc, 'ctrl': out_ctrl,
        })

        print(f'\n  [통제X]\n  {out_unc}')
        print(f'\n  [통제O]\n  {out_ctrl}')
        print('-' * 70)

    print('\n\n' + '=' * 70)
    print('논문 표 9 — 상태별 LLM 실제 출력 비교')
    print('=' * 70)
    for r in results:
        print(f"\n【{r['status']}】  CO₂ {r['co2']}ppm / PM2.5 {r['aerosol']} / 재실 {r['occupant']}명")
        print(f"  통제X: {r['unc'][:120]}{'...' if len(r['unc']) > 120 else ''}")
        print(f"  통제O: {r['ctrl']}")


if __name__ == '__main__':
    run()
