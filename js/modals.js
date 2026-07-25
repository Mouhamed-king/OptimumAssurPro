// ============================================
// GESTION DES MODAUX ET FORMULAIRES
// ============================================

let currentEditingClientId = null;
let currentEditingContractId = null;
let currentClientVehicles = [];

function formatDetailValue(value, fallback = 'Non renseigné') {
    if (value === null || value === undefined || String(value).trim() === '') {
        return typeof window.escapeHtml === 'function' ? window.escapeHtml(fallback) : fallback;
    }
    return typeof window.escapeHtml === 'function' ? window.escapeHtml(value) : value;
}

function formatVehicleTypeLabel(type) {
    const labels = {
        moto: 'Moto / 2 roues',
        camionnette: 'Camionnette',
        camion: 'Camion',
        break: 'Break',
        particulier: 'Véhicule particulier',
        non_renseigne: 'Non renseigné'
    };
    return labels[type] || type || 'Non renseigné';
}

function inferVehicleType(vehicule = {}) {
    if (vehicule.type_vehicule) {
        return formatVehicleTypeLabel(vehicule.type_vehicule);
    }

    const combined = [vehicule.modele, vehicule.marque]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

    if (!combined) return 'Non renseigné';
    if (combined.includes('moto') || combined.includes('yamaha') || (combined.includes('honda') && combined.includes('sh'))) {
        return formatVehicleTypeLabel('moto');
    }
    if (combined.includes('break') || combined.includes('wagon')) {
        return formatVehicleTypeLabel('break');
    }
    if (combined.includes('camionnette') || combined.includes('pickup') || combined.includes('pick-up')) {
        return formatVehicleTypeLabel('camionnette');
    }
    if (combined.includes('camion') || combined.includes('truck')) {
        return formatVehicleTypeLabel('camion');
    }
    return formatVehicleTypeLabel('particulier');
}

function renderVehicleDetailsHtml(vehicule) {
    const marque = formatDetailValue(vehicule.marque);
    const modele = formatDetailValue(vehicule.modele);
    const immat = formatDetailValue(vehicule.immatriculation);
    const type = inferVehicleType(vehicule);
    const puissance = vehicule.puissance ? `${vehicule.puissance} CV` : 'Non renseigné';
    const energie = formatDetailValue(vehicule.energie);

    return `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 0.5rem 1rem; margin-top: 0.5rem;">
            <p style="margin: 0;"><strong>Marque:</strong> ${marque}</p>
            <p style="margin: 0;"><strong>Modèle:</strong> ${modele}</p>
            <p style="margin: 0;"><strong>Type:</strong> ${type}</p>
            <p style="margin: 0;"><strong>Puissance:</strong> ${puissance}</p>
            <p style="margin: 0;"><strong>Énergie:</strong> ${energie}</p>
            <p style="margin: 0;"><strong>Immatriculation:</strong> ${immat}</p>
            ${vehicule.annee ? `<p style="margin: 0;"><strong>Année:</strong> ${vehicule.annee}</p>` : ''}
            ${vehicule.couleur ? `<p style="margin: 0;"><strong>Couleur:</strong> ${vehicule.couleur}</p>` : ''}
        </div>
    `;
}

// ============================================
// MODAL CLIENT
// ============================================

function openAddClientModal() {
    currentEditingClientId = null;
    currentClientVehicles = [];
    document.getElementById('clientModalTitle').textContent = 'Ajouter un client avec contrat';
    document.getElementById('clientForm').reset();
    document.getElementById('clientId').value = '';
    const selectionGroup = document.getElementById('vehiculeSelectionGroup');
    if (selectionGroup) selectionGroup.style.display = 'none';
    
    // Réinitialiser les champs du contrat avec dates par défaut
    const today = new Date();
    const nextMonth = new Date();
    nextMonth.setMonth(today.getMonth() + 1);
    
    if (document.getElementById('contractDateEffet')) {
        document.getElementById('contractDateEffet').valueAsDate = today;
    }
    if (document.getElementById('contractDateEcheance')) {
        document.getElementById('contractDateEcheance').valueAsDate = nextMonth;
    }
    
    // Réinitialiser les champs de paiement
    if (document.getElementById('contractMontantPaye')) {
        document.getElementById('contractMontantPaye').value = '';
    }
    if (document.getElementById('contractMontantRestant')) {
        document.getElementById('contractMontantRestant').value = '';
    }
    
    // Retirer l'événement oninput du champ montant payé qui calculait automatiquement
    const montantPayeInput = document.getElementById('contractMontantPaye');
    if (montantPayeInput) {
        montantPayeInput.oninput = function() {
            if (typeof updateBordereau === 'function') {
                updateBordereau();
            }
        };
    }
    
    document.getElementById('clientModal').classList.add('show');
}

function openEditClientModal(clientId) {
    currentEditingClientId = clientId;
    document.getElementById('clientModalTitle').textContent = 'Modifier le client';
    
    // Charger les données du client avec véhicules et contrats
    // Vérifier que l'API est chargée
    try {
        if (!window.api || !window.api.clients) {
            throw new Error('API non chargée');
        }
    } catch (error) {
        (typeof window.showToast === 'function' ? window.showToast : console.log)('Erreur: API non chargée', 'error');
        return;
    }
    
    window.api.clients.getById(clientId)
        .then(data => {
            const client = data.client;
            
            // Remplir les champs du client
            document.getElementById('clientId').value = client.id;
            document.getElementById('clientNom').value = client.nom || '';
            document.getElementById('clientTelephone').value = client.telephone || '';
            
            // Récupérer le premier véhicule (le plus récent ou le premier)
            currentClientVehicles = client.vehicules || [];
            const selection = document.getElementById('vehiculeSelection');
            const selectionGroup = document.getElementById('vehiculeSelectionGroup');
            if (selection && selectionGroup) {
                selectionGroup.style.display = 'block';
                selection.innerHTML = currentClientVehicles
                    .map(v => `<option value="${v.id}">${formatDetailValue(v.immatriculation)} — ${formatDetailValue(v.marque)} ${formatDetailValue(v.modele, '')}</option>`)
                    .join('');
                selection.insertAdjacentHTML('beforeend', '<option value="new">+ Ajouter un véhicule</option>');
            }
            fillClientVehicleFields(currentClientVehicles[0] || null);
            
            // Récupérer le dernier contrat (le plus récent)
            const contrat = client.contrats && client.contrats.length > 0 
                ? client.contrats.reduce((latest, c) => {
                    return new Date(c.date_fin) > new Date(latest.date_fin) ? c : latest;
                }, client.contrats[0])
                : null;
            
            if (contrat) {
                // Le numéro de police peut être dans numero_contrat ou numero_police
                const numeroPolice = contrat.numero_police || contrat.numero_contrat || '';
                document.getElementById('contractNumeroPolice').value = numeroPolice;
                
                // Formater les dates pour les champs input[type="date"]
                const formatDateForInput = (dateStr) => {
                    if (!dateStr) return '';
                    const date = new Date(dateStr);
                    const year = date.getFullYear();
                    const month = String(date.getMonth() + 1).padStart(2, '0');
                    const day = String(date.getDate()).padStart(2, '0');
                    return `${year}-${month}-${day}`;
                };
                
                document.getElementById('contractDateEffet').value = formatDateForInput(contrat.date_debut);
                document.getElementById('contractDateEcheance').value = formatDateForInput(contrat.date_fin);
                document.getElementById('contractPrimeNette').value = contrat.montant || '';
                document.getElementById('contractMontantPaye').value = contrat.montant_paye || 0;
                document.getElementById('contractMontantRestant').value = contrat.montant_restant || 0;
                const categorieSelect = document.getElementById('categorieVehicule');
                if (categorieSelect) {
                    categorieSelect.value = contrat.categorie_vehicule || 'VP/CI';
                }
            }
            
            document.getElementById('clientModal').classList.add('show');
        })
        .catch(error => {
            (typeof window.showToast === 'function' ? window.showToast : console.log)('Erreur lors du chargement du client', 'error');
        });
}

function closeClientModal() {
    document.getElementById('clientModal').classList.remove('show');
    currentEditingClientId = null;
}

function fillClientVehicleFields(vehicule) {
    document.getElementById('vehiculeImmatriculation').value = vehicule?.immatriculation || '';
    document.getElementById('vehiculeMarque').value = vehicule?.marque?.startsWith('Non renseign') ? '' : (vehicule?.marque || '');
    document.getElementById('vehiculeModele').value = vehicule?.modele?.startsWith('Non renseign') ? '' : (vehicule?.modele || '');
}

function selectClientVehicle(vehicleId) {
    fillClientVehicleFields(currentClientVehicles.find(v => String(v.id) === String(vehicleId)) || null);
}

// Fonction supprimée - le montant restant est maintenant saisi manuellement

function toggleVehiculeFields() {
    const checkbox = document.getElementById('addVehicule');
    const fields = document.getElementById('vehiculeFields');
    fields.style.display = checkbox.checked ? 'block' : 'none';
    
    if (!checkbox.checked) {
        // Réinitialiser les champs véhicule
        document.getElementById('vehiculeMarque').value = '';
        document.getElementById('vehiculeModele').value = '';
        document.getElementById('vehiculeImmatriculation').value = '';
        document.getElementById('vehiculeAnnee').value = '';
        document.getElementById('vehiculeCouleur').value = '';
    }
}

async function saveClient(event) {
    event.preventDefault();
    
    // Récupérer uniquement les champs essentiels
    const nom = document.getElementById('clientNom').value.trim();
    const telephone = document.getElementById('clientTelephone').value.trim();
    const numeroPolice = document.getElementById('contractNumeroPolice').value.trim();
    const immatriculation = document.getElementById('vehiculeImmatriculation').value.trim();
    const marque = document.getElementById('vehiculeMarque').value.trim();
    const modele = document.getElementById('vehiculeModele').value.trim();
    const selectedVehicleId = document.getElementById('vehiculeSelection')?.value;
    const categorieVehicule = document.getElementById('categorieVehicule')?.value || 'VP/CI';
    const dateEffet = document.getElementById('contractDateEffet').value;
    const dateEcheance = document.getElementById('contractDateEcheance').value;
    const primeNetteValue = document.getElementById('contractPrimeNette').value;
    const primeNette = parseFloat(primeNetteValue);
    const montantPaye = parseFloat(document.getElementById('contractMontantPaye').value) || 0;
    const montantRestant = parseFloat(document.getElementById('contractMontantRestant').value) || 0;
    
    const isEditing = Boolean(currentEditingClientId);

    // Validation
    if (!nom || !telephone) {
        (typeof window.showToast === 'function' ? window.showToast : console.log)('Veuillez remplir tous les champs obligatoires', 'error');
        return;
    }

    if (!isEditing && (!numeroPolice || !immatriculation || !categorieVehicule || !dateEffet || !dateEcheance || !primeNette || primeNette <= 0)) {
        (typeof window.showToast === 'function' ? window.showToast : console.log)('Veuillez remplir tous les champs obligatoires', 'error');
        return;
    }
    
    // Validation des montants
    if (montantPaye < 0) {
        (typeof window.showToast === 'function' ? window.showToast : console.log)('Le montant payé ne peut pas être négatif', 'error');
        return;
    }
    
    if (montantRestant < 0) {
        (typeof window.showToast === 'function' ? window.showToast : console.log)('Le montant restant ne peut pas être négatif', 'error');
        return;
    }
    
    // Calculer la durée en mois
    const dateEffetObj = new Date(dateEffet);
    const dateEcheanceObj = new Date(dateEcheance);
    const diffTime = Math.abs(dateEcheanceObj - dateEffetObj);
    const diffMonths = dateEffet && dateEcheance
        ? Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 30))
        : 12;
    
    // Préparer les données pour l'API
    const formData = {
        nom: nom,
        prenom: '', // Vide car on ne demande que le nom complet
        telephone: telephone, // Téléphone fourni par l'utilisateur
        vehicule: {
            id: isEditing && selectedVehicleId && selectedVehicleId !== 'new' ? selectedVehicleId : undefined,
            is_new: isEditing && selectedVehicleId === 'new',
            immatriculation: immatriculation,
            marque: marque,
            modele: modele
        },
        contrat: {
            numero_police: numeroPolice,
            date_debut: dateEffet,
            date_fin: dateEcheance,
            duree_mois: diffMonths,
            montant: primeNette,
            montant_paye: montantPaye,
            montant_restant: montantRestant,
            categorie_vehicule: categorieVehicule
        }
    };

    const hasCompleteContract = numeroPolice && dateEffet && dateEcheance && Number.isFinite(primeNette) && primeNette > 0;
    if (isEditing) {
        if (!immatriculation) {
            delete formData.vehicule;
        }
        if (!hasCompleteContract) {
            delete formData.contrat;
        }
    }
    
    try {
        // Vérifier que l'API est chargée
        if (!window.api || !window.api.clients) {
            throw new Error('API non chargée');
        }
        
        if (currentEditingClientId) {
            // Modifier (sans créer de nouveau contrat)
            const result = await window.api.clients.update(currentEditingClientId, formData);
            (typeof window.showToast === 'function' ? window.showToast : console.log)('Client modifié avec succès', 'success');
        } else {
            // Créer client avec véhicule et contrat
            const result = await window.api.clients.create(formData);
            (typeof window.showToast === 'function' ? window.showToast : console.log)(result.message || 'Client et contrat créés avec succès', 'success');
            
            // Recharger le bordereau
            if (typeof loadBordereau === 'function') {
                setTimeout(() => loadBordereau(), 500);
            }
        }
        
        closeClientModal();
        loadClients();
        loadDashboard(); // Recharger le dashboard pour mettre à jour les stats
    } catch (error) {
        console.error('Erreur lors de la sauvegarde du client');
        (typeof window.showToast === 'function' ? window.showToast : console.log)(error.message || 'Erreur lors de la sauvegarde', 'error');
    }
}

async function viewClient(id) {
    try {
        // Vérifier que l'API est chargée
        if (!window.api || !window.api.clients) {
            throw new Error('API non chargée');
        }
        
        const data = await window.api.clients.getById(id);
        const client = data.client;
        
        const vehiculesHtml = client.vehicules && client.vehicules.length > 0
            ? client.vehicules.map(v => `
                <div style="margin-bottom: 1rem; padding: 1rem; background: #F3F4F6; border-radius: 8px;">
                    <strong style="display: block; margin-bottom: 0.25rem;">${formatDetailValue(v.marque, 'Véhicule')} ${formatDetailValue(v.modele, '')}</strong>
                    ${renderVehicleDetailsHtml(v)}
                </div>
            `).join('')
            : '<p>Aucun véhicule enregistré</p>';
        
        const contratsHtml = client.contrats && client.contrats.length > 0
            ? client.contrats.map(c => {
                const montantPaye = parseFloat(c.montant_paye) || 0;
                const montantRestant = parseFloat(c.montant_restant) || 0;
                const montantTotal = parseFloat(c.montant) || 0;
                const hasRestant = montantRestant > 0;
                
                return `
                <div style="margin-bottom: 1rem; padding: 1rem; background: #F3F4F6; border-radius: 8px;">
                    <strong>${formatDetailValue(c.numero_contrat)}</strong><br>
                    Type: ${formatDetailValue(c.type_contrat)}<br>
                    Catégorie: ${formatDetailValue(c.categorie_vehicule)}<br>
                    Durée: ${c.duree_mois} mois<br>
                    Du ${formatDate(c.date_debut)} au ${formatDate(c.date_fin)}<br>
                    ${c.vehicules ? `<div style="margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid #E5E7EB;"><strong>Véhicule associé</strong>${renderVehicleDetailsHtml(c.vehicules)}</div>` : ''}
                    <div style="margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px solid #E5E7EB;">
                        <strong>Paiements:</strong><br>
                        Montant total: <strong>${montantTotal.toLocaleString()} FCFA</strong><br>
                        Montant payé: <span style="color: #10B981;">${montantPaye.toLocaleString()} FCFA</span><br>
                        Montant restant: <span style="color: ${hasRestant ? '#F59E0B' : '#10B981'};">${montantRestant.toLocaleString()} FCFA</span>
                    </div>
                    Statut: <span class="badge badge-${c.statut === 'actif' ? 'success' : c.statut === 'expire' ? 'danger' : 'warning'}">${c.statut}</span>
                    <br><br>
                    <div style="display: flex; gap: 0.5rem; margin-top: 0.5rem;">
                        <button class="btn-primary" onclick="updatePayment(${c.id}, ${montantTotal}, ${montantPaye}, ${montantRestant})" style="flex: 1;">
                            <i class="fas fa-money-bill-wave"></i> Paiement
                        </button>
                        <button class="btn-secondary" onclick="openEditContractModal(${c.id})" style="flex: 1;">
                            <i class="fas fa-edit"></i> Modifier
                        </button>
                        <button class="btn-primary" onclick="renewContract(${c.id})" style="flex: 1;">
                            <i class="fas fa-rotate"></i> Renouveler
                        </button>
                    </div>
                </div>
            `;
            }).join('')
            : '<p>Aucun contrat enregistré</p>';
        
        const viewContent = document.getElementById('viewClientContent');
        viewContent.setAttribute('data-client-id', client.id);
        viewContent.innerHTML = `
            <div style="margin-bottom: 1.5rem;">
                <h3 style="margin-bottom: 1rem;">Informations personnelles</h3>
                <p><strong>Nom:</strong> ${formatDetailValue(client.nom)} ${formatDetailValue(client.prenom, '')}</p>
                <p><strong>Téléphone:</strong> ${formatDetailValue(client.telephone)}</p>
                ${client.email ? `<p><strong>Email:</strong> ${formatDetailValue(client.email)}</p>` : ''}
                ${client.adresse ? `<p><strong>Adresse:</strong> ${formatDetailValue(client.adresse)}</p>` : ''}
                <p><strong>Date d'inscription:</strong> ${formatDate(client.created_at)}</p>
            </div>
            <div style="margin-bottom: 1.5rem;">
                <h3 style="margin-bottom: 1rem;">Véhicules</h3>
                ${vehiculesHtml}
            </div>
            <div>
                <h3 style="margin-bottom: 1rem;">Contrats</h3>
                ${contratsHtml}
            </div>
        `;
        
        document.getElementById('viewClientModal').classList.add('show');
    } catch (error) {
        (typeof window.showToast === 'function' ? window.showToast : console.log)('Erreur lors du chargement', 'error');
    }
}

function closeViewClientModal() {
    document.getElementById('viewClientModal').classList.remove('show');
}

// Mettre à jour le paiement restant
async function updatePayment(contratId, montantTotal, montantPayeActuel, montantRestantActuel) {
    // Créer un formulaire simple pour saisir les deux montants
    const nouveauMontantPaye = prompt(`Montant total: ${montantTotal.toLocaleString()} FCFA\nMontant déjà payé: ${montantPayeActuel.toLocaleString()} FCFA\nMontant restant actuel: ${montantRestantActuel.toLocaleString()} FCFA\n\nEntrez le nouveau montant payé (FCFA):`, montantPayeActuel);
    
    if (!nouveauMontantPaye || nouveauMontantPaye === null) {
        return;
    }
    
    const montantPaye = parseFloat(nouveauMontantPaye);
    
    if (isNaN(montantPaye) || montantPaye < 0) {
        (typeof window.showToast === 'function' ? window.showToast : console.log)('Le montant payé ne peut pas être négatif', 'error');
        return;
    }
    
    const nouveauMontantRestant = prompt(`Entrez le nouveau montant restant (FCFA):\n\nNote: Le prix demandé peut varier, donc le montant restant peut être différent de (Total - Payé)`, montantRestantActuel);
    
    if (!nouveauMontantRestant || nouveauMontantRestant === null) {
        return;
    }
    
    const montantRestant = parseFloat(nouveauMontantRestant);
    
    if (isNaN(montantRestant) || montantRestant < 0) {
        (typeof window.showToast === 'function' ? window.showToast : console.log)('Le montant restant ne peut pas être négatif', 'error');
        return;
    }
    
    try {
        const response = await fetch(`${window.API_BASE_URL || window.location.origin + '/api'}/contracts/${contratId}/payment`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token') || sessionStorage.getItem('token')}`
            },
            body: JSON.stringify({ 
                montant_paye: montantPaye,
                montant_restant: montantRestant
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            (typeof window.showToast === 'function' ? window.showToast : console.log)('Paiement mis à jour avec succès', 'success');
            // Recharger les données du client
            const clientId = document.getElementById('viewClientContent').getAttribute('data-client-id');
            if (clientId) {
                viewClient(clientId);
            }
            // Recharger les clients et le dashboard
            loadClients();
            loadDashboard();
            if (typeof loadRapports === 'function') {
                loadRapports();
            }
        } else {
            (typeof window.showToast === 'function' ? window.showToast : console.log)('Erreur lors de la mise à jour du paiement', 'error');
        }
    } catch (error) {
        console.error('Erreur lors de la mise à jour du paiement:');
        (typeof window.showToast === 'function' ? window.showToast : console.log)('Erreur lors de la mise à jour du paiement', 'error');
    }
}

// ============================================
// MODAL CONTRAT
// ============================================

async function openAddContractModal() {
    currentEditingContractId = null;
    document.getElementById('contractModalTitle').textContent = 'Nouveau contrat';
    document.getElementById('contractForm').reset();
    document.getElementById('contractId').value = '';
    document.getElementById('contractClient').disabled = false;
    document.getElementById('contractVehicule').disabled = false;
    
    // Charger la liste des clients
    try {
        // Vérifier que l'API est chargée
        if (!window.api || !window.api.clients) {
            throw new Error('API non chargée');
        }
        
        const data = await window.api.clients.getAll();
        const select = document.getElementById('contractClient');
        select.innerHTML = '<option value="">Sélectionner un client</option>';
        
        data.clients.forEach(client => {
            const option = document.createElement('option');
            option.value = client.id;
            option.textContent = `${client.nom} ${client.prenom}`;
            select.appendChild(option);
        });
        
        document.getElementById('contractDateDebut').valueAsDate = new Date();
        document.getElementById('contractModal').classList.add('show');
    } catch (error) {
        (typeof window.showToast === 'function' ? window.showToast : console.log)('Erreur lors du chargement des clients', 'error');
    }
}

async function openEditContractModal(contractId) {
    currentEditingContractId = contractId;
    document.getElementById('contractModalTitle').textContent = 'Modifier le contrat / Renouveler';
    document.getElementById('contractForm').reset();
    
    try {
        if (!window.api || !window.api.contracts) throw new Error('API non chargée');
        
        const data = await window.api.contracts.getById(contractId);
        const contrat = data.contrat;
        
        // Charger la liste des clients et sélectionner le bon
        const clientsData = await window.api.clients.getAll();
        const clientSelect = document.getElementById('contractClient');
        clientSelect.innerHTML = '<option value="">Sélectionner un client</option>';
        clientsData.clients.forEach(client => {
            const option = document.createElement('option');
            option.value = client.id;
            option.textContent = `${client.nom} ${client.prenom}`;
            if (client.id === contrat.client_id) option.selected = true;
            clientSelect.appendChild(option);
        });
        clientSelect.disabled = true;
        
        // Charger la liste des véhicules pour ce client et sélectionner le bon
        await loadClientVehicules(contrat.client_id);
        const vehiculeSelect = document.getElementById('contractVehicule');
        for (let i = 0; i < vehiculeSelect.options.length; i++) {
            if (parseInt(vehiculeSelect.options[i].value) === contrat.vehicule_id) {
                vehiculeSelect.selectedIndex = i;
                break;
            }
        }
        vehiculeSelect.disabled = true;
        
        // Remplir les autres champs
        document.getElementById('contractId').value = contrat.id;
        document.getElementById('contractType').value = contrat.type_contrat;
        document.getElementById('contractDuree').value = contrat.duree_mois;
        
        // Formater date
        if (contrat.date_debut) {
            const date = new Date(contrat.date_debut);
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            document.getElementById('contractDateDebut').value = `${year}-${month}-${day}`;
        }
        
        document.getElementById('contractMontant').value = contrat.montant;
        
        // Cacher le modal viewClient s'il est ouvert
        document.getElementById('viewClientModal').classList.remove('show');
        document.getElementById('contractModal').classList.add('show');
    } catch (error) {
        (typeof window.showToast === 'function' ? window.showToast : console.log)('Erreur lors du chargement du contrat', 'error');
    }
}

async function loadClientVehicules(clientId) {
    const vehiculeSelect = document.getElementById('contractVehicule');
    
    if (!clientId) {
        vehiculeSelect.innerHTML = '<option value="">Sélectionner d\'abord un client</option>';
        return;
    }
    
    try {
        // Vérifier que l'API est chargée
        if (!window.api || !window.api.clients) {
            throw new Error('API non chargée');
        }
        
        const data = await window.api.clients.getById(clientId);
        const client = data.client;
        
        vehiculeSelect.innerHTML = '<option value="">Sélectionner un véhicule</option>';
        
        if (client.vehicules && client.vehicules.length > 0) {
            client.vehicules.forEach(vehicule => {
                const option = document.createElement('option');
                option.value = vehicule.id;
                option.textContent = `${vehicule.marque} ${vehicule.modele}${vehicule.immatriculation ? ' - ' + vehicule.immatriculation : ''}`;
                vehiculeSelect.appendChild(option);
            });
        } else {
            vehiculeSelect.innerHTML = '<option value="">Ce client n\'a pas de véhicule</option>';
        }
    } catch (error) {
        (typeof window.showToast === 'function' ? window.showToast : console.log)('Erreur lors du chargement des véhicules', 'error');
    }
}

function closeContractModal() {
    document.getElementById('contractModal').classList.remove('show');
    currentEditingContractId = null;
}

async function saveContract(event) {
    event.preventDefault();
    
    const formData = {
        client_id: parseInt(document.getElementById('contractClient').value),
        vehicule_id: parseInt(document.getElementById('contractVehicule').value),
        type_contrat: document.getElementById('contractType').value,
        duree_mois: parseInt(document.getElementById('contractDuree').value),
        date_debut: document.getElementById('contractDateDebut').value,
        montant: parseFloat(document.getElementById('contractMontant').value)
    };
    
    try {
        if (currentEditingContractId) {
            // Modifier
            await window.api.contracts.update(currentEditingContractId, formData);
            (typeof window.showToast === 'function' ? window.showToast : console.log)('Contrat modifié avec succès', 'success');
        } else {
            // Créer
            await window.api.contracts.create(formData);
            (typeof window.showToast === 'function' ? window.showToast : console.log)('Contrat créé avec succès', 'success');
        }
        
        closeContractModal();
        loadContrats();
        loadDashboard();
    } catch (error) {
        (typeof window.showToast === 'function' ? window.showToast : console.log)('Erreur lors de l\'opération', 'error');
    }
}

async function viewContract(id) {
    try {
        // Vérifier que l'API est chargée
        if (!window.api || !window.api.contracts) {
            throw new Error('API non chargée');
        }
        
        const data = await window.api.contracts.getById(id);
        const contrat = data.contrat;
        
        document.getElementById('viewContractContent').innerHTML = `
            <div style="margin-bottom: 1.5rem;">
                <h3 style="margin-bottom: 1rem;">Informations du contrat</h3>
                <p><strong>Numéro:</strong> ${formatDetailValue(contrat.numero_contrat)}</p>
                <p><strong>Type:</strong> ${formatDetailValue(contrat.type_contrat)}</p>
                <p><strong>Durée:</strong> ${contrat.duree_mois} mois</p>
                <p><strong>Date de début:</strong> ${formatDate(contrat.date_debut)}</p>
                <p><strong>Date de fin:</strong> ${formatDate(contrat.date_fin)}</p>
                <p><strong>Montant:</strong> ${contrat.montant.toLocaleString()} FCFA</p>
                <p><strong>Statut:</strong> <span class="badge badge-${contrat.statut === 'actif' ? 'success' : contrat.statut === 'expire' ? 'danger' : 'warning'}">${contrat.statut}</span></p>
                ${contrat.jours_restants !== undefined ? `<p><strong>Jours restants:</strong> ${contrat.jours_restants} jours</p>` : ''}
            </div>
            <div style="margin-bottom: 1.5rem;">
                <h3 style="margin-bottom: 1rem;">Client</h3>
                <p><strong>Nom:</strong> ${contrat.client_nom} ${contrat.client_prenom}</p>
                ${contrat.client_telephone ? `<p><strong>Téléphone:</strong> ${contrat.client_telephone}</p>` : ''}
                ${contrat.client_email ? `<p><strong>Email:</strong> ${contrat.client_email}</p>` : ''}
            </div>
            <div>
                <h3 style="margin-bottom: 1rem;">Véhicule</h3>
                ${renderVehicleDetailsHtml({
                    marque: contrat.marque,
                    modele: contrat.modele,
                    immatriculation: contrat.immatriculation,
                    puissance: contrat.puissance,
                    energie: contrat.energie,
                    type_vehicule: contrat.type_vehicule,
                    annee: contrat.annee,
                    couleur: contrat.couleur
                })}
            </div>
        `;
        
        document.getElementById('viewContractModal').classList.add('show');
    } catch (error) {
        (typeof window.showToast === 'function' ? window.showToast : console.log)('Erreur lors du chargement', 'error');
    }
}

function closeViewContractModal() {
    document.getElementById('viewContractModal').classList.remove('show');
}

// Exposer les fonctions globalement
window.openAddClientModal = openAddClientModal;
window.openEditClientModal = openEditClientModal;
window.closeClientModal = closeClientModal;
// toggleVehiculeFields supprimée - les champs véhicule sont maintenant toujours visibles
window.saveClient = saveClient;
window.viewClient = viewClient;
window.closeViewClientModal = closeViewClientModal;
window.updatePayment = updatePayment;
window.openAddContractModal = openAddContractModal;
window.openEditContractModal = openEditContractModal;
window.loadClientVehicules = loadClientVehicules;
window.closeContractModal = closeContractModal;
window.saveContract = saveContract;
window.viewContract = viewContract;
window.closeViewContractModal = closeViewContractModal;
window.renderVehicleDetailsHtml = renderVehicleDetailsHtml;
window.inferVehicleType = inferVehicleType;
window.formatDetailValue = formatDetailValue;

// Fermer les modaux en cliquant en dehors
window.onclick = function(event) {
    const modals = ['clientModal', 'contractModal', 'viewClientModal', 'viewContractModal', 'activeContractsModal', 'expiringContractsModal'];
    modals.forEach(modalId => {
        const modal = document.getElementById(modalId);
        if (modal && event.target === modal) {
            modal.classList.remove('show');
        }
    });
}

