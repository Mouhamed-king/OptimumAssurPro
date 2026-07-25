const db = require('../database/connection');

const VALID_STATUSES = new Set(['chez_nous', 'renouvele_ailleurs', 'expire', 'a_verifier']);

function clean(value) {
    const text = value === null || value === undefined ? '' : String(value).trim();
    return text || null;
}

function normalizeMatricule(value) {
    return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function cleanDate(value) {
    const text = clean(value)?.slice(0, 10);
    return text && /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

function statusFromInput(value, expiryDate) {
    if (VALID_STATUSES.has(value)) return value;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return expiryDate && new Date(`${expiryDate}T00:00:00`) < today ? 'expire' : 'a_verifier';
}

async function findVehicle(entrepriseId, matricule) {
    const { data, error } = await db.supabase
        .from('vehicules')
        .select('*, clients!inner(*)')
        .eq('clients.entreprise_id', entrepriseId);
    if (error) throw error;
    return (data || []).find(vehicle =>
        normalizeMatricule(vehicle.immatriculation) === matricule
    ) || null;
}

const upsertAasTracking = async (req, res) => {
    try {
        const matricule = normalizeMatricule(req.body.matricule);
        const expiryDate = cleanDate(req.body.expiryDate);
        if (!matricule || !expiryDate) {
            return res.status(400).json({ error: 'matricule et expiryDate (YYYY-MM-DD) sont requis' });
        }

        const customerName = clean(req.body.customerName) || 'Client AAS à vérifier';
        const customerPhone = clean(req.body.customerPhone) || 'TEMP-AAS';
        const tracking = {
            aas_date_effet: cleanDate(req.body.effectiveDate),
            aas_date_echeance: expiryDate,
            aas_derniere_verification: new Date().toISOString(),
            aas_compagnie: clean(req.body.company),
            aas_numero_attestation: clean(req.body.attestationNumber),
            aas_source: 'AAS/Diotali',
            aas_statut_commercial: statusFromInput(req.body.commercialStatus, expiryDate),
            aas_categorie: req.body.category === 'TPV' ? 'TPV' : 'VP/CI'
        };

        let vehicle = await findVehicle(req.entrepriseId, matricule);
        let clientId;
        let action;

        if (vehicle) {
            clientId = vehicle.client_id;
            const client = vehicle.clients || {};
            const mayRefreshIdentity =
                client.coordonnees_verifiees === false ||
                client.coordonnees_source === 'AAS/Diotali' ||
                !clean(client.telephone) ||
                String(client.telephone).startsWith('TEMP-');
            if (mayRefreshIdentity) {
                const { error } = await db.supabase
                    .from('clients')
                    .update({
                        nom: customerName,
                        telephone: customerPhone,
                        coordonnees_source: 'AAS/Diotali',
                        coordonnees_verifiees: false
                    })
                    .eq('id', clientId)
                    .eq('entreprise_id', req.entrepriseId);
                if (error) throw error;
            }
            const { error } = await db.supabase.from('vehicules').update(tracking).eq('id', vehicle.id);
            if (error) throw error;
            action = 'updated';
        } else {
            const { data: client, error: clientError } = await db.supabase
                .from('clients')
                .insert({
                    entreprise_id: req.entrepriseId,
                    nom: customerName,
                    prenom: '',
                    telephone: customerPhone,
                    coordonnees_source: 'AAS/Diotali',
                    coordonnees_verifiees: false
                })
                .select('id')
                .single();
            if (clientError) throw clientError;
            clientId = client.id;

            const { data: createdVehicle, error: vehicleError } = await db.supabase
                .from('vehicules')
                .insert({
                    client_id: clientId,
                    immatriculation: matricule,
                    marque: clean(req.body.brand) || 'Non renseigné',
                    modele: clean(req.body.model) || 'Non renseigné',
                    ...tracking
                })
                .select('id')
                .single();
            if (vehicleError) {
                await db.supabase.from('clients').delete().eq('id', clientId);
                throw vehicleError;
            }
            vehicle = createdVehicle;
            action = 'created';
        }

        return res.status(action === 'created' ? 201 : 200).json({
            message: action === 'created'
                ? 'Suivi AAS créé sans contrat commercial'
                : 'Suivi AAS mis à jour sans modifier les contrats commerciaux',
            action,
            clientId,
            vehicleId: vehicle.id,
            matricule,
            expiryDate,
            commercialStatus: tracking.aas_statut_commercial
        });
    } catch (error) {
        console.error('Erreur lors de la mise à jour du suivi AAS');
        return res.status(500).json({ error: 'Erreur lors de la mise à jour du suivi AAS' });
    }
};

const listTrackedExpiries = async (req, res) => {
    try {
        const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
        const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 100, 1), 1000);
        const category = ['TPV', 'VP/CI'].includes(req.query.category) ? req.query.category : null;
        const { data: clients, error } = await db.supabase
            .from('clients')
            .select('id, nom, prenom, telephone, coordonnees_source, coordonnees_verifiees, vehicules(*)')
            .eq('entreprise_id', req.entrepriseId);
        if (error) throw error;

        let records = (clients || []).flatMap(client =>
            (client.vehicules || []).filter(vehicle => vehicle.aas_date_echeance).map(vehicle => ({
                client_id: client.id,
                vehicule_id: vehicle.id,
                matricule: vehicle.immatriculation,
                expiryDate: vehicle.aas_date_echeance,
                effectiveDate: vehicle.aas_date_effet,
                customerName: [client.prenom, client.nom].filter(Boolean).join(' ').trim(),
                customerPhone: client.telephone,
                company: vehicle.aas_compagnie,
                attestationNumber: vehicle.aas_numero_attestation,
                category: vehicle.aas_categorie || 'VP/CI',
                commercialStatus: vehicle.aas_statut_commercial || 'a_verifier',
                verifiedAt: vehicle.aas_derniere_verification,
                source: 'aas_tracking',
                coordinatesVerified: client.coordonnees_verifiees
            }))
        );
        if (category) records = records.filter(record => record.category === category);
        records.sort((a, b) =>
            String(a.expiryDate).localeCompare(String(b.expiryDate)) ||
            String(a.matricule).localeCompare(String(b.matricule))
        );
        return res.json({ records: records.slice(offset, offset + limit), total: records.length, offset, limit });
    } catch (error) {
        console.error('Erreur lors de la récupération des échéances suivies');
        return res.status(500).json({ error: 'Erreur lors de la récupération des échéances suivies' });
    }
};

module.exports = { upsertAasTracking, listTrackedExpiries };
