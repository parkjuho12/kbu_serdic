import React from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ResponsiveContainer,
} from 'recharts';

const METRICS = [
  { key: 'co2',     label: 'CO₂',   unit: 'ppm', color: '#89b4fa', threshold: 1000 },
  { key: 'temp',    label: '온도',   unit: '°C',  color: '#f38ba8', threshold: null },
  { key: 'hum',     label: '습도',   unit: '%',   color: '#74c7ec', threshold: null },
  { key: 'aerosol', label: 'PM2.5', unit: 'μg',  color: '#a6e3a1', threshold: 35 },
];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--bg3)', border: '1px solid var(--border2)',
      borderRadius: 8, padding: '10px 14px',
      fontFamily: 'var(--font-mono)', fontSize: 11,
    }}>
      <div style={{ color: 'var(--text2)', marginBottom: 6 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color, marginBottom: 2 }}>
          {p.name}: {p.value}
        </div>
      ))}
    </div>
  );
};

export default function TrendChart({ room }) {
  const [activeMetric, setActiveMetric] = React.useState('co2');

  // 모의 트렌드 데이터 (실제로는 agg API에서)
  const pred    = room?.prediction;
  const current = room?.hasMeasurement;
  const metric  = METRICS.find(m => m.key === activeMetric);

  // 현재값 기반 간단한 트렌드 시각화
  const data = React.useMemo(() => {
    if (!current) return [];
    const val = current[activeMetric];
    if (val === null || val === undefined) return [];
    const rate = pred?.change_rate || 0;
    return Array.from({ length: 6 }, (_, i) => ({
      time: `${-5 + i}h`,
      value: Math.max(0, Math.round(val + rate * (i - 5))),
    }));
  }, [current, activeMetric, pred]);

  if (!room) return null;

  return (
    <div style={{
      background: 'var(--bg2)', border: '1px solid var(--border)',
      borderRadius: 12, padding: '18px 20px',
      animation: 'slideIn 0.3s ease',
    }}>
      <div style={{ fontSize: 11, color: 'var(--text2)', fontFamily: 'var(--font-mono)', marginBottom: 14, letterSpacing: '0.06em' }}>
        트렌드 차트 — {room.name}
      </div>

      {/* 메트릭 선택 */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {METRICS.map(m => (
          <button
            key={m.key}
            onClick={() => setActiveMetric(m.key)}
            style={{
              padding: '4px 12px', borderRadius: 20, fontSize: 11,
              fontFamily: 'var(--font-mono)', cursor: 'pointer',
              background: activeMetric === m.key ? `${m.color}20` : 'var(--bg)',
              border: `1px solid ${activeMetric === m.key ? m.color : 'var(--border)'}`,
              color: activeMetric === m.key ? m.color : 'var(--text2)',
              transition: 'all 0.2s',
            }}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* 차트 */}
      {data.length > 0 ? (
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="time" tick={{ fontFamily: 'var(--font-mono)', fontSize: 10, fill: 'var(--text3)' }} />
            <YAxis tick={{ fontFamily: 'var(--font-mono)', fontSize: 10, fill: 'var(--text3)' }} />
            <Tooltip content={<CustomTooltip />} />
            {metric?.threshold && (
              <ReferenceLine y={metric.threshold} stroke="var(--danger)" strokeDasharray="4 4" strokeOpacity={0.6} />
            )}
            <Line
              type="monotone" dataKey="value" name={metric?.label}
              stroke={metric?.color} strokeWidth={2}
              dot={{ fill: metric?.color, r: 3 }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <div style={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text3)' }}>
          데이터 없음
        </div>
      )}

      {/* 예측 */}
      {pred?.minutes_to_danger && (
        <div style={{
          marginTop: 12, padding: '8px 12px',
          background: 'var(--danger-bg)', border: '1px solid rgba(243,139,168,0.3)',
          borderRadius: 6, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--danger)',
        }}>
          ⚠ 약 {pred.minutes_to_danger}분 후 기준치 초과 예상
        </div>
      )}
    </div>
  );
}
