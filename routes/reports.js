// ============================================
// ROUTES DES RAPPORTS (Supabase SDK)
// ============================================

const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

// Obtenir le résumé des rapports
router.get('/summary', reportController.getSummary);

module.exports = router;

