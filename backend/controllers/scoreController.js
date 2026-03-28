const { mockIntersections, mockSafetyFeatures, getCurrentTimeSlice } = require('../data/mockData');
const { computeSafetyScore } = require('../utils/safetyEngine');
const tg = require('../utils/tigergraph');

exports.getDangerScore = async (req, res) => {
  try {
    // ── Query params ──────────────────────────────────────────────
    // Frontend passes: ?intersection_id=INT_001&weather=rain
    const {
      intersection_id = 'INT_001',
      weather = 'clear'
    } = req.query;

    let intersection, features, timeSlice;

    if (process.env.DATA_SOURCE === 'tigergraph') {
      // ── TIGERGRAPH PATH ──────────────────────────────────────────
      [intersection, features, timeSlice] = await Promise.all([
        tg.getIntersection(intersection_id),
        tg.getFeaturesForIntersection(intersection_id),
        tg.getCurrentTimeSlice()
      ]);
      // Normalize TigerGraph response shape to flat object
      intersection = intersection.attributes;
      features = features.map(f => f.attributes);
      timeSlice = { ...timeSlice.attributes, weather_condition: weather || timeSlice.attributes.weather_condition };
    } else {
      // ── MOCK PATH ────────────────────────────────────────────────
      intersection = mockIntersections.find(i => i.intersection_id === intersection_id)
                     || mockIntersections[0];
      features = mockSafetyFeatures;
      timeSlice = { ...getCurrentTimeSlice(), weather_condition: weather };
    }

    // ── computeSafetyScore works on both real and mock data ────────
    const result = computeSafetyScore(intersection, timeSlice, features);

    res.json(result);
  } catch (err) {
    console.error('[getDangerScore]', err.message);
    res.status(500).json({ error: 'Failed to compute danger score' });
  }
};