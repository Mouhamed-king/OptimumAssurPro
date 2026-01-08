// ============================================
// CONFIGURATION API ET FONCTIONS UTILITAIRES
// ============================================

const API_BASE_URL = window.location.origin + '/api';

// Fonction pour obtenir le token d'authentification
function getAuthToken() {
    return localStorage.getItem('token') || sessionStorage.getItem('token');
}

// Fonction pour faire une requête API
async function apiRequest(endpoint, options = {}) {
    const token = getAuthToken();
    
    const defaultOptions = {
        headers: {
            'Content-Type': 'application/json',
        }
    };
    
    if (token) {
        defaultOptions.headers['Authorization'] = `Bearer ${token}`;
    }
    
    const finalOptions = {
        ...defaultOptions,
        ...options,
        headers: {
            ...defaultOptions.headers,
            ...options.headers
        }
    };
    
    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, finalOptions);
        
        // Si le token est expiré ou invalide, gérer l'erreur
        if (response.status === 401 || response.status === 403) {
            const errorData = await response.json().catch(() => ({}));
            
            // Ne rediriger que si on n'est pas déjà sur une page publique
            const isPublicPage = window.location.pathname.includes('login.html') || 
                                window.location.pathname.includes('register.html') ||
                                window.location.pathname.includes('verify-email.html') ||
                                window.location.pathname.includes('reset-password.html');
            
            // Si c'est une erreur d'email non confirmé, ne pas déconnecter
            if (errorData.code === 'EMAIL_NOT_CONFIRMED') {
                throw new Error(errorData.error || 'Veuillez vérifier votre email');
            }
            
            // Ne nettoyer le stockage QUE si on est sûr que le token est vraiment invalide
            // et seulement sur les pages protégées (pas sur login.html)
            if (!isPublicPage && response.status === 401) {
                // Token vraiment invalide (401), nettoyer seulement après confirmation
                console.warn('⚠️ Token invalide (401), nettoyage du stockage');
                localStorage.removeItem('token');
                localStorage.removeItem('entreprise');
                sessionStorage.removeItem('token');
                sessionStorage.removeItem('entreprise');
                // Retourner une erreur claire au lieu de rediriger immédiatement
                // Laisser le code appelant gérer la redirection
                throw new Error(errorData.error || 'Token d\'authentification manquant ou invalide');
            } else if (response.status === 403) {
                // Erreur 403 (forbidden) - peut être temporaire, ne pas nettoyer immédiatement
                throw new Error(errorData.error || 'Accès refusé');
            }
        }
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Erreur API');
        }
        
        return data;
    } catch (error) {
        console.error('Erreur API:', error);
        throw error;
    }
}

// ============================================
// API AUTHENTIFICATION
// ============================================

const authAPI = {
    login: async (email, password) => {
        return await apiRequest('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });
    },
    
    register: async (entrepriseData) => {
        return await apiRequest('/auth/register', {
            method: 'POST',
            body: JSON.stringify(entrepriseData)
        });
    },
    
    getMe: async () => {
        return await apiRequest('/auth/me');
    },
    
    updateProfile: async (profileData) => {
        return await apiRequest('/auth/profile', {
            method: 'PUT',
            body: JSON.stringify(profileData)
        });
    },
    
    changePassword: async (currentPassword, newPassword) => {
        return await apiRequest('/auth/change-password', {
            method: 'POST',
            body: JSON.stringify({ currentPassword, newPassword })
        });
    },
    
    resendVerificationEmail: async (data) => {
        return await apiRequest('/auth/resend-verification', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }
};

// ============================================
// API CLIENTS
// ============================================

const clientsAPI = {
    getAll: async (search = '', statut = '') => {
        const params = new URLSearchParams();
        if (search) params.append('search', search);
        if (statut) params.append('statut', statut);
        
        const queryString = params.toString();
        return await apiRequest(`/clients${queryString ? '?' + queryString : ''}`);
    },
    
    getById: async (id) => {
        return await apiRequest(`/clients/${id}`);
    },
    
    create: async (clientData) => {
        return await apiRequest('/clients', {
            method: 'POST',
            body: JSON.stringify(clientData)
        });
    },
    
    update: async (id, clientData) => {
        return await apiRequest(`/clients/${id}`, {
            method: 'PUT',
            body: JSON.stringify(clientData)
        });
    },
    
    delete: async (id) => {
        return await apiRequest(`/clients/${id}`, {
            method: 'DELETE'
        });
    }
};

// ============================================
// API CONTRATS
// ============================================

const contractsAPI = {
    getAll: async (statut = '', search = '') => {
        const params = new URLSearchParams();
        if (statut) params.append('statut', statut);
        if (search) params.append('search', search);
        
        const queryString = params.toString();
        return await apiRequest(`/contracts${queryString ? '?' + queryString : ''}`);
    },
    
    getById: async (id) => {
        return await apiRequest(`/contracts/${id}`);
    },
    
    create: async (contractData) => {
        return await apiRequest('/contracts', {
            method: 'POST',
            body: JSON.stringify(contractData)
        });
    },
    
    renew: async (id, data = {}) => {
        return await apiRequest(`/contracts/${id}/renew`, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    },
    
    update: async (id, contractData) => {
        return await apiRequest(`/contracts/${id}`, {
            method: 'PUT',
            body: JSON.stringify(contractData)
        });
    },
    
    delete: async (id) => {
        return await apiRequest(`/contracts/${id}`, {
            method: 'DELETE'
        });
    }
};

// ============================================
// API STATISTIQUES
// ============================================

const statsAPI = {
    getDashboard: async () => {
        return await apiRequest('/stats/dashboard');
    }
};

// ============================================
// API NOTIFICATIONS
// ============================================

const notificationsAPI = {
    getAll: async (lu = '') => {
        const params = new URLSearchParams();
        if (lu !== '') params.append('lu', lu);
        
        const queryString = params.toString();
        return await apiRequest(`/notifications${queryString ? '?' + queryString : ''}`);
    },
    
    markAsRead: async (id) => {
        return await apiRequest(`/notifications/${id}/read`, {
            method: 'PUT'
        });
    }
};

// Exporter les APIs
window.api = {
    auth: authAPI,
    clients: clientsAPI,
    contracts: contractsAPI,
    stats: statsAPI,
    notifications: notificationsAPI
};

