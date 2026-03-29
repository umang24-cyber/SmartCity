import React from 'react';

const RISKCOLOR = { low: 'var(--accent)', medium: 'var(--amber)', high: 'var(--red-alert)' };

export default function DangerPanel({
  danger, selectedIntersection, setSelectedIntersection,
  selectedWeather, setSelectedWeather
}) {
  if (!danger) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <div style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
          LOADING DANGER MATRIX...
        </div>
      </div>
    );
  }

  const { score, comfort_score, comfort_label, risk, reasons = [], warnings = [], meta = {}, timeSlice = {} } = danger;
  const color = RISKCOLOR[risk] || 'var(--accent)';
  const circumference = 2 * Math.PI * 54;
  const dashOffset = circumference - (circumference * (comfort_score ?? score)) / 100;

  const intersections = [
    { id: 'INT_001', name: 'MG Road & Brigade Rd' },
    { id: 'INT_002', name: 'Residency & Richmond Rd' },
    { id: 'INT_003', name: 'Cubbon Park North Gate' },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', height: '100%' }}>

      {/* LEFT — Gauge + Controls */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {/* Controls */}
        <div className="panel panel-cut" style={{ padding: '1rem' }}>
          <div className="label-xs" style={{ marginBottom: '0.6rem' }}>ZONE SELECTION</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div>
              <div className="label-xs" style={{ marginBottom: 3 }}>INTERSECTION</div>
              <select
                value={selectedIntersection}
                onChange={e => setSelectedIntersection(e.target.value)}
                className="sub-input"
              >
                {intersections.map(i => (
                  <option key={i.id} value={i.id}>{i.id} — {i.name}</option>
                ))}
              </select>
            </div>
            <div>
              <div className="label-xs" style={{ marginBottom: 3 }}>WEATHER CONDITION</div>
              <select
                value={selectedWeather}
                onChange={e => setSelectedWeather(e.target.value)}
                className="sub-input"
              >
                {['clear', 'rain', 'fog', 'storm'].map(w => (
                  <option key={w} value={w}>{w.toUpperCase()}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Circular gauge */}
        <div className="panel panel-cut" style={{ padding: '1.25rem', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div className="label-xs" style={{ marginBottom: '1rem' }}>DANGER SCORE GAUGE</div>
          <div style={{ position: 'relative', width: 140, height: 140 }}>
            <svg width="140" height="140" viewBox="0 0 140 140" style={{ transform: 'rotate(-90deg)' }}>
              <circle cx="70" cy="70" r="54" fill="transparent" stroke="rgba(255,255,255,0.05)" strokeWidth="6" />
              <circle
                cx="70" cy="70" r="54"
                fill="transparent"
                stroke={color}
                strokeWidth="6"
                strokeDasharray={circumference}
                strokeDashoffset={dashOffset}
                strokeLinecap="butt"
                className="gauge-ring"
                style={{ filter: `drop-shadow(0 0 8px ${color})`, transition: 'stroke-dashoffset 1.2s ease' }}
              />
            </svg>
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 900, color, lineHeight: 1 }}>
                {comfort_score ?? score}
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.55rem', color, letterSpacing: '0.1em', marginTop: 4, textAlign: 'center' }}>
                {comfort_label ?? (risk.toUpperCase() + ' RISK')}
              </div>
            </div>
          </div>

          {/* Time context */}
          <div style={{ marginTop: '1rem', width: '100%' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
              {[
                { k: 'HOUR', v: `${String(timeSlice.hour ?? '-').padStart(2,'0')}:00` },
                { k: 'WEATHER', v: (timeSlice.weather ?? 'CLEAR').toUpperCase() },
                { k: 'WEEKEND', v: timeSlice.is_weekend ? 'YES' : 'NO' },
                { k: 'CITY SAFETY', v: timeSlice.aggregate_safety ?? '-' },
              ].map(({ k, v }) => (
                <div key={k} style={{ background: 'rgba(0,255,136,0.03)', border: '1px solid var(--border)', padding: '0.35rem 0.5rem' }}>
                  <div className="label-xs" style={{ marginBottom: 2 }}>{k}</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-primary)' }}>{v}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT — Reasons + Warnings + Meta */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', overflow: 'hidden' }}>
        {/* Meta info */}
        <div className="panel panel-cut" style={{ padding: '1rem' }}>
          <div className="label-xs" style={{ marginBottom: '0.6rem' }}>INTERSECTION METADATA</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', lineHeight: 1.9 }}>
            <div style={{ color: 'var(--text-secondary)' }}>ID: <span style={{ color: 'var(--text-primary)' }}>{meta.intersection_id || '—'}</span></div>
            <div style={{ color: 'var(--text-secondary)' }}>BASELINE: <span style={{ color: 'var(--text-primary)' }}>{meta.baseline_safety_score ?? '—'}</span></div>
            <div style={{ color: 'var(--text-secondary)' }}>ISOLATION: <span style={{ color: meta.isolation_score > 0.7 ? 'var(--red-alert)' : 'var(--accent)' }}>{meta.isolation_score?.toFixed(2) ?? '—'}</span></div>
            <div style={{ color: 'var(--text-secondary)' }}>VARIANCE: <span style={{ color: 'var(--text-primary)' }}>{meta.safety_variance?.toFixed(1) ?? '—'}</span></div>
            <div style={{ color: 'var(--text-secondary)' }}>PEAK HOURS: <span style={{ color: 'var(--amber)' }}>{(meta.peak_danger_hours || []).join(', ')}</span></div>
          </div>
        </div>

        {/* Positive factors */}
        {reasons.length > 0 && (
          <div className="panel panel-cut" style={{ padding: '1rem', flex: 1, overflow: 'hidden' }}>
            <div className="label-xs" style={{ marginBottom: '0.6rem', color: 'var(--accent)' }}>▲ POSITIVE FACTORS</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', overflowY: 'auto', maxHeight: 160 }}>
              {reasons.map((r, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'flex-start', gap: '0.5rem',
                  fontFamily: 'var(--font-mono)', fontSize: '0.67rem', lineHeight: 1.5,
                  color: 'var(--text-primary)',
                  padding: '0.3rem 0.5rem',
                  background: 'rgba(0,255,136,0.04)',
                  borderLeft: '2px solid var(--accent)',
                }}>
                  <span style={{ color: 'var(--accent)', flexShrink: 0 }}>✓</span>
                  {r}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Warnings */}
        {warnings.length > 0 && (
          <div className="panel panel-cut" style={{ padding: '1rem', flex: 1, overflow: 'hidden' }}>
            <div className="label-xs" style={{ marginBottom: '0.6rem', color: 'var(--amber)' }}>▼ THREAT WARNINGS</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', overflowY: 'auto', maxHeight: 160 }}>
              {warnings.map((w, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'flex-start', gap: '0.5rem',
                  fontFamily: 'var(--font-mono)', fontSize: '0.67rem', lineHeight: 1.5,
                  color: 'var(--text-primary)',
                  padding: '0.3rem 0.5rem',
                  background: 'rgba(255,170,0,0.05)',
                  borderLeft: '2px solid var(--amber)',
                }}>
                  <span style={{ color: 'var(--amber)', flexShrink: 0 }}>!</span>
                  {w}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* No warnings/reasons fallback */}
        {reasons.length === 0 && warnings.length === 0 && (
          <div className="panel panel-cut" style={{ padding: '1rem', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="label-xs">NO FACTORS COMPUTED</div>
          </div>
        )}
      </div>
    </div>
  );
}
