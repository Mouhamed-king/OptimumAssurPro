-- ============================================
-- SCRIPT SQL - Ajout des colonnes de paiement
-- ============================================
-- À exécuter dans le SQL Editor de Supabase Dashboard
-- https://app.supabase.com/project/[votre-projet]/sql/new

-- Vérifier et ajouter la colonne montant_paye si elle n'existe pas
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'contrats' 
        AND column_name = 'montant_paye'
    ) THEN
        ALTER TABLE contrats 
        ADD COLUMN montant_paye DECIMAL(10, 2) DEFAULT 0;
        RAISE NOTICE 'Colonne montant_paye ajoutée';
    ELSE
        RAISE NOTICE 'Colonne montant_paye existe déjà';
    END IF;
END $$;

-- Vérifier et ajouter la colonne montant_restant si elle n'existe pas
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'contrats' 
        AND column_name = 'montant_restant'
    ) THEN
        ALTER TABLE contrats 
        ADD COLUMN montant_restant DECIMAL(10, 2) DEFAULT 0;
        RAISE NOTICE 'Colonne montant_restant ajoutée';
    ELSE
        RAISE NOTICE 'Colonne montant_restant existe déjà';
    END IF;
END $$;

-- Mettre à jour les montants restants pour les contrats existants (optionnel)
-- UPDATE contrats 
-- SET montant_restant = montant - COALESCE(montant_paye, 0)
-- WHERE montant_restant IS NULL OR montant_restant = 0;

