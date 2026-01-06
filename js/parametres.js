// ============================================
// GESTION DES PARAMÈTRES
// ============================================

// Charger les paramètres
async function loadParametres() {
    try {
        // Charger les informations de l'entreprise
        const data = await window.api.auth.getMe();
        const entreprise = data.entreprise;
        
        // Remplir le formulaire
        document.getElementById('entrepriseNom').value = entreprise.nom || '';
        document.getElementById('entrepriseEmail').value = entreprise.email || '';
        document.getElementById('entrepriseTelephone').value = entreprise.telephone || '';
        document.getElementById('entrepriseAdresse').value = entreprise.adresse || '';
        
        // Mettre à jour le nom dans le header
        const userName = document.querySelector('.user-name');
        if (userName) {
            userName.textContent = entreprise.nom || 'Entreprise';
        }
        
        // Afficher la dernière connexion (approximation)
        const lastLogin = document.getElementById('lastLogin');
        if (lastLogin) {
            lastLogin.textContent = new Date().toLocaleDateString('fr-FR', {
                day: '2-digit',
                month: 'long',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        }
        
    } catch (error) {
        console.error('Erreur lors du chargement des paramètres:', error);
        if (typeof window.showToast === 'function') {
            window.showToast('Erreur lors du chargement des paramètres: ' + (error.message || 'Erreur inconnue'), 'error');
        }
    }
}

// Sauvegarder les informations de l'entreprise
async function saveEntrepriseInfo(event) {
    event.preventDefault();
    
    const nom = document.getElementById('entrepriseNom').value.trim();
    const email = document.getElementById('entrepriseEmail').value.trim();
    const telephone = document.getElementById('entrepriseTelephone').value.trim();
    const adresse = document.getElementById('entrepriseAdresse').value.trim();
    
    // Validation
    if (!nom || !email) {
        if (typeof window.showToast === 'function') {
            window.showToast('Le nom et l\'email sont obligatoires', 'error');
        }
        return;
    }
    
    // Validation email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        if (typeof window.showToast === 'function') {
            window.showToast('Format d\'email invalide', 'error');
        }
        return;
    }
    
    try {
        // Appeler l'API pour mettre à jour l'entreprise
        const response = await window.api.auth.updateProfile({ nom, email, telephone, adresse });
        
        if (typeof window.showToast === 'function') {
            window.showToast('Informations mises à jour avec succès', 'success');
        }
        
        // Mettre à jour le nom dans le header
        const userName = document.querySelector('.user-name');
        if (userName) {
            userName.textContent = nom;
        }
        
    } catch (error) {
        console.error('Erreur lors de la sauvegarde:', error);
        if (typeof window.showToast === 'function') {
            window.showToast('Erreur: ' + (error.message || 'Une erreur est survenue'), 'error');
        }
    }
}

// Réinitialiser le formulaire entreprise
function resetEntrepriseForm() {
    loadParametres();
}

// Validation du mot de passe fort
function validatePassword(password) {
    if (!password || password.length < 8) {
        return { valid: false, error: 'Le mot de passe doit contenir au moins 8 caractères' };
    }
    
    if (!/[A-Z]/.test(password)) {
        return { valid: false, error: 'Le mot de passe doit contenir au moins une majuscule' };
    }
    
    if (!/[a-z]/.test(password)) {
        return { valid: false, error: 'Le mot de passe doit contenir au moins une minuscule' };
    }
    
    if (!/[0-9]/.test(password)) {
        return { valid: false, error: 'Le mot de passe doit contenir au moins un chiffre' };
    }
    
    return { valid: true };
}

// Changer le mot de passe
async function changePassword(event) {
    event.preventDefault();
    
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    
    // Validation
    if (!currentPassword || !newPassword || !confirmPassword) {
        if (typeof window.showToast === 'function') {
            window.showToast('Tous les champs sont obligatoires', 'error');
        }
        return;
    }
    
    // Validation du nouveau mot de passe
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.valid) {
        if (typeof window.showToast === 'function') {
            window.showToast(passwordValidation.error, 'error');
        }
        return;
    }
    
    if (newPassword !== confirmPassword) {
        if (typeof window.showToast === 'function') {
            window.showToast('Les mots de passe ne correspondent pas', 'error');
        }
        return;
    }
    
    if (currentPassword === newPassword) {
        if (typeof window.showToast === 'function') {
            window.showToast('Le nouveau mot de passe doit être différent de l\'ancien', 'error');
        }
        return;
    }
    
    try {
        // Appeler l'API pour changer le mot de passe
        await window.api.auth.changePassword({ currentPassword, newPassword });
        
        if (typeof window.showToast === 'function') {
            window.showToast('Mot de passe changé avec succès', 'success');
        }
        resetPasswordForm();
        
    } catch (error) {
        console.error('Erreur lors du changement de mot de passe:', error);
        if (typeof window.showToast === 'function') {
            window.showToast('Erreur: ' + (error.message || 'Une erreur est survenue'), 'error');
        }
    }
}

// Réinitialiser le formulaire de mot de passe
function resetPasswordForm() {
    document.getElementById('passwordForm').reset();
}

// Toggle accordéon
function toggleAccordion(accordionId) {
    const accordion = document.getElementById(accordionId).closest('.settings-accordion');
    const arrow = document.getElementById(accordionId + 'Arrow');
    
    // Fermer tous les autres accordéons
    document.querySelectorAll('.settings-accordion').forEach(acc => {
        if (acc !== accordion) {
            acc.classList.remove('active');
        }
    });
    
    // Toggle l'accordéon cliqué
    accordion.classList.toggle('active');
}

// Exposer les fonctions globalement
window.loadParametres = loadParametres;
window.saveEntrepriseInfo = saveEntrepriseInfo;
window.resetEntrepriseForm = resetEntrepriseForm;
window.changePassword = changePassword;
window.resetPasswordForm = resetPasswordForm;
window.toggleAccordion = toggleAccordion;

