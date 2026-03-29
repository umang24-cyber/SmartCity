const BASE = 'http://localhost:8000';

async function apiFetch(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
  return res.json();
}

export async function fetchDangerScore(intersection_id = 'INT_001', weather = 'clear') {
  return apiFetch(`${BASE}/danger-score/?intersection_id=${intersection_id}&weather=${weather}`);
}

export async function fetchIncidents(verifiedOnly = false) {
  return apiFetch(`${BASE}/incidents/?verified=${verifiedOnly}`);
}

export async function postReport({ lat, lng, incident_type, severity }) {
  const res = await fetch(`${BASE}/report/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lat, lng, incident_type, severity }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

export async function fetchSafeRoute(start = 'INT_001', end = 'INT_005') {
  return apiFetch(`${BASE}/safe-route/?start=${start}&end=${end}`);
}

export async function fetchClusterInfo(cluster_id = 1) {
  return apiFetch(`${BASE}/cluster-info/?cluster_id=${cluster_id}`);
}

export async function fetchHealth() {
  return apiFetch(`${BASE}/health`);
}

export async function fetchIntersections() {
  return apiFetch(`${BASE}/intersections/`);
}

export const MOCK_DANGER = {
  score: 72, risk: 'low',
  reasons: ['3 functional streetlights — avg 85 lux', 'CCTV active — 90% effectiveness', 'High-traffic junction'],
  warnings: [],
  timeSlice: { hour: 20, weather: 'clear', is_weekend: false, is_holiday: false, special_event: 'none', aggregate_safety: 68 },
  meta: { intersection_id: 'INT_001', intersection_name: 'MG Road & Brigade Rd', baseline_safety_score: 72, safety_variance: 8.4, isolation_score: 0.15, peak_danger_hours: [22, 23, 0, 1, 2] }
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
    { intersection_id: 'INT_005', lat: 12.9738, lng: 77.5965 }
  ],
  reason: ['3 functional streetlights (avg 85 lux)', 'CCTV at INT_001 — 90% effective', 'Avoids INT_003 (isolation 0.78)', 'No verified incidents in last 48h'],
  avoided_intersections: ['INT_003'],
  total_distance_m: 380,
  safety_improvement_vs_shortest: '+22 points'
};

export const MOCK_CLUSTER = {
  cluster_id: 1, cluster_name: 'Central Business District', avg_cluster_safety: 64.0,
  num_intersections: 18,
  primary_risk_factors: ['poor_lighting', 'high_incident_rate_weekends', 'late_night_isolation'],
  recommended_interventions: ['Install 4 streetlights on Residency Road south end', 'Deploy mobile CCTV unit on weekends', 'Add emergency button near Brigade Rd ATM cluster'],
  cluster_type: 'commercial'
};
