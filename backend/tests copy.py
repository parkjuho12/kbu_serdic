"""
backend/tests.py

LLM Only / LLM + Ontology / Controlled LLM
3가지 구조 비교 실험

- SCR(State Consistency)
- HR(Hallucination Rate)

측정용 테스트 코드
"""

import csv
import requests
import pymysql
import pymysql.cursors

from dotenv import load_dotenv

from sensor import load_room_mapping
from rule_engine import rule_engine
from llm import llm_explain

from config import (
    OLLAMA_URL,
    OLLAMA_MODEL,
    DB_CONFIG,
)

load_dotenv(override=True)

OUTPUT_CSV = '../notebooks/llm_compare_results.csv'


def get_conn():

    return pymysql.connect(
        **DB_CONFIG,
        cursorclass=pymysql.cursors.DictCursor
    )


def avg_value(rows, key):

    vals = [
        r[key]
        for r in rows
        if r.get(key) is not None
    ]

    return round(sum(vals) / len(vals), 2) if vals else None


def fetch_samples(room_id='3F-LEFT', limit=30):

    mapping = load_room_mapping()

    room = mapping[room_id]

    conn = get_conn()

    samples = []

    try:

        rep_sensor = room['EDC'][0]

        with conn.cursor() as cur:

            cur.execute("""
                SELECT created_at
                FROM telemetry_cal
                WHERE device_id = %s
                ORDER BY RAND()
                LIMIT %s
            """, (rep_sensor, limit))

            time_rows = cur.fetchall()

        for t in time_rows:

            ts = t['created_at']

            edc_rows = []

            for d in room['EDC']:

                with conn.cursor() as cur:

                    cur.execute("""
                        SELECT co2, aerosol, temp, hum
                        FROM telemetry_cal
                        WHERE device_id = %s
                        AND ABS(
                            TIMESTAMPDIFF(
                                SECOND,
                                created_at,
                                %s
                            )
                        ) < 30
                        LIMIT 1
                    """, (d, ts))

                    row = cur.fetchone()

                    if row:
                        edc_rows.append(row)

            if not edc_rows:
                continue

            ontology = {

                'room_id': room_id,

                'type': room['type'],

                'hasMeasurement': {

                    'co2': avg_value(edc_rows, 'co2'),

                    'aerosol': avg_value(
                        edc_rows,
                        'aerosol'
                    ),

                    'temp': avg_value(
                        edc_rows,
                        'temp'
                    ),

                    'hum': avg_value(
                        edc_rows,
                        'hum'
                    ),
                },

                'hasOccupancy': None,
                'occupantCount': 0,
                'hasState': None,
                'reason': [],
                'prediction': None,
            }

            samples.append(ontology)

    finally:

        conn.close()

    return samples


# --------------------------------------------------
# LLM ONLY
# --------------------------------------------------

def prompt_uncontrolled(o):

    m = o['hasMeasurement']

    return f"""
실내 환경 센서 데이터를 해석해줘.

CO2: {m.get('co2')}ppm
PM2.5: {m.get('aerosol')}μg/m³
온도: {m.get('temp')}°C
습도: {m.get('hum')}%

현재 환경 상태를 설명하고
필요한 행동 지침을 알려줘.
"""


# --------------------------------------------------
# LLM + ONTOLOGY
# --------------------------------------------------

def prompt_ontology(o):

    m = o['hasMeasurement']

    return f"""

다음은 ontology 기반으로 구조화된

실내 환경 context 정보이다.

공간 유형: {o['type']}

환경 정보

- CO2: {m.get('co2')}

- PM2.5: {m.get('aerosol')}

- 온도: {m.get('temp')}

- 습도: {m.get('hum')}

재실 정보

- 재실 인원: {o['occupantCount']}

위 context를 기반으로
현재 실내 환경 상태를 설명해줘.
"""


def call_llm(prompt):

    try:

        res = requests.post(
            OLLAMA_URL,
            json={
                'model': OLLAMA_MODEL,
                'prompt': prompt,
                'stream': False,
            },
            timeout=300,
        )

        return res.json().get(
            'response',
            ''
        ).strip()

    except Exception as e:

        return f'오류: {e}'


# --------------------------------------------------
# SCR 계산
# --------------------------------------------------



def calc_scr(text, state):

    text = text.lower()

    positive_keywords = {

        'comfortable': [

            '쾌적',
            '양호',
            '안정',
            '적절'
        ],

        'normal': [
            '보통',
            '일반',
            '무난'
        ],
        'danger': [
            '위험',
            '주의',
            '나쁨'
        ],

        'abnormal': [
            '비정상',
            '이상',
            '오류'
        ]
    }

    negative_keywords = {

        'comfortable': [
            '위험',
            '주의',
            '나쁨',
            '비정상'
        ],

        'normal': [
            '위험',
            '비정상'
        ],
        'danger': [
            '쾌적',
            '양호',
            '정상'
        ],
        'abnormal': [
            '쾌적',
            '양호',
            '정상'
        ]
    }

    # 상태 키워드 포함 여부

    positive_match = False

    for k in positive_keywords.get(state, []):

        if k in text:

            positive_match = True

            break

    if not positive_match:

        return 0

    # 반대 상태 키워드 포함 시 실패

    for k in negative_keywords.get(state, []):

        if k in text:

            return 0

    return 1


# --------------------------------------------------
# HR 계산
# --------------------------------------------------

def detect_hallucination(text):

    text = text.lower()

    hallucination_keywords = [

        '대피',
        '폭발',
        '화재',
        '응급',
        '구조 요청',
        '외부 오염',
        '중독 위험',
        '생명 위험',
        '즉시 탈출',
        '심각한 오염',
        '치명적',
    ]

    hallucination_count = 0

    for k in hallucination_keywords:

        if k in text:

            hallucination_count += 1

    return 1 if hallucination_count > 0 else 0


# --------------------------------------------------
# CSV 저장
# --------------------------------------------------

def save_csv(rows):

    with open(
        OUTPUT_CSV,
        'w',
        newline='',
        encoding='utf-8-sig'
    ) as f:

        writer = csv.writer(f)

        writer.writerow([

            'sample_id',

            'rule_state',

            'co2',
            'pm25',
            'temp',
            'hum',

            'llm_only',
            'llm_ontology',
            'controlled_llm',

            'scr_llm_only',
            'scr_ontology',
            'scr_controlled',

            'hr_llm_only',
            'hr_ontology',
            'hr_controlled',
        ])

        for r in rows:

            writer.writerow(r)


# --------------------------------------------------
# 실행
# --------------------------------------------------

def run():

    print(f'모델: {OLLAMA_MODEL}')
    print(f'Ollama: {OLLAMA_URL}')

    samples = fetch_samples(limit=30)

    rows = []

    for idx, o in enumerate(samples, 1):

        print(f'\n[{idx}/{len(samples)}]')

        judged = rule_engine(o)

        state = judged['hasState']

        # LLM ONLY
        unc = call_llm(
            prompt_uncontrolled(o)
        )

        # LLM + Ontology
        onto = call_llm(
            prompt_ontology(o)
        )

        # Controlled LLM
        ctrl = llm_explain(judged)

        print(f'LLM ONLY: {unc[:60]}')
        print(f'ONTOLOGY : {onto[:60]}')
        print(f'CONTROL  : {ctrl[:60]}')

        m = judged['hasMeasurement']

        rows.append([

            idx,

            state,

            m.get('co2'),
            m.get('aerosol'),
            m.get('temp'),
            m.get('hum'),

            unc,
            onto,
            ctrl,

            calc_scr(unc, state),
            calc_scr(onto, state),
            calc_scr(ctrl, state),

            detect_hallucination(unc),
            detect_hallucination(onto),
            detect_hallucination(ctrl),
        ])

    save_csv(rows)

    print(f'\nCSV 저장 완료: {OUTPUT_CSV}')


if __name__ == '__main__':
    run()