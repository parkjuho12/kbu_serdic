# 실내 환경 센서 기반 온톨로지·규칙 기반 상태 판단과 통제된 LLM 해석 모니터링 시스템

> Indoor Environment Monitoring System with Ontology/Rule-Based State Classification and Controlled LLM Interpretation

---

## 개요

본 시스템은 실내 환경 센서를 통해 수집된 데이터를 온톨로지 기반으로 구조화하고, 규칙 기반 엔진으로 환경 상태를 판단하며, 통제된 LLM이 자연어로 해석하는 모니터링 플랫폼이다. 경북대학교 창조관 2·3층을 대상으로 SERDIC과의 산학 협력을 통해 구현되었다.

기존 환경 모니터링 시스템이 단순 수치 제공에 그치는 한계와, LLM 단독 사용 시 발생하는 헐루시네이션 문제를 해결하기 위해, 규칙 기반 상태 판단을 먼저 수행한 뒤 LLM은 그 결과를 자연어로 설명하는 보조 도구로만 활용하는 구조를 채택하였다.

---

## 시스템 구조

```
[환경센서] EDC / IRC / RDC
        │  메시 네트워크 (SERDIC Edge Hub)
        ▼
[데이터 저장] MariaDB
        │  telemetry_cal / radar_frame / thermal_frame
        ▼
[온톨로지 변환] build_ontology()
        │  Room → hasSensor / hasMeasurement / hasOccupancy
        ▼
[규칙 기반 상태 판단] rule_engine()
        │  쾌적 / 보통 / 위험 / 비정상
        ├──────────────────────►  [AC 자동 제어] LG ThinQ API
        ▼
[통제된 LLM 해석] Ollama / Gemma
        │  센서 데이터·판단 결과만 기반, 추측 금지
        ▼
[FastAPI REST / WebSocket]
        ▼
[React 대시보드] 실시간 모니터링
```

---

## 온톨로지 설계

센서 데이터를 단순 수치가 아닌 의미 기반 구조로 표현하기 위해 다음과 같이 온톨로지를 정의하였다.

**주요 클래스**

| 클래스 | 설명 |
|--------|------|
| `Room` | 센서가 설치된 공간 (교실, 홀, 실험실) |
| `Sensor` | 환경 데이터를 측정하는 센서 (EDC / IRC / RDC) |
| `Measurement` | 센서가 측정한 데이터 값 |
| `EnvironmentState` | 환경 상태 (쾌적 / 보통 / 위험 / 비정상) |
| `Occupancy` | 재실 여부 |

**관계 정의**

```
Room
├── hasSensor     → Sensor (EDC / IRC / RDC)
│     └── hasMeasurement → (CO₂, PM2.5, Temp, Hum, Thermal)
├── hasOccupancy  → Occupancy (RDC 기반 재실 판단)
├── hasLocation   → Location (RDC 위치 데이터)
└── hasState      → EnvironmentState
```

---

## 규칙 기반 상태 판단

임계값 기준은 관련 법령을 준용하였다.

| 공간 타입 | 준거 법령 |
|-----------|-----------|
| classroom | 학교보건법 시행규칙 제3조 별표2 |
| hall | 실내공기질관리법 시행규칙 별표2 |
| lab | 학교보건법 준용 |

**임계값**

| 항목 | 쾌적 | 보통 | 위험 | 적용 공간 |
|------|------|------|------|-----------|
| CO₂ | ≤ 700 ppm | 700–1,000 ppm | > 1,000 ppm | 전체 |
| PM2.5 | ≤ 15 μg/m³ | 15–35 μg/m³ | > 35 μg/m³ | 교실·실험실 |
| PM2.5 | ≤ 25 μg/m³ | 25–50 μg/m³ | > 50 μg/m³ | 홀 |
| 온도 | 18–28 °C | — | 범위 이탈 | 교실·실험실 |
| 습도 | 30–80 % | — | 범위 이탈 | 교실·실험실 |
| 열화상 최고 | — | — | ≥ 50 °C | 전체 |

**판단 순서:** CO₂ → PM2.5 → 온도 → 습도 → 열화상 → 복합 이상 → 재실 여부 → CO₂ 추세

**상태 분류**

| 상태 | 조건 |
|------|------|
| `comfortable` | 모든 지표 정상 |
| `normal` | 1개 지표 주의 구간 |
| `danger` | 기준 초과 또는 복합 이상(2개↑) + 재실 |
| `abnormal` | 무재실 위험 / 센서 데이터 없음 |

---

## 통제된 LLM 해석

LLM은 상태 판단을 수행하지 않으며, 규칙 기반 판단 결과를 사용자에게 설명하는 보조 도구로만 활용된다.

**헐루시네이션 통제 방법**

1. **데이터 기반 출력 제한**: 프롬프트에서 센서 데이터와 판단 결과 범위 내에서만 설명 생성하도록 명시, 추측 금지
2. **규칙 기반 검증**: LLM 출력이 규칙 기반 판단 결과와 불일치할 경우 출력 제한

**프롬프트 설계 원칙**

- 센서 데이터·판단 결과만 기반, 외부 추측 금지
- 2문장 이내, 공간명 자연어 변환 (`2F-LEFT` → `2층 왼쪽`)
- 쾌적·보통 상태에서는 수치 미언급
- 위험 상태에서는 핵심 원인 1개만 안내
- ppm, μg/m³ 등 단위 기호 미사용 (TTS 호환)
- CO₂·PM2.5 이상 → 환기 / 온도 이상 → 냉난방 / 열화상 → 현장 확인

---

## 공간 구성 및 센서 매핑

현재 공간 매핑은 센서의 강의실별 정확한 배치 완료 전 단계의 임시 구획이다. 설치된 센서를 층별 좌·중앙·우 구역으로 묶어 복수 센서값의 평균·최댓값을 공간 대표값으로 산출한다.

| 공간 ID | 이름 | 유형 | EDC | IRC | RDC | AC |
|---------|------|------|:---:|:---:|:---:|----|
| `2F-LEFT` | 2층 왼쪽 교실 | classroom | 4 | 4 | 3 | — |
| `2F-HALL` | 2층 중앙 홀 | hall | 1 | 1 | 1 | — |
| `2F-RIGHT` | 2층 오른쪽 대형실 | lab | 6 | — | — | — |
| `3F-LEFT` | 3층 왼쪽 교실 | classroom | 7 | 2 | 5 | ✓ |
| `3F-HALL` | 3층 중앙 홀 | hall | 1 | — | — | — |
| `3F-RIGHT` | 3층 오른쪽 대형실 | lab | 3 | 4 | — | — |

> 에어컨 자동 제어는 `3F-LEFT` 1개 구역 파일럿 운영 중

---

## 데이터 수집 구조

SERDIC이 구축한 메시 네트워크(Edge Hub)를 통해 MariaDB로 수집된다.

| 센서 | DB 테이블 | 주요 컬럼 |
|------|-----------|-----------|
| 복합환경센서 (EDC) | `telemetry_cal` | `co2`, `aerosol`, `gas`, `temp`, `hum` |
| 열화상 카메라 (IRC) | `thermal_frame` | `stats_min`, `stats_max`, `stats_avg` |
| 레이더 (RDC) | `radar_frame` | `target_count` |

**데이터 선택 근거**

- `telemetry_cal` 사용: aerosol·gas는 보정값 우선, raw(`telemetry`)는 제외
- `telemetry-agg` (1h 집계): CO₂ 추세 예측용 CSV fallback, 30s/1M 단위 제외
- `thermal-pixels` 제외: 30GB 규모로 실시간 처리 불가, `thermal_frame` 통계값으로 대체
- `EDC-KBU-23~27` 제외: 1일치 데이터만 존재
- `RDC-KBU-02` 제외: 데이터 파일 없음

**개발 과정**

초기 프로토타입은 Jupyter Notebook(`rule_engine_v4.ipynb`)에서 CSV 기반으로 개발·검증 후, MariaDB 연동 FastAPI 서버로 이식하였다.

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
| RAM | 128 GB |
| GPU | 48 GB |
| OS | Ubuntu 24.04.2 LTS |
| Ollama | 0.20.7 |
| LLM | Gemma (로컬 추론, 외부 API 미사용) |

### 주요 라이브러리

**백엔드**: FastAPI, uvicorn, pymysql, aiohttp, pandas, thinqconnect, python-dotenv

**프론트엔드**: React 18, Recharts, Web Speech API

---

## 디렉터리 구조

```
kbu_serdic/
├── .env                      # 환경 변수 (버전 관리 제외)
├── backend/
│   ├── main.py               # FastAPI 앱, REST·WebSocket 엔드포인트
│   ├── sensor.py             # MariaDB 조회, 온톨로지 빌드
│   ├── rule_engine.py        # 규칙 기반 상태 판단, CO₂ 추세 예측
│   ├── llm.py                # Ollama LLM 호출, 자연어 생성
│   ├── ac.py                 # LG ThinQ API 에어컨 제어
│   └── config.py             # 환경 변수 로드, 임계값, 공간 매핑
├── notebooks/
│   └── rule_engine_v4.ipynb  # 프로토타입 (CSV 기반 개발·검증용)
└── src/
    ├── App.js
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

### 환경 변수 설정 (`.env`, 루트 경로)

| 변수 | 설명 | 예시 |
|------|------|------|
| `SENSOR_BASE` | 센서 집계 CSV fallback 경로 | `/home/kbu/sensor` |
| `OLLAMA_HOST` | Ollama 서버 호스트 | `127.0.0.1` |
| `OLLAMA_PORT` | Ollama 서버 포트 | `11434` |
| `OLLAMA_MODEL` | 사용 모델명 | `my-gemma` |
| `OLLAMA_TIMEOUT` | LLM 요청 타임아웃(초) | `300` |
| `THINQ_PAT` | LG ThinQ Personal Access Token | — |
| `THINQ_DEVICE_ID` | 에어컨 디바이스 ID | — |
| `DB_HOST` | MariaDB 호스트 | `localhost` |
| `DB_USER` | DB 사용자 | `kbu` |
| `DB_PASSWORD` | DB 비밀번호 | — |
| `DB_NAME` | DB 이름 | `kbu_sensor` |
| `DB_PORT` | DB 포트 | `3306` |
| `AUTO_AC` | 자동 AC 제어 활성화 | `true` / `false` |
| `WS_INTERVAL` | WebSocket 갱신 주기(초) | `5` |

### 백엔드

```bash
cd backend
pip install fastapi uvicorn aiohttp pymysql pandas python-dotenv thinqconnect
uvicorn main:app --host 0.0.0.0 --port 6668
```

### 프론트엔드

```bash
npm install
REACT_APP_WS_URL=ws://<서버IP>:6668/ws npm run build
```

---

## API 명세

### REST

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/health` | 서버 상태 확인 |
| GET | `/api/rooms` | 전체 공간 상태 조회 (`?include_llm=true`, `?auto_ac=true`) |
| GET | `/api/rooms/{room_id}` | 단일 공간 상태 조회 |
| GET | `/api/rooms/{room_id}/explain` | 단일 공간 LLM 해석 |
| POST | `/api/rooms/{room_id}/ac/{action}` | 에어컨 수동 제어 (`on` / `off`) |

### WebSocket `/ws`

```json
// 서버 → 클라이언트
{ "type": "update", "data": [ /* 전체 공간 상태 배열 */ ], "timestamp": "..." }

// 클라이언트 → 서버
{ "type": "ac_control", "room_id": "3F-LEFT", "action": "on" }
{ "type": "refresh", "include_llm": false }
```

---

*경북대학교 × SERDIC 산학협력 | 지능형 에너지 관리 디지털 트윈 테스트베드 구축 사업 Phase 1*
