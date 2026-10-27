import React from 'react';

export function LoadingScreen({ onStart }) {
  return (
    <div id="loading">
      <div className="loading-inner" style={{ maxWidth: '480px', padding: '0 20px' }}>
        <div
          style={{
            fontSize: '12px',
            fontWeight: 800,
            letterSpacing: '0.4em',
            textTransform: 'uppercase',
            color: 'rgba(255, 255, 255, 0.6)',
            marginBottom: '14px',
          }}
        >
          A BILAL PRODUCTION
        </div>
        <div
          style={{
            fontSize: '44px',
            fontWeight: 900,
            letterSpacing: '0.18em',
            lineHeight: 1.1,
            color: '#fff',
            textShadow: '0 2px 20px rgba(0,0,0,0.8)',
            marginBottom: '32px',
          }}
        >
          GTA THAMARASSERY
        </div>
        <div className="bar" style={{ height: '3px', background: 'rgba(255,255,255,0.1)' }}>
          <div id="bar-fill" style={{ background: '#ffd34d' }}></div>
        </div>
        <div
          id="loading-status"
          style={{
            marginTop: '16px',
            fontSize: '11px',
            fontWeight: 600,
            letterSpacing: '0.12em',
            color: 'rgba(255,255,255,0.5)',
            textTransform: 'uppercase',
          }}
        >
          Loading…
        </div>
        <button
          id="start"
          className="hidden"
          onClick={onStart}
          style={{
            marginTop: '28px',
            padding: '12px 36px',
            fontSize: '13px',
            fontWeight: 800,
            letterSpacing: '0.2em',
            borderRadius: '4px',
            background: '#ffd34d',
            color: '#111',
            border: 'none',
            cursor: 'pointer',
            boxShadow: '0 6px 20px rgba(255, 211, 77, 0.3)',
          }}
        >
          START GAME
        </button>
      </div>
    </div>
  );
}

export default LoadingScreen;
