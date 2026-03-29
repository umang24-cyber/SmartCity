// routes/routePainter.js
const router = require('express').Router();
const { getSafeRoute } = require('../controllers/painterController');
router.get('/', getSafeRoute);
module.exports = router;