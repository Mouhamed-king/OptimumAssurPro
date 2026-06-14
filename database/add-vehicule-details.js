const fs = require('fs');
const path = require('path');

async function ensureVehiculeDetailColumns(pool) {
    if (!pool) {
        return false;
    }

    const sql = fs.readFileSync(path.join(__dirname, 'add-vehicule-details.sql'), 'utf8');
    const client = await pool.connect();
    try {
        await client.query(sql);
        console.log('✅ Colonnes véhicule (puissance, energie, type_vehicule) vérifiées');
        return true;
    } finally {
        client.release();
    }
}

module.exports = { ensureVehiculeDetailColumns };
