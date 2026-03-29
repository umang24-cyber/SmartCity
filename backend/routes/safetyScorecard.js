const router = require('express').Router();
const { getDangerScore } = require('../controllers/scorecardController');
router.get('/', getDangerScore);
module.exports = router;