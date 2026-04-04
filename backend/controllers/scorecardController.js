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

    if (req.dataSource === 'tigergraph') {
      // ── TIGERGRAPH PATH ──────────────────────────────────────────
      [intersection, features, timeSlice] = await Promise.all([
        tg.getIntersection(intersection_id),
        tg.getFeaturesForIntersection(intersection_id),
        tg.getCurrentTimeSlice()
      ]);

      if (!intersection) {
        return res.status(404).json({ error: 'Intersection not found in TigerGraph' });
      }

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

    // ── CSV Output Support ──────────────────────────────────────────
    if (req.query.format === 'csv') {
      const { jsonToCsv } = require('../utils/csvUtil');
      // Flatten the result for CSV
      const flatResult = {
        score: result.score,
        risk: result.risk,
        reasoning: result.reasoning,
        themeAction: result.themeAction,
        ...result.meta
      };
      const csvData = jsonToCsv([flatResult]);
      res.setHeader('Content-Type', 'text/csv');
      return res.send(csvData);
    }

    res.json(result);
  } catch (err) {
    console.error('[getDangerScore]', err.message);
    res.status(500).json({ error: 'Failed to compute danger score' });
  }
};