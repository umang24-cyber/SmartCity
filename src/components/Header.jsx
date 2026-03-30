import React, { useState, useEffect } from 'react';

export default function Header({ safetyScore, backendOnline, intersectionName, onRefresh }) {
  const [clock, setClock] = useState('');
  const [uptime, setUptime] = useState(0);

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const h = String(now.getHours()).padStart(2, '0');
      const m = String(now.getMinutes()).padStart(2, '0');
      const s = String(now.getSeconds()).padStart(2, '0');
      setClock(`${h}:${m}:${s}`);
      setUptime(prev => prev + 1);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const risk = safetyScore >= 70 ? 'low' : safetyScore >= 45 ? 'medium' : 'high';
  const riskColor = risk === 'low' ? 'var(--accent)' : risk === 'medium' ? 'var(--amber)' : 'var(--red-alert)';
  const riskLabel = risk === 'low' ? 'NOMINAL' : risk === 'medium' ? 'ELEVATED' : 'CRITICAL';

  const circumference = 2 * Math.PI * 22;
  const dashOffset = circumference - (circumference * safetyScore) / 100;

  const formatUptime = (s) => {
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    return `${String(h).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  };

  return (
    <header style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0.75rem 1.25rem',
      background: 'var(--bg-panel)',
      borderBottom: '1px solid var(--border)',
      boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
      flexShrink: 0,
      zIndex: 50,
      position: 'relative',
      transition: 'background 0.4s ease, border-color 0.4s ease',
    }}>
      {/* LEFT — Branding */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
        {/* Logo mark */}
        <div style={{ position: 'relative', width: 36, height: 36 }}>
          <svg width="36" height="36" viewBox="0 0 36 36">
            <polygon points="18,2 34,28 2,28" fill="none" stroke="var(--accent)" strokeWidth="1.5" />
            <circle cx="18" cy="20" r="5" fill="var(--accent)" style={{ filter: 'drop-shadow(0 0 6px var(--accent))' }} />
          </svg>
        </div>
        <div>
          <div style={{
            fontFamily: 'var(--font-display)',
            fontSize: '0.95rem',
            fontWeight: 700,
            color: 'var(--accent)',
            letterSpacing: '0.25em',
            textShadow: '0 0 12px rgba(0,255,136,0.5)',
          }}>
            ORAYA
          </div>
          <div className="label-xs" style={{ marginTop: '1px' }}>
            SAFETY, BEFORE IT'S NEEDED ── {intersectionName || 'MG ROAD & BRIGADE RD'}
          </div>
        </div>

        {/* Divider */}
        <div style={{ width: 1, height: 32, background: 'var(--border)' }} />

        {/* Connection status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div
            className={backendOnline === null ? 'led led-dim blink-slow' : backendOnline ? 'led led-green pulse-green' : 'led led-amber pulse-amber'}
          />
          <div>
            <div className="label-xs" style={{ marginBottom: 1 }}>SYSTEM</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: backendOnline ? 'var(--accent)' : 'var(--amber)' }}>
              {backendOnline === null ? 'CHECKING...' : backendOnline ? 'ONLINE' : 'MOCK MODE'}
            </div>
          </div>
        </div>
      </div>

      {/* CENTER — Clock & uptime */}
      <div style={{ textAlign: 'center' }}>
        <div style={{
          fontFamily: 'var(--font-display)',
          fontSize: '1.5rem',
          color: 'var(--text-primary)',
          letterSpacing: '0.1em',
          lineHeight: 1,
        }}>
          {clock}
        </div>
        <div className="label-xs" style={{ marginTop: 3 }}>
          UPTIME: {formatUptime(uptime)}
        </div>
      </div>

      {/* RIGHT — Safety gauge + refresh */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
        {/* Gauge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ textAlign: 'right' }}>
            <div className="label-xs">THREAT LEVEL</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.75rem', color: riskColor, letterSpacing: '0.1em' }}>
              {riskLabel}
            </div>
          </div>
          <div style={{ position: 'relative', width: 52, height: 52 }}>
            <svg width="52" height="52" viewBox="0 0 52 52" style={{ transform: 'rotate(-90deg)' }}>
              <circle cx="26" cy="26" r="22" fill="transparent" stroke="rgba(255,255,255,0.05)" strokeWidth="3" />
              <circle
                cx="26" cy="26" r="22"
                fill="transparent"
                stroke={riskColor}
                strokeWidth="3"
                strokeDasharray={circumference}
                strokeDashoffset={dashOffset}
                strokeLinecap="butt"
                className="gauge-ring"
                style={{ filter: `drop-shadow(0 0 4px ${riskColor})`, transition: 'stroke-dashoffset 1s ease' }}
              />
            </svg>
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--font-display)',
              fontSize: '0.75rem',
              fontWeight: 700,
              color: riskColor,
            }}>
              {safetyScore}
            </div>
          </div>
        </div>

        {/* Refresh button */}
        <button
          onClick={onRefresh}
          className="btn-primary"
          style={{ padding: '0.4rem 0.85rem', fontSize: '0.6rem' }}
          title="Refresh all data"
        >
          ↺ REFRESH
        </button>
      </div>
    </header>
  );
}
