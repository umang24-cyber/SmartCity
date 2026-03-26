const { mockClusters, mockIntersections } = require('../data/mockData');
const tg = require('../utils/tigergraph');

exports.getClusterInfo = async (req, res) => {
  try {
    // ?cluster_id=1  or  ?intersection_id=INT_001 (we look up which cluster it's in)
    let { cluster_id, intersection_id } = req.query;

    // If intersection_id is given, find its cluster_id
    if (!cluster_id && intersection_id) {
      const intersection = mockIntersections.find(i => i.intersection_id === intersection_id);
      if (intersection) cluster_id = intersection.cluster_id;
    }

    let cluster;

    if (process.env.DATA_SOURCE === 'tigergraph') {
      // ── TIGERGRAPH PATH ──────────────────────────────────────────
      const raw = await tg.getCluster(cluster_id || 1);
      cluster = raw.attributes;
    } else {
      // ── MOCK PATH ────────────────────────────────────────────────
      cluster = cluster_id
        ? mockClusters.find(c => c.cluster_id === parseInt(cluster_id))
        : mockClusters[0];
    }

    if (!cluster) {
      return res.status(404).json({ error: 'Cluster not found' });
    }

    res.json(cluster);
  } catch (err) {
    console.error('[getClusterInfo]', err.message);
    res.status(500).json({ error: 'Failed to fetch cluster info' });
  }
};