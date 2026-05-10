import os
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

SENSOR_BASE  = Path(os.getenv('SENSOR_BASE', '/home/kbu/sensor'))
OLLAMA_URL     = f"http://{os.getenv('OLLAMA_HOST')}:{os.getenv('OLLAMA_PORT')}/api/generate"
OLLAMA_MODEL   = os.getenv('OLLAMA_MODEL')
OLLAMA_TIMEOUT = int(os.getenv('OLLAMA_TIMEOUT', 300))
THINQ_PAT      = os.getenv('THINQ_PAT')
THINQ_DEVICE   = os.getenv('THINQ_DEVICE_ID')

DB_CONFIG = {
    'host':     os.getenv('DB_HOST'),
    'user':     os.getenv('DB_USER', 'kbu'),
    'password': os.getenv('DB_PASSWORD', ''),
    'db':       os.getenv('DB_NAME', 'kbu_sensor'),
    'port':     int(os.getenv('DB_PORT', 3306)),
    'charset':  'utf8mb4',
}

THRESHOLDS = {
    'classroom': {
        'co2':     {'comfortable': 700, 'normal': 1000},
        'aerosol': {'comfortable': 15,  'normal': 35},
        'temp':    {'min': 18, 'max': 28},
        'hum':     {'min': 30, 'max': 80},
    },
    'hall': {
        'co2':     {'comfortable': 700, 'normal': 1000},
        'aerosol': {'comfortable': 25,  'normal': 50},
        'temp':    None,
        'hum':     None,
    },
    'lab': {
        'co2':     {'comfortable': 700, 'normal': 1000},
        'aerosol': {'comfortable': 15,  'normal': 35},
        'temp':    {'min': 18, 'max': 28},
        'hum':     {'min': 30, 'max': 80},
    },
}

ROOM_MAPPING = {
    '2F-LEFT': {
        'floor': 2, 'type': 'classroom', 'name': '2층 왼쪽 교실',
        'EDC': ['EDC-KBU-12', 'EDC-KBU-13', 'EDC-KBU-14', 'EDC-KBU-15'],
        'IRC': ['IRC-KBU-01', 'IRC-KBU-02', 'IRC-KBU-03', 'IRC-KBU-04'],
        'RDC': ['RDC-KBU-03', 'RDC-KBU-08', 'RDC-KBU-09'],
        'AC':  None,
    },
    '2F-HALL': {
        'floor': 2, 'type': 'hall', 'name': '2층 중앙 홀',
        'EDC': ['EDC-KBU-16'],
        'IRC': ['IRC-KBU-05'],
        'RDC': ['RDC-KBU-10'],
        'AC':  None,
    },
    '2F-RIGHT': {
        'floor': 2, 'type': 'lab', 'name': '2층 오른쪽 대형실',
        'EDC': ['EDC-KBU-17', 'EDC-KBU-18', 'EDC-KBU-19', 'EDC-KBU-20', 'EDC-KBU-21', 'EDC-KBU-22'],
        'IRC': [], 'RDC': [], 'AC': None,
    },
    '3F-LEFT': {
        'floor': 3, 'type': 'classroom', 'name': '3층 왼쪽 교실',
        'EDC': ['EDC-KBU-01', 'EDC-KBU-02', 'EDC-KBU-03', 'EDC-KBU-04', 'EDC-KBU-08', 'EDC-KBU-09', 'EDC-KBU-10'],
        'IRC': ['IRC-KBU-06', 'IRC-KBU-07'],
        'RDC': ['RDC-KBU-06', 'RDC-KBU-07', 'RDC-KBU-18', 'RDC-KBU-19', 'RDC-KBU-20'],
        'AC':  THINQ_DEVICE,
    },
    '3F-HALL': {
        'floor': 3, 'type': 'hall', 'name': '3층 중앙 홀',
        'EDC': ['EDC-KBU-05'],
        'IRC': [], 'RDC': [], 'AC': None,
    },
    '3F-RIGHT': {
        'floor': 3, 'type': 'lab', 'name': '3층 오른쪽 대형실',
        'EDC': ['EDC-KBU-06', 'EDC-KBU-07', 'EDC-KBU-11'],
        'IRC': ['IRC-KBU-08', 'IRC-KBU-09', 'IRC-KBU-10', 'IRC-KBU-11'],
        'RDC': [], 'AC': None,
    },
}
