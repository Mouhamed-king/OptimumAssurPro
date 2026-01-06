// ============================================
// GESTION DE L'INSCRIPTION
// ============================================

function showToast(message, type = 'info') {
    // Créer un élément toast
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <div class="toast-content">
            <i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i>
            <span>${message}</span>
        </div>
    `;
    
    // Ajouter au body
    document.body.appendChild(toast);
    
    // Animation d'entrée
    setTimeout(() => toast.classList.add('show'), 10);
    
    // Supprimer après 3 secondes
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Validation de l'email
function validateEmail(email) {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(email);
}

// Validation du mot de passe fort
function validatePassword(password) {
    const requirements = {
        length: password.length >= 8,
        uppercase: /[A-Z]/.test(password),
        lowercase: /[a-z]/.test(password),
        number: /[0-9]/.test(password)
    };
    
    return {
        valid: Object.values(requirements).every(req => req === true),
        requirements
    };
}

// Mettre à jour l'affichage des exigences du mot de passe
function updatePasswordRequirements(password) {
    const validation = validatePassword(password);
    const requirements = validation.requirements;
    
    // Mettre à jour chaque exigence
    const reqLength = document.getElementById('req-length');
    const reqUppercase = document.getElementById('req-uppercase');
    const reqLowercase = document.getElementById('req-lowercase');
    const reqNumber = document.getElementById('req-number');
    
    if (reqLength) {
        reqLength.className = requirements.length ? 'valid' : 'invalid';
        reqLength.querySelector('i').className = requirements.length ? 'fas fa-check' : 'fas fa-times';
    }
    
    if (reqUppercase) {
        reqUppercase.className = requirements.uppercase ? 'valid' : 'invalid';
        reqUppercase.querySelector('i').className = requirements.uppercase ? 'fas fa-check' : 'fas fa-times';
    }
    
    if (reqLowercase) {
        reqLowercase.className = requirements.lowercase ? 'valid' : 'invalid';
        reqLowercase.querySelector('i').className = requirements.lowercase ? 'fas fa-check' : 'fas fa-times';
    }
    
    if (reqNumber) {
        reqNumber.className = requirements.number ? 'valid' : 'invalid';
        reqNumber.querySelector('i').className = requirements.number ? 'fas fa-check' : 'fas fa-times';
    }
    
    return validation.valid;
}

// Afficher/masquer les messages d'erreur
function showError(elementId, message) {
    const errorElement = document.getElementById(elementId);
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.style.display = 'flex';
    }
}

function hideError(elementId) {
    const errorElement = document.getElementById(elementId);
    if (errorElement) {
        errorElement.style.display = 'none';
    }
}

document.addEventListener('DOMContentLoaded', function() {
    const registerForm = document.getElementById('registerForm');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const confirmPasswordInput = document.getElementById('confirmPassword');
    
    // Validation en temps réel de l'email
    if (emailInput) {
        emailInput.addEventListener('blur', function() {
            const email = this.value.trim();
            if (email && !validateEmail(email)) {
                showError('emailError', 'Veuillez entrer une adresse email valide');
            } else {
                hideError('emailError');
            }
        });
        
        emailInput.addEventListener('input', function() {
            if (this.value.trim()) {
                hideError('emailError');
            }
        });
    }
    
    // Validation en temps réel du mot de passe
    if (passwordInput) {
        passwordInput.addEventListener('input', function() {
            const password = this.value;
            updatePasswordRequirements(password);
            hideError('passwordError');
        });
        
        passwordInput.addEventListener('blur', function() {
            const password = this.value;
            const validation = validatePassword(password);
            if (password && !validation.valid) {
                showError('passwordError', 'Le mot de passe ne respecte pas toutes les exigences');
            } else {
                hideError('passwordError');
            }
        });
    }
    
    // Validation de la confirmation du mot de passe
    if (confirmPasswordInput) {
        confirmPasswordInput.addEventListener('input', function() {
            const password = passwordInput.value;
            const confirmPassword = this.value;
            if (confirmPassword && password !== confirmPassword) {
                showError('confirmPasswordError', 'Les mots de passe ne correspondent pas');
            } else {
                hideError('confirmPasswordError');
            }
        });
    }
    
    if (registerForm) {
        registerForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const nom = document.getElementById('nom').value.trim();
            const email = document.getElementById('email').value.trim();
            const password = document.getElementById('password').value;
            const confirmPassword = document.getElementById('confirmPassword').value;
            const telephone = document.getElementById('telephone').value.trim();
            const adresse = document.getElementById('adresse').value.trim();
            
            // Validation de l'email
            if (!validateEmail(email)) {
                showError('emailError', 'Veuillez entrer une adresse email valide');
                showToast('Veuillez entrer une adresse email valide', 'error');
                return;
            }
            hideError('emailError');
            
            // Validation du mot de passe
            const passwordValidation = validatePassword(password);
            if (!passwordValidation.valid) {
                showError('passwordError', 'Le mot de passe doit contenir au moins 8 caractères, une majuscule, une minuscule et un chiffre');
                showToast('Le mot de passe ne respecte pas toutes les exigences', 'error');
                return;
            }
            hideError('passwordError');
            
            // Validation de la confirmation
            if (password !== confirmPassword) {
                showError('confirmPasswordError', 'Les mots de passe ne correspondent pas');
                showToast('Les mots de passe ne correspondent pas', 'error');
                return;
            }
            hideError('confirmPasswordError');
            
            // Afficher un indicateur de chargement
            const submitButton = registerForm.querySelector('.btn-login');
            const originalText = submitButton.innerHTML;
            submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Création du compte...';
            submitButton.disabled = true;
            
            try {
                // Appel à l'API d'inscription
                const data = await window.api.auth.register({
                    nom,
                    email,
                    password,
                    telephone: telephone || null,
                    adresse: adresse || null
                });
                
                // Ne pas stocker le token car l'email n'est pas encore vérifié
                // L'utilisateur doit vérifier son email avant de pouvoir se connecter
                
                if (data.emailSent) {
                    showToast('Compte créé avec succès ! Veuillez vérifier votre email pour activer votre compte.', 'success');
                } else {
                    // Si SMTP n'est pas configuré, afficher le lien de vérification
                    const message = `Compte créé avec succès ! SMTP n'est pas configuré. Veuillez utiliser ce lien pour vérifier votre email : ${data.verificationUrl}`;
                    showToast(message, 'info');
                    console.log('🔗 Lien de vérification:', data.verificationUrl);
                    console.log('📋 Token de vérification:', data.verificationToken);
                }
                
                // Rediriger vers la page de connexion après 5 secondes
                setTimeout(() => {
                    window.location.href = 'login.html?message=email-sent';
                }, 5000);
                
            } catch (error) {
                // Afficher l'erreur
                const errorMessage = error.message || 'Une erreur est survenue';
                showToast('Erreur lors de l\'inscription: ' + errorMessage, 'error');
                
                // Afficher les erreurs spécifiques
                if (errorMessage.includes('email')) {
                    showError('emailError', errorMessage);
                }
                if (errorMessage.includes('mot de passe') || errorMessage.includes('password')) {
                    showError('passwordError', errorMessage);
                }
                
                // Restaurer le bouton
                submitButton.innerHTML = originalText;
                submitButton.disabled = false;
            }
        });
    }
    
    // Vérifier si l'utilisateur est déjà connecté
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    if (token && !window.location.pathname.includes('register.html')) {
        window.location.href = 'index.html';
    }
});

