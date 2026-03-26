const { mockIncidents } = require('../data/mockData');
const tg = require('../utils/tigergraph');

exports.getIncidents = async (req, res) => {
  try {
    // ── Query params ──────────────────────────────────────────────
    // ?verified=true  → only verified incidents
    // ?verified=false → all incidents
    const verifiedOnly = req.query.verified === 'true';

    let incidents;

    if (process.env.DATA_SOURCE === 'tigergraph') {
      // ── TIGERGRAPH PATH ──────────────────────────────────────────
      const raw = await tg.getAllIncidents(verifiedOnly);
      // Normalize: TigerGraph returns { v_id, attributes: {...} }
      // We flatten to match the shape frontend already expects
      incidents = raw.map(item => ({
        incident_id:   item.v_id,
        incident_type: item.attributes.incident_type,
        severity:      item.attributes.severity,
        reported_at:   item.attributes.reported_at,
        verified:      item.attributes.verified,
        source:        item.attributes.source,
        // Note: lat/lng come from the edge to Intersection vertex
        // Group A's query should return these — placeholder for now
        lat: item.attributes.lat ?? null,
        lng: item.attributes.lng ?? null
      }));
    } else {
      // ── MOCK PATH ────────────────────────────────────────────────
      incidents = verifiedOnly
        ? mockIncidents.filter(i => i.verified)
        : mockIncidents;
    }

    res.json(incidents);
  } catch (err) {
    console.error('[getIncidents]', err.message);
    res.status(500).json({ error: 'Failed to fetch incidents' });
  }
};