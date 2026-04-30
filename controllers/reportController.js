// ============================================
// CONTRÔLEUR DES RAPPORTS (Supabase SDK)
// ============================================

const db = require('../database/connection');
const moment = require('moment');

function buildDateFilter(filter, dateDebut, dateFin) {
    const today = moment();

    if (dateDebut || dateFin) {
        return {
            gte: dateDebut || today.clone().startOf('year').format('YYYY-MM-DD'),
            lte: dateFin || today.clone().endOf('year').format('YYYY-MM-DD')
        };
    }

    if (filter === 'month') {
        return {
            gte: today.clone().startOf('month').format('YYYY-MM-DD'),
            lte: today.clone().endOf('month').format('YYYY-MM-DD')
        };
    }

    if (filter === 'quarter') {
        return {
            gte: today.clone().startOf('quarter').format('YYYY-MM-DD'),
            lte: today.clone().endOf('quarter').format('YYYY-MM-DD')
        };
    }

    if (filter === 'year') {
        return {
            gte: today.clone().startOf('year').format('YYYY-MM-DD'),
            lte: today.clone().endOf('year').format('YYYY-MM-DD')
        };
    }

    return {};
}

function applyContractFilters(query, entrepriseId, dateFilter, categorie) {
    let nextQuery = query.eq('entreprise_id', entrepriseId);

    if (dateFilter.gte) nextQuery = nextQuery.gte('date_debut', dateFilter.gte);
    if (dateFilter.lte) nextQuery = nextQuery.lte('date_fin', dateFilter.lte);
    if (categorie) nextQuery = nextQuery.eq('categorie_vehicule', categorie);

    return nextQuery;
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

        const baseContractsQuery = applyContractFilters(
            db.supabase.from('contrats').select(`
                id,
                client_id,
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
                clients (nom, prenom),
                vehicules (immatriculation, marque, modele)
            `),
            entrepriseId,
            dateFilter,
            categorie
        );

        const { data: contractsData, error: contractsError } = await baseContractsQuery;
        if (contractsError) throw contractsError;

        const allContracts = contractsData || [];
        const totalRevenue = allContracts.reduce((sum, contract) => sum + (parseFloat(contract.montant) || 0), 0);
        const totalPaid = allContracts.reduce((sum, contract) => sum + (parseFloat(contract.montant_paye) || 0), 0);
        const totalRemaining = allContracts.reduce((sum, contract) => sum + (parseFloat(contract.montant_restant) || 0), 0);
        const totalProfit = totalPaid - totalRevenue;
        const totalContracts = allContracts.length;
        const totalClients = new Set(allContracts.map(contract => contract.client_id).filter(Boolean)).size;

        const expiredContracts = allContracts.filter(contract => contract.statut === 'expire').length;
        const renewedContracts = allContracts.filter(contract => contract.statut === 'renouvele').length;
        const renewalRate = expiredContracts > 0
            ? Math.round((renewedContracts / expiredContracts) * 100)
            : 0;

        const contractsEvolutionMap = {};
        const contractTypeMap = {};
        const profitEvolutionMap = {};

        allContracts.forEach(contract => {
            const date = moment(contract.date_debut || contract.created_at);
            if (!date.isValid()) {
                return;
            }

            const monthLabel = date.locale('fr').format('MMM YYYY');
            contractsEvolutionMap[monthLabel] = (contractsEvolutionMap[monthLabel] || 0) + 1;

            const contractType = contract.type_contrat || 'Autre';
            contractTypeMap[contractType] = (contractTypeMap[contractType] || 0) + 1;

            const contractProfit = (parseFloat(contract.montant_paye) || 0) - (parseFloat(contract.montant) || 0);
            profitEvolutionMap[monthLabel] = (profitEvolutionMap[monthLabel] || 0) + contractProfit;
        });

        const sortMonthEntries = entries => entries.sort((a, b) => {
            const left = moment(a[0], 'MMM YYYY', 'fr');
            const right = moment(b[0], 'MMM YYYY', 'fr');
            return left.valueOf() - right.valueOf();
        });

        const contractsEvolution = sortMonthEntries(Object.entries(contractsEvolutionMap)).map(([month, count]) => ({
            month,
            count
        }));

        const profitEvolution = sortMonthEntries(Object.entries(profitEvolutionMap)).map(([month, amount]) => ({
            month,
            amount
        }));

        const contractTypeDistribution = Object.entries(contractTypeMap).map(([type, count]) => ({
            type,
            count
        }));

        let detailedContractsQuery = applyContractFilters(
            db.supabase.from('contrats').select(`
                numero_contrat,
                montant,
                montant_paye,
                montant_restant,
                date_debut,
                date_fin,
                statut,
                type_contrat,
                categorie_vehicule,
                clients (nom, prenom),
                vehicules (immatriculation, marque, modele)
            `, { count: 'exact' }),
            entrepriseId,
            dateFilter,
            categorie
        ).order('date_debut', { ascending: false });

        detailedContractsQuery = detailedContractsQuery.range(parsedOffset, parsedOffset + parsedLimit - 1);

        const {
            data: detailedContracts,
            error: detailedContractsError,
            count: detailedContractsCount
        } = await detailedContractsQuery;
        if (detailedContractsError) throw detailedContractsError;

        const formattedDetailedContracts = detailedContracts.map(contract => ({
            numero_contrat: contract.numero_contrat,
            montant: contract.montant,
            montant_paye: contract.montant_paye,
            montant_restant: contract.montant_restant,
            date_debut: contract.date_debut,
            date_fin: contract.date_fin,
            statut: contract.statut,
            type_contrat: contract.type_contrat,
            categorie_vehicule: contract.categorie_vehicule,
            client_nom: contract.clients?.nom || '',
            client_prenom: contract.clients?.prenom || '',
            vehicule_immatriculation: contract.vehicules?.immatriculation || '',
            vehicule_marque: contract.vehicules?.marque || '',
            vehicule_modele: contract.vehicules?.modele || ''
        }));

        res.json({
            totalRevenue,
            totalPaid,
            totalRemaining,
            totalProfit,
            totalContracts: totalContracts || 0,
            totalClients: totalClients || 0,
            renewalRate,
            contractsEvolution,
            profitEvolution,
            contractTypeDistribution,
            detailedContracts: formattedDetailedContracts,
            detailedContractsTotal: detailedContractsCount || 0,
            offset: parsedOffset,
            limit: parsedLimit
        });

    } catch (error) {
        console.error('Erreur lors de la récupération du résumé des rapports:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération du résumé des rapports: ' + error.message });
    }
};

module.exports = {
    getSummary
};
