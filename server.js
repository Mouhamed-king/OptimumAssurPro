require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/auth');
const clientRoutes = require('./routes/clients');
const contractRoutes = require('./routes/contracts');
const statsRoutes = require('./routes/stats');
const notificationRoutes = require('./routes/notifications');
const reportRoutes = require('./routes/reports');
const assistantRoutes = require('./routes/assistant');

const db = require('./database/connection');

const app = express();
const PORT = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === 'production';

app.disable('x-powered-by');

function getPrimaryOrigin() {
    return process.env.APP_URL || process.env.RENDER_EXTERNAL_URL || 'http://localhost:3000';
}

function getAllowedOrigins() {
    if (process.env.ALLOWED_ORIGINS) {
        return process.env.ALLOWED_ORIGINS
            .split(',')
            .map(origin => origin.trim())
            .filter(Boolean);
    }

    if (isProduction) {
        return [getPrimaryOrigin()];
    }

    return [
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        getPrimaryOrigin()
    ];
}

const corsOptions = {
    origin(origin, callback) {
        if (!origin || !isProduction) {
            return callback(null, true);
        }

        const allowedOrigins = getAllowedOrigins();
        return callback(null, allowedOrigins.includes(origin));
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: false
};

function securityHeaders(req, res, next) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    if (isProduction) {
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    res.removeHeader('X-Powered-By');
    next();
}

function sendPublicHtml(fileName) {
    return (req, res) => {
        res.sendFile(path.join(__dirname, fileName), {
            headers: {
                'Cache-Control': isProduction ? 'no-store' : 'no-cache'
            }
        });
    };
}

const publicHtmlFiles = new Set([
    'index.html',
    'login.html',
    'register.html',
    'verify-email.html',
    'reset-password.html'
]);

app.use(securityHeaders);
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

app.use('/css', express.static(path.join(__dirname, 'css'), {
    maxAge: isProduction ? '1d' : '0',
    etag: true,
    lastModified: true,
    index: false,
    setHeaders: (res, filePath) => {
        const ext = path.extname(filePath);
        if (ext === '.css') {
            res.setHeader('Content-Type', 'text/css; charset=utf-8');
        }
    }
}));

app.use('/js', express.static(path.join(__dirname, 'js'), {
    maxAge: isProduction ? '1d' : '0',
    etag: true,
    lastModified: true,
    index: false,
    setHeaders: (res, filePath) => {
        const ext = path.extname(filePath);
        if (ext === '.js') {
            res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
        }
    }
}));

app.get('/', sendPublicHtml('login.html'));
app.get('/login.html', sendPublicHtml('login.html'));
app.get('/register.html', sendPublicHtml('register.html'));
app.get('/verify-email.html', sendPublicHtml('verify-email.html'));
app.get('/reset-password.html', sendPublicHtml('reset-password.html'));
app.get('/index.html', sendPublicHtml('index.html'));
app.get('/favicon.ico', (req, res) => {
    res.status(204).end();
});

app.get('/api/test-supabase', (req, res) => {
    res.status(404).json({ error: 'Route introuvable' });
});

app.use('/api/auth', authRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/contracts', contractRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/assistant', assistantRoutes);

app.get('/api/health', (req, res) => {
    res.json({ status: 'OK' });
});

app.get('/api/config', (req, res) => {
    res.json({ ready: true });
});

app.use((req, res) => {
    if (req.path.startsWith('/api')) {
        return res.status(404).json({ error: 'Route introuvable' });
    }

    if (req.path.startsWith('/css') || req.path.startsWith('/js')) {
        return res.status(404).json({ error: 'Fichier introuvable' });
    }

    const ext = path.extname(req.path).toLowerCase();
    const staticExtensions = ['.css', '.js', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.woff', '.woff2', '.ttf', '.eot', '.json'];

    if (staticExtensions.includes(ext)) {
        return res.status(404).json({ error: 'Fichier introuvable' });
    }

    if (publicHtmlFiles.has(req.path.replace(/^\//, ''))) {
        return sendPublicHtml(req.path.replace(/^\//, ''))(req, res);
    }

    res.status(404).send('Not found');
});

app.use((err, req, res, next) => {
    const status = err.status || err.statusCode || 500;
    const safeStatus = status >= 400 && status < 600 ? status : 500;

    if (safeStatus >= 500) {
        console.error('Erreur serveur');
    }

    const publicMessage = err.expose && safeStatus < 500
        ? err.message
        : safeStatus === 404
            ? 'Ressource introuvable'
            : safeStatus >= 500
                ? 'Erreur interne du serveur'
                : 'Requête invalide';

    res.status(safeStatus).json({ error: publicMessage });
});

db.connect()
    .then(() => {
        const server = app.listen(PORT, '0.0.0.0', () => {
            console.log('Serveur démarré');
        });

        server.on('error', (error) => {
            if (error.code === 'EADDRINUSE') {
                console.error('Le port demandé est déjà utilisé.');
                process.exit(1);
            }

            console.error('Erreur serveur');
            process.exit(1);
        });
    })
    .catch((error) => {
        console.error('Erreur de connexion à la base de données.');
        if (!isProduction) {
            console.error(error.message);
        }
        process.exit(1);
    });

module.exports = app;
