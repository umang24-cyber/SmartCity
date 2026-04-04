import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import Explorer from '../components/Explorer';
import { useTigerGraph } from '../hooks/useTigerGraph';
import { apiFetch, apiPost, fetchSafeZones, fetchSosContacts } from '../api/smartcity';
import ModeSlider from '../components/ModeSlider';
import OrayaLogo from '../components/OrayaLogo';

const ZONE_ICONS = {
  safe_haven: '🛡',
  police_station: '🚔',
  hospital: '🏥',
};

const ZONE_COLORS = {
  safe_haven: 'var(--accent)',
  police_station: 'var(--amber)',
  hospital: '#f87171',
};

export default function CitizenDashboard() {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();
  const { intersections, incidents, safeRoute, selectedIntersection } = useTigerGraph();
  const [myReports, setMyReports] = useState([]);
  const [sosStatus, setSosStatus] = useState('IDLE');
  const [safeZones, setSafeZones] = useState([]);
  const [contacts, setContacts] = useState(null);
  const [activeTab, setActiveTab] = useState('reports'); // 'reports' | 'safezones'

  useEffect(() => {
    if (token) {
      apiFetch('/citizen/my-reports', token)
        .then(res => setMyReports(Array.isArray(res) ? res : []))
        .catch(err => console.error("Failed to fetch my reports:", err));

      fetchSafeZones()
        .then(res => setSafeZones(Array.isArray(res) ? res : []))
        .catch(err => console.warn("Safe zones unavailable:", err));

      fetchSosContacts()
        .then(res => setContacts(res))
        .catch(err => console.warn("SOS contacts unavailable:", err));
    }
  }, [token]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleSOS = async () => {
    setSosStatus('SENDING');
    try {
      let lat = 30.7333, lng = 76.7794; // Chandigarh fallback
      if (navigator.geolocation) {
        await new Promise((resolve) => {
          navigator.geolocation.getCurrentPosition(
            pos => { lat = pos.coords.latitude; lng = pos.coords.longitude; resolve(); },
            () => resolve(),
            { timeout: 3000 }
          );
        });
      }
      await apiPost('/citizen/sos-alert', { lat, lng, message: "EMERGENCY SOS" }, token);
      setSosStatus('SENT');
      setTimeout(() => setSosStatus('IDLE'), 6000);
    } catch (err) {
      console.error("SOS failed:", err);
      setSosStatus('ERROR');
      setTimeout(() => setSosStatus('IDLE'), 3000);
    }
  };

  const sosColors = {
    IDLE: { bg: 'var(--danger)', shadow: '0 0 24px rgba(255,51,68,0.5)', label: '🚨 ACTIVATE SOS' },
    SENDING: { bg: '#b91c1c', shadow: 'none', label: '📡 BROADCASTING...' },
    SENT: { bg: 'var(--safe)', shadow: '0 0 16px rgba(0,255,136,0.3)', label: '✔ HELP EN ROUTE' },
    ERROR: { bg: 'var(--amber)', shadow: 'none', label: '⚠ RETRY SOS' },
  };
  const sos = sosColors[sosStatus];

  return (
    <div className="layout rbac-layout">
      <header className="site-header">
        <div className="flex-row gap-3 items-center">
          <OrayaLogo variant="full" status="active" subtitle={
            <span style={{ fontSize: '0.65rem', color: 'var(--accent)', fontFamily: 'var(--font-mono)', letterSpacing: '0.12em' }}>USER SAFETY PORTAL</span>
          } />
        </div>
        <div className="nav-links flex-row gap-4 items-center">
          <div style={{ width: '140px' }}><ModeSlider /></div>
          <span className="text-sm font-mono text-cyan">ID: {user?.email}</span>
          <button onClick={handleLogout} className="btn-secondary btn-sm" style={{ padding: '4px 8px' }}>DISCONNECT</button>
        </div>
      </header>

      <div className="map-container">
        <Explorer
          intersections={intersections}
          incidents={incidents}
          safeRoute={safeRoute}
          safeZones={safeZones}
          selectedIntersection={selectedIntersection}
        />
      </div>

      <div className="overlay-panel side-panel" style={{ left: '20px', top: '80px', bottom: '20px', width: '320px' }}>
        <h2 className="panel-title text-cyan mb-4">MY SAFETY OPS</h2>

        {/* Emergency SOS */}
        <div className="mb-4 p-4 rounded" style={{ border: '2px solid var(--danger)', background: 'rgba(255,51,68,0.07)', textAlign: 'center' }}>
          <h3 className="text-sm font-bold text-danger mb-1">EMERGENCY SOS</h3>
          <p className="text-xs text-gray-400 mb-3">One-tap priority alert to nearest rapid response unit.</p>
          <button
            onClick={handleSOS}
            disabled={sosStatus === 'SENDING'}
            style={{
              width: '100%',
              padding: '14px 0',
              background: sos.bg,
              boxShadow: sos.shadow,
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              fontFamily: 'var(--font-display)',
              fontSize: '1rem',
              letterSpacing: '0.15em',
              cursor: sosStatus === 'SENDING' ? 'wait' : 'pointer',
              transition: 'box-shadow 0.3s, background 0.3s',
              animation: sosStatus === 'SENDING' ? 'pulse-red 1s infinite' : 'none',
            }}
          >
            {sos.label}
          </button>
        </div>

        {/* Emergency Contacts — from /citizen/sos-contacts */}
        {contacts && (
          <div className="mb-4 p-3 rounded" style={{ border: '1px solid var(--border)', background: 'var(--bg-panel)/50' }}>
            <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Emergency Contacts</div>
            <div className="flex-col gap-1">
              <div className="flex-row justify-between">
                <span className="text-xs text-gray-300">Global Emergency</span>
                <a href={`tel:${contacts.emergency}`} className="text-sm font-mono font-bold text-danger hover:underline">{contacts.emergency}</a>
              </div>
              <div className="flex-row justify-between">
                <span className="text-xs text-gray-300">Women Helpline</span>
                <a href={`tel:${contacts.women_helpline}`} className="text-sm font-mono font-bold text-danger hover:underline">{contacts.women_helpline}</a>
              </div>
              {contacts.nearest_police_box && (
                <div className="mt-2 pt-2" style={{ borderTop: '1px solid var(--border)' }}>
                  <div className="text-xs text-gray-400">Nearest Police</div>
                  <div className="text-xs text-cyan font-mono mt-1">
                    {contacts.nearest_police_box.name}
                  </div>
                  <div className="text-[10px] text-gray-500">{contacts.nearest_police_box.distance_m}m away</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab Toggle */}
        <div className="flex-row gap-2 mb-3">
          {['reports', 'safezones'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="flex-1 btn-sm text-[10px] uppercase tracking-widest transition"
              style={{
                background: activeTab === tab ? 'rgba(0,255,136,0.1)' : 'transparent',
                border: `1px solid ${activeTab === tab ? 'var(--accent)' : 'var(--border)'}`,
                color: activeTab === tab ? 'var(--accent)' : 'var(--text-secondary)',
                padding: '5px 0',
              }}
            >
              {tab === 'reports' ? '📋 My Reports' : '🛡 Safe Zones'}
            </button>
          ))}
        </div>

        {/* My Reports — /citizen/my-reports */}
        {activeTab === 'reports' && (
          <div className="flex-col gap-2 overflow-y-auto" style={{ maxHeight: '300px' }}>
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
                <div className="text-sm text-white mb-1">{rep.incident_type?.toUpperCase?.() ?? rep.incident_type}</div>
                <div className="text-[10px] text-gray-500">{new Date(rep.timestamp).toLocaleString()}</div>
              </div>
            ))}
          </div>
        )}

        {/* Safe Zones — /citizen/safe-zones */}
        {activeTab === 'safezones' && (
          <div className="flex-col gap-2 overflow-y-auto" style={{ maxHeight: '300px' }}>
            {safeZones.length === 0 ? (
              <div className="text-gray-500 text-sm italic py-4">Loading safe zones...</div>
            ) : safeZones.map((zone, i) => (
              <div key={i} className="p-3 rounded" style={{ border: `1px solid ${ZONE_COLORS[zone.type] || 'var(--border)'}30`, background: 'var(--bg-panel)/50' }}>
                <div className="flex-row justify-between mb-1">
                  <div className="flex-row gap-2 items-center">
                    <span>{ZONE_ICONS[zone.type] || '📍'}</span>
                    <span className="text-xs font-mono text-white">{zone.name}</span>
                  </div>
                  <span className={`text-[10px] font-bold px-1.5 rounded ${zone.is_open_now ? 'bg-safe/20 text-safe' : 'bg-gray-700 text-gray-400'}`}>
                    {zone.is_open_now ? 'OPEN' : 'CLOSED'}
                  </span>
                </div>
                <div className="text-[10px] text-gray-500">
                  Closes: {zone.closing_time} &nbsp;·&nbsp; {zone.lat?.toFixed(4)}, {zone.lng?.toFixed(4)}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-auto pt-4 border-t border-border">
          <div className="text-xs text-gray-400 mb-3 bg-accent/5 p-3 rounded italic border-l-2 border-accent">
            AI Insight: "{incidents.length > 5 ? 'High incident density detected in Central Zone.' : 'Local patrols are active and nearby.'}"
          </div>
          <button className="w-full btn-primary btn-sm py-2" onClick={() => navigate('/')}>RETURN TO MAP EXPLORER</button>
        </div>
      </div>
    </div>
  );
}
