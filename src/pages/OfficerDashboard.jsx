import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import Explorer from '../components/Explorer';
import { getActiveIncidents, respondToIncident, getAssignments } from '../api/smartcity';
import { useTigerGraph } from '../hooks/useTigerGraph';

export default function OfficerDashboard() {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();
  const { intersections, incidents, safeRoute, selectedIntersection } = useTigerGraph();
  const [activeTasks, setActiveTasks] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [engaging, setEngaging] = useState(null);

  useEffect(() => {
    if (token) {
      getActiveIncidents(token)
        .then(res => setActiveTasks(res))
        .catch(err => console.error("Error loading tasks:", err));
      
      getAssignments(token)
        .then(res => setAssignments(res))
        .catch(err => console.error("Error loading assignments:", err));
    }
  }, [token]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleEnroute = async (id) => {
    setEngaging(id);
    try {
      // payload matches RespondRequest in officer.py: { action, officer_note }
      await respondToIncident(id, { action: 'ENROUTE', officer_note: 'Unit dispatched from mobile terminal.' }, token);
      alert(`UNIT DISPATCHED TO ${id}. ROUTE UPLOADED.`);
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
          <div className="logo cursor-pointer" onClick={() => navigate('/')}>SMARTCITY<span className="dot" style={{color: 'var(--danger)'}}>.</span> <span className="text-sm ml-2" style={{color: 'var(--danger)'}}>RAPID RESPONSE UNIT</span></div>
        </div>
        <div className="nav-links flex-row gap-4">
          <span className="text-sm font-mono text-danger">UNIT: {user?.email}</span>
          <button onClick={handleLogout} className="btn-secondary btn-sm" style={{ padding: '4px 8px', color: 'var(--danger)', borderColor: 'var(--danger)' }}>STAND DOWN</button>
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
        <h2 className="panel-title mb-4" style={{color: 'var(--danger)'}}>TACTICAL OPS</h2>
        
        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Priority Assignments</h3>
        <div className="flex-col gap-2 mb-6">
          {assignments.map(a => (
            <div key={a.zone_id} className="p-3 border border-border rounded bg-bg-panel/50 border-l-4" style={{borderLeftColor: a.priority === 'HIGH' ? 'var(--danger)' : 'var(--amber)'}}>
              <div className="text-[10px] font-bold text-gray-400 mb-1">ZONE: {a.cluster_name}</div>
              <div className="text-xs text-white mb-2">{a.reason}</div>
              <div className="text-[10px] text-accent font-mono">SECTOR: {a.intersections_to_check.join(', ')}</div>
            </div>
          ))}
        </div>

        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Active Threats</h3>
        <div className="flex-col gap-2 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 400px)' }}>
          {activeTasks.length === 0 ? (
            <div className="text-gray-400 text-sm italic py-4 text-center">All clear. Patrol active.</div>
          ) : activeTasks.map(task => (
            <div key={task.incident_id} className="p-3 border border-danger/30 rounded bg-danger/5">
              <div className="flex-row justify-between mb-1">
                <span className="text-xs text-danger font-bold">{task.incident_id}</span>
                <span className="text-[10px] font-mono text-gray-400">LVL:{task.severity}</span>
              </div>
              <div className="text-sm mb-2 text-white font-medium">{task.incident_type.replace('_', ' ').toUpperCase()}</div>
              
              <div className="flex-row justify-between items-center mt-3">
                 <div className="text-[10px] text-gray-400 font-mono">LAT: {task.lat?.toFixed(3)} | LNG: {task.lng?.toFixed(3)}</div>
                 <button 
                  className="btn-sm bg-danger text-white px-4 py-1 hover:bg-white hover:text-danger transition font-bold" 
                  onClick={() => handleEnroute(task.incident_id)}
                  disabled={engaging === task.incident_id}
                 >
                   {engaging === task.incident_id ? 'ENGAGING...' : 'ENGAGE'}
                 </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

