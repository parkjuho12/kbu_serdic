import React, { useState, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer } from 'recharts';

const METRICS = [
  { key:'co2',     label:'CO₂',   unit:'ppm', color:'#3b82f6', threshold:1000 },
  { key:'temp',    label:'온도',   unit:'°C',  color:'#ff4060', threshold:null },
  { key:'hum',     label:'습도',   unit:'%',   color:'#22d3ee', threshold:null },
  { key:'aerosol', label:'PM2.5', unit:'μg',  color:'#00e5a0', threshold:35 },
];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:'var(--bg3)', border:'1px solid var(--border2)', borderRadius:4, padding:'8px 12px', fontFamily:'var(--font-mono)', fontSize:10 }}>
      <div style={{ color:'var(--text3)', marginBottom:4 }}>{label}</div>
      {payload.map((p,i) => <div key={i} style={{ color:p.color }}>{p.name}: {p.value}</div>)}
    </div>
  );
};

export default function TrendChart({ room }) {
  const [activeMetric, setActiveMetric] = useState('co2');
  const metric  = METRICS.find(m => m.key === activeMetric);
  const current = room?.hasMeasurement;
  const pred    = room?.prediction;

  const data = useMemo(() => {
    if (!current) return [];
    const val  = current[activeMetric];
    if (val === null || val === undefined) return [];
    const rate = pred?.change_rate || 0;
    return Array.from({ length:6 }, (_,i) => ({
      time:`${-5+i}h`,
      value: Math.max(0, Math.round(val + rate*(i-5))),
    }));
  }, [current, activeMetric, pred]);

  if (!room) return null;

  return (
    <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:6, padding:'14px 16px' }}>
      <div style={{ fontFamily:'var(--font-mono)', fontSize:9, color:'var(--text3)', letterSpacing:'0.1em', marginBottom:12 }}>TREND</div>

      <div style={{ display:'flex', gap:4, marginBottom:14 }}>
        {METRICS.map(m => (
          <button key={m.key} onClick={() => setActiveMetric(m.key)} style={{
            padding:'3px 10px', borderRadius:2, fontSize:9, fontFamily:'var(--font-mono)', cursor:'pointer',
            background: activeMetric===m.key ? `${m.color}18` : 'transparent',
            border:`1px solid ${activeMetric===m.key ? m.color : 'var(--border)'}`,
            color: activeMetric===m.key ? m.color : 'var(--text3)',
            transition:'all 0.2s', letterSpacing:'0.04em',
          }}>
            {m.label}
          </button>
        ))}
      </div>

      <div style={{ display:'flex', alignItems:'baseline', gap:6, marginBottom:14 }}>
        <span style={{ fontFamily:'var(--font-mono)', fontSize:28, fontWeight:600, color:metric?.color, lineHeight:1 }}>
          {current?.[activeMetric] ?? '—'}
        </span>
        <span style={{ fontFamily:'var(--font-mono)', fontSize:10, color:'var(--text3)' }}>{metric?.unit}</span>
        {pred && pred.trend !== 'unknown' && (
          <span style={{ fontFamily:'var(--font-mono)', fontSize:9, color:'var(--text3)', marginLeft:8 }}>
            {pred.trend==='increasing'?'↑ 증가':pred.trend==='decreasing'?'↓ 감소':'→ 안정'}
          </span>
        )}
      </div>

      {data.length > 0 ? (
        <ResponsiveContainer width="100%" height={140}>
          <LineChart data={data} margin={{ top:5, right:8, left:-24, bottom:0 }}>
            <CartesianGrid strokeDasharray="2 4" stroke="var(--border)" />
            <XAxis dataKey="time" tick={{ fontFamily:'var(--font-mono)', fontSize:8, fill:'var(--text3)' }} />
            <YAxis tick={{ fontFamily:'var(--font-mono)', fontSize:8, fill:'var(--text3)' }} />
            <Tooltip content={<CustomTooltip />} />
            {metric?.threshold && <ReferenceLine y={metric.threshold} stroke="var(--danger)" strokeDasharray="3 3" strokeOpacity={0.5} />}
            <Line type="monotone" dataKey="value" name={metric?.label} stroke={metric?.color} strokeWidth={1.5} dot={{ fill:metric?.color, r:2 }} activeDot={{ r:4 }} />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <div style={{ height:140, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'var(--font-mono)', fontSize:9, color:'var(--text3)' }}>
          NO DATA
        </div>
      )}

      {pred?.minutes_to_danger && (
        <div style={{ marginTop:10, padding:'6px 10px', background:'var(--danger-bg)', border:'1px solid rgba(255,64,96,0.25)', borderRadius:3, fontFamily:'var(--font-mono)', fontSize:9, color:'var(--danger)' }}>
          ⚠ 약 {pred.minutes_to_danger}분 후 기준치 초과 예상
        </div>
      )}
    </div>
  );
}
