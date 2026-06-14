// ============================================
// CONTRÔLEUR DES CLIENTS (Supabase SDK)
// ============================================

const db = require('../database/connection');

function normalizeVehicleType(rawVehicule = {}) {
    const combined = [
        rawVehicule.type_vehicule,
        rawVehicule.modele,
        rawVehicule.marque
    ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

    if (!combined) return 'non_renseigne';
    if (combined.includes('moto')) return 'moto';
    if (combined.includes('camionnette') || combined.includes('pickup') || combined.includes('pick-up')) return 'camionnette';
    if (combined.includes('camion') || combined.includes('truck')) return 'camion';
    if (combined.includes('break') || combined.includes('wagon')) return 'break';
    if (combined.includes('particulier') || combined.includes('berline') || combined.includes('suv') || combined.includes('citadine')) return 'particulier';

    return 'particulier';
}

function getClientContractsForCategory(client, categorie) {
    const contrats = client.contrats || [];
    if (!categorie) {
        return contrats;
    }

    return contrats.filter(contrat => contrat.categorie_vehicule === categorie);
}

function getClientLatestContract(contrats = []) {
    if (!contrats.length) return null;

    return contrats.reduce((latest, current) => {
        return new Date(current.date_fin) > new Date(latest.date_fin) ? current : latest;
    }, contrats[0]);
}

// Obtenir tous les clients de l'entreprise
const getAllClients = async (req, res) => {
    try {
        const { search, statut, categorie, offset = 0, limit = 25, expire, expiringSoon, vehicleType } = req.query;
        const parsedOffset = Math.max(parseInt(offset, 10) || 0, 0);
        const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 25, 1), 1000);
        const requiresInMemoryFiltering = Boolean(search || statut || categorie || expire === 'true' || expiringSoon === 'true' || vehicleType);
        
        // Quand aucun filtre relationnel n'est applique, on pagine directement en base.
        let query = db.supabase
            .from('clients')
            .select(`
                *,
                vehicules (*),
                contrats (id, numero_contrat, date_fin, statut, categorie_vehicule)
            `, { count: 'exact' })
            .eq('entreprise_id', req.entrepriseId);

        if (!requiresInMemoryFiltering) {
            query = query.range(parsedOffset, parsedOffset + parsedLimit - 1);
        }

        const { data: clients, error, count } = await query.order('created_at', { ascending: false });
        
        if (error) {
            throw error;
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const nextWeek = new Date(today);
        nextWeek.setDate(today.getDate() + 7);

        // Enrichir les données avec les statistiques
        let enrichedClients = clients.map(client => {
            const vehicules = client.vehicules || [];
            const contratsFiltered = getClientContractsForCategory(client, categorie);
            const nombre_contrats = contratsFiltered.length;
            const latestContract = getClientLatestContract(contratsFiltered);
            const latestContractDate = latestContract?.date_fin ? new Date(latestContract.date_fin) : null;

            if (latestContractDate) {
                latestContractDate.setHours(0, 0, 0, 0);
            }

            const hasActiveAttestation = contratsFiltered.some(contrat => {
                if (!contrat.date_fin) return false;
                const endDate = new Date(contrat.date_fin);
                endDate.setHours(0, 0, 0, 0);
                return endDate >= today;
            });

            const clientStatut = hasActiveAttestation ? 'actif' : 'inactif';
            const vehiculePrincipal = vehicules[0] || {};

            return {
                ...client,
                nombre_contrats,
                dernier_contrat: latestContract ? latestContract.date_fin : null,
                client_statut: clientStatut,
                contrats: contratsFiltered,
                vehicules,
                vehicle_type: normalizeVehicleType(vehiculePrincipal)
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
        
        if (vehicleType && vehicleType !== 'all') {
            enrichedClients = enrichedClients.filter(client => client.vehicle_type === vehicleType);
        }

        if (statut) {
            const normalizedStatut = statut.toLowerCase().trim();
            enrichedClients = enrichedClients.filter(client => {
                const clientStatut = client.client_statut ? client.client_statut.toLowerCase().trim() : '';
                return clientStatut === normalizedStatut;
            });
        }

        if (expire === 'true' || expire === true) {
            enrichedClients = enrichedClients.filter(client => {
                const latestContract = getClientLatestContract(client.contrats || []);
                if (!latestContract?.date_fin) return false;
                const endDate = new Date(latestContract.date_fin);
                endDate.setHours(0, 0, 0, 0);
                return endDate < today;
            });
        }

        if (categorie && (categorie === 'TPV' || categorie === 'VP/CI')) {
            enrichedClients = enrichedClients.filter(client => {
                return client.contrats && client.contrats.length > 0;
            });
        }

        if (expiringSoon === 'true') {
            enrichedClients = enrichedClients.filter(client => {
                return client.contrats && client.contrats.some(c => {
                    if (!c.date_fin) return false;
                    const dateFin = new Date(c.date_fin);
                    dateFin.setHours(0, 0, 0, 0);
                    return dateFin >= today && dateFin <= nextWeek;
                });
            });
        }
        
        if (!requiresInMemoryFiltering) {
            return res.json({
                clients: enrichedClients,
                total: count || 0,
                offset: parsedOffset,
                limit: parsedLimit
            });
        }

        const paginatedClients = enrichedClients.slice(parsedOffset, parsedOffset + parsedLimit);

        res.json({
            clients: paginatedClients,
            total: enrichedClients.length,
            offset: parsedOffset,
            limit: parsedLimit
        });
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
                    vehicules (*)
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
                immatriculation: vehicule.immatriculation,
                puissance: vehicule.puissance ?? null,
                energie: vehicule.energie || null,
                type_vehicule: vehicule.type_vehicule || null
            })
            .select('id')
            .single();
        
        if (vehiculeError) {
            throw vehiculeError;
        }
        
        // Récupérer les montants (saisis manuellement car le prix peut varier)
        const montantPaye = contrat.montant_paye || 0;
        const montantRestant = contrat.montant_restant || 0;
        
        // Déterminer le statut du contrat en fonction de la date d'échéance
        const dateFin = new Date(contrat.date_fin);
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Réinitialiser l'heure pour comparer uniquement les dates
        dateFin.setHours(0, 0, 0, 0);
        const statut = dateFin < today ? 'expire' : 'actif';
        
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
                statut: statut,
                categorie_vehicule: contrat.categorie_vehicule || 'VP/CI'
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
                        modele: vehicule.modele || '',
                        puissance: vehicule.puissance ?? null,
                        energie: vehicule.energie || null,
                        type_vehicule: vehicule.type_vehicule || null
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
                        modele: vehicule.modele || '',
                        puissance: vehicule.puissance ?? null,
                        energie: vehicule.energie || null,
                        type_vehicule: vehicule.type_vehicule || null
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
                        statut: statut,
                        categorie_vehicule: contrat.categorie_vehicule || 'VP/CI'
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
                        statut: statut,
                        categorie_vehicule: contrat.categorie_vehicule || 'VP/CI'
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

// Portefeuille fidèle : clients avec tous leurs véhicules et contrats
const getFideleClients = async (req, res) => {
    try {
        const { search = '' } = req.query;

        const { data: clients, error } = await db.supabase
            .from('clients')
            .select(`
                *,
                vehicules (*),
                contrats (
                    *,
                    vehicules (*)
                )
            `)
            .eq('entreprise_id', req.entrepriseId)
            .order('nom', { ascending: true })
            .limit(1000);

        if (error) {
            throw error;
        }

        let enrichedClients = (clients || []).map(client => {
            const vehicules = client.vehicules || [];
            const contrats = client.contrats || [];

            const vehiculesAvecContrats = vehicules.map(vehicule => ({
                ...vehicule,
                vehicle_type: normalizeVehicleType(vehicule),
                contrats: contrats
                    .filter(contrat => contrat.vehicule_id === vehicule.id)
                    .sort((a, b) => new Date(b.date_fin) - new Date(a.date_fin))
            }));

            const contratsSansVehicule = contrats.filter(
                contrat => !vehicules.some(vehicule => vehicule.id === contrat.vehicule_id)
            );

            return {
                id: client.id,
                nom: client.nom,
                prenom: client.prenom,
                telephone: client.telephone,
                email: client.email,
                adresse: client.adresse,
                created_at: client.created_at,
                nombre_vehicules: vehicules.length,
                nombre_contrats: contrats.length,
                vehicules: vehiculesAvecContrats,
                contrats_sans_vehicule: contratsSansVehicule
            };
        });

        if (search) {
            const searchLower = search.toLowerCase().trim();
            enrichedClients = enrichedClients.filter(client => {
                const matchesNom = client.nom?.toLowerCase().includes(searchLower);
                const matchesTelephone = client.telephone?.toLowerCase().includes(searchLower);
                const matchesImmat = client.vehicules?.some(vehicule =>
                    vehicule.immatriculation?.toLowerCase().includes(searchLower)
                );
                const matchesMarque = client.vehicules?.some(vehicule =>
                    vehicule.marque?.toLowerCase().includes(searchLower) ||
                    vehicule.modele?.toLowerCase().includes(searchLower)
                );
                return matchesNom || matchesTelephone || matchesImmat || matchesMarque;
            });
        }

        enrichedClients.sort((a, b) => {
            if (b.nombre_vehicules !== a.nombre_vehicules) {
                return b.nombre_vehicules - a.nombre_vehicules;
            }
            return (a.nom || '').localeCompare(b.nom || '', 'fr');
        });

        res.json({
            clients: enrichedClients,
            total: enrichedClients.length,
            total_vehicules: enrichedClients.reduce((sum, client) => sum + client.nombre_vehicules, 0)
        });
    } catch (error) {
        console.error('Erreur lors de la récupération du portefeuille fidèle:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération du portefeuille fidèle: ' + error.message });
    }
};

module.exports = {
    getAllClients,
    getClientById,
    getFideleClients,
    createClient,
    updateClient,
    deleteClient
};
