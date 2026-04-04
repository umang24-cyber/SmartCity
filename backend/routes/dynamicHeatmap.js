const router = require('express').Router();
const { getIncidents } = require('../controllers/heatmapController');
router.get('/', getIncidents);
module.exports = router;