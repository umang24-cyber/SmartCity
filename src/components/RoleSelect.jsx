/**
 * RoleSelect.jsx
 * ─────────────
 * NEW entry dashboard — Admin vs User portal selector.
 * Does NOT touch any existing component or routing logic.
 * Matches the existing "Submarine Command Terminal" design system exactly.
 */

import React, { useState, useEffect } from 'react';

const SCAN_LINES = [
  '> ORAYA COMMAND SYSTEM v4.2.1',
  '> AUTHENTICATING OPERATOR SESSION...',
  '> SELECT ACCESS TIER TO CONTINUE',
];

export default function RoleSelect({ onSelect }) {
  const [lines, setLines] = useState([]);
  const [ready, setReady] = useState(false);
  const [hovered, setHovered] = useState(null);
  const [selected, setSelected] = useState(null);

  // Boot-text typewriter effect
  useEffect(() => {
    let i = 0;
    const iv = setInterval(() => {
      if (i < SCAN_LINES.length) {
        setLines(prev => [...prev, SCAN_LINES[i]]);
        i++;
      } else {
        clearInterval(iv);
        setTimeout(() => setReady(true), 200);
      }
    }, 420);
    return () => clearInterval(iv);
  }, []);

  function handleSelect(role) {
    setSelected(role);
    setTimeout(() => onSelect(role), 500);
  }

  const PORTALS = [
    {
      id: 'user',
      icon: '◉',
      label: 'USER PORTAL',
      sub: 'CITIZEN SAFETY INTERFACE',
      desc: 'Submit incidents · Request safe routes · SOS alerts',
      color: 'var(--accent)',
      rgb: 'var(--accent-rgb)',
    },
    {
      id: 'admin',
      icon: '⬡',
      label: 'ADMIN PORTAL',
      sub: 'OPERATOR COMMAND CENTRE',
      desc: 'Manage incidents · View analytics · Configure AI models',
      color: 'var(--amber)',
      rgb: '255, 170, 0',
    },
  ];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--bg-primary)',
        backgroundImage: `
          radial-gradient(ellipse 80% 60% at 50% -10%, rgba(var(--accent-rgb),0.07) 0%, transparent 60%),
          linear-gradient(180deg, rgba(var(--accent-rgb),0.02) 0%, transparent 40%)
        `,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'var(--font-mono)',
        overflow: 'hidden',
        opacity: selected ? 0 : 1,
        transition: 'opacity 0.45s ease',
      }}
    >
      {/* Sonar rings */}
      <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', pointerEvents: 'none' }}>
        {[80, 160, 260, 380].map((s, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              width: s, height: s,
              marginLeft: -s / 2, marginTop: -s / 2,
              borderRadius: '50%',
              border: '1px solid var(--border)',
              animation: `sonar-ring 4s ease-out ${i * 1}s infinite`,
              opacity: 0.4,
            }}
          />
        ))}
      </div>

      {/* Corner brackets */}
      {['top-left', 'top-right', 'bottom-left', 'bottom-right'].map(pos => (
        <div
          key={pos}
          style={{
            position: 'absolute',
            [pos.includes('top') ? 'top' : 'bottom']: 24,
            [pos.includes('left') ? 'left' : 'right']: 24,
            width: 28, height: 28,
            borderTop: pos.includes('top') ? '2px solid var(--border-bright)' : 'none',
            borderBottom: pos.includes('bottom') ? '2px solid var(--border-bright)' : 'none',
            borderLeft: pos.includes('left') ? '2px solid var(--border-bright)' : 'none',
            borderRight: pos.includes('right') ? '2px solid var(--border-bright)' : 'none',
            opacity: 0.6,
          }}
        />
      ))}

      {/* Main content container */}
      <div style={{ position: 'relative', zIndex: 10, width: '100%', maxWidth: 620, padding: '0 2rem' }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <div style={{
            fontFamily: 'var(--font-display)',
            fontSize: '2.4rem',
            fontWeight: 900,
            color: 'var(--accent)',
            letterSpacing: '0.4em',
            textShadow: '0 0 30px var(--accent-glow), 0 0 60px rgba(var(--accent-rgb),0.2)',
            animation: 'pulse-green 3s ease-in-out infinite',
          }}>
            ORAYA
          </div>
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.62rem',
            color: 'var(--text-secondary)',
            letterSpacing: '0.55em',
            marginTop: '0.3rem',
            textTransform: 'uppercase',
          }}>
            SMART CITY COMMAND SYSTEM
          </div>
          <div style={{
            width: 64,
            height: 1,
            background: 'linear-gradient(90deg, transparent, var(--accent), transparent)',
            margin: '0.75rem auto 0',
          }} />
        </div>

        {/* Boot log */}
        <div style={{
          background: 'rgba(var(--accent-rgb), 0.03)',
          border: '1px solid var(--border)',
          padding: '0.85rem 1.1rem',
          marginBottom: '2rem',
          minHeight: 72,
        }}>
          {lines.map((line, i) => (
            <div key={i} style={{
              fontSize: '0.68rem',
              color: i === lines.length - 1 ? 'var(--accent)' : 'var(--text-secondary)',
              lineHeight: 1.9,
              letterSpacing: '0.06em',
            }}>
              {line}
              {i === lines.length - 1 && !ready && (
                <span className="blink" style={{ marginLeft: 4, color: 'var(--accent)' }}>█</span>
              )}
            </div>
          ))}
        </div>

        {/* Section label */}
        <div style={{
          fontFamily: 'var(--font-display)',
          fontSize: '0.62rem',
          color: 'var(--text-secondary)',
          letterSpacing: '0.25em',
          marginBottom: '1rem',
          opacity: ready ? 1 : 0,
          transform: ready ? 'translateY(0)' : 'translateY(6px)',
          transition: 'all 0.4s ease',
        }}>
          ⬡ SELECT ACCESS LEVEL
        </div>

        {/* Portal selection cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '1rem',
          opacity: ready ? 1 : 0,
          transform: ready ? 'translateY(0)' : 'translateY(10px)',
          transition: 'all 0.45s ease 0.1s',
        }}>
          {PORTALS.map(p => {
            const isHovered = hovered === p.id;
            return (
              <button
                key={p.id}
                id={`role-select-${p.id}`}
                onClick={() => handleSelect(p.id)}
                onMouseEnter={() => setHovered(p.id)}
                onMouseLeave={() => setHovered(null)}
                style={{
                  background: isHovered
                    ? `rgba(${p.rgb}, 0.08)`
                    : 'rgba(var(--accent-rgb), 0.02)',
                  border: `1px solid ${isHovered ? p.color : 'var(--border)'}`,
                  borderLeft: `3px solid ${isHovered ? p.color : 'rgba(var(--accent-rgb), 0.2)'}`,
                  padding: '1.4rem 1.2rem',
                  cursor: 'none',
                  textAlign: 'left',
                  transition: 'all 0.2s ease',
                  boxShadow: isHovered ? `0 0 24px rgba(${p.rgb}, 0.12), inset 0 0 16px rgba(${p.rgb}, 0.04)` : 'none',
                  transform: isHovered ? 'translateY(-2px)' : 'translateY(0)',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                {/* Active indicator corner */}
                {isHovered && (
                  <div style={{
                    position: 'absolute',
                    top: 0, right: 0,
                    borderTop: `12px solid ${p.color}`,
                    borderLeft: '12px solid transparent',
                    opacity: 0.5,
                  }} />
                )}

                {/* Icon */}
                <div style={{
                  fontSize: '1.5rem',
                  color: p.color,
                  marginBottom: '0.6rem',
                  textShadow: isHovered ? `0 0 12px ${p.color}` : 'none',
                  transition: 'text-shadow 0.2s',
                }}>
                  {p.icon}
                </div>

                {/* Label */}
                <div style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  color: p.color,
                  letterSpacing: '0.18em',
                  marginBottom: '0.2rem',
                }}>
                  {p.label}
                </div>

                {/* Sub */}
                <div style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.58rem',
                  color: 'var(--text-secondary)',
                  letterSpacing: '0.14em',
                  marginBottom: '0.75rem',
                  textTransform: 'uppercase',
                }}>
                  {p.sub}
                </div>

                {/* Divider */}
                <div style={{
                  height: 1,
                  background: isHovered ? `rgba(${p.rgb}, 0.3)` : 'var(--border)',
                  marginBottom: '0.7rem',
                  transition: 'background 0.2s',
                }} />

                {/* Description */}
                <div style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.63rem',
                  color: isHovered ? 'var(--text-primary)' : 'var(--text-secondary)',
                  lineHeight: 1.7,
                  letterSpacing: '0.04em',
                  transition: 'color 0.2s',
                }}>
                  {p.desc}
                </div>

                {/* Hover arrow */}
                <div style={{
                  position: 'absolute',
                  bottom: '1rem',
                  right: '1rem',
                  fontFamily: 'var(--font-display)',
                  fontSize: '0.65rem',
                  color: p.color,
                  opacity: isHovered ? 1 : 0,
                  transform: isHovered ? 'translateX(0)' : 'translateX(-4px)',
                  transition: 'all 0.2s ease',
                }}>
                  ENTER →
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer status bar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: '1.5rem',
          opacity: ready ? 0.6 : 0,
          transition: 'opacity 0.5s ease 0.3s',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{
              width: 6, height: 6,
              borderRadius: '50%',
              background: 'var(--accent)',
              boxShadow: '0 0 6px var(--accent)',
              animation: 'pulse-green 2s ease-in-out infinite',
            }} />
            <span style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', letterSpacing: '0.1em' }}>
              SYSTEMS NOMINAL
            </span>
          </div>
          <span style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', letterSpacing: '0.1em' }}>
            ORAYA v4.2.1 · SECURE CHANNEL
          </span>
        </div>
      </div>
    </div>
  );
}
