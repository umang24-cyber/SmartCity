const tg = require('../utils/tigergraph');

// In-memory store for mock mode (acts like TigerGraph would)
const reportStore = [];

const VALID_TYPES = ['poor_lighting', 'felt_followed', 'broken_cctv', 'suspicious_activity'];

exports.postReport = async (req, res) => {
  try {
    const { lat, lng, incident_type, severity, source = 'user_report' } = req.body;

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

    if (process.env.DATA_SOURCE === 'tigergraph') {
      // ── TIGERGRAPH PATH ──────────────────────────────────────────
      // Creates IncidentReport vertex + edge to nearest Intersection
      await tg.createIncident(incident);
    } else {
      // ── MOCK PATH ────────────────────────────────────────────────
      reportStore.push(incident);
      console.log('[Report received]', incident);
    }

    res.status(201).json({
      success: true,
      message: 'Incident reported successfully',
      incident_id: incident.incident_id
    });
  } catch (err) {
    console.error('[postReport]', err.message);
    res.status(500).json({ error: 'Failed to save report' });
  }
};

// Dev-only: see all in-memory reports
exports.getReports = (req, res) => {
  res.json(reportStore);
};