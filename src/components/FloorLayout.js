import React from 'react';
import RoomCard from './RoomCard';

const STATUS_COLOR = {
  comfortable: 'var(--safe)',
  normal:      'var(--warn)',
  danger:      'var(--danger)',
  abnormal:    'var(--abnormal)',
};

const MAIN_ROOMS = {
  2: ['2F-LEFT', '2F-RIGHT'],
  3: ['3F-LEFT', '3F-RIGHT'],
};
const HALL_ROOMS = {
  2: '2F-HALL',
  3: '3F-HALL',
};
const ROOM_FLEX = {
  '2F-LEFT': 3, '2F-RIGHT': 4,
  '3F-LEFT': 3, '3F-RIGHT': 4,
};

function MiniMap({ layout, hallId, roomMap, selectedRoom, onSelect }) {
  return (
    <div style={{ marginBottom:20, padding:'12px 16px', background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:10 }}>
      <div style={{ fontSize:10, color:'var(--text2)', fontFamily:'var(--font-mono)', marginBottom:10, letterSpacing:'0.06em' }}>
        평면도 개요
      </div>
      <div style={{ display:'flex', gap:3, height:28, marginBottom:6 }}>
        {layout.map(rid => {
          const room   = roomMap[rid];
          const color  = room ? STATUS_COLOR[room.hasState] : 'var(--border)';
          const flex   = ROOM_FLEX[rid] || 1;
          return (
            <div key={rid} onClick={() => room && onSelect(room)} style={{
              flex, height:'100%',
              background: room ? `${color}18` : 'transparent',
              border:`1px solid ${room && selectedRoom?.room_id === rid ? color : 'var(--border)'}`,
              borderRadius:4, cursor:'pointer',
              display:'flex', alignItems:'center', justifyContent:'center',
              transition:'all 0.2s', position:'relative', overflow:'hidden',
            }}>
              {room && <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:color }}/>}  
              <span style={{ fontFamily:'var(--font-mono)', fontSize:9, color: room ? color : 'var(--text3)' }}>
                {rid.split('-').slice(1).join('-')}
              </span>
            </div>
          );
        })}
      </div>
      {hallId && (
        <div style={{ display:'flex', gap:3, height:28 }}>
          {(() => {
            const room = roomMap[hallId];
            const color = room ? STATUS_COLOR[room.hasState] : 'var(--border)';
            return (
              <div key={hallId} onClick={() => room && onSelect(room)} style={{
                flex: 1, height:'100%',
                background: room ? 'var(--bg3)' : 'transparent',
                border:`1px solid ${room && selectedRoom?.room_id === hallId ? color : 'var(--border)'}`,
                borderRadius:4, cursor:'pointer',
                display:'flex', alignItems:'center', justifyContent:'center',
                transition:'all 0.2s', position:'relative', overflow:'hidden',
              }}>
                {room && <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:color }}/>}  
                <span style={{ fontFamily:'var(--font-mono)', fontSize:9, color: room ? color : 'var(--text3)' }}>
                  HALL
                </span>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}

function HallBar({ room, onClick, selected }) {
  if (!room) return null;
  const m     = room.hasMeasurement || {};
  const color = STATUS_COLOR[room.hasState] || 'var(--border)';
  const STATUS_KR = { comfortable:'쾌적', normal:'보통', danger:'위험', abnormal:'비정상' };

  return (
    <div onClick={() => onClick(room)} style={{
      marginTop: 24,
      padding: '10px 16px',
      background: selected ? 'var(--bg3)' : 'var(--bg2)',
      border: `1px solid ${selected ? 'var(--accent)' : 'var(--border)'}`,
      borderRadius: 8, cursor: 'pointer',
      display: 'flex', alignItems: 'center', gap: 16,
      position: 'relative', overflow: 'hidden',
      transition: 'all 0.2s',
    }}>
      <div style={{ position:'absolute', top:0, left:0, bottom:0, width:3, background:color }}/>

      <div style={{ marginLeft:8 }}>
        <div style={{ fontFamily:'var(--font-mono)', fontSize:10, color:'var(--text2)', marginBottom:2 }}>중앙 홀</div>
        <div style={{ fontFamily:'var(--font-mono)', fontSize:11, color:'var(--text3)' }}>{room.room_id}</div>
      </div>

      <div style={{ display:'flex', alignItems:'center', gap:5 }}>
        <div style={{ width:5, height:5, borderRadius:'50%', background:color }}/>
        <span style={{ fontFamily:'var(--font-mono)', fontSize:10, color }}>{STATUS_KR[room.hasState] || '-'}</span>
      </div>

      <div style={{ display:'flex', gap:16, marginLeft:8 }}>
        {[
          { label:'CO₂', value:m.co2, unit:'ppm' },
          { label:'온도', value:m.temp, unit:'°C' },
          { label:'습도', value:m.hum, unit:'%' },
        ].map((s, i) => (
          <div key={i} style={{ fontFamily:'var(--font-mono)', fontSize:11 }}>
            <span style={{ color:'var(--text3)', fontSize:9, marginRight:4 }}>{s.label}</span>
            <span style={{ color:'var(--text)' }}>{s.value ?? '—'}</span>
            {s.value != null && <span style={{ color:'var(--text2)', fontSize:9, marginLeft:2 }}>{s.unit}</span>}
          </div>
        ))}
      </div>

      <div style={{ marginLeft:'auto', fontFamily:'var(--font-mono)', fontSize:10, color:'var(--text3)' }}>
        에어컨 미설치
      </div>
    </div>
  );
}

export default function FloorLayout({ floor, rooms, selectedRoom, onSelect }) {
  const layout  = MAIN_ROOMS[floor] || [];
  const hallId  = HALL_ROOMS[floor];
  const roomMap = Object.fromEntries(rooms.map(r => [r.room_id, r]));
  const hallRoom = roomMap[hallId];

  return (
    <div style={{ padding:'20px 32px' }}>
      {/* 미니맵 */}
      <MiniMap
        layout={layout}
        hallId={hallId}
        roomMap={roomMap}
        selectedRoom={selectedRoom}
        onSelect={onSelect}
      />

      {/* 메인 카드 그리드 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: layout.map(rid => `minmax(240px, ${ROOM_FLEX[rid]||1}fr)`).join(' '),
        gap: 12,
        alignItems: 'start',
      }}>
        {layout.map(rid => {
          const room = roomMap[rid];
          if (!room) return <div key={rid}/>;
          return (
            <RoomCard
              key={rid}
              room={room}
              selected={selectedRoom?.room_id === rid}
              onClick={onSelect}
            />
          );
        })}
      </div>

      {/* HALL 별도 표시 */}
      <HallBar
        room={hallRoom}
        onClick={onSelect}
        selected={selectedRoom?.room_id === hallId}
      />
    </div>
  );
}