import React from 'react';

const STATUS = {
  comfortable: { label:'쾌적',   color:'var(--safe)',     bg:'var(--safe-bg)',     glow:'var(--safe-glow)' },
  normal:      { label:'보통',   color:'var(--warn)',     bg:'var(--warn-bg)',     glow:'var(--warn-glow)' },
  danger:      { label:'위험',   color:'var(--danger)',   bg:'var(--danger-bg)',   glow:'var(--danger-glow)' },
  abnormal:    { label:'비정상', color:'var(--abnormal)', bg:'var(--abnormal-bg)', glow:'none' },
};

function Metric({ label, value, unit, warn, large }) {
  return (
    <div style={{
      padding: large ? '10px 12px' : '8px 10px',
      background:'rgba(0,0,0,0.3)',
      borderRadius:4,
      border:`1px solid ${warn ? 'rgba(255,64,96,0.4)' : 'var(--border)'}`,
      position:'relative', overflow:'hidden',
    }}>
      {warn && <div style={{ position:'absolute', top:0, left:0, right:0, height:1, background:'var(--danger)', opacity:0.6 }}/>}
      <div style={{ fontFamily:'var(--font-mono)', fontSize:9, color:'var(--text3)', marginBottom:4, letterSpacing:'0.06em' }}>{label}</div>
      <div style={{ fontFamily:'var(--font-mono)', fontSize: large ? 20 : 14, fontWeight:600, color: warn ? 'var(--danger)' : 'var(--text)', lineHeight:1 }}>
        {value !== null && value !== undefined ? value : '—'}
        {value !== null && value !== undefined && (
          <span style={{ fontSize:9, color:'var(--text3)', marginLeft:3, fontWeight:400 }}>{unit}</span>
        )}
      </div>
    </div>
  );
}

export default function RoomCard({ room, selected, onClick }) {
  const m  = room.hasMeasurement || {};
  const s  = STATUS[room.hasState] || STATUS.abnormal;
  const th = room.type === 'hall' ? { co2:1000, aerosol:50 } : { co2:1000, aerosol:35, temp:[18,28], hum:[30,80] };
  const isDanger = room.hasState === 'danger';

  return (
    <div onClick={() => onClick(room)} style={{
      background: selected ? 'var(--bg3)' : 'var(--bg2)',
      border:`1px solid ${selected ? s.color : isDanger ? 'rgba(255,64,96,0.3)' : 'var(--border)'}`,
      borderRadius:8,
      padding:'16px',
      cursor:'pointer',
      transition:'all 0.2s',
      position:'relative', overflow:'hidden',
      animation:'fadeUp 0.3s ease',
      boxShadow: isDanger ? 'inset 0 0 40px rgba(255,64,96,0.04)' : 'none',
    }}>
      {/* 상단 상태바 */}
      <div style={{
        position:'absolute', top:0, left:0, right:0, height:2,
        background: s.color,
        boxShadow: selected || isDanger ? s.glow : 'none',
      }}/>

      {/* 모서리 장식 */}
      <div style={{ position:'absolute', top:6, right:6, width:6, height:6, borderTop:`1px solid ${s.color}`, borderRight:`1px solid ${s.color}`, opacity:0.6 }}/>
      <div style={{ position:'absolute', bottom:6, left:6, width:6, height:6, borderBottom:`1px solid ${s.color}`, borderLeft:`1px solid ${s.color}`, opacity:0.6 }}/>

      {/* 헤더 */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12 }}>
        <div>
          <div style={{ fontWeight:600, fontSize:13, marginBottom:3, color:'var(--text)' }}>{room.name}</div>
          <div style={{ fontFamily:'var(--font-mono)', fontSize:9, color:'var(--text3)', letterSpacing:'0.08em' }}>{room.room_id}</div>
        </div>
        <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:5 }}>
          <div style={{
            display:'flex', alignItems:'center', gap:5,
            padding:'3px 8px', borderRadius:2,
            background: s.bg, border:`1px solid ${s.color}40`,
          }}>
            <div style={{ width:4, height:4, borderRadius:'50%', background:s.color, boxShadow: isDanger ? s.glow : 'none' }}/>
            <span style={{ fontFamily:'var(--font-mono)', fontSize:9, fontWeight:600, color:s.color, letterSpacing:'0.06em' }}>{s.label}</span>
          </div>
          <div style={{ fontFamily:'var(--font-mono)', fontSize:9, color:'var(--text3)' }}>
            {room.hasOccupancy === null ? '재실미확인' : room.hasOccupancy ? `● 재실 ${room.occupantCount}명` : '○ 무재실'}
          </div>
        </div>
      </div>

      {/* 수치 그리드 */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:5, marginBottom:10 }}>
        <Metric label="CO₂"   value={m.co2}     unit="ppm"   warn={m.co2 > th.co2} />
        <Metric label="PM2.5" value={m.aerosol} unit="μg/m³" warn={m.aerosol > th.aerosol} />
        <Metric label="온도"  value={m.temp}    unit="°C"    warn={m.temp != null && th.temp && (m.temp<th.temp[0]||m.temp>th.temp[1])} />
        <Metric label="습도"  value={m.hum}     unit="%"     warn={m.hum != null && th.hum && (m.hum<th.hum[0]||m.hum>th.hum[1])} />
      </div>

      {/* AC 표시 */}
      {room.hasAC && (
        <div style={{ display:'flex', alignItems:'center', gap:4, marginBottom:8 }}>
          <div style={{ width:4, height:4, borderRadius:'50%', background:'var(--accent2)', boxShadow:'0 0 6px var(--accent2)' }}/>
          <span style={{ fontFamily:'var(--font-mono)', fontSize:8, color:'var(--accent2)', letterSpacing:'0.08em' }}>AC CONNECTED</span>
        </div>
      )}

      {/* 판단근거 */}
      {room.reason?.[0] && (
        <div style={{
          padding:'5px 8px', borderRadius:3,
          background:'rgba(0,0,0,0.3)',
          borderLeft:`2px solid ${s.color}`,
          fontFamily:'var(--font-mono)', fontSize:9, color:'var(--text2)', lineHeight:1.5,
          marginBottom: room.llm ? 6 : 0,
        }}>
          {room.reason[0]}
        </div>
      )}

      {/* LLM 한줄 */}
      {room.llm && (
        <div style={{
          padding:'5px 8px', borderRadius:3,
          background:'rgba(59,130,246,0.05)',
          border:'1px solid rgba(59,130,246,0.12)',
          fontFamily:'var(--font-mono)', fontSize:9, color:'var(--text2)', lineHeight:1.5,
          overflow:'hidden', display:'-webkit-box',
          WebkitLineClamp:2, WebkitBoxOrient:'vertical',
        }}>
          {room.llm.replace(/\*\*/g,'').split('\n').filter(l=>l.trim())[0] || ''}
        </div>
      )}
    </div>
  );
}
