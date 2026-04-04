const tg = require('../utils/tigergraph');

// In-memory store for mock mode (acts like TigerGraph would)
const reportStore = [];

const VALID_TYPES = ['poor_lighting', 'felt_followed', 'broken_cctv', 'suspicious_activity'];

exports.postReport = async (req, res) => {
  try {
    // ── Input Format Check (CSV support) ──────────────────────────
    let data = req.body;
    if (req.headers['content-type'] === 'text/csv' || req.headers['content-type'] === 'text/plain') {
      const { csvToJson } = require('../utils/csvUtil');
      data = csvToJson(req.body.toString()); 
    }
    const { lat, lng, incident_type, severity, source = 'user_report' } = data;

    // ── Validation ────────────────────────────────────────────────
    if (!lat || !lng) {
      return res.status(400).json({ error: 'lat and lng are required' });
    }
    if (!incident_type || !VALID_TYPES.includes(incident_type)) {
      return res.status(400).json({
        error: `incident_type must be one of: ${VALID_TYPES.join(', ')}`
      });
    }
    if (!severity || severity < 1 || severity > 5) {
      return res.status(400).json({ error: 'severity must be 1–5' });
    }

    // ── Build IncidentReport vertex — matches TigerGraph schema exactly ──
    const incident = {
      incident_id:  `INC_${Date.now()}`,
      incident_type,
      severity:     parseInt(severity),
      reported_at:  new Date().toISOString(),
      verified:     false,
      source,
      lat:          parseFloat(lat),
      lng:          parseFloat(lng)
    };

    if (req.dataSource === 'tigergraph') {
      // ── TIGERGRAPH PATH ──────────────────────────────────────────
      // Creates IncidentReport vertex + edge to nearest Intersection
      await tg.createIncident(incident);
    } else {
      // ── MOCK PATH ────────────────────────────────────────────────
      reportStore.push(incident);
      console.log('[Report received]', incident);

      // ── Explainable AI / Immediate Normalization (Mock Influence) ──
      const { mockClusters } = require('../data/mockData');
      const cluster = mockClusters.find(c =>
        incident.lat >= c.min_latitude && incident.lat <= c.max_latitude &&
        incident.lng >= c.min_longitude && incident.lng <= c.max_longitude
      );
      
      if (cluster) {
        // Degrade aggregate safety proportionally to severity
        cluster.avg_cluster_safety = Math.max(0, cluster.avg_cluster_safety - (incident.severity * 2));
        if (!cluster.primary_risk_factors.includes(incident.incident_type)) {
          cluster.primary_risk_factors.push(incident.incident_type);
        }
        console.log(`[Influence] Updated SafetyCluster ${cluster.cluster_id}. New Score: ${cluster.avg_cluster_safety}`);
      }
    }

    const response = {
      success: true,
      message: 'Incident reported successfully',
      incident_id: incident.incident_id
    };

    // ── CSV Output Support ──────────────────────────────────────────
    if (req.query.format === 'csv') {
      const { jsonToCsv } = require('../utils/csvUtil');
      const csvData = jsonToCsv([response]);
      res.setHeader('Content-Type', 'text/csv');
      return res.send(csvData);
    }

    res.status(201).json(response);
  } catch (err) {
    console.error('[postReport]', err.message);
    res.status(500).json({ error: 'Failed to save report' });
  }
};

// Dev-only: see all in-memory reports
exports.getReports = (req, res) => {
  res.json(reportStore);
};