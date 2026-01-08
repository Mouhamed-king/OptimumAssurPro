// ============================================
// GESTION DE LA CONNEXION
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

document.addEventListener('DOMContentLoaded', function() {
    // NE PAS NETTOYER LE STOCKAGE ICI - Cela déconnecte l'utilisateur
    // Le token doit être préservé pour maintenir la session
    
    // Afficher le message si l'utilisateur vient de s'inscrire
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('message') === 'email-sent') {
        const emailSentMessage = document.getElementById('emailSentMessage');
        if (emailSentMessage) {
            emailSentMessage.style.display = 'block';
        }
    }
    
    const loginForm = document.getElementById('loginForm');
    
    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const remember = document.querySelector('input[name="remember"]').checked;
            
            // Afficher un indicateur de chargement
            const submitButton = loginForm.querySelector('.btn-login');
            const originalText = submitButton.innerHTML;
            submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Connexion...';
            submitButton.disabled = true;
            
            try {
                // Vérifier que l'API est chargée
                if (!window.api || !window.api.auth) {
                    throw new Error('L\'API n\'est pas encore chargée. Veuillez réessayer.');
                }
                
                // Appel à l'API d'authentification
                const data = await window.api.auth.login(email, password);
                
                // Stocker le token
                if (remember) {
                    localStorage.setItem('token', data.token);
                    localStorage.setItem('entreprise', JSON.stringify(data.entreprise));
                } else {
                    sessionStorage.setItem('token', data.token);
                    sessionStorage.setItem('entreprise', JSON.stringify(data.entreprise));
                }
                
                // Rediriger vers le dashboard
                window.location.href = '/index.html';
                
            } catch (error) {
                // Afficher l'erreur
                const errorMessage = error.message || 'Erreur de connexion';
                showToast(errorMessage, 'error');
                
                // Si l'erreur indique que l'email n'est pas vérifié, proposer de renvoyer
                if (errorMessage.includes('vérifier votre adresse email') || errorMessage.includes('403') || errorMessage.includes('EMAIL_NOT_CONFIRMED')) {
                    // Vérifier si c'est une erreur 403 due à l'email non vérifié
                    const errorDiv = document.createElement('div');
                    errorDiv.id = 'emailVerificationError';
                    errorDiv.style.cssText = 'margin-top: 1rem; padding: 1rem; background: #FEF3C7; border: 1px solid #F59E0B; border-radius: 8px; text-align: center;';
                    errorDiv.innerHTML = `
                        <p style="margin-bottom: 0.5rem; color: #92400E;">
                            <i class="fas fa-exclamation-triangle"></i> Votre email n'est pas encore vérifié.
                        </p>
                        <p style="margin-bottom: 0.5rem; font-size: 0.9rem; color: #78350F;">
                            Si vous n'avez pas reçu l'email, vous pouvez :
                        </p>
                        <div style="display: flex; gap: 0.5rem; justify-content: center; flex-wrap: wrap;">
                            <a href="#" onclick="resendVerificationEmail('${email}'); return false;" 
                               style="color: #2563EB; text-decoration: underline; font-size: 0.9rem;">
                                Renvoyer l'email
                            </a>
                        </div>
                    `;
                    
                    // Supprimer l'ancien message s'il existe
                    const oldError = document.getElementById('emailVerificationError');
                    if (oldError) {
                        oldError.remove();
                    }
                    
                    loginForm.appendChild(errorDiv);
                }
                
                // Restaurer le bouton
                submitButton.innerHTML = originalText;
                submitButton.disabled = false;
            }
        });
    }
    
    // Vérifier si l'utilisateur est déjà connecté
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    if (token && window.location.pathname.includes('login.html')) {
        // Rediriger vers le dashboard si déjà connecté
        window.location.href = '/index.html';
    }
});

// Fonction pour renvoyer l'email de vérification
async function resendVerificationEmail(email) {
    if (!email) {
        email = document.getElementById('email')?.value || prompt('Veuillez entrer votre adresse email :');
        if (!email) return;
    }
    
    // Afficher un indicateur de chargement
    const button = event?.target || document.querySelector('a[onclick*="resendVerificationEmail"]');
    if (button) {
        const originalText = button.innerHTML;
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Envoi...';
        button.style.pointerEvents = 'none';
        
        setTimeout(() => {
            button.innerHTML = originalText;
            button.style.pointerEvents = 'auto';
        }, 3000);
    }
    
    try {
        const response = await fetch(`${window.API_BASE_URL || window.location.origin + '/api'}/auth/resend-verification`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showToast('Un nouvel email de vérification vous a été envoyé. Veuillez vérifier votre boîte de réception.', 'success');
        } else {
            // Si l'email n'a pas pu être envoyé, afficher le lien de vérification manuel
            if (data.error && data.error.includes('SMTP') || data.error && data.error.includes('email')) {
                showManualVerificationInfo(email);
            } else {
                showToast(data.error || 'Erreur lors de l\'envoi de l\'email', 'error');
            }
        }
    } catch (error) {
        console.error('Erreur:', error);
        showToast('Une erreur est survenue. Veuillez utiliser la vérification manuelle.', 'error');
        showManualVerificationInfo(email);
    }
}

// Fonction pour afficher les informations de vérification manuelle
function showManualVerificationInfo(email) {
    // Récupérer le token depuis Supabase ou afficher une modal avec instructions
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
                <h2 style="margin: 0; font-size: 1.5rem; color: #111827;">Vérification manuelle</h2>
                <button class="modal-close" onclick="this.closest('.modal').remove()" style="background: none; border: none; font-size: 1.5rem; cursor: pointer; color: #6b7280; padding: 0.5rem; border-radius: 50%; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="modal-body" style="padding: 1.5rem;">
                <div style="padding: 1rem; background: #FEF3C7; border-left: 4px solid #F59E0B; border-radius: 8px; margin-bottom: 1.5rem;">
                    <p style="margin: 0; color: #92400E; font-weight: 600;">
                        <i class="fas fa-exclamation-triangle"></i> L'email n'a pas pu être envoyé
                    </p>
                    <p style="margin: 0.5rem 0 0 0; color: #78350F; font-size: 0.9rem;">
                        Le serveur SMTP n'est pas configuré ou rencontre un problème. Vous pouvez vérifier votre email manuellement.
                    </p>
                </div>
                <p style="margin-bottom: 1rem; color: #374151;">
                    Pour vérifier votre email manuellement, contactez l'administrateur avec votre adresse email : <strong>${email}</strong>
                </p>
                <p style="margin-bottom: 1rem; font-size: 0.9rem; color: #6B7280;">
                    L'administrateur peut vérifier votre email directement dans la base de données Supabase ou vous fournir un lien de vérification.
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
}

window.resendVerificationEmail = resendVerificationEmail;
window.showManualVerificationInfo = showManualVerificationInfo;

// Fonction pour afficher les informations de vérification manuelle
function showManualVerificationInfo(email) {
    const message = `Pour vérifier manuellement votre email, utilisez cette commande dans le terminal du serveur :

node scripts/verify-email-manual.js ${email} --yes

Ou contactez l'administrateur pour qu'il vérifie votre compte.`;
    
    alert(message);
    console.log('📋 Commande pour vérifier manuellement:', `node scripts/verify-email-manual.js ${email} --yes`);
}

window.showManualVerificationInfo = showManualVerificationInfo;

// Fonction pour ouvrir le modal de mot de passe oublié
function openForgotPasswordModal() {
    const modal = document.getElementById('forgotPasswordModal');
    if (modal) {
        modal.style.display = 'flex';
    }
}

// Fonction pour fermer le modal de mot de passe oublié
function closeForgotPasswordModal() {
    const modal = document.getElementById('forgotPasswordModal');
    if (modal) {
        modal.style.display = 'none';
        document.getElementById('forgotPasswordForm').reset();
    }
}

// Gérer la demande de réinitialisation de mot de passe
async function handleForgotPassword(event) {
    event.preventDefault();
    
    const email = document.getElementById('forgotEmail').value;
    const submitButton = event.target.querySelector('button[type="submit"]');
    const originalText = submitButton.innerHTML;
    
    submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Envoi...';
    submitButton.disabled = true;
    
    try {
        const response = await fetch(`${window.API_BASE_URL || window.location.origin + '/api'}/auth/forgot-password`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showToast('Un email de réinitialisation vous a été envoyé. Veuillez vérifier votre boîte de réception.', 'success');
            closeForgotPasswordModal();
        } else {
            showToast(data.error || 'Erreur lors de l\'envoi de l\'email', 'error');
        }
    } catch (error) {
        console.error('Erreur:', error);
        showToast('Une erreur est survenue', 'error');
    } finally {
        submitButton.innerHTML = originalText;
        submitButton.disabled = false;
    }
}

window.openForgotPasswordModal = openForgotPasswordModal;
window.closeForgotPasswordModal = closeForgotPasswordModal;
window.handleForgotPassword = handleForgotPassword;

// Fonction pour déconnecter l'utilisateur
function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('entreprise');
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('entreprise');
    window.location.href = '/login.html';
}

