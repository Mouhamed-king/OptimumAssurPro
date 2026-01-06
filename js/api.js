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
        
        // Si le token est expiré ou invalide, ne pas rediriger automatiquement
        // Laisser le code appelant gérer l'erreur (sauf pour les pages protégées)
        if (response.status === 401 || response.status === 403) {
            // Ne rediriger que si on n'est pas déjà sur la page de login
            if (!window.location.pathname.includes('login.html') && 
                !window.location.pathname.includes('register.html') &&
                !window.location.pathname.includes('verify-email.html') &&
                !window.location.pathname.includes('reset-password.html')) {
                localStorage.removeItem('token');
                sessionStorage.removeItem('token');
                window.location.href = 'login.html';
                return;
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

