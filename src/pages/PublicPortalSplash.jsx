import React from 'react';
import { useNavigate } from 'react-router-dom';
import CustomCursor from '../components/CustomCursor';
import OrayaLogo from '../components/OrayaLogo';

export default function PublicPortalSplash() {
  const navigate = useNavigate();

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      background: 'var(--bg-primary)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      overflow: 'hidden'
    }}>
      <CustomCursor />
      <div className="hex-bg" />
      <div className="scanlines" />
      <div className="vignette" />

      <div style={{ position: 'relative', zIndex: 10, display: 'flex', justifyContent: 'center', marginBottom: '4rem' }}>
        <OrayaLogo 
          variant="splash" 
          status="active" 
          subtitle={
            <div style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.8rem',
              color: 'var(--accent)',
              letterSpacing: '0.3em',
            }}>
              INITIALIZING CONNECTION PORTAL
            </div>
          } 
        />
      </div>

      <div style={{ display: 'flex', gap: '2rem', position: 'relative', zIndex: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
        
        {/* Citizen Portal Box */}
        <button 
          onClick={() => navigate('/citizen-portal')}
          className="portal-box"
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            width: '320px',
            height: '220px',
            background: 'var(--bg-panel)',
            border: '2px solid var(--accent)',
            boxShadow: '0 0 15px rgba(0, 255, 136, 0.2)',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            position: 'relative',
            overflow: 'hidden'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.05)';
            e.currentTarget.style.boxShadow = '0 0 30px rgba(0, 255, 136, 0.5)';
            e.currentTarget.style.background = 'rgba(0, 255, 136, 0.1)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.boxShadow = '0 0 15px rgba(0, 255, 136, 0.2)';
            e.currentTarget.style.background = 'var(--bg-panel)';
          }}
        >
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', color: 'var(--accent)', letterSpacing: '0.15em', marginBottom: '1rem' }}>
            [ CITIZEN EMERGENCY ]
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-secondary)', textAlign: 'center', padding: '0 2rem' }}>
            Access public safety maps, safe havens, and emergency SOS dispatch.
          </div>
        </button>

        {/* Admin Portal Box */}
        <button 
          onClick={() => navigate('/login')}
          className="portal-box"
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            width: '320px',
            height: '220px',
            background: 'var(--bg-panel)',
            border: '2px solid var(--red-alert)',
            boxShadow: '0 0 15px rgba(255, 51, 68, 0.2)',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            position: 'relative',
            overflow: 'hidden'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.05)';
            e.currentTarget.style.boxShadow = '0 0 30px rgba(255, 51, 68, 0.5)';
            e.currentTarget.style.background = 'rgba(255, 51, 68, 0.1)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.boxShadow = '0 0 15px rgba(255, 51, 68, 0.2)';
            e.currentTarget.style.background = 'var(--bg-panel)';
          }}
        >
           <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', color: 'var(--red-alert)', letterSpacing: '0.15em', marginBottom: '1rem' }}>
            [ ADMIN & POLICE ]
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-secondary)', textAlign: 'center', padding: '0 2rem' }}>
            Restricted access portal for Command Center operators and rapid response units.
          </div>
        </button>

      </div>
    </div>
  );
}
