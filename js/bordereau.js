// ============================================
// GESTION DU BORDEREAU DYNAMIQUE
// ============================================

// Variable globale pour la pagination du bordereau
let bordereauCurrentPage = 1;
const bordereauClientsPerPage = 25;
let bordereauAllContrats = [];
let bordereauLastFilters = null;

// Mettre à jour le bordereau en temps réel
function updateBordereau() {
    const nom = document.getElementById('clientNom')?.value || '';
    const immatriculation = document.getElementById('vehiculeImmatriculation')?.value || '';
    const numeroPolice = document.getElementById('contractNumeroPolice')?.value || '';
    const dateEffet = document.getElementById('contractDateEffet')?.value || '';
    const dateEcheance = document.getElementById('contractDateEcheance')?.value || '';
    const primeNette = parseFloat(document.getElementById('contractPrimeNette')?.value || 0);
    
    // Mettre à jour la date du bordereau
    const bordereauDate = document.getElementById('bordereauDate');
    if (bordereauDate) {
        const today = new Date();
        bordereauDate.textContent = today.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }
    
    // Mettre à jour le code
    const bordereauCode = document.getElementById('bordereauCode');
    if (bordereauCode && numeroPolice) {
        bordereauCode.textContent = numeroPolice.substring(0, 6);
    }
    
    // Si tous les champs obligatoires sont remplis, ajouter une ligne au bordereau
    if (nom && immatriculation && numeroPolice && dateEffet && dateEcheance && primeNette > 0) {
        updateBordereauTable(nom, immatriculation, numeroPolice, dateEffet, dateEcheance, primeNette);
    }
}

// Calculer les valeurs du contrat à partir de la prime nette
// Formules déduites des données réelles du bordereau
function calculateContractValues(primeNette) {
    // Frais fixes (constante)
    const frais = 3000;
    
    // FGA = prime net * 2,5%
    const fga = Math.round((primeNette * 0.025) * 100) / 100;
    
    // taxes = (prime net + frais) * 14%
    const taxes = Math.round(((primeNette + frais) * 0.14) * 100) / 100;
    
    // P TTC = prime net + frais + taxes + FGA
    const primeTTC = Math.round((primeNette + frais + taxes + fga) * 100) / 100;
    
    // comm = prime net * 25%
    const commission = Math.round((primeNette * 0.25) * 100) / 100;
    
    // N a V = P TTC - FRAIS - comm
    const netAVerser = Math.round((primeTTC - frais - commission) * 100) / 100;
    
    return {
        frais,
        taxes,
        fga,
        primeTTC,
        commission,
        netAVerser
    };
}

function formatBordereauDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatBordereauNumber(num) {
    const rounded = Math.round(num * 100) / 100;
    const parts = rounded.toString().split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return parts.length > 1 ? parts.join(',') : parts[0];
}

function getBordereauFilters() {
    const categorieSelect = document.getElementById('bordereauCategorie');
    const dateDebutInput = document.getElementById('bordereauDateDebut');
    const dateFinInput = document.getElementById('bordereauDateFin');

    return {
        categorie: categorieSelect ? categorieSelect.value : 'VP/CI',
        dateDebut: dateDebutInput ? dateDebutInput.value : '',
        dateFin: dateFinInput ? dateFinInput.value : '',
    };
}

async function fetchBordereauContrats() {
    if (!window.api || !window.api.contracts) {
        throw new Error('API non chargée');
    }

    const { categorie, dateDebut, dateFin } = getBordereauFilters();
    const data = await window.api.contracts.getAll({
        dateDebut,
        dateFin,
        offset: 0,
        limit: 1000,
    });

    return (data.contrats || []).filter((contrat) => {
        return contrat.categorie_vehicule === categorie || (!contrat.categorie_vehicule && categorie === 'VP/CI');
    });
}

function createBordereauRow(contrat, rowNumber) {
    const primeNette = contrat.montant || 0;
    const values = calculateContractValues(primeNette);
    const immatriculation =
        contrat.vehicules?.immatriculation ||
        (contrat.vehicules && contrat.vehicules.length > 0 ? contrat.vehicules[0].immatriculation : null) ||
        contrat.immatriculation ||
        '-';
    const nomComplet = contrat.client_nom || '';

    const row = document.createElement('tr');
    row.style.borderBottom = '1px solid var(--color-border)';
    row.innerHTML = `
        <td style="padding: 0.75rem; border: 1px solid #ddd;">${rowNumber}</td>
        <td style="padding: 0.75rem; border: 1px solid #ddd;">${contrat.numero_contrat || '-'}</td>
        <td style="padding: 0.75rem; border: 1px solid #ddd;">${nomComplet}</td>
        <td style="padding: 0.75rem; border: 1px solid #ddd;">${immatriculation}</td>
        <td style="padding: 0.75rem; border: 1px solid #ddd;">${formatBordereauDate(contrat.date_debut)}</td>
        <td style="padding: 0.75rem; border: 1px solid #ddd;">${formatBordereauDate(contrat.date_fin)}</td>
        <td style="padding: 0.75rem; border: 1px solid #ddd; text-align: right;">${formatBordereauNumber(primeNette)}</td>
        <td style="padding: 0.75rem; border: 1px solid #ddd; text-align: right;">${formatBordereauNumber(values.frais)}</td>
        <td style="padding: 0.75rem; border: 1px solid #ddd; text-align: right;">${formatBordereauNumber(values.taxes)}</td>
        <td style="padding: 0.75rem; border: 1px solid #ddd; text-align: right;">${formatBordereauNumber(values.fga)}</td>
        <td style="padding: 0.75rem; border: 1px solid #ddd; text-align: right; font-weight: bold;">${formatBordereauNumber(values.primeTTC)}</td>
        <td style="padding: 0.75rem; border: 1px solid #ddd; text-align: right;">${formatBordereauNumber(values.commission)}</td>
        <td style="padding: 0.75rem; border: 1px solid #ddd; text-align: right;">${formatBordereauNumber(values.netAVerser)}</td>
    `;

    return row;
}

function renderBordereauTableBody(contrats, startIndex = 0) {
    const tbody = document.getElementById('bordereauTableBody');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (contrats.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="13" style="padding: 2rem; text-align: center; color: var(--color-text-secondary);">
                    Aucun contrat à afficher dans le bordereau
                </td>
            </tr>
        `;
        return;
    }

    contrats.forEach((contrat, index) => {
        tbody.appendChild(createBordereauRow(contrat, startIndex + index + 1));
    });
}

// Mettre à jour le tableau du bordereau
function updateBordereauTable(nom, immatriculation, numeroPolice, dateEffet, dateEcheance, primeNette) {
    const tbody = document.getElementById('bordereauTableBody');
    if (!tbody) return;
    
    // Calculer toutes les valeurs à partir de la prime nette
    const values = calculateContractValues(primeNette);
    
    // Formater les dates
    const formatDate = formatBordereauDate;
    
    // Formater les nombres avec espaces et décimales
    const formatNumber = formatBordereauNumber;
    
    // Vérifier si la ligne existe déjà (par numéro de police)
    const existingRow = Array.from(tbody.querySelectorAll('tr')).find(row => {
        const policeCell = row.querySelector('td:nth-child(2)');
        return policeCell && policeCell.textContent.trim() === numeroPolice;
    });
    
    let rowUpdated = false;
    
    if (existingRow) {
        // Mettre à jour la ligne existante
        const cells = existingRow.querySelectorAll('td');
        // Vérifier que la ligne a bien 13 cellules (pas une ligne de totaux ou vide)
        if (cells.length >= 13 && cells[2] && cells[12]) {
            cells[2].textContent = nom;
            cells[3].textContent = immatriculation;
            cells[4].textContent = formatDate(dateEffet);
            cells[5].textContent = formatDate(dateEcheance);
            cells[6].textContent = formatNumber(primeNette);
            cells[7].textContent = formatNumber(values.frais);
            cells[8].textContent = formatNumber(values.taxes);
            cells[9].textContent = formatNumber(values.fga);
            cells[10].textContent = formatNumber(values.primeTTC);
            cells[11].textContent = formatNumber(values.commission);
            cells[12].textContent = formatNumber(values.netAVerser);
            rowUpdated = true;
        } else {
            // Si la ligne n'a pas le bon nombre de cellules, la supprimer
            existingRow.remove();
        }
    }
    
    // Si on n'a pas mis à jour de ligne existante, créer une nouvelle ligne
    if (!rowUpdated) {
        // Ajouter une nouvelle ligne
        const rowCount = tbody.querySelectorAll('tr').length;
        const row = document.createElement('tr');
        row.style.borderBottom = '1px solid var(--color-border)';
        row.innerHTML = `
            <td style="padding: 0.75rem; border: 1px solid #ddd;">${rowCount}</td>
            <td style="padding: 0.75rem; border: 1px solid #ddd;">${numeroPolice}</td>
            <td style="padding: 0.75rem; border: 1px solid #ddd;">${nom}</td>
            <td style="padding: 0.75rem; border: 1px solid #ddd;">${immatriculation}</td>
            <td style="padding: 0.75rem; border: 1px solid #ddd;">${formatDate(dateEffet)}</td>
            <td style="padding: 0.75rem; border: 1px solid #ddd;">${formatDate(dateEcheance)}</td>
            <td style="padding: 0.75rem; border: 1px solid #ddd; text-align: right;">${formatNumber(primeNette)}</td>
            <td style="padding: 0.75rem; border: 1px solid #ddd; text-align: right;">${formatNumber(values.frais)}</td>
            <td style="padding: 0.75rem; border: 1px solid #ddd; text-align: right;">${formatNumber(values.taxes)}</td>
            <td style="padding: 0.75rem; border: 1px solid #ddd; text-align: right;">${formatNumber(values.fga)}</td>
            <td style="padding: 0.75rem; border: 1px solid #ddd; text-align: right; font-weight: bold;">${formatNumber(values.primeTTC)}</td>
            <td style="padding: 0.75rem; border: 1px solid #ddd; text-align: right;">${formatNumber(values.commission)}</td>
            <td style="padding: 0.75rem; border: 1px solid #ddd; text-align: right;">${formatNumber(values.netAVerser)}</td>
        `;
        
        // Supprimer le message "vide" s'il existe
        const emptyRow = tbody.querySelector('tr td[colspan="13"]');
        if (emptyRow) {
            emptyRow.closest('tr').remove();
        }
        
        tbody.appendChild(row);
    }
    
    // Mettre à jour les totaux
    updateBordereauTotals();
}

// Mettre à jour les totaux du bordereau
function updateBordereauTotals() {
    const tbody = document.getElementById('bordereauTableBody');
    if (!tbody) return;
    
    const rows = tbody.querySelectorAll('tr');
    let totalPrimeNette = 0;
    let totalFrais = 0;
    let totalTaxes = 0;
    let totalFGA = 0;
    let totalTTC = 0;
    let totalCommission = 0;
    let totalNetAVerser = 0;
    
    let hasValidRows = false;
    
    rows.forEach(row => {
        // Ignorer la ligne de totaux et les lignes vides
        if (row.classList.contains('totals-row')) return;
        
        const cells = row.querySelectorAll('td');
        // Vérifier que c'est une ligne de données valide avec 13 cellules
        if (cells.length === 13 && cells[6] && cells[6].textContent && cells[6].textContent.trim() !== '') {
            hasValidRows = true;
            // Parser les nombres en remplaçant les espaces et les virgules par des points
            const parseNumber = (text) => {
                if (!text || text.trim() === '' || text.trim() === '-') return 0;
                return parseFloat(text.replace(/\s/g, '').replace(',', '.')) || 0;
            };
            totalPrimeNette += parseNumber(cells[6].textContent);
            totalFrais += parseNumber(cells[7].textContent);
            totalTaxes += parseNumber(cells[8].textContent);
            totalFGA += parseNumber(cells[9].textContent);
            totalTTC += parseNumber(cells[10].textContent);
            totalCommission += parseNumber(cells[11].textContent);
            totalNetAVerser += parseNumber(cells[12].textContent);
        }
    });
    
    // Vérifier si la ligne de totaux existe
    let totalsRow = tbody.querySelector('tr.totals-row');
    // Ne créer la ligne de totaux que s'il y a des lignes de données valides
    if (!totalsRow && hasValidRows) {
        totalsRow = document.createElement('tr');
        totalsRow.className = 'totals-row';
        totalsRow.style.backgroundColor = '#F3F4F6';
        totalsRow.style.fontWeight = 'bold';
        totalsRow.innerHTML = `
            <td colspan="6" style="padding: 0.75rem; border: 1px solid #ddd; text-align: right;"><strong>TOTAL</strong></td>
            <td style="padding: 0.75rem; border: 1px solid #ddd; text-align: right;">0</td>
            <td style="padding: 0.75rem; border: 1px solid #ddd; text-align: right;">0</td>
            <td style="padding: 0.75rem; border: 1px solid #ddd; text-align: right;">0</td>
            <td style="padding: 0.75rem; border: 1px solid #ddd; text-align: right;">0</td>
            <td style="padding: 0.75rem; border: 1px solid #ddd; text-align: right;">0</td>
            <td style="padding: 0.75rem; border: 1px solid #ddd; text-align: right;">0</td>
            <td style="padding: 0.75rem; border: 1px solid #ddd; text-align: right;">0</td>
        `;
        tbody.appendChild(totalsRow);
    }
    
    if (totalsRow) {
        const formatNumber = formatBordereauNumber;
        
        const cells = Array.from(totalsRow.querySelectorAll('td'));
        // La ligne de totaux a 8 cellules : 1 avec colspan="6" (indice 0) + 7 cellules numériques (indices 1-7)
        // Vérifier chaque cellule individuellement avant d'y accéder pour éviter les erreurs
        if (cells && cells.length >= 8) {
            try {
                if (cells[1]) cells[1].textContent = formatNumber(totalPrimeNette);
                if (cells[2]) cells[2].textContent = formatNumber(totalFrais);
                if (cells[3]) cells[3].textContent = formatNumber(totalTaxes);
                if (cells[4]) cells[4].textContent = formatNumber(totalFGA);
                if (cells[5]) cells[5].textContent = formatNumber(totalTTC);
                if (cells[6]) cells[6].textContent = formatNumber(totalCommission);
                if (cells[7]) cells[7].textContent = formatNumber(totalNetAVerser);
            } catch (error) {
                console.error('Erreur lors de la mise à jour des totaux:', error);
            }
        }
    }
}

// Charger les contrats dans le bordereau avec pagination à l'écran
async function loadBordereau() {
    try {
        const filters = getBordereauFilters();
        const filterKey = JSON.stringify(filters);
        if (bordereauLastFilters !== filterKey) {
            bordereauCurrentPage = 1;
            bordereauLastFilters = filterKey;
        }

        const { categorie } = filters;

        const categorieDisplay = document.getElementById('bordereauCategorieDisplay');
        if (categorieDisplay) {
            categorieDisplay.textContent = categorie;
        }

        bordereauAllContrats = await fetchBordereauContrats();
        const offset = (bordereauCurrentPage - 1) * bordereauClientsPerPage;
        const paginatedContrats = bordereauAllContrats.slice(offset, offset + bordereauClientsPerPage);

        renderBordereauTableBody(paginatedContrats, offset);
        updateBordereauTotals();
        updateBordereauPagination(bordereauAllContrats.length);
    } catch (error) {
        console.error('Erreur lors du chargement du bordereau:', error);
        if (typeof window.showToast === 'function') {
            window.showToast('Erreur lors du chargement du bordereau: ' + (error.message || 'Erreur inconnue'), 'error');
        }
    }
}

async function renderBordereauForOutput() {
    const contrats = await fetchBordereauContrats();

    if (contrats.length === 0) {
        if (typeof window.showToast === 'function') {
            window.showToast('Aucun contrat à exporter pour cette période', 'info');
        }
        return false;
    }

    renderBordereauTableBody(contrats, 0);
    updateBordereauTotals();
    return true;
}

function restoreBordereauViewAfterOutput() {
    loadBordereau();
}

// Imprimer le bordereau (tous les contrats de la période sélectionnée)
async function printBordereau() {
    const savedPage = bordereauCurrentPage;

    try {
        const hasData = await renderBordereauForOutput();
        if (!hasData) return;

        const restore = () => {
            bordereauCurrentPage = savedPage;
            restoreBordereauViewAfterOutput();
            window.removeEventListener('afterprint', restore);
        };

        window.addEventListener('afterprint', restore, { once: true });
        window.print();
    } catch (error) {
        console.error('Erreur lors de l\'impression du bordereau:', error);
        bordereauCurrentPage = savedPage;
        restoreBordereauViewAfterOutput();
        if (typeof window.showToast === 'function') {
            window.showToast('Erreur lors de l\'impression du bordereau: ' + (error.message || 'Erreur inconnue'), 'error');
        }
    }
}

// Exporter le bordereau (tous les contrats de la période sélectionnée)
async function exportBordereau() {
    await printBordereau();
}

// Fonction de mise à jour de la pagination du bordereau
function updateBordereauPagination(total) {
    const totalPages = Math.ceil(total / bordereauClientsPerPage);
    const pageInfo = document.getElementById('bordereauPageInfo');
    const prevBtn = document.getElementById('bordereauPrevPage');
    const nextBtn = document.getElementById('bordereauNextPage');
    
    if (pageInfo) {
        pageInfo.textContent = `Page ${bordereauCurrentPage} sur ${totalPages}`;
    }
    
    if (prevBtn) {
        prevBtn.disabled = bordereauCurrentPage <= 1;
    }
    
    if (nextBtn) {
        nextBtn.disabled = bordereauCurrentPage >= totalPages || totalPages === 0;
    }
}

// Gestionnaires d'événements pour la pagination du bordereau
document.addEventListener('DOMContentLoaded', function() {
    const prevBtn = document.getElementById('bordereauPrevPage');
    const nextBtn = document.getElementById('bordereauNextPage');
    
    if (prevBtn) {
        prevBtn.addEventListener('click', function() {
            if (bordereauCurrentPage > 1) {
                bordereauCurrentPage--;
                loadBordereau();
            }
        });
    }
    
    if (nextBtn) {
        nextBtn.addEventListener('click', function() {
            const totalPages = Math.ceil(bordereauAllContrats.length / bordereauClientsPerPage);
            if (bordereauCurrentPage < totalPages) {
                bordereauCurrentPage++;
                loadBordereau();
            }
        });
    }
});
