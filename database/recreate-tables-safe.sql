-- ============================================
-- SCRIPT SQL - RECRÉATION COMPLÈTE DES TABLES (VERSION SÉCURISÉE)
-- ============================================
-- Version qui évite les erreurs de dépendances
-- À exécuter dans le SQL Editor de Supabase Dashboard
-- ============================================

-- Désactiver temporairement les contraintes de clés étrangères (si nécessaire)
SET session_replication_role = 'replica';

-- Supprimer toutes les tables en une seule fois avec CASCADE
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS contrats CASCADE;
DROP TABLE IF EXISTS vehicules CASCADE;
DROP TABLE IF EXISTS clients CASCADE;
DROP TABLE IF EXISTS entreprises CASCADE;

-- Supprimer la fonction
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;

-- Réactiver les contraintes
SET session_replication_role = 'origin';

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

CREATE INDEX idx_entreprises_email ON entreprises(email);

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

CREATE INDEX idx_clients_entreprise ON clients(entreprise_id);
CREATE INDEX idx_clients_nom ON clients(nom, prenom);
CREATE INDEX idx_clients_telephone ON clients(telephone);

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

CREATE INDEX idx_vehicules_client ON vehicules(client_id);
CREATE INDEX idx_vehicules_immatriculation ON vehicules(immatriculation);

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

CREATE INDEX idx_contrats_client ON contrats(client_id);
CREATE INDEX idx_contrats_entreprise ON contrats(entreprise_id);
CREATE INDEX idx_contrats_vehicule ON contrats(vehicule_id);
CREATE INDEX idx_contrats_date_fin ON contrats(date_fin);
CREATE INDEX idx_contrats_statut ON contrats(statut);
CREATE INDEX idx_contrats_numero ON contrats(numero_contrat);

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

CREATE INDEX idx_notifications_entreprise ON notifications(entreprise_id);
CREATE INDEX idx_notifications_contrat ON notifications(contrat_id);
CREATE INDEX idx_notifications_lu ON notifications(lu);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);

-- ============================================
-- TRIGGER POUR SYNCHRONISER email_verified
-- ============================================
-- Ce trigger met à jour email_verified dans entreprises quand email_confirmed_at change dans auth.users
-- Note: Supabase ne permet pas directement de créer des triggers sur auth.users
-- Cette synchronisation se fait dans le code backend lors de la connexion

-- Fonction pour mettre à jour email_verified depuis auth.users
CREATE OR REPLACE FUNCTION sync_email_verified()
RETURNS TRIGGER AS $$
BEGIN
    -- Mettre à jour email_verified dans entreprises quand email_confirmed_at change
    UPDATE entreprises
    SET email_verified = (NEW.email_confirmed_at IS NOT NULL)
    WHERE id = NEW.id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Note: Ce trigger nécessite des permissions spéciales sur auth.users
-- Pour l'instant, la synchronisation se fait dans le code backend
-- Vous pouvez créer ce trigger manuellement dans Supabase Dashboard si vous avez les permissions

-- ============================================
-- VÉRIFICATION FINALE
-- ============================================
SELECT 
    '✅ Tables créées avec succès' as message,
    COUNT(*) as nombre_tables
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('entreprises', 'clients', 'vehicules', 'contrats', 'notifications');
