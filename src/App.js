import React, { useState, useEffect, useCallback } from 'react';
import './index.css';
import Header from './components/Header';
import SummaryBar from './components/SummaryBar';
import FloorLayout from './components/FloorLayout';
import DetailPanel from './components/DetailPanel';
import { fetchRooms, createWebSocket } from './api';

export default function App() {
  const [rooms,        setRooms]        = useState([]);
  const [floor,        setFloor]        = useState(2);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [isLive,       setIsLive]       = useState(false);
  const [lastUpdated,  setLastUpdated]  = useState(null);

  const updateRooms = useCallback((data) => {
    setRooms(prev => data.map(r => {
      const ex = prev.find(x => x.room_id === r.room_id);
      return ex?.llm ? { ...r, llm: ex.llm } : r;
    }));
    setLastUpdated(new Date().toLocaleTimeString('ko-KR'));
    setSelectedRoom(prev => {
      if (!prev) return null;
      const matched = data.find(r => r.room_id === prev.room_id);
      return matched ? { ...matched, llm: prev.llm } : prev;
    });
  }, []);

  const setRoomLlm = useCallback((roomId, llm) => {
    setRooms(prev => prev.map(r => r.room_id === roomId ? { ...r, llm } : r));
    setSelectedRoom(prev => prev?.room_id === roomId ? { ...prev, llm } : prev);
  }, []);

  const loadRooms = useCallback(async () => {
    setLoading(true);
    try { const data = await fetchRooms(); updateRooms(data); }
    catch (e) { console.error('데이터 로드 실패:', e); }
    finally { setLoading(false); }
  }, [updateRooms]);

  useEffect(() => {
    loadRooms();
    const interval = setInterval(loadRooms, 300000);
    return () => clearInterval(interval);
  }, [loadRooms]);

  useEffect(() => {
    let ws;
    const connect = () => {
      try {
        ws = createWebSocket(
          (msg) => { if (msg.type==='update'&&msg.data) updateRooms(msg.data); },
          () => { setIsLive(false); setTimeout(connect, 5000); }
        );
        ws.onopen  = () => setIsLive(true);
        ws.onclose = () => { setIsLive(false); setTimeout(connect, 5000); };
      } catch {}
    };
    connect();
    return () => ws?.close();
  }, [updateRooms]);

  const floorRooms = rooms.filter(r => r.floor === floor);

  return (
    <div style={{ display:'flex', flexDirection:'column', minHeight:'100vh' }}>
      <Header lastUpdated={lastUpdated} isLive={isLive} loading={loading} />

      {/* 탭 */}
      <div style={{
        display:'flex', alignItems:'center',
        borderBottom:'1px solid var(--border)',
        background:'var(--bg)', padding:'0 24px',
      }}>
        {[2,3].map(f => (
          <button key={f} onClick={() => setFloor(f)} style={{
            padding:'10px 20px', fontSize:11, fontWeight:500,
            fontFamily:'var(--font-mono)',
            color: floor===f ? 'var(--accent)' : 'var(--text3)',
            borderBottom: floor===f ? '1px solid var(--accent)' : '1px solid transparent',
            background:'none', border:'none', cursor:'pointer',
            transition:'all 0.2s', letterSpacing:'0.06em',
          }}>
            창조관 {f}F
          </button>
        ))}
        <button onClick={loadRooms} disabled={loading} style={{
          marginLeft:'auto', padding:'5px 12px',
          background:'transparent', border:'1px solid var(--border)', borderRadius:3,
          cursor: loading?'not-allowed':'pointer',
          fontFamily:'var(--font-mono)', fontSize:9, color:'var(--text3)',
          letterSpacing:'0.08em', transition:'all 0.2s',
        }}>
          ↻ REFRESH
        </button>
      </div>

      {rooms.length > 0 && <SummaryBar rooms={rooms} />}

      {/* 메인 */}
      <div style={{ display:'flex', flex:1, overflow:'hidden' }}>
        <div style={{ flex:1, overflowY:'auto' }}>
          {loading && rooms.length === 0 ? (
            <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'60vh', flexDirection:'column', gap:14 }}>
              <div style={{ width:32, height:32, border:'2px solid var(--border2)', borderTopColor:'var(--accent)', borderRadius:'50%', animation:'spin 0.7s linear infinite' }}/>
              <div style={{ fontFamily:'var(--font-mono)', fontSize:10, color:'var(--text3)', letterSpacing:'0.1em' }}>
                LOADING...
              </div>
            </div>
          ) : (
            <FloorLayout floor={floor} rooms={floorRooms} selectedRoom={selectedRoom} onSelect={setSelectedRoom} />
          )}
        </div>

        {selectedRoom && (
          <DetailPanel room={selectedRoom} onClose={() => setSelectedRoom(null)} onExplain={setRoomLlm} />
        )}
      </div>
    </div>
  );
}
