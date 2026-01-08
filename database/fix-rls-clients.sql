-- ============================================
-- CORRECTION RLS POUR LA TABLE clients
-- ============================================
-- À exécuter IMMÉDIATEMENT dans le SQL Editor de Supabase Dashboard
-- Ce script crée/corrige les politiques RLS nécessaires pour permettre l'insertion
-- ============================================

-- Activer RLS sur la table clients (si pas déjà fait)
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

-- Supprimer les anciennes politiques si elles existent (pour éviter les conflits)
DROP POLICY IF EXISTS "Users can view own clients" ON clients;
DROP POLICY IF EXISTS "Users can insert own clients" ON clients;
DROP POLICY IF EXISTS "Users can update own clients" ON clients;
DROP POLICY IF EXISTS "Users can delete own clients" ON clients;

-- Politique : Les utilisateurs peuvent voir les clients de leur entreprise
-- Utilisation directe de auth.uid() = entreprise_id pour une meilleure performance
CREATE POLICY "Users can view own clients"
ON clients
FOR SELECT
USING (auth.uid() = entreprise_id);

-- Politique : Les utilisateurs peuvent créer des clients pour leur entreprise
-- IMPORTANT: Vérifie que l'entreprise_id correspond à l'utilisateur authentifié
CREATE POLICY "Users can insert own clients"
ON clients
FOR INSERT
WITH CHECK (auth.uid() = entreprise_id);

-- Politique : Les utilisateurs peuvent mettre à jour les clients de leur entreprise
CREATE POLICY "Users can update own clients"
ON clients
FOR UPDATE
USING (auth.uid() = entreprise_id)
WITH CHECK (auth.uid() = entreprise_id);

-- Politique : Les utilisateurs peuvent supprimer les clients de leur entreprise
CREATE POLICY "Users can delete own clients"
ON clients
FOR DELETE
USING (auth.uid() = entreprise_id);

-- ============================================
-- VÉRIFICATION
-- ============================================
SELECT 
    '✅ Politiques RLS créées pour clients' as message,
    COUNT(*) as nombre_politiques
FROM pg_policies
WHERE schemaname = 'public'
AND tablename = 'clients';

-- Afficher les politiques créées
SELECT 
    policyname,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public'
AND tablename = 'clients'
ORDER BY policyname;
