-- ============================================
-- SCRIPT SQL - RECRÉATION COMPLÈTE DES TABLES
-- ============================================
-- À exécuter dans le SQL Editor de Supabase Dashboard
-- https://app.supabase.com/project/[votre-projet]/sql/new
--
-- ⚠️ ATTENTION : Ce script supprime toutes les tables existantes et les recrée
-- Assurez-vous d'avoir sauvegardé vos données avant d'exécuter ce script
-- ============================================

-- Supprimer les triggers si les tables existent (doit être fait avant DROP TABLE)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notifications') THEN
        DROP TRIGGER IF EXISTS update_notifications_updated_at ON notifications;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'contrats') THEN
        DROP TRIGGER IF EXISTS update_contrats_updated_at ON contrats;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'vehicules') THEN
        DROP TRIGGER IF EXISTS update_vehicules_updated_at ON vehicules;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'clients') THEN
        DROP TRIGGER IF EXISTS update_clients_updated_at ON clients;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'entreprises') THEN
        DROP TRIGGER IF EXISTS update_entreprises_updated_at ON entreprises;
    END IF;
END $$;

-- Supprimer les tables existantes (dans l'ordre pour respecter les contraintes de clés étrangères)
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS contrats CASCADE;
DROP TABLE IF EXISTS vehicules CASCADE;
DROP TABLE IF EXISTS clients CASCADE;
DROP TABLE IF EXISTS entreprises CASCADE;

-- Supprimer la fonction si elle existe
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;

-- ============================================
-- CRÉATION DE LA FONCTION POUR updated_at
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- ============================================
-- TABLE : entreprises
-- ============================================
-- Note: L'ID utilise UUID pour correspondre à Supabase Auth (auth.users.id)
CREATE TABLE entreprises (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    nom VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    telephone VARCHAR(20),
    adresse TEXT,
    email_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index pour entreprises
CREATE INDEX idx_entreprises_email ON entreprises(email);

-- Trigger pour updated_at
CREATE TRIGGER update_entreprises_updated_at
    BEFORE UPDATE ON entreprises
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- TABLE : clients
-- ============================================
CREATE TABLE clients (
    id SERIAL PRIMARY KEY,
    entreprise_id UUID NOT NULL,
    nom VARCHAR(255) NOT NULL,
    prenom VARCHAR(255) NOT NULL DEFAULT '',
    telephone VARCHAR(20) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (entreprise_id) REFERENCES entreprises(id) ON DELETE CASCADE
);

-- Index pour clients
CREATE INDEX idx_clients_entreprise ON clients(entreprise_id);
CREATE INDEX idx_clients_nom ON clients(nom, prenom);
CREATE INDEX idx_clients_telephone ON clients(telephone);

-- Trigger pour updated_at
CREATE TRIGGER update_clients_updated_at
    BEFORE UPDATE ON clients
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- TABLE : vehicules
-- ============================================
CREATE TABLE vehicules (
    id SERIAL PRIMARY KEY,
    client_id INTEGER NOT NULL,
    marque VARCHAR(100) NOT NULL DEFAULT '',
    modele VARCHAR(100) NOT NULL DEFAULT '',
    immatriculation VARCHAR(50) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);

-- Index pour vehicules
CREATE INDEX idx_vehicules_client ON vehicules(client_id);
CREATE INDEX idx_vehicules_immatriculation ON vehicules(immatriculation);

-- Trigger pour updated_at
CREATE TRIGGER update_vehicules_updated_at
    BEFORE UPDATE ON vehicules
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- TABLE : contrats
-- ============================================
CREATE TABLE contrats (
    id SERIAL PRIMARY KEY,
    client_id INTEGER NOT NULL,
    vehicule_id INTEGER NOT NULL,
    entreprise_id UUID NOT NULL,
    numero_contrat VARCHAR(100) UNIQUE NOT NULL,
    type_contrat VARCHAR(50) NOT NULL,
    duree_mois INTEGER NOT NULL,
    date_debut DATE NOT NULL,
    date_fin DATE NOT NULL,
    montant DECIMAL(10, 2) NOT NULL,
    montant_paye DECIMAL(10, 2) DEFAULT 0,
    montant_restant DECIMAL(10, 2) DEFAULT 0,
    statut VARCHAR(20) DEFAULT 'actif' CHECK (statut IN ('actif', 'expire', 'renouvele', 'annule')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
    FOREIGN KEY (vehicule_id) REFERENCES vehicules(id) ON DELETE CASCADE,
    FOREIGN KEY (entreprise_id) REFERENCES entreprises(id) ON DELETE CASCADE
);

-- Index pour contrats
CREATE INDEX idx_contrats_client ON contrats(client_id);
CREATE INDEX idx_contrats_entreprise ON contrats(entreprise_id);
CREATE INDEX idx_contrats_vehicule ON contrats(vehicule_id);
CREATE INDEX idx_contrats_date_fin ON contrats(date_fin);
CREATE INDEX idx_contrats_statut ON contrats(statut);
CREATE INDEX idx_contrats_numero ON contrats(numero_contrat);

-- Trigger pour updated_at
CREATE TRIGGER update_contrats_updated_at
    BEFORE UPDATE ON contrats
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- TABLE : notifications
-- ============================================
CREATE TABLE notifications (
    id SERIAL PRIMARY KEY,
    entreprise_id UUID NOT NULL,
    contrat_id INTEGER,
    type VARCHAR(50) NOT NULL,
    titre VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    lu BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (entreprise_id) REFERENCES entreprises(id) ON DELETE CASCADE,
    FOREIGN KEY (contrat_id) REFERENCES contrats(id) ON DELETE SET NULL
);

-- Index pour notifications
CREATE INDEX idx_notifications_entreprise ON notifications(entreprise_id);
CREATE INDEX idx_notifications_contrat ON notifications(contrat_id);
CREATE INDEX idx_notifications_lu ON notifications(lu);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);

-- ============================================
-- VÉRIFICATIONS FINALES
-- ============================================
DO $$
BEGIN
    RAISE NOTICE '✅ Tables créées avec succès :';
    RAISE NOTICE '   - entreprises (UUID, référence auth.users)';
    RAISE NOTICE '   - clients (SERIAL, référence entreprises)';
    RAISE NOTICE '   - vehicules (SERIAL, référence clients)';
    RAISE NOTICE '   - contrats (SERIAL, référence clients, vehicules, entreprises)';
    RAISE NOTICE '   - notifications (SERIAL, référence entreprises, contrats)';
    RAISE NOTICE '';
    RAISE NOTICE '✅ Index créés pour optimiser les requêtes';
    RAISE NOTICE '✅ Triggers créés pour updated_at automatique';
    RAISE NOTICE '';
    RAISE NOTICE '📋 Colonnes importantes :';
    RAISE NOTICE '   - entreprises.email_verified (BOOLEAN) : Statut de vérification email';
    RAISE NOTICE '   - contrats.montant_paye (DEFAULT 0)';
    RAISE NOTICE '   - contrats.montant_restant (DEFAULT 0)';
    RAISE NOTICE '';
    RAISE NOTICE '💡 Note: email_verified est synchronisé avec auth.users.email_confirmed_at';
    RAISE NOTICE '   lors de la connexion et dans le middleware d''authentification';
END $$;
