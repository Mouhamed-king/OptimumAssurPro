// ============================================
// FONCTIONS UTILITAIRES GLOBALES
// ============================================

// Fonction globale pour afficher les notifications toast
function showToast(message, type = 'info') {
    // Vérifier si le body existe
    if (!document.body) {
        console.log(`[${type.toUpperCase()}] ${message}`);
        return;
    }
    
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
        z-index: 10000;
        animation: slideIn 0.3s ease-out;
        max-width: 400px;
        word-wrap: break-word;
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => {
            if (document.body && document.body.contains(toast)) {
                document.body.removeChild(toast);
            }
        }, 300);
    }, 3000);
}

// Fonction pour vérifier que l'API est chargée
function checkAPI() {
    if (!window.api) {
        const error = new Error('API non chargée. Veuillez recharger la page.');
        console.error(error);
        if (typeof window.showToast === 'function') {
            window.showToast('Erreur: API non chargée. Veuillez recharger la page.', 'error');
        }
        throw error;
    }
    return true;
}

// Exposer globalement
window.showToast = showToast;
window.checkAPI = checkAPI;
