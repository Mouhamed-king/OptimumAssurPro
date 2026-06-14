require('dotenv').config();
const { getPgPool } = require('./connection');
const { ensureVehiculeDetailColumns } = require('./add-vehicule-details');

async function migrate() {
    const pool = getPgPool();
    if (!pool) {
        console.error('❌ Pool PostgreSQL non configuré. Exécutez add-vehicule-details.sql dans Supabase SQL Editor.');
        process.exit(1);
    }

    await ensureVehiculeDetailColumns(pool);
    await pool.end();
    console.log('Migration terminée.');
}

migrate().catch((error) => {
    console.error('❌ Migration échouée:', error.message);
    process.exit(1);
});
