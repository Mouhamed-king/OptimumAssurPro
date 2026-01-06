// ============================================
// SERVEUR PRINCIPAL - OptimumAssurPro
// ============================================

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

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
// IMPORTANT: express.static doit être AVANT toutes les autres routes
// pour que les fichiers CSS/JS soient servis correctement
const staticOptions = {
    maxAge: '1y',
    etag: true,
    lastModified: true,
    index: false, // Ne pas servir index.html automatiquement pour les dossiers
    setHeaders: (res, filePath) => {
        // Définir les headers appropriés selon le type de fichier
        const ext = path.extname(filePath);
        if (ext === '.js') {
            res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
        } else if (ext === '.css') {
            res.setHeader('Content-Type', 'text/css; charset=utf-8');
        }
    }
};

app.use(express.static(path.join(__dirname, '.'), staticOptions));

// Routes explicites pour les fichiers statiques (sécurité supplémentaire pour Vercel)
app.get('/css/:file', (req, res) => {
    res.sendFile(path.join(__dirname, 'css', req.params.file));
});

app.get('/js/:file', (req, res) => {
    res.sendFile(path.join(__dirname, 'js', req.params.file));
});

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

// Route pour servir le frontend
// Cette route ne sera appelée QUE si express.static n'a pas trouvé de fichier correspondant
app.get('*', (req, res) => {
    // Ignorer les routes API
    if (req.path.startsWith('/api')) {
        return res.status(404).json({ error: 'Route API non trouvée' });
    }
    
    // Vérifier explicitement que ce n'est pas un fichier statique
    const ext = path.extname(req.path).toLowerCase();
    const staticExtensions = ['.css', '.js', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.woff', '.woff2', '.ttf', '.eot', '.json'];
    
    // Si c'est un fichier statique, retourner 404 (il devrait être servi par express.static ou les routes explicites)
    if (staticExtensions.includes(ext)) {
        return res.status(404).send('File not found');
    }
    
    // Si c'est la racine ou index.html, servir login.html par défaut
    // L'application frontend gérera la redirection vers index.html si l'utilisateur est connecté
    if (req.path === '/' || req.path === '/index.html') {
        // Vérifier si l'utilisateur a un token dans les cookies ou headers (pour le SSR)
        // Sinon, servir login.html par défaut
        return res.sendFile(path.join(__dirname, 'login.html'));
    }
    
    // Pour les autres routes, servir le fichier HTML correspondant ou index.html
    const htmlFile = req.path.endsWith('.html') ? req.path : req.path + '.html';
    const filePath = path.join(__dirname, htmlFile);
    
    // Vérifier si le fichier existe
    if (fs.existsSync(filePath)) {
        return res.sendFile(filePath);
    }
    
    // Sinon, servir login.html par défaut
    res.sendFile(path.join(__dirname, 'login.html'));
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

