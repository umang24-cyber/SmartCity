/**
 * UserPortal.jsx
 * ─────────────
 * NEW User-facing portal: Submit incidents, request safe routes, SOS.
 * Fully self-contained. Calls /api/v1/route/safe and /api/v1/user/sos.
 * Does NOT touch any existing component.
 */

import React, { useState } from 'react';

const API_BASE = 'http://localhost:8000/api/v1';

/* ── Tiny reusable panel ──────────────────────────────────────── */
function Panel({ title, badge, children, accentColor = 'var(--accent)' }) {
  return (
    <div style={{
      background: 'var(--bg-panel)',
      border: '1px solid var(--border)',
      borderTop: `2px solid ${accentColor}`,
      padding: '1rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.75rem',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{
          fontFamily: 'var(--font-display)',
          fontSize: '0.68rem',
          color: accentColor,
          letterSpacing: '0.2em',
        }}>{title}</span>
        {badge && (
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.58rem',
            padding: '2px 8px',
            border: `1px solid ${accentColor}`,
            color: accentColor,
            letterSpacing: '0.1em',
          }}>{badge}</span>
        )}
      </div>
      {children}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <div style={{ fontSize: '0.58rem', color: 'var(--text-secondary)', letterSpacing: '0.15em', marginBottom: '0.3rem' }}>
        {label}
      </div>
      {children}
    </div>
  );
}

const inputStyle = {
  width: '100%',
  background: 'rgba(var(--accent-rgb),0.04)',
  border: '1px solid var(--border)',
  color: 'var(--text-primary)',
  fontFamily: 'var(--font-mono)',
  fontSize: '0.72rem',
  padding: '0.5rem 0.75rem',
  outline: 'none',
  letterSpacing: '0.06em',
  boxSizing: 'border-box',
};

function Btn({ onClick, loading, color = 'var(--accent)', children, id }) {
  return (
    <button
      id={id}
      onClick={onClick}
      disabled={loading}
      style={{
        background: 'transparent',
        border: `1px solid ${color}`,
        borderLeft: `3px solid ${color}`,
        color,
        fontFamily: 'var(--font-display)',
        fontSize: '0.68rem',
        letterSpacing: '0.18em',
        padding: '0.55rem 1.2rem',
        cursor: loading ? 'wait' : 'none',
        opacity: loading ? 0.6 : 1,
        transition: 'all 0.2s',
      }}
    >
      {loading ? '...' : children}
    </button>
  );
}

function StatusBadge({ text, ok }) {
  return (
    <div style={{
      fontFamily: 'var(--font-mono)',
      fontSize: '0.65rem',
      color: ok ? 'var(--accent)' : 'var(--amber)',
      background: ok ? 'rgba(var(--accent-rgb),0.07)' : 'rgba(255,170,0,0.07)',
      border: `1px solid ${ok ? 'var(--accent)' : 'var(--amber)'}`,
      padding: '0.5rem 0.75rem',
      lineHeight: 1.6,
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-all',
    }}>{text}</div>
  );
}

/* ── Main Component ───────────────────────────────────────────── */
export default function UserPortal({ onBack }) {
  // Safe Route state
  const [srcLat, setSrcLat] = useState('12.9716');
  const [srcLng, setSrcLng] = useState('77.5946');
  const [dstLat, setDstLat] = useState('12.9763');
  const [dstLng, setDstLng] = useState('77.5929');
  const [routeResult, setRouteResult] = useState(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState(null);

  // SOS state
  const [sosLat, setSosLat] = useState('12.9716');
  const [sosLng, setSosLng] = useState('77.5946');
  const [sosMsg, setSosMsg] = useState('');
  const [sosResult, setSosResult] = useState(null);
  const [sosLoading, setSosLoading] = useState(false);
  const [sosError, setSosError] = useState(null);

  async function handleRoute() {
    setRouteLoading(true);
    setRouteResult(null);
    setRouteError(null);
    try {
      const res = await fetch(`${API_BASE}/route/safe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: { lat: parseFloat(srcLat), lng: parseFloat(srcLng) },
          destination: { lat: parseFloat(dstLat), lng: parseFloat(dstLng) },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Request failed');
      setRouteResult(data);
    } catch (e) {
      setRouteError(e.message);
    } finally {
      setRouteLoading(false);
    }
  }

  async function handleSOS() {
    setSosLoading(true);
    setSosResult(null);
    setSosError(null);
    try {
      const res = await fetch(`${API_BASE}/user/sos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lat: parseFloat(sosLat),
          lng: parseFloat(sosLng),
          message: sosMsg || 'Emergency SOS',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'SOS failed');
      setSosResult(data);
    } catch (e) {
      setSosError(e.message);
    } finally {
      setSosLoading(false);
    }
  }

  return (
    <div style={{
      height: '100vh',
      background: 'var(--bg-primary)',
      backgroundImage: 'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(var(--accent-rgb),0.06) 0%, transparent 60%)',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'var(--font-mono)',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <header style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0.75rem 1.5rem',
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg-panel)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div className="led led-green pulse-green" />
          <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.7rem', color: 'var(--accent)', letterSpacing: '0.22em' }}>
            ◉ USER PORTAL
          </span>
          <span style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', letterSpacing: '0.1em' }}>
            CITIZEN SAFETY INTERFACE
          </span>
        </div>
        <button
          id="user-portal-back"
          onClick={onBack}
          style={{
            background: 'transparent',
            border: '1px solid var(--border)',
            color: 'var(--text-secondary)',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.62rem',
            letterSpacing: '0.12em',
            padding: '0.35rem 0.9rem',
            cursor: 'none',
          }}
        >
          ← BACK
        </button>
      </header>

      {/* Body */}
      <main style={{
        flex: 1,
        overflowY: 'auto',
        padding: '1.5rem',
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '1.25rem',
        alignContent: 'start',
      }}>

        {/* ── Safe Route ───────────────────────────── */}
        <Panel title="→ SAFE ROUTE REQUEST" badge="POST /route/safe">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
            <Field label="SOURCE LAT">
              <input id="route-src-lat" style={inputStyle} value={srcLat} onChange={e => setSrcLat(e.target.value)} />
            </Field>
            <Field label="SOURCE LNG">
              <input id="route-src-lng" style={inputStyle} value={srcLng} onChange={e => setSrcLng(e.target.value)} />
            </Field>
            <Field label="DESTINATION LAT">
              <input id="route-dst-lat" style={inputStyle} value={dstLat} onChange={e => setDstLat(e.target.value)} />
            </Field>
            <Field label="DESTINATION LNG">
              <input id="route-dst-lng" style={inputStyle} value={dstLng} onChange={e => setDstLng(e.target.value)} />
            </Field>
          </div>
          <Btn id="route-submit" onClick={handleRoute} loading={routeLoading}>
            COMPUTE SAFE ROUTE
          </Btn>
          {routeResult && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <StatusBadge ok text={
                `✔ ROUTE COMPUTED\n` +
                `Shortest dist : ${routeResult.shortest_route?.distance_m?.toFixed(0) ?? routeResult.stats?.distance_m?.toFixed(0) ?? '—'} m\n` +
                `Safest danger : ${routeResult.safest_route?.danger_score ?? routeResult.stats?.overall_danger_score ?? '—'}\n` +
                `Level         : ${(routeResult.safest_route?.danger_level ?? routeResult.stats?.danger_level ?? '—').toUpperCase()}\n` +
                `ETA (walk)    : ${routeResult.safest_route?.estimated_time_min ?? routeResult.stats?.estimated_time_minutes ?? '—'} min\n` +
                `Tip           : ${routeResult.safest_route?.recommendation ?? routeResult.stats?.recommendation ?? '—'}`
              } />
            </div>
          )}
          {routeError && <StatusBadge text={`✕ ERROR: ${routeError}`} />}
        </Panel>

        {/* ── SOS ──────────────────────────────────── */}
        <Panel title="⚠ SOS ALERT" badge="POST /user/sos" accentColor="var(--amber)">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
            <Field label="LATITUDE">
              <input id="sos-lat" style={inputStyle} value={sosLat} onChange={e => setSosLat(e.target.value)} />
            </Field>
            <Field label="LONGITUDE">
              <input id="sos-lng" style={inputStyle} value={sosLng} onChange={e => setSosLng(e.target.value)} />
            </Field>
          </div>
          <Field label="EMERGENCY MESSAGE">
            <textarea
              id="sos-message"
              style={{ ...inputStyle, resize: 'vertical', minHeight: 60 }}
              value={sosMsg}
              onChange={e => setSosMsg(e.target.value)}
              placeholder="Describe the emergency..."
            />
          </Field>
          <Btn id="sos-submit" onClick={handleSOS} loading={sosLoading} color="var(--amber)">
            ⚠ SEND SOS ALERT
          </Btn>
          {sosResult && (
            <StatusBadge ok text={
              `✔ SOS DISPATCHED\n` +
              `ID      : ${sosResult.incident_id}\n` +
              `Status  : ${sosResult.status?.toUpperCase()}\n` +
              `Time    : ${sosResult.timestamp}`
            } />
          )}
          {sosError && <StatusBadge text={`✕ ERROR: ${sosError}`} />}
        </Panel>

        {/* ── Info banner ───────────────────────────── */}
        <div style={{
          gridColumn: '1 / -1',
          background: 'rgba(var(--accent-rgb),0.03)',
          border: '1px solid var(--border)',
          padding: '0.75rem 1rem',
          display: 'flex',
          gap: '2rem',
          alignItems: 'center',
        }}>
          <div style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', letterSpacing: '0.12em' }}>
            ⬡ BACKEND: <span style={{ color: 'var(--accent)' }}>localhost:8000</span>
          </div>
          <div style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', letterSpacing: '0.12em' }}>
            → ROUTE: <span style={{ color: 'var(--accent)' }}>/api/v1/route/safe</span>
          </div>
          <div style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', letterSpacing: '0.12em' }}>
            ⚠ SOS: <span style={{ color: 'var(--amber)' }}>/api/v1/user/sos</span>
          </div>
        </div>
      </main>
    </div>
  );
}
