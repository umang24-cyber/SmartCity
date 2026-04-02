import React from 'react';

export default function SafeRoutePanel({ safeRoute, intersections = [], routeStart, setRouteStart, routeEnd, setRouteEnd }) {
  const handleStartChange = (e) => {
    const val = e.target.value;
    if (!val) { setRouteStart(null); return; }
    const node = intersections.find(n => n.intersection_id === val || n.zone_id === val);
    if (node) setRouteStart({ lat: node.lat, lng: node.lng, id: val, name: node.intersection_name || `Zone ${val}` });
  };

  const handleEndChange = (e) => {
    const val = e.target.value;
    if (!val) { setRouteEnd(null); return; }
    const node = intersections.find(n => n.intersection_id === val || n.zone_id === val);
    if (node) setRouteEnd({ lat: node.lat, lng: node.lng, id: val, name: node.intersection_name || `Zone ${val}` });
  };

  const renderContent = () => {
    if (!safeRoute) {
      return (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
            AWAITING ROUTE SELECTION...
          </div>
        </div>
      );
    }

    const { waypoints = [], stats = {}, avoided_intersections = [] } = safeRoute;

    return (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', flex: 1, minHeight: 0 }}>
        {/* LEFT — Route visualization */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto', paddingRight: '0.5rem' }}>
          {/* Stats */}
          <div className="panel panel-cut" style={{ padding: '1rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', flexShrink: 0 }}>
            <div style={{ background: 'rgba(0,255,136,0.05)', border: '1px solid var(--border)', padding: '0.6rem' }}>
              <div className="label-xs" style={{ marginBottom: 3 }}>DISTANCE</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', color: 'var(--accent)' }}>
                {stats.distance_m || 0}m
              </div>
            </div>
            <div style={{ background: 'rgba(0,255,136,0.05)', border: '1px solid var(--border)', padding: '0.6rem' }}>
              <div className="label-xs" style={{ marginBottom: 3 }}>EST. TIME</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', color: 'var(--accent)' }}>
                {stats.estimated_time_minutes || 0} min
              </div>
            </div>
          </div>

          {/* Node chain visualization */}
          <div className="panel panel-cut" style={{ padding: '1.25rem', flex: 1, overflowY: 'auto' }}>
            <div className="label-xs" style={{ marginBottom: '1rem' }}>ROUTE WAYPOINTS</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {waypoints.map((node, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                  {/* Connector line */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 20, flexShrink: 0 }}>
                    <div style={{
                      width: 16, height: 16, borderRadius: '50%',
                      border: `2px solid var(--accent)`,
                      background: i === 0 || i === waypoints.length - 1 ? 'var(--accent)' : 'transparent',
                      boxShadow: `0 0 8px var(--accent)`,
                      flexShrink: 0,
                    }} />
                    {i < waypoints.length - 1 && (
                      <div style={{
                        width: 1, height: 24, flexShrink: 0,
                        background: 'linear-gradient(to bottom, var(--accent), rgba(0,255,136,0.2))',
                        margin: '2px 0',
                      }} />
                    )}
                  </div>
                  <div style={{ paddingBottom: i < waypoints.length - 1 ? '0.75rem' : 0 }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-primary)' }}>
                      Waypoint {i + 1}
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--text-secondary)' }}>
                      {node.lat?.toFixed(4)}, {node.lng?.toFixed(4)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT — Reasoning */}
        <div className="panel panel-cut" style={{ padding: '1.25rem', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div className="label-xs" style={{ marginBottom: '1rem', color: 'var(--accent)' }}>
            ◎ ROUTE ANALYSIS & SAFETY
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', overflowY: 'auto', flex: 1 }}>
            
            <div style={{
              padding: '0.85rem',
              background: 'rgba(0,255,136,0.04)',
              border: '1px solid var(--border)',
              borderLeft: '2px solid var(--accent)'
            }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>AI INTELLIGENCE</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-primary)', marginBottom: '0.75rem', fontWeight: 'bold' }}>Why this route is safer:</div>
              <ul style={{ margin: 0, paddingLeft: '1.2rem', fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--accent)', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <li>Avoids {avoided_intersections?.length || 0} high-risk intersections</li>
                <li>Lower historical incident density along path</li>
                <li>Better lighting and CCTV coverage in selected zones</li>
                <li>Segments maintain max danger level: {(stats.danger_level || 'UNKNOWN').toUpperCase()}</li>
              </ul>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <div style={{
                padding: '0.65rem',
                background: 'rgba(0,0,0,0.3)',
                border: '1px solid var(--border)',
              }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--text-secondary)', marginBottom: 2 }}>RECOMMENDATION</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-primary)' }}>{stats.recommendation || 'Proceed with caution'}</div>
              </div>
              <div style={{
                padding: '0.65rem',
                background: 'rgba(0,0,0,0.3)',
                border: '1px solid var(--border)',
              }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--text-secondary)', marginBottom: 2 }}>AVG DANGER SCORE</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-primary)' }}>{stats.overall_danger_score || 0}</div>
              </div>
            </div>

          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%' }}>
      {/* Top Bar for Selection */}
      <div className="panel panel-cut" style={{ padding: '0.75rem 1.25rem', display: 'flex', gap: '1rem', alignItems: 'center', flexShrink: 0 }}>
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          <label className="label-xs" style={{ marginBottom: 4 }}>START POINT</label>
          <select 
            value={routeStart?.id || ""} 
            onChange={handleStartChange}
            style={{
              background: 'rgba(0,0,0,0.5)', border: '1px solid var(--border)', 
              color: 'var(--text-primary)', padding: '6px', fontFamily: 'var(--font-mono)', fontSize: '0.7rem'
            }}
          >
            <option value="">-- Select Start --</option>
            {intersections.map(node => (
              <option key={`start-${node.zone_id || node.intersection_id}`} value={node.zone_id || node.intersection_id}>
                {node.intersection_name || `Zone ${node.zone_id}`}
              </option>
            ))}
          </select>
        </div>

        <div style={{ color: 'var(--accent)', fontFamily: 'var(--font-display)' }}>→</div>

        <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          <label className="label-xs" style={{ marginBottom: 4 }}>END POINT</label>
          <select 
            value={routeEnd?.id || ""} 
            onChange={handleEndChange}
            style={{
              background: 'rgba(0,0,0,0.5)', border: '1px solid var(--border)', 
              color: 'var(--text-primary)', padding: '6px', fontFamily: 'var(--font-mono)', fontSize: '0.7rem'
            }}
          >
            <option value="">-- Select Destination --</option>
            {intersections.map(node => (
              <option key={`end-${node.zone_id || node.intersection_id}`} value={node.zone_id || node.intersection_id}>
                {node.intersection_name || `Zone ${node.zone_id}`}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Content Area */}
      {renderContent()}
    </div>
  );
}
