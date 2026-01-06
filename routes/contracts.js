// ============================================
// ROUTES DES CONTRATS
// ============================================

const express = require('express');
const router = express.Router();
const contractController = require('../controllers/contractController');
const { authenticateToken } = require('../middleware/auth');

// Toutes les routes nécessitent une authentification
router.use(authenticateToken);

// Obtenir tous les contrats
router.get('/', contractController.getAllContracts);

// Obtenir un contrat par ID
router.get('/:id', contractController.getContractById);

// Créer un nouveau contrat
router.post('/', contractController.createContract);

// Renouveler un contrat
router.post('/:id/renew', contractController.renewContract);

// Mettre à jour un contrat
router.put('/:id', contractController.updateContract);

// Mettre à jour le paiement restant
router.put('/:id/payment', contractController.updatePayment);

// Supprimer un contrat
router.delete('/:id', contractController.deleteContract);

module.exports = router;

