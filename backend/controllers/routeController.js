const { mockSafeRoute, getCurrentTimeSlice } = require('../data/mockData');
const tg = require('../utils/tigergraph');

exports.getSafeRoute = async (req, res) => {
  try {
    // ── Query params (frontend can pass start/end intersection IDs) ──
    const { start = 'INT_001', end = 'INT_005' } = req.query;

    let routeData;

    if (process.env.DATA_SOURCE === 'tigergraph') {
      // ── TIGERGRAPH PATH ──────────────────────────────────────────
      // Group A installs GSQL query 'getSafeRoute' that returns
      // ordered intersection list avoiding high-isolation, peak-danger nodes
      routeData = await tg.getSafeRoute(start, end);
    } else {
      // ── MOCK PATH ────────────────────────────────────────────────
      const timeSlice = getCurrentTimeSlice();
      const isNight = timeSlice.ts_hour >= 20 || timeSlice.ts_hour <= 5;

      routeData = {
        ...mockSafeRoute,
        reason: isNight
          ? [
              '3 functional streetlights (avg 85 lux) along this corridor',
              'CCTV at INT_001 — 90% effective at this hour',
              'Avoids Cubbon Park North Gate (isolation 0.78)',
              'Emergency button at INT_004 is functional',
              'No verified incidents in last 48h on this path'
            ]
          : mockSafeRoute.reason
      };
    }

    res.json(routeData);
  } catch (err) {
    console.error('[getSafeRoute]', err.message);
    res.status(500).json({ error: 'Failed to fetch safe route' });
  }
};