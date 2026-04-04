import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import Explorer from '../components/Explorer';
import { verifyIncident, getOverview, getSupervisorTrends, getInfrastructureStatus } from '../api/smartcity';
import { useTigerGraph } from '../hooks/useTigerGraph';
import ModeSlider from '../components/ModeSlider';
import OrayaLogo from '../components/OrayaLogo';

/* ── Tiny sparkline via SVG ───────────────────────────────── */
function Sparkline({ data = [], color = 'var(--accent)', height = 36, width = 180 }) {
  if (!data.length) return null;
  const max = Math.max(...data, 1);
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - (v / max) * height;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg width={width} height={height} style={{ overflow: 'visible' }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx={(data.length - 1) / (data.length - 1) * width} cy={height - (data[data.length - 1] / max) * height} r="3" fill={color} />
    </svg>
  );
}

const INFRA_STATUS_COLORS = {
  active: 'var(--accent)',
  inactive: 'var(--danger)',
  degraded: 'var(--amber)',
};

export default function SupervisorDashboard() {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();
  const { intersections, incidents, safeRoute, selectedIntersection, refresh } = useTigerGraph();
  const [unverified, setUnverified] = useState([]);
  const [stats, setStats] = useState(null);
  const [trends, setTrends] = useState(null);
  const [infraStatus, setInfraStatus] = useState([]);
  const [showInfra, setShowInfra] = useState(false);

  useEffect(() => {
    setUnverified(incidents.filter(i => !i.verified));
    if (token) {
      getOverview(token)
        .then(res => setStats(res))
        .catch(err => console.error("Failed to fetch overview:", err));

      getSupervisorTrends(token)
        .then(res => setTrends(res))
        .catch(err => console.warn("Trends unavailable:", err));

      getInfrastructureStatus(token)
        .then(res => setInfraStatus(Array.isArray(res) ? res : []))
        .catch(err => console.warn("Infrastructure status unavailable:", err));
    }
  }, [incidents, token]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleVerify = async (id, status) => {
    try {
      await verifyIncident(id, status === 'verify', 'Reviewed by supervisor', token);
      refresh();
      if (stats) setStats({ ...stats, unverified_count: Math.max(0, stats.unverified_count - 1) });
    } catch (err) {
      console.error("Failed to verify:", err);
    }
  };

  // Build sparkline data from trends
  const trendData = trends?.safety_trend?.map(d => d.avg_score) ?? [];
  const incidentTrend = trends?.daily_incidents?.map(d => d.count) ?? [];

  // Infrastructure health summary
  const activeCount = infraStatus.filter(f => f.status === 'active').length;
  const inactiveCount = infraStatus.filter(f => f.status === 'inactive').length;

  return (
    <div className="layout rbac-layout">
      <header className="site-header" style={{ borderBottomColor: 'var(--medium)' }}>
        <div className="flex-row gap-3 items-center">
          <OrayaLogo variant="full" status="active" subtitle={
            <span style={{ fontSize: '0.65rem', color: 'var(--medium)', fontFamily: 'var(--font-mono)', letterSpacing: '0.12em' }}>SUPERVISOR OVERRIDE</span>
          } />
        </div>
        <div className="nav-links flex-row gap-4 items-center">
          <div style={{ width: '140px' }}><ModeSlider /></div>
          <span className="text-sm font-mono text-medium">OP: {user?.email}</span>
          <button onClick={handleLogout} className="btn-secondary btn-sm" style={{ padding: '4px 8px' }}>TIMEOUT</button>
        </div>
      </header>

      <div className="map-container">
        <Explorer
          intersections={intersections}
          incidents={incidents}
          safeRoute={safeRoute}
          selectedIntersection={selectedIntersection}
        />
      </div>

      {/* TOP STATS BAR */}
      <div className="flex-row gap-4 justify-center" style={{ position: 'absolute', top: '80px', left: '50%', transform: 'translateX(-50%)', zIndex: 1000, width: 'auto' }}>
        <div className="stats-card px-6 py-2 bg-bg-panel/80 backdrop-blur border border-medium/20 rounded shadow-lg">
          <div className="text-[10px] text-gray-400 uppercase">City Safety</div>
          <div className="text-xl font-bold text-safe">{stats?.avg_city_safety ?? '--'}%</div>
        </div>
        <div className="stats-card px-6 py-2 bg-bg-panel/80 backdrop-blur border border-danger/20 rounded shadow-lg">
          <div className="text-[10px] text-gray-400 uppercase">Unverified</div>
          <div className="text-xl font-bold text-danger">{stats?.unverified_count ?? unverified.length}</div>
        </div>
        <div className="stats-card px-6 py-2 bg-bg-panel/80 backdrop-blur border border-accent/20 rounded shadow-lg">
          <div className="text-[10px] text-gray-400 uppercase">High Severity</div>
          <div className="text-xl font-bold text-accent">{stats?.high_severity_count ?? '--'}</div>
        </div>
        {/* Infrastructure health pill — /supervisor/infrastructure/status */}
        <button
          onClick={() => setShowInfra(v => !v)}
          className="stats-card px-4 py-2 bg-bg-panel/80 backdrop-blur border rounded shadow-lg transition hover:border-medium/60"
          style={{ borderColor: inactiveCount > 0 ? 'var(--amber)' : 'var(--accent)', cursor: 'pointer' }}
        >
          <div className="text-[10px] text-gray-400 uppercase">Infra</div>
          <div className="text-sm font-bold" style={{ color: inactiveCount > 0 ? 'var(--amber)' : 'var(--accent)' }}>
            {activeCount}✔ {inactiveCount > 0 ? `${inactiveCount}✕` : ''}
          </div>
        </button>
      </div>

      {/* INFRASTRUCTURE STATUS DROPDOWN — /supervisor/infrastructure/status */}
      {showInfra && infraStatus.length > 0 && (
        <div style={{
          position: 'absolute', top: '140px', left: '50%', transform: 'translateX(-50%)',
          zIndex: 1100, width: '640px', background: 'var(--bg-panel)',
          border: '1px solid var(--medium)', borderRadius: '6px', padding: '1rem',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        }}>
          <div className="flex-row justify-between mb-3">
            <span className="text-xs font-bold text-medium uppercase tracking-widest">Infrastructure Status</span>
            <button onClick={() => setShowInfra(false)} className="text-xs text-gray-500 hover:text-white">✕ CLOSE</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            {infraStatus.map((f, i) => {
              const col = INFRA_STATUS_COLORS[f.status] || 'var(--border)';
              return (
                <div key={i} className="p-2 rounded" style={{ border: `1px solid ${col}30`, background: `rgba(0,0,0,0.2)` }}>
                  <div className="flex-row justify-between items-center mb-1">
                    <span className="text-xs text-white font-mono">{f.feature_id || f.name || `UNIT-${i + 1}`}</span>
                    <span className="text-[10px] font-bold px-1.5 rounded" style={{ background: `${col}20`, color: col }}>
                      {f.status?.toUpperCase()}
                    </span>
                  </div>
                  <div className="text-[10px] text-gray-400">{f.type || f.feature_type || 'System'}</div>
                  <div className="flex-row gap-3 mt-1">
                    <span className="text-[10px] text-gray-500">Reliability: <span className="text-white">{((f.reliability_score ?? 0) * 100).toFixed(0)}%</span></span>
                    <span className="text-[10px] text-gray-500">Maint: <span className="text-amber">{f.maintenance_prediction}</span></span>
                    <span className="text-[10px] text-gray-500">Crit: <span className="text-white">{((f.criticality_score ?? 0) * 100).toFixed(0)}%</span></span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="overlay-panel side-panel" style={{ right: '20px', top: '80px', bottom: '20px', width: '340px', borderColor: 'var(--medium)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexShrink: 0 }}>
          <h2 className="panel-title" style={{ color: 'var(--medium)', margin: 0 }}>INCIDENT REVIEW</h2>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', padding: '2px 8px', background: 'rgba(255,170,0,0.1)', border: '1px solid var(--amber)', color: 'var(--amber)' }}>
            {unverified.length} PENDING
          </span>
        </div>

        {/* Trends sparklines — /supervisor/dashboard/trends */}
        {trendData.length > 0 && (
          <div className="mb-3 p-3 rounded" style={{ border: '1px solid var(--border)', background: 'rgba(0,0,0,0.2)', flexShrink: 0 }}>
            <div className="text-[10px] text-gray-400 uppercase tracking-widest mb-2">Safety Trend</div>
            <div className="flex-row justify-between items-end">
              <Sparkline data={trendData} color="var(--accent)" />
              <div className="text-right">
                <div className="text-xs font-bold text-accent">{trendData[trendData.length - 1]}%</div>
                <div className="text-[9px] text-gray-500">current</div>
              </div>
            </div>
            {incidentTrend.length > 0 && (
              <>
                <div className="text-[10px] text-gray-400 uppercase tracking-widest mt-2 mb-1">Incident Volume</div>
                <div className="flex-row justify-between items-end">
                  <Sparkline data={incidentTrend} color="var(--danger)" />
                  <div className="text-right">
                    <div className="text-xs font-bold text-danger">{incidentTrend[incidentTrend.length - 1]}</div>
                    <div className="text-[9px] text-gray-500">latest</div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        <div className="text-xs text-gray-300 mb-3 p-2 bg-medium/5 border-l-2 border-medium" style={{ flexShrink: 0 }}>
          AI Ops Insight: focus first on repeated reports in the same zone to reduce escalation risk faster.
        </div>

        {/* Incidents by type breakdown from stats */}
        {stats?.incidents_by_type && (
          <div className="mb-3 p-3 rounded" style={{ border: '1px solid var(--border)', flexShrink: 0 }}>
            <div className="text-[10px] text-gray-400 uppercase tracking-widest mb-2">Incident Breakdown</div>
            {Object.entries(stats.incidents_by_type).map(([type, count]) => (
              <div key={type} className="flex-row justify-between mb-1">
                <span className="text-[10px] text-gray-300">{type.replace(/_/g, ' ')}</span>
                <span className="text-[10px] font-mono font-bold text-medium">{count}</span>
              </div>
            ))}
          </div>
        )}

        <div className="flex-col gap-2 overflow-y-auto" style={{ flex: 1, paddingBottom: '8px' }}>
          {unverified.length === 0 ? (
            <div className="text-gray-400 text-sm italic py-8 text-center border border-dashed border-gray-700 rounded">
              ✓ Clear. No pending verifications.
            </div>
          ) : unverified.map(inc => {
            const emLvl = (inc.emergency_level || 'MEDIUM').toUpperCase();
            const emColor = emLvl === 'CRITICAL' ? '#ff3344' : emLvl === 'HIGH' ? '#ff6600' : emLvl === 'MEDIUM' ? '#ffaa00' : '#00cc66';
            const sev = inc.severity_score ?? (typeof inc.severity === 'number' ? inc.severity / 5 : 0.5);
            return (
              <div key={inc.incident_id} style={{
                padding: '12px', border: `1px solid ${emColor}33`, borderLeft: `3px solid ${emColor}`,
                borderRadius: '4px', background: `${emColor}06`, transition: 'all 0.2s',
              }}>
                {/* Header row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                  <div>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: 'var(--text-secondary)' }}>{inc.incident_id}</span>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: '#fff', fontWeight: 'bold', marginTop: '2px' }}>
                      {inc.incident_type?.replace(/_/g, ' ').toUpperCase() || 'UNKNOWN'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '3px' }}>
                    <span style={{ fontSize: '0.58rem', fontWeight: 'bold', padding: '2px 6px', background: `${emColor}22`, color: emColor, border: `1px solid ${emColor}44`, borderRadius: '2px' }}>
                      {emLvl}
                    </span>
                    <span style={{ fontSize: '0.56rem', color: 'var(--text-secondary)' }}>
                      SEV {(sev * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>

                {/* Text excerpt */}
                {inc.text && (
                  <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.75)', marginBottom: '6px', lineHeight: 1.5, borderLeft: '2px solid rgba(255,255,255,0.1)', paddingLeft: '8px', fontStyle: 'italic' }}>
                    "{inc.text.length > 80 ? inc.text.slice(0, 80) + '…' : inc.text}"
                  </div>
                )}

                {/* Meta row */}
                <div style={{ display: 'flex', gap: '1rem', marginBottom: '8px', fontSize: '0.6rem', color: 'var(--text-secondary)' }}>
                  <span>{inc.source === 'user_report' ? '👤 Citizen Report' : '🤖 AI Detected'}</span>
                  {inc.timestamp && <span>🕐 {new Date(inc.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}
                  {inc.location_id && <span>📍 {inc.location_id}</span>}
                </div>

                {/* Severity bar */}
                <div style={{ height: '2px', background: 'rgba(255,255,255,0.08)', borderRadius: '1px', marginBottom: '8px' }}>
                  <div style={{ height: '2px', width: `${sev * 100}%`, background: emColor, borderRadius: '1px', transition: 'width 0.5s ease' }} />
                </div>

                {/* Action buttons */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                  <button
                    onClick={() => handleVerify(inc.incident_id, 'verify')}
                    style={{
                      padding: '7px 0', fontFamily: 'var(--font-mono)', fontSize: '0.68rem', letterSpacing: '0.1em',
                      background: 'rgba(0,255,136,0.1)', color: 'var(--accent)', border: '1px solid var(--accent)',
                      cursor: 'pointer', transition: 'all 0.2s', borderRadius: '2px',
                    }}
                  >
                    ✔ VERIFY
                  </button>
                  <button
                    onClick={() => handleVerify(inc.incident_id, 'reject')}
                    style={{
                      padding: '7px 0', fontFamily: 'var(--font-mono)', fontSize: '0.68rem', letterSpacing: '0.1em',
                      background: 'rgba(255,51,68,0.1)', color: 'var(--red-alert)', border: '1px solid var(--red-alert)',
                      cursor: 'pointer', transition: 'all 0.2s', borderRadius: '2px',
                    }}
                  >
                    ✕ REJECT
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
