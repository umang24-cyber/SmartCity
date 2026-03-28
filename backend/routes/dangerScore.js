const router = require('express').Router();
const { getDangerScore } = require('../controllers/scoreController');
router.get('/', getDangerScore);
module.exports = router;