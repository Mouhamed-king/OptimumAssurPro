-- ============================================
-- CORRECTION RLS POUR LA TABLE entreprises
-- ============================================
-- À exécuter IMMÉDIATEMENT dans le SQL Editor de Supabase Dashboard
-- Ce script crée les politiques RLS nécessaires pour permettre l'insertion
-- ============================================

-- Activer RLS sur la table entreprises (si pas déjà fait)
ALTER TABLE entreprises ENABLE ROW LEVEL SECURITY;

-- Supprimer les anciennes politiques si elles existent (pour éviter les conflits)
DROP POLICY IF EXISTS "Users can view own entreprise" ON entreprises;
DROP POLICY IF EXISTS "Users can insert own entreprise" ON entreprises;
DROP POLICY IF EXISTS "Users can update own entreprise" ON entreprises;
DROP POLICY IF EXISTS "Users can delete own entreprise" ON entreprises;

-- Politique : Les utilisateurs peuvent lire leur propre entreprise
CREATE POLICY "Users can view own entreprise"
ON entreprises
FOR SELECT
USING (auth.uid() = id);

-- Politique : Les utilisateurs peuvent créer leur propre entreprise
-- IMPORTANT: Cette politique permet la création lors de l'inscription
CREATE POLICY "Users can insert own entreprise"
ON entreprises
FOR INSERT
WITH CHECK (auth.uid() = id);

-- Politique : Les utilisateurs peuvent mettre à jour leur propre entreprise
CREATE POLICY "Users can update own entreprise"
ON entreprises
FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Politique : Les utilisateurs peuvent supprimer leur propre entreprise
CREATE POLICY "Users can delete own entreprise"
ON entreprises
FOR DELETE
USING (auth.uid() = id);

-- ============================================
-- VÉRIFICATION
-- ============================================
SELECT 
    '✅ Politiques RLS créées pour entreprises' as message,
    COUNT(*) as nombre_politiques
FROM pg_policies
WHERE schemaname = 'public'
AND tablename = 'entreprises';

-- Afficher les politiques créées
SELECT 
    policyname,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public'
AND tablename = 'entreprises'
ORDER BY policyname;
