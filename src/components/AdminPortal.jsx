/**
 * AdminPortal.jsx
 * ───────────────
 * NEW operator admin UI: view incidents, zone danger scores, re-route insights.
 * Reads from /api/v1/admin/* endpoints.
 * Does NOT touch any existing component.
 */

import React, { useState, useEffect } from 'react';

const API_BASE = 'http://localhost:8000/api/v1';

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
        padding: '0.45rem 1rem',
        cursor: loading ? 'wait' : 'none',
        opacity: loading ? 0.6 : 1,
        transition: 'all 0.2s',
      }}
    >
      {loading ? 'LOADING...' : children}
    </button>
  );
}

function StatCell({ label, value, color = 'var(--accent)' }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 2,
      padding: '0.5rem 0.75rem',
      background: 'rgba(var(--accent-rgb),0.03)',
      border: '1px solid var(--border)',
    }}>
      <span style={{ fontSize: '0.58rem', color: 'var(--text-secondary)', letterSpacing: '0.12em' }}>{label}</span>
      <span style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', color, letterSpacing: '0.1em' }}>{value}</span>
    </div>
  );
}

const SEVERITY_COLORS = {
  critical: 'var(--red-alert)',
  high: 'var(--amber)',
  medium: '#f59e0b',
  low: 'var(--accent)',
};

export default function AdminPortal({ onBack }) {
  const [incidents, setIncidents] = useState([]);
  const [zones, setZones] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  async function fetchDashboard() {
    setRefreshing(true);
    try {
      const [incRes, zoneRes, statsRes] = await Promise.all([
        fetch(`${API_BASE}/admin/incidents`),
        fetch(`${API_BASE}/admin/zones`),
        fetch(`${API_BASE}/admin/stats`),
      ]);
      const [incData, zoneData, statsData] = await Promise.all([
        incRes.json(),
        zoneRes.json(),
        statsRes.json(),
      ]);
      setIncidents(incData.incidents ?? incData ?? []);
      setZones(zoneData.zones ?? zoneData ?? []);
      setStats(statsData);
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { fetchDashboard(); }, []);

  return (
    <div style={{
      height: '100vh',
      background: 'var(--bg-primary)',
      backgroundImage: 'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(168,85,247,0.05) 0%, transparent 60%)',
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
          <div style={{
            width: 6, height: 6, borderRadius: '50%',
            background: 'var(--amber)',
            boxShadow: '0 0 8px var(--amber)',
            animation: 'pulse-amber 1.5s ease-in-out infinite',
          }} />
          <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.7rem', color: 'var(--amber)', letterSpacing: '0.22em' }}>
            ⬡ ADMIN PORTAL
          </span>
          <span style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', letterSpacing: '0.1em' }}>
            OPERATOR COMMAND CENTRE
          </span>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <Btn id="admin-refresh" onClick={fetchDashboard} loading={refreshing} color="var(--amber)">
            ↻ REFRESH
          </Btn>
          <button
            id="admin-portal-back"
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
        </div>
      </header>

      {/* Body */}
      <main style={{
        flex: 1,
        overflowY: 'auto',
        padding: '1.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.25rem',
      }}>
        {/* Error banner */}
        {error && (
          <div style={{
            background: 'rgba(255,51,68,0.07)',
            border: '1px solid var(--red-alert)',
            padding: '0.65rem 1rem',
            fontSize: '0.68rem',
            color: 'var(--red-alert)',
            letterSpacing: '0.08em',
          }}>
            ✕ BACKEND ERROR: {error} — ensure `python main.py` is running at localhost:8000
          </div>
        )}

        {/* Stats row */}
        {stats && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' }}>
            <StatCell label="TOTAL INCIDENTS" value={stats.total_incidents ?? '—'} />
            <StatCell label="ACTIVE ZONES" value={stats.total_zones ?? '—'} />
            <StatCell label="CRITICAL ZONES" value={stats.critical_zones ?? '—'} color="var(--red-alert)" />
            <StatCell label="AVG DANGER SCORE" value={
              stats.avg_danger_score != null ? stats.avg_danger_score.toFixed(2) : '—'
            } color="var(--amber)" />
          </div>
        )}

        {/* Two-col layout */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '1.25rem', flex: 1 }}>

          {/* Incidents Table */}
          <Panel title="⬡ INCIDENT FEED" badge={`${incidents.length} ACTIVE`} accentColor="var(--red-alert)">
            {loading ? (
              <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>LOADING...</div>
            ) : incidents.length === 0 ? (
              <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>NO INCIDENTS ON RECORD</div>
            ) : (
              <div style={{ overflowY: 'auto', maxHeight: '55vh' }}>
                <table className="sub-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>SEVERITY</th>
                      <th>LOCATION</th>
                      <th>VERIFIED</th>
                      <th>TEXT</th>
                    </tr>
                  </thead>
                  <tbody>
                    {incidents.map((inc, i) => (
                      <tr key={inc.incident_id ?? i}>
                        <td style={{ color: 'var(--accent)', fontSize: '0.65rem' }}>{inc.incident_id}</td>
                        <td>
                          <span style={{
                            color: SEVERITY_COLORS[inc.severity] ?? 'var(--text-secondary)',
                            fontSize: '0.65rem',
                            letterSpacing: '0.08em',
                          }}>
                            {(inc.severity ?? '—').toUpperCase()}
                          </span>
                        </td>
                        <td style={{ fontSize: '0.63rem', color: 'var(--text-secondary)' }}>
                          {inc.location_id ?? `${inc.lat?.toFixed(3)},${inc.lng?.toFixed(3)}`}
                        </td>
                        <td style={{ fontSize: '0.65rem', color: inc.verified ? 'var(--accent)' : 'var(--text-secondary)' }}>
                          {inc.verified ? '✔' : '—'}
                        </td>
                        <td style={{ fontSize: '0.62rem', color: 'var(--text-secondary)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {inc.text}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          {/* Zone Danger Scoreboard */}
          <Panel title="◎ ZONE DANGER MATRIX" badge={`${zones.length} ZONES`} accentColor="var(--amber)">
            {loading ? (
              <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>LOADING...</div>
            ) : zones.length === 0 ? (
              <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>NO ZONE DATA</div>
            ) : (
              <div style={{ overflowY: 'auto', maxHeight: '55vh', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                {zones
                  .slice()
                  .sort((a, b) => (b.danger_score ?? 0) - (a.danger_score ?? 0))
                  .map((z, i) => {
                    const score = z.danger_score ?? 0;
                    const barColor =
                      score >= 0.75 ? 'var(--red-alert)' :
                      score >= 0.50 ? 'var(--amber)' :
                      score >= 0.25 ? '#f59e0b' :
                      'var(--accent)';
                    return (
                      <div key={z.zone_id ?? i} style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.6rem',
                        padding: '0.35rem 0.5rem',
                        background: 'rgba(var(--accent-rgb),0.02)',
                        border: '1px solid var(--border)',
                      }}>
                        <span style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', minWidth: 14 }}>
                          #{i + 1}
                        </span>
                        <span style={{ fontSize: '0.63rem', color: 'var(--text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {z.name ?? z.zone_id}
                        </span>
                        <div style={{ width: 80, height: 4, background: 'var(--border)', borderRadius: 2, flexShrink: 0 }}>
                          <div style={{ width: `${Math.min(score * 100, 100)}%`, height: '100%', background: barColor, borderRadius: 2 }} />
                        </div>
                        <span style={{ fontSize: '0.65rem', color: barColor, minWidth: 36, textAlign: 'right' }}>
                          {(score * 100).toFixed(0)}%
                        </span>
                      </div>
                    );
                  })}
              </div>
            )}
          </Panel>
        </div>

        {/* Endpoint reference */}
        <div style={{
          background: 'rgba(var(--accent-rgb),0.02)',
          border: '1px solid var(--border)',
          padding: '0.65rem 1rem',
          display: 'flex',
          gap: '2rem',
          flexWrap: 'wrap',
        }}>
          {[
            ['INCIDENTS', '/api/v1/admin/incidents'],
            ['ZONES', '/api/v1/admin/zones'],
            ['STATS', '/api/v1/admin/stats'],
          ].map(([label, path]) => (
            <div key={label} style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', letterSpacing: '0.1em' }}>
              {label}: <span style={{ color: 'var(--amber)' }}>{path}</span>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
