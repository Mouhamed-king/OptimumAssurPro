// ============================================
// GESTION DU BORDEREAU DYNAMIQUE
// ============================================

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
    // Frais fixes (constant)
    const frais = 3000;
    
    // Calculer FGA (2.5% de la prime nette)
    const fga = Math.round((primeNette * 0.025) * 100) / 100;
    
    // Calculer Prime TTC d'abord (pour déterminer les taxes)
    // Les taxes sont calculées de manière à ce que P. TTC = P. Nette + Frais + Taxes + FGA
    // D'après les données réelles, les taxes semblent être calculées sur (P. Nette + Frais)
    // Formule déduite: Taxes ≈ (P. Nette + Frais) × taux - ajustement
    // En analysant: Taxes = P. TTC - P. Nette - Frais - FGA
    // Pour calculer P. TTC, on utilise: P. TTC = (P. Nette + Frais) × 1.18 + FGA (approximation)
    // Mais d'après les données réelles, on calcule d'abord P. TTC puis on déduit les taxes
    
    // Calculer Prime TTC (basée sur les données réelles analysées)
    // Formule observée: P. TTC = (P. Nette + Frais) × 1.14 + FGA
    const primeTTC = Math.round(((primeNette + frais) * 1.14 + fga) * 100) / 100;
    
    // Calculer les taxes à partir de P. TTC
    // Taxes = P. TTC - P. Nette - Frais - FGA
    const taxes = Math.round((primeTTC - primeNette - frais - fga) * 100) / 100;
    
    // Calculer Commission (25% de la prime nette)
    const commission = Math.round((primeNette * 0.25) * 100) / 100;
    
    // Calculer Net à verser
    // D'après les données réelles analysées: N à V = P. Nette - Comm + Frais - (Taxes + FGA) / 2
    // Formule observée: N à V ≈ P. Nette - Comm + Frais - (Taxes + FGA) / 2 (avec arrondi)
    const netAVerser = Math.round((primeNette - commission + frais - (taxes + fga) / 2) * 100) / 100;
    
    return {
        frais,
        taxes,
        fga,
        primeTTC,
        commission,
        netAVerser
    };
}

// Mettre à jour le tableau du bordereau
function updateBordereauTable(nom, immatriculation, numeroPolice, dateEffet, dateEcheance, primeNette) {
    const tbody = document.getElementById('bordereauTableBody');
    if (!tbody) return;
    
    // Calculer toutes les valeurs à partir de la prime nette
    const values = calculateContractValues(primeNette);
    
    // Formater les dates
    const formatDate = (dateStr) => {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    };
    
    // Formater les nombres avec espaces et décimales
    const formatNumber = (num) => {
        // Arrondir à 2 décimales
        const rounded = Math.round(num * 100) / 100;
        // Formater avec espaces pour les milliers et garder les décimales
        const parts = rounded.toString().split('.');
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
        return parts.length > 1 ? parts.join(',') : parts[0];
    };
    
    // Vérifier si la ligne existe déjà (par numéro de police)
    const existingRow = Array.from(tbody.querySelectorAll('tr')).find(row => {
        const policeCell = row.querySelector('td:nth-child(2)');
        return policeCell && policeCell.textContent.trim() === numeroPolice;
    });
    
    if (existingRow) {
        // Mettre à jour la ligne existante
        const cells = existingRow.querySelectorAll('td');
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
    } else {
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
    
    rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length === 13) {
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
    if (!totalsRow && rows.length > 0) {
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
        // Formater les nombres avec espaces et décimales
        const formatNumber = (num) => {
            // Arrondir à 2 décimales
            const rounded = Math.round(num * 100) / 100;
            // Formater avec espaces pour les milliers et garder les décimales
            const parts = rounded.toString().split('.');
            parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
            return parts.length > 1 ? parts.join(',') : parts[0];
        };
        const cells = totalsRow.querySelectorAll('td');
        // La ligne de totaux a 8 cellules : 1 avec colspan="6" (indice 0) + 7 cellules numériques (indices 1-7)
        if (cells.length >= 8) {
            cells[1].textContent = formatNumber(totalPrimeNette);
            cells[2].textContent = formatNumber(totalFrais);
            cells[3].textContent = formatNumber(totalTaxes);
            cells[4].textContent = formatNumber(totalFGA);
            cells[5].textContent = formatNumber(totalTTC);
            cells[6].textContent = formatNumber(totalCommission);
            cells[7].textContent = formatNumber(totalNetAVerser);
        }
    }
}

// Charger tous les contrats dans le bordereau
async function loadBordereau() {
    try {
        // Vérifier que l'API est chargée
        if (!window.api || !window.api.contracts) {
            throw new Error('API non chargée');
        }
        
        const data = await window.api.contracts.getAll();
        const contrats = data.contrats || [];
        
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
            const primeNette = contrat.montant || 0;
            
            // Calculer toutes les valeurs à partir de la prime nette
            const values = calculateContractValues(primeNette);
            
            const formatDate = (dateStr) => {
                if (!dateStr) return '';
                const date = new Date(dateStr);
                return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
            };
            
            // Formater les nombres avec espaces et décimales
            const formatNumber = (num) => {
                // Arrondir à 2 décimales
                const rounded = Math.round(num * 100) / 100;
                // Formater avec espaces pour les milliers et garder les décimales
                const parts = rounded.toString().split('.');
                parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
                return parts.length > 1 ? parts.join(',') : parts[0];
            };
            
            // Récupérer l'immatriculation depuis les véhicules
            const immatriculation = contrat.vehicules?.immatriculation || (contrat.vehicules && contrat.vehicules.length > 0 ? contrat.vehicules[0].immatriculation : null) || contrat.immatriculation || '-';
            
            // Récupérer le nom complet du client (nom seul, sans prénom)
            const nomComplet = contrat.client_nom || '';
            
            const row = document.createElement('tr');
            row.style.borderBottom = '1px solid var(--color-border)';
            row.innerHTML = `
                <td style="padding: 0.75rem; border: 1px solid #ddd;">${index + 1}</td>
                <td style="padding: 0.75rem; border: 1px solid #ddd;">${contrat.numero_contrat || '-'}</td>
                <td style="padding: 0.75rem; border: 1px solid #ddd;">${nomComplet}</td>
                <td style="padding: 0.75rem; border: 1px solid #ddd;">${immatriculation}</td>
                <td style="padding: 0.75rem; border: 1px solid #ddd;">${formatDate(contrat.date_debut)}</td>
                <td style="padding: 0.75rem; border: 1px solid #ddd;">${formatDate(contrat.date_fin)}</td>
                <td style="padding: 0.75rem; border: 1px solid #ddd; text-align: right;">${formatNumber(primeNette)}</td>
                <td style="padding: 0.75rem; border: 1px solid #ddd; text-align: right;">${formatNumber(values.frais)}</td>
                <td style="padding: 0.75rem; border: 1px solid #ddd; text-align: right;">${formatNumber(values.taxes)}</td>
                <td style="padding: 0.75rem; border: 1px solid #ddd; text-align: right;">${formatNumber(values.fga)}</td>
                <td style="padding: 0.75rem; border: 1px solid #ddd; text-align: right; font-weight: bold;">${formatNumber(values.primeTTC)}</td>
                <td style="padding: 0.75rem; border: 1px solid #ddd; text-align: right;">${formatNumber(values.commission)}</td>
                <td style="padding: 0.75rem; border: 1px solid #ddd; text-align: right;">${formatNumber(values.netAVerser)}</td>
            `;
            tbody.appendChild(row);
        });
        
        updateBordereauTotals();
    } catch (error) {
        console.error('Erreur lors du chargement du bordereau:', error);
        if (typeof window.showToast === 'function') {
            window.showToast('Erreur lors du chargement du bordereau: ' + (error.message || 'Erreur inconnue'), 'error');
        }
    }
}

// Imprimer le bordereau
function printBordereau() {
    // Utiliser window.print() directement pour utiliser les styles @media print
    window.print();
}

// Exporter le bordereau
function exportBordereau() {
    // Pour l'instant, on utilise print
    // Plus tard, on pourra ajouter l'export PDF
    printBordereau();
}

