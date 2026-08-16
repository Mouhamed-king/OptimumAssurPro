BEGIN;

ALTER TABLE public.contrats
    ADD COLUMN IF NOT EXISTS numero_attestation VARCHAR(150),
    ADD COLUMN IF NOT EXISTS frais DECIMAL(12, 2),
    ADD COLUMN IF NOT EXISTS taxe DECIMAL(12, 2),
    ADD COLUMN IF NOT EXISTS fga DECIMAL(12, 2),
    ADD COLUMN IF NOT EXISTS prime_ttc DECIMAL(12, 2),
    ADD COLUMN IF NOT EXISTS net_a_verser DECIMAL(12, 2);

CREATE INDEX IF NOT EXISTS idx_contrats_tpv_date_debut
    ON public.contrats(entreprise_id, categorie_vehicule, date_debut);

COMMIT;
