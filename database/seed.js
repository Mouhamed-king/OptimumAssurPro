// ============================================
// SCRIPT DE SEED (DONNÉES DE TEST) - Supabase
// ============================================

const bcrypt = require('bcryptjs');
const db = require('./connection');
require('dotenv').config();

async function seed() {
    try {
        console.log('🌱 Démarrage du seed...');
        await db.connect();
        
        const client = await db.pool.connect();
        
        try {
            // Vérifier si des données existent déjà
            const entreprises = await client.query('SELECT COUNT(*) as count FROM entreprises');
            if (parseInt(entreprises.rows[0].count) > 0) {
                console.log('⚠️  Des données existent déjà. Seed annulé.');
                client.release();
                return;
            }
            
            await client.query('BEGIN');
            
            // Créer une entreprise de test
            const hashedPassword = await bcrypt.hash('password123', 10);
            const entrepriseResult = await client.query(
                'INSERT INTO entreprises (nom, email, password, telephone, adresse) VALUES ($1, $2, $3, $4, $5) RETURNING id',
                ['Assurance Test', 'test@assurance.com', hashedPassword, '+221 77 123 4567', 'Dakar, Sénégal']
            );
            const entrepriseId = entrepriseResult.rows[0].id;
            
            // Créer des clients de test
            const clients = [
                ['Jean', 'Dupont', '+221 77 123 4567', 'jean.dupont@email.com', 'Dakar'],
                ['Marie', 'Martin', '+221 78 234 5678', 'marie.martin@email.com', 'Thiès'],
                ['Pierre', 'Durand', '+221 76 345 6789', 'pierre.durand@email.com', 'Saint-Louis']
            ];
            
            const clientIds = [];
            for (const [nom, prenom, telephone, email, adresse] of clients) {
                const clientResult = await client.query(
                    'INSERT INTO clients (entreprise_id, nom, prenom, telephone, email, adresse) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
                    [entrepriseId, nom, prenom, telephone, email, adresse]
                );
                clientIds.push(clientResult.rows[0].id);
            }
            
            // Créer des véhicules de test
            const vehicules = [
                [clientIds[0], 'Toyota', 'Corolla', 'DK-1234-AB', 2020, 'Blanc'],
                [clientIds[1], 'Peugeot', '208', 'TH-5678-CD', 2021, 'Rouge'],
                [clientIds[2], 'Renault', 'Clio', 'SL-9012-EF', 2019, 'Noir']
            ];
            
            const vehiculeIds = [];
            for (const [clientId, marque, modele, immatriculation, annee, couleur] of vehicules) {
                const vehiculeResult = await client.query(
                    'INSERT INTO vehicules (client_id, marque, modele, immatriculation, annee, couleur) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
                    [clientId, marque, modele, immatriculation, annee, couleur]
                );
                vehiculeIds.push(vehiculeResult.rows[0].id);
            }
            
            // Créer des contrats de test
            const now = new Date();
            const contrats = [
                [clientIds[0], vehiculeIds[0], entrepriseId, 'CONT-001', 'Tous risques', 12, 
                 new Date(now.getFullYear(), now.getMonth() - 3, 15), 
                 new Date(now.getFullYear(), now.getMonth() + 9, 15), 150000, 'actif'],
                [clientIds[1], vehiculeIds[1], entrepriseId, 'CONT-002', 'Tiers', 6,
                 new Date(now.getFullYear(), now.getMonth() - 1, 20),
                 new Date(now.getFullYear(), now.getMonth() + 5, 20), 75000, 'actif'],
                [clientIds[2], vehiculeIds[2], entrepriseId, 'CONT-003', 'Tous risques', 12,
                 new Date(now.getFullYear() - 1, now.getMonth(), 1),
                 new Date(now.getFullYear(), now.getMonth(), 1), 120000, 'expire']
            ];
            
            for (const [clientId, vehiculeId, entrepriseId, numero, type, duree, dateDebut, dateFin, montant, statut] of contrats) {
                await client.query(
                    'INSERT INTO contrats (client_id, vehicule_id, entreprise_id, numero_contrat, type_contrat, duree_mois, date_debut, date_fin, montant, statut) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
                    [clientId, vehiculeId, entrepriseId, numero, type, duree, dateDebut, dateFin, montant, statut]
                );
            }
            
            // Créer des notifications de test
            await client.query(
                'INSERT INTO notifications (entreprise_id, type, titre, message) VALUES ($1, $2, $3, $4)',
                [entrepriseId, 'alerte', 'Renouvellement à venir', '3 contrats arrivent à échéance dans les 7 prochains jours']
            );
            
            await client.query('COMMIT');
            
            console.log('✅ Seed terminé avec succès !');
            console.log('📧 Email de test: test@assurance.com');
            console.log('🔑 Mot de passe: password123');
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Erreur lors du seed:', error);
        process.exit(1);
    }
}

seed();
