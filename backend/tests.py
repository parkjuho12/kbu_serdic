"""
backend/tests.py

온톨로지 + 규칙 기반 판단 결과를 이용한
통제 없는 LLM vs 통제된 LLM 비교 실험

실행:
python tests.py
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


def prompt_uncontrolled(o):

    m = o['hasMeasurement']

    return f"""실내 환경 센서 데이터를 해석해줘.

CO2: {m.get('co2')}ppm
PM2.5: {m.get('aerosol')}μg/m³
온도: {m.get('temp')}°C
습도: {m.get('hum')}%

현재 환경 상태를 설명하고
필요한 행동 지침을 알려줘.
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


def save_csv(rows):

    with open(
        OUTPUT_CSV,
        'w',
        newline='',
        encoding='utf-8-sig'
    ) as f:

        writer = csv.writer(f)

        writer.writerow([
            'status',
            'co2',
            'pm25',
            'temp',
            'hum',
            'uncontrolled',
            'controlled',
        ])

        for r in rows:

            writer.writerow([
                r['status'],
                r['co2'],
                r['pm25'],
                r['temp'],
                r['hum'],
                r['unc'],
                r['ctrl'],
            ])


def run():

    print(f'모델: {OLLAMA_MODEL}')
    print(f'Ollama: {OLLAMA_URL}')

    samples = fetch_samples(limit=30)

    rows = []

    for idx, o in enumerate(samples, 1):

        print(f'\n[{idx}/{len(samples)}]')

        judged = rule_engine(o)

        unc = call_llm(
            prompt_uncontrolled(o)
        )

        ctrl = llm_explain(judged)

        print(f'통제X: {unc[:80]}')
        print(f'통제O: {ctrl[:80]}')

        m = judged['hasMeasurement']

        rows.append({

            'status': judged['hasState'],

            'co2': m.get('co2'),

            'pm25': m.get('aerosol'),

            'temp': m.get('temp'),

            'hum': m.get('hum'),

            'unc': unc,

            'ctrl': ctrl,
        })

    save_csv(rows)

    print(f'\nCSV 저장 완료: {OUTPUT_CSV}')


if __name__ == '__main__':
    run()