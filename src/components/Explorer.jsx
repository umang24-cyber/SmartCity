import React, { useMemo } from 'react';
import Map, { Source, Layer, Marker } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';

// You will need to provide a Mapbox token either via env var or prop
const MAPBOX_TOKEN = 'pk.eyJ1IjoiYmFyZGFpIiwiYSI6ImNsbzh2YzF3cTBibmwya21zMjA3dDBtYTQifQ.R6hH2bT1Q2x_b_V8aA_ZLQ';  // Fallback demo token or use process.env.VITE_MAPBOX_TOKEN

export default function Explorer({ route, incidents }) {
  // Convert backend incidents to GeoJSON for the Heatmap
  const heatmapData = useMemo(() => {
    return {
      type: 'FeatureCollection',
      features: (incidents || []).map(inc => ({
        type: 'Feature',
        properties: {
          severity: inc.severity || 1,
          type: inc.incident_type
        },
        geometry: {
          type: 'Point',
          coordinates: [inc.lng, inc.lat] // Mapbox takes [lng, lat]
        }
      }))
    };
  }, [incidents]);

  // Convert backend route coordinates to GeoJSON Polyline
  // The backend route is an array: [[lat, lng], [lat, lng]]
  const routeData = useMemo(() => {
    if (!route || route.length === 0) return null;
    return {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: route.map(coord => [coord[1], coord[0]]) // Mapbox expects [lng, lat]
      }
    };
  }, [route]);

  // Heatmap styling layer definition
  const heatmapLayer = {
    id: 'incidents-heat',
    type: 'heatmap',
    source: 'incidents',
    paint: {
      'heatmap-weight': ['interpolate', ['linear'], ['get', 'severity'], 1, 0.2, 5, 1],
      'heatmap-intensity': 1.5,
      'heatmap-color': [
        'interpolate', ['linear'], ['heatmap-density'],
        0, 'rgba(0, 0, 0, 0)',
        0.2, 'rgba(255, 60, 60, 0.2)',
        0.5, 'rgba(255, 60, 60, 0.5)',
        1, 'rgba(255, 0, 0, 0.9)'
      ],
      'heatmap-radius': 30,
      'heatmap-opacity': 0.8
    }
  };

  // Safe Route line layer definition
  const routeLayer = {
    id: 'safe-route-line',
    type: 'line',
    source: 'route',
    layout: {
      'line-join': 'round',
      'line-cap': 'round'
    },
    paint: {
      'line-color': '#00ffcc', // Cyberpunk neon cyan
      'line-width': 4,
      'line-opacity': 0.8
    }
  };

  return (
    <div className="glass rounded-2xl p-6 h-full flex flex-col border border-white/5 overflow-hidden">
      <div className="flex justify-between items-center mb-4 z-10">
        <h3 className="font-bold text-lg">Geospatial Explorer</h3>
        <span className="text-xs bg-accent/20 text-accent px-2 py-1 rounded-full animate-pulse border border-accent/30 font-bold uppercase tracking-widest">Live Mapbox Feed</span>
      </div>
      
      <div className="flex-1 relative rounded-xl overflow-hidden group">
        <Map
          initialViewState={{
            longitude: 77.5946, 
            latitude: 12.9716, // Default Bangalore
            zoom: 13,
            pitch: 45 // 3D perspective
          }}
          mapStyle="mapbox://styles/mapbox/dark-v11" // Night mode style
          mapboxAccessToken={MAPBOX_TOKEN}
        >
          {/* Heatmap Layer */}
          {incidents && incidents.length > 0 && (
            <Source id="incidents" type="geojson" data={heatmapData}>
              <Layer {...heatmapLayer} />
            </Source>
          )}

          {/* Route Layer */}
          {routeData && (
            <Source id="route" type="geojson" data={routeData}>
              <Layer {...routeLayer} />
            </Source>
          )}
        </Map>

        {/* HUD Overlay Elements */}
        <div className="absolute bottom-4 right-4 text-[10px] font-mono text-accent/60 flex flex-col items-end pointer-events-none">
            <span>MAP_ENGINE: MAPBOX_GL</span>
            <span>LAYERS_SYNCED: 100%</span>
        </div>
      </div>
    </div>
  );
}
