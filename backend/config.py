import os
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / "../.env")

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
