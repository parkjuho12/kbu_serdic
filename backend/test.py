"""
backend/test.py
통제 없는 LLM vs 통제된 LLM 실제 출력 비교
논문 표 9 생성용

실행: python test.py
"""
import asyncio
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

STATUS_KR = {
    'comfortable': '쾌적',
    'normal':      '보통',
    'danger':      '위험',
    'abnormal':    '비정상',
}

# ── 논문에 쓸 대표 샘플 4개 (상태별 1개씩) ──────────────────────────────────
# 실제 DB 수치 기반 (llm_comparison_raw.csv 참조)
SAMPLES = [
    {
        'status': 'comfortable',
        'co2': 438.1, 'aerosol': 5.0, 'temp': 24.8, 'hum': 30.5,
        'occupant_count': 0,
    },
    {
        'status': 'normal',
        'co2': 618.8, 'aerosol': 5.0, 'temp': 25.8, 'hum': 21.2,
        'occupant_count': 0,
    },
    {
        'status': 'danger',
        'co2': 1149.5, 'aerosol': 5.0, 'temp': 26.6, 'hum': 34.2,
        'occupant_count': 14514,
    },
    {
        'status': 'abnormal',
        'co2': 1130.7, 'aerosol': 5.0, 'temp': 26.8, 'hum': 31.6,
        'occupant_count': 0,
    },
]


def prompt_uncontrolled(s):
    """통제 없는 LLM — 센서값만 전달, 판단 결과 미제공"""
    return f"""실내 환경 센서 데이터를 해석해줘.

CO2: {s['co2']}ppm
PM2.5: {s['aerosol']}μg/m³
온도: {s['temp']}°C
습도: {s['hum']}%
재실 인원: {s['occupant_count']}명

현재 환경 상태를 설명하고 필요한 행동 지침을 알려줘."""


def prompt_controlled(s):
    """통제된 LLM (본 연구) — 판단 결과 + 근거 기반, 추측 금지"""
    status_kr = STATUS_KR.get(s['status'], s['status'])

    # 판단 근거 자동 생성 (rule_engine 로직과 동일)
    reasons = []
    if s['co2'] and s['co2'] > 1000:
        reasons.append(f"CO2 위험: {s['co2']}ppm (기준 > 1000)")
    elif s['co2'] and s['co2'] > 700:
        reasons.append(f"CO2 보통: {s['co2']}ppm")
    if s['hum'] and not (30 <= s['hum'] <= 80):
        reasons.append(f"습도 이상: {s['hum']}%")
    if s['status'] == 'danger' and s['occupant_count'] > 0:
        reasons.append("재실 + 위험 → 즉각 조치 필요")
    if s['status'] == 'abnormal':
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

    results = []
    for s in SAMPLES:
        status_kr = STATUS_KR[s['status']]
        print(f"\n[{status_kr}] CO₂={s['co2']}  PM2.5={s['aerosol']}  재실={s['occupant_count']}명")

        print('  통제X 생성 중...')
        out_unc = call_llm(prompt_uncontrolled(s))

        print('  통제O 생성 중...')
        out_ctrl = call_llm(prompt_controlled(s))

        results.append({
            'status':    status_kr,
            'co2':       s['co2'],
            'aerosol':   s['aerosol'],
            'temp':      s['temp'],
            'hum':       s['hum'],
            'occupant':  s['occupant_count'],
            'unc':       out_unc,
            'ctrl':      out_ctrl,
        })

        print(f'\n  [통제X]\n  {out_unc}')
        print(f'\n  [통제O]\n  {out_ctrl}')
        print('-' * 70)

    # 논문 표 9 형식으로 출력
    print('\n\n' + '=' * 70)
    print('논문 표 9 — 상태별 LLM 실제 출력 비교')
    print('=' * 70)
    for r in results:
        sensor_summary = f"CO₂ {r['co2']}ppm / PM2.5 {r['aerosol']} / 재실 {r['occupant']}명"
        print(f"\n【{r['status']}】  {sensor_summary}")
        print(f"  통제X: {r['unc'][:120]}{'...' if len(r['unc']) > 120 else ''}")
        print(f"  통제O: {r['ctrl']}")


if __name__ == '__main__':
    run()
