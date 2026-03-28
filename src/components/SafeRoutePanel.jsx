import React from 'react';

export default function SafeRoutePanel({ safeRoute }) {
  if (!safeRoute) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <div style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
          COMPUTING SAFE ROUTE...
        </div>
      </div>
    );
  }

  const { route = [], reason = [], avoided_intersections = [], total_distance_m, safety_improvement_vs_shortest } = safeRoute;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', height: '100%' }}>

      {/* LEFT — Route visualization */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {/* Stats */}
        <div className="panel panel-cut" style={{ padding: '1rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
          <div style={{ background: 'rgba(0,255,136,0.05)', border: '1px solid var(--border)', padding: '0.6rem' }}>
            <div className="label-xs" style={{ marginBottom: 3 }}>DISTANCE</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', color: 'var(--accent)' }}>
              {total_distance_m}m
            </div>
          </div>
          <div style={{ background: 'rgba(0,255,136,0.05)', border: '1px solid var(--border)', padding: '0.6rem' }}>
            <div className="label-xs" style={{ marginBottom: 3 }}>SAFETY GAIN</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', color: 'var(--accent)' }}>
              {safety_improvement_vs_shortest}
            </div>
          </div>
        </div>

        {/* Node chain visualization */}
        <div className="panel panel-cut" style={{ padding: '1.25rem', flex: 1 }}>
          <div className="label-xs" style={{ marginBottom: '1rem' }}>ROUTE WAYPOINTS</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {route.map((node, i) => (
              <div key={node.intersection_id} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                {/* Connector line */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 20, flexShrink: 0 }}>
                  <div style={{
                    width: 16, height: 16, borderRadius: '50%',
                    border: `2px solid var(--accent)`,
                    background: i === 0 || i === route.length - 1 ? 'var(--accent)' : 'transparent',
                    boxShadow: `0 0 8px var(--accent)`,
                    flexShrink: 0,
                  }} />
                  {i < route.length - 1 && (
                    <div style={{
                      width: 1, flex: 1, minHeight: 32,
                      background: 'linear-gradient(to bottom, var(--accent), rgba(0,255,136,0.2))',
                      margin: '2px 0',
                    }} />
                  )}
                </div>
                <div style={{ paddingBottom: i < route.length - 1 ? '0.75rem' : 0 }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-primary)' }}>
                    {node.intersection_id}
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--text-secondary)' }}>
                    {node.lat?.toFixed(4)}, {node.lng?.toFixed(4)}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Avoided zones */}
          {avoided_intersections.length > 0 && (
            <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border)' }}>
              <div className="label-xs" style={{ color: 'var(--red-alert)', marginBottom: '0.35rem' }}>
                ⚠ AVOIDED ZONES
              </div>
              {avoided_intersections.map(id => (
                <div key={id} style={{
                  fontFamily: 'var(--font-mono)', fontSize: '0.67rem',
                  color: 'var(--red-alert)',
                  padding: '0.25rem 0.5rem',
                  background: 'rgba(255,51,68,0.06)',
                  borderLeft: '2px solid var(--red-alert)',
                  marginBottom: 4,
                }}>
                  {id} — HIGH ISOLATION
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT — Reasoning */}
      <div className="panel panel-cut" style={{ padding: '1.25rem', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div className="label-xs" style={{ marginBottom: '1rem', color: 'var(--accent)' }}>
          ◎ ROUTE SELECTION CRITERIA
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', overflowY: 'auto', flex: 1 }}>
          {reason.map((r, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
              padding: '0.65rem 0.75rem',
              background: 'rgba(0,255,136,0.04)',
              border: '1px solid var(--border)',
              transition: 'border-color 0.2s',
            }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
            >
              <span style={{
                fontFamily: 'var(--font-display)',
                fontSize: '0.65rem',
                color: 'var(--accent)',
                flexShrink: 0,
                marginTop: 1,
              }}>
                {String(i + 1).padStart(2, '0')}
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--text-primary)', lineHeight: 1.5 }}>
                {r}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
