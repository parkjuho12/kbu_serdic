import requests
from requests.exceptions import ReadTimeout
from config import OLLAMA_URL, OLLAMA_MODEL, OLLAMA_TIMEOUT

STATUS_KR = {
    'comfortable': '쾌적',
    'normal': '보통',
    'danger': '위험',
    'abnormal': '비정상'
}

def llm_explain(o):
    m = o['hasMeasurement']
    status = o['hasState']
    count = o['occupantCount']
    pred = o.get('prediction')

    reason = ' / '.join(o['reason'])
    status_kr = STATUS_KR.get(status, status)

    trend_info = (
        f"\n- CO2 증가 추세: 약 {pred['minutes_to_danger']}분 후 기준치 초과 예상"
        if pred and pred.get('minutes_to_danger')
        else ''
    )

    prompt = f"""당신은 실내 환경 모니터링 시스템의 음성 안내를 생성합니다.
아래 센서 데이터와 판단 결과만을 기반으로 안내하세요.
절대 데이터에 없는 내용을 추측하거나 추가하지 마세요.

[공간 정보] 공간: {o['room_id']} ({o['type']}) / 재실 인원: {count}명
[센서 데이터] CO2: {m.get('co2')}ppm / PM2.5: {m.get('aerosol')}μg/m³ / 온도: {m.get('temp')}°C / 습도: {m.get('hum')}% / 열화상 최고: {m.get('stats_max')}°C{trend_info}
[판단 결과] 상태: {status_kr} / 근거: {reason}

출력 규칙:
- TTS로 읽기 좋게 2문장 이내로 작성
- 수치는 위험하거나 비정상인 핵심 항목 1개만 필요할 때 포함
- 쾌적/보통 상태에서는 수치를 말하지 말 것
- 행동 지침은 1가지만 제시
- 번호, 목록, 특수기호 없이 자연스러운 문장으로 작성"""

    try:
        res = requests.post(
            OLLAMA_URL,
            json={
                'model': OLLAMA_MODEL,
                'prompt': prompt,
                'stream': False
            },
            timeout=OLLAMA_TIMEOUT
        )
        return res.json().get('response', '').strip()

    except ReadTimeout as e:
        print(f'LLM 타임아웃: {e}')
        return 'LLM 요청이 지연되어 응답을 받을 수 없습니다. 잠시 후 다시 시도해 주세요.'

    except Exception as e:
        print(f'LLM 오류: {e}')
        return 'LLM 해석 중 오류 발생'