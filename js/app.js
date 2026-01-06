// ============================================
// NAVIGATION ET INTERACTIVITÉ
// ============================================

// Vérifier l'authentification au chargement
document.addEventListener('DOMContentLoaded', function() {
    // Vérifier si l'utilisateur est connecté
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    const currentPath = window.location.pathname;
    const isLoginPage = currentPath.includes('login.html') || 
                        currentPath.includes('register.html') ||
                        currentPath.includes('verify-email.html') ||
                        currentPath.includes('reset-password.html');
    const isIndexPage = currentPath === '/' || currentPath.includes('index.html');
    
    // Si pas de token
    if (!token) {
        // Si on est sur index.html ou la racine sans token, rediriger vers login
        if (isIndexPage) {
            window.location.href = 'login.html';
            return;
        }
        // Si on est sur une autre page protégée sans token, rediriger vers login
        if (!isPublicPage) {
            sessionStorage.setItem('redirectAfterLogin', currentPath);
            window.location.href = 'login.html';
            return;
        }
        // Si on est sur une page publique, ne rien faire (on reste là)
        return;
    }
    
    // Pages publiques qui doivent être accessibles même si connecté
    const publicPages = ['register.html', 'verify-email.html', 'reset-password.html'];
    const isPublicPage = publicPages.some(page => currentPath.includes(page));
    
    // Si on est sur une page publique, ne pas vérifier le token (laisser la page se charger)
    if (isPublicPage) {
        return; // Laisser ces pages se charger normalement
    }
    
    // Si on a un token et qu'on est sur login.html, rediriger vers index.html
    if (token && currentPath.includes('login.html')) {
        const redirectPath = sessionStorage.getItem('redirectAfterLogin');
        if (redirectPath && redirectPath !== '/login.html' && !redirectPath.includes('register.html')) {
            sessionStorage.removeItem('redirectAfterLogin');
            window.location.href = redirectPath;
        } else {
            window.location.href = 'index.html';
        }
        return;
    }
    
    // Si on est sur index.html avec un token, charger les données
    if (!isIndexPage || !token) {
        return;
    }
    
    // Charger les données de l'entreprise
    loadEntrepriseInfo().catch(error => {
        console.error('Erreur lors du chargement des informations de l\'entreprise:', error);
        // Si erreur d'authentification, rediriger vers login
        if (error.message && error.message.includes('Token')) {
            localStorage.removeItem('token');
            sessionStorage.removeItem('token');
            window.location.href = 'login.html';
        }
    });
    
    // Charger le dashboard (page par défaut sur index.html)
    const dashboardPage = document.getElementById('dashboard-page');
    if (dashboardPage) {
        dashboardPage.classList.add('active');
        // Masquer les autres pages
        document.querySelectorAll('.page').forEach(page => {
            if (page.id !== 'dashboard-page') {
                page.classList.remove('active');
            }
        });
        
        loadDashboard().catch(error => {
            console.error('Erreur lors du chargement du dashboard:', error);
            if (error.message && error.message.includes('Token')) {
                localStorage.removeItem('token');
                sessionStorage.removeItem('token');
                window.location.href = 'login.html';
            } else if (typeof showToast === 'function') {
                showToast('Erreur lors du chargement du dashboard: ' + (error.message || 'Erreur inconnue'), 'error');
            }
        });
    }
});

// Navigation entre les pages
document.addEventListener('DOMContentLoaded', function() {
    // Gestion de la navigation dans la sidebar
    const navItems = document.querySelectorAll('.nav-item');
    const pages = document.querySelectorAll('.page');
    
    navItems.forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Retirer la classe active de tous les items
            navItems.forEach(nav => nav.classList.remove('active'));
            
            // Ajouter la classe active à l'item cliqué
            this.classList.add('active');
            
            // Récupérer la page cible
            const targetPage = this.getAttribute('data-page');
            
            // Masquer toutes les pages
            pages.forEach(page => page.classList.remove('active'));
            
            // Afficher la page cible
            const targetPageElement = document.getElementById(`${targetPage}-page`);
            if (targetPageElement) {
                targetPageElement.classList.add('active');
                
                // Vérifier le token avant de charger les données
                const token = localStorage.getItem('token') || sessionStorage.getItem('token');
                if (!token) {
                    window.location.href = 'login.html';
                    return;
                }
                
                // Charger les données de la page avec gestion d'erreur
                try {
                    if (targetPage === 'dashboard') {
                        loadDashboard().catch(error => {
                            console.error('Erreur lors du chargement du dashboard:', error);
                            if (error.message && error.message.includes('Token')) {
                                localStorage.removeItem('token');
                                sessionStorage.removeItem('token');
                                window.location.href = 'login.html';
                            } else if (typeof showToast === 'function') {
                                showToast('Erreur lors du chargement du dashboard', 'error');
                            }
                        });
                    } else if (targetPage === 'clients') {
                        loadClients().catch(error => {
                            console.error('Erreur lors du chargement des clients:', error);
                            if (error.message && error.message.includes('Token')) {
                                localStorage.removeItem('token');
                                sessionStorage.removeItem('token');
                                window.location.href = 'login.html';
                            } else if (typeof showToast === 'function') {
                                showToast('Erreur lors du chargement des clients', 'error');
                            }
                        });
                        // Réinitialiser la recherche et les filtres
                        setTimeout(() => {
                            if (typeof setupSearch === 'function') setupSearch();
                            if (typeof setupFilters === 'function') setupFilters();
                        }, 100);
                    } else if (targetPage === 'bordereaux') {
                        if (typeof loadBordereau === 'function') {
                            loadBordereau().catch(error => {
                                console.error('Erreur lors du chargement du bordereau:', error);
                                if (error.message && error.message.includes('Token')) {
                                    localStorage.removeItem('token');
                                    sessionStorage.removeItem('token');
                                    window.location.href = 'login.html';
                                } else if (typeof showToast === 'function') {
                                    showToast('Erreur lors du chargement du bordereau', 'error');
                                }
                            });
                        }
                    } else if (targetPage === 'rapports') {
                        if (typeof loadRapports === 'function') {
                            loadRapports().catch(error => {
                                console.error('Erreur lors du chargement des rapports:', error);
                                if (error.message && error.message.includes('Token')) {
                                    localStorage.removeItem('token');
                                    sessionStorage.removeItem('token');
                                    window.location.href = 'login.html';
                                } else if (typeof showToast === 'function') {
                                    showToast('Erreur lors du chargement des rapports', 'error');
                                }
                            });
                        }
                    } else if (targetPage === 'parametres') {
                        if (typeof loadParametres === 'function') {
                            loadParametres().catch(error => {
                                console.error('Erreur lors du chargement des paramètres:', error);
                                if (error.message && error.message.includes('Token')) {
                                    localStorage.removeItem('token');
                                    sessionStorage.removeItem('token');
                                    window.location.href = 'login.html';
                                } else if (typeof showToast === 'function') {
                                    showToast('Erreur lors du chargement des paramètres', 'error');
                                }
                            });
                        }
                    }
                } catch (error) {
                    console.error('Erreur lors du chargement de la page:', error);
                    if (error.message && error.message.includes('Token')) {
                        localStorage.removeItem('token');
                        sessionStorage.removeItem('token');
                        window.location.href = 'login.html';
                    } else if (typeof showToast === 'function') {
                        showToast('Erreur lors du chargement de la page', 'error');
                    }
                }
            }
        });
    });
    
    // Gestion du menu utilisateur
    const userMenu = document.querySelector('.user-menu');
    if (userMenu) {
        userMenu.addEventListener('click', function() {
            // Ici vous pouvez ajouter un menu déroulant
            console.log('Menu utilisateur cliqué');
        });
    }
    
    // Gestion des notifications
    const notifications = document.querySelector('.notifications');
    if (notifications) {
        notifications.addEventListener('click', function() {
            // Ici vous pouvez afficher les notifications
            console.log('Notifications cliquées');
        });
    }
    
    // Animation d'entrée pour les cartes
    const cards = document.querySelectorAll('.card, .stat-card');
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };
    
    const observer = new IntersectionObserver(function(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '0';
                entry.target.style.transform = 'translateY(20px)';
                setTimeout(() => {
                    entry.target.style.transition = 'opacity 0.5s, transform 0.5s';
                    entry.target.style.opacity = '1';
                    entry.target.style.transform = 'translateY(0)';
                }, 100);
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);
    
    cards.forEach(card => {
        observer.observe(card);
    });
});

// ============================================
// FONCTIONS UTILITAIRES
// ============================================

// Fonction pour formater les dates
function formatDate(dateString) {
    const date = new Date(dateString);
    const options = { day: '2-digit', month: '2-digit', year: 'numeric' };
    return date.toLocaleDateString('fr-FR', options);
}

// Fonction pour formater les numéros de téléphone
function formatPhone(phone) {
    // Format: +221 77 123 4567
    return phone.replace(/(\d{3})(\d{2})(\d{3})(\d{4})/, '+$1 $2 $3 $4');
}

// Fonction pour formater le temps écoulé
function formatTimeAgo(dateString) {
    if (!dateString) return 'Récemment';
    
    try {
        const date = new Date(dateString);
        const maintenant = new Date();
        const diffMs = maintenant - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);
        
        if (diffMins < 1) return 'À l\'instant';
        if (diffMins < 60) return `Il y a ${diffMins} min${diffMins > 1 ? 's' : ''}`;
        if (diffHours < 24) return `Il y a ${diffHours} heure${diffHours > 1 ? 's' : ''}`;
        if (diffDays < 7) return `Il y a ${diffDays} jour${diffDays > 1 ? 's' : ''}`;
        
        return formatDate(dateString);
    } catch (error) {
        return 'Récemment';
    }
}

// Fonction pour afficher les notifications toast
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    
    // Styles pour le toast
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'success' ? '#10B981' : type === 'error' ? '#EF4444' : '#2563EB'};
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 8px;
        box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
        z-index: 1000;
        animation: slideIn 0.3s ease-out;
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => {
            document.body.removeChild(toast);
        }, 300);
    }, 3000);
}

// Ajouter les animations CSS pour les toasts
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// ============================================
// CHARGEMENT DES DONNÉES DE L'ENTREPRISE
// ============================================

async function loadEntrepriseInfo() {
    try {
        const data = await window.api.auth.getMe();
        const entreprise = data.entreprise;
        
        // Mettre à jour le nom de l'entreprise dans le header
        const userName = document.querySelector('.user-name');
        if (userName) {
            userName.textContent = entreprise.nom || 'Entreprise';
        }
    } catch (error) {
        console.error('Erreur lors du chargement des informations de l\'entreprise:', error);
        // Si erreur d'authentification, rediriger vers login
        if (error.message && (error.message.includes('Token') || error.message.includes('authentification'))) {
            localStorage.removeItem('token');
            localStorage.removeItem('entreprise');
            sessionStorage.removeItem('token');
            sessionStorage.removeItem('entreprise');
            window.location.href = 'login.html';
        }
        throw error; // Re-lancer l'erreur pour que le code appelant puisse la gérer
    }
}

// ============================================
// CHARGEMENT DU DASHBOARD
// ============================================

async function loadDashboard() {
    try {
        console.log('Chargement du dashboard...');
        
        // Vérifier que le token existe avant de faire l'appel API
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        if (!token) {
            console.warn('Aucun token trouvé, redirection vers login...');
            window.location.href = 'login.html';
            return;
        }
        
        // Charger les statistiques depuis Supabase
        const stats = await window.api.stats.getDashboard();
        console.log('Statistiques reçues:', stats);
        
        // Mettre à jour les cartes de statistiques
        const statsCards = document.querySelectorAll('.stat-card');
        if (statsCards.length >= 4) {
            // Toujours mettre à jour les valeurs depuis la base de données
            statsCards[0].querySelector('h3').textContent = stats.clients_actifs ?? 0;
            statsCards[1].querySelector('h3').textContent = stats.contrats_actifs ?? 0;
            statsCards[2].querySelector('h3').textContent = stats.renouvellements_a_venir ?? 0;
            statsCards[3].querySelector('h3').textContent = stats.expires_ce_mois ?? 0;
            console.log('Statistiques mises à jour:', {
                clients: stats.clients_actifs ?? 0,
                contrats: stats.contrats_actifs ?? 0,
                renouvellements: stats.renouvellements_a_venir ?? 0,
                expires: stats.expires_ce_mois ?? 0
            });
        }
        
        // Charger les notifications (gérer les erreurs silencieusement)
        try {
            const notificationsData = await window.api.notifications.getAll('false');
            const notifications = notificationsData.notifications || [];
            
            // Mettre à jour le badge de notifications
            const badge = document.querySelector('.notifications .badge');
            if (badge) {
                badge.textContent = notifications.length;
                badge.style.display = notifications.length > 0 ? 'flex' : 'none';
            }
        } catch (notifError) {
            console.warn('Erreur lors du chargement des notifications:', notifError);
            // Ne pas bloquer le dashboard si les notifications échouent
        }
        
        // Mettre à jour la carte d'alerte
        const alertCard = document.getElementById('alertCard');
        if (alertCard) {
            if (stats.renouvellements_a_venir > 0) {
                alertCard.innerHTML = `
                    <div class="alert-icon">
                        <i class="fas fa-exclamation-circle"></i>
                    </div>
                    <div class="alert-content">
                        <h4>Renouvellement à venir</h4>
                        <p>${stats.renouvellements_a_venir} contrat${stats.renouvellements_a_venir > 1 ? 's' : ''} ${stats.renouvellements_a_venir > 1 ? 'arrivent' : 'arrive'} à échéance dans les 7 prochains jours</p>
                    </div>
                    <button class="btn-primary" onclick="document.querySelector('[data-page=bordereaux]').click()">Voir détails</button>
                `;
            } else {
                alertCard.innerHTML = `
                    <div class="alert-icon">
                        <i class="fas fa-check-circle"></i>
                    </div>
                    <div class="alert-content">
                        <h4>Tout est à jour</h4>
                        <p>Aucun renouvellement urgent à prévoir</p>
                    </div>
                `;
            }
        }
        
        // Charger les contrats à renouveler
        const contractsData = await window.api.contracts.getAll('actif');
        const contrats = contractsData.contrats || [];
        const contratsARenouveler = contrats.filter(c => c.alerte_renouvellement);
        
        // Mettre à jour la section des contrats à renouveler
        const contractsContainer = document.getElementById('contractsToRenew');
        if (contractsContainer) {
            if (contratsARenouveler.length === 0) {
                contractsContainer.innerHTML = '<p style="text-align: center; padding: 2rem; color: #6B7280;">Aucun contrat à renouveler</p>';
            } else {
                contractsContainer.innerHTML = contratsARenouveler.slice(0, 5).map(contrat => {
                    const joursRestants = contrat.jours_restants || 0;
                    const badgeClass = joursRestants <= 3 ? 'badge-warning' : 'badge-info';
                    const badgeText = joursRestants <= 3 ? 'Urgent' : 'À suivre';
                    return `
                        <div class="contract-item">
                            <div class="contract-info">
                                <h4>${contrat.client_nom} ${contrat.client_prenom}</h4>
                                <p>Renouvellement dans ${joursRestants} jour${joursRestants > 1 ? 's' : ''}</p>
                            </div>
                            <span class="badge ${badgeClass}">${badgeText}</span>
                        </div>
                    `;
                }).join('');
            }
        }
        
        // Mettre à jour l'activité récente (derniers clients et contrats créés)
        const activityContainer = document.getElementById('recentActivity');
        if (activityContainer) {
            // Charger les derniers clients créés
            const clientsData = await window.api.clients.getAll();
            const recentClients = (clientsData.clients || []).slice(0, 3);
            
            if (recentClients.length === 0) {
                activityContainer.innerHTML = '<p style="text-align: center; padding: 2rem; color: #6B7280;">Aucune activité récente</p>';
            } else {
                activityContainer.innerHTML = recentClients.map(client => {
                    const timeAgo = formatTimeAgo(client.created_at);
                    return `
                        <div class="activity-item">
                            <div class="activity-icon">
                                <i class="fas fa-user-plus"></i>
                            </div>
                            <div class="activity-content">
                                <h4>Nouveau client ajouté</h4>
                                <p>${client.nom} ${client.prenom} - ${timeAgo}</p>
                            </div>
                        </div>
                    `;
                }).join('');
            }
        }
    } catch (error) {
        console.error('Erreur lors du chargement du dashboard:', error);
        showToast('Erreur lors du chargement du dashboard', 'error');
    }
}

// ============================================
// GESTION DES CLIENTS
// ============================================

async function loadClients() {
    try {
        const data = await window.api.clients.getAll();
        const clients = data.clients || [];
        
        // Rendre le tableau des clients
        renderClientsTable(clients);
    } catch (error) {
        console.error('Erreur lors du chargement des clients:', error);
        showToast('Erreur lors du chargement des clients', 'error');
    }
}

function renderClientsTable(clients) {
    const tbody = document.querySelector('#clients-page tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (clients.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem; color: #6B7280;">Aucun client trouvé</td></tr>';
        return;
    }
    
    clients.forEach(client => {
        // Récupérer l'immatriculation du véhicule
        const immatriculation = client.vehicules && client.vehicules.length > 0 
            ? client.vehicules[0].immatriculation || '-'
            : '-';
        
        // Récupérer la date d'échéance du dernier contrat
        const dateEcheance = client.dernier_contrat ? formatDate(client.dernier_contrat) : '-';
        
        // Formater le téléphone : ne pas afficher les téléphones temporaires
        let telephoneDisplay = '-';
        if (client.telephone && !client.telephone.startsWith('TEMP-')) {
            telephoneDisplay = client.telephone;
        }
        
        // Nom complet (nom seul car prenom est vide)
        const nomComplet = client.nom || '-';
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>
                <div class="user-cell">
                    <div class="user-avatar-small">
                        <i class="fas fa-user"></i>
                    </div>
                    <span>${nomComplet}</span>
                </div>
            </td>
            <td>${telephoneDisplay}</td>
            <td>${immatriculation}</td>
            <td>${dateEcheance}</td>
            <td><span class="badge ${client.client_statut === 'actif' ? 'badge-success' : 'badge-secondary'}">${client.client_statut === 'actif' ? 'Actif' : 'Inactif'}</span></td>
            <td>
                <div class="action-buttons">
                    <button class="btn-icon" title="Modifier" onclick="editClient(${client.id})">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-icon" title="Supprimer" onclick="deleteClient(${client.id})">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });
}

async function deleteClient(clientId) {
    if (confirm('Êtes-vous sûr de vouloir supprimer ce client ? Cette action supprimera aussi tous ses contrats.')) {
        try {
            await window.api.clients.delete(clientId);
            showToast('Client supprimé avec succès', 'success');
            loadClients();
        } catch (error) {
            showToast('Erreur lors de la suppression: ' + error.message, 'error');
        }
    }
}

function viewClient(id) {
    // Implémenté dans modals.js
    if (typeof window.viewClient === 'function') {
        window.viewClient(id);
    }
}

function editClient(id) {
    // Implémenté dans modals.js
    if (typeof window.openEditClientModal === 'function') {
        window.openEditClientModal(id);
    }
}

// ============================================
// GESTION DES CONTRATS
// ============================================

async function loadContrats() {
    try {
        const data = await window.api.contracts.getAll();
        const contrats = data.contrats || [];
        
        // Rendre les cartes de contrats
        renderContractsCards(contrats);
    } catch (error) {
        console.error('Erreur lors du chargement des contrats:', error);
        showToast('Erreur lors du chargement des contrats', 'error');
    }
}

function renderContractsCards(contrats) {
    const container = document.querySelector('#contrats-page .contracts-grid');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (contrats.length === 0) {
        container.innerHTML = '<p style="text-align: center; padding: 2rem;">Aucun contrat trouvé</p>';
        return;
    }
    
    contrats.forEach(contrat => {
        const joursRestants = contrat.jours_restants || 0;
        const statutBadge = contrat.est_expire 
            ? '<span class="badge badge-danger">Expiré</span>'
            : contrat.alerte_renouvellement
            ? '<span class="badge badge-warning">À renouveler</span>'
            : '<span class="badge badge-success">Actif</span>';
        
        const card = document.createElement('div');
        card.className = 'contract-card';
        card.innerHTML = `
            <div class="contract-card-header">
                <h3>${contrat.client_nom} ${contrat.client_prenom}</h3>
                ${statutBadge}
            </div>
            <div class="contract-card-body">
                <div class="contract-detail">
                    <i class="fas fa-car"></i>
                    <span>${contrat.marque} ${contrat.modele}</span>
                </div>
                <div class="contract-detail">
                    <i class="fas fa-calendar"></i>
                    <span>Expire le ${formatDate(contrat.date_fin)}</span>
                </div>
                <div class="contract-detail">
                    <i class="fas fa-clock"></i>
                    <span>${contrat.duree_mois} mois</span>
                </div>
                <div class="contract-detail">
                    <i class="fas fa-file-contract"></i>
                    <span>${contrat.numero_contrat}</span>
                </div>
            </div>
            <div class="contract-card-footer">
                <button class="btn-secondary" onclick="viewContract(${contrat.id})">Voir détails</button>
                ${!contrat.est_expire ? `<button class="btn-primary" onclick="renewContract(${contrat.id})">Renouveler</button>` : ''}
            </div>
        `;
        container.appendChild(card);
    });
}

async function renewContract(contractId) {
    if (confirm('Voulez-vous renouveler ce contrat ?')) {
        try {
            await window.api.contracts.renew(contractId);
            showToast('Contrat renouvelé avec succès', 'success');
            loadContrats();
            loadDashboard(); // Recharger le dashboard pour mettre à jour les stats
        } catch (error) {
            showToast('Erreur lors du renouvellement: ' + error.message, 'error');
        }
    }
}

function viewContract(id) {
    // Implémenté dans modals.js
    if (typeof window.viewContract === 'function') {
        window.viewContract(id);
    }
}

// ============================================
// RECHERCHE ET FILTRES
// ============================================

// Fonction de recherche
function setupSearch() {
    const searchInputs = document.querySelectorAll('.search-box input');
    
    searchInputs.forEach(input => {
        let timeout;
        input.addEventListener('input', function(e) {
            clearTimeout(timeout);
            const searchTerm = e.target.value;
            
            timeout = setTimeout(async () => {
                // Si on est sur la page clients
                if (document.getElementById('clients-page') && document.getElementById('clients-page').classList.contains('active')) {
                    try {
                        // Récupérer le filtre actif
                        const activeFilter = document.querySelector('#clients-page .btn-filter.active');
                        const statut = activeFilter ? (activeFilter.textContent.trim().toLowerCase() === 'actifs' ? 'actif' : activeFilter.textContent.trim().toLowerCase() === 'inactifs' ? 'inactif' : '') : '';
                        const data = await window.api.clients.getAll(searchTerm, statut);
                        renderClientsTable(data.clients || []);
                    } catch (error) {
                        console.error('Erreur de recherche:', error);
                        showToast('Erreur lors de la recherche', 'error');
                    }
                }
                // Si on est sur la page contrats
                else if (document.getElementById('contrats-page').classList.contains('active')) {
                    try {
                        const data = await window.api.contracts.getAll('', searchTerm);
                        renderContractsCards(data.contrats || []);
                    } catch (error) {
                        console.error('Erreur de recherche:', error);
                    }
                }
            }, 500); // Debounce de 500ms
        });
    });
}

// Initialiser la recherche au chargement
document.addEventListener('DOMContentLoaded', function() {
    setupSearch();
});

// ============================================
// GESTION DES FILTRES
// ============================================

function setupFilters() {
    const filterButtons = document.querySelectorAll('.btn-filter');
    
    filterButtons.forEach(button => {
        button.addEventListener('click', async function() {
            // Retirer la classe active de tous les boutons
            filterButtons.forEach(btn => btn.classList.remove('active'));
            
            // Ajouter la classe active au bouton cliqué
            this.classList.add('active');
            
            const filter = this.textContent.trim().toLowerCase();
            
            // Filtrer les clients
            if (document.getElementById('clients-page') && document.getElementById('clients-page').classList.contains('active')) {
                try {
                    // Récupérer la valeur de recherche actuelle
                    const searchInput = document.querySelector('#clients-page .search-box input');
                    const searchTerm = searchInput ? searchInput.value : '';
                    
                    const statut = filter === 'actifs' ? 'actif' : filter === 'inactifs' ? 'inactif' : '';
                    const data = await window.api.clients.getAll(searchTerm, statut);
                    renderClientsTable(data.clients || []);
                } catch (error) {
                    console.error('Erreur de filtrage:', error);
                    showToast('Erreur lors du filtrage', 'error');
                }
            }
        });
    });
}

// Initialiser les filtres au chargement
document.addEventListener('DOMContentLoaded', function() {
    setupSearch();
    setupFilters();
});

// Fonction de déconnexion
function logout() {
    // Nettoyer tous les tokens et données
    localStorage.removeItem('token');
    localStorage.removeItem('entreprise');
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('entreprise');
    sessionStorage.removeItem('redirectAfterLogin');
    
    // Rediriger vers login.html
    window.location.href = 'login.html';
}

// Exposer logout globalement
window.logout = logout;

