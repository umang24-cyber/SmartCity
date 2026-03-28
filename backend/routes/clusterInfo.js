const router = require('express').Router();
const { getClusterInfo } = require('../controllers/clusterController');
router.get('/', getClusterInfo);
module.exports = router;