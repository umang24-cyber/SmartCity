// ================================================================
// TIGERGRAPH ADAPTER
// ALL TigerGraph API calls live in this one file.
// When Group A shares credentials, just fill in the .env and
// flip DATA_SOURCE=tigergraph. Nothing else changes.
// ================================================================
const axios = require('axios');

const BASE = `${process.env.TG_BASE_URL}/restpp`;
const GRAPH = process.env.TG_GRAPH || 'SafeRouteGraph';

// Axios instance with auth
const tg = axios.create({
  baseURL: BASE,
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${process.env.TG_TOKEN}`
  }
});



// ── GET single Intersection vertex ───────────────────────────────
async function getIntersection(intersectionId) {
  const res = await tg.get(
    `/graph/${GRAPH}/vertices/Intersection/${intersectionId}`
  );
  return res.data.results[0];
}

// ── GET all Intersections ─────────────────────────────────────────
async function getAllIntersections() {
  const res = await tg.get(`/graph/${GRAPH}/vertices/Intersection`);
  return res.data.results;
}

// ── GET SafetyFeatures connected to an Intersection ───────────────
async function getFeaturesForIntersection(intersectionId) {
  // Uses the HAS_FEATURE edge in the graph
  const res = await tg.get(
    `/graph/${GRAPH}/edges/Intersection/${intersectionId}/HAS_FEATURE`
  );
  return res.data.results;
}

// ── GET current TimeSlice vertex ──────────────────────────────────
async function getCurrentTimeSlice() {
  const now = new Date();
  const hour = String(now.getHours()).padStart(2, '0');
  const date = now.toISOString().split('T')[0];
  const tsId = `${date}-${hour}`;
  const res = await tg.get(
    `/graph/${GRAPH}/vertices/TimeSlice/${tsId}`
  );
  return res.data.results[0];
}

// ── GET SafeRoute via GSQL installed query ────────────────────────
// Group A will install a GSQL query called 'getSafeRoute'
async function getSafeRoute(startId, endId) {
  const res = await tg.get(
    `/query/${GRAPH}/getSafeRoute`,
    { params: { start: startId, end: endId } }
  );
  return res.data.results[0];
}

// ── GET Cluster by ID ─────────────────────────────────────────────
async function getCluster(clusterId) {
  const res = await tg.get(
    `/graph/${GRAPH}/vertices/SafetyCluster/${clusterId}`
  );
  return res.data.results[0];
}

// ── GET all Incidents ─────────────────────────────────────────────
async function getAllIncidents(verifiedOnly = false) {
  const res = await tg.get(
    `/graph/${GRAPH}/vertices/IncidentReport`
  );
  let incidents = res.data.results;
  if (verifiedOnly) {
    incidents = incidents.filter(i => i.attributes.verified === true);
  }
  return incidents;
}

// ── POST new IncidentReport vertex ────────────────────────────────
async function createIncident(incidentData) {
  const res = await tg.post(
    `/graph/${GRAPH}`,
    {
      vertices: {
        IncidentReport: {
          [incidentData.incident_id]: {
            incident_type: { value: incidentData.incident_type },
            severity:       { value: incidentData.severity },
            reported_at:    { value: incidentData.reported_at },
            verified:       { value: false },
            source:         { value: incidentData.source }
          }
        }
      }
    }
  );
  return res.data;
}

module.exports = {
  getIntersection,
  getAllIntersections,
  getFeaturesForIntersection,
  getCurrentTimeSlice,
  getSafeRoute,
  getCluster,
  getAllIncidents,
  createIncident
};