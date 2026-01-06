// ============================================
// MIDDLEWARE D'AUTHENTIFICATION JWT (Supabase SDK)
// ============================================

const jwt = require('jsonwebtoken');
const db = require('../database/connection');

// Middleware pour vérifier le token JWT
const authenticateToken = async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1]; // Format: "Bearer TOKEN"
        
        if (!token) {
            return res.status(401).json({ error: 'Token d\'authentification manquant' });
        }
        
        // Vérifier le token
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'votre_secret_jwt_tres_securise_changez_moi');
        
        // Vérifier que l'entreprise existe toujours avec Supabase SDK
        const { data: entreprise, error } = await db.supabase
            .from('entreprises')
            .select('id, nom, email')
            .eq('id', decoded.entrepriseId)
            .single();
        
        if (error || !entreprise) {
            return res.status(401).json({ error: 'Entreprise non trouvée' });
        }
        
        // Ajouter les informations de l'entreprise à la requête
        req.entreprise = entreprise;
        req.entrepriseId = decoded.entrepriseId;
        
        next();
    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            return res.status(403).json({ error: 'Token invalide' });
        }
        if (error.name === 'TokenExpiredError') {
            return res.status(403).json({ error: 'Token expiré' });
        }
        console.error('Erreur d\'authentification:', error);
        return res.status(500).json({ error: 'Erreur d\'authentification: ' + error.message });
    }
};

module.exports = {
    authenticateToken
};

