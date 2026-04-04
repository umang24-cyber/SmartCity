import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Explorer from '../components/Explorer';
import { useTigerGraph } from '../hooks/useTigerGraph';
import { postSOS, fetchSafeZones, fetchSosContacts } from '../api/smartcity';
import SafeRoutePanel from '../components/SafeRoutePanel';
import ModeSlider from '../components/ModeSlider';
import OrayaLogo from '../components/OrayaLogo';

export default function PublicCitizenPortal() {
  const navigate = useNavigate();
  const { intersections, incidents, safeRoute, selectedIntersection, routeStart, setRouteStart, routeEnd, setRouteEnd } = useTigerGraph();
  
  const [sosStatus, setSosStatus] = useState('IDLE');
  const [safeZones, setSafeZones] = useState([]);
  const [contacts, setContacts] = useState(null);

  useEffect(() => {
    // Fetch safety context
    fetchSafeZones().then(res => setSafeZones(res)).catch(e => console.warn(e));
    fetchSosContacts().then(res => setContacts(res)).catch(e => console.warn(e));
  }, []);

  const handleSOS = async () => {
    setSosStatus('SENDING');
    try {
      const lat = 12.9716;
      const lng = 77.5946;
      await postSOS(lat, lng, "EMERGENCY SOS via Public Portal");
      setSosStatus('SENT');
      alert("SOS ALERT SENT. HELP IS ON THE WAY.");
      setTimeout(() => setSosStatus('IDLE'), 5000);
    } catch (err) {
      console.error("SOS failed:", err);
      setSosStatus('ERROR');
      setTimeout(() => setSosStatus('IDLE'), 3000);
    }
  };

  return (
    <div style={{ height: '100vh', width: '100vw', display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)' }}>
      {/* Header */}
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '1rem 2rem', borderBottom: '1px solid var(--accent)',
        background: 'var(--bg-panel)'
      }}>
        <OrayaLogo 
          variant="full" 
          status="active" 
          subtitle={
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', letterSpacing: '0.1em' }}>SAFETY PORTAL</span>
              <span style={{ fontSize: '0.6rem', color: 'var(--accent)', background: 'rgba(0, 255, 136, 0.1)', padding: '2px 6px', borderRadius: '4px', fontFamily: 'var(--font-mono)' }}>PUBLIC ACCESS</span>
            </div>
          }
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
          <div style={{ width: '150px' }}>
            <ModeSlider />
          </div>
          <button 
            onClick={() => navigate('/')} 
            style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', padding: '0.4rem 1rem', background: 'transparent', border: '1px solid var(--accent)', color: 'var(--accent)', cursor: 'pointer' }}
          >
            LOGOUT
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div style={{ flex: 1, display: 'flex', gap: '1rem', padding: '1rem', overflow: 'hidden' }}>
        
        {/* Left Panel: Actions */}
        <div style={{ width: '350px', display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto' }}>
          
          {/* SOS Section */}
          <div className="panel" style={{ 
            padding: '1.5rem', 
            border: '2px solid var(--red-alert)', 
            background: 'rgba(255, 51, 68, 0.1)', 
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            marginBottom: '0.5rem',
            flexShrink: 0
          }}>
            <h2 style={{ fontFamily: 'var(--font-display)', color: 'var(--red-alert)', margin: 0 }}>EMERGENCY OVERRIDE</h2>
            <button 
              onClick={handleSOS}
              disabled={sosStatus === 'SENDING'}
              style={{
                width: '100%', 
                minHeight: '60px', 
                background: 'var(--red-alert)', 
                color: '#fff',
                fontFamily: 'var(--font-display)', 
                fontSize: '1.25rem', 
                border: 'none', 
                borderRadius: '4px',
                cursor: sosStatus === 'SENDING' ? 'wait' : 'pointer',
                boxShadow: '0 0 20px rgba(255, 51, 68, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              {sosStatus === 'SENDING' ? 'BROADCASTING...' : sosStatus === 'SENT' ? 'HELP EN ROUTE' : 'ACTIVATE SOS'}
            </button>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '1rem' }}>
              Instantly broadcast your location to rapid response units.
            </p>
          </div>

          {/* Contacts Section */}
          {contacts && (
            <div className="panel" style={{ padding: '1rem' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.9rem', color: 'var(--accent)', marginBottom: '0.5rem' }}>EMERGENCY CONTACTS</div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--text-primary)' }}>
                 <li style={{ marginBottom: '8px' }}>Global Emergency: <strong style={{ color: 'var(--danger)' }}>{contacts.emergency}</strong></li>
                 <li style={{ marginBottom: '8px' }}>Women Helpline: <strong style={{ color: 'var(--danger)' }}>{contacts.women_helpline}</strong></li>
                 {contacts.nearest_police_box && (
                   <li style={{ marginTop: '12px', borderTop: '1px solid var(--border)', paddingTop: '8px' }}>
                     Nearest Police: <br/>
                     <span style={{ color: 'var(--accent)'}}>{contacts.nearest_police_box.name} ({contacts.nearest_police_box.distance_m}m)</span>
                   </li>
                 )}
              </ul>
            </div>
          )}

          {/* Routing Section */}
          <div className="panel" style={{ padding: '1rem', flexShrink: 0 }}>
            <SafeRoutePanel 
              safeRoute={safeRoute} 
              intersections={intersections}
              routeStart={routeStart}
              setRouteStart={setRouteStart}
              routeEnd={routeEnd}
              setRouteEnd={setRouteEnd}
            />
          </div>
        </div>

        {/* Right Panel: Map */}
        <div style={{ flex: 1, position: 'relative', borderRadius: '4px', overflow: 'hidden', border: '1px solid var(--border)' }}>
          <Explorer 
            intersections={intersections}
            incidents={incidents}
            safeRoute={safeRoute}
            safeZones={safeZones}
            selectedIntersection={selectedIntersection}
          />
        </div>

      </div>
    </div>
  );
}
