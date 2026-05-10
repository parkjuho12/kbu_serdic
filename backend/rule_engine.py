import pandas as pd
from config import THRESHOLDS


def predict_co2(co2, trend_rows, threshold):
    if not trend_rows or len(trend_rows) < 2:
        return {'trend': 'unknown', 'change_rate': None, 'minutes_to_danger': None}
    col = 'co2_avg' if 'co2_avg' in trend_rows[0] else list(trend_rows[0].keys())[4]
    vals = [r[col] for r in trend_rows if r.get(col) is not None]
    if len(vals) < 2:
        return {'trend': 'unknown', 'change_rate': None, 'minutes_to_danger': None}
    rate = (vals[-1] - vals[0]) / len(vals)
    mins = round(((threshold - co2) / rate) * 60) if rate > 0 and co2 < threshold else None
    trend = 'increasing' if rate > 10 else 'decreasing' if rate < -10 else 'stable'
    return {'trend': trend, 'change_rate': round(rate, 1), 'minutes_to_danger': mins}


def rule_engine(o):
    m        = o['hasMeasurement']
    occupied = o['hasOccupancy']
    th       = THRESHOLDS[o['type']]
    trend    = o.pop('_trend', [])
    reason   = []; status = 'comfortable'; anomaly = 0

    co2 = m.get('co2'); aerosol = m.get('aerosol')
    temp = m.get('temp'); hum = m.get('hum')
    stats_max = m.get('stats_max')
    stats_avg = m.get('stats_avg')

    if co2 is None and aerosol is None:
        o['hasState'] = 'abnormal'; o['reason'] = ['센서 데이터 없음']; o['prediction'] = None
        return o

    if co2 is not None:
        if co2 > th['co2']['normal']:
            status = 'danger'; anomaly += 1
            reason.append(f'CO2 위험: {co2}ppm (기준 > {th["co2"]["normal"]})')
        elif co2 > th['co2']['comfortable']:
            if status != 'danger': status = 'normal'
            anomaly += 1
            reason.append(f'CO2 보통: {co2}ppm (기준 {th["co2"]["comfortable"]}~{th["co2"]["normal"]})')

    if aerosol is not None:
        if aerosol > th['aerosol']['normal']:
            status = 'danger'; anomaly += 1
            reason.append(f'PM2.5 위험: {aerosol}μg/m³')
        elif aerosol > th['aerosol']['comfortable']:
            if status != 'danger': status = 'normal'
            anomaly += 1
            reason.append(f'PM2.5 보통: {aerosol}μg/m³')

    if temp is not None and th['temp']:
        if not (th['temp']['min'] <= temp <= th['temp']['max']):
            if status != 'danger': status = 'normal'
            anomaly += 1
            reason.append(f'온도 이상: {temp}°C (기준 {th["temp"]["min"]}~{th["temp"]["max"]})')

    if hum is not None and th['hum']:
        if not (th['hum']['min'] <= hum <= th['hum']['max']):
            if status != 'danger': status = 'normal'
            anomaly += 1
            reason.append(f'습도 이상: {hum}% (기준 {th["hum"]["min"]}~{th["hum"]["max"]})')

    # IRC 열화상 판단
    if stats_max is not None and stats_max >= 50:
        status = 'danger'
        reason.append(f'열화상 과열: {stats_max}°C')

    # IRC 보조 재실 판단 — RDC 미설치(occupied=None)인 경우에만 적용
    if occupied is None and stats_avg is not None and stats_avg >= 30:
        occupied = True
        reason.append(f'IRC 재실 보조 감지: 열화상 평균 {stats_avg}°C')

    if anomaly >= 2 and status == 'normal':
        status = 'danger'
        reason.append(f'복합 이상 {anomaly}개 → 위험도 상향')

    if occupied is True and status == 'danger':
        reason.append('재실 + 위험 → 즉각 조치 필요')
    elif occupied is False and status == 'danger':
        status = 'abnormal'
        reason.append('무재실 위험 → 비정상')
    elif occupied is None:
        reason.append('재실 정보 없음 (레이더·열화상 미설치)')

    prediction = None
    if co2 is not None and trend:
        pred = predict_co2(co2, trend, th['co2']['normal'])
        prediction = pred
        if pred.get('minutes_to_danger'):
            reason.append(f'CO2 증가 추세: 약 {pred["minutes_to_danger"]}분 후 기준치 초과 예상')

    if status == 'comfortable':
        reason.append('모든 환경 기준 정상')

    o['hasState'] = status; o['hasOccupancy'] = occupied
    o['reason'] = reason; o['prediction'] = prediction
    return o
