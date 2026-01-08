-- ============================================
-- POLITIQUES ROW LEVEL SECURITY (RLS) POUR SUPABASE
-- ============================================
-- À exécuter dans le SQL Editor de Supabase Dashboard
-- Ces politiques permettent aux utilisateurs authentifiés d'accéder à leurs propres données
-- ============================================

-- ============================================
-- TABLE : entreprises
-- ============================================

-- Activer RLS sur la table entreprises
ALTER TABLE entreprises ENABLE ROW LEVEL SECURITY;

-- Politique : Les utilisateurs peuvent lire leur propre entreprise
CREATE POLICY "Users can view own entreprise"
ON entreprises
FOR SELECT
USING (auth.uid() = id);

-- Politique : Les utilisateurs peuvent créer leur propre entreprise
-- Note: Cette politique permet la création lors de l'inscription
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
-- TABLE : clients
-- ============================================

-- Activer RLS sur la table clients
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

-- Politique : Les utilisateurs peuvent voir les clients de leur entreprise
CREATE POLICY "Users can view own clients"
ON clients
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM entreprises
        WHERE entreprises.id = clients.entreprise_id
        AND entreprises.id = auth.uid()
    )
);

-- Politique : Les utilisateurs peuvent créer des clients pour leur entreprise
CREATE POLICY "Users can insert own clients"
ON clients
FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM entreprises
        WHERE entreprises.id = clients.entreprise_id
        AND entreprises.id = auth.uid()
    )
);

-- Politique : Les utilisateurs peuvent mettre à jour les clients de leur entreprise
CREATE POLICY "Users can update own clients"
ON clients
FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM entreprises
        WHERE entreprises.id = clients.entreprise_id
        AND entreprises.id = auth.uid()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM entreprises
        WHERE entreprises.id = clients.entreprise_id
        AND entreprises.id = auth.uid()
    )
);

-- Politique : Les utilisateurs peuvent supprimer les clients de leur entreprise
CREATE POLICY "Users can delete own clients"
ON clients
FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM entreprises
        WHERE entreprises.id = clients.entreprise_id
        AND entreprises.id = auth.uid()
    )
);

-- ============================================
-- TABLE : vehicules
-- ============================================

-- Activer RLS sur la table vehicules
ALTER TABLE vehicules ENABLE ROW LEVEL SECURITY;

-- Politique : Les utilisateurs peuvent voir les véhicules de leurs clients
CREATE POLICY "Users can view own vehicules"
ON vehicules
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM clients
        JOIN entreprises ON entreprises.id = clients.entreprise_id
        WHERE clients.id = vehicules.client_id
        AND entreprises.id = auth.uid()
    )
);

-- Politique : Les utilisateurs peuvent créer des véhicules pour leurs clients
CREATE POLICY "Users can insert own vehicules"
ON vehicules
FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM clients
        JOIN entreprises ON entreprises.id = clients.entreprise_id
        WHERE clients.id = vehicules.client_id
        AND entreprises.id = auth.uid()
    )
);

-- Politique : Les utilisateurs peuvent mettre à jour les véhicules de leurs clients
CREATE POLICY "Users can update own vehicules"
ON vehicules
FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM clients
        JOIN entreprises ON entreprises.id = clients.entreprise_id
        WHERE clients.id = vehicules.client_id
        AND entreprises.id = auth.uid()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM clients
        JOIN entreprises ON entreprises.id = clients.entreprise_id
        WHERE clients.id = vehicules.client_id
        AND entreprises.id = auth.uid()
    )
);

-- Politique : Les utilisateurs peuvent supprimer les véhicules de leurs clients
CREATE POLICY "Users can delete own vehicules"
ON vehicules
FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM clients
        JOIN entreprises ON entreprises.id = clients.entreprise_id
        WHERE clients.id = vehicules.client_id
        AND entreprises.id = auth.uid()
    )
);

-- ============================================
-- TABLE : contrats
-- ============================================

-- Activer RLS sur la table contrats
ALTER TABLE contrats ENABLE ROW LEVEL SECURITY;

-- Politique : Les utilisateurs peuvent voir les contrats de leur entreprise
CREATE POLICY "Users can view own contrats"
ON contrats
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM entreprises
        WHERE entreprises.id = contrats.entreprise_id
        AND entreprises.id = auth.uid()
    )
);

-- Politique : Les utilisateurs peuvent créer des contrats pour leur entreprise
CREATE POLICY "Users can insert own contrats"
ON contrats
FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM entreprises
        WHERE entreprises.id = contrats.entreprise_id
        AND entreprises.id = auth.uid()
    )
);

-- Politique : Les utilisateurs peuvent mettre à jour les contrats de leur entreprise
CREATE POLICY "Users can update own contrats"
ON contrats
FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM entreprises
        WHERE entreprises.id = contrats.entreprise_id
        AND entreprises.id = auth.uid()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM entreprises
        WHERE entreprises.id = contrats.entreprise_id
        AND entreprises.id = auth.uid()
    )
);

-- Politique : Les utilisateurs peuvent supprimer les contrats de leur entreprise
CREATE POLICY "Users can delete own contrats"
ON contrats
FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM entreprises
        WHERE entreprises.id = contrats.entreprise_id
        AND entreprises.id = auth.uid()
    )
);

-- ============================================
-- TABLE : notifications
-- ============================================

-- Activer RLS sur la table notifications
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Politique : Les utilisateurs peuvent voir les notifications de leur entreprise
CREATE POLICY "Users can view own notifications"
ON notifications
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM entreprises
        WHERE entreprises.id = notifications.entreprise_id
        AND entreprises.id = auth.uid()
    )
);

-- Politique : Les utilisateurs peuvent créer des notifications pour leur entreprise
CREATE POLICY "Users can insert own notifications"
ON notifications
FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM entreprises
        WHERE entreprises.id = notifications.entreprise_id
        AND entreprises.id = auth.uid()
    )
);

-- Politique : Les utilisateurs peuvent mettre à jour les notifications de leur entreprise
CREATE POLICY "Users can update own notifications"
ON notifications
FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM entreprises
        WHERE entreprises.id = notifications.entreprise_id
        AND entreprises.id = auth.uid()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM entreprises
        WHERE entreprises.id = notifications.entreprise_id
        AND entreprises.id = auth.uid()
    )
);

-- Politique : Les utilisateurs peuvent supprimer les notifications de leur entreprise
CREATE POLICY "Users can delete own notifications"
ON notifications
FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM entreprises
        WHERE entreprises.id = notifications.entreprise_id
        AND entreprises.id = auth.uid()
    )
);

-- ============================================
-- VÉRIFICATION
-- ============================================
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN ('entreprises', 'clients', 'vehicules', 'contrats', 'notifications')
ORDER BY tablename, policyname;
