import React, { useState, useCallback } from 'react';
import { fetchDualRoute } from '../api/smartcity';

const S = {
  input: {
    width: '100%', background: 'rgba(0,0,0,0.5)', border: '1px solid var(--border)',
    color: 'var(--text-primary)', padding: '7px 10px', fontFamily: 'var(--font-mono)',
    fontSize: '0.7rem', boxSizing: 'border-box', outline: 'none',
  },
  label: { fontSize: '0.56rem', color: 'var(--text-secondary)', letterSpacing: '0.15em', marginBottom: '3px' },
  stat: {
    padding: '0.5rem 0.75rem', border: '1px solid var(--border)',
    background: 'rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column', gap: '2px',
  },
};

function geocodeAddress(query) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1&countrycodes=in`;
  return fetch(url, { headers: { 'Accept-Language': 'en', 'User-Agent': 'OrayaOS/1.0' } })
    .then(r => r.json())
    .then(results => {
      if (!results.length) throw new Error('Location not found');
      return { lat: parseFloat(results[0].lat), lng: parseFloat(results[0].lon), name: results[0].display_name };
    });
}

export default function SafeRoutePanel({ onRouteComputed }) {
  const [destQuery, setDestQuery] = useState('');
  const [srcQuery, setSrcQuery] = useState('');
  const [useGPS, setUseGPS] = useState(true);
  const [loading, setLoading] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [gpsCoords, setGpsCoords] = useState(null);
  const [gpsName, setGpsName] = useState(null);

  const getGPS = useCallback(async () => {
    setGpsLoading(true);
    setError(null);
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) { setGpsLoading(false); reject(new Error('Geolocation not supported')); return; }
      navigator.geolocation.getCurrentPosition(
        pos => {
          const c = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setGpsCoords(c);
          setGpsName(`${c.lat.toFixed(4)}, ${c.lng.toFixed(4)}`);
          setGpsLoading(false);
          resolve(c);
        },
        err => { setGpsLoading(false); reject(new Error('GPS denied — allow location access')); },
        { timeout: 8000 }
      );
    });
  }, []);

  const handleCompute = async () => {
    setError(null);
    setResult(null);
    setLoading(true);
    try {
      let src;
      if (useGPS) {
        src = gpsCoords || await getGPS().catch(() => null);
        if (!src) { setError('Could not get GPS location'); setLoading(false); return; }
      } else {
        if (!srcQuery.trim()) { setError('Enter a start location'); setLoading(false); return; }
        src = await geocodeAddress(srcQuery);
      }

      if (!destQuery.trim()) { setError('Enter a destination'); setLoading(false); return; }
      const dest = await geocodeAddress(destQuery);

      const data = await fetchDualRoute(src.lat, src.lng, dest.lat, dest.lng);
      setResult({ ...data, srcName: useGPS ? gpsName : srcQuery, destName: dest.name || destQuery });
      if (onRouteComputed) onRouteComputed(data, src, dest);
    } catch (e) {
      setError(e.message || 'Route computation failed');
    } finally {
      setLoading(false);
    }
  };

  const safestR = result?.safest_route;
  const shortestR = result?.shortest_route;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontFamily: 'var(--font-mono)' }}>
      {/* Source */}
      <div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '6px' }}>
          <span style={S.label}>START POINT</span>
          <label style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: 'auto', fontSize: '0.58rem', color: 'var(--accent)', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={useGPS}
              onChange={e => setUseGPS(e.target.checked)}
              style={{ accentColor: 'var(--accent)' }}
            />
            USE MY LOCATION
          </label>
        </div>
        {useGPS ? (
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <div style={{ ...S.input, flex: 1, display: 'flex', alignItems: 'center', color: gpsName ? 'var(--accent)' : 'var(--text-secondary)' }}>
              {gpsLoading ? '📡 Acquiring GPS...' : gpsName ? `📍 ${gpsName}` : '📍 Click GET GPS'}
            </div>
            <button
              onClick={getGPS}
              disabled={gpsLoading}
              style={{ border: '1px solid var(--accent)', background: 'transparent', color: 'var(--accent)', padding: '6px 10px', fontSize: '0.65rem', cursor: 'pointer' }}
            >
              {gpsLoading ? '...' : 'GET'}
            </button>
          </div>
        ) : (
          <input
            style={S.input}
            value={srcQuery}
            onChange={e => setSrcQuery(e.target.value)}
            placeholder="e.g. MG Road, Bengaluru"
          />
        )}
      </div>

      {/* Destination */}
      <div>
        <div style={S.label}>DESTINATION</div>
        <input
          style={S.input}
          value={destQuery}
          onChange={e => setDestQuery(e.target.value)}
          placeholder="e.g. Indiranagar, Bengaluru"
          onKeyDown={e => e.key === 'Enter' && handleCompute()}
        />
      </div>

      {/* Compute button */}
      <button
        onClick={handleCompute}
        disabled={loading}
        style={{
          width: '100%', padding: '10px', background: loading ? 'rgba(0,255,136,0.1)' : 'rgba(0,255,136,0.15)',
          border: '1px solid var(--accent)', borderLeft: '3px solid var(--accent)',
          color: 'var(--accent)', fontFamily: 'var(--font-display)', fontSize: '0.72rem',
          letterSpacing: '0.18em', cursor: loading ? 'wait' : 'pointer',
          animation: loading ? 'none' : undefined,
        }}
      >
        {loading ? '⏳ COMPUTING ROUTES...' : '→ COMPUTE SAFE + FAST ROUTES'}
      </button>

      {error && (
        <div style={{ padding: '8px', background: 'rgba(255,51,68,0.07)', border: '1px solid var(--red-alert)', color: 'var(--red-alert)', fontSize: '0.65rem' }}>
          ✕ {error}
        </div>
      )}

      {/* Results */}
      {result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {/* Route legend */}
          <div style={{ display: 'flex', gap: '1rem', padding: '8px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border)', fontSize: '0.62rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <div style={{ width: 20, height: 4, background: '#00ff88', borderRadius: 2 }} />
              <span style={{ color: '#00ff88' }}>SAFEST ROUTE</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <div style={{ width: 20, height: 4, background: '#3b82f6', borderRadius: 2 }} />
              <span style={{ color: '#3b82f6' }}>FASTEST ROUTE</span>
            </div>
          </div>

          {/* Safest route stats */}
          {safestR && (
            <div style={{ border: '1px solid #00ff8855', borderLeft: '3px solid #00ff88', padding: '0.6rem', background: 'rgba(0,255,136,0.04)' }}>
              <div style={{ fontSize: '0.6rem', color: '#00ff88', letterSpacing: '0.15em', marginBottom: '6px' }}>◎ SAFEST ROUTE</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.4rem' }}>
                <div style={S.stat}>
                  <span style={{ fontSize: '0.55rem', color: 'var(--text-secondary)' }}>DISTANCE</span>
                  <span style={{ color: '#00ff88', fontSize: '0.9rem' }}>{safestR.distance_m?.toFixed(0) ?? '—'}m</span>
                </div>
                <div style={S.stat}>
                  <span style={{ fontSize: '0.55rem', color: 'var(--text-secondary)' }}>ETA</span>
                  <span style={{ color: '#00ff88', fontSize: '0.9rem' }}>{safestR.estimated_time_min ?? '—'} min</span>
                </div>
                <div style={S.stat}>
                  <span style={{ fontSize: '0.55rem', color: 'var(--text-secondary)' }}>DANGER</span>
                  <span style={{ color: (safestR.danger_score ?? 0) > 0.6 ? '#ff3344' : '#00ff88', fontSize: '0.9rem' }}>
                    {((safestR.danger_score ?? safestR.overall_danger_score ?? 0) * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
              {safestR.danger_level && (
                <div style={{ fontSize: '0.62rem', color: 'var(--text-secondary)', marginTop: '6px' }}>
                  Level: <span style={{ color: '#00ff88' }}>{safestR.danger_level.toUpperCase()}</span>
                  {safestR.recommendation && <span> · {safestR.recommendation}</span>}
                </div>
              )}
            </div>
          )}

          {/* Fastest route stats */}
          {shortestR && (
            <div style={{ border: '1px solid #3b82f655', borderLeft: '3px solid #3b82f6', padding: '0.6rem', background: 'rgba(59,130,246,0.04)' }}>
              <div style={{ fontSize: '0.6rem', color: '#3b82f6', letterSpacing: '0.15em', marginBottom: '6px' }}>◎ FASTEST ROUTE</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.4rem' }}>
                <div style={S.stat}>
                  <span style={{ fontSize: '0.55rem', color: 'var(--text-secondary)' }}>DISTANCE</span>
                  <span style={{ color: '#3b82f6', fontSize: '0.9rem' }}>{shortestR.distance_m?.toFixed(0) ?? '—'}m</span>
                </div>
                <div style={S.stat}>
                  <span style={{ fontSize: '0.55rem', color: 'var(--text-secondary)' }}>ETA</span>
                  <span style={{ color: '#3b82f6', fontSize: '0.9rem' }}>{shortestR.estimated_time_min ?? '—'} min</span>
                </div>
                <div style={S.stat}>
                  <span style={{ fontSize: '0.55rem', color: 'var(--text-secondary)' }}>DANGER</span>
                  <span style={{ color: '#3b82f6', fontSize: '0.9rem' }}>
                    {((shortestR.danger_score ?? shortestR.overall_danger_score ?? 0) * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Comparison */}
          {safestR && shortestR && (
            <div style={{ padding: '8px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border)', fontSize: '0.62rem', color: 'var(--text-secondary)' }}>
              🛡 Safety improvement (safest vs fastest): <span style={{ color: '#00ff88' }}>
                {(((shortestR.danger_score ?? 0) - (safestR.danger_score ?? 0)) * 100).toFixed(0)}% less dangerous
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
