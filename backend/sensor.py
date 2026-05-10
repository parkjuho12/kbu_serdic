import pymysql
import pymysql.cursors
import pandas as pd
from config import SENSOR_BASE, DB_CONFIG

def get_conn():
    return pymysql.connect(**DB_CONFIG, cursorclass=pymysql.cursors.DictCursor)


def _safe(val):
    if val is None: return None
    try:
        f = float(val)
        return None if pd.isna(f) else round(f, 2)
    except: return None

def _avg(lst, key):
    vals = [x[key] for x in lst if x.get(key) is not None]
    return round(sum(vals)/len(vals), 2) if vals else None

def _wmax(lst, key):
    vals = [x[key] for x in lst if x.get(key) is not None]
    return max(vals) if vals else None


def get_latest_telemetry(conn, device_id):
    with conn.cursor() as cur:
        cur.execute("""
            SELECT co2, aerosol, gas, temp, hum
            FROM telemetry_cal
            WHERE device_id = %s
            ORDER BY created_at DESC LIMIT 1
        """, (device_id,))
        return cur.fetchone()

def get_latest_radar(conn, device_id):
    with conn.cursor() as cur:
        cur.execute("""
            SELECT target_count
            FROM radar_frame
            WHERE device_id = %s
            ORDER BY created_at DESC LIMIT 1
        """, (device_id,))
        return cur.fetchone()

def get_latest_thermal(conn, device_id):
    with conn.cursor() as cur:
        cur.execute("""
            SELECT stats_max, stats_avg
            FROM thermal_frame
            WHERE device_id = %s
            ORDER BY created_at DESC LIMIT 1
        """, (device_id,))
        return cur.fetchone()

def get_recent_agg(device_id, hours=3):
    """agg는 DB 미적재 → CSV fallback"""
    device_dir = SENSOR_BASE / 'telemetry-agg' / device_id
    if not device_dir.exists(): return []
    csvs = sorted(device_dir.glob('*.csv'))
    if not csvs: return []
    try:
        df = pd.read_csv(csvs[-1])
        df = df[df['period'] == '1h'].copy()
        df['createdAt'] = pd.to_datetime(df['createdAt'])
        return df.sort_values('createdAt').tail(hours).to_dict('records')
    except: return []


def build_ontology(room_id, mapping):
    conn = get_conn()
    edc_list, rdc_list, irc_list = [], [], []

    try:
        for d in mapping['EDC']:
            row = get_latest_telemetry(conn, d)
            if row:
                edc_list.append({
                    'device_id': d,
                    'co2':     _safe(row.get('co2')),
                    'aerosol': _safe(row.get('aerosol')),
                    'gas':     _safe(row.get('gas')),
                    'temp':    _safe(row.get('temp')),
                    'hum':     _safe(row.get('hum')),
                })
        for d in mapping['RDC']:
            row = get_latest_radar(conn, d)
            if row:
                rdc_list.append({'device_id': d, 'target_count': int(row.get('target_count', 0))})
        for d in mapping['IRC']:
            row = get_latest_thermal(conn, d)
            if row:
                irc_list.append({
                    'device_id': d,
                    'stats_max': _safe(row.get('stats_max')),
                    'stats_avg': _safe(row.get('stats_avg')),
                })
        trend = get_recent_agg(mapping['EDC'][0]) if mapping['EDC'] else []
    finally:
        conn.close()

    total = sum(r['target_count'] for r in rdc_list)

    return {
        'room_id': room_id, 'floor': mapping['floor'],
        'type': mapping['type'], 'name': mapping['name'],
        'hasAC': mapping.get('AC') is not None,
        'hasSensor': {
            'EDC': [s['device_id'] for s in edc_list],
            'RDC': [s['device_id'] for s in rdc_list],
            'IRC': [s['device_id'] for s in irc_list],
        },
        'hasMeasurement': {
            'co2':     _avg(edc_list, 'co2'),
            'aerosol': _avg(edc_list, 'aerosol'),
            'gas':     _avg(edc_list, 'gas'),
            'temp':    _avg(edc_list, 'temp'),
            'hum':     _avg(edc_list, 'hum'),
            'stats_max': _wmax(irc_list, 'stats_max'),
            'stats_avg': _avg(irc_list, 'stats_avg'),
        },
        'hasOccupancy':  total > 0 if rdc_list else None,
        'occupantCount': total,
        'hasLocation':   rdc_list,
        '_trend':        trend,
        'hasState': None, 'reason': [], 'prediction': None,
    }
