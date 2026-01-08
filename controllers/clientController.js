// ============================================
// CONTRÔLEUR DES CLIENTS (Supabase SDK)
// ============================================

const db = require('../database/connection');

// Obtenir tous les clients de l'entreprise
const getAllClients = async (req, res) => {
    try {
        const { search, statut } = req.query;
        
        // Construire la requête Supabase - récupérer tous les clients pour pouvoir chercher dans les immatriculations
        let query = db.supabase
            .from('clients')
            .select(`
                *,
                vehicules (*),
                contrats (id, numero_contrat, date_fin, statut)
            `)
            .eq('entreprise_id', req.entrepriseId);
        
        // Ne pas filtrer dans Supabase si on cherche, car on doit aussi chercher dans les immatriculations
        // On filtrera après avoir récupéré toutes les données
        
        const { data: clients, error } = await query.order('created_at', { ascending: false });
        
        if (error) {
            throw error;
        }
        
        // Enrichir les données avec les statistiques
        let enrichedClients = clients.map(client => {
            const nombre_contrats = client.contrats?.length || 0;
            const dernier_contrat = client.contrats?.length > 0 
                ? client.contrats.reduce((latest, c) => {
                    return new Date(c.date_fin) > new Date(latest.date_fin) ? c : latest;
                }, client.contrats[0])
                : null;
            
            // Déterminer le statut du client basé sur ses contrats
            const hasActiveContract = client.contrats?.some(c => c.statut === 'actif') || false;
            const clientStatut = hasActiveContract ? 'actif' : 'inactif';
            
            return {
                ...client,
                nombre_contrats,
                dernier_contrat: dernier_contrat ? dernier_contrat.date_fin : null,
                client_statut: clientStatut,
                vehicules: client.vehicules || []
            };
        });
        
        // Filtrer par recherche (nom, téléphone, immatriculation) si nécessaire
        if (search) {
            const searchLower = search.toLowerCase().trim();
            enrichedClients = enrichedClients.filter(client => {
                // Recherche dans le nom du client
                const matchesNom = client.nom?.toLowerCase().includes(searchLower) || false;
                
                // Recherche dans le téléphone
                const matchesTelephone = client.telephone?.toLowerCase().includes(searchLower) || false;
                
                // Recherche dans les immatriculations des véhicules
                const matchesImmatriculation = client.vehicules?.some(vehicule => 
                    vehicule.immatriculation?.toLowerCase().includes(searchLower)
                ) || false;
                
                return matchesNom || matchesTelephone || matchesImmatriculation;
            });
        }
        
        // Filtrer par statut si fourni
        if (statut) {
            enrichedClients = enrichedClients.filter(client => client.client_statut === statut);
        }
        
        res.json({ clients: enrichedClients });
    } catch (error) {
        console.error('Erreur lors de la récupération des clients:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération des clients: ' + error.message });
    }
};

// Obtenir un client par ID
const getClientById = async (req, res) => {
    try {
        const { id } = req.params;
        
        const { data: client, error } = await db.supabase
            .from('clients')
            .select(`
                *,
                vehicules (*),
                contrats (
                    *,
                    vehicules (marque, modele, immatriculation)
                )
            `)
            .eq('id', id)
            .eq('entreprise_id', req.entrepriseId)
            .single();
        
        if (error || !client) {
            return res.status(404).json({ error: 'Client non trouvé' });
        }
        
        res.json({ client });
    } catch (error) {
        console.error('Erreur lors de la récupération du client:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération du client: ' + error.message });
    }
};

// Créer un nouveau client
const createClient = async (req, res) => {
    try {
        const { nom, telephone, vehicule, contrat } = req.body;
        
        // Validation des champs essentiels
        if (!nom || !telephone || !vehicule || !vehicule.immatriculation || !contrat || !contrat.numero_police || !contrat.date_debut || !contrat.date_fin || !contrat.montant) {
            return res.status(400).json({ error: 'Nom, téléphone, immatriculation, numéro de police, dates et prime nette sont requis' });
        }
        
        // Vérifier si le téléphone existe déjà pour cette entreprise
        const { data: existingClient, error: existingClientError } = await db.supabase
            .from('clients')
            .select('id')
            .eq('telephone', telephone)
            .eq('entreprise_id', req.entrepriseId)
            .maybeSingle();

        if (existingClientError && existingClientError.code !== 'PGRST116') {
            throw existingClientError;
        }
        if (existingClient) {
            return res.status(400).json({ error: 'Un client avec ce numéro de téléphone existe déjà' });
        }
        
        // Créer le client avec Supabase (nom complet dans le champ nom, prenom vide)
        const { data: newClient, error: clientError } = await db.supabase
            .from('clients')
            .insert({
                entreprise_id: req.entrepriseId,
                nom: nom,
                prenom: '', // Vide car on ne demande que le nom complet
                telephone: telephone
            })
            .select()
            .single();
        
        if (clientError) {
            throw clientError;
        }
        
        // Créer le véhicule avec seulement l'immatriculation
        const { data: newVehicule, error: vehiculeError } = await db.supabase
            .from('vehicules')
            .insert({
                client_id: newClient.id,
                marque: vehicule.marque || '',
                modele: vehicule.modele || '',
                immatriculation: vehicule.immatriculation
            })
            .select('id')
            .single();
        
        if (vehiculeError) {
            throw vehiculeError;
        }
        
        // Récupérer les montants (saisis manuellement car le prix peut varier)
        const montantPaye = contrat.montant_paye || 0;
        const montantRestant = contrat.montant_restant || 0;
        
        // Créer le contrat
        const { data: newContrat, error: contratError } = await db.supabase
            .from('contrats')
            .insert({
                client_id: newClient.id,
                vehicule_id: newVehicule.id,
                entreprise_id: req.entrepriseId,
                numero_contrat: contrat.numero_police,
                type_contrat: contrat.type_contrat || 'Tous risques',
                duree_mois: contrat.duree_mois || 12,
                date_debut: contrat.date_debut,
                date_fin: contrat.date_fin,
                montant: contrat.montant,
                montant_paye: montantPaye,
                montant_restant: montantRestant,
                statut: 'actif'
            })
            .select('id')
            .single();
        
        if (contratError) {
            console.error('Erreur lors de la création du contrat:', contratError);
            throw new Error('Erreur lors de la création du contrat: ' + contratError.message);
        }
        
        res.status(201).json({
            message: 'Client créé avec succès',
            client: newClient,
            vehiculeId: newVehicule.id,
            contratId: newContrat.id
        });
    } catch (error) {
        console.error('Erreur lors de la création du client:', error);
        res.status(500).json({ error: 'Erreur lors de la création du client: ' + error.message });
    }
};

// Mettre à jour un client
const updateClient = async (req, res) => {
    try {
        const { id } = req.params;
        const { nom, prenom, telephone, vehicule, contrat } = req.body;
        
        // Vérifier que le client appartient à l'entreprise
        const { data: existing } = await db.supabase
            .from('clients')
            .select('id')
            .eq('id', id)
            .eq('entreprise_id', req.entrepriseId)
            .single();
        
        if (!existing) {
            return res.status(404).json({ error: 'Client non trouvé' });
        }
        
        // Mettre à jour le client avec Supabase
        const { data: updated, error: clientError } = await db.supabase
            .from('clients')
            .update({
                nom: nom || undefined,
                prenom: prenom || undefined,
                telephone: telephone || undefined
            })
            .eq('id', id)
            .select()
            .single();
        
        if (clientError) {
            throw clientError;
        }
        
        // Mettre à jour le véhicule si fourni
        if (vehicule && vehicule.immatriculation) {
            // Récupérer le premier véhicule du client
            const { data: existingVehicules } = await db.supabase
                .from('vehicules')
                .select('id')
                .eq('client_id', id)
                .limit(1);
            
            if (existingVehicules && existingVehicules.length > 0) {
                // Mettre à jour le véhicule existant
                const { error: vehiculeError } = await db.supabase
                    .from('vehicules')
                    .update({
                        immatriculation: vehicule.immatriculation,
                        marque: vehicule.marque || '',
                        modele: vehicule.modele || ''
                    })
                    .eq('id', existingVehicules[0].id);
                
                if (vehiculeError) {
                    throw vehiculeError;
                }
            } else {
                // Créer un nouveau véhicule si aucun n'existe
                const { error: vehiculeError } = await db.supabase
                    .from('vehicules')
                    .insert({
                        client_id: id,
                        immatriculation: vehicule.immatriculation,
                        marque: vehicule.marque || '',
                        modele: vehicule.modele || ''
                    });
                
                if (vehiculeError) {
                    throw vehiculeError;
                }
            }
        }
        
        // Mettre à jour le contrat si fourni
        if (contrat && contrat.numero_police) {
            // Récupérer le dernier contrat du client (le plus récent)
            const { data: existingContrats } = await db.supabase
                .from('contrats')
                .select('id')
                .eq('client_id', id)
                .order('date_fin', { ascending: false })
                .limit(1);
            
            if (existingContrats && existingContrats.length > 0) {
                // Calculer la durée en mois
                const dateDebut = new Date(contrat.date_debut);
                const dateFin = new Date(contrat.date_fin);
                const diffTime = Math.abs(dateFin - dateDebut);
                const diffMonths = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 30));
                
                // Déterminer le statut du contrat
                const today = new Date();
                const statut = dateFin < today ? 'expire' : 'actif';
                
                // Récupérer les montants (saisis manuellement car le prix peut varier)
                const montantPaye = contrat.montant_paye || 0;
                const montantRestant = contrat.montant_restant || 0;
                
                // Mettre à jour le contrat existant
                const { error: contratError } = await db.supabase
                    .from('contrats')
                    .update({
                        numero_contrat: contrat.numero_police,
                        date_debut: contrat.date_debut,
                        date_fin: contrat.date_fin,
                        duree_mois: diffMonths,
                        montant: contrat.montant,
                        montant_paye: montantPaye,
                        montant_restant: montantRestant,
                        statut: statut
                    })
                    .eq('id', existingContrats[0].id);
                
                if (contratError) {
                    throw contratError;
                }
            } else {
                // Créer un nouveau contrat si aucun n'existe
                // Récupérer le véhicule du client pour l'associer au contrat
                const { data: clientVehicules } = await db.supabase
                    .from('vehicules')
                    .select('id')
                    .eq('client_id', id)
                    .limit(1);
                
                if (!clientVehicules || clientVehicules.length === 0) {
                    return res.status(400).json({ error: 'Le client doit avoir un véhicule pour créer un contrat' });
                }
                
                // Calculer la durée en mois
                const dateDebut = new Date(contrat.date_debut);
                const dateFin = new Date(contrat.date_fin);
                const diffTime = Math.abs(dateFin - dateDebut);
                const diffMonths = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 30));
                
                // Déterminer le statut du contrat
                const today = new Date();
                const statut = dateFin < today ? 'expire' : 'actif';
                
                // Récupérer les montants (saisis manuellement car le prix peut varier)
                const montantPaye = contrat.montant_paye || 0;
                const montantRestant = contrat.montant_restant || 0;
                
                const { error: contratError } = await db.supabase
                    .from('contrats')
                    .insert({
                        client_id: id,
                        vehicule_id: clientVehicules[0].id,
                        entreprise_id: req.entrepriseId,
                        numero_contrat: contrat.numero_police,
                        type_contrat: 'AC',
                        date_debut: contrat.date_debut,
                        date_fin: contrat.date_fin,
                        duree_mois: diffMonths,
                        montant: contrat.montant,
                        montant_paye: montantPaye,
                        montant_restant: montantRestant,
                        statut: statut
                    });
                
                if (contratError) {
                    throw contratError;
                }
            }
        }
        
        res.json({
            message: 'Client mis à jour avec succès',
            client: updated
        });
    } catch (error) {
        console.error('Erreur lors de la mise à jour du client:', error);
        res.status(500).json({ error: 'Erreur lors de la mise à jour du client: ' + error.message });
    }
};

// Supprimer un client
const deleteClient = async (req, res) => {
    try {
        const { id } = req.params;
        
        // Vérifier que le client appartient à l'entreprise
        const { data: existing } = await db.supabase
            .from('clients')
            .select('id')
            .eq('id', id)
            .eq('entreprise_id', req.entrepriseId)
            .single();
        
        if (!existing) {
            return res.status(404).json({ error: 'Client non trouvé' });
        }
        
        // Supprimer (CASCADE supprimera aussi les véhicules et contrats)
        const { error } = await db.supabase
            .from('clients')
            .delete()
            .eq('id', id);
        
        if (error) {
            throw error;
        }
        
        res.json({ message: 'Client supprimé avec succès' });
    } catch (error) {
        console.error('Erreur lors de la suppression du client:', error);
        res.status(500).json({ error: 'Erreur lors de la suppression du client: ' + error.message });
    }
};

module.exports = {
    getAllClients,
    getClientById,
    createClient,
    updateClient,
    deleteClient
};
