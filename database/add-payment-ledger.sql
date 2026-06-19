-- ============================================
-- SCRIPT SQL - Historique des paiements
-- ============================================
-- A executer dans le SQL Editor de Supabase Dashboard

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

CREATE INDEX IF NOT EXISTS idx_paiements_entreprise ON paiements(entreprise_id);
CREATE INDEX IF NOT EXISTS idx_paiements_contrat ON paiements(contrat_id);
CREATE INDEX IF NOT EXISTS idx_paiements_client ON paiements(client_id);
CREATE INDEX IF NOT EXISTS idx_paiements_date ON paiements(date_paiement);

ALTER TABLE paiements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own paiements" ON paiements;
CREATE POLICY "Users can view own paiements"
ON paiements
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM entreprises
        WHERE entreprises.id = paiements.entreprise_id
        AND entreprises.id = auth.uid()
    )
);

DROP POLICY IF EXISTS "Users can insert own paiements" ON paiements;
CREATE POLICY "Users can insert own paiements"
ON paiements
FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM entreprises
        WHERE entreprises.id = paiements.entreprise_id
        AND entreprises.id = auth.uid()
    )
);

DROP POLICY IF EXISTS "Users can update own paiements" ON paiements;
CREATE POLICY "Users can update own paiements"
ON paiements
FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM entreprises
        WHERE entreprises.id = paiements.entreprise_id
        AND entreprises.id = auth.uid()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM entreprises
        WHERE entreprises.id = paiements.entreprise_id
        AND entreprises.id = auth.uid()
    )
);

DROP POLICY IF EXISTS "Users can delete own paiements" ON paiements;
CREATE POLICY "Users can delete own paiements"
ON paiements
FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM entreprises
        WHERE entreprises.id = paiements.entreprise_id
        AND entreprises.id = auth.uid()
    )
);
