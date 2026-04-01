import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import Explorer from '../components/Explorer';
import { useTigerGraph } from '../hooks/useTigerGraph';
import { apiFetch, apiPost } from '../api/smartcity';

export default function CitizenDashboard() {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();
  const { intersections, incidents, safeRoute, selectedIntersection } = useTigerGraph();
  const [myReports, setMyReports] = useState([]);
  const [sosStatus, setSosStatus] = useState('IDLE');

  useEffect(() => {
    if (token) {
      apiFetch('/my-reports', token)
        .then(res => setMyReports(res))
        .catch(err => console.error("Failed to fetch my reports:", err));
    }
  }, [token]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleSOS = async () => {
    setSosStatus('SENDING');
    try {
      // Mock coordinates for SOS if no geolocation
      const lat = 12.9716;
      const lng = 77.5946;
      await apiPost('/sos-alert', { lat, lng, message: "EMERGENCY SOS" }, token);
      setSosStatus('SENT');
      alert("SOS ALERT SENT. HELP IS ON THE WAY.");
      setTimeout(() => setSosStatus('IDLE'), 5000);
    } catch (err) {
      console.error("SOS failed:", err);
      setSosStatus('ERROR');
    }
  };

  return (
    <div className="layout rbac-layout">
      <header className="site-header">
        <div className="flex-row">
          <div className="logo cursor-pointer" onClick={() => navigate('/')}>SMARTCITY<span className="dot">.</span> <span className="text-sm text-cyan ml-2">USER SAFETY PORTAL</span></div>
        </div>
        <div className="nav-links flex-row gap-4">
          <span className="text-sm font-mono text-cyan">ID: {user?.email}</span>
          <button onClick={handleLogout} className="btn-secondary btn-sm" style={{ padding: '4px 8px' }}>DISCONNECT</button>
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

      <div className="overlay-panel side-panel" style={{ left: '20px', top: '80px', bottom: '20px', width: '320px' }}>
        <h2 className="panel-title text-cyan mb-4">MY SAFETY OPS</h2>
        
        <div className="mb-6 p-4 border border-danger/30 rounded bg-danger/5">
          <h3 className="text-sm font-bold text-danger mb-2">EMERGENCY SOS</h3>
          <p className="text-xs text-gray-400 mb-3">One-tap priority alert to nearest rapid response unit.</p>
          <button 
            onClick={handleSOS}
            disabled={sosStatus === 'SENDING'}
            className="w-full btn-sm bg-danger text-white py-3 font-bold hover:scale-105 transition"
          >
            {sosStatus === 'SENDING' ? 'BROADCASTING...' : sosStatus === 'SENT' ? 'HELP ON WAY' : 'ACTIVATE SOS'}
          </button>
        </div>

        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">My Reports</h3>
        <div className="flex-col gap-2 overflow-y-auto" style={{ maxHeight: '400px' }}>
          {myReports.length === 0 ? (
            <div className="text-gray-500 text-sm italic py-4">No active reports. You are in a safe zone.</div>
          ) : myReports.map(rep => (
            <div key={rep.incident_id} className="p-3 border border-border rounded bg-bg-panel/50">
              <div className="flex-row justify-between mb-1">
                <span className="text-xs font-mono text-accent">{rep.incident_id}</span>
                <span className={`text-[10px] font-bold px-1.5 rounded ${rep.verified ? 'bg-safe/20 text-safe' : 'bg-amber/20 text-amber'}`}>
                  {rep.verified ? 'VERIFIED' : 'PENDING'}
                </span>
              </div>
              <div className="text-sm text-white mb-1">{rep.incident_type.toUpperCase()}</div>
              <div className="text-[10px] text-gray-500">{new Date(rep.timestamp).toLocaleString()}</div>
            </div>
          ))}
        </div>

        <div className="mt-auto pt-6 border-t border-border">
          <div className="text-xs text-gray-400 mb-4 bg-accent/5 p-3 rounded italic border-l-2 border-accent">
            AI Insight: "{incidents.length > 5 ? 'High incident density detected in Central Zone.' : 'Local patrols are active and nearby.'}"
          </div>
          <button className="w-full btn-primary btn-sm py-2" onClick={() => navigate('/')}>RETURN TO MAP EXPLORER</button>
        </div>
      </div>
    </div>
  );
}

