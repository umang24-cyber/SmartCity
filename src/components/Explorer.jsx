import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, GeoJSON, useMap, CircleMarker } from 'react-leaflet';
import * as L from 'leaflet';
import { useTheme } from '../context/ThemeContext';
import { fetchReports } from '../api/smartcity';

const TILE_DARK  = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
const TILE_LIGHT = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

function initIcons() {
  if (typeof window !== 'undefined' && L.Icon?.Default) {
    try {
      delete L.Icon.Default.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
        iconUrl:       'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
        shadowUrl:     'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
      });
    } catch (e) { /* ignore */ }
  }
}

function MapUpdater({ center, zoom }) {
  const map = useMap();
  useEffect(() => { if (center) map.setView(center, zoom || map.getZoom()); }, [center, zoom, map]);
  return null;
}

function MapFlyTo({ coords }) {
  const map = useMap();
  useEffect(() => { if (coords) map.flyTo(coords, 15, { duration: 1.5 }); }, [coords, map]);
  return null;
}

function emergencyColor(level) {
  switch ((level || '').toUpperCase()) {
    case 'CRITICAL': return '#ff3344';
    case 'HIGH':     return '#ff6600';
    case 'MEDIUM':   return '#ffaa00';
    case 'LOW':      return '#00cc66';
    default:         return '#00ff88';
  }
}

// Build a GeoJSON LineString from an array of {lat,lng} waypoints or segments array
function buildLineGeoJSON(arr, color) {
  if (!arr || !arr.length) return null;
  // If arr is already GeoJSON FeatureCollection or Feature
  if (arr.type) return { ...arr, _color: color };
  // Array of {lat, lng}
  if (arr[0]?.lat != null) {
    return {
      type: 'Feature',
      properties: { color },
      geometry: { type: 'LineString', coordinates: arr.map(p => [p.lng, p.lat]) }
    };
  }
  return null;
}

export default function Explorer({
  intersections = [],
  incidents = [],
  safeRoute = null,
  safestRouteGeoJSON = null,
  shortestRouteGeoJSON = null,
  safeZones = [],
  selectedIntersection = null,
  userPosition = null, // { lat, lng } for GPS marker
  backendUrl = 'http://127.0.0.1:8000',
}) {
  const { mode } = useTheme();
  useEffect(() => { initIcons(); }, []);

  const [heatmapData, setHeatmapData] = useState(null);
  const [clusterData, setClusterData] = useState(null);
  const [liveReports, setLiveReports] = useState([]);

  const [showHeatmap,  setShowHeatmap]  = useState(true);
  const [showClusters, setShowClusters] = useState(true);
  const [showReports,  setShowReports]  = useState(true);
  const [showSafest,   setShowSafest]   = useState(true);
  const [showFastest,  setShowFastest]  = useState(true);

  const fetchLive = async () => {
    try {
      const data = await fetchReports({ limit: 200 });
      if (Array.isArray(data)) setLiveReports(data.filter(r => r.lat != null && r.lng != null));
    } catch (e) { /* backend offline */ }
  };

  useEffect(() => {
    fetchLive();
    const iv = setInterval(fetchLive, 30000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    const parse = async (res) => {
      const text = await res.text();
      let d = null;
      try { d = text ? JSON.parse(text) : null; } catch { d = null; }
      if (!res.ok) throw new Error(d?.detail || `HTTP ${res.status}`);
      return d;
    };
    fetch(`${backendUrl}/api/v1/graph/heatmap/geojson`)
      .then(parse).then(d => setHeatmapData(d)).catch(() => {});
    fetch(`${backendUrl}/api/v1/cluster-info/geojson`)
      .then(parse).then(d => setClusterData(d)).catch(() => {});
  }, [backendUrl]);

  const center = [12.9716, 77.5946];

  const selectedNode = intersections.find(
    n => n.intersection_id === selectedIntersection || n.zone_id === selectedIntersection
  );
  const selectedPos = selectedNode ? [selectedNode.lat, selectedNode.lng] : null;

  const heatStyle = f => ({
    fillColor: f.properties.danger_score > 0.7 ? '#ff3344' : f.properties.danger_score > 0.4 ? '#ffaa00' : '#00ff88',
    fillOpacity: 0.45, color: 'transparent', radius: 20,
  });
  const clusterStyle = f => ({
    fillColor: '#ff3344', fillOpacity: 0.55, color: '#ff3344', weight: 2,
    radius: 15 + (f.properties.incident_count || 0) * 2,
  });

  // Resolve dual routes — backend returns { type:'Feature', geometry:{type:'LineString',...} }
  // or we may have wrapped it ourselves
  const normalizeRouteGeo = (geo, color) => {
    if (!geo) return null;
    // Already a Feature
    if (geo.type === 'Feature') return geo;
    // Bare geometry
    if (geo.type === 'LineString' || geo.type === 'MultiLineString') {
      return { type: 'Feature', properties: { color }, geometry: geo };
    }
    // FeatureCollection — take first feature
    if (geo.type === 'FeatureCollection' && geo.features?.length) return geo.features[0];
    return null;
  };

  const safestGeoNorm  = normalizeRouteGeo(safestRouteGeoJSON,  '#00ff88');
  const fastestGeoNorm = normalizeRouteGeo(shortestRouteGeoJSON, '#3b82f6');

  // Legacy single-route segments support
  const legacySegments = (!safestGeoNorm && !fastestGeoNorm && safeRoute?.segments) ? safeRoute.segments : null;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>

      {/* HUD overlay */}
      <div style={{
        position: 'absolute', top: 12, left: 16, zIndex: 1000,
        fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-primary)',
        background: 'var(--bg-panel)', padding: '8px 12px', border: '1px solid var(--border)',
        boxShadow: '0 4px 12px rgba(0,0,0,0.25)', backdropFilter: 'blur(4px)', minWidth: 200,
      }}>
        <div style={{ fontWeight: 'bold', color: 'var(--accent)', marginBottom: 8, fontSize: '0.68rem', letterSpacing: '0.15em' }}>
          TACTICAL LAYER CONTROLS
        </div>
        {[
          { label: 'Danger Heatmap',    val: showHeatmap,  set: setShowHeatmap,  color: 'var(--amber)' },
          { label: 'Incident Clusters', val: showClusters, set: setShowClusters, color: 'var(--red-alert)' },
          { label: `Live Reports (${liveReports.length})`, val: showReports, set: setShowReports, color: 'var(--accent)' },
          { label: 'Safest Route',   val: showSafest,   set: setShowSafest,  color: '#00ff88' },
          { label: 'Fastest Route',  val: showFastest,  set: setShowFastest, color: '#3b82f6' },
        ].map(({ label, val, set, color }) => (
          <label key={label} style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', marginBottom: 4, gap: 6 }}>
            <input type="checkbox" checked={val} onChange={e => set(e.target.checked)} style={{ accentColor: color }} />
            <span style={{ fontSize: '0.65rem', color: val ? color : 'var(--text-secondary)' }}>{label}</span>
          </label>
        ))}
      </div>

      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <MapContainer center={center} zoom={14} style={{ height: '100%', width: '100%' }} zoomControl={false}>
          <TileLayer
            url={mode === 'dark' ? TILE_DARK : TILE_LIGHT}
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />

          {selectedPos && <MapUpdater center={selectedPos} zoom={16} />}
          {userPosition && <MapFlyTo coords={[userPosition.lat, userPosition.lng]} />}

          {/* Heatmap */}
          {showHeatmap && heatmapData && (
            <GeoJSON data={heatmapData} pointToLayer={(f, ll) => L.circleMarker(ll, heatStyle(f))} />
          )}

          {/* Clusters */}
          {showClusters && clusterData && (
            <GeoJSON
              data={clusterData}
              pointToLayer={(f, ll) => L.circleMarker(ll, clusterStyle(f))}
              onEachFeature={(f, layer) => layer.bindPopup(
                `<div style="font-family:monospace;background:rgba(10,15,25,.92);color:#fff;padding:8px;">
                  <strong style="color:#ff3344">⚠ Alert Cluster</strong><br/>
                  Incidents: ${f.properties.incident_count}<br/>
                  Radius: ${Math.round((f.properties.radius_km || 0) * 1000)}m
                </div>`
              )}
            />
          )}

          {/* SAFEST route — GREEN */}
          {showSafest && safestGeoNorm && (
            <GeoJSON
              key={'safe_' + JSON.stringify(safestGeoNorm.geometry?.coordinates?.[0])}
              data={safestGeoNorm}
              style={() => ({ color: '#00ff88', weight: 6, opacity: 0.9 })}
            />
          )}

          {/* FASTEST route — BLUE dashed */}
          {showFastest && fastestGeoNorm && (
            <GeoJSON
              key={'fast_' + JSON.stringify(fastestGeoNorm.geometry?.coordinates?.[0])}
              data={fastestGeoNorm}
              style={() => ({ color: '#3b82f6', weight: 5, opacity: 0.8, dashArray: '8,5' })}
            />
          )}

          {/* Legacy single-route */}
          {legacySegments && (
            <GeoJSON
              data={legacySegments}
              style={f => ({ color: f.properties?.color || '#00ff88', weight: 5, opacity: 0.85 })}
            />
          )}

          {/* Live report markers */}
          {showReports && liveReports.map((report, idx) => {
            const color = emergencyColor(report.emergency_level);
            const sev = Math.min(5, Math.max(1, report.severity || 1));
            return (
              <Marker
                key={report.report_id || `r_${idx}`}
                position={[report.lat, report.lng]}
                icon={L.divIcon({
                  className: '',
                  html: `<div style="width:13px;height:13px;background:${color};border:2px solid rgba(255,255,255,0.8);border-radius:50%;box-shadow:0 0 8px ${color};"></div>`,
                  iconSize: [13, 13], iconAnchor: [6, 6],
                })}
              >
                <Popup>
                  <div style={{ fontFamily: 'monospace', fontSize: '0.75rem', background: 'rgba(10,15,25,.95)', color: '#e2e8f0', padding: '8px 10px', minWidth: 180, border: `1px solid ${color}44` }}>
                    <div style={{ color, fontWeight: 'bold', marginBottom: 4 }}>{report.emergency_level || 'REPORT'}</div>
                    <div style={{ color: '#94a3b8', fontSize: '0.68rem' }}>Severity: <span style={{ color }}>{sev}/5</span></div>
                    {report.incident_type && <div style={{ fontSize: '0.65rem', color: '#94a3b8', marginTop: 2 }}>Type: <span style={{ color: '#e2e8f0' }}>{report.incident_type.replace(/_/g,' ').toUpperCase()}</span></div>}
                    <div style={{ fontSize: '0.6rem', color: '#475569', marginTop: 6, borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 4 }}>
                      {report.timestamp ? new Date(report.timestamp).toLocaleString() : ''}
                    </div>
                  </div>
                </Popup>
              </Marker>
            );
          })}

          {/* Intersection dots — danger colour coded from backend */}
          {intersections.map(node => {
            const ds = node.danger_score ?? ((100 - (node.baseline_safety_score ?? 72)) / 100);
            const col = ds > 0.7 ? '#ff3344' : ds > 0.4 ? '#ffaa00' : '#00ff88';
            return (
              <CircleMarker
                key={node.zone_id || node.intersection_id}
                center={[node.lat, node.lng]}
                radius={5}
                pathOptions={{ fillColor: col, fillOpacity: 0.75, color: '#fff', weight: 1 }}
              >
                <Popup>
                  <div style={{ fontFamily: 'monospace', background: 'rgba(10,15,25,.95)', color: '#e2e8f0', padding: '6px 8px', fontSize: '0.7rem' }}>
                    <div style={{ color: col, fontWeight: 'bold' }}>{node.intersection_name || node.zone_id}</div>
                    <div style={{ color: '#94a3b8', fontSize: '0.62rem', marginTop: 2 }}>
                      Danger: {(ds * 100).toFixed(0)}% | Safety: {node.baseline_safety_score?.toFixed(0) ?? '—'}
                    </div>
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}

          {/* Safe zones */}
          {safeZones.map((zone, idx) => (
            <Marker
              key={`sz-${idx}`}
              position={[zone.lat, zone.lng]}
              icon={L.divIcon({
                className: '',
                html: `<div style="width:20px;height:20px;display:flex;align-items:center;justify-content:center;background:rgba(0,150,255,.2);border:2px solid #0096ff;border-radius:4px;box-shadow:0 0 10px rgba(0,150,255,.5);font-size:10px;">🛡️</div>`,
                iconSize: [20, 20], iconAnchor: [10, 10],
              })}
            >
              <Popup>
                <div style={{ fontFamily: 'monospace', color: '#0096ff', background: 'rgba(10,15,25,.9)', padding: '6px', fontSize: '0.72rem' }}>
                  <strong>{zone.name}</strong><br />
                  {zone.type?.replace('_',' ')}<br />
                  {zone.is_open_now ? '✅ Open' : '❌ Closed'}
                </div>
              </Popup>
            </Marker>
          ))}

          {/* User GPS position */}
          {userPosition && (
            <Marker
              position={[userPosition.lat, userPosition.lng]}
              icon={L.divIcon({
                className: '',
                html: `<div style="width:18px;height:18px;background:#00ff88;border:3px solid #fff;border-radius:50%;box-shadow:0 0 16px #00ff88;animation:pulse-green 1.5s infinite;"></div>`,
                iconSize: [18, 18], iconAnchor: [9, 9],
              })}
            >
              <Popup><div style={{ fontFamily: 'monospace', color: '#00ff88', padding: '4px' }}>📍 YOUR LOCATION</div></Popup>
            </Marker>
          )}

          {/* Selected node highlight */}
          {selectedPos && (
            <CircleMarker
              center={selectedPos}
              radius={14}
              pathOptions={{ fillColor: 'rgba(255,170,0,0.25)', fillOpacity: 1, color: 'var(--amber)', weight: 2 }}
            />
          )}
        </MapContainer>
      </div>
    </div>
  );
}
