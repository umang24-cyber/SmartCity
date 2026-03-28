const router = require('express').Router();
const { postReport, getReports } = require('../controllers/reportController');
router.post('/', postReport);
router.get('/', getReports);   // dev only — see all stored reports
module.exports = router;