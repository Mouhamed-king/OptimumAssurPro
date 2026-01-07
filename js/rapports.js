// ============================================
// GESTION DES RAPPORTS
// ============================================

let evolutionChart = null;
let repartitionChart = null;
let beneficeChart = null;

// Charger les rapports
async function loadRapports() {
    try {
        // Vérifier que l'API est chargée
        if (!window.api || !window.api.stats || !window.api.contracts) {
            throw new Error('API non chargée');
        }
        
        const periode = document.getElementById('rapportPeriode')?.value || 'annee';
        
        // Charger les statistiques
        const stats = await window.api.stats.getDashboard();
        
        // Charger tous les contrats
        const contractsData = await window.api.contracts.getAll();
        const contrats = contractsData.contrats || [];
        
        // Filtrer par période
        const contratsFiltres = filtrerParPeriode(contrats, periode);
        
        // Calculer les statistiques
        const chiffreAffaires = contratsFiltres.reduce((sum, c) => {
            const montant = parseFloat(c.montant) || 0;
            return sum + montant;
        }, 0);
        const montantEncaisse = contratsFiltres.reduce((sum, c) => {
            const paye = parseFloat(c.montant_paye);
            return sum + (isNaN(paye) ? 0 : paye);
        }, 0);
        const montantRestant = contratsFiltres.reduce((sum, c) => {
            const restant = parseFloat(c.montant_restant);
            return sum + (isNaN(restant) ? 0 : restant);
        }, 0);
        const montantNetAVerser = contratsFiltres.reduce((sum, c) => {
            const montant = parseFloat(c.montant) || 0;
            return sum + montant;
        }, 0); // Prime nette totale
        const beneficeTotal = montantEncaisse - montantNetAVerser; // Bénéfice = montant payé - net à verser
        const contratsTotal = contratsFiltres.length;
        const clientsTotal = new Set(contratsFiltres.map(c => c.client_id)).size;
        
        // Mettre à jour les cartes de statistiques
        const chiffreAffairesEl = document.getElementById('rapportChiffreAffaires');
        if (chiffreAffairesEl) chiffreAffairesEl.textContent = formatMoney(chiffreAffaires);
        
        const montantEncaisseEl = document.getElementById('rapportMontantEncaisse');
        if (montantEncaisseEl) montantEncaisseEl.textContent = formatMoney(montantEncaisse);
        
        const montantRestantEl = document.getElementById('rapportMontantRestant');
        if (montantRestantEl) montantRestantEl.textContent = formatMoney(montantRestant);
        
        const beneficeEl = document.getElementById('rapportBenefice');
        if (beneficeEl) {
            beneficeEl.textContent = formatMoney(beneficeTotal);
            // Colorier en vert si bénéfice positif, rouge si négatif
            beneficeEl.style.color = beneficeTotal >= 0 ? '#10B981' : '#EF4444';
        }
        
        const contratsTotalEl = document.getElementById('rapportContratsTotal');
        if (contratsTotalEl) contratsTotalEl.textContent = contratsTotal;
        
        const clientsTotalEl = document.getElementById('rapportClientsTotal');
        if (clientsTotalEl) clientsTotalEl.textContent = clientsTotal;
        
        // Calculer le taux de renouvellement (approximation)
        const tauxRenouvellement = contratsTotal > 0 ? Math.round((contratsFiltres.filter(c => c.statut === 'actif').length / contratsTotal) * 100) : 0;
        const tauxRenouvellementEl = document.getElementById('rapportTauxRenouvellement');
        if (tauxRenouvellementEl) tauxRenouvellementEl.textContent = tauxRenouvellement + '%';
        
        // Créer les graphiques (vérifier que Chart.js est disponible)
        if (typeof Chart !== 'undefined') {
            creerGraphiqueEvolution(contratsFiltres);
            creerGraphiqueRepartition(contratsFiltres);
            creerGraphiquePaiements(contratsFiltres);
            creerGraphiqueBenefice(contratsFiltres);
        } else {
            console.warn('Chart.js n\'est pas chargé. Les graphiques ne seront pas affichés.');
        }
        
        // Remplir le tableau
        remplirTableauRapports(contratsFiltres);
        
    } catch (error) {
        console.error('Erreur lors du chargement des rapports:', error);
        console.error('Détails de l\'erreur:', error.stack);
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
function creerGraphiqueEvolution(contrats) {
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
        
        // Grouper par mois
        const donneesParMois = {};
        contrats.forEach(contrat => {
            const date = new Date(contrat.date_debut || contrat.created_at);
            const mois = date.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' });
            
            if (!donneesParMois[mois]) {
                donneesParMois[mois] = 0;
            }
            donneesParMois[mois]++;
        });
        
        const labels = Object.keys(donneesParMois).sort((a, b) => {
            return new Date(a) - new Date(b);
        });
        const donnees = labels.map(label => donneesParMois[label]);
        
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
function creerGraphiqueRepartition(contrats) {
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
        
        // Grouper par type de contrat
        const repartition = {};
        contrats.forEach(contrat => {
            const type = contrat.type_contrat || 'Non spécifié';
            repartition[type] = (repartition[type] || 0) + 1;
        });
        
        const labels = Object.keys(repartition);
        const donnees = Object.values(repartition);
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
function creerGraphiquePaiements(contrats) {
    try {
        const ctx = document.getElementById('paiementsChart');
        if (!ctx) {
            console.warn('Canvas paiementsChart non trouvé');
            return;
        }
        
        const montantEncaisse = contrats.reduce((sum, c) => {
            const paye = parseFloat(c.montant_paye);
            return sum + (isNaN(paye) ? 0 : paye);
        }, 0);
        const montantRestant = contrats.reduce((sum, c) => {
            const restant = parseFloat(c.montant_restant);
            return sum + (isNaN(restant) ? 0 : restant);
        }, 0);
        
        // Détruire le graphique existant s'il existe
        if (window.paiementsChart) {
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
function creerGraphiqueBenefice(contrats) {
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
        
        // Grouper par mois et calculer le bénéfice mensuel
        const beneficeParMois = {};
        contrats.forEach(contrat => {
            try {
                const date = new Date(contrat.date_debut || contrat.created_at);
                if (isNaN(date.getTime())) {
                    console.warn('Date invalide pour le contrat:', contrat.id);
                    return;
                }
                
                const mois = date.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' });
                
                const montantPaye = parseFloat(contrat.montant_paye) || 0;
                const montantNet = parseFloat(contrat.montant) || 0; // Prime nette (net à verser)
                const benefice = montantPaye - montantNet;
                
                if (!beneficeParMois[mois]) {
                    beneficeParMois[mois] = 0;
                }
                beneficeParMois[mois] += benefice;
            } catch (err) {
                console.warn('Erreur lors du traitement du contrat:', contrat.id, err);
            }
        });
        
        // Si aucun bénéfice, créer un graphique vide
        if (Object.keys(beneficeParMois).length === 0) {
            console.warn('Aucun bénéfice à afficher');
            // Détruire le graphique existant s'il existe
            if (beneficeChart) {
                beneficeChart.destroy();
                beneficeChart = null;
            }
            return;
        }
        
        // Trier les labels par date (utiliser la date réelle pour le tri)
        const moisAvecDates = Object.keys(beneficeParMois).map(mois => {
            // Trouver un contrat de ce mois pour obtenir la date réelle
            const contratDuMois = contrats.find(c => {
                const date = new Date(c.date_debut || c.created_at);
                const moisContrat = date.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' });
                return moisContrat === mois;
            });
            
            if (contratDuMois) {
                const date = new Date(contratDuMois.date_debut || contratDuMois.created_at);
                return { mois, date, benefice: beneficeParMois[mois] };
            }
            return { mois, date: new Date(), benefice: beneficeParMois[mois] };
        });
        
        moisAvecDates.sort((a, b) => a.date - b.date);
        const labels = moisAvecDates.map(item => item.mois);
        const donnees = moisAvecDates.map(item => item.benefice);
        
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
        if (!window.api || !window.api.stats || !window.api.contracts) {
            showToast('API non disponible', 'error');
            return;
        }
        
        const periode = document.getElementById('rapportPeriode')?.value || 'annee';
        
        // Charger tous les contrats
        const contractsData = await window.api.contracts.getAll();
        const contrats = contractsData.contrats || [];
        
        // Filtrer par période
        const contratsFiltres = filtrerParPeriode(contrats, periode);
        
        if (contratsFiltres.length === 0) {
            showToast('Aucune donnée à exporter pour cette période', 'info');
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
            const vehicule = contrat.vehicules?.immatriculation || '-';
            const dateDebut = contrat.date_debut ? new Date(contrat.date_debut).toLocaleDateString('fr-FR') : '-';
            const dateFin = contrat.date_fin ? new Date(contrat.date_fin).toLocaleDateString('fr-FR') : '-';
            const primeNette = (parseFloat(contrat.montant) || 0).toLocaleString('fr-FR');
            const montantPaye = (parseFloat(contrat.montant_paye) || 0).toLocaleString('fr-FR');
            const montantRestant = (parseFloat(contrat.montant_restant) || 0).toLocaleString('fr-FR');
            const statut = contrat.actif ? 'Actif' : 'Inactif';
            
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
        
        showToast('Rapport exporté avec succès', 'success');
        
    } catch (error) {
        console.error('Erreur lors de l\'export du rapport:', error);
        showToast('Erreur lors de l\'export du rapport', 'error');
    }
}

// Exposer les fonctions globalement
window.loadRapports = loadRapports;
window.exportRapport = exportRapport;

// Écouter les changements de période
document.addEventListener('DOMContentLoaded', function() {
    const periodeSelect = document.getElementById('rapportPeriode');
    if (periodeSelect) {
        periodeSelect.addEventListener('change', function() {
            loadRapports();
        });
    }
});

