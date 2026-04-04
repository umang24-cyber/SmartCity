import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, GeoJSON, useMap } from 'react-leaflet';
import * as L from 'leaflet';
import { useTheme } from '../context/ThemeContext';
import { fetchReports } from '../api/smartcity';

const TILE_LAYER_DARK = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
const TILE_LAYER_LIGHT = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

// --- Initialization ---

function initLeafletIcons() {
  if (typeof window !== 'undefined' && L.Icon && L.Icon.Default) {
    try {
      delete L.Icon.Default.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
      });
    } catch (e) {
      console.warn('Leaflet icon init failed:', e);
    }
  }
}

// --- Utility ---

function MapUpdater({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.setView(center, zoom || map.getZoom());
  }, [center, zoom, map]);
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

// --- Main Component ---

export default function Explorer({
  intersections = [],
  incidents = [],
  safeRoute = null,
  safeZones = [],
  selectedIntersection = null,
  backendUrl = 'http://127.0.0.1:8000',
}) {
  const { mode } = useTheme();

  useEffect(() => { initLeafletIcons(); }, []);

  const [heatmapData, setHeatmapData]     = useState(null);
  const [clusterData, setClusterData]     = useState(null);
  const [liveReports, setLiveReports]     = useState([]);
  const [reportsLoading, setReportsLoading] = useState(true);

  const [showHeatmap, setShowHeatmap]     = useState(true);
  const [showClusters, setShowClusters]   = useState(true);
  const [showReports, setShowReports]     = useState(true);

  // ── Fetch live reports ────────────────────────────────────────────
  const fetchLiveReports = async () => {
    try {
      const data = await fetchReports({ limit: 200 });
      if (Array.isArray(data)) {
        setLiveReports(data.filter(r => r.lat != null && r.lng != null));
      }
    } catch (e) {
      console.warn('Live reports fetch failed (backend possibly offline):', e);
    } finally {
      setReportsLoading(false);
    }
  };

  useEffect(() => {
    fetchLiveReports();
    const interval = setInterval(fetchLiveReports, 30000);
    return () => clearInterval(interval);
  }, []);

  // ── Fetch GeoJSON layers ──────────────────────────────────────────
  useEffect(() => {
    const parse = async (res) => {
      const text = await res.text();
      let data = null;
      try { data = text ? JSON.parse(text) : null; } catch { data = null; }
      if (!res.ok) throw new Error(data?.detail || text || `HTTP ${res.status}`);
      return data;
    };

    fetch(`${backendUrl}/api/v1/graph/heatmap/geojson`)
      .then(parse).then(d => setHeatmapData(d))
      .catch(e => console.warn('Heatmap fetch (offline):', e));

    fetch(`${backendUrl}/api/v1/cluster-info/geojson`)
      .then(parse).then(d => setClusterData(d))
      .catch(e => console.warn('Cluster fetch (offline):', e));
  }, [backendUrl]);

  const initialCenter = [12.9716, 77.5946];
  const initialZoom = 14;

  const selectedNode = intersections.find(
    n => n.intersection_id === selectedIntersection || n.zone_id === selectedIntersection,
  );
  const selectedPos = selectedNode ? [selectedNode.lat, selectedNode.lng] : null;

  const heatmapStyle = (feature) => ({
    fillColor: feature.properties.danger_score > 0.7 ? '#ff3344'
      : feature.properties.danger_score > 0.4 ? '#ffaa00' : '#00ff88',
    fillOpacity: 0.4,
    color: 'transparent',
    radius: 20,
  });

  const clusterStyle = (feature) => ({
    fillColor: '#ff3344',
    fillOpacity: 0.6,
    color: '#ff3344',
    weight: 2,
    radius: 15 + (feature.properties.incident_count * 2),
  });

  const routeStyle = (feature) => ({
    color: feature.properties.color || '#00ff88',
    weight: 6,
    opacity: 0.85,
  });

  return (
    <div className="panel panel-cut" style={{ height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>

      {/* ── HUD OVERLAY ── */}
      <div style={{
        position: 'absolute', top: 12, left: 16, zIndex: 1000,
        fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-primary)',
        background: 'var(--bg-panel)', padding: '8px 12px', border: '1px solid var(--border)',
        boxShadow: '0 4px 12px rgba(0,0,0,0.18)', backdropFilter: 'blur(4px)',
        minWidth: 196,
      }}>
        <div style={{ fontWeight: 'bold', color: 'var(--accent)', marginBottom: 8 }}>TACTICAL LAYER CONTROLS</div>

        <label style={{ display: 'block', cursor: 'pointer', marginBottom: 4 }}>
          <input type="checkbox" checked={showHeatmap} onChange={e => setShowHeatmap(e.target.checked)} /> Danger Heatmap
        </label>
        <label style={{ display: 'block', cursor: 'pointer', marginBottom: 4 }}>
          <input type="checkbox" checked={showClusters} onChange={e => setShowClusters(e.target.checked)} /> Incident Clusters
        </label>
        <label style={{ display: 'block', cursor: 'pointer' }}>
          <input type="checkbox" checked={showReports} onChange={e => setShowReports(e.target.checked)} /> Live Reports
          {liveReports.length > 0 && (
            <span style={{
              marginLeft: 6, fontSize: '0.58rem', padding: '1px 5px',
              background: 'rgba(255,51,68,0.15)', border: '1px solid var(--red-alert)',
              color: 'var(--red-alert)', verticalAlign: 'middle',
            }}>{liveReports.length}</span>
          )}
        </label>

        {showReports && liveReports.length > 0 && (
          <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
            <div style={{ fontSize: '0.56rem', color: 'var(--text-secondary)', marginBottom: 4 }}>INCIDENT MARKERS</div>
            {[
              { label: 'CRITICAL', color: '#ff3344' },
              { label: 'HIGH',     color: '#ff6600' },
              { label: 'MEDIUM',   color: '#ffaa00' },
              { label: 'LOW',      color: '#00cc66' },
            ].map(({ label, color }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
                <span style={{ fontSize: '0.58rem', color: 'var(--text-secondary)' }}>{label}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <MapContainer
          center={initialCenter}
          zoom={initialZoom}
          style={{ height: '100%', width: '100%' }}
          zoomControl={false}
        >
          <TileLayer
            url={mode === 'dark' ? TILE_LAYER_DARK : TILE_LAYER_LIGHT}
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />

          <MapUpdater center={selectedPos} zoom={16} />

          {/* ── HEATMAP ── */}
          {showHeatmap && heatmapData && (
            <GeoJSON
              data={heatmapData}
              pointToLayer={(feature, latlng) => L.circleMarker(latlng, heatmapStyle(feature))}
            />
          )}

          {/* ── CLUSTERS ── */}
          {showClusters && clusterData && (
            <GeoJSON
              data={clusterData}
              pointToLayer={(feature, latlng) => L.circleMarker(latlng, clusterStyle(feature))}
              onEachFeature={(feature, layer) => {
                layer.bindPopup(`
                  <div style="font-family: monospace; color: #fff; background: rgba(10,15,25,0.92); padding: 8px;">
                    <strong style="color: #ff3344">⚠ Alert Cluster</strong><br/>
                    Count: ${feature.properties.incident_count}<br/>
                    Radius: ${Math.round(feature.properties.radius_km * 1000)}m
                  </div>
                `);
              }}
            />
          )}

          {/* ── SAFE ROUTE ── */}
          {safeRoute?.segments && (
            <GeoJSON data={safeRoute.segments} style={routeStyle} />
          )}

          {/* ── LIVE REPORT MARKERS (from unified /reports endpoint) ── */}
          {showReports && liveReports.map((report, idx) => {
            const color = emergencyColor(report.emergency_level);
            const sev = Math.min(5, Math.max(1, report.severity || 1));
            const sevPct = ((sev - 1) / 4) * 100;
            const ts = report.timestamp
              ? new Date(report.timestamp).toLocaleString()
              : 'Unknown time';

            return (
              <Marker
                key={report.report_id || `r_${idx}`}
                position={[report.lat, report.lng]}
                icon={L.divIcon({
                  className: 'report-marker-icon',
                  html: `<div style="
                    width:14px; height:14px;
                    background:${color};
                    border:2px solid rgba(255,255,255,0.8);
                    border-radius:50%;
                    box-shadow:0 0 8px ${color},0 0 16px ${color}44;
                  "></div>`,
                  iconSize: [14, 14],
                  iconAnchor: [7, 7],
                })}
              >
                <Popup>
                  <div style={{
                    fontFamily: 'monospace', fontSize: '0.78rem',
                    background: 'rgba(10,15,25,0.95)',
                    color: '#e2e8f0', padding: '10px 12px', minWidth: 200,
                    border: `1px solid ${color}55`,
                  }}>
                    <div style={{ color, fontWeight: 'bold', marginBottom: 6, fontSize: '0.8rem' }}>
                      {report.emergency_level || 'REPORT'}
                    </div>

                    <div style={{ marginBottom: 6 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2, fontSize: '0.7rem' }}>
                        <span style={{ color: '#94a3b8' }}>Severity</span>
                        <span style={{ color }}>{sev.toFixed(1)} / 5</span>
                      </div>
                      <div style={{ height: 3, background: 'rgba(255,255,255,0.1)', borderRadius: 2 }}>
                        <div style={{ height: 3, width: `${sevPct}%`, background: color, borderRadius: 2 }} />
                      </div>
                    </div>

                    {report.incident_type && (
                      <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginBottom: 4 }}>
                        Type: <span style={{ color: '#e2e8f0' }}>{report.incident_type.replace(/_/g, ' ').toUpperCase()}</span>
                      </div>
                    )}
                    {report.distress_level && (
                      <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginBottom: 4 }}>
                        Distress: <span style={{ color: '#e2e8f0' }}>{report.distress_level}</span>
                      </div>
                    )}
                    <div style={{ fontSize: '0.65rem', color: '#64748b', marginTop: 6, borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 6 }}>
                      {ts}
                    </div>
                    <div style={{ fontSize: '0.6rem', color: '#475569', marginTop: 2 }}>
                      {report.report_id}
                    </div>
                  </div>
                </Popup>
              </Marker>
            );
          })}

          {/* ── INTERSECTION DOTS (TigerGraph data) ── */}
          {intersections.map(node => (
            <Marker
              key={node.zone_id || node.intersection_id}
              position={[node.lat, node.lng]}
              icon={L.divIcon({
                className: 'custom-div-icon',
                html: `<div style="
                  width:10px; height:10px;
                  background:${node.danger_score > 0.7 ? '#ff3344' : node.danger_score > 0.4 ? '#ffaa00' : '#00ff88'};
                  border:2px solid #fff; border-radius:50%;
                  opacity:0.75; box-shadow:0 0 6px rgba(0,0,0,0.4);
                "></div>`,
                iconSize: [10, 10],
                iconAnchor: [5, 5],
              })}
            />
          ))}

          {/* ── SAFE ZONES ── */}
          {safeZones?.map((zone, idx) => (
            <Marker
              key={`safezone-${idx}`}
              position={[zone.lat, zone.lng]}
              icon={L.divIcon({
                className: 'safe-zone-icon',
                html: `<div style="
                  width:20px; height:20px; display:flex; align-items:center;
                  justify-content:center; background:rgba(0,150,255,0.2);
                  border:2px solid #0096ff; border-radius:4px;
                  box-shadow:0 0 10px rgba(0,150,255,0.5); font-size:10px;
                ">🛡️</div>`,
                iconSize: [20, 20],
                iconAnchor: [10, 10],
              })}
            >
              <Popup>
                <div style={{ fontFamily: 'monospace', color: '#0096ff', background: 'rgba(10,15,25,0.9)', padding: '6px' }}>
                  <strong>{zone.name}</strong><br />
                  Type: {zone.type.replace('_', ' ')}<br />
                  {zone.is_open_now ? '✅ Open' : '❌ Closed'}
                </div>
              </Popup>
            </Marker>
          ))}

          {/* ── SELECTED NODE ── */}
          {selectedPos && (
            <Marker
              position={selectedPos}
              icon={L.divIcon({
                className: 'pulse-amber',
                html: `<div style="width:24px;height:24px;border:2px solid var(--amber);border-radius:50%;background:rgba(255,170,0,0.3);"></div>`,
                iconSize: [24, 24],
                iconAnchor: [12, 12],
              })}
            />
          )}
        </MapContainer>
      </div>
    </div>
  );
}
