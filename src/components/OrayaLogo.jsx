import React from 'react';

/**
 * Modern SVG Logo for Oraya Smart City OS.
 * Supports minimal geometry, scaling, and CSS micro-interactions.
 * 
 * @param {string} variant - 'full' | 'icon' | 'splash' | 'loading'
 * @param {string} status  - 'idle' | 'active' | 'alert'
 * @param {ReactNode} subtitle - Optional bottom text to stack under the branding
 */
export default function OrayaLogo({ variant = 'full', status = 'idle', subtitle = null, className = '' }) {
  let size = 36;
  let textSize = '0.95rem';
  let gap = '1.5rem';

  if (variant === 'splash') {
    size = 120;
    textSize = '3rem';
    gap = '2rem';
  } else if (variant === 'loading') {
    size = 80;
    textSize = '2.2rem';
    gap = '1.5rem';
  } else if (variant === 'icon') {
    size = 24;
  }

  const isAlert = status === 'alert';
  const color = isAlert ? 'var(--red-alert)' : 'var(--accent)';
  
  const rootClass = `oraya-logo oraya-logo-${status} ${className}`;

  const svgContent = (
    <svg width={size} height={size} viewBox="0 0 100 100" className={rootClass} style={{ overflow: 'visible' }}>
      {/* Outer Ring */}
      <circle cx="50" cy="50" r="45" fill="none" stroke={color} strokeWidth="2.5" opacity="0.5" style={{ filter: `drop-shadow(0 0 6px ${color})` }} />
      <circle cx="50" cy="50" r="48" fill="none" stroke={color} strokeWidth="0.5" opacity="0.3" />

      {/* Radar Arcs (Rotating) */}
      <g className="oraya-radar">
        <path d="M 50 15 A 35 35 0 0 1 85 50" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" opacity="0.9" />
        <path d="M 50 85 A 35 35 0 0 1 15 50" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" opacity="0.9" />
      </g>

      {/* Inner Eye / Core */}
      <g className="oraya-core">
        <path d="M 50 35 L 38 50 L 50 65 L 62 50 Z" fill="none" stroke={color} strokeWidth="2.5" style={{ filter: `drop-shadow(0 0 8px ${color})` }} />
        <circle cx="50" cy="50" r="5" fill={color} style={{ filter: `drop-shadow(0 0 10px ${color})` }} />
      </g>
    </svg>
  );

  // Return just the SVG element for pure icon scenarios
  if (variant === 'icon') {
    return svgContent;
  }

  // Layout for full text / splash formats
  return (
    <div style={{ display: 'flex', flexDirection: variant === 'splash' || variant === 'loading' ? 'column' : 'row', alignItems: 'center', gap: gap }}>
      <div style={{ position: 'relative', width: size, height: size }}>
        {svgContent}
      </div>
      
      {(variant === 'full' || variant === 'splash' || variant === 'loading') && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: variant === 'splash' || variant === 'loading' ? 'center' : 'flex-start' }}>
          <div style={{
            fontFamily: 'var(--font-display)',
            fontSize: textSize,
            fontWeight: variant === 'full' ? 700 : 900,
            color: color,
            letterSpacing: variant === 'splash' || variant === 'loading' ? '0.25em' : '0.2em',
            textShadow: `0 0 15px ${isAlert ? 'rgba(255, 51, 68, 0.6)' : 'rgba(0, 255, 136, 0.6)'}`,
            transition: 'color 0.4s ease, text-shadow 0.4s ease',
            margin: 0,
            lineHeight: 1
          }}>
            ORAYA{variant === 'splash' ? ' OS' : ''}
          </div>
          {subtitle && (
            <div style={{ marginTop: variant === 'splash' || variant === 'loading' ? '0.5rem' : '2px' }}>
              {subtitle}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
