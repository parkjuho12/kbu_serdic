import React from 'react';

const ITEMS = [
  { key:'total',       label:'전체 공간', color:'var(--accent)',   border:'rgba(59,130,246,0.3)' },
  { key:'comfortable', label:'쾌적',     color:'var(--safe)',     border:'rgba(0,229,160,0.3)' },
  { key:'normal',      label:'보통',     color:'var(--warn)',     border:'rgba(251,191,36,0.3)' },
  { key:'danger',      label:'위험',     color:'var(--danger)',   border:'rgba(255,64,96,0.3)' },
  { key:'abnormal',    label:'비정상',   color:'var(--abnormal)', border:'rgba(61,80,104,0.3)' },
];

export default function SummaryBar({ rooms }) {
  const counts = rooms.reduce((acc,r) => { acc[r.hasState]=(acc[r.hasState]||0)+1; return acc; }, {});
  const values = { total:rooms.length, comfortable:counts.comfortable||0, normal:counts.normal||0, danger:counts.danger||0, abnormal:counts.abnormal||0 };

  return (
    <div style={{ display:'flex', borderBottom:'1px solid var(--border)', background:'var(--bg)' }}>
      {ITEMS.map((item,i) => (
        <div key={item.key} style={{
          flex:1, display:'flex', alignItems:'center', gap:10,
          padding:'10px 20px',
          borderRight: i < ITEMS.length-1 ? '1px solid var(--border)' : 'none',
          background: values[item.key] > 0 && item.key === 'danger' ? 'rgba(255,64,96,0.04)' : 'transparent',
        }}>
          <span style={{
            fontFamily:'var(--font-mono)', fontSize:28, fontWeight:600, lineHeight:1,
            color: item.color,
            textShadow: values[item.key] > 0 && item.key !== 'total' ? `0 0 24px ${item.color}` : 'none',
          }}>
            {String(values[item.key]).padStart(2,'0')}
          </span>
          <span style={{ fontFamily:'var(--font-mono)', fontSize:9, color:'var(--text3)', letterSpacing:'0.08em', lineHeight:1.5 }}>
            {item.label}
          </span>
        </div>
      ))}
    </div>
  );
}
