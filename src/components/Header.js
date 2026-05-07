import React from 'react';

export default function Header({ lastUpdated, isLive, loading }) {
  return (
    <header style={{
      display:'flex', alignItems:'center', justifyContent:'space-between',
      padding:'0 24px', height:48,
      borderBottom:'1px solid var(--border)',
      background:'rgba(8,12,20,0.96)',
      backdropFilter:'blur(12px)',
      position:'sticky', top:0, zIndex:100,
    }}>
      <div style={{ display:'flex', alignItems:'center', gap:14 }}>
        <div style={{
          padding:'3px 8px',
          border:'1px solid var(--accent)',
          borderRadius:3,
          fontFamily:'var(--font-mono)', fontSize:10, fontWeight:600,
          color:'var(--accent)', letterSpacing:'0.12em',
          background:'rgba(59,130,246,0.08)',
        }}>KBU</div>
        <div style={{ width:1, height:20, background:'var(--border2)' }}/>
        <div>
          <div style={{ fontFamily:'var(--font-mono)', fontSize:12, fontWeight:500, letterSpacing:'0.04em', color:'var(--text)' }}>
            실내환경 모니터링 시스템
          </div>
          <div style={{ fontFamily:'var(--font-mono)', fontSize:9, color:'var(--text3)', letterSpacing:'0.08em' }}>
            창조관 2F · 3F
          </div>
        </div>
      </div>

      <div style={{ display:'flex', alignItems:'center', gap:20 }}>
        {loading && (
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            <div style={{
              width:10, height:10,
              border:'1.5px solid var(--border2)',
              borderTopColor:'var(--accent)',
              borderRadius:'50%',
              animation:'spin 0.7s linear infinite',
            }}/>
            <span style={{ fontFamily:'var(--font-mono)', fontSize:9, color:'var(--text3)', letterSpacing:'0.08em' }}>LOADING</span>
          </div>
        )}
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          <div style={{
            width:5, height:5, borderRadius:'50%',
            background: isLive ? 'var(--safe)' : 'var(--text3)',
            boxShadow: isLive ? 'var(--safe-glow)' : 'none',
            animation: isLive ? 'pulse 2s ease-in-out infinite' : 'none',
          }}/>
          <span style={{ fontFamily:'var(--font-mono)', fontSize:9, color: isLive ? 'var(--safe)' : 'var(--text3)', letterSpacing:'0.1em' }}>
            {isLive ? 'LIVE' : 'OFFLINE'}
          </span>
        </div>
        {lastUpdated && (
          <span style={{ fontFamily:'var(--font-mono)', fontSize:9, color:'var(--text3)' }}>{lastUpdated}</span>
        )}
      </div>
    </header>
  );
}
