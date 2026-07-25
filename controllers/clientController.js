// ============================================
// CONTRÔLEUR DES CLIENTS (Supabase SDK)
// ============================================

const db = require('../database/connection');
const { recordPaymentMovement, toMoney } = require('../services/paymentLedger');

const DEFAULT_TEXT = 'Non renseigné';

function cleanText(value, fallback = DEFAULT_TEXT) {
    if (value === null || value === undefined || String(value).trim() === '') {
        return fallback;
    }
    return String(value).trim();
}

function cleanNullableText(value) {
    if (value === null || value === undefined || String(value).trim() === '') {
        return null;
    }
    return String(value).trim();
}

function cleanNullableNumber(value) {
    if (value === null || value === undefined || value === '') {
        return null;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function getMissingSchemaCacheColumn(error) {
    if (!error || error.code !== 'PGRST204') {
        return null;
    }

    const message = error.message || '';
    if (!message.toLowerCase().includes('schema cache')) {
        return null;
    }

    const match = message.match(/'([^']+)'\s+column/i);
    return match ? match[1] : null;
}

async function runMutationWithSchemaFallback(payload, operation) {
    const safePayload = { ...payload };
    const removedColumns = [];

    while (true) {
        const result = await operation(safePayload);
        const missingColumn = getMissingSchemaCacheColumn(result.error);

        if (!missingColumn || !Object.prototype.hasOwnProperty.call(safePayload, missingColumn)) {
            if (removedColumns.length) {
                result.removedSchemaColumns = removedColumns;
            }
            return result;
        }

        delete safePayload[missingColumn];
        removedColumns.push(missingColumn);
        console.warn(`Colonne absente du cache Supabase ignoree: ${missingColumn}`);
    }
}

function buildClientPayload({ nom, prenom, telephone }, isCreate = false) {
    const payload = {};

    if (isCreate || nom !== undefined) payload.nom = cleanText(nom);
    if (isCreate || prenom !== undefined) payload.prenom = cleanText(prenom, '');
    if (isCreate || telephone !== undefined) payload.telephone = cleanText(telephone);

    return payload;
}

function buildVehiclePayload(vehicule = {}, clientId = null) {
    const payload = {};

    if (clientId !== null) payload.client_id = clientId;
    if (vehicule.immatriculation !== undefined) payload.immatriculation = cleanText(vehicule.immatriculation);
    payload.marque = cleanText(vehicule.marque);
    payload.modele = cleanText(vehicule.modele);
    payload.puissance = cleanNullableNumber(vehicule.puissance);
    payload.energie = cleanNullableText(vehicule.energie);
    payload.type_vehicule = cleanNullableText(vehicule.type_vehicule);

    return payload;
}

function computeContractStatus(dateFinValue) {
    const dateFin = new Date(dateFinValue);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    dateFin.setHours(0, 0, 0, 0);
    return dateFin < today ? 'expire' : 'actif';
}

function computeDurationMonths(dateDebutValue, dateFinValue, fallback = 12) {
    if (!dateDebutValue || !dateFinValue) {
        return fallback;
    }

    const dateDebut = new Date(dateDebutValue);
    const dateFin = new Date(dateFinValue);

    if (Number.isNaN(dateDebut.getTime()) || Number.isNaN(dateFin.getTime())) {
        return fallback;
    }

    const diffTime = Math.abs(dateFin - dateDebut);
    return Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 30)));
}

function buildContractPayload(contrat = {}, ids = {}, existing = {}) {
    const dateDebut = contrat.date_debut || existing.date_debut;
    const dateFin = contrat.date_fin || existing.date_fin;
    const dureeMois = contrat.duree_mois || computeDurationMonths(dateDebut, dateFin, existing.duree_mois || 12);
    const payload = {};

    if (ids.client_id !== undefined) payload.client_id = ids.client_id;
    if (ids.vehicule_id !== undefined) payload.vehicule_id = ids.vehicule_id;
    if (ids.entreprise_id !== undefined) payload.entreprise_id = ids.entreprise_id;
    if (contrat.numero_police !== undefined) payload.numero_contrat = cleanText(contrat.numero_police);
    if (contrat.type_contrat !== undefined || ids.isCreate) payload.type_contrat = cleanText(contrat.type_contrat, ids.defaultType || 'Tous risques');
    if (dateDebut) payload.date_debut = dateDebut;
    if (dateFin) payload.date_fin = dateFin;
    if (dureeMois) payload.duree_mois = dureeMois;
    if (contrat.montant !== undefined) payload.montant = Number(contrat.montant) || 0;
    if (contrat.montant_paye !== undefined || ids.isCreate) payload.montant_paye = Number(contrat.montant_paye) || 0;
    if (contrat.montant_restant !== undefined || ids.isCreate) payload.montant_restant = Number(contrat.montant_restant) || 0;
    if (dateFin) payload.statut = computeContractStatus(dateFin);
    if (contrat.categorie_vehicule !== undefined || ids.isCreate) payload.categorie_vehicule = cleanText(contrat.categorie_vehicule, 'VP/CI');

    return payload;
}

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

function getTrackedVehiclesForCategory(client, categorie) {
    return (client.vehicules || []).filter(vehicule =>
        vehicule.aas_date_echeance &&
        (!categorie || (vehicule.aas_categorie || 'VP/CI') === categorie)
    );
}

function getLatestTrackedVehicle(vehicules = []) {
    if (!vehicules.length) return null;
    return vehicules.reduce((latest, current) =>
        new Date(current.aas_date_echeance) > new Date(latest.aas_date_echeance)
            ? current
            : latest
    , vehicules[0]);
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
                contrats (*)
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
            const trackedVehicles = getTrackedVehiclesForCategory(client, categorie);
            const latestTrackedVehicle = getLatestTrackedVehicle(trackedVehicles);
            const trackedExpiryDate = latestTrackedVehicle?.aas_date_echeance || null;

            if (latestContractDate) {
                latestContractDate.setHours(0, 0, 0, 0);
            }

            const hasActiveAttestation = contratsFiltered.some(contrat => {
                if (!contrat.date_fin) return false;
                const endDate = new Date(contrat.date_fin);
                endDate.setHours(0, 0, 0, 0);
                return endDate >= today;
            });
            const hasActiveTrackedInsurance = trackedVehicles.some(vehicule => {
                const endDate = new Date(vehicule.aas_date_echeance);
                endDate.setHours(0, 0, 0, 0);
                return endDate >= today;
            });

            const clientStatut = hasActiveAttestation || hasActiveTrackedInsurance ? 'actif' : 'inactif';
            const vehiculePrincipal = vehicules[0] || {};
            const currentExpiry = trackedExpiryDate || latestContract?.date_fin || null;

            return {
                ...client,
                nombre_contrats,
                dernier_contrat: latestContract ? latestContract.date_fin : null,
                date_echeance_courante: currentExpiry,
                source_echeance: trackedExpiryDate ? 'AAS/Diotali' : (latestContract ? 'Contrat Optimum' : null),
                statut_commercial: latestTrackedVehicle?.aas_statut_commercial || null,
                derniere_verification_aas: latestTrackedVehicle?.aas_derniere_verification || null,
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
                if (!client.date_echeance_courante) return false;
                const endDate = new Date(client.date_echeance_courante);
                endDate.setHours(0, 0, 0, 0);
                return endDate < today;
            });
        }

        if (categorie && (categorie === 'TPV' || categorie === 'VP/CI')) {
            enrichedClients = enrichedClients.filter(client => {
                return (client.contrats && client.contrats.length > 0) ||
                    getTrackedVehiclesForCategory(client, categorie).length > 0;
            });
        }

        if (expiringSoon === 'true') {
            enrichedClients = enrichedClients.filter(client => {
                if (!client.date_echeance_courante) return false;
                const dateFin = new Date(client.date_echeance_courante);
                dateFin.setHours(0, 0, 0, 0);
                return dateFin >= today && dateFin <= nextWeek;
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
        console.error('Erreur lors de la récupération des clients');
        res.status(500).json({ error: 'Erreur lors de la récupération des clients' });
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
        console.error('Erreur lors de la récupération du client');
        res.status(500).json({ error: 'Erreur lors de la récupération du client' });
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
        
        // Le téléphone est une simple coordonnée et peut être partagé.
        // Il ne sert jamais à déduire qu'il s'agit du même client.
        const { data: newClient, error: clientError } = await runMutationWithSchemaFallback(
            {
                entreprise_id: req.entrepriseId,
                ...buildClientPayload({ nom, prenom: '', telephone }, true)
            },
            (payload) => db.supabase
                .from('clients')
                .insert(payload)
                .select()
                .single()
        );

        if (clientError) throw clientError;
        
        // Créer le véhicule avec seulement l'immatriculation
        const { data: newVehicule, error: vehiculeError } = await runMutationWithSchemaFallback(
            buildVehiclePayload(vehicule, newClient.id),
            (payload) => db.supabase
                .from('vehicules')
                .insert(payload)
                .select('id')
                .single()
        );
        
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
        const { data: newContrat, error: contratError } = await runMutationWithSchemaFallback(
            buildContractPayload(contrat, {
                client_id: newClient.id,
                vehicule_id: newVehicule.id,
                entreprise_id: req.entrepriseId,
                isCreate: true
            }),
            (payload) => db.supabase
                .from('contrats')
                .insert(payload)
                .select('id')
                .single()
        );
        
        if (contratError) {
            console.error('Erreur lors de la création du contrat');
            throw new Error('Erreur lors de la création du contrat');
        }
        
        if (toMoney(contrat.montant_paye) > 0) {
            await recordPaymentMovement({
                entrepriseId: req.entrepriseId,
                contratId: newContrat.id,
                clientId: newClient.id,
                montant: contrat.montant_paye,
                source: 'creation_client',
                note: 'Paiement initial'
            });
        }

        res.status(201).json({
            message: 'Client créé avec succès',
            client: newClient,
            vehiculeId: newVehicule.id,
            contratId: newContrat.id
        });
    } catch (error) {
        console.error('Erreur lors de la création du client');
        res.status(500).json({ error: 'Erreur lors de la création du client' });
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
        const clientPayload = buildClientPayload({ nom, prenom, telephone });
        if (nom !== undefined || telephone !== undefined) {
            clientPayload.coordonnees_source = 'manuel';
            clientPayload.coordonnees_verifiees = true;
        }
        const { data: updated, error: clientError } = await runMutationWithSchemaFallback(
            clientPayload,
            (payload) => db.supabase
                .from('clients')
                .update(payload)
                .eq('id', id)
                .select()
                .single()
        );
        
        if (clientError) {
            throw clientError;
        }
        
        let targetVehicleId = null;

        // Mettre à jour le véhicule si fourni
        if (vehicule && vehicule.immatriculation) {
            let vehicleQuery = db.supabase
                .from('vehicules')
                .select('id')
                .eq('client_id', id);

            vehicleQuery = vehicule.id
                ? vehicleQuery.eq('id', vehicule.id)
                : vehicleQuery.limit(1);

            const { data: existingVehicules, error: vehicleLookupError } = await vehicleQuery;
            if (vehicleLookupError) throw vehicleLookupError;
            
            if (vehicule.id && (!existingVehicules || existingVehicules.length === 0)) {
                return res.status(404).json({ error: 'Véhicule non trouvé pour ce client' });
            }

            if (!vehicule.is_new && existingVehicules && existingVehicules.length > 0) {
                targetVehicleId = existingVehicules[0].id;
                // Mettre à jour le véhicule existant
                const { error: vehiculeError } = await runMutationWithSchemaFallback(
                    buildVehiclePayload(vehicule),
                    (payload) => db.supabase
                        .from('vehicules')
                        .update(payload)
                        .eq('id', existingVehicules[0].id)
                );
                
                if (vehiculeError) {
                    throw vehiculeError;
                }
            } else if (vehicule.is_new || !existingVehicules || existingVehicules.length === 0) {
                // Sans identifiant explicite, le formulaire demande l'ajout d'un véhicule.
                const { data: createdVehicle, error: vehiculeError } = await runMutationWithSchemaFallback(
                    buildVehiclePayload(vehicule, id),
                    (payload) => db.supabase
                        .from('vehicules')
                        .insert(payload)
                        .select('id')
                        .single()
                );
                
                if (vehiculeError) {
                    throw vehiculeError;
                }
                targetVehicleId = createdVehicle.id;
            }
        }
        
        // Mettre à jour le contrat si fourni
        if (contrat && contrat.numero_police) {
            // Récupérer le dernier contrat du client (le plus récent)
            const { data: existingContrats } = await db.supabase
                .from('contrats')
                .select('id, montant_paye')
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
                const contractPayload = buildContractPayload(
                    contrat,
                    targetVehicleId ? { vehicule_id: targetVehicleId } : {}
                );
                const ancienMontantPaye = toMoney(existingContrats[0].montant_paye);
                const nouveauMontantPaye = Object.prototype.hasOwnProperty.call(contractPayload, 'montant_paye')
                    ? toMoney(contractPayload.montant_paye)
                    : ancienMontantPaye;
                const mouvement = toMoney(nouveauMontantPaye - ancienMontantPaye);

                const { error: contratError } = await runMutationWithSchemaFallback(
                    contractPayload,
                    (payload) => db.supabase
                        .from('contrats')
                        .update(payload)
                        .eq('id', existingContrats[0].id)
                );
                
                if (contratError) {
                    throw contratError;
                }

                if (mouvement !== 0) {
                    await recordPaymentMovement({
                        entrepriseId: req.entrepriseId,
                        contratId: existingContrats[0].id,
                        clientId: id,
                        montant: mouvement,
                        type: mouvement > 0 ? 'encaissement' : 'correction',
                        source: 'edition_client',
                        note: mouvement > 0 ? 'Paiement complementaire' : 'Correction de paiement'
                    });
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
                
                const { data: newContrat, error: contratError } = await runMutationWithSchemaFallback(
                    buildContractPayload(contrat, {
                        client_id: id,
                        vehicule_id: clientVehicules[0].id,
                        entreprise_id: req.entrepriseId,
                        isCreate: true,
                        defaultType: 'AC'
                    }),
                    (payload) => db.supabase
                        .from('contrats')
                        .insert(payload)
                        .select('id')
                        .single()
                );
                
                if (contratError) {
                    throw contratError;
                }

                if (newContrat && toMoney(contrat.montant_paye) > 0) {
                    await recordPaymentMovement({
                        entrepriseId: req.entrepriseId,
                        contratId: newContrat.id,
                        clientId: id,
                        montant: contrat.montant_paye,
                        source: 'creation_contrat_client',
                        note: 'Paiement initial'
                    });
                }
            }
        }
        
        res.json({
            message: 'Client mis à jour avec succès',
            client: updated
        });
    } catch (error) {
        console.error('Erreur lors de la mise à jour du client');
        res.status(500).json({ error: 'Erreur lors de la mise à jour du client' });
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
        console.error('Erreur lors de la suppression du client');
        res.status(500).json({ error: 'Erreur lors de la suppression du client' });
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
        console.error('Erreur lors de la récupération du portefeuille fidèle');
        res.status(500).json({ error: 'Erreur lors de la récupération du portefeuille fidèle' });
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
