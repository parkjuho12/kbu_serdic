import React from 'react';

const STATUS_META = {
  comfortable: { label: '쾌적', className: 'safe' },
  normal: { label: '보통', className: 'warn' },
  danger: { label: '위험', className: 'danger' },
  abnormal: { label: '비정상', className: 'abnormal' },
};

function getPrimaryIssue(room) {
  const m = room.hasMeasurement || {};
  if (m.co2 > 1000) return `CO₂ ${m.co2}ppm`;
  if (m.aerosol > (room.type === 'hall' ? 50 : 35)) return `PM2.5 ${m.aerosol}μg/m³`;
  if (m.temp != null && room.type !== 'hall' && (m.temp < 18 || m.temp > 28)) return `온도 ${m.temp}°C`;
  if (m.hum != null && room.type !== 'hall' && (m.hum < 30 || m.hum > 80)) return `습도 ${m.hum}%`;
  return room.reason?.[0] || '상태 확인 필요';
}

export default function SummaryBar({ rooms, floor, selectedRoom, onSelectRoom }) {
  const counts = rooms.reduce((acc, r) => {
    acc[r.hasState] = (acc[r.hasState] || 0) + 1;
    return acc;
  }, {});

  const alerts = rooms
    .filter(r => ['danger', 'abnormal'].includes(r.hasState))
    .sort((a, b) => (a.hasState === 'danger' ? -1 : 1) - (b.hasState === 'danger' ? -1 : 1));

  const floorRooms = rooms.filter(r => r.floor === floor);

  return (
    <div className="side-panel glass-panel">
      <section className="side-section hero-summary">
        <p className="eyebrow">SYSTEM OVERVIEW</p>
        <div className="total-count">{rooms.length || '—'}</div>
        <span>관리 공간</span>
      </section>

      <section className="side-section">
        <div className="section-title">상태 요약</div>
        <div className="status-grid">
          {Object.entries(STATUS_META).map(([key, meta]) => (
            <div key={key} className={`status-tile ${meta.className}`}>
              <strong>{counts[key] || 0}</strong>
              <span>{meta.label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="side-section">
        <div className="section-title">우선 확인 알림</div>
        <div className="alert-list">
          {alerts.length === 0 ? (
            <div className="quiet-box">현재 위험 알림이 없습니다.</div>
          ) : alerts.slice(0, 4).map(room => (
            <button key={room.room_id} className="alert-item" onClick={() => onSelectRoom(room)}>
              <span className={`severity-dot ${room.hasState}`} />
              <div>
                <strong>{room.name}</strong>
                <small>{getPrimaryIssue(room)}</small>
              </div>
            </button>
          ))}
        </div>
      </section>

      <section className="side-section">
        <div className="section-title">{floor}F 공간 목록</div>
        <div className="room-list">
          {floorRooms.map(room => {
            const meta = STATUS_META[room.hasState] || STATUS_META.abnormal;
            return (
              <button
                key={room.room_id}
                className={`room-list-item ${selectedRoom?.room_id === room.room_id ? 'selected' : ''}`}
                onClick={() => onSelectRoom(room)}
              >
                <span className={`severity-dot ${room.hasState}`} />
                <div>
                  <strong>{room.name}</strong>
                  <small>{meta.label} · {room.hasOccupancy ? `재실 ${room.occupantCount}명` : '무재실/미확인'}</small>
                </div>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
