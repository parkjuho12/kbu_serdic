import React from 'react';
import RoomCard from './RoomCard';

const STATUS_COLOR = {
  comfortable:'var(--safe)', normal:'var(--warn)', danger:'var(--danger)', abnormal:'var(--abnormal)',
};
const STATUS_KR = { comfortable:'쾌적', normal:'보통', danger:'위험', abnormal:'비정상' };

const MAIN_ROOMS = { 2:['2F-LEFT','2F-RIGHT'], 3:['3F-LEFT','3F-RIGHT'] };
const HALL_ROOMS = { 2:'2F-HALL', 3:'3F-HALL' };
const ROOM_FLEX  = { '2F-LEFT':3,'2F-RIGHT':4,'3F-LEFT':3,'3F-RIGHT':4 };

function MiniMap({ layout, hallId, roomMap, selectedRoom, onSelect }) {
  return (
    <div style={{
      marginBottom:16, padding:'10px 14px',
      background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:6,
    }}>
      <div style={{ fontFamily:'var(--font-mono)', fontSize:8, color:'var(--text3)', letterSpacing:'0.1em', marginBottom:8 }}>
        FLOOR PLAN
      </div>
      {/* 메인 공간들 */}
      <div style={{ display:'flex', gap:3, height:22, marginBottom:3 }}>
        {layout.map(rid => {
          const room  = roomMap[rid];
          const color = room ? STATUS_COLOR[room.hasState] : 'var(--border)';
          const flex  = ROOM_FLEX[rid] || 1;
          return (
            <div key={rid} onClick={() => room && onSelect(room)} style={{
              flex, height:'100%',
              background: room ? `${color}12` : 'transparent',
              border:`1px solid ${selectedRoom?.room_id === rid ? color : 'var(--border)'}`,
              borderRadius:3, cursor:'pointer',
              display:'flex', alignItems:'center', justifyContent:'center',
              position:'relative', overflow:'hidden', transition:'all 0.2s',
            }}>
              {room && <div style={{ position:'absolute', top:0, left:0, right:0, height:1, background:color }}/>}
              <span style={{ fontFamily:'var(--font-mono)', fontSize:8, color: room ? color : 'var(--text3)' }}>
                {rid.split('-').slice(1).join('-')}
              </span>
            </div>
          );
        })}
      </div>
      {/* HALL */}
      {hallId && (() => {
        const room  = roomMap[hallId];
        const color = room ? STATUS_COLOR[room.hasState] : 'var(--border)';
        return (
          <div onClick={() => room && onSelect(room)} style={{
            height:18,
            background: room ? 'var(--bg3)' : 'transparent',
            border:`1px solid ${selectedRoom?.room_id === hallId ? color : 'var(--border2)'}`,
            borderRadius:2, cursor:'pointer',
            display:'flex', alignItems:'center', justifyContent:'center',
            position:'relative', overflow:'hidden', transition:'all 0.2s',
          }}>
            {room && <div style={{ position:'absolute', top:0, left:0, right:0, height:1, background:color, opacity:0.5 }}/>}
            <span style={{ fontFamily:'var(--font-mono)', fontSize:7, color:'var(--text3)', letterSpacing:'0.08em' }}>HALL</span>
          </div>
        );
      })()}
    </div>
  );
}

function HallBar({ room, onClick, selected }) {
  if (!room) return null;
  const m     = room.hasMeasurement || {};
  const color = STATUS_COLOR[room.hasState] || 'var(--border)';

  return (
    <div onClick={() => onClick(room)} style={{
      marginTop:12, padding:'10px 16px',
      background: selected ? 'var(--bg3)' : 'var(--bg2)',
      border:`1px solid ${selected ? color : 'var(--border)'}`,
      borderRadius:6, cursor:'pointer',
      display:'flex', alignItems:'center', gap:16,
      position:'relative', overflow:'hidden', transition:'all 0.2s',
    }}>
      <div style={{ position:'absolute', left:0, top:0, bottom:0, width:2, background:color, opacity:0.7 }}/>

      <div style={{ marginLeft:8 }}>
        <div style={{ fontFamily:'var(--font-mono)', fontSize:8, color:'var(--text3)', letterSpacing:'0.1em', marginBottom:2 }}>CENTRAL HALL</div>
        <div style={{ fontFamily:'var(--font-mono)', fontSize:10, color:'var(--text2)' }}>{room.room_id}</div>
      </div>

      <div style={{ display:'flex', alignItems:'center', gap:5 }}>
        <div style={{ width:4, height:4, borderRadius:'50%', background:color }}/>
        <span style={{ fontFamily:'var(--font-mono)', fontSize:9, color, fontWeight:600, letterSpacing:'0.06em' }}>
          {STATUS_KR[room.hasState] || '-'}
        </span>
      </div>

      <div style={{ display:'flex', gap:20, marginLeft:8 }}>
        {[
          { label:'CO₂', value:m.co2, unit:'ppm', warn:m.co2>1000 },
          { label:'온도', value:m.temp, unit:'°C', warn:false },
          { label:'습도', value:m.hum, unit:'%', warn:false },
          { label:'PM2.5', value:m.aerosol, unit:'μg', warn:false },
        ].map((s,i) => (
          <div key={i} style={{ fontFamily:'var(--font-mono)' }}>
            <span style={{ fontSize:8, color:'var(--text3)', marginRight:4, letterSpacing:'0.06em' }}>{s.label}</span>
            <span style={{ fontSize:12, color: s.warn ? 'var(--danger)' : 'var(--text)', fontWeight: s.warn ? 600 : 400 }}>
              {s.value ?? '—'}
            </span>
            {s.value != null && <span style={{ fontSize:8, color:'var(--text3)', marginLeft:2 }}>{s.unit}</span>}
          </div>
        ))}
      </div>

      <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:4 }}>
        <span style={{ fontFamily:'var(--font-mono)', fontSize:8, color:'var(--text3)' }}>에어컨 미설치</span>
      </div>
    </div>
  );
}

export default function FloorLayout({ floor, rooms, selectedRoom, onSelect }) {
  const layout   = MAIN_ROOMS[floor] || [];
  const hallId   = HALL_ROOMS[floor];
  const roomMap  = Object.fromEntries(rooms.map(r => [r.room_id, r]));
  const hallRoom = roomMap[hallId];

  return (
    <div style={{ padding:'18px 24px' }}>
      <MiniMap layout={layout} hallId={hallId} roomMap={roomMap} selectedRoom={selectedRoom} onSelect={onSelect} />

      <div style={{
        display:'grid',
        gridTemplateColumns: layout.map(rid => `minmax(260px, ${ROOM_FLEX[rid]||1}fr)`).join(' '),
        gap:10, alignItems:'start',
      }}>
        {layout.map(rid => {
          const room = roomMap[rid];
          if (!room) return <div key={rid}/>;
          return <RoomCard key={rid} room={room} selected={selectedRoom?.room_id===rid} onClick={onSelect}/>;
        })}
      </div>

      <HallBar room={hallRoom} onClick={onSelect} selected={selectedRoom?.room_id===hallId} />
    </div>
  );
}
