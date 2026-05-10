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
    room_name = ROOM_LABEL.get(o['room_id'], o['room_id'])

    prompt = f"""당신은 실내 환경 모니터링 시스템의 음성 안내를 생성합니다.
    아래 센서 데이터와 판단 결과만을 기반으로 안내하세요.
    데이터에 없는 내용을 추측하거나 추가하지 마세요.
    
    [공간 정보]
    공간: {room_name} ({o['type']})
    재실 인원: {count}명
    [센서 데이터]
    CO2: {m.get('co2')}ppm
    PM2.5: {m.get('aerosol')}μg/m³
    온도: {m.get('temp')}°C
    습도: {m.get('hum')}%
    열화상 최고: {m.get('stats_max')}°C
    {trend_info}

    [판단 결과]
    상태: {status_kr}
    근거: {reason}

    출력 규칙:
    - TTS로 읽기 자연스럽게 1~2문장으로 작성
    - 공간 이름은 자연스럽게 읽히도록 표현
    - 쾌적/보통 상태에서는 수치를 말하지 말 것
    - 위험/비정상 상태에서만 핵심 위험 항목 1개를 자연어로 설명
    - ppm, μg/m³ 같은 단위는 가능한 읽지 말 것
    - 행동 지침은 1가지만 포함
    - 번호, 목록, 특수기호 없이 자연스러운 한국어 문장으로 작성
    - 방송 안내처럼 짧고 명확하게 작성"""
    
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