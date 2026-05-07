import React from 'react';
import RoomCard from './RoomCard';

const STATUS_META = {
  comfortable: { label: '쾌적', className: 'safe' },
  normal: { label: '보통', className: 'warn' },
  danger: { label: '위험', className: 'danger' },
  abnormal: { label: '비정상', className: 'abnormal' },
};

const MAIN_ROOMS = { 2: ['2F-LEFT', '2F-RIGHT'], 3: ['3F-LEFT', '3F-RIGHT'] };
const HALL_ROOMS = { 2: '2F-HALL', 3: '3F-HALL' };

function SensorMarker({ label, value, x, y, state }) {
  return (
    <div className={`sensor-marker ${state || 'comfortable'}`} style={{ left: `${x}%`, top: `${y}%` }}>
      <span>{label}</span>
      <strong>{value ?? '—'}</strong>
    </div>
  );
}

function Zone({ room, selected, onSelect, area, children }) {
  if (!room) return <div className={`floor-zone ${area} empty`} />;
  const meta = STATUS_META[room.hasState] || STATUS_META.abnormal;
  const m = room.hasMeasurement || {};

  return (
    <button
      className={`floor-zone ${area} ${meta.className} ${selected ? 'selected' : ''}`}
      onClick={() => onSelect(room)}
    >
      <div className="zone-header">
        <div>
          <p>{room.room_id}</p>
          <h2>{room.name}</h2>
        </div>
        <span>{meta.label}</span>
      </div>

      <div className="zone-core-metrics">
        <div>
          <small>CO₂</small>
          <strong>{m.co2 ?? '—'}</strong>
        </div>
        <div>
          <small>PM2.5</small>
          <strong>{m.aerosol ?? '—'}</strong>
        </div>
        <div>
          <small>온도</small>
          <strong>{m.temp ?? '—'}</strong>
        </div>
      </div>

      {children}

      {room.hasAC && <div className="ac-badge">AC</div>}
      <div className="occupancy-badge">
        {room.hasOccupancy === null ? '재실 미확인' : room.hasOccupancy ? `${room.occupantCount}명 재실` : '무재실'}
      </div>
    </button>
  );
}

export default function FloorLayout({ floor, rooms, selectedRoom, onSelect }) {
  const layout = MAIN_ROOMS[floor] || [];
  const hallId = HALL_ROOMS[floor];
  const roomMap = Object.fromEntries(rooms.map(r => [r.room_id, r]));
  const leftRoom = roomMap[layout[0]];
  const rightRoom = roomMap[layout[1]];
  const hallRoom = roomMap[hallId];

  return (
    <div className="floor-layout">
      <div className="floor-map-header">
        <div>
          <p className="eyebrow">FLOOR DIGITAL TWIN</p>
          <h2>창조관 {floor}층 공간 현황</h2>
        </div>
        <div className="legend">
          {Object.entries(STATUS_META).map(([key, meta]) => (
            <span key={key}><i className={`severity-dot ${key}`} />{meta.label}</span>
          ))}
        </div>
      </div>

      <div className="floor-canvas">
        <Zone
          room={leftRoom}
          area="left-zone"
          selected={selectedRoom?.room_id === leftRoom?.room_id}
          onSelect={onSelect}
        >
          <SensorMarker label="CO₂" value={leftRoom?.hasMeasurement?.co2} x={21} y={65} state={leftRoom?.hasState} />
          <SensorMarker label="PM" value={leftRoom?.hasMeasurement?.aerosol} x={68} y={30} state={leftRoom?.hasState} />
        </Zone>

        <Zone
          room={hallRoom}
          area="hall-zone"
          selected={selectedRoom?.room_id === hallRoom?.room_id}
          onSelect={onSelect}
        />

        <Zone
          room={rightRoom}
          area="right-zone"
          selected={selectedRoom?.room_id === rightRoom?.room_id}
          onSelect={onSelect}
        >
          <SensorMarker label="CO₂" value={rightRoom?.hasMeasurement?.co2} x={24} y={34} state={rightRoom?.hasState} />
          <SensorMarker label="PM" value={rightRoom?.hasMeasurement?.aerosol} x={72} y={68} state={rightRoom?.hasState} />
        </Zone>
      </div>

      <div className="compact-card-row">
        {rooms.map(room => (
          <RoomCard
            key={room.room_id}
            room={room}
            selected={selectedRoom?.room_id === room.room_id}
            onClick={onSelect}
          />
        ))}
      </div>
    </div>
  );
}
