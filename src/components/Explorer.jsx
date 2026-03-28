import React, { useState, useRef, useEffect } from 'react';

const RISK_COLORS = { low: '#00ff88', medium: '#ffaa00', high: '#ff3344' };

export default function Explorer({ nodes = [], edges = [], intersectionName = 'MG Road & Brigade Rd' }) {
  const [hoveredNode, setHoveredNode] = useState(null);
  const [sonarAngle, setSonarAngle] = useState(0);
  const rafRef = useRef(null);
  const lastTimeRef = useRef(null);

  useEffect(() => {
    const animate = (ts) => {
      if (lastTimeRef.current !== null) {
        const dt = ts - lastTimeRef.current;
        setSonarAngle(a => (a + dt * 0.04) % 360);
      }
      lastTimeRef.current = ts;
      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  // Center & scale nodes into a 380×280 viewport
  const W = 380, H = 280, cx = W / 2, cy = H / 2;

  return (
    <div className="panel panel-cut" style={{ padding: '1rem', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', flexShrink: 0 }}>
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.75rem', color: 'var(--accent)', letterSpacing: '0.15em' }}>
            NODE-EDGE SONAR
          </div>
          <div className="label-xs" style={{ marginTop: 2 }}>{intersectionName}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div className="led led-green pulse-green" />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--accent)' }}>LIVE FEED</span>
        </div>
      </div>

      {/* SVG canvas */}
      <div style={{ flex: 1, background: 'rgba(0,10,5,0.8)', border: '1px solid var(--border)', position: 'relative', overflow: 'hidden' }}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          style={{ width: '100%', height: '100%' }}
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            <filter id="node-glow">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <radialGradient id="sonar-bg" cx="50%" cy="50%">
              <stop offset="0%" stopColor="rgba(0,255,136,0.04)" />
              <stop offset="100%" stopColor="rgba(0,0,0,0)" />
            </radialGradient>
            {/* Sonar sweep gradient */}
            <linearGradient id="sweep-grad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="rgba(0,255,136,0)" />
              <stop offset="100%" stopColor="rgba(0,255,136,0.25)" />
            </linearGradient>
          </defs>

          {/* Background dot grid */}
          <pattern id="dot-grid" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="0.5" fill="rgba(0,255,136,0.12)" />
          </pattern>
          <rect width={W} height={H} fill="url(#dot-grid)" />

          {/* Sonar rings */}
          {[40, 80, 120].map((r, i) => (
            <circle key={i} cx={cx} cy={cy} r={r} fill="none"
              stroke="rgba(0,255,136,0.08)" strokeWidth="0.5"
              strokeDasharray="4 4"
            />
          ))}

          {/* Sonar sweep sector */}
          {(() => {
            const rad = sonarAngle * Math.PI / 180;
            const sweepRad = 70;
            // draw a sector arc
            const x1 = cx + sweepRad * Math.cos(rad);
            const y1 = cy + sweepRad * Math.sin(rad);
            const endAngle = rad - 0.8;
            const x2 = cx + sweepRad * Math.cos(endAngle);
            const y2 = cy + sweepRad * Math.sin(endAngle);
            return (
              <g>
                <line x1={cx} y1={cy} x2={x1} y2={y1} stroke="rgba(0,255,136,0.5)" strokeWidth="1" />
                <path
                  d={`M${cx},${cy} L${x1},${y1} A${sweepRad},${sweepRad} 0 0,0 ${x2},${y2} Z`}
                  fill="rgba(0,255,136,0.06)"
                />
              </g>
            );
          })()}

          {/* Edges */}
          {edges.map((edge, i) => {
            const s = nodes.find(n => n.id === edge.source);
            const t = nodes.find(n => n.id === edge.target);
            if (!s || !t) return null;
            return (
              <line key={i}
                x1={s.x} y1={s.y} x2={t.x} y2={t.y}
                stroke="rgba(0,255,136,0.2)" strokeWidth="1"
                strokeDasharray="5 3"
              />
            );
          })}

          {/* Nodes */}
          {nodes.map(node => {
            const color = RISK_COLORS[node.risk] || '#00ff88';
            const isHovered = hoveredNode === node.id;
            return (
              <g key={node.id}
                onMouseEnter={() => setHoveredNode(node.id)}
                onMouseLeave={() => setHoveredNode(null)}
                style={{ cursor: 'pointer' }}
                filter="url(#node-glow)"
              >
                {/* Outer ring */}
                <circle cx={node.x} cy={node.y} r={isHovered ? 18 : 14}
                  fill="transparent" stroke={color} strokeWidth="1"
                  strokeOpacity={isHovered ? 0.8 : 0.3}
                  style={{ transition: 'r 0.2s, stroke-opacity 0.2s' }}
                />
                {/* Inner */}
                <circle cx={node.x} cy={node.y} r={7}
                  fill={color} fillOpacity={isHovered ? 1 : 0.7}
                  style={{ filter: `drop-shadow(0 0 6px ${color})`, transition: 'fill-opacity 0.2s' }}
                />
                {/* Label */}
                <text x={node.x} y={node.y + 26}
                  textAnchor="middle"
                  fill={color} fontSize="7"
                  fontFamily="Share Tech Mono, monospace"
                  letterSpacing="0.08em"
                  opacity={isHovered ? 1 : 0.7}
                >
                  {node.type}
                </text>
              </g>
            );
          })}

          {/* Crosshairs */}
          <line x1={cx - 8} y1={cy} x2={cx + 8} y2={cy} stroke="rgba(0,255,136,0.3)" strokeWidth="0.5" />
          <line x1={cx} y1={cy - 8} x2={cx} y2={cy + 8} stroke="rgba(0,255,136,0.3)" strokeWidth="0.5" />
        </svg>

        {/* HUD overlays */}
        <div style={{
          position: 'absolute', top: 8, left: 8,
          fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'rgba(0,255,136,0.5)',
          lineHeight: 1.8,
        }}>
          <div>NODES: {nodes.length}</div>
          <div>EDGES: {edges.length}</div>
          <div>SWEEP: {sonarAngle.toFixed(0)}°</div>
        </div>
        <div style={{
          position: 'absolute', bottom: 8, right: 8,
          fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'rgba(0,255,136,0.5)',
          textAlign: 'right', lineHeight: 1.8,
        }}>
          <div>TX: 0.14ms</div>
          <div>SYNC: 100%</div>
        </div>

        {/* Node tooltip */}
        {hoveredNode !== null && (() => {
          const n = nodes.find(nd => nd.id === hoveredNode);
          if (!n) return null;
          return (
            <div style={{
              position: 'absolute', top: 8, right: 8,
              background: 'rgba(3,13,24,0.95)',
              border: '1px solid var(--accent)',
              padding: '0.4rem 0.65rem',
              fontFamily: 'var(--font-mono)', fontSize: '0.63rem',
              color: 'var(--text-primary)',
            }}>
              <div style={{ color: 'var(--accent)', marginBottom: 2, letterSpacing: '0.1em' }}>{n.type}</div>
              <div style={{ color: 'var(--text-secondary)' }}>RISK: <span style={{ color: RISK_COLORS[n.risk] }}>{(n.risk || 'LOW').toUpperCase()}</span></div>
            </div>
          );
        })()}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: '1rem', paddingTop: '0.5rem', flexShrink: 0 }}>
        {Object.entries(RISK_COLORS).map(([r, c]) => (
          <div key={r} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: c, boxShadow: `0 0 4px ${c}` }} />
            <span className="label-xs" style={{ fontSize: '0.55rem' }}>{r.toUpperCase()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
