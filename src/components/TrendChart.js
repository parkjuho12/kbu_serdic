import React, { useState, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer } from 'recharts';

const METRICS = [
  { key:'co2', label:'CO₂', unit:'ppm', className:'chart-blue', color:'#38bdf8', threshold:1000 },
  { key:'temp', label:'온도', unit:'°C', className:'chart-red', color:'#ef4444', threshold:null },
  { key:'hum', label:'습도', unit:'%', className:'chart-cyan', color:'#22d3ee', threshold:null },
  { key:'aerosol', label:'PM2.5', unit:'μg', className:'chart-green', color:'#10b981', threshold:35 },
];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <div>{label}</div>
      {payload.map((p, i) => <strong key={i}>{p.name}: {p.value}</strong>)}
    </div>
  );
};

export default function TrendChart({ room }) {
  const [activeMetric, setActiveMetric] = useState('co2');
  const metric = METRICS.find(m => m.key === activeMetric);
  const current = room?.hasMeasurement;
  const pred = room?.prediction;

  const data = useMemo(() => {
    if (!current) return [];
    const val = current[activeMetric];
    if (val === null || val === undefined) return [];
    const rate = pred?.change_rate || 0;
    return Array.from({ length: 7 }, (_, i) => ({
      time: i === 6 ? 'NOW' : `${-30 + i * 5}m`,
      value: Math.max(0, Math.round(val + rate * (i - 6))),
    }));
  }, [current, activeMetric, pred]);

  if (!room) return null;

  return (
    <div className="trend-panel">
      <div className="section-title">실시간 추세</div>

      <div className="metric-tabs">
        {METRICS.map(m => (
          <button key={m.key} onClick={() => setActiveMetric(m.key)} className={activeMetric === m.key ? 'active' : ''}>
            {m.label}
          </button>
        ))}
      </div>

      <div className="current-metric">
        <strong style={{ color: metric?.color }}>{current?.[activeMetric] ?? '—'}</strong>
        <span>{metric?.unit}</span>
        {pred && pred.trend !== 'unknown' && (
          <em>{pred.trend === 'increasing' ? '증가 추세' : pred.trend === 'decreasing' ? '감소 추세' : '안정'}</em>
        )}
      </div>

      {data.length > 0 ? (
        <ResponsiveContainer width="100%" height={170}>
          <LineChart data={data} margin={{ top: 8, right: 12, left: -22, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 6" stroke="rgba(148,163,184,0.14)" />
            <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#64748b' }} />
            <YAxis tick={{ fontSize: 10, fill: '#64748b' }} />
            <Tooltip content={<CustomTooltip />} />
            {metric?.threshold && <ReferenceLine y={metric.threshold} stroke="#ef4444" strokeDasharray="4 4" strokeOpacity={0.7} />}
            <Line type="monotone" dataKey="value" name={metric?.label} stroke={metric?.color} strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} />
          </LineChart>
        </ResponsiveContainer>
      ) : <div className="no-data">NO DATA</div>}

      {pred?.minutes_to_danger && (
        <div className="predict-warning">약 {pred.minutes_to_danger}분 후 기준치 초과 예상</div>
      )}
    </div>
  );
}
