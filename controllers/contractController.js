// ============================================
// CONTRÔLEUR DES CONTRATS (Supabase SDK)
// ============================================

const db = require('../database/connection');
const moment = require('moment');

// Obtenir tous les contrats de l'entreprise
const getAllContracts = async (req, res) => {
    try {
        const { statut, search } = req.query;
        
        // Construire la requête Supabase avec jointures
        let query = db.supabase
            .from('contrats')
            .select(`
                *,
                clients!contrats_client_id_fkey (
                    nom,
                    prenom,
                    telephone
                ),
                vehicules!contrats_vehicule_id_fkey (
                    marque,
                    modele,
                    immatriculation
                )
            `)
            .eq('entreprise_id', req.entrepriseId);
        
        // Filtrer par statut si fourni
        if (statut) {
            query = query.eq('statut', statut);
        }
        
        // Ajouter la recherche si fournie
        if (search) {
            // Recherche dans les relations nécessite une approche différente
            // On filtre après avoir récupéré les données ou on utilise une vue SQL
            query = query.or(`numero_contrat.ilike.%${search}%`);
        }
        
        const { data: contrats, error } = await query.order('date_fin', { ascending: true });
        
        if (error) {
            throw error;
        }
        
        // Filtrer par recherche dans les relations si nécessaire
        let filteredContrats = contrats || [];
        if (search && contrats) {
            const searchLower = search.toLowerCase();
            filteredContrats = contrats.filter(contrat => {
                const client = contrat.clients;
                const vehicule = contrat.vehicules;
                return (
                    contrat.numero_contrat?.toLowerCase().includes(searchLower) ||
                    client?.nom?.toLowerCase().includes(searchLower) ||
                    client?.prenom?.toLowerCase().includes(searchLower) ||
                    vehicule?.immatriculation?.toLowerCase().includes(searchLower)
                );
            });
        }
        
        // Ajouter des informations calculées et formater les données
        const enrichedContrats = filteredContrats.map(contrat => {
            const joursRestants = moment(contrat.date_fin).diff(moment(), 'days');
            const client = contrat.clients || {};
            const vehicule = contrat.vehicules || {};
            
            return {
                ...contrat,
                client_nom: client.nom,
                client_prenom: client.prenom,
                client_telephone: client.telephone,
                marque: vehicule.marque,
                modele: vehicule.modele,
                immatriculation: vehicule.immatriculation,
                jours_restants: joursRestants,
                est_expire: joursRestants < 0,
                alerte_renouvellement: joursRestants >= 0 && joursRestants <= 7
            };
        });
        
        res.json({ contrats: enrichedContrats });
    } catch (error) {
        console.error('Erreur lors de la récupération des contrats:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération des contrats: ' + error.message });
    }
};

// Obtenir un contrat par ID
const getContractById = async (req, res) => {
    try {
        const { id } = req.params;
        
        const { data: contrat, error } = await db.supabase
            .from('contrats')
            .select(`
                *,
                clients!contrats_client_id_fkey (
                    nom,
                    prenom,
                    telephone,
                    email
                ),
                vehicules!contrats_vehicule_id_fkey (
                    marque,
                    modele,
                    immatriculation,
                    annee,
                    couleur
                )
            `)
            .eq('id', id)
            .eq('entreprise_id', req.entrepriseId)
            .single();
        
        if (error || !contrat) {
            return res.status(404).json({ error: 'Contrat non trouvé' });
        }
        
        // Ajouter des informations calculées
        const joursRestants = moment(contrat.date_fin).diff(moment(), 'days');
        const client = contrat.clients || {};
        const vehicule = contrat.vehicules || {};
        
        const enrichedContrat = {
            ...contrat,
            client_nom: client.nom,
            client_prenom: client.prenom,
            client_telephone: client.telephone,
            client_email: client.email,
            marque: vehicule.marque,
            modele: vehicule.modele,
            immatriculation: vehicule.immatriculation,
            annee: vehicule.annee,
            couleur: vehicule.couleur,
            jours_restants: joursRestants,
            est_expire: joursRestants < 0,
            alerte_renouvellement: joursRestants >= 0 && joursRestants <= 7
        };
        
        res.json({ contrat: enrichedContrat });
    } catch (error) {
        console.error('Erreur lors de la récupération du contrat:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération du contrat: ' + error.message });
    }
};

// Créer un nouveau contrat
const createContract = async (req, res) => {
    try {
        const { client_id, vehicule_id, type_contrat, duree_mois, date_debut, montant } = req.body;
        
        // Validation
        if (!client_id || !vehicule_id || !type_contrat || !duree_mois || !date_debut || !montant) {
            return res.status(400).json({ 
                error: 'Tous les champs sont requis: client_id, vehicule_id, type_contrat, duree_mois, date_debut, montant' 
            });
        }
        
        // Vérifier que le client appartient à l'entreprise
        const { data: client } = await db.supabase
            .from('clients')
            .select('id')
            .eq('id', client_id)
            .eq('entreprise_id', req.entrepriseId)
            .single();
        
        if (!client) {
            return res.status(404).json({ error: 'Client non trouvé' });
        }
        
        // Vérifier que le véhicule appartient au client
        const { data: vehicule } = await db.supabase
            .from('vehicules')
            .select('id')
            .eq('id', vehicule_id)
            .eq('client_id', client_id)
            .single();
        
        if (!vehicule) {
            return res.status(404).json({ error: 'Véhicule non trouvé pour ce client' });
        }
        
        // Calculer la date de fin
        const dateDebut = moment(date_debut);
        const dateFin = dateDebut.clone().add(duree_mois, 'months');
        
        // Utiliser le numéro de police fourni ou générer un numéro de contrat unique
        const numeroPolice = req.body.numero_police || `CONT-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
        
        // Créer le contrat avec Supabase
        const { data: newContrat, error: insertError } = await db.supabase
            .from('contrats')
            .insert({
                client_id,
                vehicule_id,
                entreprise_id: req.entrepriseId,
                numero_contrat: numeroPolice, // Utiliser numero_police comme numero_contrat
                type_contrat,
                duree_mois,
                date_debut: dateDebut.format('YYYY-MM-DD'),
                date_fin: dateFin.format('YYYY-MM-DD'),
                montant,
                statut: 'actif'
            })
            .select(`
                *,
                clients!contrats_client_id_fkey (
                    nom,
                    prenom
                ),
                vehicules!contrats_vehicule_id_fkey (
                    marque,
                    modele
                )
            `)
            .single();
        
        if (insertError) {
            throw insertError;
        }
        
        const clientData = newContrat.clients || {};
        const vehiculeData = newContrat.vehicules || {};
        
        res.status(201).json({
            message: 'Contrat créé avec succès',
            contrat: {
                ...newContrat,
                client_nom: clientData.nom,
                client_prenom: clientData.prenom,
                marque: vehiculeData.marque,
                modele: vehiculeData.modele
            }
        });
    } catch (error) {
        console.error('Erreur lors de la création du contrat:', error);
        res.status(500).json({ error: 'Erreur lors de la création du contrat: ' + error.message });
    }
};

// Renouveler un contrat
const renewContract = async (req, res) => {
    try {
        const { id } = req.params;
        const { duree_mois, montant } = req.body;
        
        // Récupérer le contrat actuel
        const { data: ancienContrat, error: findError } = await db.supabase
            .from('contrats')
            .select('*')
            .eq('id', id)
            .eq('entreprise_id', req.entrepriseId)
            .single();
        
        if (findError || !ancienContrat) {
            return res.status(404).json({ error: 'Contrat non trouvé' });
        }
        
        // Utiliser une transaction via RPC ou deux opérations séquentielles
        // Marquer l'ancien contrat comme renouvelé
        const { error: updateError } = await db.supabase
            .from('contrats')
            .update({ statut: 'renouvele' })
            .eq('id', id);
        
        if (updateError) {
            throw updateError;
        }
        
        // Calculer les nouvelles dates
        const dateDebut = moment(ancienContrat.date_fin).add(1, 'day');
        const dateFin = dateDebut.clone().add(duree_mois || ancienContrat.duree_mois, 'months');
        
        // Créer le nouveau contrat
        const numeroContrat = `CONT-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
        
        const { data: newContrat, error: insertError } = await db.supabase
            .from('contrats')
            .insert({
                client_id: ancienContrat.client_id,
                vehicule_id: ancienContrat.vehicule_id,
                entreprise_id: req.entrepriseId,
                numero_contrat: numeroContrat,
                type_contrat: ancienContrat.type_contrat,
                duree_mois: duree_mois || ancienContrat.duree_mois,
                date_debut: dateDebut.format('YYYY-MM-DD'),
                date_fin: dateFin.format('YYYY-MM-DD'),
                montant: montant || ancienContrat.montant,
                statut: 'actif'
            })
            .select(`
                *,
                clients!contrats_client_id_fkey (
                    nom,
                    prenom
                ),
                vehicules!contrats_vehicule_id_fkey (
                    marque,
                    modele
                )
            `)
            .single();
        
        if (insertError) {
            throw insertError;
        }
        
        const clientData = newContrat.clients || {};
        const vehiculeData = newContrat.vehicules || {};
        
        res.json({
            message: 'Contrat renouvelé avec succès',
            contrat: {
                ...newContrat,
                client_nom: clientData.nom,
                client_prenom: clientData.prenom,
                marque: vehiculeData.marque,
                modele: vehiculeData.modele
            }
        });
    } catch (error) {
        console.error('Erreur lors du renouvellement du contrat:', error);
        res.status(500).json({ error: 'Erreur lors du renouvellement du contrat: ' + error.message });
    }
};

// Mettre à jour un contrat
const updateContract = async (req, res) => {
    try {
        const { id } = req.params;
        const { type_contrat, duree_mois, date_debut, montant, statut } = req.body;
        
        // Vérifier que le contrat appartient à l'entreprise
        const { data: existing } = await db.supabase
            .from('contrats')
            .select('*')
            .eq('id', id)
            .eq('entreprise_id', req.entrepriseId)
            .single();
        
        if (!existing) {
            return res.status(404).json({ error: 'Contrat non trouvé' });
        }
        
        // Recalculer la date de fin si nécessaire
        let dateFin = existing.date_fin;
        if (date_debut && duree_mois) {
            dateFin = moment(date_debut).add(duree_mois, 'months').format('YYYY-MM-DD');
        } else if (date_debut && !duree_mois) {
            dateFin = moment(date_debut).add(existing.duree_mois, 'months').format('YYYY-MM-DD');
        } else if (!date_debut && duree_mois) {
            dateFin = moment(existing.date_debut).add(duree_mois, 'months').format('YYYY-MM-DD');
        }
        
        // Préparer les données de mise à jour
        const updateData = {};
        if (type_contrat) updateData.type_contrat = type_contrat;
        if (duree_mois) updateData.duree_mois = duree_mois;
        if (date_debut) updateData.date_debut = date_debut;
        if (montant) updateData.montant = montant;
        if (statut) updateData.statut = statut;
        updateData.date_fin = dateFin;
        
        // Mettre à jour avec Supabase
        const { data: updated, error } = await db.supabase
            .from('contrats')
            .update(updateData)
            .eq('id', id)
            .select(`
                *,
                clients!contrats_client_id_fkey (
                    nom,
                    prenom
                ),
                vehicules!contrats_vehicule_id_fkey (
                    marque,
                    modele
                )
            `)
            .single();
        
        if (error) {
            throw error;
        }
        
        const clientData = updated.clients || {};
        const vehiculeData = updated.vehicules || {};
        
        res.json({
            message: 'Contrat mis à jour avec succès',
            contrat: {
                ...updated,
                client_nom: clientData.nom,
                client_prenom: clientData.prenom,
                marque: vehiculeData.marque,
                modele: vehiculeData.modele
            }
        });
    } catch (error) {
        console.error('Erreur lors de la mise à jour du contrat:', error);
        res.status(500).json({ error: 'Erreur lors de la mise à jour du contrat: ' + error.message });
    }
};

// Mettre à jour le paiement restant
const updatePayment = async (req, res) => {
    try {
        const { id } = req.params;
        const { montant_paye } = req.body;
        
        // Vérifier que le contrat appartient à l'entreprise
        const { data: existing, error: findError } = await db.supabase
            .from('contrats')
            .select('montant, montant_paye')
            .eq('id', id)
            .eq('entreprise_id', req.entrepriseId)
            .single();
        
        if (findError || !existing) {
            return res.status(404).json({ error: 'Contrat non trouvé' });
        }
        
        // Récupérer les montants (saisis manuellement car le prix peut varier)
        const nouveauMontantPaye = parseFloat(montant_paye) || 0;
        const nouveauMontantRestant = parseFloat(req.body.montant_restant) || 0;
        
        // Validation
        if (nouveauMontantPaye < 0) {
            return res.status(400).json({ error: 'Le montant payé ne peut pas être négatif' });
        }
        
        if (nouveauMontantRestant < 0) {
            return res.status(400).json({ error: 'Le montant restant ne peut pas être négatif' });
        }
        
        // Mettre à jour avec Supabase
        const { data: updated, error } = await db.supabase
            .from('contrats')
            .update({
                montant_paye: nouveauMontantPaye,
                montant_restant: nouveauMontantRestant
            })
            .eq('id', id)
            .select('*')
            .single();
        
        if (error) {
            throw error;
        }
        
        res.json({
            message: 'Paiement mis à jour avec succès',
            contrat: updated
        });
    } catch (error) {
        console.error('Erreur lors de la mise à jour du paiement:', error);
        res.status(500).json({ error: 'Erreur lors de la mise à jour du paiement: ' + error.message });
    }
};

// Supprimer un contrat
const deleteContract = async (req, res) => {
    try {
        const { id } = req.params;
        
        // Vérifier que le contrat appartient à l'entreprise
        const { data: existing } = await db.supabase
            .from('contrats')
            .select('id')
            .eq('id', id)
            .eq('entreprise_id', req.entrepriseId)
            .single();
        
        if (!existing) {
            return res.status(404).json({ error: 'Contrat non trouvé' });
        }
        
        // Supprimer avec Supabase
        const { error } = await db.supabase
            .from('contrats')
            .delete()
            .eq('id', id);
        
        if (error) {
            throw error;
        }
        
        res.json({ message: 'Contrat supprimé avec succès' });
    } catch (error) {
        console.error('Erreur lors de la suppression du contrat:', error);
        res.status(500).json({ error: 'Erreur lors de la suppression du contrat: ' + error.message });
    }
};

module.exports = {
    getAllContracts,
    getContractById,
    createContract,
    renewContract,
    updateContract,
    updatePayment,
    deleteContract
};
