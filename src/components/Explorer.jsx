import React, { useMemo } from 'react';
import Map, { Source, Layer, Marker, Popup } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';

// Using a free tokenless base map style for MapLibre
const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

export default function Explorer({
  intersections = [],
  incidents = [],
  safeRoute = null,
  selectedIntersection = null,
}) {
  const [hoverInfo, setHoverInfo] = React.useState(null);

  // Default viewport centered around MG Road & Brigade Rd (INT_001)
  const initialViewState = {
    longitude: 77.5946,
    latitude: 12.9716,
    zoom: 14.5,
    pitch: 45,
    bearing: 0
  };

  // Convert intersections to GeoJSON features
  const intersectionGeojson = useMemo(() => {
    return {
      type: 'FeatureCollection',
      features: intersections.map(node => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [node.lng, node.lat] },
        properties: {
          id: node.intersection_id,
          name: node.intersection_name,
          score: node.baseline_safety_score,
          isolation: node.isolation_score,
          cluster_id: node.cluster_id
        }
      }))
    };
  }, [intersections]);

  // Convert incidents to GeoJSON for Heatmap
  const incidentGeojson = useMemo(() => {
    return {
      type: 'FeatureCollection',
      features: incidents
        .filter(inc => inc.lat && inc.lng)
        .map(inc => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [inc.lng, inc.lat] },
          properties: {
            id: inc.incident_id,
            type: inc.incident_type,
            severity: inc.severity,
            verified: inc.verified ? 1 : 0
          }
        }))
    };
  }, [incidents]);

  // Convert safeRoute to GeoJSON Polyline
  const routeGeojson = useMemo(() => {
    if (!safeRoute || !safeRoute.route || safeRoute.route.length === 0) return null;
    return {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {
            type: 'LineString',
            // Our route points might be dicts with lat/lng
            coordinates: safeRoute.route.map(pt => [pt.lng, pt.lat])
          },
          properties: { id: 'safe-route' }
        }
      ]
    };
  }, [safeRoute]);

  // Layer Styles
  const intersectionLayerStyle = {
    id: 'intersections-layer',
    type: 'circle',
    source: 'intersections',
    paint: {
      'circle-radius': [
        'interpolate', ['linear'], ['zoom'],
        10, 3,
        15, 6
      ],
      'circle-color': [
        'step',
        ['get', 'score'],
        '#ff3344', // <45 is red
        45, '#ffaa00', // >=45 is orange
        70, '#00ff88'  // >=70 is green
      ],
      'circle-opacity': 0.8,
      'circle-stroke-width': 1,
      'circle-stroke-color': '#fff'
    }
  };

  const heatmapLayerStyle = {
    id: 'incidents-heatmap',
    type: 'heatmap',
    source: 'incidents',
    maxzoom: 16,
    paint: {
      // Increase heatmap weight based on severity
      'heatmap-weight': [
        'interpolate',
        ['linear'],
        ['get', 'severity'],
        1, 0.2,
        5, 1
      ],
      // Color ramp
      'heatmap-color': [
        'interpolate',
        ['linear'],
        ['heatmap-density'],
        0, 'rgba(0,0,0,0)',
        0.2, 'rgba(255,170,0,0.4)',
        0.5, 'rgba(255,80,0,0.6)',
        1, 'rgba(255,0,0,0.9)'
      ],
      'heatmap-radius': [
        'interpolate', ['linear'], ['zoom'],
        10, 15,
        15, 40
      ],
      'heatmap-opacity': 0.7
    }
  };

  const routeLayerStyle = {
    id: 'safe-route-line',
    type: 'line',
    source: 'route',
    layout: {
      'line-join': 'round',
      'line-cap': 'round'
    },
    paint: {
      'line-color': '#00ff88',
      'line-width': 5,
      'line-opacity': 0.8,
      'line-dasharray': [1, 2] // animated effect via dash array if possible, or static dashed line
    }
  };

  // Find selected intersection marker
  const selectedNode = intersections.find(n => n.intersection_id === selectedIntersection);

  // Token is no longer required with MapLibre and open map styles

  return (
    <div className="panel panel-cut" style={{ height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      {/* HUD overlay header */}
      <div style={{
        position: 'absolute', top: 12, left: 16, zIndex: 10,
        fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'rgba(0,255,136,0.8)',
        lineHeight: 1.5, pointerEvents: 'none',
        background: 'rgba(3,13,24,0.6)', padding: '4px 8px', border: '1px solid var(--border)'
      }}>
        <div style={{ fontWeight: 'bold' }}>TACTICAL MAP VIEW</div>
        <div>NODES: {intersections.length}</div>
        <div>REPORTED THREATS: {incidents.length}</div>
      </div>

      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <Map
          initialViewState={initialViewState}
          mapStyle={MAP_STYLE}
          interactiveLayerIds={['intersections-layer']}
          onMouseMove={(e) => {
            if (e.features && e.features.length > 0) {
              const feature = e.features[0];
              setHoverInfo({
                longitude: e.lngLat.lng,
                latitude: e.lngLat.lat,
                name: feature.properties.name,
                id: feature.properties.id,
                score: feature.properties.score
              });
            } else {
              setHoverInfo(null);
            }
          }}
          onMouseLeave={() => setHoverInfo(null)}
        >
          {/* Danger Heatmap Source */}
          <Source id="incidents" type="geojson" data={incidentGeojson}>
            <Layer {...heatmapLayerStyle} />
          </Source>

          {/* Safe Route Source */}
          {routeGeojson && (
            <Source id="route" type="geojson" data={routeGeojson}>
              <Layer {...routeLayerStyle} />
            </Source>
          )}

          {/* Map Dots / Intersections */}
          <Source id="intersections" type="geojson" data={intersectionGeojson}>
            <Layer {...intersectionLayerStyle} />
          </Source>

          {/* Highlight Selected node if any */}
          {selectedNode && (
            <Marker longitude={selectedNode.lng} latitude={selectedNode.lat} anchor="bottom">
              <div className="pulse-amber" style={{
                width: 24, height: 24, borderRadius: '50%', border: '2px solid var(--amber)',
                background: 'rgba(255,170,0,0.3)'
              }} />
            </Marker>
          )}

          {hoverInfo && (
            <Popup
              longitude={hoverInfo.longitude}
              latitude={hoverInfo.latitude}
              closeButton={false}
              closeOnClick={false}
              anchor="top"
              style={{ padding: 0 }}
            >
              <div style={{
                background: 'rgba(3,13,24,0.95)',
                border: '1px solid var(--accent)',
                padding: '0.4rem 0.65rem',
                fontFamily: 'var(--font-mono)', fontSize: '0.65rem',
                color: 'var(--text-primary)',
              }}>
                <div style={{ color: 'var(--accent)', marginBottom: 2 }}>{hoverInfo.name}</div>
                <div style={{ color: 'var(--text-secondary)' }}>ID: {hoverInfo.id}</div>
                <div style={{ color: 'var(--text-secondary)' }}>SAFETY SCORE: {hoverInfo.score}</div>
              </div>
            </Popup>
          )}
        </Map>
      </div>
    </div>
  );
}
