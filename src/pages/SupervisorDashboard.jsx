import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import Explorer from '../components/Explorer';
import { verifyIncident, getOverview } from '../api/smartcity';
import { useTigerGraph } from '../hooks/useTigerGraph';

export default function SupervisorDashboard() {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();
  const { intersections, incidents, safeRoute, selectedIntersection, refresh } = useTigerGraph();
  const [unverified, setUnverified] = useState([]);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    setUnverified(incidents.filter(i => !i.verified));
    if (token) {
      getOverview(token)
        .then(res => setStats(res))
        .catch(err => console.error("Failed to fetch overview:", err));
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
      // Optimistically update local stats
      if (stats) setStats({ ...stats, unverified_count: Math.max(0, stats.unverified_count - 1) });
    } catch (err) {
      console.error("Failed to verify:", err);
    }
  };

  return (
    <div className="layout rbac-layout">
      <header className="site-header" style={{ borderBottomColor: 'var(--medium)' }}>
        <div className="flex-row">
          <div className="logo cursor-pointer" onClick={() => navigate('/')}>SMARTCITY<span className="dot" style={{color: 'var(--medium)'}}>.</span> <span className="text-sm ml-2" style={{color: 'var(--medium)'}}>SUPERVISOR OVERRIDE</span></div>
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
          <div className="text-xl font-bold text-safe">{stats?.avg_city_safety || '--'}%</div>
        </div>
        <div className="stats-card px-6 py-2 bg-bg-panel/80 backdrop-blur border border-danger/20 rounded shadow-lg">
          <div className="text-[10px] text-gray-400 uppercase">Unverified</div>
          <div className="text-xl font-bold text-danger">{stats?.unverified_count || unverified.length}</div>
        </div>
        <div className="stats-card px-6 py-2 bg-bg-panel/80 backdrop-blur border border-accent/20 rounded shadow-lg">
          <div className="text-[10px] text-gray-400 uppercase">Active Units</div>
          <div className="text-xl font-bold text-accent">12</div>
        </div>
      </div>

      <div className="overlay-panel side-panel" style={{ right: '20px', top: '80px', bottom: '20px', width: '320px', borderColor: 'var(--medium)' }}>
        <h2 className="panel-title mb-4" style={{color: 'var(--medium)'}}>UNVERIFIED LOGS</h2>
        <div className="text-xs text-gray-300 mb-3 p-2 bg-medium/5 border-l-2 border-medium">
          AI Ops Insight: focus first on repeated reports in the same zone to reduce escalation risk faster.
        </div>
        <div className="flex-col gap-2 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 250px)' }}>
          {unverified.length === 0 ? (
            <div className="text-gray-400 text-sm italic py-8 text-center border border-dashed border-gray-700 rounded">Clear. No pending verifications.</div>
          ) : unverified.map(inc => (
            <div key={inc.incident_id} className="p-3 border border-medium/30 rounded bg-medium/5 hover:bg-medium/10 transition">
              <div className="flex-row justify-between mb-1">
                <span className="text-xs text-medium font-mono">{inc.incident_id}</span>
                <span className={`text-[10px] font-bold px-1 rounded ${inc.severity >= 4 ? 'bg-danger text-white' : 'bg-amber text-black'}`}>
                  SEV:{inc.severity}
                </span>
              </div>
              <div className="text-sm mb-2 text-white font-medium">{inc.incident_type.replace('_', ' ').toUpperCase()}</div>
              
              <div className="text-[10px] text-gray-500 mb-3">
                {inc.source === 'user_report' ? 'Reported by Citizen' : 'Detected by AI System'}
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

