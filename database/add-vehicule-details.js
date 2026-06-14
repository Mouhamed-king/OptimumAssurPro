require('dotenv').config();
const { getPgPool } = require('../database/connection');
const fs = require('fs');
const path = require('path');

async function migrate() {
    const pool = getPgPool();
    if (!pool) {
        console.error('❌ Pool PostgreSQL non configuré. Exécutez add-vehicule-details.sql dans Supabase.');
        process.exit(1);
    }

    const sql = fs.readFileSync(path.join(__dirname, 'add-vehicule-details.sql'), 'utf8');
    const client = await pool.connect();
    try {
        await client.query(sql);
        console.log('✅ Colonnes puissance, energie, type_vehicule ajoutées à vehicules');
    } finally {
        client.release();
        await pool.end();
    }
}

migrate().catch((error) => {
    console.error('❌ Migration échouée:', error.message);
    process.exit(1);
});
