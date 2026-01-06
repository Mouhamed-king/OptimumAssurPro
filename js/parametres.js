// ============================================
// GESTION DES PARAMÈTRES
// ============================================

// Charger les paramètres
async function loadParametres() {
    try {
        // Vérifier que l'API est chargée
        if (!window.api || !window.api.auth) {
            throw new Error('API non chargée');
        }
        
        // Charger les informations de l'entreprise
        const data = await window.api.auth.getMe();
        const entreprise = data.entreprise;
        
        // Remplir le formulaire
        const nomEl = document.getElementById('entrepriseNom');
        const emailEl = document.getElementById('entrepriseEmail');
        const telEl = document.getElementById('entrepriseTelephone');
        const adresseEl = document.getElementById('entrepriseAdresse');
        
        if (nomEl) nomEl.value = entreprise.nom || '';
        if (emailEl) emailEl.value = entreprise.email || '';
        if (telEl) telEl.value = entreprise.telephone || '';
        if (adresseEl) adresseEl.value = entreprise.adresse || '';
        
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
    
    const nomEl = document.getElementById('entrepriseNom');
    const emailEl = document.getElementById('entrepriseEmail');
    const telEl = document.getElementById('entrepriseTelephone');
    const adresseEl = document.getElementById('entrepriseAdresse');
    
    if (!nomEl || !emailEl) {
        if (typeof window.showToast === 'function') {
            window.showToast('Erreur: Formulaire non trouvé', 'error');
        }
        return;
    }
    
    const nom = nomEl.value.trim();
    const email = emailEl.value.trim();
    const telephone = telEl ? telEl.value.trim() : '';
    const adresse = adresseEl ? adresseEl.value.trim() : '';
    
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
        // Vérifier que l'API est chargée
        if (!window.api || !window.api.auth) {
            throw new Error('API non chargée');
        }
        
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
    
    const currentPasswordEl = document.getElementById('currentPassword');
    const newPasswordEl = document.getElementById('newPassword');
    const confirmPasswordEl = document.getElementById('confirmPassword');
    
    if (!currentPasswordEl || !newPasswordEl || !confirmPasswordEl) {
        if (typeof window.showToast === 'function') {
            window.showToast('Erreur: Formulaire non trouvé', 'error');
        }
        return;
    }
    
    const currentPassword = currentPasswordEl.value;
    const newPassword = newPasswordEl.value;
    const confirmPassword = confirmPasswordEl.value;
    
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
        // Vérifier que l'API est chargée
        if (!window.api || !window.api.auth) {
            throw new Error('API non chargée');
        }
        
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

