// ============================================
// ROUTES DES CLIENTS
// ============================================

const express = require('express');
const router = express.Router();
const clientController = require('../controllers/clientController');
const { authenticateToken } = require('../middleware/auth');

// Toutes les routes nécessitent une authentification
router.use(authenticateToken);

// Obtenir tous les clients
router.get('/', clientController.getAllClients);

// Obtenir un client par ID
router.get('/:id', clientController.getClientById);

// Créer un nouveau client
router.post('/', clientController.createClient);

// Mettre à jour un client
router.put('/:id', clientController.updateClient);

// Supprimer un client
router.delete('/:id', clientController.deleteClient);

module.exports = router;

