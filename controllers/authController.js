// ============================================
// CONTRÔLEUR D'AUTHENTIFICATION (Supabase SDK)
// ============================================

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../database/connection');
const emailService = require('../services/emailService');

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

// Inscription d'une nouvelle entreprise
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
        
        // Vérifier si l'email existe déjà avec Supabase
        const { data: existing, error: checkError } = await db.supabase
            .from('entreprises')
            .select('id')
            .eq('email', email)
            .maybeSingle();
        
        if (checkError && checkError.code !== 'PGRST116') {
            throw checkError;
        }
        
        if (existing) {
            return res.status(400).json({ error: 'Cet email est déjà utilisé' });
        }
        
        // Hasher le mot de passe
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Générer un token de vérification email
        const verificationToken = crypto.randomBytes(32).toString('hex');
        const verificationExpires = new Date();
        verificationExpires.setHours(verificationExpires.getHours() + 24); // Expire dans 24h
        
        // Créer l'entreprise avec Supabase (email non vérifié)
        const { data: newEntreprise, error: insertError } = await db.supabase
            .from('entreprises')
            .insert({
                nom,
                email,
                password: hashedPassword,
                telephone: telephone || null,
                adresse: adresse || null,
                email_verified: false,
                email_verification_token: verificationToken,
                email_verification_expires: verificationExpires.toISOString()
            })
            .select()
            .single();
        
        if (insertError) {
            throw insertError;
        }
        
        // Envoyer l'email de vérification
        let emailSent = false;
        let emailErrorMsg = null;
        let shouldReturnLink = false;
        
        try {
            console.log('📧 Tentative d\'envoi de l\'email de vérification à:', email);
            const emailResult = await emailService.sendVerificationEmail(email, verificationToken, nom);
            emailSent = true;
            console.log('✅ Email envoyé avec succès:', emailResult);
        } catch (error) {
            console.error('❌ Erreur lors de l\'envoi de l\'email:', error);
            console.error('   Détails:', error.message);
            console.error('   Stack:', error.stack);
            emailErrorMsg = error.message;
            
            // Si c'est une erreur SMTP (timeout, connexion refusée), retourner le lien de vérification
            if (error.isSmtpError && (error.shouldReturnLink || error.code === 'ETIMEDOUT' || error.code === 'ESOCKETTIMEDOUT' || error.code === 'ECONNREFUSED')) {
                shouldReturnLink = true;
                console.log('⚠️  Erreur SMTP détectée, le lien de vérification sera retourné dans la réponse');
                if (error.suggestion) {
                    console.log('💡 Suggestion:', error.suggestion);
                }
            }
            // On continue même si l'email n'a pas pu être envoyé
            // L'utilisateur pourra utiliser le lien de vérification ou demander un renvoi plus tard
        }
        
        // Si SMTP n'est pas configuré ou si erreur SMTP, afficher le lien de vérification dans la réponse
        const verificationUrl = `${process.env.APP_URL || (process.env.NODE_ENV === 'production' ? 'https://optimumassurpro.onrender.com' : 'http://localhost:3000')}/verify-email.html?token=${verificationToken}`;
        
        res.status(201).json({
            message: emailSent 
                ? 'Compte créé avec succès. Veuillez vérifier votre email pour activer votre compte.'
                : shouldReturnLink
                ? 'Compte créé avec succès. L\'email n\'a pas pu être envoyé (Gmail bloque les connexions depuis Render). Utilisez le lien de vérification ci-dessous.'
                : 'Compte créé avec succès. SMTP n\'est pas configuré. Veuillez utiliser le lien de vérification ci-dessous ou contacter l\'administrateur.',
            emailSent: emailSent,
            verificationUrl: (!emailSent || shouldReturnLink) ? verificationUrl : undefined,
            verificationToken: (!emailSent || shouldReturnLink) ? verificationToken : undefined,
            smtpError: emailErrorMsg || undefined,
            entreprise: {
                id: newEntreprise.id,
                nom: newEntreprise.nom,
                email: newEntreprise.email,
                email_verified: false
            }
        });
    } catch (error) {
        console.error('Erreur lors de l\'inscription:', error);
        res.status(500).json({ error: 'Erreur lors de l\'inscription: ' + error.message });
    }
};

// Connexion d'une entreprise
const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        
        // Validation
        if (!email || !password) {
            return res.status(400).json({ error: 'Email et mot de passe sont requis' });
        }
        
        // Trouver l'entreprise avec Supabase
        const { data: entreprise, error: findError } = await db.supabase
            .from('entreprises')
            .select('id, nom, email, password, email_verified')
            .eq('email', email)
            .single();
        
        if (findError || !entreprise) {
            return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
        }
        
        // Vérifier le mot de passe
        const isValidPassword = await bcrypt.compare(password, entreprise.password);
        
        if (!isValidPassword) {
            return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
        }
        
        // Vérifier si l'email est vérifié
        if (!entreprise.email_verified) {
            return res.status(403).json({ 
                error: 'Veuillez vérifier votre adresse email avant de vous connecter. Un email de vérification vous a été envoyé lors de l\'inscription.' 
            });
        }
        
        // Générer le token JWT
        const token = jwt.sign(
            { entrepriseId: entreprise.id, email: entreprise.email },
            process.env.JWT_SECRET || 'votre_secret_jwt_tres_securise_changez_moi',
            { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
        );
        
        res.json({
            message: 'Connexion réussie',
            token,
            entreprise: {
                id: entreprise.id,
                nom: entreprise.nom,
                email: entreprise.email
            }
        });
    } catch (error) {
        console.error('Erreur lors de la connexion:', error);
        res.status(500).json({ error: 'Erreur lors de la connexion: ' + error.message });
    }
};

// Vérifier l'email avec le token
const verifyEmail = async (req, res) => {
    try {
        const { token } = req.query;
        
        if (!token) {
            return res.status(400).json({ error: 'Token de vérification manquant' });
        }
        
        // Trouver l'entreprise avec ce token
        const { data: entreprise, error: findError } = await db.supabase
            .from('entreprises')
            .select('id, nom, email, email_verification_expires, email_verified')
            .eq('email_verification_token', token)
            .single();
        
        if (findError || !entreprise) {
            return res.status(400).json({ error: 'Token de vérification invalide ou expiré' });
        }
        
        // Vérifier si l'email est déjà vérifié
        if (entreprise.email_verified) {
            return res.status(400).json({ error: 'Cet email a déjà été vérifié' });
        }
        
        // Vérifier si le token a expiré
        const expiresAt = new Date(entreprise.email_verification_expires);
        if (expiresAt < new Date()) {
            return res.status(400).json({ error: 'Le token de vérification a expiré. Veuillez demander un nouveau lien de vérification.' });
        }
        
        // Mettre à jour l'entreprise pour marquer l'email comme vérifié
        const { error: updateError } = await db.supabase
            .from('entreprises')
            .update({
                email_verified: true,
                email_verification_token: null,
                email_verification_expires: null
            })
            .eq('id', entreprise.id);
        
        if (updateError) {
            throw updateError;
        }
        
        res.json({
            message: 'Email vérifié avec succès ! Vous pouvez maintenant vous connecter.',
            success: true
        });
    } catch (error) {
        console.error('Erreur lors de la vérification de l\'email:', error);
        res.status(500).json({ error: 'Erreur lors de la vérification de l\'email: ' + error.message });
    }
};

// Renvoyer l'email de vérification
const resendVerificationEmail = async (req, res) => {
    try {
        const { email } = req.body;
        
        if (!email) {
            return res.status(400).json({ error: 'Email requis' });
        }
        
        // Trouver l'entreprise
        const { data: entreprise, error: findError } = await db.supabase
            .from('entreprises')
            .select('id, nom, email, email_verified')
            .eq('email', email)
            .single();
        
        if (findError || !entreprise) {
            // Ne pas révéler si l'email existe ou non pour la sécurité
            return res.json({ 
                message: 'Si cet email existe et n\'est pas encore vérifié, un email de vérification vous sera envoyé.' 
            });
        }
        
        if (entreprise.email_verified) {
            return res.status(400).json({ error: 'Cet email est déjà vérifié' });
        }
        
        // Générer un nouveau token
        const verificationToken = crypto.randomBytes(32).toString('hex');
        const verificationExpires = new Date();
        verificationExpires.setHours(verificationExpires.getHours() + 24);
        
        // Mettre à jour le token
        const { error: updateError } = await db.supabase
            .from('entreprises')
            .update({
                email_verification_token: verificationToken,
                email_verification_expires: verificationExpires.toISOString()
            })
            .eq('id', entreprise.id);
        
        if (updateError) {
            throw updateError;
        }
        
        // Envoyer l'email
        let emailSent = false;
        try {
            await emailService.sendVerificationEmail(email, verificationToken, entreprise.nom);
            emailSent = true;
            res.json({ 
                message: 'Email de vérification envoyé avec succès',
                emailSent: true
            });
        } catch (emailError) {
            console.error('Erreur lors de l\'envoi de l\'email:', emailError);
            // Si SMTP n'est pas configuré, retourner le lien de vérification
            const verificationUrl = `${process.env.APP_URL || (process.env.NODE_ENV === 'production' ? 'https://optimumassurpro.onrender.com' : 'http://localhost:3000')}/verify-email.html?token=${verificationToken}`;
            res.status(500).json({ 
                error: 'Impossible d\'envoyer l\'email de vérification. SMTP non configuré.',
                emailSent: false,
                verificationUrl: verificationUrl,
                verificationToken: verificationToken
            });
        }
    } catch (error) {
        console.error('Erreur lors du renvoi de l\'email:', error);
        res.status(500).json({ error: 'Erreur lors du renvoi de l\'email: ' + error.message });
    }
};

// Obtenir les informations de l'entreprise connectée
const getMe = async (req, res) => {
    try {
        const { data: entreprise, error } = await db.supabase
            .from('entreprises')
            .select('id, nom, email, telephone, adresse, created_at')
            .eq('id', req.entrepriseId)
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

// Changer le mot de passe
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
        
        // Récupérer l'entreprise avec le mot de passe
        const { data: entreprise, error: findError } = await db.supabase
            .from('entreprises')
            .select('id, password')
            .eq('id', req.entrepriseId)
            .single();
        
        if (findError || !entreprise) {
            return res.status(404).json({ error: 'Entreprise non trouvée' });
        }
        
        // Vérifier le mot de passe actuel
        const isValidPassword = await bcrypt.compare(currentPassword, entreprise.password);
        
        if (!isValidPassword) {
            return res.status(401).json({ error: 'Mot de passe actuel incorrect' });
        }
        
        // Hasher le nouveau mot de passe
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        
        // Mettre à jour le mot de passe avec Supabase
        const { error: updateError } = await db.supabase
            .from('entreprises')
            .update({ password: hashedPassword })
            .eq('id', req.entrepriseId);
        
        if (updateError) {
            throw updateError;
        }
        
        res.json({ message: 'Mot de passe changé avec succès' });
    } catch (error) {
        console.error('Erreur lors du changement de mot de passe:', error);
        res.status(500).json({ error: 'Erreur lors du changement de mot de passe: ' + error.message });
    }
};

// Demander la réinitialisation du mot de passe
const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        
        if (!email) {
            return res.status(400).json({ error: 'Email requis' });
        }
        
        // Trouver l'entreprise
        const { data: entreprise, error: findError } = await db.supabase
            .from('entreprises')
            .select('id, nom, email')
            .eq('email', email)
            .single();
        
        // Ne pas révéler si l'email existe ou non (sécurité)
        if (findError || !entreprise) {
            // Retourner un succès même si l'email n'existe pas (pour éviter l'énumération)
            return res.json({ 
                message: 'Si cet email existe dans notre système, un lien de réinitialisation vous a été envoyé.' 
            });
        }
        
        // Générer un token de réinitialisation
        const resetToken = crypto.randomBytes(32).toString('hex');
        const resetExpires = new Date();
        resetExpires.setHours(resetExpires.getHours() + 1); // Expire dans 1h
        
        // Sauvegarder le token dans la base de données
        // Note: Vous devrez ajouter ces colonnes à la table entreprises si elles n'existent pas
        // password_reset_token, password_reset_expires
        const { error: updateError } = await db.supabase
            .from('entreprises')
            .update({
                password_reset_token: resetToken,
                password_reset_expires: resetExpires.toISOString()
            })
            .eq('id', entreprise.id);
        
        if (updateError) {
            // Si les colonnes n'existent pas, on les crée d'abord
            console.warn('Les colonnes password_reset_token et password_reset_expires n\'existent peut-être pas');
            // Pour l'instant, on continue quand même
        }
        
        // Envoyer l'email
        try {
            await emailService.sendPasswordResetEmail(email, resetToken, entreprise.nom);
            res.json({ 
                message: 'Si cet email existe dans notre système, un lien de réinitialisation vous a été envoyé.' 
            });
        } catch (emailError) {
            console.error('Erreur lors de l\'envoi de l\'email:', emailError);
            res.status(500).json({ error: 'Impossible d\'envoyer l\'email de réinitialisation' });
        }
    } catch (error) {
        console.error('Erreur lors de la demande de réinitialisation:', error);
        res.status(500).json({ error: 'Erreur lors de la demande de réinitialisation: ' + error.message });
    }
};

// Réinitialiser le mot de passe avec le token
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
        
        // Trouver l'entreprise avec ce token
        const { data: entreprise, error: findError } = await db.supabase
            .from('entreprises')
            .select('id, password_reset_expires')
            .eq('password_reset_token', token)
            .single();
        
        if (findError || !entreprise) {
            return res.status(400).json({ error: 'Token de réinitialisation invalide ou expiré' });
        }
        
        // Vérifier si le token a expiré
        if (entreprise.password_reset_expires) {
            const expiresAt = new Date(entreprise.password_reset_expires);
            if (expiresAt < new Date()) {
                return res.status(400).json({ error: 'Le token de réinitialisation a expiré. Veuillez faire une nouvelle demande.' });
            }
        }
        
        // Hasher le nouveau mot de passe
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        
        // Mettre à jour le mot de passe et supprimer le token
        const { error: updateError } = await db.supabase
            .from('entreprises')
            .update({
                password: hashedPassword,
                password_reset_token: null,
                password_reset_expires: null
            })
            .eq('id', entreprise.id);
        
        if (updateError) {
            throw updateError;
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
    verifyEmail,
    resendVerificationEmail,
    forgotPassword,
    resetPassword
};
