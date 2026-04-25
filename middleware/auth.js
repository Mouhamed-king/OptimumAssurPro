// ============================================
// MIDDLEWARE D'AUTHENTIFICATION (Supabase Auth)
// ============================================

const db = require('../database/connection');

const debugEnabled = process.env.DEBUG_LOGS === 'true';

function debugLog(...args) {
    if (debugEnabled) {
        console.log(...args);
    }
}

// Middleware pour vérifier le token Supabase Auth
const authenticateToken = async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1]; // Format: "Bearer TOKEN"
        
        debugLog('authenticateToken called', { hasAuthorizationHeader: !!authHeader, hasToken: !!token });
        
        if (!token) {
            console.error('❌ Token manquant dans la requête');
            return res.status(401).json({ error: 'Token d\'authentification manquant' });
        }
        
        // Vérifier le token avec Supabase Auth
        debugLog('Verifying token with Supabase Auth');
        const { data: { user }, error: authError } = await db.supabase.auth.getUser(token);
        
        if (authError || !user) {
            console.error('❌ Erreur lors de la vérification du token:', authError?.message);
            return res.status(401).json({ error: 'Token invalide ou expiré' });
        }
        
        debugLog('Token verified for user', user.id);
        
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
            debugLog('Entreprise missing, creating minimal record', { userId: user.id });
            
            // Réessayer plusieurs fois car il peut y avoir un délai de propagation ou problème RLS
            let newEntreprise = null;
            let insertError = null;
            const maxRetries = 3;
            
            for (let attempt = 0; attempt < maxRetries; attempt++) {
                const { data, error } = await db.supabase
                    .from('entreprises')
                    .insert({
                        id: user.id,
                        nom: user.user_metadata?.nom || 'Utilisateur',
                        email: user.email,
                        email_verified: user.email_confirmed_at !== null
                    })
                    .select('id, nom, email, email_verified')
                    .single();
                
                if (!error) {
                    newEntreprise = data;
                    debugLog('Entreprise created successfully', newEntreprise.id);
                    break;
                }
                
                insertError = error;
                
                // Si c'est une erreur de duplicate, essayer de récupérer l'enregistrement existant
                if (error.code === '23505' || error.message.includes('duplicate')) {
                    debugLog('Entreprise already existed, fetching existing record');
                    const { data: existing } = await db.supabase
                        .from('entreprises')
                        .select('id, nom, email, email_verified')
                        .eq('id', user.id)
                        .single();
                    
                    if (existing) {
                        newEntreprise = existing;
                        debugLog('Existing entreprise found', existing.id);
                        break;
                    }
                }
                
                // Si c'est une erreur RLS, les politiques ne sont peut-être pas créées
                if (error.code === '42501' || error.message.includes('row-level security') || error.message.includes('policy')) {
                    console.error('❌ Erreur RLS détectée. Les politiques RLS ne sont peut-être pas créées.');
                    console.error('   Exécutez le script database/fix-rls-entreprises.sql dans Supabase Dashboard');
                    // Ne pas réessayer si c'est une erreur RLS
                    break;
                }
                
                // Si ce n'est pas une erreur de clé étrangère, arrêter après la première tentative
                if (error.code !== '23503' || attempt >= maxRetries - 1) {
                    break;
                }
                
                // Attendre un peu avant de réessayer (seulement pour erreur de clé étrangère)
                if (debugEnabled) {
                    console.warn(`Tentative ${attempt + 1}/${maxRetries} - reessai creation entreprise`);
                }
                await new Promise(resolve => setTimeout(resolve, 300));
            }
            
            if (newEntreprise) {
                req.entreprise = newEntreprise;
                req.entrepriseId = user.id;
                req.userId = user.id;
                req.emailVerified = user.email_confirmed_at !== null;
                next();
                return;
            } else {
                console.error('❌ Impossible de créer l\'enregistrement entreprise après', maxRetries, 'tentatives');
                console.error('   Code erreur:', insertError?.code);
                console.error('   Message:', insertError?.message);
                
                // Si c'est une erreur RLS, donner des instructions claires
                if (insertError?.code === '42501' || insertError?.message?.includes('row-level security')) {
                    console.error('   ⚠️ ACTION REQUISE: Exécutez database/fix-rls-entreprises.sql dans Supabase Dashboard');
                }
                
                // Ne pas bloquer la requête, créer un objet minimal
                req.entreprise = {
                    id: user.id,
                    nom: user.user_metadata?.nom || 'Utilisateur',
                    email: user.email,
                    email_verified: user.email_confirmed_at !== null
                };
                req.entrepriseId = user.id;
                req.userId = user.id;
                req.emailVerified = user.email_confirmed_at !== null;
                next();
                return;
            }
        }
        
        if (entrepriseError || !entreprise) {
            // Si l'erreur n'est pas "not found", retourner une erreur
            if (entrepriseError && entrepriseError.code !== 'PGRST116') {
                console.error('❌ Erreur lors de la récupération de l\'entreprise:', entrepriseError);
                return res.status(500).json({ error: 'Erreur lors de la récupération de l\'entreprise' });
            }
            // Sinon, créer un objet minimal et continuer
            req.entreprise = {
                id: user.id,
                nom: user.user_metadata?.nom || 'Utilisateur',
                email: user.email,
                email_verified: user.email_confirmed_at !== null
            };
            req.entrepriseId = user.id;
            req.userId = user.id;
            req.emailVerified = user.email_confirmed_at !== null;
            next();
            return;
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
