// ============================================
// GESTION DES RAPPORTS
// ============================================

let evolutionChart = null;
let repartitionChart = null;
let beneficeChart = null;
let rapportsCurrentPage = 1;
const rapportsClientsPerPage = 25;

function getReportFilterParams() {
    const periode = document.getElementById('rapportPeriode')?.value || 'annee';
    const categorie = document.getElementById('rapportCategorie')?.value || '';
    const filterMap = {
        mois: 'month',
        trimestre: 'quarter',
        annee: 'year',
        tout: 'all'
    };

    return {
        periode,
        categorie,
        filter: filterMap[periode] || 'year'
    };
}

// Charger les rapports avec pagination
async function loadRapports() {
    try {
        if (!window.api || !window.api.reports) {
            throw new Error('API non chargée');
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
        if (chiffreAffairesEl) chiffreAffairesEl.textContent = formatMoney(summary.totalRevenue || 0);

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

        const tauxRenouvellementEl = document.getElementById('rapportTauxRenouvellement');
        if (tauxRenouvellementEl) tauxRenouvellementEl.textContent = `${summary.renewalRate || 0}%`;

        if (typeof Chart !== 'undefined') {
            creerGraphiqueEvolution(summary.contractsEvolution || []);
            creerGraphiqueRepartition(summary.contractTypeDistribution || []);
            creerGraphiquePaiements(summary.totalPaid || 0, summary.totalRemaining || 0);
            creerGraphiqueBenefice(summary.profitEvolution || []);
        } else {
            console.warn('Chart.js n\'est pas chargé. Les graphiques ne seront pas affichés.');
        }

        remplirTableauRapports(summary.detailedContracts || []);
        updateRapportsPagination(summary.detailedContractsTotal || 0);
    } catch (error) {
        console.error('Erreur lors du chargement des rapports:', error);
        if (typeof window.showToast === 'function') {
            window.showToast('Erreur lors du chargement des rapports: ' + (error.message || 'Erreur inconnue'), 'error');
        }
    }
}

// Filtrer les contrats par période
function filtrerParPeriode(contrats, periode) {
    const maintenant = new Date();
    let dateDebut = new Date();
    
    switch (periode) {
        case 'mois':
            dateDebut.setMonth(maintenant.getMonth() - 1);
            break;
        case 'trimestre':
            dateDebut.setMonth(maintenant.getMonth() - 3);
            break;
        case 'annee':
            dateDebut.setFullYear(maintenant.getFullYear() - 1);
            break;
        case 'tout':
        default:
            return contrats;
    }
    
    return contrats.filter(c => {
        const dateContrat = new Date(c.date_debut || c.created_at);
        return dateContrat >= dateDebut;
    });
}

// Créer le graphique d'évolution mensuelle
function creerGraphiqueEvolution(evolutionData) {
    try {
        if (typeof Chart === 'undefined') {
            console.warn('Chart.js n\'est pas disponible');
            return;
        }
        
        const ctx = document.getElementById('evolutionChart');
        if (!ctx) {
            console.warn('Canvas evolutionChart non trouvé');
            return;
        }
        
        const labels = evolutionData.map(item => item.month);
        const donnees = evolutionData.map(item => item.count);
        
        if (evolutionChart) {
            evolutionChart.destroy();
        }
        
        evolutionChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Nombre de contrats',
                    data: donnees,
                    borderColor: '#2563EB',
                    backgroundColor: 'rgba(37, 99, 235, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'top'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1
                        }
                    }
                }
            }
        });
    } catch (error) {
        console.error('Erreur lors de la création du graphique d\'évolution:', error);
        // Ne pas bloquer le reste des rapports si ce graphique échoue
    }
}

// Créer le graphique de répartition par type
function creerGraphiqueRepartition(distributionData) {
    try {
        if (typeof Chart === 'undefined') {
            console.warn('Chart.js n\'est pas disponible');
            return;
        }
        
        const ctx = document.getElementById('repartitionChart');
        if (!ctx) {
            console.warn('Canvas repartitionChart non trouvé');
            return;
        }
        
        const labels = distributionData.map(item => item.type || 'Non specifie');
        const donnees = distributionData.map(item => item.count || 0);
        const couleurs = ['#2563EB', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];
        
        if (repartitionChart) {
            repartitionChart.destroy();
        }
        
        repartitionChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: donnees,
                    backgroundColor: couleurs.slice(0, labels.length),
                    borderWidth: 2,
                    borderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'bottom'
                    }
                }
            }
        });
    } catch (error) {
        console.error('Erreur lors de la création du graphique de répartition:', error);
        // Ne pas bloquer le reste des rapports si ce graphique échoue
    }
}

// Créer le graphique des paiements (encaissés vs restants)
function creerGraphiquePaiements(montantEncaisse, montantRestant) {
    try {
        const ctx = document.getElementById('paiementsChart');
        if (!ctx) {
            console.warn('Canvas paiementsChart non trouvé');
            return;
        }

        // Vérifier que Chart.js est disponible
        if (typeof Chart === 'undefined') {
            console.warn('Chart.js non disponible');
            return;
        }

        // Détruire le graphique existant s'il existe et est valide
        if (window.paiementsChart && typeof window.paiementsChart.destroy === 'function') {
            window.paiementsChart.destroy();
        }
        
        window.paiementsChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Montant encaissé', 'Montant restant'],
                datasets: [{
                    data: [montantEncaisse, montantRestant],
                    backgroundColor: ['#10B981', '#F59E0B'],
                    borderWidth: 2,
                    borderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'bottom'
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return context.label + ': ' + formatMoney(context.parsed);
                            }
                        }
                    }
                }
            }
        });
    } catch (error) {
        console.error('Erreur lors de la création du graphique de paiements:', error);
        // Ne pas bloquer le reste des rapports si ce graphique échoue
    }
}

// Créer le graphique de bénéfice (montant payé - net à verser)
function creerGraphiqueBenefice(profitEvolution) {
    try {
        if (typeof Chart === 'undefined') {
            console.warn('Chart.js n\'est pas disponible');
            return;
        }
        
        const ctx = document.getElementById('beneficeChart');
        if (!ctx) {
            console.warn('Canvas beneficeChart non trouvé');
            return;
        }
        
        if (!profitEvolution.length) {
            console.warn('Aucun bénéfice à afficher');
            if (beneficeChart) {
                beneficeChart.destroy();
                beneficeChart = null;
            }
            return;
        }
        
        const labels = profitEvolution.map(item => item.month);
        const donnees = profitEvolution.map(item => item.amount);
        
        // Détruire le graphique existant s'il existe
        if (beneficeChart) {
            beneficeChart.destroy();
        }
        
        beneficeChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Bénéfice (FCFA)',
                    data: donnees,
                    backgroundColor: donnees.map(b => b >= 0 ? 'rgba(16, 185, 129, 0.7)' : 'rgba(239, 68, 68, 0.7)'),
                    borderColor: donnees.map(b => b >= 0 ? '#10B981' : '#EF4444'),
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'top'
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const benefice = context.parsed.y;
                                const signe = benefice >= 0 ? '+' : '';
                                return 'Bénéfice: ' + signe + formatMoney(benefice);
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: false,
                        ticks: {
                            callback: function(value) {
                                return formatMoney(value);
                            }
                        },
                        grid: {
                            color: function(context) {
                                if (context.tick.value === 0) {
                                    return '#E5E7EB';
                                }
                                return 'rgba(0, 0, 0, 0.1)';
                            }
                        }
                    }
                }
            }
        });
    } catch (error) {
        console.error('Erreur lors de la création du graphique de bénéfice:', error);
        // Ne pas bloquer le reste des rapports si ce graphique échoue
    }
}

// Remplir le tableau des rapports
function remplirTableauRapports(contrats) {
    const tbody = document.getElementById('rapportsTableBody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (contrats.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 2rem; color: #6B7280;">Aucun contrat trouvé pour cette période</td></tr>';
        return;
    }
    
    // Trier par date de début (plus récent en premier)
    const contratsTries = [...contrats].sort((a, b) => {
        return new Date(b.date_debut || b.created_at) - new Date(a.date_debut || a.created_at);
    });
    
    contratsTries.forEach(contrat => {
        const row = document.createElement('tr');
        const statutBadge = contrat.statut === 'actif' 
            ? '<span class="badge badge-success">Actif</span>'
            : contrat.statut === 'expire'
            ? '<span class="badge badge-danger">Expiré</span>'
            : '<span class="badge badge-warning">Inactif</span>';
        
        const montantPaye = parseFloat(contrat.montant_paye) || 0;
        const montantRestant = parseFloat(contrat.montant_restant) || 0;
        const montantTotal = parseFloat(contrat.montant) || 0;
        
        row.innerHTML = `
            <td>${contrat.client_nom || 'Client'}</td>
            <td>${contrat.numero_contrat || '-'}</td>
            <td>${formatDate(contrat.date_debut)}</td>
            <td>${formatDate(contrat.date_fin)}</td>
            <td style="text-align: right;">${formatMoney(montantTotal)}</td>
            <td style="text-align: right; color: #10B981;">${formatMoney(montantPaye)}</td>
            <td style="text-align: right; color: ${montantRestant > 0 ? '#F59E0B' : '#10B981'};">${formatMoney(montantRestant)}</td>
            <td>${statutBadge}</td>
        `;
        tbody.appendChild(row);
    });
}

// Formater l'argent
function formatMoney(amount) {
    return new Intl.NumberFormat('fr-FR', {
        style: 'decimal',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount) + ' FCFA';
}

// Exporter le rapport en CSV
async function exportRapport() {
    try {
        if (!window.api || !window.api.reports) {
            if (typeof window.showToast === 'function') {
                window.showToast('API non disponible', 'error');
            } else {
                alert('API non disponible');
            }
            return;
        }
        
        const { periode, categorie, filter } = getReportFilterParams();
        const summary = await window.api.reports.getSummary({
            filter,
            categorie,
            offset: 0,
            limit: 1000
        });
        const contratsFiltres = summary.detailedContracts || [];
        
        if (contratsFiltres.length === 0) {
            if (typeof window.showToast === 'function') {
                window.showToast('Aucune donnée à exporter pour cette période', 'info');
            } else {
                alert('Aucune donnée à exporter pour cette période');
            }
            return;
        }
        
        // Préparer les données CSV
        const csvHeaders = [
            'Numéro Contrat',
            'Client',
            'Véhicule',
            'Date Début',
            'Date Fin',
            'Prime Nette (FCFA)',
            'Montant Payé (FCFA)',
            'Montant Restant (FCFA)',
            'Statut'
        ];
        
        const csvRows = contratsFiltres.map(contrat => {
            const clientNom = contrat.client_nom ? `${contrat.client_nom} ${contrat.client_prenom || ''}`.trim() : '-';
            const vehicule = contrat.vehicule_immatriculation || '-';
            const dateDebut = contrat.date_debut ? new Date(contrat.date_debut).toLocaleDateString('fr-FR') : '-';
            const dateFin = contrat.date_fin ? new Date(contrat.date_fin).toLocaleDateString('fr-FR') : '-';
            const primeNette = (parseFloat(contrat.montant) || 0).toLocaleString('fr-FR');
            const montantPaye = (parseFloat(contrat.montant_paye) || 0).toLocaleString('fr-FR');
            const montantRestant = (parseFloat(contrat.montant_restant) || 0).toLocaleString('fr-FR');
            const statut = contrat.statut || '-';
            
            return [
                contrat.numero_contrat || '-',
                clientNom,
                vehicule,
                dateDebut,
                dateFin,
                primeNette.replace(/\s/g, ''),
                montantPaye.replace(/\s/g, ''),
                montantRestant.replace(/\s/g, ''),
                statut
            ];
        });
        
        // Calculer les totaux
        const totalPrimeNette = contratsFiltres.reduce((sum, c) => sum + (parseFloat(c.montant) || 0), 0);
        const totalPaye = contratsFiltres.reduce((sum, c) => sum + (parseFloat(c.montant_paye) || 0), 0);
        const totalRestant = contratsFiltres.reduce((sum, c) => sum + (parseFloat(c.montant_restant) || 0), 0);
        
        csvRows.push([]); // Ligne vide
        csvRows.push(['TOTAL', '', '', '', '', totalPrimeNette.toLocaleString('fr-FR'), totalPaye.toLocaleString('fr-FR'), totalRestant.toLocaleString('fr-FR'), '']);
        
        // Convertir en CSV
        const csvContent = [
            csvHeaders.join(','),
            ...csvRows.map(row => row.map(cell => `"${cell}"`).join(','))
        ].join('\n');
        
        // Créer le blob et télécharger
        const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' }); // BOM pour Excel
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        
        // Nom du fichier avec la date
        const dateStr = new Date().toISOString().split('T')[0];
        const periodeStr = periode === 'mois' ? 'mois' : periode === 'trimestre' ? 'trimestre' : periode === 'annee' ? 'annee' : 'tout';
        link.download = `rapport-${periodeStr}-${dateStr}.csv`;
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        if (typeof window.showToast === 'function') {
            window.showToast('Rapport exporté avec succès', 'success');
        } else {
            alert('Rapport exporté avec succès');
        }
        
    } catch (error) {
        console.error('Erreur lors de l\'export du rapport:', error);
        if (typeof window.showToast === 'function') {
            window.showToast('Erreur lors de l\'export du rapport: ' + (error.message || 'Erreur inconnue'), 'error');
        } else {
            alert('Erreur lors de l\'export du rapport: ' + (error.message || 'Erreur inconnue'));
        }
    }
}

// Exposer les fonctions globalement
window.loadRapports = loadRapports;
window.exportRapport = exportRapport;

// Fonction de mise à jour de la pagination des rapports
function updateRapportsPagination(total) {
    const totalPages = Math.max(Math.ceil(total / rapportsClientsPerPage), 1);
    const pageInfo = document.getElementById('rapportsPageInfo');
    const prevBtn = document.getElementById('rapportsPrevPage');
    const nextBtn = document.getElementById('rapportsNextPage');
    
    if (pageInfo) {
        pageInfo.textContent = `Page ${rapportsCurrentPage} sur ${totalPages}`;
    }
    
    if (prevBtn) {
        prevBtn.disabled = rapportsCurrentPage <= 1;
    }
    
    if (nextBtn) {
        nextBtn.disabled = rapportsCurrentPage >= totalPages || totalPages === 0;
    }
}

// Gestionnaires d'événements pour la pagination des rapports
document.addEventListener('DOMContentLoaded', function() {
    const periodeSelect = document.getElementById('rapportPeriode');
    if (periodeSelect) {
        periodeSelect.addEventListener('change', function() {
            // Réinitialiser la pagination lorsqu'on change de période
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
            // On ne peut pas connaître le total exact sans recharger, donc on autorise le clic
            // La désactivation sera gérée dans updateRapportsPagination
            rapportsCurrentPage++;
            loadRapports();
        });
    }
});
