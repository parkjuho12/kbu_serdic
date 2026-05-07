import React from 'react';

export default function Header({ lastUpdated, isLive, loading }) {
  return (
    <header className="top-header">
      <div className="brand-area">
        <div className="brand-mark">KBU</div>
        <div>
          <div className="brand-title">Indoor Environment Monitoring</div>
          <div className="brand-subtitle">AI 기반 실내환경 · 공조 통합 관제</div>
        </div>
      </div>

      <div className="header-status">
        {loading && (
          <div className="status-chip muted">
            <span className="mini-spinner" />
            SYNC
          </div>
        )}
        <div className={`status-chip ${isLive ? 'live' : 'offline'}`}>
          <span className="live-dot" />
          {isLive ? 'LIVE' : 'OFFLINE'}
        </div>
        {lastUpdated && <div className="time-chip">최근 업데이트 {lastUpdated}</div>}
      </div>
    </header>
  );
}
