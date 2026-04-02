// src/api/smartcity.js
// Merged API client: devB auth + RBAC calls + ai utility functions + shared mock constants

const API_BASE_URL = 'http://localhost:8000/api/v1';

// ── Generic fetch helpers ────────────────────────────────────────────────────

export const apiFetch = async (endpoint, token = null) => {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const response = await fetch(`${API_BASE_URL}${endpoint}`, { headers });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Server error: ${response.status}`);
  }
  return response.json();
};

export const apiPost = async (endpoint, body, token = null) => {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Server error: ${response.status}`);
  }
  return response.json();
};


// ── Auth Operations ──────────────────────────────────────────────────────────

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


// ── Incident Operations ──────────────────────────────────────────────────────

export const getIntersections = async () => apiFetch('/intersections');

export const getIncidents = async () => apiFetch('/incidents');

export const postReport = async (reportData, token) =>
  apiPost('/reports', reportData, token);

export const analyzeReport = async (text, token = null) =>
  apiPost('/reports/analyze', { text }, token);


// ── Route Operations ─────────────────────────────────────────────────────────

export const getSafeRoute = async (start, end) =>
  apiFetch(`/safe-route?start=${start}&end=${end}`);

export const fetchSafeRoute = async (start_lat, start_lng, end_lat, end_lng) => {
  if (!start_lat) {
    return apiFetch('/safe-route/?start_lat=12.9716&start_lng=77.5946&end_lat=12.9738&end_lng=77.5965');
  }
  return apiFetch(`/safe-route/?start_lat=${start_lat}&start_lng=${start_lng}&end_lat=${end_lat}&end_lng=${end_lng}`);
};

/** Portal dual-route (safest + shortest GeoJSON) */
export const fetchDualRoute = async (sourceLat, sourceLng, destLat, destLng, mode = 'walking') =>
  apiPost('/route/safe', {
    source: { lat: sourceLat, lng: sourceLng },
    destination: { lat: destLat, lng: destLng },
    mode,
  });


// ── Danger Score ─────────────────────────────────────────────────────────────

export const fetchDangerScore = async (intersection_id = 'INT_001', weather = 'clear') =>
  apiFetch(`/danger-score/?intersection_id=${intersection_id}&weather=${weather}`);


// ── Cluster / Infrastructure ─────────────────────────────────────────────────

export const fetchClusterInfo = async (cluster_id = 1) =>
  apiFetch(`/cluster-info/?cluster_id=${cluster_id}`);


// ── Supervisor Operations ────────────────────────────────────────────────────

export const getOverview = async (token) =>
  apiFetch('/supervisor/dashboard/overview', token);

export const verifyIncident = async (id, verified, note, token) => {
  const response = await fetch(`${API_BASE_URL}/supervisor/incidents/${id}/verify`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ verified, note })
  });
  if (!response.ok) throw new Error('Verification update failed');
  return response.json();
};


// ── Admin / Portal Operations ────────────────────────────────────────────────

export const fetchAdminStats = async (token = null) =>
  apiFetch('/admin/stats', token);

export const fetchAdminIncidents = async (limit = 50, token = null) =>
  apiFetch(`/admin/incidents?limit=${limit}`, token);

export const fetchAdminZones = async (token = null) =>
  apiFetch('/admin/zones', token);


// ── SOS ──────────────────────────────────────────────────────────────────────

export const postSOS = async (lat, lng, message = 'Emergency SOS', token = null) =>
  apiPost('/user/sos', { lat, lng, message }, token);


// ── Health ───────────────────────────────────────────────────────────────────

export const fetchHealth = async () =>
  fetch('http://localhost:8000/health').then(r => r.json());


// ── Mock Data Constants (offline fallbacks used by UI components) ─────────────

export const MOCK_DANGER = {
  score: 72, risk: 'low',
  reasons: [
    '3 functional streetlights — avg 85 lux',
    'CCTV active — 90% effectiveness',
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
  { incident_id: 'INC_001', incident_type: 'poor_lighting',       severity: 4, reported_at: '2025-01-15T21:30:00Z', verified: true,  source: 'user_report', lat: 12.9698, lng: 77.5981 },
  { incident_id: 'INC_002', incident_type: 'felt_followed',       severity: 5, reported_at: '2025-01-15T23:10:00Z', verified: true,  source: 'user_report', lat: 12.9763, lng: 77.5929 },
  { incident_id: 'INC_003', incident_type: 'broken_cctv',         severity: 3, reported_at: '2025-01-14T19:45:00Z', verified: false, source: 'user_report', lat: 12.9720, lng: 77.5950 },
  { incident_id: 'INC_004', incident_type: 'suspicious_activity', severity: 4, reported_at: '2025-01-15T22:00:00Z', verified: true,  source: 'user_report', lat: 12.9745, lng: 77.5960 },
];

export const MOCK_ROUTE = {
  route: [
    { intersection_id: 'INT_001', lat: 12.9716, lng: 77.5946 },
    { intersection_id: 'INT_004', lat: 12.9725, lng: 77.5958 },
    { intersection_id: 'INT_005', lat: 12.9738, lng: 77.5965 },
  ],
  reason: [
    '3 functional streetlights (avg 85 lux)',
    'CCTV at INT_001 — 90% effective',
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
