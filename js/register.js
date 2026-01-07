// ============================================
// GESTION DE L'INSCRIPTION
// ============================================

// showToast est maintenant dans utils.js
// Si elle n'existe pas encore, créer une version de secours
if (typeof window.showToast !== 'function') {
    window.showToast = function(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
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
        `;
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.style.animation = 'slideOut 0.3s ease-out';
            setTimeout(() => {
                if (document.body.contains(toast)) {
                    document.body.removeChild(toast);
                }
            }, 300);
        }, 3000);
    };
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
        const icon = reqLength.querySelector('i');
        if (icon) icon.className = requirements.length ? 'fas fa-check' : 'fas fa-times';
    }
    
    if (reqUppercase) {
        reqUppercase.className = requirements.uppercase ? 'valid' : 'invalid';
        const icon = reqUppercase.querySelector('i');
        if (icon) icon.className = requirements.uppercase ? 'fas fa-check' : 'fas fa-times';
    }
    
    if (reqLowercase) {
        reqLowercase.className = requirements.lowercase ? 'valid' : 'invalid';
        const icon = reqLowercase.querySelector('i');
        if (icon) icon.className = requirements.lowercase ? 'fas fa-check' : 'fas fa-times';
    }
    
    if (reqNumber) {
        reqNumber.className = requirements.number ? 'valid' : 'invalid';
        const icon = reqNumber.querySelector('i');
        if (icon) icon.className = requirements.number ? 'fas fa-check' : 'fas fa-times';
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
                // Vérifier que l'API est chargée
                if (!window.api || !window.api.auth) {
                    throw new Error('API non chargée. Veuillez recharger la page.');
                }
                
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
                
                console.log('Réponse API:', data);
                
                if (data.emailSent) {
                    showToast('Compte créé avec succès ! Veuillez vérifier votre email pour activer votre compte.', 'success');
                    // Rediriger vers la page de connexion après 5 secondes
                    setTimeout(() => {
                        window.location.href = '/login.html?message=email-sent';
                    }, 5000);
                } else {
                    // Si SMTP n'est pas configuré, afficher le lien de vérification dans une modal
                    const verificationUrl = data.verificationUrl || `${window.location.origin}/verify-email.html?token=${data.verificationToken}`;
                    
                    // Créer une modal pour afficher le lien de vérification
                    const modal = document.createElement('div');
                    modal.className = 'modal';
                    modal.style.display = 'flex';
                    modal.style.position = 'fixed';
                    modal.style.top = '0';
                    modal.style.left = '0';
                    modal.style.width = '100%';
                    modal.style.height = '100%';
                    modal.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
                    modal.style.zIndex = '10000';
                    modal.style.alignItems = 'center';
                    modal.style.justifyContent = 'center';
                    
                    modal.innerHTML = `
                        <div class="modal-content" style="max-width: 600px; background: white; border-radius: 8px; padding: 0; box-shadow: 0 10px 25px rgba(0,0,0,0.2);">
                            <div class="modal-header" style="display: flex; justify-content: space-between; align-items: center; padding: 1.5rem; border-bottom: 1px solid #e5e7eb;">
                                <h2 style="margin: 0; font-size: 1.5rem; color: #111827;">Compte créé avec succès !</h2>
                                <button class="modal-close" onclick="this.closest('.modal').remove()" style="background: none; border: none; font-size: 1.5rem; cursor: pointer; color: #6b7280; padding: 0.5rem; border-radius: 50%; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;">
                                    <i class="fas fa-times"></i>
                                </button>
                            </div>
                            <div class="modal-body" style="padding: 1.5rem;">
                                <div style="padding: 1rem; background: #FEF3C7; border-left: 4px solid #F59E0B; border-radius: 8px; margin-bottom: 1.5rem;">
                                    <p style="margin: 0; color: #92400E; font-weight: 600;">
                                        <i class="fas fa-exclamation-triangle"></i> L'email de vérification n'a pas pu être envoyé
                                    </p>
                                    <p style="margin: 0.5rem 0 0 0; color: #78350F; font-size: 0.9rem;">
                                        Cela peut être dû à une configuration SMTP manquante ou incorrecte sur le serveur.
                                    </p>
                                </div>
                                <p style="margin-bottom: 1rem; color: #374151;">Pour activer votre compte, veuillez utiliser ce lien de vérification :</p>
                                <div style="background: #F3F4F6; padding: 1rem; border-radius: 8px; margin-bottom: 1rem;">
                                    <input type="text" id="verificationLink" value="${verificationUrl}" readonly style="width: 100%; padding: 0.75rem; border: 1px solid #D1D5DB; border-radius: 4px; font-size: 0.9rem; background: white; font-family: monospace;">
                                </div>
                                <button class="btn-primary" onclick="copyVerificationLink()" style="width: 100%; margin-bottom: 0.5rem; padding: 0.75rem; background: #2563EB; color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer;">
                                    <i class="fas fa-copy"></i> Copier le lien
                                </button>
                                <a href="${verificationUrl}" class="btn-secondary" style="display: block; text-align: center; text-decoration: none; padding: 0.75rem; background: #F3F4F6; color: #374151; border-radius: 8px; font-weight: 500;">
                                    <i class="fas fa-external-link-alt"></i> Ouvrir le lien maintenant
                                </a>
                                <p style="margin-top: 1rem; font-size: 0.85rem; color: #6B7280; text-align: center;">
                                    Vous pouvez fermer cette fenêtre et utiliser le lien plus tard
                                </p>
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
                    
                    console.log('🔗 Lien de vérification:', verificationUrl);
                    console.log('📋 Token de vérification:', data.verificationToken);
                }
                
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
    
    // Fonction pour copier le lien de vérification
    window.copyVerificationLink = function() {
        const linkInput = document.getElementById('verificationLink');
        if (linkInput) {
            linkInput.select();
            document.execCommand('copy');
            showToast('Lien copié dans le presse-papiers !', 'success');
        }
    };
    
    // Ne pas rediriger depuis register.html même si connecté
    // Permettre la création de compte même si déjà connecté
});

