// ============================================
// MIDDLEWARE D'AUTHENTIFICATION (Supabase Auth)
// ============================================

const db = require('../database/connection');

// Middleware pour vérifier le token Supabase Auth
const authenticateToken = async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1]; // Format: "Bearer TOKEN"
        
        if (!token) {
            return res.status(401).json({ error: 'Token d\'authentification manquant' });
        }
        
        // Vérifier le token avec Supabase Auth
        const { data: { user }, error: authError } = await db.supabase.auth.getUser(token);
        
        if (authError || !user) {
            return res.status(401).json({ error: 'Token invalide ou expiré' });
        }
        
        // Vérifier que l'email est confirmé (email_confirmed_at)
        if (!user.email_confirmed_at) {
            return res.status(403).json({ 
                error: 'Veuillez vérifier votre adresse email avant d\'accéder à cette ressource.',
                code: 'EMAIL_NOT_CONFIRMED'
            });
        }
        
        // Vérifier que l'entreprise existe dans la table entreprises
        const { data: entreprise, error: entrepriseError } = await db.supabase
            .from('entreprises')
            .select('id, nom, email, email_verified')
            .eq('id', user.id)
            .single();
        
        // Si l'entreprise n'existe pas, créer un enregistrement minimal
        if (entrepriseError && entrepriseError.code === 'PGRST116') {
            console.warn('⚠️ Entreprise non trouvée dans la table, création d\'un enregistrement minimal');
            const { data: newEntreprise } = await db.supabase
                .from('entreprises')
                .insert({
                    id: user.id,
                    nom: user.user_metadata?.nom || 'Utilisateur',
                    email: user.email,
                    email_verified: user.email_confirmed_at !== null
                })
                .select('id, nom, email, email_verified')
                .single();
            
            if (newEntreprise) {
                req.entreprise = newEntreprise;
                req.entrepriseId = user.id;
                req.userId = user.id;
                req.emailVerified = user.email_confirmed_at !== null;
                next();
                return;
            }
        }
        
        if (entrepriseError || !entreprise) {
            return res.status(401).json({ error: 'Entreprise non trouvée' });
        }
        
        // Synchroniser email_verified avec Supabase Auth si nécessaire
        const isEmailVerified = user.email_confirmed_at !== null;
        if (entreprise.email_verified !== isEmailVerified) {
            await db.supabase
                .from('entreprises')
                .update({ email_verified: isEmailVerified })
                .eq('id', user.id);
            entreprise.email_verified = isEmailVerified;
        }
        
        // Ajouter les informations de l'entreprise à la requête
        req.entreprise = entreprise;
        req.entrepriseId = user.id;
        req.userId = user.id;
        req.user = user; // Exposer l'utilisateur Supabase Auth
        req.emailVerified = isEmailVerified;
        
        next();
    } catch (error) {
        console.error('Erreur d\'authentification:', error);
        return res.status(500).json({ error: 'Erreur d\'authentification: ' + error.message });
    }
};

module.exports = {
    authenticateToken
};

