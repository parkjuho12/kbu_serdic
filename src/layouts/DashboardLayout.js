import React from 'react';
import Header from '../components/Header';
import SummaryBar from '../components/SummaryBar';
import FloorLayout from '../components/FloorLayout';
import DetailPanel from '../components/DetailPanel';

export default function DashboardLayout({
  rooms,
  floor,
  selectedRoom,
  loading,
  isLive,
  lastUpdated,
  floorRooms,
  dangerRooms,
  setFloor,
  setSelectedRoom,
  setRoomLlm,
  loadRooms,
}) {
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
                {[2, 3].map((value) => (
                  <button
                    key={value}
                    className={floor === value ? 'active' : ''}
                    onClick={() => setFloor(value)}
                  >
                    {value}F
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
            <DetailPanel
              room={selectedRoom}
              onClose={() => setSelectedRoom(null)}
              onExplain={setRoomLlm}
            />
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
