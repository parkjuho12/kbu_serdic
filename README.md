# 실내 환경 센서 기반 온톨로지·규칙 기반 상태 판단과 통제된 LLM 해석 모니터링 시스템

> Indoor Environment Monitoring System with Ontology/Rule-Based State Classification and Controlled LLM Interpretation

---

## 개요

본 시스템은 실내 환경 센서를 통해 수집된 데이터를 온톨로지 기반으로 구조화하고, 규칙 기반 엔진으로 환경 상태를 판단하며, 통제된 LLM이 자연어로 해석하는 모니터링 플랫폼이다. 경북대학교 창조관 2·3층을 대상으로 SERDIC과의 산학 협력을 통해 구현되었다.

---

## 시스템 구조

```
센서 (EDC / IRC / RDC)
        │  메시 네트워크 (SERDIC Edge Hub)
        ▼
  MariaDB (telemetry_cal / radar_frame / thermal_frame)
        │
        ▼
  공간-센서 매핑 로드 (rooms + room_sensors 테이블)
        │
        ▼
  온톨로지 빌드 (build_ontology)
        │
        ▼
  규칙 엔진 판단 (rule_engine)  ──►  AC 자동 제어 (ThinQ API)
        │
        ▼
  통제된 LLM 해석 (Ollama / Gemma)
        │
        ▼
  FastAPI REST / WebSocket
        │
        ▼
  React 대시보드 (실시간)
```

---

## 아키텍처

### 백엔드

| 파일 | 역할 |
|------|------|
| `main.py` | FastAPI 앱, REST·WebSocket 엔드포인트 |
| `sensor.py` | DB 동적 매핑 로드, MariaDB 조회, 온톨로지 빌드 |
| `rule_engine.py` | 규칙 기반 상태 판단, CO₂ 추세 예측, IRC 보조 재실 판단 |
| `llm.py` | Ollama LLM 호출, TTS용 자연어 생성 |
| `ac.py` | LG ThinQ API 에어컨 제어 |
| `config.py` | 환경 변수, 임계값 (공간 매핑은 DB에서 동적 로드) |
| `tests.py` | LLM 출력 비교 실험 (통제X vs 통제O) |

### 프론트엔드

| 컴포넌트 | 역할 |
|----------|------|
| `App.js` | 전역 상태, WebSocket 연결, 2단계 데이터 로드 |
| `FloorLayout.js` | 층별 평면도 미니맵 + 공간 카드 그리드 |
| `RoomCard.js` | 공간별 센서값·상태 카드 |
| `DetailPanel.js` | 상세 정보, LLM 해석, TTS 재생, AC 수동 제어 |
| `TrendChart.js` | Recharts 기반 CO₂·온도·습도·PM2.5 트렌드 |
| `SummaryBar.js` | 전체/쾌적/보통/위험/비정상 집계 바 |


### 프론트엔드 컴포넌트 상세

**`App.js`**
전역 상태 관리 및 데이터 로드 전략을 담당한다. 1차로 센서 데이터를 빠르게 렌더링한 뒤 2차로 LLM 해석을 병렬 로드하는 2단계 방식을 사용한다. WebSocket 연결 끊김 시 5초 후 자동 재접속한다.

**`FloorLayout.js`**
층별 평면도 미니맵과 공간 카드 그리드를 렌더링한다. 미니맵은 상태 색상으로 공간 현황을 한눈에 파악할 수 있도록 하며, 홀(HALL)은 별도 바 형태로 하단에 표시한다.

**`RoomCard.js`**
공간별 CO₂, PM2.5, 온도, 습도 센서값과 상태(쾌적/보통/위험/비정상), 재실 여부를 카드 형태로 표시한다. 임계값 초과 항목은 위험 색상으로 강조한다.

**`DetailPanel.js`**
공간 선택 시 우측에 슬라이드로 표시되는 상세 패널이다. LLM 해석 결과, TTS 음성 재생, AC 수동 제어(ON/OFF), 센서 디바이스 목록을 제공한다.

**`TrendChart.js`**
Recharts 기반 트렌드 차트로 CO₂, 온도, 습도, PM2.5 추세를 시각화한다. CO₂ 위험 기준선(1,000ppm)을 레퍼런스 라인으로 표시하며, CO₂ 증가 추세 예측 시 경보 배너를 표시한다.

**`SummaryBar.js`**
전체 공간 수와 상태별(쾌적/보통/위험/비정상) 집계를 상단 바에 표시한다.

**`Header.js`**
WebSocket 연결 상태(LIVE/CONNECTING), 마지막 갱신 시각, 데이터 로딩 상태를 표시한다.

---

## 데이터 수집 구조

SERDIC이 구축한 메시 네트워크(Edge Hub)를 통해 3종 이기종 센서 데이터가 MariaDB로 수집된다.

| 센서 | DB 테이블 | 주요 컬럼 |
|------|-----------|-----------|
| 복합환경센서 (EDC) | `telemetry_cal` | `co2`, `aerosol`, `gas`, `temp`, `hum` |
| 열화상 카메라 (IRC) | `thermal_frame` | `stats_max`, `stats_avg` |
| 레이더 (RDC) | `radar_frame` | `target_count` |

**데이터 선택 근거:**
- `telemetry_cal` 사용: aerosol·gas는 보정값 우선, raw(`telemetry`)는 제외
- `telemetry-agg` (1h 집계): CO₂ 추세 예측용 CSV fallback
- `thermal-pixels` 제외: 30GB 규모로 실시간 처리 불가
- `EDC-KBU-23~27` 제외: 1일치 데이터만 존재
- `RDC-KBU-02` 제외: 데이터 없음

---

## 공간-센서 매핑

공간 매핑은 `rooms` + `room_sensors` 테이블에서 동적으로 로드한다. 하드코딩 없이 DB 변경만으로 매핑 수정이 가능하다.

| 공간 ID | 이름 | 유형 | EDC | IRC | RDC | AC |
|---------|------|------|:---:|:---:|:---:|----|
| `2F-LEFT` | 2층 왼쪽 강의실 | classroom | 4 | 4 | 4 | — |
| `2F-HALL` | 2층 중앙 홀 | hall | 1 | — | — | — |
| `2F-RIGHT` | 2층 오른쪽 대형 강의실 | lab | 6 | 1 | 1 | — |
| `3F-LEFT` | 3층 왼쪽 강의실 | classroom | 4 | 5 | 5 | ✓ |
| `3F-HALL` | 3층 중앙 홀 | hall | 1 | — | — | — |
| `3F-RIGHT` | 3층 오른쪽 대형 강의실 | lab | 6 | 1 | 1 | — |

> 현재 공간 매핑은 센서의 강의실별 정확한 배치 완료 전 단계의 임시 구획이다.

---

## 판단 로직 (Rule Engine)

| 공간 타입 | 준거 법령 |
|-----------|-----------|
| classroom | 학교보건법 시행규칙 제3조 별표2 |
| hall | 실내공기질관리법 시행규칙 별표2 |
| lab | 학교보건법 준용 |

| 항목 | 쾌적 | 보통 | 위험 |
|------|------|------|------|
| CO₂ | ≤ 700 ppm | 700–1,000 ppm | > 1,000 ppm |
| PM2.5 (교실·실험실) | ≤ 15 μg/m³ | 15–35 μg/m³ | > 35 μg/m³ |
| PM2.5 (홀) | ≤ 25 μg/m³ | 25–50 μg/m³ | > 50 μg/m³ |
| 온도 | 18–28 °C | — | 범위 이탈 |
| 습도 | 30–80 % | — | 범위 이탈 |
| 열화상 최고 | — | — | ≥ 50 °C |

**판단 순서:** CO₂ → PM2.5 → 온도 → 습도 → 열화상 → 복합 이상 → 재실 여부 → CO₂ 추세

**재실 판단:**
- RDC 설치 공간: `MAX(target_count) > 0`이면 재실
- RDC 미설치 공간: IRC `stats_avg ≥ 30°C`이면 재실로 보조 판단

---

## 통제된 LLM 해석

로컬 Ollama 서버(TX2550 M7, GPU 48GB)에서 Gemma 모델을 추론하여 TTS 최적화 자연어를 생성한다.

**프롬프트 설계 원칙:**
- 센서 데이터·판단 결과만 기반, 추측 금지
- 2문장 이내, 공간명 자연어 변환
- 쾌적·보통 시 수치 미언급, 위험 시 핵심 항목 1개만
- ppm, μg/m³ 등 단위 기호 미사용 (TTS 호환)

---

## 기술 스택 및 실험 환경

### 개발 환경 (로컬)

| 항목 | 버전 |
|------|------|
| Python | 3.14.4 |
| Node.js | 22.15.0 |
| npm | 10.9.2 |

### 서버 환경

| 항목 | 사양 |
|------|------|
| 서버 모델 | TX2550 M7 |
| RAM / GPU | 128 GB / 48 GB |
| OS | Ubuntu 24.04.2 LTS |
| Ollama | 0.20.7 |
| LLM 모델 | Gemma (로컬 추론, 외부 API 미사용) |
| 백엔드 | FastAPI (uvicorn) |
| 프론트엔드 | React 18 |
| 데이터베이스 | MariaDB |

---

## 디렉터리 구조

```
kbu_serdic/
├── .env                       # 환경 변수 (버전 관리 제외)
├── backend/
│   ├── main.py                # FastAPI 앱, REST·WebSocket
│   ├── sensor.py              # DB 동적 매핑, 온톨로지 빌드
│   ├── rule_engine.py         # 규칙 판단, CO₂ 추세 예측
│   ├── llm.py                 # Ollama LLM 호출
│   ├── ac.py                  # LG ThinQ API 에어컨 제어
│   ├── config.py              # 환경 변수, 임계값
│   ├── tests.py               # LLM 출력 비교 실험(논문 6.5 근거)
│   └── requirements.txt       # Python 패키지 의존성 목록
├── notebooks/
│   ├── rule_engine_v4.ipynb   # 프로토타입 (CSV 기반 개발·검증)
│   └── llm_comparison_raw.csv # 논문 표 11 근거
├── build/                     # 프론트엔드 빌드 결과물
└── src/
    ├── App.js
    ├── api.js
    ├── index.css
    └── components/
        ├── Header.js
        ├── SummaryBar.js
        ├── FloorLayout.js
        ├── RoomCard.js
        ├── DetailPanel.js
        └── TrendChart.js
```

---

## 설치 및 실행

### 환경 변수 (`.env`, 루트 경로)

| 변수 | 설명 | 예시 |
|------|------|------|
| `OLLAMA_HOST` | Ollama 호스트 | `127.0.0.1` |
| `OLLAMA_PORT` | Ollama 포트 | `11434` |
| `OLLAMA_MODEL` | 모델명 | `my-gemma` |
| `OLLAMA_TIMEOUT` | 타임아웃(초) | `300` |
| `THINQ_PAT` | LG ThinQ Token | — |
| `THINQ_DEVICE_ID` | 에어컨 디바이스 ID | — |
| `DB_HOST` | MariaDB 호스트 | `localhost` |
| `DB_USER` | DB 사용자 | `kbu` |
| `DB_PASSWORD` | DB 비밀번호 | — |
| `DB_NAME` | DB 이름 | `kbu_sensor` |
| `DB_PORT` | DB 포트 | `3306` |
| `AUTO_AC` | 자동 AC 제어 | `true` / `false` |
| `WS_INTERVAL` | WebSocket 갱신 주기(초) | `5` |

### 백엔드

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 6668
```

### 프론트엔드

```bash
npm install
REACT_APP_WS_URL=ws://<서버IP>:6668/ws npm run build
```

---

## API 명세

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/health` | 서버 상태 확인 |
| GET | `/api/rooms` | 전체 공간 상태 조회 |
| GET | `/api/rooms/{room_id}` | 단일 공간 상태 조회 |
| GET | `/api/rooms/{room_id}/explain` | LLM 해석 |
| POST | `/api/rooms/{room_id}/ac/{action}` | 에어컨 제어 (`on`/`off`) |

### WebSocket `/ws`

```json
// 서버 → 클라이언트
{ "type": "update", "data": [ /* 전체 공간 상태 */ ], "timestamp": "..." }

// 클라이언트 → 서버
{ "type": "ac_control", "room_id": "3F-LEFT", "action": "on" }
{ "type": "refresh", "include_llm": false }
```

---

*경북대학교 × SERDIC 산학협력 | 지능형 에너지 관리 디지털 트윈 테스트베드 구축 사업 Phase 1*
