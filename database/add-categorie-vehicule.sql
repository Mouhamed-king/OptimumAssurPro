-- ============================================
-- MIGRATION : Ajout de la catégorie de véhicule
-- ============================================
-- Ce script ajoute le champ categorie_vehicule à la table contrats
-- pour séparer les TPV (Transport Public de Voyageurs) et VP/CI (Véhicule Particulier/Camionnette)
--
-- 📋 INSTRUCTIONS POUR SUPABASE :
-- 1. Connectez-vous à votre projet Supabase : https://app.supabase.com
-- 2. Allez dans SQL Editor (menu de gauche)
-- 3. Cliquez sur "New query"
-- 4. Copiez-collez ce script complet
-- 5. Cliquez sur "Run" ou appuyez sur Ctrl+Enter (Windows) / Cmd+Enter (Mac)
--
-- ⚠️ ATTENTION : Ce script est sûr à exécuter (ne supprime aucune donnée)
-- Les contrats existants seront automatiquement marqués comme VP/CI
-- ============================================

-- Vérifier si la colonne existe déjà (éviter les erreurs si exécuté plusieurs fois)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'contrats' 
        AND column_name = 'categorie_vehicule'
    ) THEN
        -- Ajouter la colonne categorie_vehicule
        ALTER TABLE contrats 
        ADD COLUMN categorie_vehicule VARCHAR(10) DEFAULT 'VP/CI' 
        CHECK (categorie_vehicule IN ('TPV', 'VP/CI'));
        
        RAISE NOTICE 'Colonne categorie_vehicule ajoutée avec succès';
    ELSE
        RAISE NOTICE 'La colonne categorie_vehicule existe déjà';
    END IF;
END $$;

-- Créer un index pour optimiser les requêtes par catégorie
CREATE INDEX IF NOT EXISTS idx_contrats_categorie ON contrats(categorie_vehicule);

-- Mettre à jour les contrats existants (par défaut VP/CI)
UPDATE contrats 
SET categorie_vehicule = 'VP/CI' 
WHERE categorie_vehicule IS NULL;

-- Commentaire sur la colonne
COMMENT ON COLUMN contrats.categorie_vehicule IS 'Catégorie du véhicule: TPV (Transport Public de Voyageurs) ou VP/CI (Véhicule Particulier/Camionnette)';

-- Afficher un message de confirmation
DO $$
DECLARE
    contrat_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO contrat_count FROM contrats;
    RAISE NOTICE 'Migration terminée avec succès !';
    RAISE NOTICE 'Nombre total de contrats: %', contrat_count;
END $$;
