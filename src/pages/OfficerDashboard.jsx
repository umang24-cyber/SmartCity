import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import Explorer from '../components/Explorer';
import { getActiveIncidents, respondToIncident, getAssignments, getPatrolSafeZones } from '../api/smartcity';
import { useTigerGraph } from '../hooks/useTigerGraph';

const ZONE_TYPE_META = {
  safe_haven: { icon: '🛡', color: 'var(--accent)' },
  police_station: { icon: '🚔', color: 'var(--amber)' },
  hospital: { icon: '🏥', color: '#f87171' },
};

function OccupancyBar({ current, max, color }) {
  const pct = max > 0 ? Math.min((current / max) * 100, 100) : 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
      <div style={{ flex: 1, height: '4px', background: 'var(--border)', borderRadius: '2px' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: '2px', transition: 'width 0.5s' }} />
      </div>
      <span style={{ fontSize: '10px', color, minWidth: '28px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
        {current}/{max}
      </span>
    </div>
  );
}

export default function OfficerDashboard() {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();
  const { intersections, incidents, safeRoute, selectedIntersection } = useTigerGraph();
  const [activeTasks, setActiveTasks] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [patrolZones, setPatrolZones] = useState([]);
  const [engaging, setEngaging] = useState(null);
  const [activeTab, setActiveTab] = useState('threats'); // 'threats' | 'zones'

  useEffect(() => {
    if (token) {
      getActiveIncidents(token)
        .then(res => setActiveTasks(Array.isArray(res) ? res : []))
        .catch(err => console.error("Error loading tasks:", err));

      getAssignments(token)
        .then(res => setAssignments(Array.isArray(res) ? res : []))
        .catch(err => console.error("Error loading assignments:", err));

      getPatrolSafeZones(token)
        .then(res => setPatrolZones(Array.isArray(res) ? res : []))
        .catch(err => console.warn("Patrol safe zones unavailable:", err));
    }
  }, [token]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleEnroute = async (id) => {
    setEngaging(id);
    try {
      await respondToIncident(id, { action: 'ENROUTE', officer_note: 'Unit dispatched from mobile terminal.' }, token);
      setActiveTasks(prev => prev.map(t => t.incident_id === id ? { ...t, _dispatched: true } : t));
    } catch (err) {
      console.error("Failed to respond:", err);
      alert("Comms Failure: Could not broadcast en-route status.");
    } finally {
      setEngaging(null);
    }
  };

  return (
    <div className="layout rbac-layout">
      <header className="site-header" style={{ borderBottomColor: 'var(--danger)' }}>
        <div className="flex-row">
          <div className="logo cursor-pointer" onClick={() => navigate('/')}>
            SMARTCITY<span className="dot" style={{ color: 'var(--danger)' }}>.</span>
            <span className="text-sm ml-2" style={{ color: 'var(--danger)' }}>RAPID RESPONSE UNIT</span>
          </div>
        </div>
        <div className="nav-links flex-row gap-4">
          <span className="text-sm font-mono text-danger">UNIT: {user?.email}</span>
          {/* Quick stats in header */}
          <span className="text-[10px] font-mono text-gray-400 hidden sm:block">
            ACTIVE: <span className="text-danger font-bold">{activeTasks.length}</span>
          </span>
          <button onClick={handleLogout} className="btn-secondary btn-sm" style={{ padding: '4px 8px', color: 'var(--danger)', borderColor: 'var(--danger)' }}>
            STAND DOWN
          </button>
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

      <div className="overlay-panel side-panel" style={{ left: '20px', top: '80px', bottom: '20px', width: '320px', borderColor: 'var(--danger)' }}>
        <h2 className="panel-title mb-3" style={{ color: 'var(--danger)' }}>TACTICAL OPS</h2>

        {/* Priority Assignments — /patrol/assignments */}
        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Priority Assignments</h3>
        <div className="flex-col gap-2 mb-4">
          {assignments.length === 0 && (
            <div className="text-xs text-gray-500 italic">No active assignments.</div>
          )}
          {assignments.map(a => (
            <div key={a.zone_id} className="p-3 border border-border rounded bg-bg-panel/50 border-l-4"
              style={{ borderLeftColor: a.priority === 'HIGH' ? 'var(--danger)' : 'var(--amber)' }}>
              <div className="flex-row justify-between mb-1">
                <div className="text-[10px] font-bold text-gray-400">ZONE: {a.cluster_name}</div>
                <span className="text-[10px] font-bold px-1 rounded" style={{ background: a.priority === 'HIGH' ? 'rgba(255,51,68,0.15)' : 'rgba(245,158,11,0.15)', color: a.priority === 'HIGH' ? 'var(--danger)' : 'var(--amber)' }}>
                  {a.priority}
                </span>
              </div>
              <div className="text-xs text-white mb-1">{a.reason}</div>
              <div className="text-[10px] text-accent font-mono">SECTORS: {a.intersections_to_check?.join(', ')}</div>
              <div className="text-[10px] text-gray-500 mt-1">⏱ {a.start_time} – {a.end_time}</div>
            </div>
          ))}
        </div>

        {/* Tab row */}
        <div className="flex-row gap-2 mb-3">
          {[['threats', '🎯 Active Threats'], ['zones', '🛡 Safe Zones']].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className="flex-1 btn-sm text-[10px] uppercase tracking-widest transition"
              style={{
                background: activeTab === key ? 'rgba(255,51,68,0.1)' : 'transparent',
                border: `1px solid ${activeTab === key ? 'var(--danger)' : 'var(--border)'}`,
                color: activeTab === key ? 'var(--danger)' : 'var(--text-secondary)',
                padding: '5px 0',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Active Threats — /patrol/active-incidents */}
        {activeTab === 'threats' && (
          <div className="flex-col gap-2 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 420px)' }}>
            {activeTasks.length === 0 ? (
              <div className="text-gray-400 text-sm italic py-4 text-center">All clear. Patrol active.</div>
            ) : activeTasks.map(task => (
              <div key={task.incident_id} className="p-3 border border-danger/30 rounded bg-danger/5">
                <div className="flex-row justify-between mb-1">
                  <span className="text-xs text-danger font-bold">{task.incident_id}</span>
                  <span className="text-[10px] font-mono text-gray-400">LVL:{task.severity}</span>
                </div>
                <div className="text-sm mb-2 text-white font-medium">{task.incident_type?.replace?.('_', ' ').toUpperCase()}</div>
                {task.intersection_name && (
                  <div className="text-[10px] text-gray-400 mb-1 font-mono">📍 {task.intersection_name}</div>
                )}
                <div className="flex-row justify-between items-center mt-2">
                  <div className="text-[10px] text-gray-400 font-mono">
                    {task.lat?.toFixed(3)} / {task.lng?.toFixed(3)}
                  </div>
                  <button
                    className="btn-sm px-3 py-1 font-bold transition"
                    style={{
                      background: task._dispatched ? 'var(--safe)' : 'var(--danger)',
                      color: '#fff',
                      border: 'none',
                    }}
                    onClick={() => handleEnroute(task.incident_id)}
                    disabled={engaging === task.incident_id || task._dispatched}
                  >
                    {task._dispatched ? '✔ EN ROUTE' : engaging === task.incident_id ? 'ENGAGING...' : 'ENGAGE'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Patrol Safe Zones — /patrol/safe-zones */}
        {activeTab === 'zones' && (
          <div className="flex-col gap-2 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 420px)' }}>
            {patrolZones.length === 0 ? (
              <div className="text-gray-500 text-sm italic py-4">Loading patrol zones...</div>
            ) : patrolZones.map((zone, i) => {
              const meta = ZONE_TYPE_META[zone.type] || { icon: '📍', color: 'var(--border)' };
              return (
                <div key={i} className="p-3 rounded" style={{ border: `1px solid ${meta.color}30` }}>
                  <div className="flex-row justify-between items-center mb-1">
                    <div className="flex-row gap-2 items-center">
                      <span>{meta.icon}</span>
                      <span className="text-xs font-mono text-white">{zone.name}</span>
                    </div>
                    <span className={`text-[10px] font-bold px-1.5 rounded`} style={{ background: `${meta.color}20`, color: meta.color }}>
                      {zone.is_open_now ? 'OPEN' : 'CLOSED'}
                    </span>
                  </div>
                  {zone.contact_number && (
                    <div className="text-[10px] text-gray-400 mb-1">
                      📞 <a href={`tel:${zone.contact_number}`} style={{ color: meta.color }}>{zone.contact_number}</a>
                    </div>
                  )}
                  {zone.capacity && (
                    <>
                      <div className="text-[10px] text-gray-500 mt-1">Occupancy</div>
                      <OccupancyBar current={zone.current_occupancy ?? 0} max={zone.capacity} color={meta.color} />
                    </>
                  )}
                  <div className="text-[10px] text-gray-500 mt-2">Closes: {zone.closing_time}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
