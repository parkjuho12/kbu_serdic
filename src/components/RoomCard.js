import React from 'react';

const STATUS = {
  comfortable: { label: '쾌적',   color: 'var(--safe)',     bg: 'var(--safe-bg)' },
  normal:      { label: '보통',   color: 'var(--warn)',     bg: 'var(--warn-bg)' },
  danger:      { label: '위험',   color: 'var(--danger)',   bg: 'var(--danger-bg)' },
  abnormal:    { label: '비정상', color: 'var(--abnormal)', bg: 'var(--abnormal-bg)' },
};

function Metric({ label, value, unit, warn }) {
  return (
    <div style={{
      padding: '8px 10px',
      background: 'var(--bg)',
      borderRadius: 6,
      border: `1px solid ${warn ? 'rgba(243,139,168,0.3)' : 'var(--border)'}`,
    }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text2)', marginBottom: 3 }}>
        {label}
      </div>
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: 15, fontWeight: 500,
        color: warn ? 'var(--danger)' : 'var(--text)',
      }}>
        {value !== null && value !== undefined ? value : '—'}
        {value !== null && value !== undefined && (
          <span style={{ fontSize: 10, color: 'var(--text2)', marginLeft: 3 }}>{unit}</span>
        )}
      </div>
    </div>
  );
}

export default function RoomCard({ room, selected, onClick }) {
  const m      = room.hasMeasurement || {};
  const s      = STATUS[room.hasState] || STATUS.abnormal;
  const th     = room.type === 'hall' ? { co2: 1000, aerosol: 50 } : { co2: 1000, aerosol: 35, temp: [18,28], hum: [30,80] };

  return (
    <div
      onClick={() => onClick(room)}
      style={{
        background:   selected ? 'var(--bg3)' : 'var(--bg2)',
        border:       `1px solid ${selected ? 'var(--accent)' : 'var(--border)'}`,
        borderRadius: 12,
        padding:      '16px 18px',
        cursor:       'pointer',
        transition:   'all 0.2s',
        position:     'relative',
        overflow:     'hidden',
        animation:    'fadeIn 0.3s ease',
      }}
    >
      {/* 상태 표시줄 */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 2,
        background: s.color, opacity: 0.8,
      }}/>

      {/* 헤더 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>{room.name}</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text2)' }}>{room.room_id}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '3px 9px', borderRadius: 20,
            background: s.bg, border: `1px solid ${s.color}40`,
          }}>
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: s.color }}/>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 500, color: s.color }}>
              {s.label}
            </span>
          </div>
          {/* 재실 */}
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text2)' }}>
            {room.hasOccupancy === null ? '재실미확인' :
             room.hasOccupancy ? `재실 ${room.occupantCount}명` : '무재실'}
          </div>
        </div>
      </div>

      {/* 센서값 그리드 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        <Metric label="CO₂" value={m.co2} unit="ppm" warn={m.co2 > th.co2} />
        <Metric label="PM2.5" value={m.aerosol} unit="μg/m³" warn={m.aerosol > th.aerosol} />
        <Metric label="온도" value={m.temp} unit="°C"
          warn={m.temp !== null && th.temp && (m.temp < th.temp[0] || m.temp > th.temp[1])} />
        <Metric label="습도" value={m.hum} unit="%"
          warn={m.hum !== null && th.hum && (m.hum < th.hum[0] || m.hum > th.hum[1])} />
      </div>

      {/* 에어컨 아이콘 */}
      {room.hasAC && (
        <div style={{
          marginTop: 10, display: 'flex', alignItems: 'center', gap: 5,
          fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--accent2)',
        }}>
          <span>❄</span> AC 연동
        </div>
      )}

      {/* 판단 근거 (첫 번째만) */}
      {room.reason && room.reason.length > 0 && (
        <div style={{
          marginTop: 10, padding: '6px 10px',
          background: 'var(--bg)', borderRadius: 5,
          fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text2)',
          borderLeft: `2px solid ${s.color}60`,
        }}>
          {room.reason[0]}
        </div>
      )}

      {room.llm && (
        <div style={{
          marginTop: 10, padding: '10px 12px',
          background: 'rgba(255,255,255,0.04)', borderRadius: 10,
          fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text3)',
          lineHeight: 1.4,
          maxHeight: 54,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'pre-wrap',
        }}>
          {room.llm.split('\n')[0] || room.llm}
        </div>
      )}
    </div>
  );
}
