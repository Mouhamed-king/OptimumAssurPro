// ============================================
// CONTRÔLEUR DES RAPPORTS (Supabase SDK)
// ============================================

const db = require('../database/connection');
const moment = require('moment');

const getSummary = async (req, res) => {
    try {
        const entrepriseId = req.entrepriseId;
        const { filter } = req.query; // 'all', 'month', 'quarter', 'year'

        let dateFilter = {};
        const today = moment();

        if (filter === 'month') {
            dateFilter = {
                gte: today.startOf('month').format('YYYY-MM-DD'),
                lte: today.endOf('month').format('YYYY-MM-DD')
            };
        } else if (filter === 'quarter') {
            dateFilter = {
                gte: today.startOf('quarter').format('YYYY-MM-DD'),
                lte: today.endOf('quarter').format('YYYY-MM-DD')
            };
        } else if (filter === 'year') {
            dateFilter = {
                gte: today.startOf('year').format('YYYY-MM-DD'),
                lte: today.endOf('year').format('YYYY-MM-DD')
            };
        }

        // Total Revenue (sum of montant from active contracts)
        let revenueQuery = db.supabase
            .from('contrats')
            .select('montant')
            .eq('entreprise_id', entrepriseId)
            .eq('statut', 'actif');

        if (dateFilter.gte) revenueQuery = revenueQuery.gte('date_debut', dateFilter.gte);
        if (dateFilter.lte) revenueQuery = revenueQuery.lte('date_fin', dateFilter.lte);

        const { data: revenueData, error: revenueError } = await revenueQuery;
        if (revenueError) throw revenueError;
        const totalRevenue = revenueData.reduce((sum, contract) => sum + (parseFloat(contract.montant) || 0), 0);

        // Total Contracts
        let contractsQuery = db.supabase
            .from('contrats')
            .select('id', { count: 'exact', head: true })
            .eq('entreprise_id', entrepriseId);

        if (dateFilter.gte) contractsQuery = contractsQuery.gte('created_at', dateFilter.gte);
        if (dateFilter.lte) contractsQuery = contractsQuery.lte('created_at', dateFilter.lte);

        const { count: totalContracts, error: totalContractsError } = await contractsQuery;
        if (totalContractsError) throw totalContractsError;

        // Total Clients
        let clientsQuery = db.supabase
            .from('clients')
            .select('id', { count: 'exact', head: true })
            .eq('entreprise_id', entrepriseId);

        if (dateFilter.gte) clientsQuery = clientsQuery.gte('created_at', dateFilter.gte);
        if (dateFilter.lte) clientsQuery = clientsQuery.lte('created_at', dateFilter.lte);

        const { count: totalClients, error: totalClientsError } = await clientsQuery;
        if (totalClientsError) throw totalClientsError;

        // Renewal Rate (simplified: count of renewed contracts / count of expired contracts)
        const renewalRate = 0; // Placeholder - à implémenter si nécessaire

        // Contracts Evolution (e.g., monthly new contracts)
        const contractsEvolution = [];
        for (let i = 5; i >= 0; i--) { // Last 6 months
            const month = moment().subtract(i, 'months');
            const { count: newContractsCount } = await db.supabase
                .from('contrats')
                .select('id', { count: 'exact', head: true })
                .eq('entreprise_id', entrepriseId)
                .gte('created_at', month.startOf('month').format('YYYY-MM-DD'))
                .lte('created_at', month.endOf('month').format('YYYY-MM-DD'));
            contractsEvolution.push({ month: month.format('MMM YYYY'), count: newContractsCount || 0 });
        }

        // Contract Type Distribution
        const { data: typeDistributionData, error: typeDistributionError } = await db.supabase
            .from('contrats')
            .select('type_contrat')
            .eq('entreprise_id', entrepriseId)
            .not('type_contrat', 'is', null);

        if (typeDistributionError) throw typeDistributionError;
        
        // Compter les occurrences de chaque type
        const typeCounts = {};
        typeDistributionData.forEach(contract => {
            const type = contract.type_contrat || 'Autre';
            typeCounts[type] = (typeCounts[type] || 0) + 1;
        });
        
        const contractTypeDistribution = Object.entries(typeCounts).map(([type, count]) => ({
            type,
            count
        }));

        // Detailed Contracts (for the table)
        let detailedContractsQuery = db.supabase
            .from('contrats')
            .select(`
                numero_contrat,
                numero_police,
                montant,
                date_debut,
                date_fin,
                statut,
                type_contrat,
                clients (nom, prenom),
                vehicules (immatriculation, marque, modele)
            `)
            .eq('entreprise_id', entrepriseId)
            .order('date_debut', { ascending: false });

        if (dateFilter.gte) detailedContractsQuery = detailedContractsQuery.gte('date_debut', dateFilter.gte);
        if (dateFilter.lte) detailedContractsQuery = detailedContractsQuery.lte('date_fin', dateFilter.lte);

        const { data: detailedContracts, error: detailedContractsError } = await detailedContractsQuery;
        if (detailedContractsError) throw detailedContractsError;

        const formattedDetailedContracts = detailedContracts.map(contract => ({
            numero_contrat: contract.numero_contrat,
            numero_police: contract.numero_police,
            montant: contract.montant,
            date_debut: contract.date_debut,
            date_fin: contract.date_fin,
            statut: contract.statut,
            type_contrat: contract.type_contrat,
            client_nom: contract.clients?.nom || '',
            client_prenom: contract.clients?.prenom || '',
            vehicule_immatriculation: contract.vehicules?.immatriculation || '',
            vehicule_marque: contract.vehicules?.marque || '',
            vehicule_modele: contract.vehicules?.modele || ''
        }));

        res.json({
            totalRevenue,
            totalContracts: totalContracts || 0,
            totalClients: totalClients || 0,
            renewalRate,
            contractsEvolution,
            contractTypeDistribution,
            detailedContracts: formattedDetailedContracts
        });

    } catch (error) {
        console.error('Erreur lors de la récupération du résumé des rapports:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération du résumé des rapports: ' + error.message });
    }
};

module.exports = {
    getSummary
};

