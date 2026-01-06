// ============================================
// SCRIPT DE TEST DE CONFIGURATION SMTP
// ============================================

require('dotenv').config();
const nodemailer = require('nodemailer');

console.log('🔍 Test de configuration SMTP\n');
console.log('Configuration actuelle:');
console.log('  SMTP_HOST:', process.env.SMTP_HOST || 'NON DÉFINI (défaut: smtp.gmail.com)');
console.log('  SMTP_PORT:', process.env.SMTP_PORT || 'NON DÉFINI (défaut: 587)');
console.log('  SMTP_SECURE:', process.env.SMTP_SECURE || 'NON DÉFINI (défaut: false)');
console.log('  SMTP_USER:', process.env.SMTP_USER ? `${process.env.SMTP_USER.substring(0, 3)}***` : 'NON DÉFINI');
console.log('  SMTP_PASSWORD:', process.env.SMTP_PASSWORD ? '***CONFIGURÉ***' : 'NON DÉFINI');
console.log('  APP_URL:', process.env.APP_URL || 'NON DÉFINI (défaut: http://localhost:3000)');
console.log('');

// Vérifier que les variables essentielles sont définies
if (!process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
    console.error('❌ ERREUR: SMTP_USER et SMTP_PASSWORD doivent être configurés dans votre fichier .env');
    console.error('');
    console.error('Exemple de configuration pour Gmail:');
    console.error('  SMTP_HOST=smtp.gmail.com');
    console.error('  SMTP_PORT=587');
    console.error('  SMTP_SECURE=false');
    console.error('  SMTP_USER=votre-email@gmail.com');
    console.error('  SMTP_PASSWORD=votre-mot-de-passe-app');
    console.error('');
    console.error('⚠️  IMPORTANT pour Gmail:');
    console.error('   1. Activez la "Validation en 2 étapes" sur votre compte Google');
    console.error('   2. Générez un "Mot de passe d\'application" dans les paramètres de sécurité');
    console.error('   3. Utilisez ce mot de passe d\'application (pas votre mot de passe habituel)');
    process.exit(1);
}

// Créer le transporteur
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD
    }
});

// Test de connexion
async function testSMTP() {
    try {
        console.log('🔍 Test de connexion SMTP...');
        await transporter.verify();
        console.log('✅ Connexion SMTP réussie!\n');
        
        // Demander l'email de test
        const readline = require('readline');
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        
        rl.question('📧 Entrez votre adresse email pour recevoir un email de test (ou appuyez sur Entrée pour annuler): ', async (testEmail) => {
            rl.close();
            
            if (!testEmail || testEmail.trim() === '') {
                console.log('Test annulé.');
                process.exit(0);
            }
            
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(testEmail)) {
                console.error('❌ Adresse email invalide');
                process.exit(1);
            }
            
            try {
                console.log(`📤 Envoi d'un email de test à ${testEmail}...`);
                const info = await transporter.sendMail({
                    from: `"${process.env.SMTP_FROM_NAME || 'OptimumAssurPro'}" <${process.env.SMTP_USER}>`,
                    to: testEmail,
                    subject: 'Test SMTP - OptimumAssurPro',
                    html: `
                        <h2>Test de configuration SMTP</h2>
                        <p>Félicitations ! Votre configuration SMTP fonctionne correctement.</p>
                        <p>Si vous recevez cet email, cela signifie que votre configuration est correcte.</p>
                        <hr>
                        <p><small>Envoyé depuis OptimumAssurPro</small></p>
                    `,
                    text: 'Test de configuration SMTP - Si vous recevez cet email, votre configuration SMTP fonctionne correctement.'
                });
                
                console.log('✅ Email de test envoyé avec succès!');
                console.log('   Message ID:', info.messageId);
                console.log('   Response:', info.response);
                console.log('');
                console.log('📬 Vérifiez votre boîte de réception (et le dossier spam si nécessaire)');
                process.exit(0);
            } catch (sendError) {
                console.error('❌ Erreur lors de l\'envoi de l\'email de test:');
                console.error('   Code:', sendError.code);
                console.error('   Message:', sendError.message);
                if (sendError.response) {
                    console.error('   Response:', sendError.response);
                }
                if (sendError.command) {
                    console.error('   Command:', sendError.command);
                }
                process.exit(1);
            }
        });
        
    } catch (error) {
        console.error('❌ Erreur de connexion SMTP:');
        console.error('   Code:', error.code);
        console.error('   Message:', error.message);
        if (error.response) {
            console.error('   Response:', error.response);
        }
        if (error.command) {
            console.error('   Command:', error.command);
        }
        console.error('');
        console.error('💡 Solutions possibles:');
        console.error('   1. Vérifiez que SMTP_HOST et SMTP_PORT sont corrects');
        console.error('   2. Pour Gmail, utilisez un "Mot de passe d\'application" (pas votre mot de passe habituel)');
        console.error('   3. Vérifiez que la "Validation en 2 étapes" est activée sur votre compte Google');
        console.error('   4. Vérifiez votre connexion internet');
        console.error('   5. Si vous utilisez un autre fournisseur, vérifiez leurs paramètres SMTP');
        process.exit(1);
    }
}

testSMTP();

