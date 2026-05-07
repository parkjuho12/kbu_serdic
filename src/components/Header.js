import React from 'react';

export default function Header({ lastUpdated, isLive, loading }) {
  return (
    <header style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 32px', height: 56,
      borderBottom: '1px solid var(--border)',
      background: 'var(--bg)',
      position: 'sticky', top: 0, zIndex: 100,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        {/* 로고 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 6,
            background: 'linear-gradient(135deg, var(--accent) 0%, var(--purple) 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 700, color: '#080b12',
          }}>KBU</div>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 14, letterSpacing: '0.04em' }}>
              실내환경 모니터링
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text2)', letterSpacing: '0.06em' }}>
              창조관 2F · 3F
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        {/* 로딩 */}
        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 14, height: 14, border: '2px solid var(--border2)',
              borderTopColor: 'var(--accent)', borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }}/>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text2)' }}>
              데이터 불러오는 중...
            </span>
          </div>
        )}

        {/* 라이브 상태 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{
            width: 6, height: 6, borderRadius: '50%',
            background: isLive ? 'var(--safe)' : 'var(--text3)',
            boxShadow: isLive ? '0 0 8px var(--safe)' : 'none',
            animation: isLive ? 'pulse 2s ease-in-out infinite' : 'none',
          }}/>
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 11,
            color: isLive ? 'var(--safe)' : 'var(--text2)',
            letterSpacing: '0.06em',
          }}>
            {isLive ? 'LIVE' : 'CONNECTING'}
          </span>
        </div>

        {/* 마지막 갱신 */}
        {lastUpdated && (
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text3)' }}>
            {lastUpdated}
          </div>
        )}
      </div>
    </header>
  );
}
