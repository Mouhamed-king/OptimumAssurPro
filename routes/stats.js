// ============================================
// ROUTES DES STATISTIQUES (Supabase SDK)
// ============================================

const express = require('express');
const router = express.Router();
const db = require('../database/connection');
const { authenticateToken } = require('../middleware/auth');
const moment = require('moment');

router.use(authenticateToken);

// Obtenir les statistiques du dashboard
router.get('/dashboard', async (req, res) => {
    try {
        const entrepriseId = req.entrepriseId;
        
        // Nombre total de clients pour cette entreprise
        const { count: clientsActifsCount, error: clientsError } = await db.supabase
            .from('clients')
            .select('*', { count: 'exact', head: true })
            .eq('entreprise_id', entrepriseId);
        
        if (clientsError) {
            console.error('Erreur lors du comptage des clients');
            throw clientsError;
        }
        
        // Nombre de contrats actifs et données des contrats récents
        const { data: contratsActifsData, error: contratsError } = await db.supabase
            .from('contrats')
            .select(`
                *,
                clients (
                    id,
                    nom,
                    prenom,
                    telephone
                )
            `)
            .eq('entreprise_id', entrepriseId)
            .eq('statut', 'actif')
            .order('created_at', { ascending: false });
        
        if (contratsError) {
            console.error('Erreur lors du comptage des contrats actifs');
            throw contratsError;
        }
        
        // Contrats à renouveler (dans les 7 prochains jours)
        const aujourdhui = moment().format('YYYY-MM-DD');
        const dateLimite = moment().add(7, 'days').format('YYYY-MM-DD');

        const { data: renouvellementsData, error: renouvellementsError } = await db.supabase
            .from('contrats')
            .select(`
                *,
                clients (
                    id,
                    nom,
                    prenom,
                    telephone
                )
            `)
            .eq('entreprise_id', entrepriseId)
            .eq('statut', 'actif')
            .gte('date_fin', aujourdhui)
            .lte('date_fin', dateLimite);
        
        if (renouvellementsError) {
            console.error('Erreur lors du comptage des renouvellements');
            throw renouvellementsError;
        }
        
        // Contrats expirés ce mois
        const debutMois = moment().startOf('month').format('YYYY-MM-DD');

        const { data: expiresData, error: expiresError } = await db.supabase
            .from('contrats')
            .select(`
                *,
                clients (
                    id,
                    nom,
                    prenom,
                    telephone
                )
            `)
            .eq('entreprise_id', entrepriseId)
            .in('statut', ['actif', 'expire'])
            .gte('date_fin', debutMois)
            .lt('date_fin', aujourdhui);
        
        if (expiresError) {
            console.error('Erreur lors du comptage des contrats expirés');
            throw expiresError;
        }

        // TOUS les contrats expirés (date de fin passée, sans limite de mois)
        const { data: allExpiresData, error: allExpiresError } = await db.supabase
            .from('contrats')
            .select(`
                *,
                clients (
                    id,
                    nom,
                    prenom,
                    telephone
                )
            `)
            .eq('entreprise_id', entrepriseId)
            .in('statut', ['actif', 'expire'])
            .lt('date_fin', aujourdhui);
        
        if (allExpiresError) {
            console.error('Erreur lors du comptage de tous les contrats expirés');
            throw allExpiresError;
        }
        
        res.json({
            clients_actifs: clientsActifsCount || 0,
            contrats_actifs: (contratsActifsData || []).length,
            contrats_actifs_data: contratsActifsData || [],
            renouvellements_a_venir: (renouvellementsData || []).length,
            contrats_renouvellement: renouvellementsData || [],
            expires_ce_mois: (expiresData || []).length,
            contrats_expires_data: expiresData || [],
            tous_expires: (allExpiresData || []).length,
            tous_expires_data: allExpiresData || []
        });
    } catch (error) {
        console.error('Erreur lors de la récupération des statistiques');
        res.status(500).json({ error: 'Erreur lors de la récupération des statistiques' });
    }
});

module.exports = router;
