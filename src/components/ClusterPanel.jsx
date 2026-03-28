import React from 'react';

const RISK_COLORS = {
  poor_lighting:       'var(--amber)',
  high_incident_rate_weekends: 'var(--red-alert)',
  late_night_isolation: 'var(--red-alert)',
  high_isolation_score: 'var(--red-alert)',
  no_surveillance:     'var(--amber)',
  low_foot_traffic_night: 'var(--amber)',
};

const CLUSTER_TYPE_ICONS = { commercial: '🏙', park: '🌿', residential: '🏘', industrial: '🏭' };

export default function ClusterPanel({ cluster }) {
  if (!cluster) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <div style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
          LOADING SECTOR DATA...
        </div>
      </div>
    );
  }

  const {
    cluster_name, cluster_id, avg_cluster_safety, num_intersections,
    primary_risk_factors = [], recommended_interventions = [], cluster_type
  } = cluster;

  const safetyColor = avg_cluster_safety >= 70 ? 'var(--accent)' : avg_cluster_safety >= 45 ? 'var(--amber)' : 'var(--red-alert)';
  const circumference = 2 * Math.PI * 40;
  const dashOffset = circumference - (circumference * avg_cluster_safety) / 100;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '1rem', height: '100%' }}>

      {/* LEFT — cluster overview */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {/* Header card */}
        <div className="panel panel-cut" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
            <span style={{ fontSize: '1.5rem' }}>{CLUSTER_TYPE_ICONS[cluster_type] || '◈'}</span>
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.75rem', color: 'var(--accent)', letterSpacing: '0.1em' }}>
                SECTOR {cluster_id}
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-primary)', marginTop: 2 }}>
                {cluster_name}
              </div>
            </div>
          </div>

          {/* Gauge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ position: 'relative', width: 90, height: 90 }}>
              <svg width="90" height="90" viewBox="0 0 90 90" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx="45" cy="45" r="40" fill="transparent" stroke="rgba(255,255,255,0.05)" strokeWidth="5" />
                <circle
                  cx="45" cy="45" r="40"
                  fill="transparent"
                  stroke={safetyColor}
                  strokeWidth="5"
                  strokeDasharray={circumference}
                  strokeDashoffset={dashOffset}
                  className="gauge-ring"
                  style={{ filter: `drop-shadow(0 0 6px ${safetyColor})`, transition: 'stroke-dashoffset 1.2s ease' }}
                />
              </svg>
              <div style={{
                position: 'absolute', inset: 0,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', fontWeight: 900, color: safetyColor }}>
                  {avg_cluster_safety.toFixed(0)}
                </div>
                <div className="label-xs" style={{ fontSize: '0.55rem' }}>AVG SAFETY</div>
              </div>
            </div>
            <div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <div>
                  <div className="label-xs">INTERSECTIONS</div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', color: 'var(--text-primary)' }}>{num_intersections}</div>
                </div>
                <div>
                  <div className="label-xs">TYPE</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-primary)', textTransform: 'uppercase' }}>{cluster_type}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Risk factors */}
        <div className="panel panel-cut" style={{ padding: '1rem', flex: 1 }}>
          <div className="label-xs" style={{ color: 'var(--amber)', marginBottom: '0.6rem' }}>⚠ PRIMARY RISK FACTORS</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {primary_risk_factors.map((f, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.4rem 0.6rem',
                background: 'rgba(255,170,0,0.05)',
                borderLeft: `2px solid ${RISK_COLORS[f] || 'var(--amber)'}`,
              }}>
                <span style={{ color: RISK_COLORS[f] || 'var(--amber)', fontSize: '0.65rem' }}>●</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.67rem', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {f.replace(/_/g, ' ')}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* RIGHT — Interventions */}
      <div className="panel panel-cut" style={{ padding: '1.25rem', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div className="label-xs" style={{ color: 'var(--accent)', marginBottom: '1rem' }}>
          ▶ RECOMMENDED INTERVENTIONS
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', overflowY: 'auto', flex: 1 }}>
          {recommended_interventions.map((intervention, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'flex-start', gap: '1rem',
              padding: '0.85rem 1rem',
              border: '1px solid var(--border)',
              background: 'rgba(0,255,136,0.03)',
              position: 'relative',
              transition: 'border-color 0.2s, background 0.2s',
              cursor: 'default',
            }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.background = 'rgba(0,255,136,0.06)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'rgba(0,255,136,0.03)'; }}
            >
              <div style={{
                fontFamily: 'var(--font-display)',
                fontSize: '1.2rem',
                fontWeight: 900,
                color: 'rgba(0,255,136,0.15)',
                lineHeight: 1,
                flexShrink: 0,
                minWidth: 32,
              }}>
                {String(i + 1).padStart(2, '0')}
              </div>
              <div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-primary)', lineHeight: 1.5 }}>
                  {intervention}
                </div>
                <div style={{ marginTop: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--text-secondary)' }}>
                    PRIORITY: {i === 0 ? 'HIGH' : i === 1 ? 'MEDIUM' : 'LOW'}
                  </span>
                  <div style={{
                    width: 40, height: 2,
                    background: i === 0 ? 'var(--red-alert)' : i === 1 ? 'var(--amber)' : 'var(--accent)',
                  }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
