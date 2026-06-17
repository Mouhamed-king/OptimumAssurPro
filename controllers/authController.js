// ============================================
// CONTRÔLEUR D'AUTHENTIFICATION (Supabase Auth)
// ============================================

const db = require('../database/connection');

const debugEnabled = process.env.DEBUG_LOGS === 'true';

function debugLog(...args) {
    if (debugEnabled) {
        console.log(...args);
    }
}

function sanitizeEntreprise(entreprise) {
    if (!entreprise) return null;

    return {
        id: entreprise.id,
        nom: entreprise.nom,
        email: entreprise.email,
        telephone: entreprise.telephone,
        adresse: entreprise.adresse
    };
}

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
        const appUrl = process.env.APP_URL || process.env.RENDER_EXTERNAL_URL || 'http://localhost:3000';
        const redirectUrl = `${appUrl}/verify-email.html`;
        
        debugLog('Supabase signup attempt');
        
        const { data: authData, error: authError } = await db.supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    nom, // Métadonnées utilisateur
                    telephone: telephone || null,
                    adresse: adresse || null
                },
                emailRedirectTo: redirectUrl
            }
        });
        
        if (authError) {
            return res.status(400).json({ error: 'Impossible de créer le compte pour le moment' });
        }
        
        if (!authData.user) {
            return res.status(500).json({ error: 'Erreur lors de la création du compte' });
        }
        
        debugLog('Supabase user created', {
            emailConfirmed: authData.user.email_confirmed_at !== null,
            hasSession: authData.session !== null
        });
        
        // Vérifier que l'utilisateur existe bien dans auth.users avant d'insérer
        // Parfois il y a un délai entre la création Auth et la disponibilité dans la DB
        let userExists = false;
        let retryCount = 0;
        const maxRetries = 3;
        
        // L'utilisateur vient d'être créé par Supabase Auth, il existe forcément
        // Pas besoin de vérifier avec admin API (qui n'est pas toujours disponible)
        userExists = true;
        debugLog('User created in auth and ready for entreprises insert');
        
        // Créer l'enregistrement dans la table entreprises avec l'ID de Supabase Auth
        // IMPORTANT: Utiliser le token de l'utilisateur pour bypass RLS avec les politiques appropriées
        debugLog('Creating entreprises record');
        let newEntreprise = null;
        let insertError = null;
        
        // Créer un client Supabase avec le token de l'utilisateur pour respecter RLS
        // Le SERVICE_ROLE_KEY devrait bypass RLS, mais utilisons le token utilisateur pour être sûr
        const userSupabase = db.supabase; // Utiliser le client avec SERVICE_ROLE_KEY qui bypass RLS
        
        // Réessayer l'insertion plusieurs fois si nécessaire
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            const { data, error } = await userSupabase
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
            
            if (!error) {
                newEntreprise = data;
                debugLog('Entreprise created in table', newEntreprise?.id);
                break;
            }
            
            insertError = error;
            
            // Si c'est une erreur de clé étrangère, attendre et réessayer
            if (error.code === '23503' && attempt < maxRetries - 1) {
                await new Promise(resolve => setTimeout(resolve, 500));
            } else {
                break; // Autre erreur ou max tentatives atteint
            }
        }
        
        if (insertError) {
            if (insertError.message.includes('duplicate') || insertError.code === '23505') {
                const { data: updatedEntreprise } = await db.supabase
                    .from('entreprises')
                    .update({
                        nom,
                        email,
                        telephone: telephone || null,
                        adresse: adresse || null,
                        email_verified: authData.user.email_confirmed_at !== null
                    })
                    .eq('id', authData.user.id)
                    .select()
                    .single();
                newEntreprise = updatedEntreprise;
            } else if (insertError.code === '23503') {
                // L'enregistrement sera créé lors de la première connexion
            } else {
                // Ne pas bloquer l'inscription si la table entreprise n'est pas prête
            }
        }
        
        res.status(201).json({
            message: 'Compte créé. Veuillez vérifier votre email pour activer votre compte.'
        });
    } catch (error) {
        res.status(500).json({ error: 'Erreur lors de l\'inscription' });
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
            if (
                authError.message.includes('Invalid login credentials') ||
                authError.message.includes('Email not confirmed') ||
                authError.message.includes('email_not_confirmed') ||
                authError.status === 400
            ) {
                return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
            }

            return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
        }
        
        if (!authData.user) {
            return res.status(500).json({ error: 'Erreur lors de la connexion' });
        }
        
        // Vérifier si l'email est confirmé (Supabase Auth)
        const isEmailVerified = authData.user.email_confirmed_at !== null;
        
        if (!isEmailVerified) {
            return res.status(403).json({ error: 'Compte non vérifié' });
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
            token: authData.session.access_token,
            refreshToken: authData.session.refresh_token,
            entreprise: {
                id: entrepriseData?.id || authData.user.id,
                nom: entrepriseData?.nom || authData.user.user_metadata?.nom || 'Utilisateur'
            }
        });
    } catch (error) {
        res.status(500).json({ error: 'Erreur lors de la connexion' });
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
            message: 'Si cet email existe et n\'est pas encore vérifié, un email de vérification vous sera envoyé.'
        });
    } catch (error) {
        res.status(500).json({ error: 'Erreur lors du renvoi de l\'email' });
    }
};

// Obtenir les informations de l'entreprise connectée
const getMe = async (req, res) => {
    try {
        const userId = req.userId || req.entrepriseId;
        
        if (!userId) {
            return res.status(401).json({ error: 'Accès non autorisé' });
        }
        
        // Si l'entreprise est déjà dans req (créée par le middleware), l'utiliser
        if (req.entreprise) {
            return res.json({ entreprise: sanitizeEntreprise(req.entreprise) });
        }
        
        // Sinon, récupérer depuis la base de données
        const { data: entreprise, error } = await db.supabase
            .from('entreprises')
            .select('id, nom, email, telephone, adresse')
            .eq('id', userId)
            .single();
        
        if (error) {
            if (error.code === 'PGRST116' && req.user) {
                const { data: newEntreprise } = await db.supabase
                    .from('entreprises')
                    .insert({
                        id: req.user.id,
                        nom: req.user.user_metadata?.nom || 'Utilisateur',
                        email: req.user.email,
                        email_verified: req.user.email_confirmed_at !== null
                    })
                    .select('id, nom, email, telephone, adresse')
                    .single();
                
                if (newEntreprise) {
                    return res.json({ entreprise: sanitizeEntreprise(newEntreprise) });
                }
            }
            return res.status(404).json({ error: 'Profil non trouvé' });
        }
        
        if (!entreprise) {
            return res.status(404).json({ error: 'Profil non trouvé' });
        }
        
        res.json({ entreprise: sanitizeEntreprise(entreprise) });
    } catch (error) {
        res.status(500).json({ error: 'Erreur lors de la récupération des informations' });
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
            .select('id, nom, email, telephone, adresse')
            .single();
        
        if (updateError) {
            throw updateError;
        }
        
        res.json({
            message: 'Profil mis à jour avec succès',
            entreprise: sanitizeEntreprise(updated)
        });
    } catch (error) {
        res.status(500).json({ error: 'Erreur lors de la mise à jour du profil' });
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
        res.status(500).json({ error: 'Erreur lors du changement de mot de passe' });
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
        res.status(500).json({ error: 'Erreur lors de la demande de réinitialisation' });
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
        
        const { data: { user }, error: tokenError } = await db.supabase.auth.getUser(token);

        if (tokenError || !user) {
            return res.status(400).json({ error: 'Token de r�initialisation invalide ou expir�' });
        }

        // Utiliser Supabase Auth pour réinitialiser le mot de passe
        // Le token est vérifié automatiquement par Supabase
        const { error: authError } = await db.supabase.auth.admin.updateUserById(user.id, {
            password: newPassword
        });
        
        if (authError) {
            return res.status(400).json({ error: 'Token de réinitialisation invalide ou expiré' });
        }
        
        res.json({ message: 'Mot de passe réinitialisé avec succès. Vous pouvez maintenant vous connecter.' });
    } catch (error) {
        res.status(500).json({ error: 'Erreur lors de la réinitialisation du mot de passe' });
    }
};

const verifyEmail = async (req, res) => {
    try {
        const { token } = req.body;

        if (!token) {
            return res.status(400).json({ error: 'Lien de vérification invalide' });
        }

        const { data: { user }, error } = await db.supabase.auth.getUser(token);

        if (error || !user || !user.email_confirmed_at) {
            return res.status(400).json({ error: 'Lien de vérification invalide ou expiré' });
        }

        const { data: entreprise } = await db.supabase
            .from('entreprises')
            .select('id, nom, email, telephone, adresse')
            .eq('id', user.id)
            .maybeSingle();

        res.json({
            verified: true,
            entreprise: sanitizeEntreprise(entreprise)
        });
    } catch (error) {
        res.status(500).json({ error: 'Erreur lors de la vérification de l\'email' });
    }
};

module.exports = {
    register,
    login,
    getMe,
    updateProfile,
    changePassword,
    resendVerificationEmail,
    verifyEmail,
    forgotPassword,
    resetPassword
};
