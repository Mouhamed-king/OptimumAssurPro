// ============================================
// SERVICE D'ENVOI D'EMAILS
// ============================================

const nodemailer = require('nodemailer');
require('dotenv').config();

// Configuration du transporteur email avec timeout augmenté
const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
const smtpPort = parseInt(process.env.SMTP_PORT || '587');
const isSendGrid = smtpHost.includes('sendgrid');

const transporterConfig = {
    host: smtpHost,
    port: smtpPort,
    secure: process.env.SMTP_SECURE === 'true', // true pour 465, false pour autres ports
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD
    },
    // Augmenter les timeouts pour éviter les erreurs de connexion
    connectionTimeout: 60000, // 60 secondes
    greetingTimeout: 30000, // 30 secondes
    socketTimeout: 60000, // 60 secondes
    // Options supplémentaires pour améliorer la connexion
    tls: {
        rejectUnauthorized: false // Accepter les certificats auto-signés si nécessaire
    }
};

// Pour SendGrid, désactiver le pool de connexions si timeout
if (isSendGrid) {
    transporterConfig.pool = false; // Pas de pool pour SendGrid
    transporterConfig.requireTLS = true; // Require TLS pour SendGrid
}

const transporter = nodemailer.createTransport(transporterConfig);

// Vérifier la configuration email au démarrage
console.log('📧 Configuration SMTP:');
console.log('   Host:', smtpHost, isSendGrid ? '(SendGrid)' : '(Gmail par défaut)');
console.log('   Port:', smtpPort);
console.log('   Secure:', process.env.SMTP_SECURE === 'true' ? 'true' : 'false');
if (isSendGrid) {
    console.log('   User:', process.env.SMTP_USER || 'apikey (requis pour SendGrid)');
    console.log('   Password:', process.env.SMTP_PASSWORD ? '***CONFIGURÉ***' : 'NON CONFIGURÉ (clé API SendGrid requise)');
} else {
    console.log('   User:', process.env.SMTP_USER ? `${process.env.SMTP_USER.substring(0, 3)}***` : 'NON CONFIGURÉ');
    console.log('   Password:', process.env.SMTP_PASSWORD ? '***CONFIGURÉ***' : 'NON CONFIGURÉ');
}

if (!process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
    console.warn('⚠️  Configuration SMTP manquante. Les emails ne pourront pas être envoyés.');
    console.warn('   Veuillez configurer SMTP_USER et SMTP_PASSWORD dans votre fichier .env');
}

// Envoyer un email de vérification
async function sendVerificationEmail(email, verificationToken, nom) {
    try {
        const verificationUrl = `${process.env.APP_URL || (process.env.NODE_ENV === 'production' ? 'https://optimumassurpro.onrender.com' : 'http://localhost:3000')}/verify-email.html?token=${verificationToken}`;
        
        const mailOptions = {
            from: `"${process.env.SMTP_FROM_NAME || 'OptimumAssurPro'}" <${process.env.SMTP_USER}>`,
            to: email,
            subject: 'Vérification de votre adresse email - OptimumAssurPro',
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <style>
                        body {
                            font-family: Arial, sans-serif;
                            line-height: 1.6;
                            color: #333;
                            max-width: 600px;
                            margin: 0 auto;
                            padding: 20px;
                        }
                        .header {
                            background: linear-gradient(135deg, #1E3A8A 0%, #2563EB 100%);
                            color: white;
                            padding: 30px;
                            text-align: center;
                            border-radius: 10px 10px 0 0;
                        }
                        .content {
                            background: #f9f9f9;
                            padding: 30px;
                            border-radius: 0 0 10px 10px;
                        }
                        .button {
                            display: inline-block;
                            background: #2563EB;
                            color: #FFFFFF !important;
                            padding: 14px 32px;
                            text-decoration: none;
                            border-radius: 8px;
                            margin: 20px 0;
                            font-weight: 600;
                            font-size: 16px;
                            box-shadow: 0 4px 6px rgba(37, 99, 235, 0.3);
                            transition: all 0.3s ease;
                        }
                        .button:hover {
                            background: #1D4ED8;
                            box-shadow: 0 6px 12px rgba(37, 99, 235, 0.4);
                            transform: translateY(-2px);
                        }
                        .footer {
                            margin-top: 20px;
                            padding-top: 20px;
                            border-top: 1px solid #ddd;
                            font-size: 12px;
                            color: #666;
                            text-align: center;
                        }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <h1>OptimumAssurPro</h1>
                        <p>Vérification de votre adresse email</p>
                    </div>
                    <div class="content">
                        <p>Bonjour ${nom},</p>
                        <p>Merci de vous être inscrit sur OptimumAssurPro !</p>
                        <p>Pour activer votre compte, veuillez cliquer sur le bouton ci-dessous pour vérifier votre adresse email :</p>
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${verificationUrl}" class="button" style="color: #FFFFFF !important; text-decoration: none;">Vérifier mon email</a>
                        </div>
                        <p>Ou copiez et collez ce lien dans votre navigateur :</p>
                        <p style="word-break: break-all; color: #2563EB;">${verificationUrl}</p>
                        <p><strong>Ce lien expirera dans 24 heures.</strong></p>
                        <p>Si vous n'avez pas créé de compte sur OptimumAssurPro, vous pouvez ignorer cet email.</p>
                    </div>
                    <div class="footer">
                        <p>&copy; 2026 OptimumAssurPro - Tous droits réservés</p>
                        <p>Cet email a été envoyé automatiquement, merci de ne pas y répondre.</p>
                    </div>
                </body>
                </html>
            `,
            text: `
                Bonjour ${nom},
                
                Merci de vous être inscrit sur OptimumAssurPro !
                
                Pour activer votre compte, veuillez cliquer sur le lien suivant :
                ${verificationUrl}
                
                Ce lien expirera dans 24 heures.
                
                Si vous n'avez pas créé de compte sur OptimumAssurPro, vous pouvez ignorer cet email.
                
                Cordialement,
                L'équipe OptimumAssurPro
            `
        };
        
        if (!process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
            console.log('⚠️  Configuration SMTP manquante !');
            console.log('📧 Email de vérification (simulé):');
            console.log(`   À: ${email}`);
            console.log(`   Lien: ${verificationUrl}`);
            console.log('');
            console.log('Pour activer l\'envoi d\'emails, configurez dans votre fichier .env:');
            console.log('  SMTP_HOST=smtp.gmail.com');
            console.log('  SMTP_PORT=587');
            console.log('  SMTP_SECURE=false');
            console.log('  SMTP_USER=votre-email@gmail.com');
            console.log('  SMTP_PASSWORD=votre-mot-de-passe-app');
            console.log('  APP_URL=http://localhost:3000');
            throw new Error('Configuration SMTP manquante. Veuillez configurer SMTP_USER et SMTP_PASSWORD dans .env');
        }
        
        // Vérifier la connexion SMTP avant d'envoyer (optionnel, ne bloque pas l'envoi)
        console.log('🔍 Vérification de la connexion SMTP...');
        try {
            await transporter.verify();
            console.log('✅ Connexion SMTP vérifiée avec succès');
        } catch (verifyError) {
            console.warn('⚠️  Vérification SMTP échouée, mais tentative d\'envoi quand même...');
            console.warn('   Code:', verifyError.code);
            console.warn('   Message:', verifyError.message);
            // Ne pas bloquer l'envoi, certains serveurs SMTP ne supportent pas verify() mais peuvent envoyer
        }
        
        console.log('📤 Envoi de l\'email de vérification...');
        console.log('   À:', email);
        console.log('   Depuis:', process.env.SMTP_USER);
        console.log('   URL:', verificationUrl);
        const info = await transporter.sendMail(mailOptions);
        console.log('✅ Email de vérification envoyé à:', email);
        console.log('   Message ID:', info.messageId);
        console.log('   Response:', info.response);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('❌ Erreur lors de l\'envoi de l\'email:');
        console.error('   Code:', error.code);
        console.error('   Message:', error.message);
        console.error('   Stack:', error.stack);
        if (error.response) {
            console.error('   Response:', error.response);
        }
        if (error.command) {
            console.error('   Command:', error.command);
        }
        
        // Créer une erreur personnalisée avec plus d'informations
        const customError = new Error();
        customError.code = error.code;
        customError.message = error.message;
        customError.isSmtpError = true;
        
        if (error.code === 'EAUTH') {
            customError.message = 'Erreur d\'authentification SMTP. Vérifiez SMTP_USER et SMTP_PASSWORD. Assurez-vous d\'utiliser un mot de passe d\'application Gmail.';
            customError.suggestion = 'Générez un nouveau mot de passe d\'application Gmail dans les paramètres de sécurité de votre compte.';
        } else if (error.code === 'ECONNECTION' || error.code === 'ECONNREFUSED') {
            customError.message = 'Impossible de se connecter au serveur SMTP. Gmail bloque les connexions depuis Render. Utilisez un service SMTP alternatif (SendGrid, Mailgun) ou le port 465 avec SMTP_SECURE=true.';
            customError.suggestion = 'Utilisez SendGrid (gratuit jusqu\'à 100 emails/jour) ou Mailgun (gratuit jusqu\'à 5000 emails/mois).';
            customError.shouldReturnLink = true;
        } else if (error.code === 'ETIMEDOUT' || error.code === 'ESOCKETTIMEDOUT' || error.message.includes('Timeout') || error.message.includes('Connection timeout')) {
            customError.message = 'Timeout de connexion SMTP. Gmail bloque les connexions depuis Render. Solutions: 1) Utilisez le port 465 avec SMTP_SECURE=true, 2) Utilisez un service SMTP alternatif (SendGrid, Mailgun), 3) Le lien de vérification sera affiché dans la réponse.';
            customError.suggestion = 'Gmail bloque souvent les connexions depuis les hébergeurs cloud. Utilisez SendGrid (gratuit) ou Mailgun (gratuit) à la place.';
            customError.shouldReturnLink = true;
        } else {
            customError.message = 'Erreur lors de l\'envoi de l\'email: ' + (error.message || error.toString());
            customError.shouldReturnLink = true; // Par sécurité, retourner le lien même en cas d'erreur inconnue
        }
        
        throw customError;
    }
}

// Envoyer un email de réinitialisation de mot de passe
async function sendPasswordResetEmail(email, resetToken, nom) {
    try {
        const resetUrl = `${process.env.APP_URL || (process.env.NODE_ENV === 'production' ? 'https://optimumassurpro.onrender.com' : 'http://localhost:3000')}/reset-password.html?token=${resetToken}`;
        
        const mailOptions = {
            from: `"${process.env.SMTP_FROM_NAME || 'OptimumAssurPro'}" <${process.env.SMTP_USER}>`,
            to: email,
            subject: 'Réinitialisation de votre mot de passe - OptimumAssurPro',
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <style>
                        body {
                            font-family: Arial, sans-serif;
                            line-height: 1.6;
                            color: #333;
                            max-width: 600px;
                            margin: 0 auto;
                            padding: 20px;
                        }
                        .header {
                            background: linear-gradient(135deg, #1E3A8A 0%, #2563EB 100%);
                            color: white;
                            padding: 30px;
                            text-align: center;
                            border-radius: 10px 10px 0 0;
                        }
                        .content {
                            background: #f9f9f9;
                            padding: 30px;
                            border-radius: 0 0 10px 10px;
                        }
                        .button {
                            display: inline-block;
                            background: #2563EB;
                            color: #FFFFFF !important;
                            padding: 14px 32px;
                            text-decoration: none;
                            border-radius: 8px;
                            margin: 20px 0;
                            font-weight: 600;
                            font-size: 16px;
                            box-shadow: 0 4px 6px rgba(37, 99, 235, 0.3);
                            transition: all 0.3s ease;
                        }
                        .button:hover {
                            background: #1D4ED8;
                            box-shadow: 0 6px 12px rgba(37, 99, 235, 0.4);
                            transform: translateY(-2px);
                        }
                        .footer {
                            margin-top: 20px;
                            padding-top: 20px;
                            border-top: 1px solid #ddd;
                            font-size: 12px;
                            color: #666;
                            text-align: center;
                        }
                        .warning {
                            background: #FEF3C7;
                            border-left: 4px solid #F59E0B;
                            padding: 15px;
                            margin: 20px 0;
                            border-radius: 5px;
                        }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <h1>OptimumAssurPro</h1>
                        <p>Réinitialisation de mot de passe</p>
                    </div>
                    <div class="content">
                        <p>Bonjour ${nom},</p>
                        <p>Vous avez demandé à réinitialiser votre mot de passe pour votre compte OptimumAssurPro.</p>
                        <p>Cliquez sur le bouton ci-dessous pour créer un nouveau mot de passe :</p>
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${resetUrl}" class="button" style="color: #FFFFFF !important; text-decoration: none;">Réinitialiser mon mot de passe</a>
                        </div>
                        <p>Ou copiez et collez ce lien dans votre navigateur :</p>
                        <p style="word-break: break-all; color: #2563EB;">${resetUrl}</p>
                        <div class="warning">
                            <strong>⚠️ Important :</strong> Ce lien expirera dans 1 heure. Si vous n'avez pas demandé cette réinitialisation, ignorez cet email.
                        </div>
                    </div>
                    <div class="footer">
                        <p>&copy; 2026 OptimumAssurPro - Tous droits réservés</p>
                        <p>Cet email a été envoyé automatiquement, merci de ne pas y répondre.</p>
                    </div>
                </body>
                </html>
            `,
            text: `
                Bonjour ${nom},
                
                Vous avez demandé à réinitialiser votre mot de passe pour votre compte OptimumAssurPro.
                
                Cliquez sur le lien suivant pour créer un nouveau mot de passe :
                ${resetUrl}
                
                Ce lien expirera dans 1 heure.
                
                Si vous n'avez pas demandé cette réinitialisation, ignorez cet email.
                
                Cordialement,
                L'équipe OptimumAssurPro
            `
        };
        
        if (!process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
            console.log('⚠️  Configuration SMTP manquante !');
            console.log('📧 Email de réinitialisation (simulé):');
            console.log(`   À: ${email}`);
            console.log(`   Lien: ${resetUrl}`);
            console.log('');
            console.log('Pour activer l\'envoi d\'emails, configurez dans votre fichier .env:');
            console.log('  SMTP_HOST=smtp.gmail.com');
            console.log('  SMTP_PORT=587');
            console.log('  SMTP_SECURE=false');
            console.log('  SMTP_USER=votre-email@gmail.com');
            console.log('  SMTP_PASSWORD=votre-mot-de-passe-app');
            console.log('  APP_URL=http://localhost:3000');
            throw new Error('Configuration SMTP manquante. Veuillez configurer SMTP_USER et SMTP_PASSWORD dans .env');
        }
        
        // Vérifier la connexion SMTP avant d'envoyer (optionnel, peut échouer sur certains serveurs)
        console.log('🔍 Vérification de la connexion SMTP...');
        try {
            await transporter.verify();
            console.log('✅ Connexion SMTP vérifiée avec succès');
        } catch (verifyError) {
            console.warn('⚠️  Vérification SMTP échouée, mais tentative d\'envoi quand même...');
            console.warn('   Code:', verifyError.code);
            console.warn('   Message:', verifyError.message);
            // Ne pas bloquer l'envoi, certains serveurs SMTP ne supportent pas verify()
        }
        
        console.log('📤 Envoi de l\'email de réinitialisation...');
        console.log('   À:', email);
        console.log('   Depuis:', process.env.SMTP_USER);
        console.log('   Host:', process.env.SMTP_HOST || 'smtp.gmail.com');
        console.log('   Port:', process.env.SMTP_PORT || '587');
        
        // Envoyer avec timeout personnalisé
        const sendPromise = transporter.sendMail(mailOptions);
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Timeout lors de l\'envoi de l\'email (délai dépassé)')), 60000);
        });
        
        try {
            const info = await Promise.race([sendPromise, timeoutPromise]);
            console.log('✅ Email de réinitialisation envoyé à:', email);
            console.log('   Message ID:', info.messageId);
            console.log('   Response:', info.response);
            return { success: true, messageId: info.messageId };
        } catch (sendError) {
            console.error('❌ Erreur détaillée lors de l\'envoi de l\'email:');
            console.error('   Code:', sendError.code);
            console.error('   Message:', sendError.message);
            console.error('   Command:', sendError.command);
            if (sendError.response) {
                console.error('   Response:', sendError.response);
            }
            if (sendError.responseCode) {
                console.error('   Response Code:', sendError.responseCode);
            }
            
            if (sendError.code === 'ECONNREFUSED') {
                throw new Error('Impossible de se connecter au serveur SMTP. Gmail peut bloquer les connexions depuis Render. Essayez d\'utiliser le port 465 avec SMTP_SECURE=true, ou utilisez un service SMTP alternatif.');
            } else if (sendError.code === 'ETIMEDOUT' || sendError.code === 'ESOCKETTIMEDOUT' || sendError.message.includes('Timeout')) {
                throw new Error('Timeout de connexion SMTP. Gmail bloque souvent les connexions depuis Render. Solutions: 1) Port 465 avec SMTP_SECURE=true, 2) Service SMTP alternatif (SendGrid, Mailgun), 3) Vérifiez votre mot de passe d\'application Gmail.');
            } else if (sendError.code === 'EAUTH') {
                throw new Error('Erreur d\'authentification SMTP. Vérifiez SMTP_USER et SMTP_PASSWORD. Utilisez un mot de passe d\'application Gmail.');
            } else {
                throw new Error(`Impossible d'envoyer l'email: ${sendError.message}. Vérifiez votre configuration SMTP sur Render.`);
            }
        }
    } catch (error) {
        console.error('❌ Erreur lors de l\'envoi de l\'email de réinitialisation:');
        console.error('   Code:', error.code);
        console.error('   Message:', error.message);
        console.error('   Stack:', error.stack);
        if (error.response) {
            console.error('   Response:', error.response);
        }
        if (error.command) {
            console.error('   Command:', error.command);
        }
        
        if (error.code === 'EAUTH') {
            throw new Error('Erreur d\'authentification SMTP. Vérifiez SMTP_USER et SMTP_PASSWORD dans .env. Pour Gmail, utilisez un "Mot de passe d\'application" et non votre mot de passe habituel.');
        } else if (error.code === 'ECONNECTION') {
            throw new Error('Impossible de se connecter au serveur SMTP. Vérifiez SMTP_HOST et SMTP_PORT dans .env');
        } else if (error.code === 'ETIMEDOUT') {
            throw new Error('Timeout de connexion SMTP. Vérifiez votre connexion internet et les paramètres SMTP_HOST/SMTP_PORT');
        }
        throw new Error('Impossible d\'envoyer l\'email de réinitialisation: ' + error.message);
    }
}

module.exports = {
    sendVerificationEmail,
    sendPasswordResetEmail
};

