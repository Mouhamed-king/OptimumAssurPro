// ============================================
// MIGRATION : Ajout de la catégorie de véhicule
// ============================================
// Ce script ajoute le champ categorie_vehicule à la table contrats
// pour séparer les TPV (Transport Public de Voyageurs) et VP/CI (Véhicule Particulier/Camionnette)

const db = require('./connection');

async function addCategorieVehicule() {
    try {
        console.log('🔄 Démarrage de la migration : Ajout de categorie_vehicule...');
        
        console.log('🔄 Ajout de la colonne categorie_vehicule...');
        await db.connect();
        
        const pgPool = db.getPgPool();
        if (!pgPool) {
            console.error('❌ pg Pool non configuré. Veuillez configurer DB_HOST, DB_USER, DB_PASSWORD dans votre fichier .env');
            console.error('   Ces variables sont nécessaires pour exécuter les migrations SQL.');
            console.error('');
            console.error('   Alternative : Utilisez le script SQL directement dans Supabase Dashboard');
            console.error('   Fichier : database/add-categorie-vehicule.sql');
            process.exit(1);
        }
        
        const client = await pgPool.connect();
        
        try {
            await client.query('BEGIN');
            
            // Vérifier si la colonne existe déjà
            const checkColumnQuery = `
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_schema = 'public'
                AND table_name = 'contrats' 
                AND column_name = 'categorie_vehicule';
            `;
            
            const { rows: existingColumns } = await client.query(checkColumnQuery);
            
            if (existingColumns.length > 0) {
                console.log('✅ La colonne categorie_vehicule existe déjà');
                await client.query('COMMIT');
                client.release();
                process.exit(0);
            }
            
            console.log('📝 Ajout de la colonne categorie_vehicule...');
            
            // Ajouter la colonne avec contrainte CHECK
            await client.query(`
                ALTER TABLE contrats 
                ADD COLUMN categorie_vehicule VARCHAR(10) DEFAULT 'VP/CI' 
                CHECK (categorie_vehicule IN ('TPV', 'VP/CI'));
            `);
            
            console.log('✅ Colonne categorie_vehicule ajoutée avec succès');
            
            // Créer l'index pour optimiser les requêtes
            console.log('📝 Création de l\'index...');
            await client.query(`
                CREATE INDEX IF NOT EXISTS idx_contrats_categorie ON contrats(categorie_vehicule);
            `);
            
            console.log('✅ Index créé avec succès');
            
            // Mettre à jour les contrats existants (par défaut VP/CI)
            console.log('📝 Mise à jour des contrats existants...');
            const { rowCount } = await client.query(`
                UPDATE contrats 
                SET categorie_vehicule = 'VP/CI' 
                WHERE categorie_vehicule IS NULL;
            `);
            
            console.log(`✅ ${rowCount} contrat(s) mis à jour avec la catégorie VP/CI par défaut`);
            
            // Ajouter le commentaire sur la colonne
            console.log('📝 Ajout du commentaire sur la colonne...');
            await client.query(`
                COMMENT ON COLUMN contrats.categorie_vehicule IS 'Catégorie du véhicule: TPV (Transport Public de Voyageurs) ou VP/CI (Véhicule Particulier/Camionnette)';
            `);
            
            await client.query('COMMIT');
        
            console.log('✅ Migration terminée avec succès !');
            console.log('');
            console.log('📋 Résumé :');
            console.log('   - Colonne categorie_vehicule ajoutée à la table contrats');
            console.log('   - Index créé pour optimiser les requêtes');
            console.log('   - Contrats existants marqués comme VP/CI par défaut');
            console.log('');
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Erreur lors de la migration:', error);
        console.error('   Détails:', error.message);
        console.error('');
        console.error('💡 Alternative : Utilisez le script SQL directement dans Supabase Dashboard');
        console.error('   Fichier : database/add-categorie-vehicule.sql');
        process.exit(1);
    }
}

// Exécuter la migration
addCategorieVehicule();
