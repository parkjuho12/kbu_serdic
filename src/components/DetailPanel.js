import React, { useState, useEffect } from 'react';
import TrendChart from './TrendChart';
import { controlAC, explainRoom } from '../api';

const STATUS = {
  comfortable: { label:'쾌적', className:'safe' },
  normal: { label:'보통', className:'warn' },
  danger: { label:'위험', className:'danger' },
  abnormal: { label:'비정상', className:'abnormal' },
};

function SensorStat({ label, value, unit, warn }) {
  return (
    <div className={`sensor-stat ${warn ? 'warn-value' : ''}`}>
      <span>{label}</span>
      <strong>{value ?? '—'}{value != null && <small>{unit}</small>}</strong>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section className="detail-section">
      <div className="section-title">{title}</div>
      {children}
    </section>
  );
}

function parseSummary(text) {
  if (!text) return [];
  return text.replace(/\*\*/g, '').split('\n').map(v => v.trim()).filter(Boolean).slice(0, 4);
}

export default function DetailPanel({ room, onClose, onExplain }) {
  const [acLoading, setAcLoading] = useState(false);
  const [acMsg, setAcMsg] = useState('');
  const [llm, setLlm] = useState('');
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

  const m = room.hasMeasurement || {};
  const s = STATUS[room.hasState] || STATUS.abnormal;
  const th = room.type === 'hall'
    ? { co2:1000, aerosol:50 }
    : { co2:1000, aerosol:35, temp:[18,28], hum:[30,80] };

  const handleAC = async (action) => {
    setAcLoading(true);
    setAcMsg('');
    try {
      await controlAC(room.room_id, action);
      setAcMsg(`AC ${action === 'on' ? 'ON' : 'OFF'} 완료`);
    } catch {
      setAcMsg('제어 실패');
    } finally {
      setAcLoading(false);
      setTimeout(() => setAcMsg(''), 3000);
    }
  };

  const summary = parseSummary(llm);

  return (
    <div className="detail-panel glass-panel">
      <div className={`detail-hero ${s.className}`}>
        <button className="close-button" onClick={onClose}>닫기</button>
        <p className="eyebrow">ROOM DETAIL</p>
        <h2>{room.name}</h2>
        <div className="detail-meta">
          <span className={`severity-dot ${room.hasState}`} />
          <strong>{s.label}</strong>
          <em>{room.room_id}</em>
          <em>{room.hasOccupancy === null ? '재실 미확인' : room.hasOccupancy ? `${room.occupantCount}명 재실` : '무재실'}</em>
        </div>
      </div>

      <div className="detail-content">
        <Section title="센서 핵심 지표">
          <div className="sensor-stat-grid">
            <SensorStat label="CO₂" value={m.co2} unit="ppm" warn={m.co2 > th.co2} />
            <SensorStat label="PM2.5" value={m.aerosol} unit="μg/m³" warn={m.aerosol > th.aerosol} />
            <SensorStat label="온도" value={m.temp} unit="°C" warn={m.temp != null && th.temp && (m.temp < th.temp[0] || m.temp > th.temp[1])} />
            <SensorStat label="습도" value={m.hum} unit="%" warn={m.hum != null && th.hum && (m.hum < th.hum[0] || m.hum > th.hum[1])} />
            <SensorStat label="열화상 MAX" value={m.stats_max} unit="°C" warn={m.stats_max >= 50} />
            <SensorStat label="열화상 AVG" value={m.stats_avg} unit="°C" />
          </div>
        </Section>

        <TrendChart room={room} />

        <Section title="AI 분석 요약">
          {llmLoading ? (
            <div className="ai-box loading-ai"><span className="mini-spinner" />AI가 공간 상태를 분석 중입니다.</div>
          ) : (
            <div className="ai-summary-list">
              {(summary.length ? summary : ['분석 결과가 없습니다.']).map((line, i) => (
                <div key={i} className="ai-summary-item">{line}</div>
              ))}
            </div>
          )}
        </Section>

        {room.reason?.length > 0 && (
          <Section title="판단 근거">
            <div className="reason-list">
              {room.reason.map((r, i) => <div key={i}>{r}</div>)}
            </div>
          </Section>
        )}

        {room.hasAC && (
          <Section title="공조 제어">
            <div className="ac-control-row">
              <button onClick={() => handleAC('on')} disabled={acLoading}>냉방 ON</button>
              <button onClick={() => handleAC('off')} disabled={acLoading}>전원 OFF</button>
            </div>
            {acMsg && <div className="control-message">{acMsg}</div>}
          </Section>
        )}
      </div>
    </div>
  );
}
