async function ensureAasTrackingColumns(pool) {
    if (!pool) return false;
    const client = await pool.connect();
    try {
        await client.query(`
            ALTER TABLE clients
                ADD COLUMN IF NOT EXISTS coordonnees_source VARCHAR(30) DEFAULT 'manuel',
                ADD COLUMN IF NOT EXISTS coordonnees_verifiees BOOLEAN DEFAULT TRUE;
            ALTER TABLE vehicules
                ADD COLUMN IF NOT EXISTS aas_date_effet DATE,
                ADD COLUMN IF NOT EXISTS aas_date_echeance DATE,
                ADD COLUMN IF NOT EXISTS aas_derniere_verification TIMESTAMPTZ,
                ADD COLUMN IF NOT EXISTS aas_compagnie VARCHAR(255),
                ADD COLUMN IF NOT EXISTS aas_numero_attestation VARCHAR(150),
                ADD COLUMN IF NOT EXISTS aas_source VARCHAR(30),
                ADD COLUMN IF NOT EXISTS aas_statut_commercial VARCHAR(30),
                ADD COLUMN IF NOT EXISTS aas_categorie VARCHAR(20);
            CREATE INDEX IF NOT EXISTS idx_vehicules_aas_echeance ON vehicules(aas_date_echeance);
            CREATE INDEX IF NOT EXISTS idx_vehicules_aas_statut ON vehicules(aas_statut_commercial);
        `);
        console.log('Colonnes de suivi AAS vérifiées');
        return true;
    } finally {
        client.release();
    }
}

module.exports = { ensureAasTrackingColumns };
