// ============================================
// SCRIPT DE MIGRATION - Ajout des colonnes de paiement
// ============================================

const db = require('./connection');
require('dotenv').config();

async function addPaymentColumns() {
    try {
        console.log('🔄 Ajout des colonnes de paiement...');
        await db.connect();
        
        const pgPool = db.getPgPool();
        if (!pgPool) {
            console.error('❌ pg Pool non configuré. Veuillez configurer DB_HOST, DB_USER, DB_PASSWORD dans votre fichier .env');
            console.error('   Ces variables sont nécessaires pour exécuter les migrations SQL.');
            process.exit(1);
        }
        
        const client = await pgPool.connect();
        
        try {
            await client.query('BEGIN');
            
            // Vérifier et ajouter les colonnes si elles n'existent pas
            const columnsCheck = await client.query(`
                SELECT column_name
                FROM information_schema.columns
                WHERE table_schema = 'public'
                AND table_name = 'contrats'
                AND column_name IN ('montant_paye', 'montant_restant')
            `);
            
            const existingColumns = columnsCheck.rows.map(row => row.column_name);
            
            if (!existingColumns.includes('montant_paye')) {
                await client.query(`
                    ALTER TABLE contrats 
                    ADD COLUMN montant_paye DECIMAL(10, 2) DEFAULT 0
                `);
                console.log('✅ Colonne montant_paye ajoutée');
            }
            
            if (!existingColumns.includes('montant_restant')) {
                await client.query(`
                    ALTER TABLE contrats 
                    ADD COLUMN montant_restant DECIMAL(10, 2) DEFAULT 0
                `);
                console.log('✅ Colonne montant_restant ajoutée');
            }
            
            // Mettre à jour les montants restants pour les contrats existants
            await client.query(`
                UPDATE contrats 
                SET montant_restant = montant - COALESCE(montant_paye, 0)
                WHERE montant_restant IS NULL OR montant_restant = 0
            `);
            
            if (existingColumns.length === 2) {
                console.log('✅ Toutes les colonnes de paiement existent déjà');
            }
            
            await client.query('COMMIT');
            console.log('✅ Colonnes de paiement ajoutées avec succès');
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Erreur lors de l\'ajout des colonnes:', error);
        process.exit(1);
    }
}

addPaymentColumns();

