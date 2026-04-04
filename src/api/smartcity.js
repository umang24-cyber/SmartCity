// src/api/smartcity.js
// Unified API client with defensive parsing + response normalization.

const API_ORIGIN = (import.meta.env.VITE_API_ORIGIN || 'http://127.0.0.1:8000').replace(/\/$/, '');
const API_BASE_URL = `${API_ORIGIN}/api/v1`;

const buildUrl = (endpoint) => {
  if (/^https?:\/\//i.test(endpoint)) return endpoint;
  return `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
};

const parseJsonSafe = (rawText) => {
  if (!rawText) return null;
  try {
    return JSON.parse(rawText);
  } catch {
    return null;
  }
};

const readResponse = async (response) => {
  const rawText = await response.text();
  const data = parseJsonSafe(rawText);

  if (!response.ok) {
    const detail = data?.detail || rawText || `Server error: ${response.status}`;
    throw new Error(detail);
  }

  return data;
};

const mapSeverityToNumber = (severity) => {
  if (typeof severity === 'number') return severity;
  const normalized = String(severity || '').toLowerCase();
  if (normalized === 'critical') return 5;
  if (normalized === 'high') return 4;
  if (normalized === 'medium') return 3;
  if (normalized === 'low') return 2;
  return 3;
};

const normalizeIncidents = (payload) => {
  const incidents = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.incidents)
      ? payload.incidents
      : [];

  return incidents.map((incident) => ({
    ...incident,
    severity: mapSeverityToNumber(incident?.severity),
    severity_label: incident?.severity_label || String(incident?.severity || '').toLowerCase(),
    reported_at: incident?.reported_at || incident?.timestamp || new Date().toISOString(),
  }));
};

const normalizeIntersections = (payload) => {
  const intersections = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.intersections)
      ? payload.intersections
      : Array.isArray(payload?.zones)
        ? payload.zones
        : [];

  return intersections.map((item, idx) => ({
    ...item,
    intersection_id: item?.intersection_id || item?.zone_id || `ZONE_${idx + 1}`,
    intersection_name: item?.intersection_name || item?.name || item?.zone_id || `Zone ${idx + 1}`,
    danger_score: Number(item?.danger_score ?? 0),
  }));
};

const normalizeCluster = (payload) => {
  const clusters = Array.isArray(payload?.clusters) ? payload.clusters : [];
  const chosen = clusters[0];

  if (!chosen) return null;

  const avgDanger = Number(chosen.avg_danger_score ?? 0.5);
  const avgClusterSafety = Math.max(0, Math.min(100, Math.round((1 - avgDanger) * 100)));

  const primaryRiskFactors = avgDanger >= 0.75
    ? ['high_incident_rate_weekends', 'late_night_isolation', 'poor_lighting']
    : avgDanger >= 0.5
      ? ['poor_lighting', 'no_surveillance']
      : ['low_foot_traffic_night'];

  return {
    cluster_id: chosen.cluster_id || 1,
    cluster_name: `Cluster ${chosen.cluster_id || 1}`,
    avg_cluster_safety: avgClusterSafety,
    num_intersections: Number(chosen.zone_count ?? 0),
    primary_risk_factors: primaryRiskFactors,
    recommended_interventions: [
      'Increase patrol frequency in high-risk blocks',
      'Improve streetlight uptime and preventive maintenance',
      'Add active CCTV coverage near incident concentration points',
    ],
    cluster_type: 'commercial',
    raw: chosen,
  };
};

const normalizeSafeRoute = (payload) => {
  if (!payload) return payload;
  if (payload?.stats) return payload;

  if (payload?.safest_route) {
    return {
      route: payload.safest_route.route_geojson,
      segments: payload.safest_route.segments,
      waypoints: [],
      stats: {
        overall_danger_score: payload.safest_route.overall_danger_score ?? payload.safest_route.danger_score,
        danger_level: payload.safest_route.danger_level,
        distance_m: payload.safest_route.distance_m,
        estimated_time_minutes: payload.safest_route.estimated_time_min ?? payload.safest_route.estimated_time_minutes,
        recommendation: payload.safest_route.recommendation,
      },
      start: payload.start,
      end: payload.end,
      shortest_route: payload.shortest_route,
      safest_route: payload.safest_route,
    };
  }

  return payload;
};

export const apiFetch = async (endpoint, token = null, options = {}) => {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(buildUrl(endpoint), {
    method: options.method || 'GET',
    ...options,
    headers,
  });

  return readResponse(response);
};

export const apiPost = async (endpoint, body, token = null, options = {}) => {
  return apiFetch(endpoint, token, {
    method: 'POST',
    body: JSON.stringify(body),
    ...options,
  });
};


// Auth Operations

export const loginUser = async (email, password) =>
  apiPost('/auth/login/user', { email, password });

export const loginSupervisor = async (email, accessKey) =>
  apiPost('/auth/login/supervisor', { email, access_key: accessKey });

export const signupUser = async (name, email, password) =>
  apiPost('/auth/signup/user', { name, email, password });

export const signupSupervisor = async (name, email, password, accessKey) =>
  apiPost('/auth/signup/supervisor', { name, email, password, access_key: accessKey });

export const signupUserWithGoogle = async (name, email) =>
  apiPost('/auth/signup/google', { name, email });

export const getMe = async (token) =>
  apiFetch('/auth/me', token);


// Incident Operations

export const fetchIntersections = async () => {
  const payload = await apiFetch('/intersections');
  return normalizeIntersections(payload);
};

export const fetchIncidents = async (verifiedOnly = false) => {
  const payload = await apiFetch(verifiedOnly ? '/incidents?verified=true' : '/incidents');
  return normalizeIncidents(payload);
};

export const postReport = async (reportData, token) =>
  apiPost('/reports', reportData, token);

/**
 * submitAndAnalyzeReport — the canonical ONE-CALL submission path.
 *
 * Sends text + optional location/metadata to POST /reports.
 * Backend runs NLP and returns the full enriched analysis.
 *
 * @param {Object} payload  - { text, lat?, lng?, incident_type?, source? }
 * @param {string} [token]  - JWT bearer token (optional for public reports)
 * @returns {Promise<Object>} Full EnrichedReportResponse from backend
 */
export const submitAndAnalyzeReport = async (payload, token = null) =>
  apiPost('/reports', payload, token);

export const analyzeReport = async (text, token = null) =>
  apiPost('/reports/analyze', { text }, token);

/**
 * fetchReports — retrieve stored enriched reports, optionally filtered.
 *
 * @param {{ minSeverity?: number, emergencyLevel?: string, limit?: number }} opts
 */
export const fetchReports = async ({ minSeverity, emergencyLevel, limit = 200 } = {}) => {
  const params = new URLSearchParams();
  if (minSeverity != null) params.set('min_severity', minSeverity);
  if (emergencyLevel)       params.set('emergency_level', emergencyLevel);
  if (limit != null)        params.set('limit', limit);
  const qs = params.toString();
  return apiFetch(qs ? `/reports?${qs}` : '/reports');
};


// Route Operations

export const getSafeRoute = async (start, end) => {
  if (!start || !end) return fetchSafeRoute();
  return fetchSafeRoute(start.lat, start.lng, end.lat, end.lng);
};

export const fetchSafeRoute = async (start_lat, start_lng, end_lat, end_lng) => {
  if (!start_lat) {
    const payload = await apiFetch('/safe-route/?start_lat=12.9716&start_lng=77.5946&end_lat=12.9738&end_lng=77.5965');
    return normalizeSafeRoute(payload);
  }
  const payload = await apiFetch(`/safe-route/?start_lat=${start_lat}&start_lng=${start_lng}&end_lat=${end_lat}&end_lng=${end_lng}`);
  return normalizeSafeRoute(payload);
};

/** Portal dual-route (safest + shortest GeoJSON) */
export const fetchDualRoute = async (sourceLat, sourceLng, destLat, destLng, mode = 'walking') =>
  apiPost('/route/safe', {
    source: { lat: sourceLat, lng: sourceLng },
    destination: { lat: destLat, lng: destLng },
    mode,
  });


// Danger Score

export const fetchDangerScore = async (intersection_id = 'INT_001', weather = 'clear') => {
  const payload = await apiFetch(`/danger-score/?intersection_id=${intersection_id}&weather=${weather}`);
  return {
    ...payload,
    danger_score: Number(payload?.score ?? payload?.comfort_score ?? 0),
    status: 'ok',
    details: {
      meta: payload?.meta || {},
      timeSlice: payload?.timeSlice || {},
    },
  };
};


// Cluster / Infrastructure

export const fetchClusterInfo = async (cluster_id = 1) => {
  const payload = await apiFetch(`/cluster-info/?cluster_id=${cluster_id}`);
  return normalizeCluster(payload);
};


// Supervisor Operations

export const getOverview = async (token) =>
  apiFetch('/supervisor/dashboard/overview', token);

export const verifyIncident = async (id, verified, note, token) => {
  return apiFetch(`/supervisor/incidents/${id}/verify`, token, {
    method: 'PATCH',
    body: JSON.stringify({ verified, note }),
  });
};


// Patrol / Officer Operations

export const getAssignments = async (token) =>
  apiFetch('/patrol/assignments', token);

export const getActiveIncidents = async (token) =>
  apiFetch('/patrol/active-incidents', token);

export const respondToIncident = async (id, body, token) => {
  return apiFetch(`/patrol/incidents/${id}/respond`, token, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
};


// Advanced Analysis (Admin)

export const analyzeCCTVSnapshot = async (base64Image, token = null) =>
  apiPost('/cctv/analyze-b64', { image_b64: base64Image }, token);

export const detectZoneAnomaly = async (zoneId, timeseriesValues, token = null) =>
  apiPost('/anomaly/detect', { zone_id: zoneId, values: timeseriesValues }, token);


// Citizen Hub Operations

export const fetchSafeZones = async () =>
  apiFetch('/citizen/safe-zones');

export const fetchSosContacts = async () =>
  apiFetch('/citizen/sos-contacts');


// Admin / Portal Operations

export const fetchAdminStats = async (token = null) =>
  apiFetch('/admin/stats', token);

export const fetchAdminIncidents = async (limit = 50, token = null) =>
  apiFetch(`/admin/incidents?limit=${limit}`, token);

export const fetchAdminZones = async (token = null) =>
  apiFetch('/admin/zones', token);


// SOS

export const postSOS = async (lat, lng, message = 'Emergency SOS', token = null) =>
  apiPost('/user/sos', { lat, lng, message }, token);


// Health

export const fetchHealth = async () =>
  apiFetch(`${API_ORIGIN}/health`);


// Mock Data Constants (offline fallbacks used by UI components)

export const MOCK_DANGER = {
  score: 72, risk: 'low',
  reasons: [
    '3 functional streetlights - avg 85 lux',
    'CCTV active - 90% effectiveness',
    'High-traffic junction',
  ],
  warnings: [],
  timeSlice: {
    hour: 20, weather: 'clear', is_weekend: false, is_holiday: false,
    special_event: 'none', aggregate_safety: 68,
  },
  meta: {
    intersection_id: 'INT_001',
    intersection_name: 'MG Road & Brigade Rd',
    baseline_safety_score: 72,
    safety_variance: 8.4,
    isolation_score: 0.15,
    peak_danger_hours: [22, 23, 0, 1, 2],
  },
};

export const MOCK_INCIDENTS = [
  { incident_id: 'INC_001', incident_type: 'poor_lighting', severity: 4, reported_at: '2025-01-15T21:30:00Z', verified: true, source: 'user_report', lat: 12.9698, lng: 77.5981 },
  { incident_id: 'INC_002', incident_type: 'felt_followed', severity: 5, reported_at: '2025-01-15T23:10:00Z', verified: true, source: 'user_report', lat: 12.9763, lng: 77.5929 },
  { incident_id: 'INC_003', incident_type: 'broken_cctv', severity: 3, reported_at: '2025-01-14T19:45:00Z', verified: false, source: 'user_report', lat: 12.9720, lng: 77.5950 },
  { incident_id: 'INC_004', incident_type: 'suspicious_activity', severity: 4, reported_at: '2025-01-15T22:00:00Z', verified: true, source: 'user_report', lat: 12.9745, lng: 77.5960 },
];

export const MOCK_ROUTE = {
  route: [
    { intersection_id: 'INT_001', lat: 12.9716, lng: 77.5946 },
    { intersection_id: 'INT_004', lat: 12.9725, lng: 77.5958 },
    { intersection_id: 'INT_005', lat: 12.9738, lng: 77.5965 },
  ],
  reason: [
    '3 functional streetlights (avg 85 lux)',
    'CCTV at INT_001 - 90% effective',
    'Avoids INT_003 (isolation 0.78)',
    'No verified incidents in last 48h',
  ],
  avoided_intersections: ['INT_003'],
  total_distance_m: 380,
  safety_improvement_vs_shortest: '+22 points',
};

export const MOCK_CLUSTER = {
  cluster_id: 1,
  cluster_name: 'Central Business District',
  avg_cluster_safety: 64.0,
  num_intersections: 18,
  primary_risk_factors: ['poor_lighting', 'high_incident_rate_weekends', 'late_night_isolation'],
  recommended_interventions: [
    'Install 4 streetlights on Residency Road south end',
    'Deploy mobile CCTV unit on weekends',
    'Add emergency button near Brigade Rd ATM cluster',
  ],
  cluster_type: 'commercial',
};

