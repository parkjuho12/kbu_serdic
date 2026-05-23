import React, { useState, useEffect } from 'react';
import TrendChart from './TrendChart';
import { controlAC } from '../api';

const STATUS = {
  comfortable: { label:'쾌적',   color:'var(--safe)' },
  normal:      { label:'보통',   color:'var(--warn)' },
  danger:      { label:'위험',   color:'var(--danger)' },
  abnormal:    { label:'비정상', color:'var(--abnormal)' },
};

export default function DetailPanel({ room, onClose }) {
  const [acLoading, setAcLoading] = useState(false);
  const [acMsg, setAcMsg] = useState('');
  const [llm, setLlm] = useState('');
  const [llmLoading, setLlmLoading] = useState(true);
  const [speaking, setSpeaking] = useState(false);

  const hasSpeech = typeof window !== 'undefined' && !!window.speechSynthesis;

  const speakLlm = (text) => {
    if (!hasSpeech) {
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ko-KR';
    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utterance);
  };

  useEffect(() => {
    if (!room) return;

    if (room.llm) {
      setLlm(room.llm);
      setLlmLoading(false);
    } else {
      setLlm('');
      setLlmLoading(true);
    }
  }, [room]);

  if (!room) return null;

  const s = STATUS[room.hasState] || STATUS.abnormal;

  const handleAC = async (action) => {
    setAcLoading(true);
    setAcMsg('');

    try {
      await controlAC(room.room_id, action);
      setAcMsg(`에어컨 ${action === 'on' ? 'ON' : 'OFF'} 완료`);
    } catch {
      setAcMsg('제어 실패');
    } finally {
      setAcLoading(false);
      setTimeout(() => setAcMsg(''), 3000);
    }
  };

  return (
    <div style={{ width:420, flexShrink:0, borderLeft:'1px solid var(--border)', background:'var(--bg)', overflowY:'auto', animation:'slideIn 0.25s ease' }}>
      <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'flex-start', position:'sticky', top:0, background:'var(--bg)', zIndex:10 }}>
        <div>
          <div style={{ fontWeight:600, fontSize:14, marginBottom:3 }}>{room.name}</div>
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            <div style={{ width:6, height:6, borderRadius:'50%', background:s.color }}/>
            <span style={{ fontFamily:'var(--font-mono)', fontSize:11, color:s.color }}>{s.label}</span>
            <span style={{ fontFamily:'var(--font-mono)', fontSize:11, color:'var(--text3)' }}>|</span>
            <span style={{ fontFamily:'var(--font-mono)', fontSize:11, color:'var(--text2)' }}>
              {room.hasOccupancy === null ? '재실미확인' : room.hasOccupancy ? `재실 ${room.occupantCount}명` : '무재실'}
            </span>
          </div>
        </div>
        <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text2)', fontSize:18, padding:4 }}>✕</button>
      </div>

      <div style={{ padding:'16px 20px', display:'flex', flexDirection:'column', gap:20 }}>
        <div>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
            <div style={{ fontFamily:'var(--font-mono)', fontSize:10, color:'var(--text3)', letterSpacing:'0.08em' }}>
              LLM INTERPRETATION
            </div>
            <button
              type="button"
              onClick={() => {
                if (speaking) {
                  window.speechSynthesis.cancel();
                  setSpeaking(false);
                } else if (llm) {
                  speakLlm(llm);
                }
              }}
              disabled={llmLoading || !llm || !window.speechSynthesis}
              style={{
                fontFamily:'var(--font-mono)', fontSize:11, color:'var(--accent)',
                background:'none', border:'1px solid var(--accent)', borderRadius:8,
                padding:'6px 10px', cursor: llmLoading || !llm || !window.speechSynthesis ? 'not-allowed' : 'pointer'
              }}
            >
              {speaking ? '음성 중지' : '음성 듣기'}
            </button>
          </div>

          {llmLoading ? (
            <div style={{ padding:'12px 14px', background:'var(--bg2)', borderRadius:8, border:'1px solid var(--border)', display:'flex', alignItems:'center', gap:8 }}>
              <div style={{ width:14, height:14, border:'2px solid var(--border2)', borderTopColor:'var(--accent)', borderRadius:'50%', animation:'spin 0.8s linear infinite', flexShrink:0 }}/>
              <span style={{ fontFamily:'var(--font-mono)', fontSize:11, color:'var(--text2)' }}>
                LLM 분석 로딩 중...
              </span>
            </div>
          ) : (
            <div style={{ padding:'12px 14px', background:'var(--bg2)', borderRadius:8, border:'1px solid var(--border)', fontSize:12, lineHeight:1.7, color:'var(--text2)', whiteSpace:'pre-wrap' }}>
              {llm || 'LLM 결과 없음'}
            </div>
          )}
        </div>

        <TrendChart room={room} />

        {room.hasAC && (
          <div>
            <div style={{ fontFamily:'var(--font-mono)', fontSize:10, color:'var(--text3)', letterSpacing:'0.08em', marginBottom:10 }}>
              AC CONTROL
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={() => handleAC('on')} disabled={acLoading} style={{ flex:1, padding:'10px 0', borderRadius:8, cursor:'pointer', background:'rgba(137,180,250,0.1)', border:'1px solid var(--accent)', color:'var(--accent)', fontFamily:'var(--font-mono)', fontSize:12 }}>❄ ON</button>
              <button onClick={() => handleAC('off')} disabled={acLoading} style={{ flex:1, padding:'10px 0', borderRadius:8, cursor:'pointer', background:'rgba(88,91,112,0.2)', border:'1px solid var(--border2)', color:'var(--text2)', fontFamily:'var(--font-mono)', fontSize:12 }}>○ OFF</button>
            </div>
            {acMsg && <div style={{ marginTop:8, fontFamily:'var(--font-mono)', fontSize:11, color:'var(--safe)', textAlign:'center' }}>{acMsg}</div>}
          </div>
        )}

        <div>
          <div style={{ fontFamily:'var(--font-mono)', fontSize:10, color:'var(--text3)', letterSpacing:'0.08em', marginBottom:10 }}>
            SENSORS
          </div>
          {['EDC', 'IRC', 'RDC'].map(type =>
            room.hasSensor?.[type]?.length > 0 && (
              <div key={type} style={{ marginBottom:6 }}>
                <span style={{ fontFamily:'var(--font-mono)', fontSize:10, color:'var(--text3)', marginRight:6 }}>{type}</span>
                {room.hasSensor[type].map(d => (
                  <span key={d} style={{ fontFamily:'var(--font-mono)', fontSize:10, color:'var(--text2)', marginRight:6 }}>{d}</span>
                ))}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}