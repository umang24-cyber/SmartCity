const router = require('express').Router();
const { getIncidents } = require('../controllers/incidentController');
router.get('/', getIncidents);
module.exports = router;