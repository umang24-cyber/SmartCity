const { mockSafeRoute, getCurrentTimeSlice } = require('../data/mockData');
const tg = require('../utils/tigergraph');

exports.getSafeRoute = async (req, res) => {
  try {
    // ── Query params (frontend can pass start/end intersection IDs) ──
    const { start = 'INT_001', end = 'INT_005' } = req.query;

    let routeData;

    if (req.dataSource === 'tigergraph') {
      // ── TIGERGRAPH PATH ──────────────────────────────────────────
      // Group A installs GSQL query 'getSafeRoute' that returns
      // ordered intersection list avoiding high-isolation, peak-danger nodes
      routeData = await tg.getSafeRoute(start, end);

      if (!routeData) {
        return res.status(404).json({ error: 'Safe route not found in TigerGraph' });
      }
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

    // ── Data Contract Alignment ─────────────────────────────────────
    // Frontend Mapbox-ready component expects an ordered array of coordinates
    if (routeData && Array.isArray(routeData.route)) {
        // Based on prompt exact spec [[lat, lng]]
        routeData.coordinates = routeData.route.map(node => [node.lat, node.lng]);
    }

    // ── CSV Output Support ──────────────────────────────────────────
    if (req.query.format === 'csv') {
      const { jsonToCsv } = require('../utils/csvUtil');
      const csvData = jsonToCsv(routeData.route); // Return the intersection list as CSV
      res.setHeader('Content-Type', 'text/csv');
      return res.send(csvData);
    }

    res.json(routeData);
  } catch (err) {
    console.error('[getSafeRoute]', err.message);
    res.status(500).json({ error: 'Failed to fetch safe route' });
  }
};