import React, { useState, useEffect, useCallback, useMemo } from 'react';
import './index.css';
import Header from './components/Header';
import SummaryBar from './components/SummaryBar';
import FloorLayout from './components/FloorLayout';
import DetailPanel from './components/DetailPanel';
import { fetchRooms, createWebSocket } from './api';

export default function App() {
  const [rooms, setRooms] = useState([]);
  const [floor, setFloor] = useState(2);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isLive, setIsLive] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

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
    try {
      const data = await fetchRooms();
      updateRooms(data);
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
    let timer;
    const connect = () => {
      try {
        ws = createWebSocket(
          (msg) => { if (msg.type === 'update' && msg.data) updateRooms(msg.data); },
          () => { setIsLive(false); timer = setTimeout(connect, 5000); }
        );
        ws.onopen = () => setIsLive(true);
        ws.onclose = () => { setIsLive(false); timer = setTimeout(connect, 5000); };
      } catch {
        setIsLive(false);
        timer = setTimeout(connect, 5000);
      }
    };
    connect();
    return () => { clearTimeout(timer); ws?.close(); };
  }, [updateRooms]);

  const floorRooms = useMemo(() => rooms.filter(r => r.floor === floor), [rooms, floor]);
  const dangerRooms = useMemo(() => rooms.filter(r => ['danger', 'abnormal'].includes(r.hasState)), [rooms]);

  return (
    <div className="app-shell">
      <Header lastUpdated={lastUpdated} isLive={isLive} loading={loading} />

      <main className="control-grid">
        <aside className="left-rail">
          <SummaryBar
            rooms={rooms}
            floor={floor}
            selectedRoom={selectedRoom}
            onSelectRoom={setSelectedRoom}
          />
        </aside>

        <section className="mission-area">
          <div className="floor-toolbar glass-panel">
            <div>
              <p className="eyebrow">BUILDING CONTROL</p>
              <h1>창조관 실시간 통합 관제</h1>
            </div>

            <div className="toolbar-actions">
              <div className="floor-tabs">
                {[2, 3].map(f => (
                  <button
                    key={f}
                    className={floor === f ? 'active' : ''}
                    onClick={() => setFloor(f)}
                  >
                    {f}F
                  </button>
                ))}
              </div>
              <button className="ghost-button" onClick={loadRooms} disabled={loading}>
                ↻ 새로고침
              </button>
            </div>
          </div>

          {dangerRooms.length > 0 && (
            <div className="alert-strip">
              <strong>주의 필요</strong>
              <span>{dangerRooms[0].name} {dangerRooms[0].reason?.[0] || '상태 확인 필요'}</span>
              {dangerRooms.length > 1 && <em>+{dangerRooms.length - 1}</em>}
            </div>
          )}

          <div className="map-stage glass-panel">
            {loading && rooms.length === 0 ? (
              <div className="loading-state">
                <div className="spinner" />
                <span>실시간 데이터를 불러오는 중...</span>
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
        </section>

        <aside className={`right-rail ${selectedRoom ? 'open' : ''}`}>
          {selectedRoom ? (
            <DetailPanel room={selectedRoom} onClose={() => setSelectedRoom(null)} onExplain={setRoomLlm} />
          ) : (
            <div className="empty-detail glass-panel">
              <p className="eyebrow">DETAIL PANEL</p>
              <h2>공간을 선택하세요</h2>
              <span>도면 또는 좌측 공간 목록을 누르면 AI 분석과 센서 상세값이 표시됩니다.</span>
            </div>
          )}
        </aside>
      </main>
    </div>
  );
}
