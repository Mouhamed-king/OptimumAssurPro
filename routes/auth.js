// ============================================
// ROUTES D'AUTHENTIFICATION
// ============================================

const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth');

// Inscription
router.post('/register', authController.register);

// Connexion
router.post('/login', authController.login);

// Obtenir les informations de l'entreprise connectée
router.get('/me', authenticateToken, authController.getMe);

// Mettre à jour le profil de l'entreprise
router.put('/profile', authenticateToken, authController.updateProfile);

// Changer le mot de passe
router.post('/change-password', authenticateToken, authController.changePassword);

// Renvoyer l'email de vérification
router.post('/resend-verification', authController.resendVerificationEmail);

// Demander la réinitialisation du mot de passe
router.post('/forgot-password', authController.forgotPassword);

// Réinitialiser le mot de passe avec le token
router.post('/reset-password', authController.resetPassword);

module.exports = router;

