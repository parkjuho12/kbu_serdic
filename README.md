# KBU 실내환경 모니터링 시스템

> 경북대학교 창조관 2·3층 실내 환경을 실시간으로 감지·판단·제어하는 온톨로지 기반 스마트 빌딩 모니터링 플랫폼

---

## 목차

1. [프로젝트 배경](#프로젝트-배경)
2. [시스템 개요](#시스템-개요)
3. [아키텍처](#아키텍처)
4. [데이터 수집 구조](#데이터-수집-구조)
5. [공간 매핑 설계](#공간-매핑-설계)
6. [주요 기능](#주요-기능)
7. [기술 스택](#기술-스택)
8. [디렉터리 구조](#디렉터리-구조)
9. [설치 및 실행](#설치-및-실행)
10. [환경 변수](#환경-변수)
11. [API 명세](#api-명세)
12. [판단 로직 (Rule Engine)](#판단-로직-rule-engine)
13. [LLM 자연어 해석](#llm-자연어-해석)
14. [에어컨 자동 제어](#에어컨-자동-제어)

---

## 프로젝트 배경

본 시스템은 SERDIC(세르딕)과의 산학 협력을 통해 수행된 경북대학교 지능형 에너지 관리 디지털 트윈 테스트베드 구축 사업 (Phase 1, 2025)의 일환으로 개발되었다.

Phase 1에서는 창조관 2·3층을 초기 테스트 구역으로 설정하여 복합환경센서(EDC), 비전 센서(IRC), 레이더(RDC) 등 이기종 센서 인프라를 메시 네트워크로 구성하고, Edge Hub를 통해 관제 서버로 데이터를 수집한다.

**3단계 로드맵:**

| Phase | 연도 | 주요 내용 |
|-------|------|-----------|
| Phase I | 2025 | 하드웨어 설치, 센서 데이터 수집, 모니터링 대시보드 구축 |
| Phase II | 2026 | 웹 기반 디지털 트윈 구축, 환경 시뮬레이션, HVAC 탄력 시나리오 개발 |
| Phase III | 2027 | AI 에이전트 기반 HVAC 자동 제어, 전체 통합 디지털 트윈 최적화 |

> 본 저장소는 Phase 1 모니터링 시스템에 해당한다.

---

## 시스템 개요

수집된 센서 데이터를 온톨로지 구조로 변환하고, 규칙 기반 엔진으로 공간 상태를 실시간 판단하며, 로컬 LLM이 자연어로 해석하는 플랫폼이다.

```
센서 (EDC / IRC / RDC)
        │  메시 네트워크 (SERDIC Edge Hub)
        ▼
  MariaDB (telemetry_cal / radar_frame / thermal_frame)
        │
        ▼
  온톨로지 빌드 (build_ontology)
        │
        ▼
  규칙 엔진 판단 (rule_engine)  ──►  AC 자동 제어 (ThinQ API)
        │
        ▼
  LLM 자연어 해석 (Ollama / Gemma)
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

| 레이어 | 파일 | 역할 |
|--------|------|------|
| API 서버 | `main.py` | FastAPI, REST + WebSocket 엔드포인트 |
| 센서 수집 | `sensor.py` | MariaDB 쿼리, 온톨로지 객체 구성 |
| 판단 엔진 | `rule_engine.py` | 임계값 기반 상태 판단, CO₂ 추세 예측 |
| LLM 해석 | `llm.py` | Ollama 로컬 LLM, TTS용 자연어 생성 |
| AC 제어 | `ac.py` | LG ThinQ REST API 호출 |
| 설정 | `config.py` | 환경 변수, 임계값, 공간-디바이스 매핑 |

### 프론트엔드

| 컴포넌트 | 역할 |
|----------|------|
| `App.js` | 전역 상태, WebSocket 연결, 2단계 데이터 로드 |
| `FloorLayout.js` | 층별 평면도 미니맵 + 공간 카드 그리드 |
| `RoomCard.js` | 공간별 센서값·상태 카드 |
| `DetailPanel.js` | 상세 정보, LLM 해석, TTS 재생, AC 수동 제어 |
| `TrendChart.js` | Recharts 기반 CO₂·온도·습도·PM2.5 트렌드 |
| `SummaryBar.js` | 전체/쾌적/보통/위험/비정상 집계 바 |

---

## 데이터 수집 구조

### 센서 종류 및 DB 테이블

SERDIC이 구축한 메시 네트워크(Edge Hub)를 통해 3종 이기종 센서 데이터가 MariaDB에 수집된다.

| 센서 | 디바이스 접두사 | DB 테이블 | 주요 컬럼 |
|------|----------------|-----------|-----------|
| 복합환경센서 (EDC) | `EDC-KBU-*` | `telemetry_cal` | `co2`, `aerosol`, `gas`, `temp`, `hum` |
| 열화상 카메라 (IRC) | `IRC-KBU-*` | `thermal_frame` | `stats_min`, `stats_max`, `stats_avg`, `stats_center` |
| 레이더 (RDC) | `RDC-KBU-*` | `radar_frame` | `target_count` |

**사용 데이터 및 선택 근거:**

- `telemetry_cal` (보정값): CO₂·온도·습도는 raw와 동일하나 aerosol·gas는 보정값 우선 사용
- `telemetry-agg` (1h 집계): CO₂ 추세 예측용 (DB 미적재로 CSV fallback 사용, 30s/1M 단위는 제외)
- `thermal_frame` (열화상 통계): `thermal-pixels`(30GB .csv.gz)는 실시간 처리 불가하여 통계값만 활용

**제외 데이터 및 근거:**

- `telemetry` (raw): `telemetry_cal`과 중복, 보정값 우선
- `thermal-pixels`: 30GB 규모로 실시간 처리 불가
- `EDC-KBU-23~27`: 2026-03-31 단 1일치 데이터만 존재하여 제외
- `RDC-KBU-02`: 데이터 파일 없음

### 개발 과정

초기 프로토타입은 Jupyter Notebook(`rule_engine_v4.ipynb`)에서 CSV 파일 기반으로 개발·검증하였고, 이후 MariaDB 연동 FastAPI 서버로 이식하였다. 노트북은 데이터 탐색, 임계값 검토, 규칙 엔진 단위 테스트, LLM 프롬프트 튜닝의 기반이 되었다.

```
CSV 파일 기반 프로토타입 (rule_engine_v4.ipynb)
        │  검증 완료 후 이식
        ▼
MariaDB 연동 FastAPI 서버 (현재 운영 버전)
```

---

## 공간 매핑 설계

### 임시 구역 분류의 배경

현재 공간 매핑(`2F-LEFT`, `2F-RIGHT` 등)은 센서의 정확한 강의실별 배치가 완료되기 전 단계의 임시 구획이다. Phase 1에서 설치된 센서를 층별 좌/중앙/우 구역으로 묶어 복수 센서값의 평균·최댓값을 공간 대표값으로 산출하며, Phase 2 이후 강의실 단위 매핑으로 세분화할 예정이다.

### 공간-디바이스 매핑 현황

| 공간 ID | 이름 | 유형 | EDC | IRC | RDC | AC |
|---------|------|------|:---:|:---:|:---:|----|
| `2F-LEFT` | 2층 왼쪽 교실 | classroom | 4 | 4 | 3 | — |
| `2F-HALL` | 2층 중앙 홀 | hall | 1 | 1 | 1 | — |
| `2F-RIGHT` | 2층 오른쪽 대형실 | lab | 6 | — | — | — |
| `3F-LEFT` | 3층 왼쪽 교실 | classroom | 7 | 2 | 5 | ✓ |
| `3F-HALL` | 3층 중앙 홀 | hall | 1 | — | — | — |
| `3F-RIGHT` | 3층 오른쪽 대형실 | lab | 3 | 4 | — | — |

> 에어컨 자동 제어는 현재 `3F-LEFT` 1개 구역을 대상으로 파일럿 운영 중이며, 나머지 공간은 Phase 2에서 확장 예정이다.

---

## 주요 기능

### 실시간 모니터링
- WebSocket을 통한 5초 주기 자동 갱신 (환경 변수로 설정 가능)
- 층별 평면도 미니맵 + 공간 카드 동시 표시
- 연결 끊김 시 5초 후 자동 재접속

### 온톨로지 기반 상태 판단
공간 유형별 임계값을 적용하여 4단계 상태 판단:

| 상태 | 의미 |
|------|------|
| `comfortable` | 쾌적 — 모든 지표 정상 |
| `normal` | 보통 — 1개 지표 주의 구간 |
| `danger` | 위험 — 기준 초과 또는 복합 이상 + 재실 |
| `abnormal` | 비정상 — 무재실 위험 또는 센서 오류 |

### CO₂ 추세 예측
1시간 단위 집계 데이터를 기반으로 선형 변화율을 산출하여 위험 기준치 도달 예상 시간을 계산하고 사전 경보를 발생시킨다.

### LLM 자연어 해석 (TTS 지원)
- TX2550 M7 GPU 서버(GPU 48GB, RAM 128GB)에서 Gemma 모델을 Ollama로 로컬 추론
- 외부 API 미사용으로 센서 데이터 외부 유출 없음
- 브라우저 SpeechSynthesis API로 한국어 음성 재생 지원

### 에어컨 자동 제어 (LG ThinQ)
- `danger` + 재실 확인 시 자동 ON, 실온 28°C 초과 시 목표 22°C, 그 외 24°C
- 수동 제어(REST / WebSocket) 및 전체 클라이언트 브로드캐스트

---

## 기술 스택

### 백엔드
- Python 3.11+, FastAPI, uvicorn
- aiohttp (비동기 ThinQ API 호출)
- pymysql (MariaDB 연결)
- pandas (CSV 집계 fallback)
- python-dotenv, thinqconnect

### 프론트엔드
- React 18, Recharts, Web Speech API

### 인프라
- **MariaDB** — 센서 텔레메트리 저장
- **Ollama** — 로컬 LLM 추론 서버 (Gemma 모델)
- **LG ThinQ API** — 에어컨 제어
- **SERDIC EdgeHub** — 메시 네트워크 기반 센서 데이터 수집

---

## 디렉터리 구조

```
project/
├── backend/
│   ├── main.py          # FastAPI 앱, REST·WebSocket 엔드포인트
│   ├── sensor.py        # MariaDB 조회, 온톨로지 빌드
│   ├── rule_engine.py   # 규칙 기반 상태 판단, CO₂ 예측
│   ├── llm.py           # Ollama LLM 호출, 자연어 생성
│   ├── ac.py            # LG ThinQ API 에어컨 제어
│   ├── config.py        # 환경 변수, 임계값, 공간 매핑
│   
├── notebooks/
│   └── rule_engine_v4.ipynb  # 프로토타입 (CSV 기반 개발·검증용)
└── src/
│   ├── App.js
│   ├── api.js
│   ├── index.css
│   └── components/
│       ├── Header.js
│       ├── SummaryBar.js
│       ├── FloorLayout.js
│       ├── RoomCard.js
│       ├── DetailPanel.js
│       └── TrendChart.js
└── .env             # 시크릿 (버전 관리 제외)
```

---

## 설치 및 실행

### 사전 요구사항
- Python 3.11+, Node.js 18+
- MariaDB (SERDIC EdgeHub에서 수집 중인 DB)
- Ollama (로컬 LLM 서버, Gemma 모델 등록 완료)

## 환경변수
cp .env.example .env

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
# 빌드 결과물을 /home/kbu/app/static 에 배포
```

---

## 환경 변수

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

**서버 → 클라이언트**
```json
{ "type": "update", "data": [ /* 전체 공간 상태 배열 */ ], "timestamp": "..." }
```

**클라이언트 → 서버**
```json
{ "type": "ac_control", "room_id": "3F-LEFT", "action": "on" }
{ "type": "refresh", "include_llm": false }
```

---

## 판단 로직 (Rule Engine)

임계값 기준은 관련 법령을 준용한다.

| 공간 타입 | 준거 법령 |
|-----------|-----------|
| classroom | 학교보건법 시행규칙 제3조 별표2 |
| hall | 실내공기질관리법 시행규칙 별표2 (다중이용시설) |
| lab | 학교보건법 준용 |

| 항목 | 쾌적 | 위험 | 적용 공간 |
|------|------|------|-----------|
| CO₂ | ≤ 700 ppm | > 1,000 ppm | 전체 |
| PM2.5 | ≤ 15 μg/m³ | > 35 μg/m³ | 교실·실험실 |
| PM2.5 | ≤ 25 μg/m³ | > 50 μg/m³ | 홀 |
| 온도 | 18–28 °C | 범위 이탈 | 교실·실험실 |
| 습도 | 30–80 % | 범위 이탈 | 교실·실험실 |
| 열화상 최고 | — | ≥ 50 °C | 전체 |

**판단 순서:** CO₂ → PM2.5 → 온도 → 습도 → 열화상 → 복합 이상 → 재실 여부 → CO₂ 추세

복합 이상(2개 이상 동시 발생) 시 `normal` → `danger` 자동 상향. 재실 여부에 따라 `danger` ↔ `abnormal` 전환.

---

## LLM 자연어 해석

로컬 Ollama 서버(TX2550 M7, GPU 48GB)에서 Gemma 모델을 추론하여 TTS 최적화 자연어를 생성한다.

**프롬프트 설계 원칙:**
- 센서 데이터·판단 결과만 기반, 추측 금지
- 2문장 이내, 공간명 자연어 변환 (`2F-LEFT` → `2층 왼쪽`)
- 쾌적/보통 시 수치 미언급, 위험 시 핵심 항목 1개만 안내
- ppm, μg/m³ 등 단위 기호 미사용 (TTS 호환)
- CO₂·PM2.5 이상 → 환기 안내 / 온도 이상 → 냉난방 조절 / 열화상 과열 → 현장 확인

---

## 향후 계획 (Phase 2 연계)

- 강의실 단위 세분화 매핑 (현재 구역 단위 → 개별 강의실)
- 실측 집계 데이터 기반 트렌드 시각화
- 강의 시간표 연동 HVAC 탄력 시나리오
- AC 제어 대상 공간 확장

---

*본 시스템은 경북대학교 × SERDIC 산학협력 프로젝트의 일환으로 개발되었으며, 지능형 에너지 관리 디지털 트윈 테스트베드 구축 사업 Phase 1에 해당합니다.*
