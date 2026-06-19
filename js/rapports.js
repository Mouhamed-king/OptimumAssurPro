// ============================================
// GESTION DES RAPPORTS DE CAISSE
// ============================================

let evolutionChart = null;
let repartitionChart = null;
let beneficeChart = null;
let rapportsCurrentPage = 1;
const rapportsClientsPerPage = 25;

function setupRapportLabels() {
    const setMetricLabel = (id, label) => {
        const valueEl = document.getElementById(id);
        const labelEl = valueEl?.nextElementSibling;
        if (labelEl) labelEl.textContent = label;
    };

    setMetricLabel('rapportChiffreAffaires', 'Somme totale');
    setMetricLabel('rapportMontantEncaisse', 'Encaissé période');
    setMetricLabel('rapportMontantRestant', 'Montant restant');
    setMetricLabel('rapportContratsTotal', 'Contrats payés');
    setMetricLabel('rapportClientsTotal', 'Clients payeurs');
    setMetricLabel('rapportTauxRenouvellement', 'Net à verser');
    setMetricLabel('rapportBenefice', 'Bénéfice estimé');

    const chartTitles = [
        ['evolutionChart', 'Encaissements par jour'],
        ['repartitionChart', 'Types d\'encaissement'],
        ['paiementsChart', 'Encaissé vs reste à payer'],
        ['beneficeChart', 'Bénéfice estimé par jour']
    ];

    chartTitles.forEach(([canvasId, title]) => {
        const titleEl = document.getElementById(canvasId)
            ?.closest('.card')
            ?.querySelector('.card-header h3');
        if (titleEl) titleEl.textContent = title;
    });

    const tableTitle = document.getElementById('rapportsTableBody')
        ?.closest('.card')
        ?.querySelector('.card-header h3');
    if (tableTitle) tableTitle.textContent = 'Détails des encaissements';

    const headerRow = document.querySelector('#rapportsTableBody')
        ?.closest('table')
        ?.querySelector('thead tr');
    if (headerRow) {
        headerRow.innerHTML = `
            <th>Date paiement</th>
            <th>Client</th>
            <th>Numéro de police</th>
            <th>Libellé</th>
            <th>Prime nette</th>
            <th>Encaissé</th>
            <th>Montant restant</th>
            <th>Bénéfice</th>
        `;
    }
}

function formatRapportText(value, fallback = '-') {
    const text = value === null || value === undefined || String(value).trim() === '' ? fallback : value;
    return typeof window.escapeHtml === 'function' ? window.escapeHtml(text) : text;
}

function formatRapportDateTime(value) {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function getReportFilterParams() {
    const periode = document.getElementById('rapportPeriode')?.value || 'aujourdhui';
    const categorie = document.getElementById('rapportCategorie')?.value || '';
    const filterMap = {
        aujourdhui: 'today',
        deux_jours: 'two_days',
        mois: 'month',
        trimestre: 'quarter',
        annee: 'year',
        tout: 'all'
    };

    return {
        periode,
        categorie,
        filter: filterMap[periode] || 'today'
    };
}

async function loadRapports() {
    try {
        if (!window.api || !window.api.reports) {
            throw new Error('API non chargee');
        }

        const offset = (rapportsCurrentPage - 1) * rapportsClientsPerPage;
        const { categorie, filter } = getReportFilterParams();
        const summary = await window.api.reports.getSummary({
            filter,
            categorie,
            offset,
            limit: rapportsClientsPerPage
        });

        const chiffreAffairesEl = document.getElementById('rapportChiffreAffaires');
        if (chiffreAffairesEl) chiffreAffairesEl.textContent = formatMoney(summary.totalPremium || 0);

        const montantEncaisseEl = document.getElementById('rapportMontantEncaisse');
        if (montantEncaisseEl) montantEncaisseEl.textContent = formatMoney(summary.totalPaid || 0);

        const montantRestantEl = document.getElementById('rapportMontantRestant');
        if (montantRestantEl) montantRestantEl.textContent = formatMoney(summary.totalRemaining || 0);

        const beneficeEl = document.getElementById('rapportBenefice');
        if (beneficeEl) {
            const totalProfit = summary.totalProfit || 0;
            beneficeEl.textContent = formatMoney(totalProfit);
            beneficeEl.style.color = totalProfit >= 0 ? '#10B981' : '#EF4444';
        }

        const contratsTotalEl = document.getElementById('rapportContratsTotal');
        if (contratsTotalEl) contratsTotalEl.textContent = summary.totalContracts || 0;

        const clientsTotalEl = document.getElementById('rapportClientsTotal');
        if (clientsTotalEl) clientsTotalEl.textContent = summary.totalClients || 0;

        const netAVerserEl = document.getElementById('rapportTauxRenouvellement');
        if (netAVerserEl) netAVerserEl.textContent = formatMoney(summary.totalNetAVerser || 0);

        if (typeof Chart !== 'undefined') {
            creerGraphiqueEvolution(summary.cashFlowByDay || summary.contractsEvolution || []);
            creerGraphiqueRepartition(summary.contractTypeDistribution || []);
            creerGraphiquePaiements(summary.totalPaid || 0, summary.totalRemaining || 0);
            creerGraphiqueBenefice(summary.profitEvolution || []);
        } else {
            console.warn('Chart.js non disponible');
        }

        remplirTableauRapports(summary.detailedPayments || summary.detailedContracts || []);
        updateRapportsPagination(summary.detailedPaymentsTotal || summary.detailedContractsTotal || 0);
    } catch (error) {
        console.error('Erreur lors du chargement des rapports:', error);
        if (typeof window.showToast === 'function') {
            window.showToast('Erreur lors du chargement des rapports', 'error');
        }
    }
}

function creerGraphiqueEvolution(evolutionData) {
    try {
        const ctx = document.getElementById('evolutionChart');
        if (!ctx || typeof Chart === 'undefined') return;

        const labels = evolutionData.map(item => item.day || item.month || item.date);
        const donnees = evolutionData.map(item => item.amount || 0);

        if (evolutionChart) evolutionChart.destroy();

        evolutionChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    label: 'Encaissements',
                    data: donnees,
                    backgroundColor: 'rgba(16, 185, 129, 0.75)',
                    borderColor: '#10B981',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: true, position: 'top' },
                    tooltip: {
                        callbacks: {
                            label: context => 'Encaisse: ' + formatMoney(context.parsed.y)
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { callback: value => formatMoney(value) }
                    }
                }
            }
        });
    } catch (error) {
        console.error('Erreur graphique encaissements:', error);
    }
}

function creerGraphiqueRepartition(distributionData) {
    try {
        const ctx = document.getElementById('repartitionChart');
        if (!ctx || typeof Chart === 'undefined') return;

        const labels = distributionData.map(item => item.type || 'Autre');
        const donnees = distributionData.map(item => item.count || 0);
        const couleurs = ['#2563EB', '#10B981', '#F59E0B', '#EF4444', '#14B8A6', '#8B5CF6'];

        if (repartitionChart) repartitionChart.destroy();

        repartitionChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels,
                datasets: [{
                    data: donnees,
                    backgroundColor: couleurs.slice(0, Math.max(labels.length, 1)),
                    borderWidth: 2,
                    borderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: true, position: 'bottom' } }
            }
        });
    } catch (error) {
        console.error('Erreur graphique repartition:', error);
    }
}

function creerGraphiquePaiements(montantEncaisse, montantRestant) {
    try {
        const ctx = document.getElementById('paiementsChart');
        if (!ctx || typeof Chart === 'undefined') return;

        if (window.paiementsChart && typeof window.paiementsChart.destroy === 'function') {
            window.paiementsChart.destroy();
        }

        window.paiementsChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Encaisse', 'Reste a payer'],
                datasets: [{
                    data: [Math.max(montantEncaisse, 0), Math.max(montantRestant, 0)],
                    backgroundColor: ['#10B981', '#F59E0B'],
                    borderWidth: 2,
                    borderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: true, position: 'bottom' },
                    tooltip: {
                        callbacks: {
                            label: context => context.label + ': ' + formatMoney(context.parsed)
                        }
                    }
                }
            }
        });
    } catch (error) {
        console.error('Erreur graphique paiements:', error);
    }
}

function creerGraphiqueBenefice(profitEvolution) {
    try {
        const ctx = document.getElementById('beneficeChart');
        if (!ctx || typeof Chart === 'undefined') return;

        if (beneficeChart) beneficeChart.destroy();

        const labels = profitEvolution.map(item => item.month || item.day || item.date);
        const donnees = profitEvolution.map(item => item.amount || 0);

        beneficeChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    label: 'Benefice estime',
                    data: donnees,
                    borderColor: '#2563EB',
                    backgroundColor: 'rgba(37, 99, 235, 0.12)',
                    tension: 0.35,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: true, position: 'top' },
                    tooltip: {
                        callbacks: {
                            label: context => 'Benefice: ' + formatMoney(context.parsed.y)
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { callback: value => formatMoney(value) }
                    }
                }
            }
        });
    } catch (error) {
        console.error('Erreur graphique benefice:', error);
    }
}

function remplirTableauRapports(paiements) {
    const tbody = document.getElementById('rapportsTableBody');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (!paiements.length) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 2rem; color: #6B7280;">Aucun encaissement trouve pour cette periode</td></tr>';
        return;
    }

    paiements.forEach(paiement => {
        const row = document.createElement('tr');
        const montantEncaisse = parseFloat(paiement.montant_paye) || 0;
        const montantRestant = parseFloat(paiement.montant_restant) || 0;
        const montantTotal = parseFloat(paiement.montant) || 0;
        const benefice = parseFloat(paiement.commission) || 0;

        row.innerHTML = `
            <td>${formatRapportDateTime(paiement.date_paiement)}</td>
            <td>${formatRapportText(paiement.client_nom, 'Client')}</td>
            <td>${formatRapportText(paiement.numero_contrat)}</td>
            <td>${formatRapportText(paiement.libelle, 'Encaissement')}</td>
            <td style="text-align: right;">${formatMoney(montantTotal)}</td>
            <td style="text-align: right; color: ${montantEncaisse >= 0 ? '#10B981' : '#EF4444'};">${formatMoney(montantEncaisse)}</td>
            <td style="text-align: right; color: ${montantRestant > 0 ? '#F59E0B' : '#10B981'};">${formatMoney(montantRestant)}</td>
            <td style="text-align: right; color: ${benefice >= 0 ? '#2563EB' : '#EF4444'};">${formatMoney(benefice)}</td>
        `;
        tbody.appendChild(row);
    });
}

function formatMoney(amount) {
    return new Intl.NumberFormat('fr-FR', {
        style: 'decimal',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount) + ' FCFA';
}

async function exportRapport() {
    try {
        if (!window.api || !window.api.reports) {
            if (typeof window.showToast === 'function') window.showToast('API non disponible', 'error');
            return;
        }

        const { periode, categorie, filter } = getReportFilterParams();
        const summary = await window.api.reports.getSummary({
            filter,
            categorie,
            offset: 0,
            limit: 1000
        });
        const paiements = summary.detailedPayments || summary.detailedContracts || [];

        if (!paiements.length) {
            if (typeof window.showToast === 'function') {
                window.showToast('Aucune donnee a exporter pour cette periode', 'info');
            }
            return;
        }

        const csvHeaders = [
            'Date paiement',
            'Client',
            'Numero police',
            'Libelle',
            'Prime nette',
            'Montant encaisse',
            'Montant restant',
            'Benefice estime',
            'Net a verser'
        ];

        const csvRows = paiements.map(paiement => [
            formatRapportDateTime(paiement.date_paiement),
            paiement.client_nom || '-',
            paiement.numero_contrat || '-',
            paiement.libelle || '-',
            parseFloat(paiement.montant || 0).toLocaleString('fr-FR'),
            parseFloat(paiement.montant_paye || 0).toLocaleString('fr-FR'),
            parseFloat(paiement.montant_restant || 0).toLocaleString('fr-FR'),
            parseFloat(paiement.commission || 0).toLocaleString('fr-FR'),
            parseFloat(paiement.net_a_verser || 0).toLocaleString('fr-FR')
        ]);

        csvRows.push([]);
        csvRows.push([
            'TOTAL',
            '',
            '',
            '',
            parseFloat(summary.totalPremium || 0).toLocaleString('fr-FR'),
            parseFloat(summary.totalPaid || 0).toLocaleString('fr-FR'),
            parseFloat(summary.totalRemaining || 0).toLocaleString('fr-FR'),
            parseFloat(summary.totalProfit || 0).toLocaleString('fr-FR'),
            parseFloat(summary.totalNetAVerser || 0).toLocaleString('fr-FR')
        ]);

        const csvContent = [
            csvHeaders.join(','),
            ...csvRows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        ].join('\n');

        const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        const dateStr = new Date().toISOString().split('T')[0];
        link.download = `etat-caisse-${periode}-${dateStr}.csv`;

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        if (typeof window.showToast === 'function') {
            window.showToast('Etat de caisse exporte avec succes', 'success');
        }
    } catch (error) {
        console.error('Erreur lors de l export du rapport:', error);
        if (typeof window.showToast === 'function') {
            window.showToast('Erreur lors de l export du rapport', 'error');
        }
    }
}

window.loadRapports = loadRapports;
window.exportRapport = exportRapport;

function updateRapportsPagination(total) {
    const totalPages = Math.max(Math.ceil(total / rapportsClientsPerPage), 1);
    const pageInfo = document.getElementById('rapportsPageInfo');
    const prevBtn = document.getElementById('rapportsPrevPage');
    const nextBtn = document.getElementById('rapportsNextPage');

    if (pageInfo) pageInfo.textContent = `Page ${rapportsCurrentPage} sur ${totalPages}`;
    if (prevBtn) prevBtn.disabled = rapportsCurrentPage <= 1;
    if (nextBtn) nextBtn.disabled = rapportsCurrentPage >= totalPages || totalPages === 0;
}

document.addEventListener('DOMContentLoaded', function() {
    const periodeSelect = document.getElementById('rapportPeriode');
    setupRapportLabels();

    if (periodeSelect) {
        periodeSelect.value = 'aujourdhui';
        periodeSelect.addEventListener('change', function() {
            rapportsCurrentPage = 1;
            loadRapports();
        });
    }

    const categorieSelect = document.getElementById('rapportCategorie');
    if (categorieSelect) {
        categorieSelect.addEventListener('change', function() {
            rapportsCurrentPage = 1;
            loadRapports();
        });
    }

    const prevBtn = document.getElementById('rapportsPrevPage');
    const nextBtn = document.getElementById('rapportsNextPage');

    if (prevBtn) {
        prevBtn.addEventListener('click', function() {
            if (rapportsCurrentPage > 1) {
                rapportsCurrentPage--;
                loadRapports();
            }
        });
    }

    if (nextBtn) {
        nextBtn.addEventListener('click', function() {
            rapportsCurrentPage++;
            loadRapports();
        });
    }
});
