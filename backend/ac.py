import uuid
from aiohttp import ClientSession
from thinqconnect.thinq_api import ThinQApi
from config import THINQ_PAT


async def ac_control(device_id, power, target_temp=24):
    async with ClientSession() as session:
        api = ThinQApi(
            session=session,
            access_token=THINQ_PAT,
            country_code='KR',
            client_id=str(uuid.uuid4()),
        )
        try:
            await api.async_post_device_control(
                device_id=device_id,
                payload={'operation': {'airConOperationMode': power}},
            )
            if power == 'POWER_ON':
                await api.async_post_device_control(
                    device_id=device_id,
                    payload={'temperature': {'targetTemperature': target_temp}},
                )
            print(f'[AC] {device_id} → {power}')
            return {'device_id': device_id, 'power': power, 'status': 'ok'}
        except Exception as e:
            print(f'[AC] 스킵: {e}')
            return {'device_id': device_id, 'power': power, 'status': 'error', 'detail': str(e)}


async def apply_ac(mapping, result):
    devices = mapping.get('AC')
    if not devices:
        return []
    if isinstance(devices, str):
        devices = [devices]

    state = result['hasState']
    occupied = result['hasOccupancy']
    temp = result['hasMeasurement'].get('temp')
    target = 22 if temp and temp > 28 else 24

    outputs = []
    for device_id in devices:
        # 위험 + 재실 있음 → AC ON
        if state == 'danger' and occupied is True:
            outputs.append(await ac_control(device_id, 'POWER_ON', target))
        # 나머지 경우 → AC OFF
        # (무재실 또는 위험 아님)
        else:
            outputs.append(await ac_control(device_id, 'POWER_OFF'))
    return outputs
