import React, { useState, useEffect } from 'react';
import TrendChart from './TrendChart';
import { controlAC, explainRoom } from '../api';

const STATUS = {
  comfortable: { label:'쾌적',   color:'var(--safe)' },
  normal:      { label:'보통',   color:'var(--warn)' },
  danger:      { label:'위험',   color:'var(--danger)' },
  abnormal:    { label:'비정상', color:'var(--abnormal)' },
};

function SensorRow({ label, value, unit, warn }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 0', borderBottom:'1px solid var(--border)' }}>
      <span style={{ fontFamily:'var(--font-mono)', fontSize:10, color:'var(--text2)', letterSpacing:'0.04em' }}>{label}</span>
      <span style={{ fontFamily:'var(--font-mono)', fontSize:13, fontWeight:600, color: warn ? 'var(--danger)' : 'var(--text)' }}>
        {value !== null && value !== undefined ? `${value} ` : '—'}
        {value !== null && value !== undefined && <span style={{ fontSize:9, color:'var(--text3)', fontWeight:400 }}>{unit}</span>}
      </span>
    </div>
  );
}

function Section({ label, children }) {
  return (
    <div>
      <div style={{ fontFamily:'var(--font-mono)', fontSize:8, color:'var(--text3)', letterSpacing:'0.12em', marginBottom:10, paddingBottom:4, borderBottom:'1px solid var(--border)' }}>
        {label}
      </div>
      {children}
    </div>
  );
}

export default function DetailPanel({ room, onClose, onExplain }) {
  const [acLoading,  setAcLoading]  = useState(false);
  const [acMsg,      setAcMsg]      = useState('');
  const [llm,        setLlm]        = useState('');
  const [llmLoading, setLlmLoading] = useState(false);

  useEffect(() => {
    if (!room) return;
    setLlm('');
    if (room.llm) { setLlm(room.llm); return; }
    setLlmLoading(true);
    explainRoom(room.room_id)
      .then(data => {
        const text = data.llm || '';
        setLlm(text);
        if (onExplain) onExplain(room.room_id, text);
      })
      .catch(() => setLlm('LLM 해석 실패'))
      .finally(() => setLlmLoading(false));
  }, [room, onExplain]);

  if (!room) return null;

  const m  = room.hasMeasurement || {};
  const s  = STATUS[room.hasState] || STATUS.abnormal;
  const th = room.type === 'hall'
    ? { co2:1000, aerosol:50 }
    : { co2:1000, aerosol:35, temp:[18,28], hum:[30,80] };

  const handleAC = async (action) => {
    setAcLoading(true); setAcMsg('');
    try {
      await controlAC(room.room_id, action);
      setAcMsg(`AC ${action === 'on' ? 'ON' : 'OFF'} 완료`);
    } catch { setAcMsg('제어 실패'); }
    finally { setAcLoading(false); setTimeout(()=>setAcMsg(''),3000); }
  };

  return (
    <div style={{
      width:340, flexShrink:0,
      borderLeft:'1px solid var(--border)',
      background:'var(--bg2)',
      overflowY:'auto', animation:'slideIn 0.2s ease',
    }}>
      {/* 헤더 */}
      <div style={{
        padding:'14px 18px', borderBottom:'1px solid var(--border)',
        display:'flex', justifyContent:'space-between', alignItems:'flex-start',
        position:'sticky', top:0, background:'var(--bg2)', zIndex:10,
        backdropFilter:'blur(8px)',
      }}>
        <div>
          <div style={{ fontWeight:600, fontSize:13, marginBottom:4, color:'var(--text)' }}>{room.name}</div>
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            <div style={{ width:4, height:4, borderRadius:'50%', background:s.color, boxShadow:`0 0 6px ${s.color}` }}/>
            <span style={{ fontFamily:'var(--font-mono)', fontSize:9, color:s.color, fontWeight:600, letterSpacing:'0.06em' }}>{s.label}</span>
            <span style={{ color:'var(--border2)' }}>·</span>
            <span style={{ fontFamily:'var(--font-mono)', fontSize:9, color:'var(--text3)' }}>
              {room.hasOccupancy===null?'재실미확인':room.hasOccupancy?`재실 ${room.occupantCount}명`:'무재실'}
            </span>
          </div>
        </div>
        <button onClick={onClose} style={{ background:'none', border:'1px solid var(--border)', borderRadius:3, cursor:'pointer', color:'var(--text3)', fontSize:12, padding:'4px 8px', fontFamily:'var(--font-mono)' }}>
          ESC
        </button>
      </div>

      <div style={{ padding:'16px 18px', display:'flex', flexDirection:'column', gap:16 }}>

        <Section label="SENSOR DATA">
          <SensorRow label="CO₂"        value={m.co2}       unit="ppm"   warn={m.co2>th.co2} />
          <SensorRow label="PM2.5"      value={m.aerosol}   unit="μg/m³" warn={m.aerosol>th.aerosol} />
          <SensorRow label="온도"       value={m.temp}      unit="°C"    warn={m.temp!=null&&th.temp&&(m.temp<th.temp[0]||m.temp>th.temp[1])} />
          <SensorRow label="습도"       value={m.hum}       unit="%"     warn={m.hum!=null&&th.hum&&(m.hum<th.hum[0]||m.hum>th.hum[1])} />
          <SensorRow label="열화상 MAX"  value={m.stats_max} unit="°C"   warn={m.stats_max>=50} />
          <SensorRow label="열화상 AVG"  value={m.stats_avg} unit="°C"   warn={false} />
        </Section>

        <TrendChart room={room} />

        <Section label="JUDGMENT">
          {room.reason?.map((r,i) => (
            <div key={i} style={{
              padding:'6px 8px', marginBottom:4, borderRadius:3,
              background:'rgba(0,0,0,0.3)',
              borderLeft:`2px solid ${s.color}`,
              fontFamily:'var(--font-mono)', fontSize:9, color:'var(--text2)', lineHeight:1.5,
            }}>{r}</div>
          ))}
        </Section>

        <Section label="LLM INTERPRETATION">
          {llmLoading ? (
            <div style={{ padding:'10px 12px', background:'rgba(0,0,0,0.3)', borderRadius:4, border:'1px solid var(--border)', display:'flex', alignItems:'center', gap:8 }}>
              <div style={{ width:10, height:10, border:'1.5px solid var(--border2)', borderTopColor:'var(--accent)', borderRadius:'50%', animation:'spin 0.7s linear infinite', flexShrink:0 }}/>
              <span style={{ fontFamily:'var(--font-mono)', fontSize:9, color:'var(--text3)' }}>ANALYZING...</span>
            </div>
          ) : (
            <div style={{ padding:'10px 12px', background:'rgba(0,0,0,0.3)', borderRadius:4, border:'1px solid var(--border)', fontSize:11, lineHeight:1.8, color:'var(--text2)', whiteSpace:'pre-wrap' }}>
              {llm || '—'}
            </div>
          )}
        </Section>

        {room.hasAC && (
          <Section label="AC CONTROL">
            <div style={{ display:'flex', gap:6 }}>
              <button onClick={()=>handleAC('on')} disabled={acLoading} style={{
                flex:1, padding:'9px 0', borderRadius:3, cursor:'pointer',
                background:'rgba(59,130,246,0.1)', border:'1px solid var(--accent)',
                color:'var(--accent)', fontFamily:'var(--font-mono)', fontSize:10, letterSpacing:'0.06em',
                transition:'all 0.2s',
              }}>❄ POWER ON</button>
              <button onClick={()=>handleAC('off')} disabled={acLoading} style={{
                flex:1, padding:'9px 0', borderRadius:3, cursor:'pointer',
                background:'rgba(0,0,0,0.3)', border:'1px solid var(--border)',
                color:'var(--text3)', fontFamily:'var(--font-mono)', fontSize:10, letterSpacing:'0.06em',
                transition:'all 0.2s',
              }}>○ POWER OFF</button>
            </div>
            {acMsg && <div style={{ marginTop:6, fontFamily:'var(--font-mono)', fontSize:9, color:'var(--safe)', textAlign:'center', letterSpacing:'0.06em' }}>{acMsg}</div>}
          </Section>
        )}

        <Section label="SENSORS">
          {['EDC','IRC','RDC'].map(type =>
            room.hasSensor?.[type]?.length > 0 && (
              <div key={type} style={{ marginBottom:5 }}>
                <span style={{ fontFamily:'var(--font-mono)', fontSize:8, color:'var(--text3)', marginRight:8, letterSpacing:'0.08em' }}>{type}</span>
                {room.hasSensor[type].map(d => (
                  <span key={d} style={{ fontFamily:'var(--font-mono)', fontSize:8, color:'var(--text2)', marginRight:6, background:'var(--bg3)', padding:'1px 5px', borderRadius:2, border:'1px solid var(--border)' }}>{d}</span>
                ))}
              </div>
            )
          )}
        </Section>
      </div>
    </div>
  );
}
