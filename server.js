// ============================================
// SERVEUR PRINCIPAL - OptimumAssurPro
// ============================================

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

// Import des routes
const authRoutes = require('./routes/auth');
const clientRoutes = require('./routes/clients');
const contractRoutes = require('./routes/contracts');
const statsRoutes = require('./routes/stats');
const notificationRoutes = require('./routes/notifications');
const reportRoutes = require('./routes/reports');

// Import de la connexion à la base de données
const db = require('./database/connection');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir les fichiers statiques (frontend)
// Sur Vercel, les fichiers statiques sont servis automatiquement avant d'atteindre le serveur
// Mais on garde express.static pour le développement local
app.use(express.static(path.join(__dirname, '.'), {
    maxAge: '1y',
    etag: true,
    lastModified: true
}));

// Routes API
app.use('/api/auth', authRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/contracts', contractRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/reports', reportRoutes);

// Route de santé
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: 'OptimumAssurPro API is running',
        timestamp: new Date().toISOString()
    });
});

// Route pour servir le frontend (SPA)
// express.static sert déjà les fichiers statiques (CSS, JS, images, etc.)
// Cette route ne sera appelée que pour les routes qui ne correspondent à aucun fichier statique
app.get('*', (req, res) => {
    // Ignorer les routes API
    if (req.path.startsWith('/api')) {
        return res.status(404).json({ error: 'Route API non trouvée' });
    }
    
    // Servir index.html pour toutes les autres routes (SPA)
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Gestion des erreurs
app.use((err, req, res, next) => {
    console.error('Erreur:', err);
    res.status(err.status || 500).json({
        error: err.message || 'Erreur interne du serveur',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
});

// Démarrer le serveur uniquement si on n'est pas sur Vercel (serverless)
if (process.env.VERCEL !== '1') {
    db.connect()
        .then(() => {
            console.log('✅ Connexion à la base de données réussie');
            const server = app.listen(PORT, '0.0.0.0', () => {
                const env = process.env.NODE_ENV || 'development';
                console.log(`🚀 Serveur démarré sur le port ${PORT}`);
                console.log(`🌍 Environnement: ${env}`);
                if (env === 'development') {
                    console.log(`📱 Frontend disponible sur http://localhost:${PORT}`);
                    console.log(`🔌 API disponible sur http://localhost:${PORT}/api`);
                } else {
                    console.log(`📱 Application disponible sur ${process.env.APP_URL || `http://localhost:${PORT}`}`);
                }
            });
            
            // Gérer les erreurs de port occupé
            server.on('error', (error) => {
                if (error.code === 'EADDRINUSE') {
                    console.error(`❌ Le port ${PORT} est déjà utilisé.`);
                    if (process.env.NODE_ENV === 'development') {
                        console.error('💡 Solution: Arrêtez le processus qui utilise ce port ou changez le PORT dans .env');
                    }
                    process.exit(1);
                } else {
                    console.error('❌ Erreur serveur:', error);
                    process.exit(1);
                }
            });
        })
        .catch((error) => {
            console.error('❌ Erreur de connexion à la base de données:', error);
            process.exit(1);
        });
} else {
    // Sur Vercel, initialiser la connexion mais ne pas démarrer le serveur
    db.connect()
        .then(() => {
            console.log('✅ Connexion à la base de données réussie (Vercel)');
        })
        .catch((error) => {
            console.error('❌ Erreur de connexion à la base de données:', error);
        });
}

module.exports = app;

