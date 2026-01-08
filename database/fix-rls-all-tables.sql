-- ============================================
-- CORRECTION RLS POUR TOUTES LES TABLES
-- ============================================
-- À exécuter IMMÉDIATEMENT dans le SQL Editor de Supabase Dashboard
-- Ce script crée/corrige les politiques RLS nécessaires pour toutes les tables
-- ============================================

-- ============================================
-- TABLE : clients
-- ============================================
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own clients" ON clients;
DROP POLICY IF EXISTS "Users can insert own clients" ON clients;
DROP POLICY IF EXISTS "Users can update own clients" ON clients;
DROP POLICY IF EXISTS "Users can delete own clients" ON clients;

CREATE POLICY "Users can view own clients"
ON clients FOR SELECT
USING (auth.uid() = entreprise_id);

CREATE POLICY "Users can insert own clients"
ON clients FOR INSERT
WITH CHECK (auth.uid() = entreprise_id);

CREATE POLICY "Users can update own clients"
ON clients FOR UPDATE
USING (auth.uid() = entreprise_id)
WITH CHECK (auth.uid() = entreprise_id);

CREATE POLICY "Users can delete own clients"
ON clients FOR DELETE
USING (auth.uid() = entreprise_id);

-- ============================================
-- TABLE : vehicules
-- ============================================
ALTER TABLE vehicules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own vehicules" ON vehicules;
DROP POLICY IF EXISTS "Users can insert own vehicules" ON vehicules;
DROP POLICY IF EXISTS "Users can update own vehicules" ON vehicules;
DROP POLICY IF EXISTS "Users can delete own vehicules" ON vehicules;

-- Les véhicules sont liés aux clients, donc on vérifie via la relation client -> entreprise
CREATE POLICY "Users can view own vehicules"
ON vehicules FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM clients
        WHERE clients.id = vehicules.client_id
        AND clients.entreprise_id = auth.uid()
    )
);

CREATE POLICY "Users can insert own vehicules"
ON vehicules FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM clients
        WHERE clients.id = vehicules.client_id
        AND clients.entreprise_id = auth.uid()
    )
);

CREATE POLICY "Users can update own vehicules"
ON vehicules FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM clients
        WHERE clients.id = vehicules.client_id
        AND clients.entreprise_id = auth.uid()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM clients
        WHERE clients.id = vehicules.client_id
        AND clients.entreprise_id = auth.uid()
    )
);

CREATE POLICY "Users can delete own vehicules"
ON vehicules FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM clients
        WHERE clients.id = vehicules.client_id
        AND clients.entreprise_id = auth.uid()
    )
);

-- ============================================
-- TABLE : contrats
-- ============================================
ALTER TABLE contrats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own contrats" ON contrats;
DROP POLICY IF EXISTS "Users can insert own contrats" ON contrats;
DROP POLICY IF EXISTS "Users can update own contrats" ON contrats;
DROP POLICY IF EXISTS "Users can delete own contrats" ON contrats;

-- Les contrats ont directement entreprise_id, donc on peut utiliser une vérification directe
CREATE POLICY "Users can view own contrats"
ON contrats FOR SELECT
USING (auth.uid() = entreprise_id);

CREATE POLICY "Users can insert own contrats"
ON contrats FOR INSERT
WITH CHECK (auth.uid() = entreprise_id);

CREATE POLICY "Users can update own contrats"
ON contrats FOR UPDATE
USING (auth.uid() = entreprise_id)
WITH CHECK (auth.uid() = entreprise_id);

CREATE POLICY "Users can delete own contrats"
ON contrats FOR DELETE
USING (auth.uid() = entreprise_id);

-- ============================================
-- TABLE : notifications
-- ============================================
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can insert own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can delete own notifications" ON notifications;

CREATE POLICY "Users can view own notifications"
ON notifications FOR SELECT
USING (auth.uid() = entreprise_id);

CREATE POLICY "Users can insert own notifications"
ON notifications FOR INSERT
WITH CHECK (auth.uid() = entreprise_id);

CREATE POLICY "Users can update own notifications"
ON notifications FOR UPDATE
USING (auth.uid() = entreprise_id)
WITH CHECK (auth.uid() = entreprise_id);

CREATE POLICY "Users can delete own notifications"
ON notifications FOR DELETE
USING (auth.uid() = entreprise_id);

-- ============================================
-- VÉRIFICATION
-- ============================================
SELECT 
    tablename,
    COUNT(*) as nombre_politiques
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN ('clients', 'vehicules', 'contrats', 'notifications')
GROUP BY tablename
ORDER BY tablename;

-- Afficher toutes les politiques créées
SELECT 
    tablename,
    policyname,
    cmd
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN ('clients', 'vehicules', 'contrats', 'notifications')
ORDER BY tablename, policyname;
