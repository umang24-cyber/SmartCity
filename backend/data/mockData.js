// ================================================================
// MOCK DATA — mirrors exact TigerGraph vertex schemas
// When Group A shares their API, controllers swap axios calls in
// without changing any response shapes.
// ================================================================

// ── Intersection Vertex ──────────────────────────────────────────
// Schema: intersection_id, intersection_name, latitude, longitude,
//         baseline_safety_score, avg_crowd_density, last_updated,
//         historical_safety_trend, pagerank_centrality,
//         betweenness_score, safety_variance, peak_danger_hours,
//         weather_sensitivity, weekend_multiplier, cluster_id,
//         isolation_score
const mockIntersections = [
  {
    intersection_id: 'INT_001',
    intersection_name: 'MG Road & Brigade Rd',
    latitude: 12.9716,
    longitude: 77.5946,
    baseline_safety_score: 72.0,
    avg_crowd_density: 340,
    last_updated: '2025-01-15T20:00:00Z',
    historical_safety_trend: [72.0, 68.5, 71.2, 74.0, 69.8, 73.1, 70.5, 72.3, 71.8, 69.2, 70.7, 72.0],
    pagerank_centrality: 0.82,
    betweenness_score: 0.67,
    safety_variance: 8.4,
    peak_danger_hours: [22, 23, 0, 1, 2],
    weather_sensitivity: 0.3,
    weekend_multiplier: 0.85,
    cluster_id: 1,
    isolation_score: 0.15
  },
  {
    intersection_id: 'INT_002',
    intersection_name: 'Residency Road & Richmond Rd',
    latitude: 12.9698,
    longitude: 77.5981,
    baseline_safety_score: 58.0,
    avg_crowd_density: 120,
    last_updated: '2025-01-15T20:00:00Z',
    historical_safety_trend: [60.0, 55.0, 57.5, 58.0, 54.0, 56.5, 59.0, 57.0, 55.5, 58.5, 57.0, 58.0],
    pagerank_centrality: 0.45,
    betweenness_score: 0.38,
    safety_variance: 18.2,
    peak_danger_hours: [20, 21, 22, 23, 0],
    weather_sensitivity: 0.7,
    weekend_multiplier: 0.70,
    cluster_id: 1,
    isolation_score: 0.55
  },
  {
    intersection_id: 'INT_003',
    intersection_name: 'Cubbon Park North Gate',
    latitude: 12.9763,
    longitude: 77.5929,
    baseline_safety_score: 45.0,
    avg_crowd_density: 60,
    last_updated: '2025-01-15T20:00:00Z',
    historical_safety_trend: [48.0, 42.0, 44.5, 46.0, 43.0, 45.5, 47.0, 44.0, 43.5, 45.5, 44.0, 45.0],
    pagerank_centrality: 0.21,
    betweenness_score: 0.19,
    safety_variance: 24.7,
    peak_danger_hours: [19, 20, 21, 22, 23, 0, 1],
    weather_sensitivity: 0.9,
    weekend_multiplier: 1.1,
    cluster_id: 2,
    isolation_score: 0.78
  }
];

// ── SafetyFeature Vertex ──────────────────────────────────────────
// Schema: feature_id, feature_type, is_functional, reliability_score,
//         last_maintenance, lux_level, coverage_radius,
//         effectiveness_by_hour, maintenance_prediction,
//         criticality_score, synergy_features, cost_per_month,
//         installation_date, expected_lifespan_years
const mockSafetyFeatures = [
  {
    feature_id: 'LIGHT_042',
    feature_type: 'streetlight',
    is_functional: true,
    reliability_score: 0.92,
    last_maintenance: '2024-11-01T00:00:00Z',
    lux_level: 85.0,
    coverage_radius: 35.0,
    effectiveness_by_hour: { 18: 0.95, 19: 1.0, 20: 1.0, 21: 1.0, 22: 1.0, 23: 1.0, 0: 1.0, 1: 0.9 },
    maintenance_prediction: '2025-11-01T00:00:00Z',
    criticality_score: 7.2,
    synergy_features: ['CCTV_011'],
    cost_per_month: 120.0,
    installation_date: '2021-06-15T00:00:00Z',
    expected_lifespan_years: 10
  },
  {
    feature_id: 'CCTV_011',
    feature_type: 'cctv',
    is_functional: true,
    reliability_score: 0.78,
    last_maintenance: '2024-10-15T00:00:00Z',
    lux_level: 0.0,
    coverage_radius: 50.0,
    effectiveness_by_hour: { 20: 0.9, 21: 0.85, 22: 0.7, 23: 0.5, 0: 0.4, 1: 0.3 },
    maintenance_prediction: '2025-04-15T00:00:00Z',
    criticality_score: 8.5,
    synergy_features: ['LIGHT_042'],
    cost_per_month: 350.0,
    installation_date: '2022-03-10T00:00:00Z',
    expected_lifespan_years: 7
  },
  {
    feature_id: 'EMERGENCY_003',
    feature_type: 'emergency_button',
    is_functional: false,
    reliability_score: 0.40,
    last_maintenance: '2024-06-01T00:00:00Z',
    lux_level: 0.0,
    coverage_radius: 10.0,
    effectiveness_by_hour: {},
    maintenance_prediction: '2025-01-01T00:00:00Z',
    criticality_score: 9.1,
    synergy_features: [],
    cost_per_month: 80.0,
    installation_date: '2020-01-20T00:00:00Z',
    expected_lifespan_years: 8
  }
];

// ── TimeSlice Vertex ──────────────────────────────────────────────
// Schema: timeslice_id, ts_date, ts_hour, day_of_week, is_weekend,
//         is_holiday, weather_condition, temperature_celsius,
//         moon_phase, special_event, aggregate_safety
const getCurrentTimeSlice = () => {
  const now = new Date();
  const hour = now.getHours();
  const dow = now.getDay() === 0 ? 6 : now.getDay() - 1; // 0=Mon..6=Sun
  const isWeekend = dow >= 5;
  const dateStr = now.toISOString().split('T')[0];

  return {
    timeslice_id: `${dateStr}-${String(hour).padStart(2, '0')}`,
    ts_date: dateStr,
    ts_hour: hour,
    day_of_week: dow,
    is_weekend: isWeekend,
    is_holiday: false,
    weather_condition: 'clear',   // override via query param
    temperature_celsius: 22.0,
    moon_phase: 0.3,
    special_event: 'none',
    aggregate_safety: 68.0
  };
};

// ── SafetyCluster Vertex ──────────────────────────────────────────
// Schema: cluster_id, cluster_name, avg_cluster_safety,
//         num_intersections, primary_risk_factors,
//         recommended_interventions, cluster_type,
//         min_latitude, max_latitude, min_longitude, max_longitude
const mockClusters = [
  {
    cluster_id: 1,
    cluster_name: 'Central Business District',
    avg_cluster_safety: 64.0,
    num_intersections: 18,
    primary_risk_factors: ['poor_lighting', 'high_incident_rate_weekends', 'late_night_isolation'],
    recommended_interventions: [
      'Install 4 streetlights on Residency Road south end',
      'Deploy mobile CCTV unit on weekends',
      'Add emergency button near Brigade Rd ATM cluster'
    ],
    cluster_type: 'commercial',
    min_latitude: 12.965,
    max_latitude: 12.978,
    min_longitude: 77.588,
    max_longitude: 77.602
  },
  {
    cluster_id: 2,
    cluster_name: 'Cubbon Park Zone',
    avg_cluster_safety: 44.0,
    num_intersections: 7,
    primary_risk_factors: ['high_isolation_score', 'no_surveillance', 'low_foot_traffic_night'],
    recommended_interventions: [
      'Increase patrol frequency 8pm-6am',
      'Install motion-sensor lighting along park perimeter',
      'Add safe haven signage pointing to nearest police box'
    ],
    cluster_type: 'park',
    min_latitude: 12.973,
    max_latitude: 12.981,
    min_longitude: 77.589,
    max_longitude: 77.598
  }
];

// ── IncidentReport Vertex ─────────────────────────────────────────
// Schema: incident_id, incident_type, severity, reported_at,
//         verified, source
// Plus: lat, lng for map display (stored as edge in TigerGraph,
// kept flat here for frontend convenience)
const mockIncidents = [
  {
    incident_id: 'INC_001',
    incident_type: 'poor_lighting',
    severity: 4,
    reported_at: '2025-01-15T21:30:00Z',
    verified: true,
    source: 'user_report',
    lat: 12.9698,
    lng: 77.5981
  },
  {
    incident_id: 'INC_002',
    incident_type: 'felt_followed',
    severity: 5,
    reported_at: '2025-01-15T23:10:00Z',
    verified: true,
    source: 'user_report',
    lat: 12.9763,
    lng: 77.5929
  },
  {
    incident_id: 'INC_003',
    incident_type: 'broken_cctv',
    severity: 3,
    reported_at: '2025-01-14T19:45:00Z',
    verified: false,
    source: 'user_report',
    lat: 12.9720,
    lng: 77.5950
  },
  {
    incident_id: 'INC_004',
    incident_type: 'suspicious_activity',
    severity: 4,
    reported_at: '2025-01-15T22:00:00Z',
    verified: true,
    source: 'user_report',
    lat: 12.9745,
    lng: 77.5960
  },
  {
    incident_id: 'INC_005',
    incident_type: 'poor_lighting',
    severity: 2,
    reported_at: '2025-01-13T20:15:00Z',
    verified: false,
    source: 'user_report',
    lat: 12.9680,
    lng: 77.5940
  }
];

// ── Safe Route (computed from intersection chain) ─────────────────
const mockSafeRoute = {
  route: [
    { intersection_id: 'INT_001', lat: 12.9716, lng: 77.5946 },
    { intersection_id: 'INT_004', lat: 12.9725, lng: 77.5958 },
    { intersection_id: 'INT_005', lat: 12.9738, lng: 77.5965 }
  ],
  reason: [
    '3 functional streetlights (avg 85 lux) along this corridor',
    'CCTV coverage confirmed at INT_001 and INT_004',
    'Avoids INT_003 (isolation score 0.78 — limited escape routes)',
    'Betweenness score 0.67 — busy, people always around',
    'No verified incidents in last 48 hours on this path'
  ],
  avoided_intersections: ['INT_003'],
  total_distance_m: 380,
  safety_improvement_vs_shortest: '+22 points'
};

module.exports = {
  mockIntersections,
  mockSafetyFeatures,
  mockClusters,
  mockIncidents,
  mockSafeRoute,
  getCurrentTimeSlice
};