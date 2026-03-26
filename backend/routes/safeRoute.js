// routes/safeRoute.js
const router = require('express').Router();
const { getSafeRoute } = require('../controllers/routeController');
router.get('/', getSafeRoute);
module.exports = router;