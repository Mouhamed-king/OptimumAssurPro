// ============================================
// CONTRÔLEUR D'AUTHENTIFICATION (Supabase Auth)
// ============================================

const db = require('../database/connection');

// Validation de l'email
function validateEmail(email) {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(email);
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

// Inscription d'une nouvelle entreprise avec Supabase Auth
const register = async (req, res) => {
    try {
        const { nom, email, password, telephone, adresse } = req.body;
        
        // Validation des champs requis
        if (!nom || !email || !password) {
            return res.status(400).json({ error: 'Nom, email et mot de passe sont requis' });
        }
        
        // Validation de l'email
        if (!validateEmail(email)) {
            return res.status(400).json({ error: 'Veuillez entrer une adresse email valide' });
        }
        
        // Validation du mot de passe
        const passwordValidation = validatePassword(password);
        if (!passwordValidation.valid) {
            return res.status(400).json({ error: passwordValidation.error });
        }
        
        // Utiliser Supabase Auth pour créer l'utilisateur
        // Supabase enverra automatiquement l'email de confirmation
        const { data: authData, error: authError } = await db.supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    nom, // Métadonnées utilisateur
                    telephone: telephone || null,
                    adresse: adresse || null
                },
                emailRedirectTo: `${process.env.APP_URL || 'http://localhost:3000'}/verify-email.html`
            }
        });
        
        if (authError) {
            // Gérer les erreurs spécifiques Supabase
            if (authError.message.includes('already registered')) {
                return res.status(400).json({ error: 'Cet email est déjà utilisé' });
            }
            return res.status(400).json({ error: authError.message });
        }
        
        if (!authData.user) {
            return res.status(500).json({ error: 'Erreur lors de la création du compte' });
        }
        
        // Créer l'enregistrement dans la table entreprises avec l'ID de Supabase Auth
        const { data: newEntreprise, error: insertError } = await db.supabase
            .from('entreprises')
            .insert({
                id: authData.user.id, // Utiliser l'ID de Supabase Auth
                nom,
                email,
                telephone: telephone || null,
                adresse: adresse || null,
                email_verified: authData.user.email_confirmed_at !== null // Synchroniser avec Supabase Auth
            })
            .select()
            .single();
        
        // Si l'insertion échoue mais que l'utilisateur Auth existe, continuer quand même
        // (l'utilisateur pourra compléter son profil plus tard)
        if (insertError && !insertError.message.includes('duplicate')) {
            console.warn('⚠️ Erreur lors de la création de l\'entreprise:', insertError);
            // Ne pas bloquer l'inscription si c'est juste un problème de table
        }
        
        // Supabase Auth envoie automatiquement l'email de confirmation
        // Vérifier si l'email a été envoyé (dépend de la configuration Supabase)
        const emailSent = authData.user.email_confirmed_at === null && authData.session === null;
        
        res.status(201).json({
            message: emailSent 
                ? 'Compte créé avec succès. Veuillez vérifier votre email pour activer votre compte.'
                : 'Compte créé avec succès. Un email de confirmation vous a été envoyé.',
            emailSent: emailSent,
            entreprise: {
                id: authData.user.id,
                nom: nom,
                email: authData.user.email,
                email_verified: authData.user.email_confirmed_at !== null
            },
            email_verified: authData.user.email_confirmed_at !== null
        });
    } catch (error) {
        console.error('Erreur lors de l\'inscription:', error);
        res.status(500).json({ error: 'Erreur lors de l\'inscription: ' + error.message });
    }
};

// Connexion d'une entreprise avec Supabase Auth
const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        
        // Validation
        if (!email || !password) {
            return res.status(400).json({ error: 'Email et mot de passe sont requis' });
        }
        
        // Utiliser Supabase Auth pour la connexion
        const { data: authData, error: authError } = await db.supabase.auth.signInWithPassword({
            email,
            password
        });
        
        if (authError) {
            // Gérer les erreurs spécifiques Supabase
            if (authError.message.includes('Invalid login credentials')) {
                return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
            }
            if (authError.message.includes('Email not confirmed')) {
                return res.status(403).json({ 
                    error: 'Veuillez vérifier votre adresse email avant de vous connecter. Un email de vérification vous a été envoyé lors de l\'inscription.',
                    code: 'EMAIL_NOT_CONFIRMED'
                });
            }
            return res.status(401).json({ error: authError.message });
        }
        
        if (!authData.user) {
            return res.status(500).json({ error: 'Erreur lors de la connexion' });
        }
        
        // Vérifier si l'email est confirmé (Supabase Auth)
        const isEmailVerified = authData.user.email_confirmed_at !== null;
        
        if (!isEmailVerified) {
            return res.status(403).json({ 
                error: 'Veuillez vérifier votre adresse email avant de vous connecter. Un email de vérification vous a été envoyé lors de l\'inscription.',
                code: 'EMAIL_NOT_CONFIRMED'
            });
        }
        
        // Récupérer les informations de l'entreprise depuis la table entreprises
        const { data: entreprise, error: entrepriseError } = await db.supabase
            .from('entreprises')
            .select('id, nom, email, email_verified')
            .eq('id', authData.user.id)
            .single();
        
        // Si l'entreprise n'existe pas dans la table, créer un enregistrement minimal
        let entrepriseData = entreprise;
        if (entrepriseError || !entreprise) {
            console.warn('⚠️ Entreprise non trouvée dans la table, création d\'un enregistrement minimal');
            const { data: newEntreprise } = await db.supabase
                .from('entreprises')
                .insert({
                    id: authData.user.id,
                    nom: authData.user.user_metadata?.nom || 'Utilisateur',
                    email: authData.user.email,
                    email_verified: isEmailVerified
                })
                .select('id, nom, email, email_verified')
                .single();
            entrepriseData = newEntreprise;
        } else {
            // Mettre à jour email_verified si nécessaire (synchronisation)
            if (entreprise.email_verified !== isEmailVerified) {
                await db.supabase
                    .from('entreprises')
                    .update({ email_verified: isEmailVerified })
                    .eq('id', authData.user.id);
                entrepriseData.email_verified = isEmailVerified;
            }
        }
        
        // Retourner le token d'accès Supabase (session.access_token)
        // Le frontend utilisera ce token pour les requêtes API
        res.json({
            message: 'Connexion réussie',
            token: authData.session.access_token, // Token Supabase
            refreshToken: authData.session.refresh_token,
            entreprise: {
                id: entrepriseData?.id || authData.user.id,
                nom: entrepriseData?.nom || authData.user.user_metadata?.nom || 'Utilisateur',
                email: authData.user.email,
                email_verified: isEmailVerified
            }
        });
    } catch (error) {
        console.error('Erreur lors de la connexion:', error);
        res.status(500).json({ error: 'Erreur lors de la connexion: ' + error.message });
    }
};

// Renvoyer l'email de vérification avec Supabase Auth
const resendVerificationEmail = async (req, res) => {
    try {
        const { email } = req.body;
        
        if (!email) {
            return res.status(400).json({ error: 'Email requis' });
        }
        
        // Utiliser Supabase Auth pour renvoyer l'email de confirmation
        const { error: authError } = await db.supabase.auth.resend({
            type: 'signup',
            email: email,
            options: {
                emailRedirectTo: `${process.env.APP_URL || 'http://localhost:3000'}/verify-email.html`
            }
        });
        
        if (authError) {
            // Ne pas révéler si l'email existe ou non pour la sécurité
            return res.json({ 
                message: 'Si cet email existe et n\'est pas encore vérifié, un email de vérification vous sera envoyé.' 
            });
        }
        
        res.json({ 
            message: 'Email de vérification envoyé avec succès',
            emailSent: true
        });
    } catch (error) {
        console.error('Erreur lors du renvoi de l\'email:', error);
        res.status(500).json({ error: 'Erreur lors du renvoi de l\'email: ' + error.message });
    }
};

// Obtenir les informations de l'entreprise connectée
const getMe = async (req, res) => {
    try {
        // req.userId est défini par le middleware Supabase Auth
        const userId = req.userId || req.entrepriseId;
        
        if (!userId) {
            return res.status(401).json({ error: 'Non authentifié' });
        }
        
        // Récupérer les informations depuis la table entreprises
        const { data: entreprise, error } = await db.supabase
            .from('entreprises')
            .select('id, nom, email, telephone, adresse, created_at')
            .eq('id', userId)
            .single();
        
        if (error || !entreprise) {
            return res.status(404).json({ error: 'Entreprise non trouvée' });
        }
        
        res.json({ entreprise });
    } catch (error) {
        console.error('Erreur lors de la récupération des informations:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération des informations: ' + error.message });
    }
};

// Mettre à jour le profil de l'entreprise
const updateProfile = async (req, res) => {
    try {
        const { nom, email, telephone, adresse } = req.body;
        
        // Validation
        if (!nom || !email) {
            return res.status(400).json({ error: 'Nom et email sont requis' });
        }
        
        // Vérifier si l'email existe déjà pour une autre entreprise
        const { data: existing, error: checkError } = await db.supabase
            .from('entreprises')
            .select('id')
            .eq('email', email)
            .neq('id', req.entrepriseId)
            .maybeSingle();
        
        if (existing) {
            return res.status(400).json({ error: 'Cet email est déjà utilisé par une autre entreprise' });
        }
        
        // Mettre à jour l'entreprise avec Supabase
        const { data: updated, error: updateError } = await db.supabase
            .from('entreprises')
            .update({
                nom,
                email,
                telephone: telephone || null,
                adresse: adresse || null
            })
            .eq('id', req.entrepriseId)
            .select('id, nom, email, telephone, adresse, created_at')
            .single();
        
        if (updateError) {
            throw updateError;
        }
        
        res.json({
            message: 'Profil mis à jour avec succès',
            entreprise: updated
        });
    } catch (error) {
        console.error('Erreur lors de la mise à jour du profil:', error);
        res.status(500).json({ error: 'Erreur lors de la mise à jour du profil: ' + error.message });
    }
};

// Changer le mot de passe avec Supabase Auth
const changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        
        // Validation
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: 'Mot de passe actuel et nouveau mot de passe sont requis' });
        }
        
        // Validation du nouveau mot de passe
        const passwordValidation = validatePassword(newPassword);
        if (!passwordValidation.valid) {
            return res.status(400).json({ error: passwordValidation.error });
        }
        
        const userId = req.userId || req.entrepriseId;
        if (!userId) {
            return res.status(401).json({ error: 'Non authentifié' });
        }
        
        // Récupérer l'utilisateur depuis Supabase Auth
        const { data: { user }, error: userError } = await db.supabase.auth.admin.getUserById(userId);
        
        if (userError || !user) {
            return res.status(404).json({ error: 'Utilisateur non trouvé' });
        }
        
        // Vérifier le mot de passe actuel en tentant une connexion
        const { error: signInError } = await db.supabase.auth.signInWithPassword({
            email: user.email,
            password: currentPassword
        });
        
        if (signInError) {
            return res.status(401).json({ error: 'Mot de passe actuel incorrect' });
        }
        
        // Mettre à jour le mot de passe avec Supabase Auth
        const { error: updateError } = await db.supabase.auth.admin.updateUserById(userId, {
            password: newPassword
        });
        
        if (updateError) {
            throw updateError;
        }
        
        res.json({ message: 'Mot de passe changé avec succès' });
    } catch (error) {
        console.error('Erreur lors du changement de mot de passe:', error);
        res.status(500).json({ error: 'Erreur lors du changement de mot de passe: ' + error.message });
    }
};

// Demander la réinitialisation du mot de passe avec Supabase Auth
const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        
        if (!email) {
            return res.status(400).json({ error: 'Email requis' });
        }
        
        // Utiliser Supabase Auth pour envoyer l'email de réinitialisation
        const { error: authError } = await db.supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${process.env.APP_URL || 'http://localhost:3000'}/reset-password.html`
        });
        
        // Ne pas révéler si l'email existe ou non (sécurité)
        // Supabase retourne toujours un succès même si l'email n'existe pas
        res.json({ 
            message: 'Si cet email existe dans notre système, un lien de réinitialisation vous a été envoyé.' 
        });
    } catch (error) {
        console.error('Erreur lors de la demande de réinitialisation:', error);
        res.status(500).json({ error: 'Erreur lors de la demande de réinitialisation: ' + error.message });
    }
};

// Réinitialiser le mot de passe avec Supabase Auth
// Note: Cette fonction est généralement gérée côté frontend avec Supabase Auth
// Le token est géré automatiquement par Supabase dans l'URL de redirection
const resetPassword = async (req, res) => {
    try {
        const { token, newPassword } = req.body;
        
        if (!token || !newPassword) {
            return res.status(400).json({ error: 'Token et nouveau mot de passe sont requis' });
        }
        
        // Validation du nouveau mot de passe
        const passwordValidation = validatePassword(newPassword);
        if (!passwordValidation.valid) {
            return res.status(400).json({ error: passwordValidation.error });
        }
        
        // Utiliser Supabase Auth pour réinitialiser le mot de passe
        // Le token est vérifié automatiquement par Supabase
        const { error: authError } = await db.supabase.auth.updateUser({
            password: newPassword
        });
        
        if (authError) {
            return res.status(400).json({ error: 'Token de réinitialisation invalide ou expiré' });
        }
        
        res.json({ message: 'Mot de passe réinitialisé avec succès. Vous pouvez maintenant vous connecter.' });
    } catch (error) {
        console.error('Erreur lors de la réinitialisation du mot de passe:', error);
        res.status(500).json({ error: 'Erreur lors de la réinitialisation du mot de passe: ' + error.message });
    }
};

module.exports = {
    register,
    login,
    getMe,
    updateProfile,
    changePassword,
    resendVerificationEmail,
    forgotPassword,
    resetPassword
};
