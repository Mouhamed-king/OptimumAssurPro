// ============================================
// GESTION DES MODAUX ET FORMULAIRES
// ============================================

let currentEditingClientId = null;
let currentEditingContractId = null;

// ============================================
// MODAL CLIENT
// ============================================

function openAddClientModal() {
    currentEditingClientId = null;
    document.getElementById('clientModalTitle').textContent = 'Ajouter un client avec contrat';
    document.getElementById('clientForm').reset();
    document.getElementById('clientId').value = '';
    
    // Réinitialiser les champs du contrat avec dates par défaut
    const today = new Date();
    const nextYear = new Date();
    nextYear.setFullYear(today.getFullYear() + 1);
    
    if (document.getElementById('contractDateEffet')) {
        document.getElementById('contractDateEffet').valueAsDate = today;
    }
    if (document.getElementById('contractDateEcheance')) {
        document.getElementById('contractDateEcheance').valueAsDate = nextYear;
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
            const vehicule = client.vehicules && client.vehicules.length > 0 ? client.vehicules[0] : null;
            if (vehicule) {
                document.getElementById('vehiculeImmatriculation').value = vehicule.immatriculation || '';
            }
            
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
            }
            
            document.getElementById('clientModal').classList.add('show');
        })
        .catch(error => {
            (typeof window.showToast === 'function' ? window.showToast : console.log)('Erreur lors du chargement du client: ' + error.message, 'error');
        });
}

function closeClientModal() {
    document.getElementById('clientModal').classList.remove('show');
    currentEditingClientId = null;
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
    const dateEffet = document.getElementById('contractDateEffet').value;
    const dateEcheance = document.getElementById('contractDateEcheance').value;
    const primeNette = parseFloat(document.getElementById('contractPrimeNette').value);
    const montantPaye = parseFloat(document.getElementById('contractMontantPaye').value) || 0;
    const montantRestant = parseFloat(document.getElementById('contractMontantRestant').value) || 0;
    
    // Validation
    if (!nom || !telephone || !numeroPolice || !immatriculation || !dateEffet || !dateEcheance || !primeNette || primeNette <= 0) {
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
    const diffMonths = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 30));
    
    // Préparer les données pour l'API
    const formData = {
        nom: nom,
        prenom: '', // Vide car on ne demande que le nom complet
        telephone: telephone, // Téléphone fourni par l'utilisateur
        vehicule: {
            immatriculation: immatriculation,
            marque: '', // Non demandé
            modele: '' // Non demandé
        },
        contrat: {
            numero_police: numeroPolice,
            date_debut: dateEffet,
            date_fin: dateEcheance,
            duree_mois: diffMonths,
            montant: primeNette,
            montant_paye: montantPaye,
            montant_restant: montantRestant
        }
    };
    
    try {
        // Vérifier que l'API est chargée
        if (!window.api || !window.api.clients) {
            throw new Error('API non chargée');
        }
        
        console.log('Données du formulaire:', formData);
        
        if (currentEditingClientId) {
            // Modifier (sans créer de nouveau contrat)
            const result = await window.api.clients.update(currentEditingClientId, formData);
            console.log('Client modifié:', result);
            (typeof window.showToast === 'function' ? window.showToast : console.log)('Client modifié avec succès', 'success');
        } else {
            // Créer client avec véhicule et contrat
            const result = await window.api.clients.create(formData);
            console.log('Client créé:', result);
            (typeof window.showToast === 'function' ? window.showToast : console.log)('Client et contrat créés avec succès', 'success');
            
            // Recharger le bordereau
            if (typeof loadBordereau === 'function') {
                setTimeout(() => loadBordereau(), 500);
            }
        }
        
        closeClientModal();
        loadClients();
        loadDashboard(); // Recharger le dashboard pour mettre à jour les stats
    } catch (error) {
        console.error('Erreur lors de la sauvegarde du client:', error);
        (typeof window.showToast === 'function' ? window.showToast : console.log)('Erreur: ' + (error.message || 'Une erreur est survenue'), 'error');
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
                    <strong>${v.marque} ${v.modele}</strong><br>
                    ${v.immatriculation ? `Immatriculation: ${v.immatriculation}<br>` : ''}
                    ${v.annee ? `Année: ${v.annee}<br>` : ''}
                    ${v.couleur ? `Couleur: ${v.couleur}` : ''}
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
                    <strong>${c.numero_contrat}</strong><br>
                    Type: ${c.type_contrat}<br>
                    Durée: ${c.duree_mois} mois<br>
                    Du ${formatDate(c.date_debut)} au ${formatDate(c.date_fin)}<br>
                    <div style="margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px solid #E5E7EB;">
                        <strong>Paiements:</strong><br>
                        Montant total: <strong>${montantTotal.toLocaleString()} FCFA</strong><br>
                        Montant payé: <span style="color: #10B981;">${montantPaye.toLocaleString()} FCFA</span><br>
                        Montant restant: <span style="color: ${hasRestant ? '#F59E0B' : '#10B981'};">${montantRestant.toLocaleString()} FCFA</span>
                    </div>
                    Statut: <span class="badge badge-${c.statut === 'actif' ? 'success' : c.statut === 'expire' ? 'danger' : 'warning'}">${c.statut}</span>
                    <br><br><button class="btn-primary" onclick="updatePayment(${c.id}, ${montantTotal}, ${montantPaye}, ${montantRestant})" style="width: 100%; margin-top: 0.5rem;">
                        <i class="fas fa-money-bill-wave"></i> Mettre à jour le paiement
                    </button>
                </div>
            `;
            }).join('')
            : '<p>Aucun contrat enregistré</p>';
        
        const viewContent = document.getElementById('viewClientContent');
        viewContent.setAttribute('data-client-id', client.id);
        viewContent.innerHTML = `
            <div style="margin-bottom: 1.5rem;">
                <h3 style="margin-bottom: 1rem;">Informations personnelles</h3>
                <p><strong>Nom:</strong> ${client.nom} ${client.prenom}</p>
                <p><strong>Téléphone:</strong> ${client.telephone}</p>
                ${client.email ? `<p><strong>Email:</strong> ${client.email}</p>` : ''}
                ${client.adresse ? `<p><strong>Adresse:</strong> ${client.adresse}</p>` : ''}
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
        (typeof window.showToast === 'function' ? window.showToast : console.log)('Erreur lors du chargement: ' + error.message, 'error');
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
            (typeof window.showToast === 'function' ? window.showToast : console.log)('Erreur: ' + (data.error || 'Une erreur est survenue'), 'error');
        }
    } catch (error) {
        console.error('Erreur lors de la mise à jour du paiement:', error);
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
        (typeof window.showToast === 'function' ? window.showToast : console.log)('Erreur lors du chargement des clients: ' + error.message, 'error');
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
        (typeof window.showToast === 'function' ? window.showToast : console.log)('Erreur lors du chargement des véhicules: ' + error.message, 'error');
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
        (typeof window.showToast === 'function' ? window.showToast : console.log)('Erreur: ' + error.message, 'error');
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
                <p><strong>Numéro:</strong> ${contrat.numero_contrat}</p>
                <p><strong>Type:</strong> ${contrat.type_contrat}</p>
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
                <p><strong>Marque:</strong> ${contrat.marque}</p>
                <p><strong>Modèle:</strong> ${contrat.modele}</p>
                ${contrat.immatriculation ? `<p><strong>Immatriculation:</strong> ${contrat.immatriculation}</p>` : ''}
                ${contrat.annee ? `<p><strong>Année:</strong> ${contrat.annee}</p>` : ''}
                ${contrat.couleur ? `<p><strong>Couleur:</strong> ${contrat.couleur}</p>` : ''}
            </div>
        `;
        
        document.getElementById('viewContractModal').classList.add('show');
    } catch (error) {
        (typeof window.showToast === 'function' ? window.showToast : console.log)('Erreur lors du chargement: ' + error.message, 'error');
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
window.loadClientVehicules = loadClientVehicules;
window.closeContractModal = closeContractModal;
window.saveContract = saveContract;
window.viewContract = viewContract;
window.closeViewContractModal = closeViewContractModal;

// Fermer les modaux en cliquant en dehors
window.onclick = function(event) {
    const modals = ['clientModal', 'contractModal', 'viewClientModal', 'viewContractModal'];
    modals.forEach(modalId => {
        const modal = document.getElementById(modalId);
        if (modal && event.target === modal) {
            modal.classList.remove('show');
        }
    });
}

