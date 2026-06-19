// ============================================
// SCRIPT DE MIGRATION - Historique des paiements
// ============================================

const db = require('./connection');
require('dotenv').config();

async function addPaymentLedger() {
    try {
        console.log('Ajout de la table paiements...');
        await db.connect();

        const pgPool = db.getPgPool();
        if (!pgPool) {
            console.error('pg Pool non configure. Executez database/add-payment-ledger.sql dans Supabase.');
            process.exit(1);
        }

        const client = await pgPool.connect();

        try {
            await client.query('BEGIN');

            await client.query(`
                CREATE TABLE IF NOT EXISTS paiements (
                    id SERIAL PRIMARY KEY,
                    entreprise_id UUID NOT NULL,
                    contrat_id INTEGER NOT NULL,
                    client_id INTEGER,
                    montant DECIMAL(10, 2) NOT NULL,
                    type VARCHAR(30) DEFAULT 'encaissement' CHECK (type IN ('encaissement', 'correction')),
                    source VARCHAR(50) DEFAULT 'manuel',
                    mode_paiement VARCHAR(50),
                    note TEXT,
                    date_paiement TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (entreprise_id) REFERENCES entreprises(id) ON DELETE CASCADE,
                    FOREIGN KEY (contrat_id) REFERENCES contrats(id) ON DELETE CASCADE,
                    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL
                );
            `);

            await client.query(`
                CREATE INDEX IF NOT EXISTS idx_paiements_entreprise ON paiements(entreprise_id);
                CREATE INDEX IF NOT EXISTS idx_paiements_contrat ON paiements(contrat_id);
                CREATE INDEX IF NOT EXISTS idx_paiements_client ON paiements(client_id);
                CREATE INDEX IF NOT EXISTS idx_paiements_date ON paiements(date_paiement);
            `);

            await client.query('COMMIT');
            console.log('Table paiements prete.');
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }

        process.exit(0);
    } catch (error) {
        console.error('Erreur migration paiements:', error);
        process.exit(1);
    }
}

addPaymentLedger();
