import React from 'react';

const ITEMS = [
  { key: 'total',       label: '전체',   color: 'var(--accent)' },
  { key: 'comfortable', label: '쾌적',   color: 'var(--safe)' },
  { key: 'normal',      label: '보통',   color: 'var(--warn)' },
  { key: 'danger',      label: '위험',   color: 'var(--danger)' },
  { key: 'abnormal',    label: '비정상', color: 'var(--abnormal)' },
];

export default function SummaryBar({ rooms }) {
  const counts = rooms.reduce((acc, r) => {
    acc[r.hasState] = (acc[r.hasState] || 0) + 1;
    return acc;
  }, {});

  const values = {
    total:       rooms.length,
    comfortable: counts.comfortable || 0,
    normal:      counts.normal || 0,
    danger:      counts.danger || 0,
    abnormal:    counts.abnormal || 0,
  };

  return (
    <div style={{
      display: 'flex', gap: 8, padding: '12px 32px',
      borderBottom: '1px solid var(--border)',
      background: 'var(--bg)',
    }}>
      {ITEMS.map(item => (
        <div key={item.key} style={{
          flex: 1, display: 'flex', alignItems: 'center', gap: 12,
          padding: '10px 16px',
          background: 'var(--bg2)',
          border: '1px solid var(--border)',
          borderRadius: 8,
        }}>
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 26, fontWeight: 500,
            color: item.color, lineHeight: 1,
          }}>
            {values[item.key]}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text2)', fontWeight: 500, letterSpacing: '0.04em' }}>
            {item.label}
          </div>
        </div>
      ))}
    </div>
  );
}
