import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import Explorer from '../components/Explorer';
import { verifyIncident, getOverview, getSupervisorTrends, getInfrastructureStatus } from '../api/smartcity';
import { useTigerGraph } from '../hooks/useTigerGraph';

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
        <div className="flex-row">
          <div className="logo cursor-pointer" onClick={() => navigate('/')}>
            SMARTCITY<span className="dot" style={{ color: 'var(--medium)' }}>.</span>
            <span className="text-sm ml-2" style={{ color: 'var(--medium)' }}>SUPERVISOR OVERRIDE</span>
          </div>
        </div>
        <div className="nav-links flex-row gap-4">
          <span className="text-sm font-mono text-medium">OP ID: {user?.email}</span>
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

      <div className="overlay-panel side-panel" style={{ right: '20px', top: '80px', bottom: '20px', width: '320px', borderColor: 'var(--medium)' }}>
        <h2 className="panel-title mb-2" style={{ color: 'var(--medium)' }}>UNVERIFIED LOGS</h2>

        {/* Trends sparklines — /supervisor/dashboard/trends */}
        {trendData.length > 0 && (
          <div className="mb-3 p-3 rounded" style={{ border: '1px solid var(--border)', background: 'rgba(0,0,0,0.2)' }}>
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

        <div className="text-xs text-gray-300 mb-3 p-2 bg-medium/5 border-l-2 border-medium">
          AI Ops Insight: focus first on repeated reports in the same zone to reduce escalation risk faster.
        </div>

        {/* Incidents by type breakdown from stats */}
        {stats?.incidents_by_type && (
          <div className="mb-3 p-3 rounded" style={{ border: '1px solid var(--border)' }}>
            <div className="text-[10px] text-gray-400 uppercase tracking-widest mb-2">Incident Breakdown</div>
            {Object.entries(stats.incidents_by_type).map(([type, count]) => (
              <div key={type} className="flex-row justify-between mb-1">
                <span className="text-[10px] text-gray-300">{type.replace(/_/g, ' ')}</span>
                <span className="text-[10px] font-mono font-bold text-medium">{count}</span>
              </div>
            ))}
          </div>
        )}

        <div className="flex-col gap-2 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 420px)' }}>
          {unverified.length === 0 ? (
            <div className="text-gray-400 text-sm italic py-8 text-center border border-dashed border-gray-700 rounded">
              Clear. No pending verifications.
            </div>
          ) : unverified.map(inc => (
            <div key={inc.incident_id} className="p-3 border border-medium/30 rounded bg-medium/5 hover:bg-medium/10 transition">
              <div className="flex-row justify-between mb-1">
                <span className="text-xs text-medium font-mono">{inc.incident_id}</span>
                <span className={`text-[10px] font-bold px-1 rounded ${inc.severity >= 4 ? 'bg-danger text-white' : 'bg-amber text-black'}`}>
                  SEV:{inc.severity}
                </span>
              </div>
              <div className="text-sm mb-2 text-white font-medium">{inc.incident_type?.replace?.('_', ' ').toUpperCase()}</div>
              <div className="text-[10px] text-gray-500 mb-3">
                {inc.source === 'user_report' ? '👤 Reported by Citizen' : '🤖 Detected by AI System'}
              </div>
              <div className="flex-row gap-2 mt-2">
                <button className="flex-1 btn-sm bg-safe/20 text-safe border border-safe hover:bg-safe hover:text-black transition" onClick={() => handleVerify(inc.incident_id, 'verify')}>VERIFY</button>
                <button className="flex-1 btn-sm bg-danger/20 text-danger border border-danger hover:bg-danger hover:text-white transition" onClick={() => handleVerify(inc.incident_id, 'reject')}>REJECT</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
