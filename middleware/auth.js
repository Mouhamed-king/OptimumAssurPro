const db = require('../database/connection');

const debugEnabled = process.env.DEBUG_LOGS === 'true';

function debugLog(...args) {
    if (debugEnabled) {
        console.log(...args);
    }
}

function extractBearerToken(authHeader) {
    if (!authHeader || typeof authHeader !== 'string') {
        return null;
    }

    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    return match ? match[1].trim() : null;
}

const authenticateToken = async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = extractBearerToken(authHeader);

        debugLog('authenticateToken called', { hasAuthorizationHeader: !!authHeader, hasToken: !!token });

        if (!token) {
            return res.status(401).json({ error: 'Accès non autorisé' });
        }

        const { data: { user }, error: authError } = await db.supabase.auth.getUser(token);

        if (authError || !user) {
            return res.status(401).json({ error: 'Accès non autorisé' });
        }

        if (!user.email_confirmed_at) {
            return res.status(403).json({ error: 'Compte non vérifié' });
        }

        const { data: entreprise, error: entrepriseError } = await db.supabase
            .from('entreprises')
            .select('id, nom, email, email_verified')
            .eq('id', user.id)
            .single();

        if (entrepriseError && entrepriseError.code === 'PGRST116') {
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

            req.entreprise = newEntreprise || {
                id: user.id,
                nom: user.user_metadata?.nom || 'Utilisateur',
                email: user.email,
                email_verified: user.email_confirmed_at !== null
            };
            req.entrepriseId = user.id;
            req.userId = user.id;
            req.user = user;
            req.emailVerified = user.email_confirmed_at !== null;
            next();
            return;
        }

        if (entrepriseError || !entreprise) {
            req.entreprise = {
                id: user.id,
                nom: user.user_metadata?.nom || 'Utilisateur',
                email: user.email,
                email_verified: user.email_confirmed_at !== null
            };
            req.entrepriseId = user.id;
            req.userId = user.id;
            req.user = user;
            req.emailVerified = user.email_confirmed_at !== null;
            next();
            return;
        }

        const isEmailVerified = user.email_confirmed_at !== null;
        if (entreprise.email_verified !== isEmailVerified) {
            await db.supabase
                .from('entreprises')
                .update({ email_verified: isEmailVerified })
                .eq('id', user.id);
            entreprise.email_verified = isEmailVerified;
        }

        req.entreprise = entreprise;
        req.entrepriseId = user.id;
        req.userId = user.id;
        req.user = user;
        req.emailVerified = isEmailVerified;

        next();
    } catch (error) {
        return res.status(500).json({ error: 'Erreur d\'authentification' });
    }
};

module.exports = {
    authenticateToken
};
