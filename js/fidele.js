// ============================================
// PAGE FIDÈLE — Portefeuille clients / véhicules
// ============================================

let fideleClients = [];
let fideleFilter = 'all';

function formatFidelePhone(telephone) {
    if (!telephone || telephone.startsWith('TEMP-')) {
        return 'Non renseigné';
    }
    return typeof window.escapeHtml === 'function' ? window.escapeHtml(telephone) : telephone;
}

function formatFideleValue(value, fallback = 'Non renseigné') {
    if (value === null || value === undefined || String(value).trim() === '') {
        return typeof window.escapeHtml === 'function' ? window.escapeHtml(fallback) : fallback;
    }
    return typeof window.escapeHtml === 'function' ? window.escapeHtml(value) : value;
}

function formatFideleVehicleType(vehicule) {
    if (typeof window.inferVehicleType === 'function') {
        return window.inferVehicleType(vehicule);
    }

    const labels = {
        moto: 'Moto / 2 roues',
        camionnette: 'Camionnette',
        camion: 'Camion',
        break: 'Break',
        particulier: 'Véhicule particulier'
    };
    return labels[vehicule.vehicle_type] || labels[vehicule.type_vehicule] || 'Non renseigné';
}

function renderFideleVehicleDetails(vehicule) {
    if (typeof window.renderVehicleDetailsHtml === 'function') {
        return window.renderVehicleDetailsHtml(vehicule);
    }

    const puissance = vehicule.puissance ? `${vehicule.puissance} CV` : 'Non renseigné';
    return `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 0.5rem 1rem; margin-top: 0.5rem;">
            <p style="margin: 0;"><strong>Marque:</strong> ${formatFideleValue(vehicule.marque)}</p>
            <p style="margin: 0;"><strong>Modèle:</strong> ${formatFideleValue(vehicule.modele)}</p>
            <p style="margin: 0;"><strong>Type:</strong> ${formatFideleVehicleType(vehicule)}</p>
            <p style="margin: 0;"><strong>Puissance:</strong> ${puissance}</p>
            <p style="margin: 0;"><strong>Énergie:</strong> ${formatFideleValue(vehicule.energie)}</p>
            <p style="margin: 0;"><strong>Immatriculation:</strong> ${formatFideleValue(vehicule.immatriculation)}</p>
        </div>
    `;
}

function renderFideleContractItem(contrat) {
    const statutClass = contrat.statut === 'actif' ? 'badge-success' : contrat.statut === 'expire' ? 'badge-danger' : 'badge-warning';
    const montant = parseFloat(contrat.montant) || 0;

    return `
        <div class="fidele-contract-item">
            <div class="fidele-contract-head">
                <strong>${formatFideleValue(contrat.numero_contrat, 'Sans numéro')}</strong>
                <span class="badge ${statutClass}">${contrat.statut || '—'}</span>
            </div>
            <p><strong>Catégorie:</strong> ${formatFideleValue(contrat.categorie_vehicule)}</p>
            <p><strong>Période:</strong> ${formatDate(contrat.date_debut)} → ${formatDate(contrat.date_fin)} (${contrat.duree_mois || '—'} mois)</p>
            <p><strong>Prime nette:</strong> ${montant.toLocaleString('fr-FR')} FCFA</p>
            <p><strong>Type contrat:</strong> ${formatFideleValue(contrat.type_contrat)}</p>
        </div>
    `;
}

function renderFideleVehicleCard(vehicule, index) {
    const title = [vehicule.marque, vehicule.modele].filter(Boolean).join(' ') || `Véhicule ${index + 1}`;
    const contratsHtml = vehicule.contrats && vehicule.contrats.length
        ? vehicule.contrats.map(renderFideleContractItem).join('')
        : '<p class="fidele-empty-inline">Aucun contrat lié à ce véhicule</p>';

    return `
        <article class="fidele-vehicle-card">
            <div class="fidele-vehicle-header">
                <div>
                    <h4>${formatFideleValue(title)}</h4>
                    <p class="fidele-vehicle-subtitle">${formatFideleValue(vehicule.immatriculation, 'Immatriculation non renseignée')}</p>
                </div>
                <span class="badge badge-info">${formatFideleVehicleType(vehicule)}</span>
            </div>
            ${renderFideleVehicleDetails(vehicule)}
            <div class="fidele-contracts-block">
                <h5>Contrats (${vehicule.contrats?.length || 0})</h5>
                ${contratsHtml}
            </div>
        </article>
    `;
}

function renderFideleClientCard(client) {
    const vehicleCount = client.nombre_vehicules || 0;
    const badgeClass = vehicleCount >= 2 ? 'badge-success' : vehicleCount === 1 ? 'badge-info' : 'badge-danger';
    const vehiclesHtml = client.vehicules && client.vehicules.length
        ? client.vehicules.map((vehicule, index) => renderFideleVehicleCard(vehicule, index)).join('')
        : '<p class="fidele-empty-inline">Aucun véhicule enregistré pour ce client</p>';

    const orphanContractsHtml = client.contrats_sans_vehicule?.length
        ? `
            <div class="fidele-contracts-block">
                <h5>Contrats sans véhicule associé (${client.contrats_sans_vehicule.length})</h5>
                ${client.contrats_sans_vehicule.map(renderFideleContractItem).join('')}
            </div>
        `
        : '';

    return `
        <section class="fidele-client-card" data-client-id="${client.id}">
            <button type="button" class="fidele-client-toggle" onclick="toggleFideleClient(${client.id})" aria-expanded="false">
                <div class="fidele-client-summary">
                    <div>
                        <h3>${formatFideleValue(client.nom, 'Client')} ${formatFideleValue(client.prenom, '')}</h3>
                        <p>${formatFidelePhone(client.telephone)}</p>
                    </div>
                    <div class="fidele-client-badges">
                        <span class="badge ${badgeClass}">
                            ${vehicleCount} véhicule${vehicleCount > 1 ? 's' : ''}
                        </span>
                        <span class="badge badge-info">${client.nombre_contrats || 0} contrat${(client.nombre_contrats || 0) > 1 ? 's' : ''}</span>
                    </div>
                </div>
                <i class="fas fa-chevron-down fidele-chevron" id="fideleChevron${client.id}"></i>
            </button>
            <div class="fidele-client-details" id="fideleDetails${client.id}" hidden>
                <div class="fidele-client-actions">
                    <button type="button" class="btn-secondary" onclick="showClientDetails(${client.id})">
                        <i class="fas fa-eye"></i> Fiche complète
                    </button>
                </div>
                <div class="fidele-vehicles-grid">
                    ${vehiclesHtml}
                </div>
                ${orphanContractsHtml}
            </div>
        </section>
    `;
}

function getFilteredFideleClients() {
    if (fideleFilter === 'multi') {
        return fideleClients.filter(client => (client.nombre_vehicules || 0) >= 2);
    }
    if (fideleFilter === 'single') {
        return fideleClients.filter(client => (client.nombre_vehicules || 0) === 1);
    }
    return fideleClients;
}

function renderFidelePage() {
    const container = document.getElementById('fideleClientsList');
    const statsEl = document.getElementById('fideleStats');
    if (!container) return;

    const filtered = getFilteredFideleClients();
    const totalVehicles = filtered.reduce((sum, client) => sum + (client.nombre_vehicules || 0), 0);

    if (statsEl) {
        statsEl.innerHTML = `
            <span><strong>${filtered.length}</strong> client${filtered.length > 1 ? 's' : ''}</span>
            <span><strong>${totalVehicles}</strong> véhicule${totalVehicles > 1 ? 's' : ''} au total</span>
        `;
    }

    if (!filtered.length) {
        container.innerHTML = `
            <div class="fidele-empty-state">
                <i class="fas fa-car-side"></i>
                <p>Aucun client trouvé pour ce filtre</p>
            </div>
        `;
        return;
    }

    container.innerHTML = filtered.map(renderFideleClientCard).join('');
}

async function loadFidele(searchTerm = '') {
    const container = document.getElementById('fideleClientsList');
    if (container) {
        container.innerHTML = '<p class="fidele-loading">Chargement du portefeuille fidèle...</p>';
    }

    try {
        if (!window.api || !window.api.clients) {
            throw new Error('API non chargée');
        }

        const data = await window.api.clients.getFidele(searchTerm);
        fideleClients = data.clients || [];
        renderFidelePage();
    } catch (error) {
        console.error('Erreur lors du chargement Fidèle:');
        if (container) {
            container.innerHTML = '<p class="fidele-empty-state">Impossible de charger les données</p>';
        }
        if (typeof window.showToast === 'function') {
            window.showToast('Erreur lors du chargement Fidèle', 'error');
        }
    }
}

function toggleFideleClient(clientId) {
    const details = document.getElementById(`fideleDetails${clientId}`);
    const chevron = document.getElementById(`fideleChevron${clientId}`);
    const toggle = details?.previousElementSibling;

    if (!details) return;

    const isHidden = details.hasAttribute('hidden');
    if (isHidden) {
        details.removeAttribute('hidden');
        if (toggle) toggle.setAttribute('aria-expanded', 'true');
        if (chevron) chevron.classList.add('open');
    } else {
        details.setAttribute('hidden', '');
        if (toggle) toggle.setAttribute('aria-expanded', 'false');
        if (chevron) chevron.classList.remove('open');
    }
}

function setFideleFilter(filter) {
    fideleFilter = filter;
    document.querySelectorAll('.fidele-filter-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.filter === filter);
    });
    renderFidelePage();
}

function setupFidelePage() {
    const searchInput = document.getElementById('fideleSearchInput');
    if (searchInput && !searchInput.dataset.bound) {
        searchInput.dataset.bound = 'true';
        let searchTimeout;
        searchInput.addEventListener('input', function () {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => loadFidele(this.value.trim()), 300);
        });
    }

    document.querySelectorAll('.fidele-filter-btn').forEach(btn => {
        if (btn.dataset.bound === 'true') return;
        btn.dataset.bound = 'true';
        btn.addEventListener('click', function () {
            setFideleFilter(this.dataset.filter || 'all');
        });
    });
}

document.addEventListener('DOMContentLoaded', setupFidelePage);

window.loadFidele = loadFidele;
window.toggleFideleClient = toggleFideleClient;
window.setFideleFilter = setFideleFilter;
