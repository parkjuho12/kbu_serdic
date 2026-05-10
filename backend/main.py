from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Query
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
import asyncio
import json
import os
from datetime import datetime

from config import THINQ_DEVICE
from sensor import build_ontology, load_room_mapping
from rule_engine import rule_engine
from llm import llm_explain
from ac import ac_control, apply_ac

app = FastAPI(title='KBU 실내환경 모니터링', version='1.2.0')

app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_methods=['*'],
    allow_headers=['*'],
)

AUTO_AC = os.getenv('AUTO_AC', 'false').lower() == 'true'
WS_INTERVAL = int(os.getenv('WS_INTERVAL', '5'))


class ConnectionManager:
    def __init__(self):
        self.active: list[WebSocket] = []
        self.lock = asyncio.Lock()

    async def connect(self, ws: WebSocket):
        await ws.accept()
        async with self.lock:
            self.active.append(ws)

    async def disconnect(self, ws: WebSocket):
        async with self.lock:
            if ws in self.active:
                self.active.remove(ws)

    async def broadcast(self, data: dict):
        msg = json.dumps(data, ensure_ascii=False, default=str)
        dead = []
        async with self.lock:
            targets = list(self.active)
        for ws in targets:
            try:
                await ws.send_text(msg)
            except Exception:
                dead.append(ws)
        for ws in dead:
            await self.disconnect(ws)


manager = ConnectionManager()


def _judge_room_sync(room_id: str, mapping: dict) -> dict:
    ontology = build_ontology(room_id, mapping)
    return rule_engine(ontology)


async def judge_room(room_id: str, mapping: dict, auto_ac: bool = False) -> dict:
    result = await asyncio.to_thread(_judge_room_sync, room_id, mapping)
    if auto_ac:
        await apply_ac(mapping, result)
    return result


async def add_llm(result: dict) -> dict:
    result = dict(result)
    try:
        result['llm'] = await asyncio.to_thread(llm_explain, result)
    except asyncio.CancelledError:
        raise
    except Exception as e:
        result['llm'] = 'LLM 해석 중 오류 발생'
        result.setdefault('reason', []).append(f'LLM 오류: {e}')
    return result


async def run_all(include_llm: bool = False, auto_ac: bool = True) -> list[dict]:
    # 매 요청마다 DB에서 최신 매핑 로드
    ROOM_MAPPING = await asyncio.to_thread(load_room_mapping)

    tasks = [
        judge_room(room_id, mapping, auto_ac=auto_ac)
        for room_id, mapping in ROOM_MAPPING.items()
    ]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    clean_results = []
    for room_id, result in zip(ROOM_MAPPING.keys(), results):
        if isinstance(result, Exception):
            clean_results.append({
                'room_id': room_id,
                'hasState': 'abnormal',
                'reason': [f'처리 오류: {result}'],
                'prediction': None,
            })
        else:
            clean_results.append(result)

    if include_llm:
        llm_results = await asyncio.gather(*[add_llm(r) for r in clean_results], return_exceptions=True)
        final_results = []
        for room_id, result in zip(ROOM_MAPPING.keys(), llm_results):
            if isinstance(result, Exception):
                final_results.append({
                    'room_id': room_id,
                    'hasState': 'abnormal',
                    'reason': [f'LLM 처리 오류: {result}'],
                    'prediction': None,
                    'llm': 'LLM 해석 불가',
                })
            else:
                final_results.append(result)
        clean_results = final_results

    return clean_results


async def control_room_ac(room_id: str, action: str) -> dict:
    ROOM_MAPPING = await asyncio.to_thread(load_room_mapping)
    if room_id not in ROOM_MAPPING:
        raise HTTPException(status_code=404, detail=f'{room_id} not found')

    devices = ROOM_MAPPING[room_id].get('AC')
    if not devices:
        raise HTTPException(status_code=400, detail='이 공간에 에어컨이 없습니다')
    if action not in ('on', 'off'):
        raise HTTPException(status_code=400, detail='action은 on 또는 off')

    if isinstance(devices, str):
        devices = [devices]

    power = 'POWER_ON' if action == 'on' else 'POWER_OFF'
    await asyncio.gather(*[ac_control(device_id, power) for device_id in devices])

    event = {
        'type': 'ac_control',
        'room_id': room_id,
        'action': action,
        'devices': devices,
        'status': 'ok',
        'timestamp': datetime.now().isoformat(),
    }
    await manager.broadcast(event)
    return event


@app.get('/api/health')
async def health():
    return {'status': 'ok', 'timestamp': datetime.now().isoformat()}


@app.get('/api/rooms')
async def get_rooms(
    include_llm: bool = Query(False),
    auto_ac: bool = Query(True),
):
    return await run_all(include_llm=include_llm, auto_ac=auto_ac)


@app.get('/api/rooms/{room_id}')
async def get_room(room_id: str, include_llm: bool = False):
    ROOM_MAPPING = await asyncio.to_thread(load_room_mapping)
    if room_id not in ROOM_MAPPING:
        raise HTTPException(status_code=404, detail=f'{room_id} not found')
    result = await judge_room(room_id, ROOM_MAPPING[room_id], auto_ac=False)
    if include_llm:
        result = await add_llm(result)
    return result


@app.get('/api/rooms/{room_id}/explain')
async def explain_room(room_id: str):
    ROOM_MAPPING = await asyncio.to_thread(load_room_mapping)
    if room_id not in ROOM_MAPPING:
        raise HTTPException(status_code=404, detail=f'{room_id} not found')
    result = await judge_room(room_id, ROOM_MAPPING[room_id], auto_ac=False)
    return {'room_id': room_id, 'llm': await asyncio.to_thread(llm_explain, result)}


@app.post('/api/rooms/{room_id}/ac/{action}')
async def control_ac(room_id: str, action: str):
    return await control_room_ac(room_id, action)


async def ws_sender(ws: WebSocket):
    while True:
        results = await run_all(include_llm=False, auto_ac=AUTO_AC)
        await ws.send_text(json.dumps({
            'type': 'update',
            'data': results,
            'timestamp': datetime.now().isoformat(),
        }, ensure_ascii=False, default=str))
        await asyncio.sleep(WS_INTERVAL)


async def ws_receiver(ws: WebSocket):
    while True:
        raw = await ws.receive_text()
        try:
            msg = json.loads(raw)
        except json.JSONDecodeError:
            await ws.send_text(json.dumps({'type': 'error', 'detail': 'JSON 형식이 아닙니다'}, ensure_ascii=False))
            continue

        if msg.get('type') == 'ac_control':
            try:
                event = await control_room_ac(msg.get('room_id'), msg.get('action'))
                await ws.send_text(json.dumps(event, ensure_ascii=False, default=str))
            except HTTPException as e:
                await ws.send_text(json.dumps({'type': 'error', 'detail': e.detail}, ensure_ascii=False))
        elif msg.get('type') == 'refresh':
            results = await run_all(include_llm=bool(msg.get('include_llm')), auto_ac=False)
            await ws.send_text(json.dumps({'type': 'update', 'data': results}, ensure_ascii=False, default=str))
        else:
            await ws.send_text(json.dumps({'type': 'error', 'detail': '지원하지 않는 메시지 type입니다'}, ensure_ascii=False))


@app.websocket('/ws')
async def ws_endpoint(ws: WebSocket):
    await manager.connect(ws)
    sender = asyncio.create_task(ws_sender(ws))
    receiver = asyncio.create_task(ws_receiver(ws))
    try:
        done, pending = await asyncio.wait(
            {sender, receiver},
            return_when=asyncio.FIRST_COMPLETED,
        )
        for task in done:
            task.result()
    except WebSocketDisconnect:
        pass
    finally:
        sender.cancel()
        receiver.cancel()
        await manager.disconnect(ws)


STATIC_DIR = '/home/kbu/app/static'
if os.path.exists(f'{STATIC_DIR}/index.html'):
    app.mount('/', StaticFiles(directory=STATIC_DIR, html=True), name='static')


if __name__ == '__main__':
    import uvicorn
    uvicorn.run('main:app', host='0.0.0.0', port=6668, reload=False)
