const express = require('express');
const router = express.Router();
const trackingController = require('../controllers/trackingController');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);
router.post('/aas', trackingController.upsertAasTracking);
router.get('/expiries', trackingController.listTrackedExpiries);

module.exports = router;
