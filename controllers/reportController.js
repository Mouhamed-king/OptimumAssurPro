// ============================================
// CONTROLEUR DES RAPPORTS DE CAISSE
// ============================================

const db = require('../database/connection');
const moment = require('moment');
const { isMissingPaymentsTable, toMoney } = require('../services/paymentLedger');

const PAGE_SIZE = 1000;

function buildDateFilter(filter, dateDebut, dateFin) {
    const today = moment();

    if (dateDebut || dateFin) {
        return {
            gte: moment(dateDebut || today.clone().startOf('day')).startOf('day').toISOString(),
            lte: moment(dateFin || today.clone().endOf('day')).endOf('day').toISOString()
        };
    }

    if (filter === 'today') {
        return {
            gte: today.clone().startOf('day').toISOString(),
            lte: today.clone().endOf('day').toISOString()
        };
    }

    if (filter === 'two_days') {
        return {
            gte: today.clone().subtract(1, 'day').startOf('day').toISOString(),
            lte: today.clone().endOf('day').toISOString()
        };
    }

    if (filter === 'month') {
        return {
            gte: today.clone().startOf('month').toISOString(),
            lte: today.clone().endOf('month').toISOString()
        };
    }

    if (filter === 'quarter') {
        return {
            gte: today.clone().startOf('quarter').toISOString(),
            lte: today.clone().endOf('quarter').toISOString()
        };
    }

    if (filter === 'year') {
        return {
            gte: today.clone().startOf('year').toISOString(),
            lte: today.clone().endOf('year').toISOString()
        };
    }

    return {};
}

function calculateContractValues(primeNette) {
    const premium = toMoney(primeNette);
    const frais = 3000;
    const fga = toMoney(premium * 0.025);
    const taxes = toMoney((premium + frais) * 0.14);
    const primeTTC = toMoney(premium + frais + taxes + fga);
    const commission = toMoney(premium * 0.25);
    const netAVerser = toMoney(primeTTC - frais - commission);

    return {
        frais,
        taxes,
        fga,
        primeTTC,
        commission,
        netAVerser
    };
}

function getProratedAmount(total, movementAmount, premium) {
    const cleanPremium = toMoney(premium);
    const cleanMovement = toMoney(movementAmount);

    if (!cleanPremium) {
        return cleanMovement < 0 ? -toMoney(total) : toMoney(total);
    }

    const sign = cleanMovement < 0 ? -1 : 1;
    const ratio = Math.min(Math.abs(cleanMovement) / cleanPremium, 1);
    return toMoney(total * ratio * sign);
}

function getClientName(contract) {
    const client = contract?.clients || {};
    return `${client.nom || ''} ${client.prenom || ''}`.trim() || 'Client';
}

function getVehicleLabel(contract) {
    const vehicle = contract?.vehicules || {};
    return [vehicle.immatriculation, vehicle.marque, vehicle.modele]
        .filter(Boolean)
        .join(' - ');
}

function getSourceLabel(source, type) {
    if (type === 'correction') return 'Correction';
    const labels = {
        creation_client: 'Paiement initial',
        creation_contrat: 'Paiement initial',
        creation_contrat_client: 'Paiement initial',
        edition_client: 'Paiement complementaire',
        mise_a_jour_paiement: 'Paiement complementaire',
        fallback_contrat: 'Paiement enregistre'
    };
    return labels[source] || 'Encaissement';
}

async function fetchAllRows(buildQuery) {
    const rows = [];
    let offset = 0;

    while (true) {
        const { data, error } = await buildQuery()
            .range(offset, offset + PAGE_SIZE - 1);

        if (error) {
            return { rows, error };
        }

        const batch = data || [];
        rows.push(...batch);

        if (batch.length < PAGE_SIZE) {
            return { rows };
        }

        offset += PAGE_SIZE;
    }
}

async function fetchContractsMap(contractIds, entrepriseId) {
    const uniqueIds = [...new Set(contractIds.filter(Boolean))];
    const contractsMap = new Map();

    if (!uniqueIds.length) {
        return contractsMap;
    }

    const { data, error } = await db.supabase
        .from('contrats')
        .select(`
            id,
            client_id,
            vehicule_id,
            numero_contrat,
            montant,
            montant_paye,
            montant_restant,
            date_debut,
            date_fin,
            statut,
            type_contrat,
            categorie_vehicule,
            created_at,
            updated_at,
            clients (nom, prenom),
            vehicules (immatriculation, marque, modele)
        `)
        .eq('entreprise_id', entrepriseId)
        .in('id', uniqueIds);

    if (error) throw error;

    (data || []).forEach(contract => {
        contractsMap.set(contract.id, contract);
    });

    return contractsMap;
}

function buildPaymentEntry(payment, contract) {
    const amount = toMoney(payment.montant);
    const premium = toMoney(contract?.montant);
    const values = calculateContractValues(premium);
    const date = payment.date_paiement || payment.created_at || contract?.updated_at || contract?.created_at;

    return {
        id: payment.id,
        contrat_id: payment.contrat_id,
        client_id: payment.client_id || contract?.client_id,
        date_paiement: date,
        jour: moment(date).isValid() ? moment(date).format('YYYY-MM-DD') : '',
        client_nom: getClientName(contract),
        numero_contrat: contract?.numero_contrat || '-',
        vehicule: getVehicleLabel(contract),
        categorie_vehicule: contract?.categorie_vehicule || 'Non specifiee',
        type_contrat: contract?.type_contrat || 'Autre',
        montant: amount,
        montant_paye: amount,
        montant_contrat: premium,
        montant_restant: toMoney(contract?.montant_restant),
        commission: getProratedAmount(values.commission, amount, premium),
        net_a_verser: getProratedAmount(values.netAVerser, amount, premium),
        prime_ttc: getProratedAmount(values.primeTTC, amount, premium),
        source: payment.source || 'manuel',
        type_mouvement: payment.type || 'encaissement',
        libelle: getSourceLabel(payment.source, payment.type)
    };
}

function buildFallbackEntry(contract) {
    return buildPaymentEntry({
        id: `contrat-${contract.id}`,
        contrat_id: contract.id,
        client_id: contract.client_id,
        montant: toMoney(contract.montant_paye),
        date_paiement: contract.updated_at || contract.created_at || contract.date_debut,
        source: 'fallback_contrat',
        type: 'encaissement'
    }, contract);
}

function summarizeEntries(entries) {
    const uniqueContracts = new Map();
    const uniqueClients = new Set();
    const dailyMap = new Map();
    const sourceMap = new Map();
    const categoryMap = new Map();

    entries.forEach(entry => {
        if (entry.contrat_id && !uniqueContracts.has(entry.contrat_id)) {
            uniqueContracts.set(entry.contrat_id, entry);
        }
        if (entry.client_id) uniqueClients.add(entry.client_id);

        const dayKey = entry.jour || 'Sans date';
        const existingDay = dailyMap.get(dayKey) || {
            date: dayKey,
            day: dayKey === 'Sans date' ? dayKey : moment(dayKey).format('DD/MM/YYYY'),
            amount: 0,
            profit: 0,
            count: 0
        };
        existingDay.amount = toMoney(existingDay.amount + entry.montant);
        existingDay.profit = toMoney(existingDay.profit + entry.commission);
        existingDay.count += 1;
        dailyMap.set(dayKey, existingDay);

        const source = entry.libelle || 'Encaissement';
        sourceMap.set(source, (sourceMap.get(source) || 0) + 1);

        const category = entry.categorie_vehicule || 'Non specifiee';
        categoryMap.set(category, (categoryMap.get(category) || 0) + Math.max(entry.montant, 0));
    });

    const uniqueContractEntries = [...uniqueContracts.values()];
    const totalPremium = uniqueContractEntries.reduce((sum, entry) => sum + entry.montant_contrat, 0);
    const totalRemaining = uniqueContractEntries.reduce((sum, entry) => sum + entry.montant_restant, 0);
    const totalPaid = entries.reduce((sum, entry) => sum + entry.montant, 0);
    const totalProfit = entries.reduce((sum, entry) => sum + entry.commission, 0);
    const totalNetAVerser = entries.reduce((sum, entry) => sum + entry.net_a_verser, 0);
    const totalPrimeTTC = entries.reduce((sum, entry) => sum + entry.prime_ttc, 0);

    const contractsEvolution = [...dailyMap.values()]
        .sort((a, b) => String(a.date).localeCompare(String(b.date)));

    return {
        totalRevenue: toMoney(totalPremium),
        totalPremium: toMoney(totalPremium),
        totalPaid: toMoney(totalPaid),
        totalRemaining: toMoney(totalRemaining),
        totalProfit: toMoney(totalProfit),
        totalNetAVerser: toMoney(totalNetAVerser),
        totalPrimeTTC: toMoney(totalPrimeTTC),
        totalContracts: uniqueContracts.size,
        totalClients: uniqueClients.size,
        renewalRate: 0,
        contractsEvolution,
        cashFlowByDay: contractsEvolution,
        profitEvolution: contractsEvolution.map(item => ({
            month: item.day,
            amount: item.profit
        })),
        contractTypeDistribution: [...sourceMap.entries()].map(([type, count]) => ({ type, count })),
        categoryDistribution: [...categoryMap.entries()].map(([type, amount]) => ({ type, amount }))
    };
}

function formatDetailedEntry(entry) {
    return {
        id: entry.id,
        date_paiement: entry.date_paiement,
        jour: entry.jour,
        client_nom: entry.client_nom,
        client_prenom: '',
        numero_contrat: entry.numero_contrat,
        vehicule_immatriculation: entry.vehicule,
        vehicule_marque: '',
        vehicule_modele: '',
        categorie_vehicule: entry.categorie_vehicule,
        type_contrat: entry.type_contrat,
        montant: entry.montant_contrat,
        montant_paye: entry.montant,
        montant_restant: entry.montant_restant,
        commission: entry.commission,
        net_a_verser: entry.net_a_verser,
        prime_ttc: entry.prime_ttc,
        libelle: entry.libelle,
        type_mouvement: entry.type_mouvement,
        statut: entry.type_mouvement === 'correction' ? 'correction' : 'encaisse'
    };
}

async function getEntriesFromPaymentLedger(entrepriseId, dateFilter, categorie) {
    const buildQuery = () => {
        let query = db.supabase
            .from('paiements')
            .select('id, entreprise_id, contrat_id, client_id, montant, type, source, mode_paiement, note, date_paiement, created_at')
            .eq('entreprise_id', entrepriseId)
            .order('date_paiement', { ascending: false });

        if (dateFilter.gte) query = query.gte('date_paiement', dateFilter.gte);
        if (dateFilter.lte) query = query.lte('date_paiement', dateFilter.lte);

        return query;
    };

    const { rows, error } = await fetchAllRows(buildQuery);
    if (error) throw error;

    const contractsMap = await fetchContractsMap(rows.map(row => row.contrat_id), entrepriseId);
    return rows
        .map(row => buildPaymentEntry(row, contractsMap.get(row.contrat_id)))
        .filter(entry => !categorie || entry.categorie_vehicule === categorie);
}

async function getEntriesFromContractsFallback(entrepriseId, dateFilter, categorie) {
    const buildQuery = () => {
        let query = db.supabase
            .from('contrats')
            .select(`
                id,
                client_id,
                vehicule_id,
                numero_contrat,
                montant,
                montant_paye,
                montant_restant,
                date_debut,
                date_fin,
                statut,
                type_contrat,
                categorie_vehicule,
                created_at,
                updated_at,
                clients (nom, prenom),
                vehicules (immatriculation, marque, modele)
            `)
            .eq('entreprise_id', entrepriseId)
            .gt('montant_paye', 0)
            .order('updated_at', { ascending: false });

        if (dateFilter.gte) query = query.gte('updated_at', dateFilter.gte);
        if (dateFilter.lte) query = query.lte('updated_at', dateFilter.lte);
        if (categorie) query = query.eq('categorie_vehicule', categorie);

        return query;
    };

    const { rows, error } = await fetchAllRows(buildQuery);
    if (error) throw error;

    return rows.map(buildFallbackEntry);
}

const getSummary = async (req, res) => {
    try {
        const entrepriseId = req.entrepriseId;
        const {
            filter,
            dateDebut,
            dateFin,
            categorie = '',
            offset = 0,
            limit = 25
        } = req.query;

        const parsedOffset = Math.max(parseInt(offset, 10) || 0, 0);
        const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 25, 1), 1000);
        const dateFilter = buildDateFilter(filter, dateDebut, dateFin);

        let entries = [];
        let ledgerAvailable = true;

        try {
            entries = await getEntriesFromPaymentLedger(entrepriseId, dateFilter, categorie);
        } catch (error) {
            if (!isMissingPaymentsTable(error)) {
                throw error;
            }
            ledgerAvailable = false;
            entries = await getEntriesFromContractsFallback(entrepriseId, dateFilter, categorie);
        }

        entries.sort((a, b) => new Date(b.date_paiement || 0) - new Date(a.date_paiement || 0));

        const summary = summarizeEntries(entries);
        const paginatedEntries = entries.slice(parsedOffset, parsedOffset + parsedLimit);

        res.json({
            ...summary,
            ledgerAvailable,
            detailedContracts: paginatedEntries.map(formatDetailedEntry),
            detailedPayments: paginatedEntries.map(formatDetailedEntry),
            detailedContractsTotal: entries.length,
            detailedPaymentsTotal: entries.length,
            offset: parsedOffset,
            limit: parsedLimit
        });

    } catch (error) {
        console.error('Erreur lors de la recuperation du rapport de caisse', error);
        res.status(500).json({ error: 'Erreur lors de la recuperation du rapport de caisse' });
    }
};

const getTpvBordereau = async (req, res) => {
    try {
        const { dateDebut, dateFin } = req.query;
        if (!dateDebut || !dateFin) {
            return res.status(400).json({ error: 'dateDebut et dateFin sont requis' });
        }

        const { data, error } = await db.supabase
            .from('contrats')
            .select(`
                numero_contrat,
                numero_attestation,
                date_debut,
                date_fin,
                montant,
                frais,
                taxe,
                fga,
                prime_ttc,
                net_a_verser,
                statut,
                clients (nom, prenom, telephone),
                vehicules (immatriculation)
            `)
            .eq('entreprise_id', req.entrepriseId)
            .eq('categorie_vehicule', 'TPV')
            .gte('date_debut', dateDebut)
            .lte('date_debut', dateFin)
            .order('date_debut', { ascending: true });

        if (error) throw error;
        const records = (data || []).map(contract => ({
            policyNumber: contract.numero_contrat,
            attestationNumber: contract.numero_attestation,
            customerName: [contract.clients?.prenom, contract.clients?.nom]
                .filter(Boolean)
                .join(' ')
                .trim(),
            customerPhone: contract.clients?.telephone,
            matricule: contract.vehicules?.immatriculation,
            effectiveDate: contract.date_debut,
            expiryDate: contract.date_fin,
            primeNette: toMoney(contract.montant),
            fees: toMoney(contract.frais),
            taxes: toMoney(contract.taxe),
            fga: toMoney(contract.fga),
            primeTtc: toMoney(contract.prime_ttc),
            netToPay: toMoney(contract.net_a_verser),
            status: contract.statut
        }));
        return res.json({ records, total: records.length, dateDebut, dateFin });
    } catch (error) {
        console.error('Erreur lors de la recuperation du bordereau TPV', error);
        return res.status(500).json({ error: 'Erreur lors de la recuperation du bordereau TPV' });
    }
};

module.exports = {
    getSummary,
    getTpvBordereau
};
