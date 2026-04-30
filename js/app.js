// ============================================
// NAVIGATION ET INTERACTIVITÉ
// ============================================

function appDebugEnabled() {
    return localStorage.getItem('debug') === 'true';
}

function appDebugLog(...args) {
    if (appDebugEnabled()) {
        console.log(...args);
    }
}

// Vérifier l'authentification au chargement
document.addEventListener('DOMContentLoaded', function() {
    // Vérifier si l'utilisateur est connecté
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    const currentPath = window.location.pathname;
    
    // Pages publiques qui doivent être accessibles même si connecté
    const publicPages = ['register.html', 'verify-email.html', 'reset-password.html'];
    const isPublicPage = publicPages.some(page => currentPath.includes(page));
    const isIndexPage = currentPath === '/' || currentPath.includes('index.html');
    
    // Si on est sur une page publique, ne pas vérifier le token (laisser la page se charger)
    if (isPublicPage) {
        return; // Laisser ces pages se charger normalement
    }
    
    // Si pas de token
    if (!token) {
        // Si on est sur index.html ou la racine sans token, rediriger vers login
        if (isIndexPage) {
            window.location.href = '/login.html';
            return;
        }
        // Si on est sur une autre page protégée sans token, rediriger vers login
        sessionStorage.setItem('redirectAfterLogin', currentPath);
        window.location.href = '/login.html';
        return;
    }
    
    // Si on a un token et qu'on est sur login.html, rediriger vers index.html
    if (token && currentPath.includes('login.html')) {
        const redirectPath = sessionStorage.getItem('redirectAfterLogin');
        if (redirectPath && redirectPath !== '/login.html' && !redirectPath.includes('register.html')) {
            sessionStorage.removeItem('redirectAfterLogin');
            window.location.href = redirectPath;
        } else {
            window.location.href = '/index.html';
        }
        return;
    }
    
    // Si on est sur index.html avec un token, charger les données
    if (!isIndexPage || !token) {
        return;
    }
    
    // Attendre un peu pour s'assurer que l'API est chargée
    setTimeout(() => {
        // Charger les données de l'entreprise
        loadEntrepriseInfo().catch(error => {
            console.error('Erreur lors du chargement des informations entreprise:', error.message);
        });
    }, 500); // Augmenter le délai pour être sûr que l'API est chargée
    
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
                window.location.href = '/login.html';
            } else if (typeof showToast === 'function') {
                showToast('Erreur lors du chargement du dashboard: ' + (error.message || 'Erreur inconnue'), 'error');
            }
        });
    }
});

// Navigation entre les pages
document.addEventListener('DOMContentLoaded', function() {
    // Gestion du menu mobile
    const mobileMenuToggle = document.getElementById('mobileMenuToggle');
    const mobileMenuClose = document.getElementById('mobileMenuClose');
    const sidebar = document.getElementById('sidebar');
    
    function openMobileMenu() {
        if (sidebar) {
            sidebar.classList.add('mobile-open');
        }
        document.body.style.overflow = 'hidden';
    }
    
    function closeMobileMenu() {
        if (sidebar) {
            sidebar.classList.remove('mobile-open');
        }
        document.body.style.overflow = '';
    }
    
    if (mobileMenuToggle) {
        mobileMenuToggle.addEventListener('click', openMobileMenu);
    }
    
    if (mobileMenuClose) {
        mobileMenuClose.addEventListener('click', closeMobileMenu);
    }
    

    
    // Fermer le menu lors du clic sur un élément de navigation sur mobile
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', function() {
            // Fermer le menu mobile après un court délai pour permettre la navigation
            setTimeout(() => {
                if (window.innerWidth <= 768) {
                    closeMobileMenu();
                }
            }, 100);
        });
    });
    
    // Fermer le menu lors du redimensionnement vers desktop
    window.addEventListener('resize', function() {
        if (window.innerWidth > 768) {
            closeMobileMenu();
        }
    });
    
    // Gestion de la navigation dans la sidebar
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
                    window.location.href = '/login.html';
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
                                window.location.href = '/login.html';
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
                                window.location.href = '/login.html';
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
                                    window.location.href = '/login.html';
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
                                    window.location.href = '/login.html';
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
                                    window.location.href = '/login.html';
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
                        window.location.href = '/login.html';
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
            showAllNotifications();
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

// showToast est maintenant dans utils.js et chargé avant app.js
// Si elle n'existe pas encore, créer une version de secours
if (typeof window.showToast !== 'function') {
    window.showToast = function(message, type = 'info') {
        console.log(`[${type.toUpperCase()}] ${message}`);
    };
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
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    
    try {
        if (!window.api || !window.api.auth) {
            appDebugLog('API auth not ready yet, waiting 500ms');
            await new Promise(resolve => setTimeout(resolve, 500));
            if (!window.api || !window.api.auth) {
                throw new Error('API non chargée après attente');
            }
        }
        
        const data = await window.api.auth.getMe();
        
        const entreprise = data.entreprise;
        
        if (!entreprise) {
            // Ne pas déconnecter, utiliser les données du localStorage
            const storedEntreprise = localStorage.getItem('entreprise') || sessionStorage.getItem('entreprise');
            if (storedEntreprise) {
                try {
                    const parsed = JSON.parse(storedEntreprise);
                    const userName = document.querySelector('.user-name');
                    if (userName) {
                        userName.textContent = parsed.nom || 'Entreprise';
                    }
                    return;
                } catch (e) {
                    console.error('Erreur parsing entreprise stockée:', e);
                }
            }
        }
        
        // Mettre à jour le nom de l'entreprise dans le header
        const userName = document.querySelector('.user-name');
        if (userName) {
            userName.textContent = entreprise.nom || 'Entreprise';
        }
    } catch (error) {
        console.error('Erreur lors du chargement des informations de l\'entreprise:', error);
        
        // Ne pas déconnecter immédiatement, essayer d'utiliser les données stockées
        const storedEntreprise = localStorage.getItem('entreprise') || sessionStorage.getItem('entreprise');
        if (storedEntreprise) {
            try {
                const parsed = JSON.parse(storedEntreprise);
                const userName = document.querySelector('.user-name');
                if (userName) {
                    userName.textContent = parsed.nom || 'Entreprise';
                }
                // Ne pas déconnecter si on a des données stockées
                return;
            } catch (e) {
                console.error('Erreur parsing entreprise stockée:', e);
            }
        }
        
        // Vérifier le type d'erreur avant de déconnecter
        const isAuthError = error.message && (
            error.message.includes('Token') || 
            error.message.includes('authentification') || 
            error.message.includes('401') || 
            error.message.includes('403')
        );
        
        if (isAuthError) {
            // Vérifier si c'est vraiment une erreur d'authentification ou juste un problème temporaire
            appDebugLog('Authentication-related error while loading entreprise info', {
                message: error.message,
                hasToken: !!token
            });
            // Ne pas déconnecter - laisser l'utilisateur voir l'erreur et réessayer
            return;
        }
        
        appDebugLog('Non-critical error while loading entreprise info, session kept');
    }
}

// ============================================
// CHARGEMENT DU DASHBOARD
// ============================================

const dashboardCharts = {
    renewals: null,
    expired: null,
    payments: null,
    profit: null
};

const dashboardState = {
    clients: [],
    contracts: [],
    selectedStat: 'clients_actifs'
};

function dashboardMonthBuckets(monthCount = 6) {
    const buckets = [];
    const start = new Date();
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    start.setMonth(start.getMonth() - (monthCount - 1));

    for (let index = 0; index < monthCount; index++) {
        const current = new Date(start);
        current.setMonth(start.getMonth() + index);
        const key = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`;
        const label = current.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' });
        buckets.push({ key, label });
    }

    return buckets;
}

function getDashboardMonthKey(dateValue) {
    if (!dateValue) return null;
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return null;
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function formatDashboardMoney(value) {
    return `${new Intl.NumberFormat('fr-FR', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(value || 0)} FCFA`;
}

function renderDashboardEmptyState(container, message) {
    if (!container) return;
    container.innerHTML = `<p class="dashboard-empty-state">${message}</p>`;
}

function updateDashboardStatCards(stats) {
    const cardValues = {
        clients_actifs: stats.clients_actifs ?? 0,
        contrats_actifs: stats.contrats_actifs ?? 0,
        renouvellements_a_venir: stats.renouvellements_a_venir ?? 0,
        expires_ce_mois: stats.expires_ce_mois ?? 0
    };

    document.querySelectorAll('#dashboardStatsGrid .dashboard-stat-card').forEach(card => {
        const type = card.getAttribute('data-stat-type');
        const valueElement = card.querySelector('h3');
        if (valueElement) {
            valueElement.textContent = cardValues[type] ?? 0;
        }
        card.classList.toggle('active', type === dashboardState.selectedStat);
    });
}

function getDashboardStatEntries(type) {
    const contracts = dashboardState.contracts || [];
    const clients = dashboardState.clients || [];
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    if (type === 'clients_actifs') {
        return clients
            .filter(client => client.client_statut === 'actif')
            .map(client => ({
                title: client.nom || 'Client',
                subtitle: client.telephone || 'Telephone non renseigne',
                meta: client.dernier_contrat ? `Echeance ${formatDate(client.dernier_contrat)}` : 'Aucune echeance',
                badge: 'Actif',
                badgeClass: 'badge-success'
            }));
    }

    if (type === 'contrats_actifs') {
        return contracts
            .filter(contract => contract.statut === 'actif')
            .map(contract => ({
                title: contract.client_nom || 'Client',
                subtitle: `${contract.numero_contrat || 'Contrat sans numero'}${contract.immatriculation ? ` · ${contract.immatriculation}` : ''}`,
                meta: contract.date_fin ? `Echeance ${formatDate(contract.date_fin)}` : 'Date indisponible',
                badge: 'Actif',
                badgeClass: 'badge-success'
            }));
    }

    if (type === 'renouvellements_a_venir') {
        return contracts
            .filter(contract => contract.alerte_renouvellement)
            .map(contract => {
                const joursRestants = contract.jours_restants || 0;
                return {
                    title: contract.client_nom || 'Client',
                    subtitle: `${contract.numero_contrat || 'Contrat'}${contract.immatriculation ? ` · ${contract.immatriculation}` : ''}`,
                    meta: `Renouvellement dans ${joursRestants} jour${joursRestants > 1 ? 's' : ''}`,
                    badge: joursRestants <= 3 ? 'Urgent' : 'A suivre',
                    badgeClass: joursRestants <= 3 ? 'badge-warning' : 'badge-info'
                };
            });
    }

    if (type === 'expires_ce_mois') {
        return contracts
            .filter(contract => {
                if (contract.statut !== 'expire' || !contract.date_fin) return false;
                const endDate = new Date(contract.date_fin);
                return endDate.getMonth() === currentMonth && endDate.getFullYear() === currentYear;
            })
            .map(contract => ({
                title: contract.client_nom || 'Client',
                subtitle: `${contract.numero_contrat || 'Contrat'}${contract.immatriculation ? ` · ${contract.immatriculation}` : ''}`,
                meta: contract.date_fin ? `Expire le ${formatDate(contract.date_fin)}` : 'Expire ce mois',
                badge: 'Expire',
                badgeClass: 'badge-danger'
            }));
    }

    return [];
}

function renderDashboardStatDetails(type) {
    const titleMap = {
        clients_actifs: 'Clients actifs',
        contrats_actifs: 'Contrats actifs',
        renouvellements_a_venir: 'Renouvellements a venir',
        expires_ce_mois: 'Assurances expirees ce mois'
    };

    const titleElement = document.getElementById('dashboardDetailTitle');
    const container = document.getElementById('dashboardStatDetails');
    if (titleElement) {
        titleElement.textContent = titleMap[type] || 'Details';
    }

    const entries = getDashboardStatEntries(type).slice(0, 8);
    if (!entries.length) {
        renderDashboardEmptyState(container, 'Aucun client correspondant pour le moment.');
        return;
    }

    container.innerHTML = `
        <div class="dashboard-detail-list">
            ${entries.map(entry => `
                <div class="dashboard-detail-item">
                    <div class="dashboard-detail-main">
                        <h4>${entry.title}</h4>
                        <p>${entry.subtitle}</p>
                    </div>
                    <div style="text-align: right;">
                        <span class="badge ${entry.badgeClass}">${entry.badge}</span>
                        <p class="dashboard-detail-meta">${entry.meta}</p>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

function bindDashboardStatCards() {
    document.querySelectorAll('#dashboardStatsGrid .dashboard-stat-card').forEach(card => {
        if (card.dataset.bound === 'true') {
            return;
        }

        card.dataset.bound = 'true';
        card.addEventListener('click', function() {
            dashboardState.selectedStat = this.getAttribute('data-stat-type') || 'clients_actifs';
            document.querySelectorAll('#dashboardStatsGrid .dashboard-stat-card').forEach(item => {
                item.classList.toggle('active', item === this);
            });
            renderDashboardStatDetails(dashboardState.selectedStat);
        });
    });
}

function renderRecentActivity(clients, contracts) {
    const container = document.getElementById('recentActivity');
    if (!container) return;

    const activities = [];

    clients.forEach(client => {
        if (client.created_at) {
            activities.push({
                type: 'client',
                title: 'Nouveau client ajoute',
                description: client.nom || 'Client',
                date: client.created_at,
                icon: 'fa-user-plus'
            });
        }
    });

    contracts.forEach(contract => {
        if (contract.created_at) {
            activities.push({
                type: 'contract',
                title: 'Nouveau contrat cree',
                description: `${contract.client_nom || 'Client'} · ${contract.numero_contrat || 'Sans numero'}`,
                date: contract.created_at,
                icon: 'fa-file-circle-plus'
            });
        }

        const montantPaye = parseFloat(contract.montant_paye) || 0;
        if (montantPaye > 0 && contract.updated_at) {
            activities.push({
                type: 'payment',
                title: 'Paiement enregistre',
                description: `${contract.client_nom || 'Client'} · ${formatDashboardMoney(montantPaye)}`,
                date: contract.updated_at,
                icon: 'fa-money-bill-wave'
            });
        }
    });

    activities.sort((left, right) => new Date(right.date) - new Date(left.date));
    const recentActivities = activities.slice(0, 6);

    if (!recentActivities.length) {
        renderDashboardEmptyState(container, 'Aucune activite recente');
        return;
    }

    container.innerHTML = recentActivities.map(activity => `
        <div class="activity-item">
            <div class="activity-icon">
                <i class="fas ${activity.icon}"></i>
            </div>
            <div class="activity-content">
                <h4>${activity.title}</h4>
                <p>${activity.description} · ${formatTimeAgo(activity.date)}</p>
            </div>
        </div>
    `).join('');
}

function renderContractsToRenew(contracts) {
    const contractsContainer = document.getElementById('contractsToRenew');
    if (!contractsContainer) return;

    const contractsToRenew = contracts
        .filter(contract => contract.alerte_renouvellement)
        .sort((left, right) => (left.jours_restants || 0) - (right.jours_restants || 0))
        .slice(0, 6);

    if (!contractsToRenew.length) {
        renderDashboardEmptyState(contractsContainer, 'Aucun contrat a renouveler');
        return;
    }

    contractsContainer.innerHTML = contractsToRenew.map(contract => {
        const joursRestants = contract.jours_restants || 0;
        const badgeClass = joursRestants <= 3 ? 'badge-warning' : 'badge-info';
        const badgeText = joursRestants <= 3 ? 'Urgent' : 'A suivre';
        return `
            <div class="contract-item">
                <div class="contract-info">
                    <h4>${contract.client_nom || 'Client'}</h4>
                    <p>${contract.numero_contrat || 'Contrat'} · echeance ${formatDate(contract.date_fin)}</p>
                </div>
                <div style="text-align: right;">
                    <span class="badge ${badgeClass}">${badgeText}</span>
                    <p class="dashboard-detail-meta">${joursRestants} jour${joursRestants > 1 ? 's' : ''}</p>
                </div>
            </div>
        `;
    }).join('');
}

function renderDashboardAlert(stats) {
    const alertCard = document.getElementById('alertCard');
    if (!alertCard) return;

    if ((stats.renouvellements_a_venir ?? 0) > 0) {
        alertCard.innerHTML = `
            <div class="alert-icon">
                <i class="fas fa-exclamation-circle"></i>
            </div>
            <div class="alert-content">
                <h4>Renouvellement a venir</h4>
                <p>${stats.renouvellements_a_venir} contrat${stats.renouvellements_a_venir > 1 ? 's arrivent' : ' arrive'} a echeance dans les 7 prochains jours</p>
            </div>
            <button class="btn-primary" onclick="goToRapportsWithRenewals()">Voir details</button>
        `;
        return;
    }

    alertCard.innerHTML = `
        <div class="alert-icon">
            <i class="fas fa-check-circle"></i>
        </div>
        <div class="alert-content">
            <h4>Tout est a jour</h4>
            <p>Aucun renouvellement urgent a prevoir</p>
        </div>
    `;
}

function updateDashboardNotificationBadge(notifications) {
    const badge = document.querySelector('.notifications .badge');
    if (!badge) return;
    badge.textContent = notifications.length;
    badge.style.display = notifications.length > 0 ? 'flex' : 'none';
}

function buildDashboardMonthlySeries(contracts) {
    const buckets = dashboardMonthBuckets(6);
    const renewalsMap = Object.fromEntries(buckets.map(bucket => [bucket.key, 0]));
    const expiredMap = Object.fromEntries(buckets.map(bucket => [bucket.key, 0]));
    const paymentsMap = Object.fromEntries(buckets.map(bucket => [bucket.key, 0]));
    const profitMap = Object.fromEntries(buckets.map(bucket => [bucket.key, 0]));

    contracts.forEach(contract => {
        const renewalKey = contract.statut === 'renouvele'
            ? getDashboardMonthKey(contract.updated_at || contract.date_fin)
            : null;
        const expiredKey = contract.statut === 'expire'
            ? getDashboardMonthKey(contract.date_fin || contract.updated_at)
            : null;
        const paymentKey = (parseFloat(contract.montant_paye) || 0) > 0
            ? getDashboardMonthKey(contract.updated_at || contract.created_at || contract.date_debut)
            : null;
        const profitKey = getDashboardMonthKey(contract.date_debut || contract.created_at);

        if (renewalKey && renewalKey in renewalsMap) {
            renewalsMap[renewalKey] += 1;
        }

        if (expiredKey && expiredKey in expiredMap) {
            expiredMap[expiredKey] += 1;
        }

        if (paymentKey && paymentKey in paymentsMap) {
            paymentsMap[paymentKey] += parseFloat(contract.montant_paye) || 0;
        }

        if (profitKey && profitKey in profitMap) {
            profitMap[profitKey] += (parseFloat(contract.montant_paye) || 0) - (parseFloat(contract.montant) || 0);
        }
    });

    return {
        labels: buckets.map(bucket => bucket.label),
        renewals: buckets.map(bucket => renewalsMap[bucket.key]),
        expired: buckets.map(bucket => expiredMap[bucket.key]),
        payments: buckets.map(bucket => paymentsMap[bucket.key]),
        profit: buckets.map(bucket => profitMap[bucket.key])
    };
}

function renderDashboardChart(chartKey, canvasId, config) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || typeof Chart === 'undefined') {
        return;
    }

    if (dashboardCharts[chartKey]) {
        dashboardCharts[chartKey].destroy();
    }

    dashboardCharts[chartKey] = new Chart(canvas, config);
}

function renderDashboardCharts(contracts) {
    const series = buildDashboardMonthlySeries(contracts);

    renderDashboardChart('renewals', 'dashboardRenewalsChart', {
        type: 'line',
        data: {
            labels: series.labels,
            datasets: [{
                label: 'Renouvellements',
                data: series.renewals,
                borderColor: '#F59E0B',
                backgroundColor: 'rgba(245, 158, 11, 0.14)',
                fill: true,
                tension: 0.35
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false
        }
    });

    renderDashboardChart('expired', 'dashboardExpiredChart', {
        type: 'bar',
        data: {
            labels: series.labels,
            datasets: [{
                label: 'Expirees',
                data: series.expired,
                backgroundColor: 'rgba(139, 92, 246, 0.72)',
                borderColor: '#8B5CF6',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false
        }
    });

    renderDashboardChart('payments', 'dashboardPaymentsChart', {
        type: 'line',
        data: {
            labels: series.labels,
            datasets: [{
                label: 'Paiements',
                data: series.payments,
                borderColor: '#10B981',
                backgroundColor: 'rgba(16, 185, 129, 0.14)',
                fill: true,
                tension: 0.35
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    ticks: {
                        callback: value => formatDashboardMoney(value)
                    }
                }
            }
        }
    });

    renderDashboardChart('profit', 'dashboardProfitChart', {
        type: 'bar',
        data: {
            labels: series.labels,
            datasets: [{
                label: 'Benefice',
                data: series.profit,
                backgroundColor: series.profit.map(value => value >= 0 ? 'rgba(37, 99, 235, 0.72)' : 'rgba(239, 68, 68, 0.72)'),
                borderColor: series.profit.map(value => value >= 0 ? '#2563EB' : '#EF4444'),
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    ticks: {
                        callback: value => formatDashboardMoney(value)
                    }
                }
            }
        }
    });
}

async function loadDashboard() {
    try {
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        if (!token) {
            window.location.href = '/login.html';
            return;
        }
        
        if (!window.api || !window.api.stats || !window.api.clients || !window.api.contracts) {
            throw new Error('API non chargée');
        }
<<<<<<< HEAD
        
        // Charger les statistiques depuis Supabase
        const stats = await window.api.stats.getDashboard();
        console.log('Statistiques reçues:', stats);

        // Stocker les stats globalement pour les fonctions de détails
        window.lastDashboardStats = stats;
        
        // Mettre à jour les cartes de statistiques
        const statsCards = document.querySelectorAll('.stat-card');
        if (statsCards.length >= 4) {
            // Toujours mettre à jour les valeurs depuis la base de données
            const h3_0 = statsCards[0].querySelector('h3');
            const h3_1 = statsCards[1].querySelector('h3');
            const h3_2 = statsCards[2].querySelector('h3');
            const h3_3 = statsCards[3].querySelector('h3');
            
            if (h3_0) h3_0.textContent = stats.clients_actifs ?? 0;
            if (h3_1) h3_1.textContent = stats.contrats_actifs ?? 0;
            if (h3_2) h3_2.textContent = stats.renouvellements_a_venir ?? 0;
            if (h3_3) h3_3.textContent = stats.expires_ce_mois ?? 0;
            console.log('Statistiques mises à jour:', {
                clients: stats.clients_actifs ?? 0,
                contrats: stats.contrats_actifs ?? 0,
                renouvellements: stats.renouvellements_a_venir ?? 0,
                expires: stats.expires_ce_mois ?? 0
            });
        }
        
        // Charger les notifications (gérer les erreurs silencieusement)
        try {
            if (!window.api || !window.api.notifications) {
                console.warn('API notifications non chargée');
            } else {
                const notificationsData = await window.api.notifications.getAll('false');
                const notifications = notificationsData.notifications || [];
                
                // Mettre à jour le badge de notifications
                const badge = document.querySelector('.notifications .badge');
                if (badge) {
                    badge.textContent = notifications.length;
                    badge.style.display = notifications.length > 0 ? 'flex' : 'none';
                }
            }
        } catch (notifError) {
            console.warn('Erreur lors du chargement des notifications:', notifError);
            // Ne pas bloquer le dashboard si les notifications échouent
        }
        
        // Mettre à jour la carte d'alerte
        const alertCard = document.getElementById('alertCard');
        if (alertCard) {
            if (stats.renouvellements_a_venir > 0) {
                const contratsHtml = stats.contrats_renouvellement.map(contrat => {
                    const clientNom = `${contrat.clients?.nom || ''} ${contrat.clients?.prenom || ''}`.trim();
                    const dateFin = formatDate(contrat.date_fin);
                    return `
                        <div class="renewal-client-card" onclick="showClientDetails(${contrat.clients?.id || contrat.client_id})" style="cursor: pointer; padding: 0.75rem; border: 1px solid #e5e7eb; border-radius: 0.5rem; margin-bottom: 0.5rem; background: #f9fafb; transition: background-color 0.2s;">
                            <div style="font-weight: 500; color: #1f2937;">${clientNom || 'Client inconnu'}</div>
                            <div style="font-size: 0.875rem; color: #6b7280;">Échéance: ${dateFin}</div>
                        </div>
                    `;
                }).join('');

                alertCard.innerHTML = `
                    <div class="alert-icon">
                        <i class="fas fa-exclamation-circle"></i>
                    </div>
                    <div class="alert-content">
                        <h4>Renouvellement à venir</h4>
                        <p>${stats.renouvellements_a_venir} contrat${stats.renouvellements_a_venir > 1 ? 's' : ''} ${stats.renouvellements_a_venir > 1 ? 'arrivent' : 'arrive'} à échéance dans les 7 prochains jours</p>
                        <div class="renewal-clients-list" style="margin-top: 1rem; max-height: 200px; overflow-y: auto;">
                            ${contratsHtml}
                        </div>
                    </div>
                    <button class="btn-primary" onclick="goToRapportsWithRenewals()">Voir tous les détails</button>
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
        if (!window.api || !window.api.contracts) {
            throw new Error('API non chargée');
        }
        
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
        if (activityContainer && window.api && window.api.clients) {
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
=======
        const [stats, clientsData, contractsData, notificationsData] = await Promise.all([
            window.api.stats.getDashboard(),
            window.api.clients.getAll('', '', '', 0, 1000),
            window.api.contracts.getAll({ offset: 0, limit: 1000 }),
            window.api.notifications
                ? window.api.notifications.getAll('false').catch(() => ({ notifications: [] }))
                : Promise.resolve({ notifications: [] })
        ]);

        dashboardState.clients = clientsData.clients || [];
        dashboardState.contracts = contractsData.contrats || [];

        updateDashboardStatCards(stats);
        bindDashboardStatCards();
        renderDashboardStatDetails(dashboardState.selectedStat);
        updateDashboardNotificationBadge(notificationsData.notifications || []);
        renderDashboardAlert(stats);
        renderContractsToRenew(dashboardState.contracts);
        renderRecentActivity(dashboardState.clients, dashboardState.contracts);
        renderDashboardCharts(dashboardState.contracts);
>>>>>>> 8a46343e2d6d5d87e5b45a1228c72c48f24ca627
    } catch (error) {
        console.error('Erreur lors du chargement du dashboard:', error);
        showToast('Erreur lors du chargement du dashboard', 'error');
    }
}

// ============================================
// GESTION DES CLIENTS
// ============================================

// Variable globale pour la catégorie actuelle
let currentClientCategory = 'VP/CI';
let currentVehicleTypeFilter = 'all';
// Variable globale pour la pagination
let currentPage = 1;
const clientsPerPage = 20;

function getClientVehicleTypeFilter() {
    const select = document.getElementById('vehicleTypeFilter');
    return select ? select.value : 'all';
}

function updateVehicleTypeFilterVisibility() {
    const wrapper = document.getElementById('vehicleTypeFilterWrap');
    if (!wrapper) return;
    wrapper.style.display = currentClientCategory === 'VP/CI' ? 'flex' : 'none';
}

// Fonction pour changer de catégorie
function switchClientCategory(category) {
    currentClientCategory = category;
    currentPage = 1;
    currentVehicleTypeFilter = 'all';
    
    // Mettre à jour les onglets actifs
    document.querySelectorAll('.category-tab').forEach(tab => {
        tab.classList.remove('active');
        if (tab.getAttribute('data-category') === category) {
            tab.classList.add('active');
        }
    });

    const vehicleTypeSelect = document.getElementById('vehicleTypeFilter');
    if (vehicleTypeSelect) {
        vehicleTypeSelect.value = 'all';
    }

    updateVehicleTypeFilterVisibility();
    
    // Recharger les clients avec la nouvelle catégorie
    loadClients();
}

async function loadClients() {
    try {
        // Récupérer le filtre de statut actif
        const activeFilter = document.querySelector('#clients-page .btn-filter.active');
        const filterType = activeFilter ? activeFilter.getAttribute('data-filter') : 'all';
        let statut = '';
        
        // Déterminer le statut en fonction du type de filtre
        if (filterType === 'actif') {
            statut = 'actif';
        } else if (filterType === 'inactif') {
            statut = 'inactif';
        }
        
        // Récupérer le terme de recherche
        const searchInput = document.getElementById('clientSearchInput');
        const searchTerm = searchInput ? searchInput.value : '';
        
        // Charger les clients avec le filtre approprié
        await loadClientsWithFilter(searchTerm, statut, filterType);
    } catch (error) {
        console.error('Erreur lors du chargement des clients:', error);
        showToast('Erreur lors du chargement des clients', 'error');
    }
}

function renderClientsTable(clients) {
    const tbody = document.getElementById('clientsTableBody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (clients.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem; color: #6B7280;">Aucun client trouvé</td></tr>';
        return;
    }
    
    clients.forEach(client => {
        const vehicule = client.vehicules && client.vehicules.length > 0 ? client.vehicules[0] : null;
        const immatriculation = vehicule ? vehicule.immatriculation || '-' : '-';
        const dateEcheance = client.dernier_contrat ? formatDate(client.dernier_contrat) : '-';

        let telephoneDisplay = '-';
        if (client.telephone && !client.telephone.startsWith('TEMP-')) {
            telephoneDisplay = client.telephone;
        }

        const nomComplet = client.nom || '-';
        const statutLabel = client.client_statut === 'actif' ? 'Actif' : 'Inactif';
        const statutClass = client.client_statut === 'actif' ? 'badge-success' : 'badge-danger';
        
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
            <td><span class="badge ${statutClass}">${statutLabel}</span></td>
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
            // Vérifier que l'API est chargée
            if (!window.api || !window.api.clients) {
                throw new Error('API non chargée');
            }
            
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

function showClientDetails(clientId) {
    // Utiliser la fonction viewClient de modals.js pour afficher les détails du client
    if (typeof window.viewClient === 'function') {
        window.viewClient(clientId);
    } else {
        console.error('Fonction viewClient non disponible');
    }
}

function showActiveContractsDetails() {
    const modal = document.getElementById('activeContractsModal');
    const content = document.getElementById('activeContractsContent');

    // Récupérer les données des contrats actifs depuis le cache ou refaire l'appel
    loadDashboard().then(() => {
        // Les données devraient être disponibles dans la variable globale ou via un nouvel appel
        // Pour l'instant, on simule avec les données du dashboard récent
        if (window.lastDashboardStats && window.lastDashboardStats.contrats_actifs_data) {
            const contrats = window.lastDashboardStats.contrats_actifs_data;
            if (contrats.length === 0) {
                content.innerHTML = '<p>Aucun contrat actif trouvé</p>';
            } else {
                const contratsHtml = contrats.map(contrat => {
                    const clientNom = `${contrat.clients?.nom || ''} ${contrat.clients?.prenom || ''}`.trim();
                    const dateFin = formatDate(contrat.date_fin);
                    return `
                        <div class="contract-item" onclick="showClientDetails(${contrat.clients?.id || contrat.client_id})" style="cursor: pointer; padding: 0.75rem; border: 1px solid #e5e7eb; border-radius: 0.5rem; margin-bottom: 0.5rem; background: #f9fafb; transition: background-color 0.2s;">
                            <div style="font-weight: 500; color: #1f2937;">${clientNom || 'Client inconnu'}</div>
                            <div style="font-size: 0.875rem; color: #6b7280;">Contrat: ${contrat.numero_contrat || contrat.numero_police || 'N/A'} - Expire: ${dateFin}</div>
                        </div>
                    `;
                }).join('');
                content.innerHTML = `<div style="max-height: 400px; overflow-y: auto;">${contratsHtml}</div>`;
            }
        } else {
            content.innerHTML = '<p>Erreur lors du chargement des données</p>';
        }
    });

    modal.classList.add('show');
}

function closeActiveContractsModal() {
    document.getElementById('activeContractsModal').classList.remove('show');
}

function showExpiringContractsDetails() {
    const modal = document.getElementById('expiringContractsModal');
    const content = document.getElementById('expiringContractsContent');

    // Récupérer les données des contrats expirant depuis le cache ou refaire l'appel
    loadDashboard().then(() => {
        if (window.lastDashboardStats && window.lastDashboardStats.contrats_expires_data) {
            const contrats = window.lastDashboardStats.contrats_expires_data;
            if (contrats.length === 0) {
                content.innerHTML = '<p>Aucun contrat n\'expire ce mois</p>';
            } else {
                const contratsHtml = contrats.map(contrat => {
                    const clientNom = `${contrat.clients?.nom || ''} ${contrat.clients?.prenom || ''}`.trim();
                    const dateFin = formatDate(contrat.date_fin);
                    return `
                        <div class="contract-item" onclick="showClientDetails(${contrat.clients?.id || contrat.client_id})" style="cursor: pointer; padding: 0.75rem; border: 1px solid #e5e7eb; border-radius: 0.5rem; margin-bottom: 0.5rem; background: #f9fafb; transition: background-color 0.2s;">
                            <div style="font-weight: 500; color: #1f2937;">${clientNom || 'Client inconnu'}</div>
                            <div style="font-size: 0.875rem; color: #6b7280;">Contrat: ${contrat.numero_contrat || contrat.numero_police || 'N/A'} - Expire: ${dateFin}</div>
                        </div>
                    `;
                }).join('');
                content.innerHTML = `<div style="max-height: 400px; overflow-y: auto;">${contratsHtml}</div>`;
            }
        } else {
            content.innerHTML = '<p>Erreur lors du chargement des données</p>';
        }
    });

    modal.classList.add('show');
}

function closeExpiringContractsModal() {
    document.getElementById('expiringContractsModal').classList.remove('show');
}

// ============================================
// GESTION DES CONTRATS
// ============================================

async function loadContrats() {
    try {
        // Vérifier que l'API est chargée
        if (!window.api || !window.api.contracts) {
            throw new Error('API non chargée');
        }
        
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
            // Vérifier que l'API est chargée
            if (!window.api || !window.api.contracts) {
                throw new Error('API non chargée');
            }
            
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
                        const filterType = activeFilter ? activeFilter.getAttribute('data-filter') : 'all';
                        let statut = '';
                        if (filterType === 'actif') statut = 'actif';
                        else if (filterType === 'inactif') statut = 'inactif';
                        
                        // Utiliser loadClientsWithFilter pour une gestion cohérente
                        await loadClientsWithFilter(searchTerm, statut, filterType);
                    } catch (error) {
                        console.error('Erreur de recherche:', error);
                        showToast('Erreur lors de la recherche', 'error');
                    }
                }
                // Si on est sur la page contrats
                else if (document.getElementById('contrats-page') && document.getElementById('contrats-page').classList.contains('active')) {
                    try {
                        if (!window.api || !window.api.contracts) {
                            throw new Error('API non chargée');
                        }
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
    const filterButtons = document.querySelectorAll('#clients-page .btn-filter');
    
    filterButtons.forEach(button => {
        button.addEventListener('click', async function() {
            // Retirer la classe active de tous les boutons
            filterButtons.forEach(btn => btn.classList.remove('active'));
            
            // Ajouter la classe active au bouton cliqué
            this.classList.add('active');
            
            // Réinitialiser la pagination lors du changement de filtre
            currentPage = 1;
            
            // Filtrer les clients
            if (document.getElementById('clients-page') && document.getElementById('clients-page').classList.contains('active')) {
                try {
                    // Récupérer la valeur de recherche actuelle
                    const searchInput = document.getElementById('clientSearchInput');
                    const searchTerm = searchInput ? searchInput.value : '';
                    
                    let statut = '';
                    const filterType = this.getAttribute('data-filter');
                    if (filterType === 'actif') statut = 'actif';
                    else if (filterType === 'inactif') statut = 'inactif';
                    
                    // Charger les clients avec les paramètres appropriés
                    await loadClientsWithFilter(searchTerm, statut, filterType);
                } catch (error) {
                    console.error('Erreur de filtrage:', error);
                    showToast('Erreur lors du filtrage', 'error');
                }
            }
        });
    });

    const vehicleTypeSelect = document.getElementById('vehicleTypeFilter');
    if (vehicleTypeSelect && vehicleTypeSelect.dataset.bound !== 'true') {
        vehicleTypeSelect.dataset.bound = 'true';
        vehicleTypeSelect.addEventListener('change', async function() {
            currentVehicleTypeFilter = this.value;
            currentPage = 1;

            const activeFilter = document.querySelector('#clients-page .btn-filter.active');
            const filterType = activeFilter ? activeFilter.getAttribute('data-filter') : 'all';
            let statut = '';
            if (filterType === 'actif') statut = 'actif';
            else if (filterType === 'inactif') statut = 'inactif';

            const searchInput = document.getElementById('clientSearchInput');
            const searchTerm = searchInput ? searchInput.value : '';

            await loadClientsWithFilter(searchTerm, statut, filterType);
        });
    }

    updateVehicleTypeFilterVisibility();
}

// Nouvelle fonction pour charger les clients avec gestion des filtres spéciaux
async function loadClientsWithFilter(searchTerm = '', statut = '', filterType = '') {
    try {
        // Calculer l'offset pour la pagination
        const offset = (currentPage - 1) * clientsPerPage;
        
        // Préparer les paramètres pour l'appel API
        let categorie = currentClientCategory;
        let expireFilter = false;
        let expiringSoonFilter = false;
        if (filterType === 'expirant_soon') {
            expiringSoonFilter = true;
            statut = '';
        }
        if (filterType === 'inactif') {
            expireFilter = true;
        }

        const vehicleType = currentClientCategory === 'VP/CI' ? getClientVehicleTypeFilter() : 'all';
        currentVehicleTypeFilter = vehicleType;

        const data = await window.api.clients.getAll(
            searchTerm,
            statut,
            categorie,
            offset,
            clientsPerPage,
            expireFilter,
            expiringSoonFilter,
            vehicleType
        );
        const clients = data.clients || [];
        const total = data.total || 0;
        
        // Rendre le tableau des clients
        renderClientsTable(clients);
        
        // Mettre à jour la pagination avec le total réel
        updatePagination(total);
    } catch (error) {
        console.error('Erreur lors du chargement des clients avec filtre:', error);
        showToast('Erreur lors du chargement des clients', 'error');
    }
}

// Initialiser les filtres au chargement
document.addEventListener('DOMContentLoaded', function() {
    setupSearch();
    setupFilters();
    updateVehicleTypeFilterVisibility();
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
    window.location.href = '/login.html';
}

// Exposer logout globalement
window.logout = logout;

// ============================================
// AFFICHER TOUTES LES NOTIFICATIONS
// ============================================

async function showAllNotifications() {
    console.log('showAllNotifications appelée');
    try {
        if (!window.api || !window.api.notifications) {
            console.error('API notifications non disponible', window.api);
            if (typeof window.showToast === 'function') {
                window.showToast('API notifications non disponible', 'error');
            } else {
                console.error('API notifications non disponible');
                alert('API notifications non disponible');
            }
            return;
        }
        
        // Charger toutes les notifications (sans filtre lu/non lu)
        // Passer une chaîne vide pour obtenir toutes les notifications
        const data = await window.api.notifications.getAll('');
        const notifications = data.notifications || [];
        console.log('Notifications chargées:', notifications.length, notifications);
        
        // Trier par date (plus récentes en premier) et par statut lu (non lues en premier)
        notifications.sort((a, b) => {
            // D'abord trier par statut lu (non lues en premier)
            if (a.lu !== b.lu) {
                return a.lu ? 1 : -1;
            }
            // Ensuite par date (plus récentes en premier)
            return new Date(b.created_at) - new Date(a.created_at);
        });
        
        // Créer la modal
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'flex';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 800px; max-height: 80vh; overflow-y: auto;">
                <div class="modal-header">
                    <h2>Alertes et notifications</h2>
                    <button class="modal-close" onclick="this.closest('.modal').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    ${notifications.length === 0 ? `
                        <div style="text-align: center; padding: 3rem;">
                            <i class="fas fa-check-circle" style="font-size: 3rem; color: var(--color-success); margin-bottom: 1rem;"></i>
                            <p style="color: var(--color-text-secondary); font-size: 1.1rem;">Aucune notification</p>
                        </div>
                    ` : `
                        <div class="notifications-list">
                            ${notifications.map(notif => {
                                const date = new Date(notif.created_at);
                                const dateStr = date.toLocaleDateString('fr-FR', { 
                                    day: '2-digit', 
                                    month: '2-digit', 
                                    year: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                });
                                
                                const iconMap = {
                                    'renouvellement': 'fa-exclamation-circle',
                                    'expiration': 'fa-clock',
                                    'paiement': 'fa-money-bill',
                                    'info': 'fa-info-circle'
                                };
                                
                                const colorMap = {
                                    'renouvellement': 'var(--color-accent)',
                                    'expiration': 'var(--color-danger)',
                                    'paiement': 'var(--color-success)',
                                    'info': 'var(--color-primary)'
                                };
                                
                                const icon = iconMap[notif.type] || 'fa-bell';
                                const color = colorMap[notif.type] || 'var(--color-text-secondary)';
                                
                                return `
                                    <div class="notification-item" style="padding: 1rem; border-bottom: 1px solid var(--color-border); display: flex; gap: 1rem; align-items: start; ${notif.lu ? 'opacity: 0.7;' : 'background: rgba(37, 99, 235, 0.05);'}">
                                        <div style="width: 40px; height: 40px; border-radius: 50%; background: ${color}20; color: ${color}; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                                            <i class="fas ${icon}"></i>
                                        </div>
                                        <div style="flex: 1;">
                                            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.5rem;">
                                                <h4 style="margin: 0; font-size: 1rem; color: var(--color-text);">${notif.titre || 'Notification'}</h4>
                                                ${!notif.lu ? `<span style="background: var(--color-primary); color: white; padding: 0.25rem 0.5rem; border-radius: 12px; font-size: 0.75rem;">Nouveau</span>` : ''}
                                            </div>
                                            <p style="margin: 0 0 0.5rem 0; color: var(--color-text-secondary); font-size: 0.9rem;">${notif.message || ''}</p>
                                            ${notif.numero_contrat ? `<p style="margin: 0 0 0.5rem 0; color: var(--color-text-secondary); font-size: 0.85rem;"><strong>Contrat:</strong> ${notif.numero_contrat}</p>` : ''}
                                            <p style="margin: 0; color: var(--color-text-secondary); font-size: 0.8rem;">${dateStr}</p>
                                        </div>
                                        ${!notif.lu ? `
                                            <button class="btn-secondary" style="padding: 0.5rem 1rem; font-size: 0.85rem;" onclick="markNotificationAsRead(${notif.id}, this)">
                                                Marquer comme lu
                                            </button>
                                        ` : ''}
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    `}
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Fermer la modal en cliquant en dehors
        modal.addEventListener('click', function(e) {
            if (e.target === modal) {
                modal.remove();
            }
        });
        
    } catch (error) {
        console.error('Erreur lors du chargement des notifications:', error);
        if (typeof window.showToast === 'function') {
            window.showToast('Erreur lors du chargement des notifications: ' + (error.message || 'Erreur inconnue'), 'error');
        } else {
            alert('Erreur lors du chargement des notifications: ' + (error.message || 'Erreur inconnue'));
        }
    }
}

// Marquer une notification comme lue
async function markNotificationAsRead(id, button) {
    try {
        if (!window.api || !window.api.notifications) {
            return;
        }
        
        await window.api.notifications.markAsRead(id);
        
        // Mettre à jour l'interface
        const notificationItem = button.closest('.notification-item');
        if (notificationItem) {
            notificationItem.style.opacity = '0.7';
            notificationItem.style.background = 'transparent';
            button.remove();
            
            // Retirer le badge "Nouveau"
            const badge = notificationItem.querySelector('span');
            if (badge) badge.remove();
        }
        
        // Mettre à jour le badge de notifications dans la barre de navigation
        const badge = document.querySelector('.notifications .badge');
        if (badge) {
            const count = parseInt(badge.textContent) || 0;
            if (count > 0) {
                badge.textContent = count - 1;
                if (count - 1 === 0) {
                    badge.style.display = 'none';
                }
            }
        }
        
    } catch (error) {
        console.error('Erreur lors du marquage de la notification:', error);
        if (typeof window.showToast === 'function') {
            window.showToast('Erreur lors du marquage de la notification: ' + (error.message || 'Erreur inconnue'), 'error');
        } else {
            console.error('Erreur lors du marquage de la notification:', error);
        }
    }
}

// Rediriger vers l'onglet rapports avec focus sur les renouvellements
function goToRapportsWithRenewals() {
    // Activer l'onglet rapports
    const rapportsTab = document.querySelector('[data-page="rapports"]');
    if (rapportsTab) {
        rapportsTab.click();
        // Scroll vers le haut de la page des rapports
        setTimeout(() => {
            const rapportsPage = document.getElementById('rapports-page');
            if (rapportsPage) {
                rapportsPage.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }, 100);
    }
}

// Exposer les fonctions globalement
window.showAllNotifications = showAllNotifications;
window.markNotificationAsRead = markNotificationAsRead;
window.goToRapportsWithRenewals = goToRapportsWithRenewals;
window.switchClientCategory = switchClientCategory;

// Fonctions de pagination
function updatePagination(total) {
    const totalPages = Math.ceil(total / clientsPerPage);
    const pageInfo = document.getElementById('pageInfo');
    const prevBtn = document.getElementById('prevPage');
    const nextBtn = document.getElementById('nextPage');
    
    if (pageInfo) {
        pageInfo.textContent = `Page ${currentPage} sur ${totalPages}`;
    }
    
    if (prevBtn) {
        prevBtn.disabled = currentPage <= 1;
    }
    
    if (nextBtn) {
        nextBtn.disabled = currentPage >= totalPages || totalPages === 0;
    }
}

// Gestionnaires d'événements pour la pagination
document.addEventListener('DOMContentLoaded', function() {
    const prevBtn = document.getElementById('prevPage');
    const nextBtn = document.getElementById('nextPage');
    
    if (prevBtn) {
        prevBtn.addEventListener('click', function() {
            if (currentPage > 1) {
                currentPage--;
                loadClients();
            }
        });
    }
    
    if (nextBtn) {
        nextBtn.addEventListener('click', function() {
            // Utiliser le total global pour calculer les pages
            // Le total est stocké dans une variable globale ou on peut le récupérer du DOM
            const pageInfo = document.getElementById('pageInfo');
            let totalPages = 1;
            if (pageInfo) {
                const match = pageInfo.textContent.match(/Page \d+ sur (\d+)/);
                if (match) {
                    totalPages = parseInt(match[1]) || 1;
                }
            }
            if (currentPage < totalPages) {
                currentPage++;
                loadClients();
            }
        });
    }
});
