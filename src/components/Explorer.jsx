import React, { useState, useEffect } from 'react';
import Map, { Source, Layer, Marker, Popup } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useTheme } from '../context/ThemeContext';

const MAP_STYLE_DARK = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';
const MAP_STYLE_LIGHT = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';

// --- Layer Configurations ---

const heatmapLayerConfig = {
  id: 'danger-heatmap',
  type: 'heatmap',
  source: 'heatmap-source',
  maxzoom: 16,
  paint: {
    'heatmap-weight': ['interpolate', ['linear'], ['get', 'danger_score'], 0, 0, 1, 1],
    'heatmap-color': [
      'interpolate', ['linear'], ['heatmap-density'],
      0, 'rgba(0,0,0,0)',
      0.3, 'rgba(0, 255, 136, 0.5)',   // Safe (Green)
      0.6, 'rgba(255, 170, 0, 0.7)',   // Moderate (Amber)
      1.0, 'rgba(255, 51, 68, 0.9)'    // High Danger (Red)
    ],
    'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 10, 15, 15, 50],
    'heatmap-opacity': 0.6
  }
};

const clusterLayerConfig = {
  id: 'cluster-layer',
  type: 'circle',
  source: 'cluster-source',
  paint: {
    'circle-radius': ['+', 10, ['*', 2, ['get', 'incident_count']]],
    'circle-color': 'rgba(255, 51, 68, 0.4)',
    'circle-stroke-color': '#ff3344',
    'circle-stroke-width': 2,
    'circle-opacity': 0.8
  }
};

const routeSegmentsConfig = {
  id: 'route-segments-layer',
  type: 'line',
  source: 'route-source',
  layout: {
    'line-join': 'round',
    'line-cap': 'round'
  },
  paint: {
    'line-color': ['get', 'color'],
    'line-width': 6,
    'line-opacity': 0.85
  }
};

// --- Main Component ---

export default function Explorer({ intersections = [], incidents = [], safeRoute = null, selectedIntersection = null, backendUrl = "http://localhost:8000" }) {
  const [hoverInfo, setHoverInfo] = useState(null);
  const { mode } = useTheme();
  
  // Data States
  const [heatmapData, setHeatmapData] = useState(null);
  const [clusterData, setClusterData] = useState(null);
  // Intersections are passed from Dashboard but we merge or fallback here if needed,
  // currently we just use the props
  
  const isValidGeoJSON = (d) => d && d.type && (d.type === 'FeatureCollection' || d.type === 'Feature');
  const safeRouteData = isValidGeoJSON(safeRoute?.segments) ? safeRoute.segments : null;
  const validHeatmap = isValidGeoJSON(heatmapData) ? heatmapData : null;
  const validClusters = isValidGeoJSON(clusterData) ? clusterData : null;

  // Toggles
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [showClusters, setShowClusters] = useState(true);
  
  useEffect(() => {
    // 1. Fetch Heatmap GeoJSON
    fetch(`${backendUrl}/api/v1/graph/heatmap/geojson`)
      .then(r => r.json())
      .then(data => setHeatmapData(data))
      .catch(e => console.error("Heatmap fetch error:", e));

    // 2. Fetch Clusters GeoJSON
    fetch(`${backendUrl}/api/v1/cluster-info/geojson`)
      .then(r => r.json())
      .then(data => setClusterData(data))
      .catch(e => console.error("Cluster fetch error:", e));

  }, [backendUrl]);

  // Base Viewport centered around Bengaluru
  const initialViewState = {
    longitude: 77.5946, latitude: 12.9716, zoom: 14.5, pitch: 45, bearing: 0
  };

  const selectedNode = intersections.find(n => n.intersection_id === selectedIntersection || n.zone_id === selectedIntersection);

  return (
    <div className="panel panel-cut" style={{ height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      
      {/* ── HUD OVERLAY ── */}
      <div style={{
        position: 'absolute', top: 12, left: 16, zIndex: 10,
        fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-primary)',
        background: 'var(--bg-panel)', padding: '8px 12px', border: '1px solid var(--border)',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
      }}>
        <div style={{ fontWeight: 'bold', color: 'var(--accent)', marginBottom: 8 }}>TACTICAL LAYER CONTROLS</div>
        <div style={{ marginBottom: 8 }}>Live incidents: {incidents.length}</div>
        <label style={{ display: 'block', cursor: 'pointer', marginBottom: 4 }}>
          <input type="checkbox" checked={showHeatmap} onChange={e => setShowHeatmap(e.target.checked)} /> Danger Heatmap
        </label>
        <label style={{ display: 'block', cursor: 'pointer' }}>
          <input type="checkbox" checked={showClusters} onChange={e => setShowClusters(e.target.checked)} /> Incident Clusters
        </label>
      </div>

      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <Map
          initialViewState={initialViewState}
          mapStyle={mode === 'dark' ? MAP_STYLE_DARK : MAP_STYLE_LIGHT}
          interactiveLayerIds={['cluster-layer', 'route-segments-layer']}
          onMouseMove={(e) => {
            if (e.features && e.features.length > 0) {
              const f = e.features[0];
              setHoverInfo({
                lng: e.lngLat.lng, lat: e.lngLat.lat,
                props: f.properties,
                layerId: f.layer.id
              });
            } else { setHoverInfo(null); }
          }}
          onMouseLeave={() => setHoverInfo(null)}
        >
          {/* ── HEATMAP LAYER ── */}
          {showHeatmap && validHeatmap && (
            <Source id="heatmap-source" type="geojson" data={validHeatmap}>
              <Layer {...heatmapLayerConfig} />
            </Source>
          )}

          {/* ── CLUSTERS LAYER ── */}
          {showClusters && validClusters && (
            <Source id="cluster-source" type="geojson" data={validClusters}>
              <Layer {...clusterLayerConfig} />
            </Source>
          )}

          {/* ── SAFE ROUTE SEGMENTS LAYER ── */}
          {safeRouteData && (
            <Source id="route-source" type="geojson" data={safeRouteData}>
              <Layer {...routeSegmentsConfig} />
            </Source>
          )}

          {/* ── INTERSECTION MARKERS ── */}
          {intersections.map(node => (
             <Marker key={node.zone_id || node.intersection_id} longitude={node.lng} latitude={node.lat}>
                <div style={{
                  width: 12, height: 12, borderRadius: '50%',
                  background: node.danger_score > 0.7 ? '#ff3344' : node.danger_score > 0.4 ? '#ffaa00' : '#00ff88',
                  border: '2px solid #fff', boxShadow: '0 0 10px rgba(0,0,0,0.5)'
                }}/>
             </Marker>
          ))}

          {/* ── HIGHLIGHT SELECTED NODE ── */}
          {selectedNode && (
            <Marker longitude={selectedNode.lng} latitude={selectedNode.lat} anchor="bottom">
              <div className="pulse-amber" style={{
                width: 24, height: 24, borderRadius: '50%', border: '2px solid var(--amber)',
                background: 'rgba(255,170,0,0.3)'
              }} />
            </Marker>
          )}

          {/* ── INTERACTIVE POPUPS ── */}
          {hoverInfo && (
            <Popup
              longitude={hoverInfo.lng} latitude={hoverInfo.lat}
              closeButton={false} anchor="bottom" offset={15}
            >
              <div style={{
                background: 'rgba(10, 15, 25, 0.95)', border: '1px solid var(--accent)',
                padding: '8px', fontFamily: 'var(--font-mono)', color: '#fff'
              }}>
                {hoverInfo.layerId === 'cluster-layer' && (
                  <>
                    <strong style={{ color: '#ff3344' }}>⚠️ Alert Cluster</strong><br/>
                    Count: {hoverInfo.props.incident_count}<br/>
                    Area Radius: {Math.round(hoverInfo.props.radius_km * 1000)}m
                  </>
                )}
                {hoverInfo.layerId === 'route-segments-layer' && (
                  <>
                    <strong style={{ color: hoverInfo.props.color }}>Route Segment</strong><br/>
                    Threat Level: {(hoverInfo.props.danger_level || 'Unknown').toUpperCase()}<br/>
                    <span style={{ color: 'var(--accent)' }}>AI Risk: {hoverInfo.props.danger_level === 'high' ? 'HIGH' : hoverInfo.props.danger_level === 'medium' ? 'MEDIUM' : 'LOW'}</span><br/>
                  </>
                )}
              </div>
            </Popup>
          )}
        </Map>
      </div>
    </div>
  );
}
