// ============================================
// SCRIPT POUR NETTOYER LES DONNÉES DE TEST (Supabase SDK)
// ============================================

const db = require('./connection');
require('dotenv').config();

async function cleanTestData() {
    try {
        console.log('🧹 Nettoyage des données de test...');
        await db.connect();
        
        // Utiliser Supabase SDK pour supprimer les données
        console.log('Suppression des notifications...');
        const { error: notifError } = await db.supabase
            .from('notifications')
            .delete()
            .neq('id', 0); // Supprimer toutes les notifications
        
        if (notifError) console.error('Erreur notifications:', notifError);
        
        console.log('Suppression des contrats...');
        const { error: contratError } = await db.supabase
            .from('contrats')
            .delete()
            .neq('id', 0);
        
        if (contratError) console.error('Erreur contrats:', contratError);
        
        console.log('Suppression des véhicules...');
        const { error: vehiculeError } = await db.supabase
            .from('vehicules')
            .delete()
            .neq('id', 0);
        
        if (vehiculeError) console.error('Erreur véhicules:', vehiculeError);
        
        console.log('Suppression des clients...');
        const { error: clientError } = await db.supabase
            .from('clients')
            .delete()
            .neq('id', 0);
        
        if (clientError) console.error('Erreur clients:', clientError);
        
        console.log('Suppression des entreprises de test...');
        const { error: entrepriseError } = await db.supabase
            .from('entreprises')
            .delete()
            .eq('email', 'test@assurance.com');
        
        if (entrepriseError) console.error('Erreur entreprises:', entrepriseError);
        
        console.log('✅ Données de test supprimées avec succès !');
        console.log('');
        console.log('Vous pouvez maintenant ajouter de vraies données via l\'interface web.');
        console.log('Ou créer une nouvelle entreprise avec: npm run seed');
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Erreur lors du nettoyage:', error);
        process.exit(1);
    }
}

cleanTestData();
