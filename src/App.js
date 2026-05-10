import React, { useState, useEffect, useCallback } from 'react';
import './index.css';
import Header from './components/Header';
import SummaryBar from './components/SummaryBar';
import FloorLayout from './components/FloorLayout';
import DetailPanel from './components/DetailPanel';
import { fetchRooms, fetchRoomsWithLlm, createWebSocket } from './api';

export default function App() {
  const [rooms,        setRooms]        = useState([]);
  const [floor,        setFloor]        = useState(2);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [isLive,       setIsLive]       = useState(false);
  const [lastUpdated,  setLastUpdated]  = useState(null);

  const updateRooms = useCallback((data) => {
  setRooms(prevRooms => data.map(r => {
    const existing = prevRooms.find(x => x.room_id === r.room_id);
    return {
      ...r,
      llm: r.llm || existing?.llm || '',
    };
  }));
  setLastUpdated(new Date().toLocaleTimeString('ko-KR'));
  setSelectedRoom(prev => {
    if (!prev) return null;
    const matched = data.find(r => r.room_id === prev.room_id);
    if (!matched) return prev;
    return {
      ...matched,
      llm: matched.llm || prev.llm || '',
    };
  });
}, []);

  const setRoomLlm = useCallback((roomId, llm) => {
    setRooms(prev => prev.map(r => r.room_id === roomId ? { ...r, llm } : r));
    setSelectedRoom(prev => prev && prev.room_id === roomId ? { ...prev, llm } : prev);
  }, []);

 const loadRooms = useCallback(async () => {
  setLoading(true);
  try {
    // 1차: 빠른 센서 데이터 먼저 출력
    const fastData = await fetchRooms();
    updateRooms(fastData);
    // 2차: 전체 LLM 병렬 로딩
    fetchRoomsWithLlm()
      .then(llmData => {
        setRooms(llmData);
        setSelectedRoom(prev => {
          if (!prev) return null;
          return llmData.find(r => r.room_id === prev.room_id) || prev;
        });
      })
      .catch(console.error);
  } catch (e) {
    console.error('데이터 로드 실패:', e);
  } finally {
    setLoading(false);
  }
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
          (msg) => { if (msg.type === 'update' && msg.data) updateRooms(msg.data); },
          ()    => { setIsLive(false); setTimeout(connect, 5000); }
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

      {/* 층 탭 */}
      <div style={{ display:'flex', borderBottom:'1px solid var(--border)', background:'var(--bg)', padding:'0 32px' }}>
        {[2, 3].map(f => (
          <button key={f} onClick={() => setFloor(f)} style={{
            padding:'10px 24px', fontSize:12, fontWeight:500,
            fontFamily:'var(--font-display)',
            color: floor === f ? 'var(--accent)' : 'var(--text2)',
            borderBottom: floor === f ? '2px solid var(--accent)' : '2px solid transparent',
            background:'none', border:'none', cursor:'pointer',
            transition:'all 0.2s', letterSpacing:'0.04em',
          }}>
            창조관 {f}층
          </button>
        ))}
        <button onClick={loadRooms} disabled={loading} style={{
          marginLeft:'auto', padding:'6px 14px',
          background:'none', border:'1px solid var(--border)', borderRadius:6,
          cursor: loading ? 'not-allowed' : 'pointer',
          fontFamily:'var(--font-mono)', fontSize:11, color:'var(--text2)',
          alignSelf:'center',
        }}>
          ↻ 새로고침
        </button>
      </div>

      {rooms.length > 0 && <SummaryBar rooms={rooms} />}

      {/* 메인 */}
      <div style={{ display:'flex', flex:1, overflow:'hidden' }}>
        <div style={{ flex:1, overflowY:'auto' }}>
          {loading && rooms.length === 0 ? (
            <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'60vh', flexDirection:'column', gap:16 }}>
              <div style={{ width:40, height:40, border:'3px solid var(--border2)', borderTopColor:'var(--accent)', borderRadius:'50%', animation:'spin 0.8s linear infinite' }}/>
              <div style={{ fontFamily:'var(--font-mono)', fontSize:12, color:'var(--text2)' }}>데이터 불러오는 중...</div>
            </div>
          ) : (
            <FloorLayout
              floor={floor}
              rooms={floorRooms}
              selectedRoom={selectedRoom}
              onSelect={setSelectedRoom}
            />
          )}
        </div>

        {selectedRoom && (
          <DetailPanel room={selectedRoom} onClose={() => setSelectedRoom(null)} onExplain={setRoomLlm} />
        )}
      </div>
    </div>
  );
}
