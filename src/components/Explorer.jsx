import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, GeoJSON, useMap } from 'react-leaflet';
import * as L from 'leaflet';
import { useTheme } from '../context/ThemeContext';

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
      console.warn("Leaflet icon init failed:", e);
    }
  }
}

// --- Utility Components ---

function MapUpdater({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.setView(center, zoom || map.getZoom());
  }, [center, zoom, map]);
  return null;
}

// --- Main Component ---

export default function Explorer({ 
  intersections = [], 
  incidents = [], 
  safeRoute = null, 
  safeZones = [], 
  selectedIntersection = null, 
  backendUrl = "http://127.0.0.1:8000" 
}) {
  const { mode } = useTheme();

  useEffect(() => {
    initLeafletIcons();
  }, []);
  
  // Data States
  const [heatmapData, setHeatmapData] = useState(null);
  const [clusterData, setClusterData] = useState(null);

  // Toggles
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [showClusters, setShowClusters] = useState(true);

  useEffect(() => {
    const parse = async (res) => {
      const text = await res.text();
      let data = null;
      try { data = text ? JSON.parse(text) : null; } catch { data = null; }
      if (!res.ok) throw new Error(data?.detail || text || `HTTP ${res.status}`);
      return data;
    };

    // 1. Fetch Heatmap GeoJSON
    fetch(`${backendUrl}/api/v1/graph/heatmap/geojson`)
      .then(parse)
      .then(data => setHeatmapData(data))
      .catch(e => console.warn("Heatmap fetch error (possibly offline):", e));

    // 2. Fetch Clusters GeoJSON
    fetch(`${backendUrl}/api/v1/cluster-info/geojson`)
      .then(parse)
      .then(data => setClusterData(data))
      .catch(e => console.warn("Cluster fetch error (possibly offline):", e));
  }, [backendUrl]);

  const initialCenter = [12.9716, 77.5946]; // [lat, lng] — Leaflet order
  const initialZoom = 14;

  const selectedNode = intersections.find(n => n.intersection_id === selectedIntersection || n.zone_id === selectedIntersection);
  const selectedPos = selectedNode ? [selectedNode.lat, selectedNode.lng] : null;

  // Layer Styling
  const heatmapStyle = (feature) => ({
    fillColor: feature.properties.danger_score > 0.7 ? '#ff3344' : feature.properties.danger_score > 0.4 ? '#ffaa00' : '#00ff88',
    fillOpacity: 0.4,
    color: 'transparent',
    radius: 20
  });

  const clusterStyle = (feature) => ({
    fillColor: '#ff3344',
    fillOpacity: 0.6,
    color: '#ff3344',
    weight: 2,
    radius: 15 + (feature.properties.incident_count * 2)
  });

  const routeStyle = (feature) => ({
    color: feature.properties.color || '#00ff88',
    weight: 6,
    opacity: 0.85
  });

  return (
    <div className="panel panel-cut" style={{ height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      
      {/* ── HUD OVERLAY ── */}
      <div style={{
        position: 'absolute', top: 12, left: 16, zIndex: 1000,
        fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-primary)',
        background: 'var(--bg-panel)', padding: '8px 12px', border: '1px solid var(--border)',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)', backdropFilter: 'blur(4px)'
      }}>
        <div style={{ fontWeight: 'bold', color: 'var(--accent)', marginBottom: 8 }}>TACTICAL LAYER CONTROLS</div>
        <label style={{ display: 'block', cursor: 'pointer', marginBottom: 4 }}>
          <input type="checkbox" checked={showHeatmap} onChange={e => setShowHeatmap(e.target.checked)} /> Danger Heatmap
        </label>
        <label style={{ display: 'block', cursor: 'pointer' }}>
          <input type="checkbox" checked={showClusters} onChange={e => setShowClusters(e.target.checked)} /> Incident Clusters
        </label>
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

          {/* ── HEATMAP LAYER (Simulated with Circles) ── */}
          {showHeatmap && heatmapData && (
             <GeoJSON 
               data={heatmapData} 
               pointToLayer={(feature, latlng) => L.circleMarker(latlng, heatmapStyle(feature))}
             />
          )}

          {/* ── CLUSTERS LAYER ── */}
          {showClusters && clusterData && (
             <GeoJSON 
               data={clusterData} 
               pointToLayer={(feature, latlng) => L.circleMarker(latlng, clusterStyle(feature))}
               onEachFeature={(feature, layer) => {
                 layer.bindPopup(`
                   <div style="font-family: var(--font-mono); color: #fff; background: rgba(10,15,25,0.9); padding: 8px;">
                     <strong style="color: #ff3344">⚠️ Alert Cluster</strong><br/>
                     Count: ${feature.properties.incident_count}<br/>
                     Radius: ${Math.round(feature.properties.radius_km * 1000)}m
                   </div>
                 `);
               }}
             />
          )}

          {/* ── SAFE ROUTE ── */}
          {safeRoute?.segments && (
            <GeoJSON 
              data={safeRoute.segments} 
              style={routeStyle}
            />
          )}

          {/* ── MARKERS ── */}
          {intersections.map(node => (
            <Marker 
              key={node.zone_id || node.intersection_id} 
              position={[node.lat, node.lng]}
              icon={L.divIcon({
                className: 'custom-div-icon',
                html: `<div style="width: 12px; height: 12px; background: ${node.danger_score > 0.7 ? '#ff3344' : node.danger_score > 0.4 ? '#ffaa00' : '#00ff88'}; border: 2px solid #fff; border-radius: 50%; box-shadow: 0 0 10px rgba(0,0,0,0.5);"></div>`,
                iconSize: [12, 12],
                iconAnchor: [6, 6]
              })}
            />
          ))}

          {/* ── SAFE ZONES (Havens & Police) ── */}
          {safeZones?.map((zone, idx) => (
            <Marker 
              key={`safezone-${idx}`} 
              position={[zone.lat, zone.lng]}
              icon={L.divIcon({
                className: 'safe-zone-icon',
                html: `<div style="width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; background: rgba(0, 150, 255, 0.2); border: 2px solid #0096ff; border-radius: 4px; box-shadow: 0 0 10px rgba(0,150,255,0.5); font-size: 10px;">🛡️</div>`,
                iconSize: [20, 20],
                iconAnchor: [10, 10]
              })}
            >
               <Popup>
                 <div style={{ fontFamily: 'var(--font-mono)', color: '#0096ff', background: 'rgba(10,15,25,0.9)', padding: '4px' }}>
                   <strong>{zone.name}</strong><br/>
                   Type: {zone.type.replace('_', ' ')}<br/>
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
                html: `<div style="width: 24px; height: 24px; border: 2px solid var(--amber); border-radius: 50%; background: rgba(255,170,0,0.3);"></div>`,
                iconSize: [24, 24],
                iconAnchor: [12, 12]
              })}
            />
          )}
        </MapContainer>
      </div>
    </div>
  );
}
