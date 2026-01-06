// ============================================
// ROUTES DES NOTIFICATIONS (Supabase SDK)
// ============================================

const express = require('express');
const router = express.Router();
const db = require('../database/connection');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

// Obtenir toutes les notifications
router.get('/', async (req, res) => {
    try {
        const { lu } = req.query;
        
        // Construire la requête Supabase avec jointure
        let query = db.supabase
            .from('notifications')
            .select(`
                *,
                contrats!notifications_contrat_id_fkey (
                    numero_contrat
                )
            `)
            .eq('entreprise_id', req.entrepriseId);
        
        // Filtrer par statut lu si fourni
        if (lu !== undefined) {
            query = query.eq('lu', lu === 'true');
        }
        
        const { data: notifications, error } = await query
            .order('created_at', { ascending: false })
            .limit(50);
        
        if (error) {
            throw error;
        }
        
        // Formater les données pour inclure numero_contrat au niveau racine
        const formattedNotifications = (notifications || []).map(notif => ({
            ...notif,
            numero_contrat: notif.contrats?.numero_contrat || null
        }));
        
        res.json({ notifications: formattedNotifications });
    } catch (error) {
        console.error('Erreur lors de la récupération des notifications:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération des notifications: ' + error.message });
    }
});

// Marquer une notification comme lue
router.put('/:id/read', async (req, res) => {
    try {
        const { id } = req.params;
        
        // Vérifier que la notification appartient à l'entreprise
        const { data: existing } = await db.supabase
            .from('notifications')
            .select('id')
            .eq('id', id)
            .eq('entreprise_id', req.entrepriseId)
            .single();
        
        if (!existing) {
            return res.status(404).json({ error: 'Notification non trouvée' });
        }
        
        // Mettre à jour avec Supabase
        const { error } = await db.supabase
            .from('notifications')
            .update({ lu: true })
            .eq('id', id);
        
        if (error) {
            throw error;
        }
        
        res.json({ message: 'Notification marquée comme lue' });
    } catch (error) {
        console.error('Erreur lors de la mise à jour de la notification:', error);
        res.status(500).json({ error: 'Erreur lors de la mise à jour de la notification: ' + error.message });
    }
});

// Créer une notification (pour les alertes automatiques)
router.post('/', async (req, res) => {
    try {
        const { contrat_id, type, titre, message } = req.body;
        
        // Créer la notification avec Supabase
        const { data: newNotification, error } = await db.supabase
            .from('notifications')
            .insert({
                entreprise_id: req.entrepriseId,
                contrat_id: contrat_id || null,
                type,
                titre,
                message
            })
            .select()
            .single();
        
        if (error) {
            throw error;
        }
        
        res.status(201).json({ 
            message: 'Notification créée avec succès',
            notification: newNotification
        });
    } catch (error) {
        console.error('Erreur lors de la création de la notification:', error);
        res.status(500).json({ error: 'Erreur lors de la création de la notification: ' + error.message });
    }
});

module.exports = router;
