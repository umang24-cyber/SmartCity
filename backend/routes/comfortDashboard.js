const router = require('express').Router();
const { getClusterInfo } = require('../controllers/dashboardController');
router.get('/', getClusterInfo);
module.exports = router;