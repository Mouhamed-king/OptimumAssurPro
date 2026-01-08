// ============================================
// CONNEXION SUPABASE AVEC SDK OFFICIEL
// ============================================

const { createClient } = require('@supabase/supabase-js');
const { Pool } = require('pg'); // Utilisé uniquement pour les migrations SQL (création de tables)
require('dotenv').config();

// Configuration Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Pour bypass RLS côté serveur
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY; // Pour le frontend

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Variables Supabase manquantes dans .env');
    console.error('Assurez-vous d\'avoir SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

// Créer le client Supabase avec SERVICE_ROLE_KEY (bypass RLS pour le backend)
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    },
    db: {
        schema: 'public'
    }
});

// Garder pg Pool uniquement pour les migrations SQL (création de tables, ALTER TABLE, etc.)
// Toutes les opérations CRUD utilisent Supabase SDK
let pgPool = null;
if (process.env.DB_HOST && process.env.DB_USER && process.env.DB_PASSWORD) {
    const dbConfig = {
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME || 'postgres',
        port: parseInt(process.env.DB_PORT) || 5432,
        ssl: process.env.DB_SSL === 'true' ? {
            rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false'
        } : false
    };
    pgPool = new Pool(dbConfig);
}

// Fonction pour tester la connexion
async function connect() {
    try {
        // Tester la connexion Supabase
        const { data, error } = await supabase
            .from('entreprises')
            .select('id')
            .limit(1);
        
        if (error && error.code !== 'PGRST116') { // PGRST116 = table n'existe pas encore
            throw error;
        }
        
        console.log('✅ Connexion à Supabase réussie');
        
        // Vérifier si les tables existent, sinon les créer (utilise pg)
        if (pgPool) {
            await createTablesIfNotExist();
        }
        
        return supabase;
    } catch (error) {
        console.error('❌ Erreur de connexion à Supabase:', error.message);
        throw error;
    }
}

// Fonction pour créer les tables si elles n'existent pas (utilise pg Pool pour SQL brut uniquement)
async function createTablesIfNotExist() {
    if (!pgPool) {
        console.log('⚠️  pg Pool non configuré, utilisez npm run migrate pour créer les tables');
        return;
    }
    
    const client = await pgPool.connect();
    
    try {
        // Vérifier si les tables existent déjà
        const tablesCheck = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name IN ('entreprises', 'clients', 'vehicules', 'contrats', 'notifications')
        `);
        
        // Si toutes les tables existent déjà, on ne fait rien
        if (tablesCheck.rows.length >= 5) {
            console.log('✅ Tables déjà existantes, pas besoin de les créer');
            return;
        }
        
        await client.query('BEGIN');
        
        // Table des entreprises
        // Note: L'ID utilise UUID pour correspondre à Supabase Auth (auth.users.id)
        await client.query(`
            CREATE TABLE IF NOT EXISTS entreprises (
                id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
                nom VARCHAR(255) NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                telephone VARCHAR(20),
                adresse TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        
        // Migration: Si la table existe déjà avec SERIAL, créer une migration
        // Note: Cette migration doit être exécutée manuellement pour les bases existantes
        await client.query(`
            DO $$ 
            BEGIN
                -- Supprimer les colonnes obsolètes si elles existent
                IF EXISTS (SELECT 1 FROM information_schema.columns 
                          WHERE table_name='entreprises' AND column_name='password') THEN
                    ALTER TABLE entreprises DROP COLUMN password;
                END IF;
                IF EXISTS (SELECT 1 FROM information_schema.columns 
                          WHERE table_name='entreprises' AND column_name='email_verified') THEN
                    ALTER TABLE entreprises DROP COLUMN email_verified;
                END IF;
                IF EXISTS (SELECT 1 FROM information_schema.columns 
                          WHERE table_name='entreprises' AND column_name='email_verification_token') THEN
                    ALTER TABLE entreprises DROP COLUMN email_verification_token;
                END IF;
                IF EXISTS (SELECT 1 FROM information_schema.columns 
                          WHERE table_name='entreprises' AND column_name='email_verification_expires') THEN
                    ALTER TABLE entreprises DROP COLUMN email_verification_expires;
                END IF;
                IF EXISTS (SELECT 1 FROM information_schema.columns 
                          WHERE table_name='entreprises' AND column_name='password_reset_token') THEN
                    ALTER TABLE entreprises DROP COLUMN password_reset_token;
                END IF;
                IF EXISTS (SELECT 1 FROM information_schema.columns 
                          WHERE table_name='entreprises' AND column_name='password_reset_expires') THEN
                    ALTER TABLE entreprises DROP COLUMN password_reset_expires;
                END IF;
            END $$;
        `);
        
        // Table des clients
        await client.query(`
            CREATE TABLE IF NOT EXISTS clients (
                id SERIAL PRIMARY KEY,
                entreprise_id UUID NOT NULL,
                nom VARCHAR(255) NOT NULL,
                prenom VARCHAR(255) NOT NULL,
                telephone VARCHAR(20) NOT NULL,
                email VARCHAR(255),
                adresse TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (entreprise_id) REFERENCES entreprises(id) ON DELETE CASCADE
            );
        `);
        
        // Créer les index pour les clients
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_clients_entreprise ON clients(entreprise_id);
            CREATE INDEX IF NOT EXISTS idx_clients_nom ON clients(nom, prenom);
        `);
        
        // Table des véhicules
        await client.query(`
            CREATE TABLE IF NOT EXISTS vehicules (
                id SERIAL PRIMARY KEY,
                client_id INTEGER NOT NULL,
                marque VARCHAR(100) NOT NULL,
                modele VARCHAR(100) NOT NULL,
                immatriculation VARCHAR(50) UNIQUE,
                annee INTEGER,
                couleur VARCHAR(50),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
            );
        `);
        
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_vehicules_client ON vehicules(client_id);
        `);
        
        // Table des contrats
        await client.query(`
            CREATE TABLE IF NOT EXISTS contrats (
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
                statut VARCHAR(20) DEFAULT 'actif' CHECK (statut IN ('actif', 'expire', 'renouvele', 'annule')),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
                FOREIGN KEY (vehicule_id) REFERENCES vehicules(id) ON DELETE CASCADE,
                FOREIGN KEY (entreprise_id) REFERENCES entreprises(id) ON DELETE CASCADE
            );
        `);
        
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_contrats_client ON contrats(client_id);
            CREATE INDEX IF NOT EXISTS idx_contrats_entreprise ON contrats(entreprise_id);
            CREATE INDEX IF NOT EXISTS idx_contrats_date_fin ON contrats(date_fin);
            CREATE INDEX IF NOT EXISTS idx_contrats_statut ON contrats(statut);
        `);
        
        // Table des notifications
        await client.query(`
            CREATE TABLE IF NOT EXISTS notifications (
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
        `);
        
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_notifications_entreprise ON notifications(entreprise_id);
            CREATE INDEX IF NOT EXISTS idx_notifications_lu ON notifications(lu);
        `);
        
        // Fonction pour mettre à jour updated_at automatiquement
        await client.query(`
            CREATE OR REPLACE FUNCTION update_updated_at_column()
            RETURNS TRIGGER AS $$
            BEGIN
                NEW.updated_at = CURRENT_TIMESTAMP;
                RETURN NEW;
            END;
            $$ language 'plpgsql';
        `);
        
        // Triggers pour mettre à jour updated_at
        await client.query(`
            DROP TRIGGER IF EXISTS update_entreprises_updated_at ON entreprises;
            CREATE TRIGGER update_entreprises_updated_at
            BEFORE UPDATE ON entreprises
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
        `);
        
        await client.query(`
            DROP TRIGGER IF EXISTS update_clients_updated_at ON clients;
            CREATE TRIGGER update_clients_updated_at
            BEFORE UPDATE ON clients
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
        `);
        
        await client.query(`
            DROP TRIGGER IF EXISTS update_vehicules_updated_at ON vehicules;
            CREATE TRIGGER update_vehicules_updated_at
            BEFORE UPDATE ON vehicules
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
        `);
        
        await client.query(`
            DROP TRIGGER IF EXISTS update_contrats_updated_at ON contrats;
            CREATE TRIGGER update_contrats_updated_at
            BEFORE UPDATE ON contrats
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
        `);
        
        await client.query('COMMIT');
        console.log('✅ Tables Supabase créées/vérifiées avec succès');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Erreur lors de la création des tables:', error);
        throw error;
    } finally {
        client.release();
    }
}

// Fonction helper pour obtenir le client Supabase
function getClient() {
    return supabase;
}

// Fonction helper pour obtenir le pool pg (pour migrations uniquement)
function getPgPool() {
    return pgPool;
}

// Fonction de compatibilité pour les migrations SQL uniquement (dépréciée pour CRUD)
// ⚠️  Ne pas utiliser pour les opérations CRUD - utiliser Supabase SDK à la place
async function query(sql, params) {
    console.warn('⚠️  Utilisation de query() SQL brut. Pour les CRUD, utilisez les méthodes Supabase SDK.');
    if (!pgPool) {
        throw new Error('pg Pool non configuré. Utilisez les méthodes Supabase SDK pour les CRUD.');
    }
    try {
        const result = await pgPool.query(sql, params);
        return result.rows;
    } catch (error) {
        console.error('Erreur SQL:', error);
        throw error;
    }
}

module.exports = {
    supabase, // Client Supabase SDK pour toutes les opérations CRUD
    connect,
    query, // ⚠️ Déprécié pour CRUD - utiliser uniquement pour migrations SQL
    getClient,
    getPgPool, // Pour migrations SQL uniquement
    pool: pgPool // Pour migrations SQL uniquement
};
