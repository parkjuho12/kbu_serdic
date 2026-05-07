import React from 'react';

const STATUS = {
  comfortable: { label: '쾌적', className: 'safe' },
  normal: { label: '보통', className: 'warn' },
  danger: { label: '위험', className: 'danger' },
  abnormal: { label: '비정상', className: 'abnormal' },
};

export default function RoomCard({ room, selected, onClick }) {
  const m = room.hasMeasurement || {};
  const s = STATUS[room.hasState] || STATUS.abnormal;
  const primary = m.co2 != null ? `${m.co2}ppm` : m.temp != null ? `${m.temp}°C` : '—';

  return (
    <button className={`compact-room-card ${s.className} ${selected ? 'selected' : ''}`} onClick={() => onClick(room)}>
      <div>
        <p>{room.room_id}</p>
        <strong>{room.name}</strong>
      </div>
      <span>{s.label}</span>
      <em>{primary}</em>
    </button>
  );
}
