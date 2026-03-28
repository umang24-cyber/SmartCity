import React, { useState, useEffect } from 'react';

const BOOT_LINES = [
  '> SMARTCITY COMMAND SYSTEM v4.2.1',
  '> INITIALIZING SONAR ARRAY...',
  '> LOADING SECTOR INTELLIGENCE...',
  '> CONNECTING TO SAFETY ENGINE...',
  '> CALIBRATING DANGER MATRIX...',
  '> SYNCING INCIDENT DATABASE...',
  '> ALL SYSTEMS NOMINAL',
  '> LAUNCHING COMMAND INTERFACE...',
];

export default function LoadingScreen({ onComplete }) {
  const [lines, setLines] = useState([]);
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let i = 0;
    const interval = setInterval(() => {
      if (i < BOOT_LINES.length) {
        setLines(prev => [...prev, BOOT_LINES[i]]);
        setProgress(Math.round(((i + 1) / BOOT_LINES.length) * 100));
        i++;
      } else {
        clearInterval(interval);
        setTimeout(() => {
          setDone(true);
          setTimeout(onComplete, 500);
        }, 300);
      }
    }, 380);
    return () => clearInterval(interval);
  }, [onComplete]);

  return (
    <div
      className="loading-screen"
      style={{
        opacity: done ? 0 : 1,
        transition: 'opacity 0.5s ease',
      }}
    >
      {/* Sonar rings */}
      <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)' }}>
        {[60, 120, 180, 240].map((size, i) => (
          <div
            key={i}
            className="sonar-ring"
            style={{
              width: size, height: size,
              marginLeft: -size / 2, marginTop: -size / 2,
              position: 'absolute',
              animationDelay: `${i * 0.75}s`,
              animationDuration: '3s',
            }}
          />
        ))}
      </div>

      {/* Content */}
      <div style={{ position: 'relative', zIndex: 10, width: '100%', maxWidth: 560, padding: '0 2rem' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <div style={{
            fontFamily: 'var(--font-display)',
            fontSize: '2.2rem',
            fontWeight: 900,
            color: 'var(--accent)',
            letterSpacing: '0.35em',
            textShadow: '0 0 30px var(--accent), 0 0 60px rgba(0,255,136,0.3)',
          }}>
            SMARTCITY
          </div>
          <div className="label-xs" style={{ marginTop: '0.25rem', letterSpacing: '0.5em' }}>
            COMMAND & CONTROL SYSTEM
          </div>
        </div>

        {/* Boot log */}
        <div style={{
          background: 'rgba(0,255,136,0.03)',
          border: '1px solid var(--border)',
          padding: '1rem 1.25rem',
          minHeight: 200,
          marginBottom: '1.5rem',
        }}>
          {lines.map((line, i) => (
            <div key={i} style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.72rem',
              color: i === lines.length - 1 ? 'var(--accent)' : 'var(--text-secondary)',
              lineHeight: 1.8,
              letterSpacing: '0.05em',
            }}>
              {line}
              {i === lines.length - 1 && !done && <span className="blink" style={{ marginLeft: 4, color: 'var(--accent)' }}>█</span>}
            </div>
          ))}
        </div>

        {/* Progress */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ flex: 1, background: 'rgba(0,255,136,0.08)', height: 2 }}>
            <div className="progress-bar-sub" style={{ width: `${progress}%` }} />
          </div>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--accent)', minWidth: 36 }}>
            {progress}%
          </span>
        </div>
      </div>
    </div>
  );
}
