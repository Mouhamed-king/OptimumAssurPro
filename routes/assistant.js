// ============================================
// ROUTES ASSISTANT IA
// ============================================

const express = require('express');
const router = express.Router();
const assistantController = require('../controllers/assistantController');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

router.post('/chat', assistantController.chat);
router.post('/execute', assistantController.execute);

module.exports = router;
