// ============================================
// SCRIPT DE MIGRATION DE LA BASE DE DONNÉES
// ============================================

const db = require('./connection');

async function migrate() {
    try {
        console.log('🔄 Démarrage de la migration...');
        await db.connect();
        console.log('✅ Migration terminée avec succès');
        process.exit(0);
    } catch (error) {
        console.error('❌ Erreur lors de la migration:', error);
        process.exit(1);
    }
}

migrate();

