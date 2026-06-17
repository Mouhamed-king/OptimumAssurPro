# Configuration Supabase Auth - Guide Complet

## 📋 Table des matières
1. [Configuration Supabase Dashboard](#configuration-supabase-dashboard)
2. [Variables d'environnement](#variables-denvironnement)
3. [Configuration des emails](#configuration-des-emails)
4. [Configuration des redirections](#configuration-des-redirections)
5. [Test de la configuration](#test-de-la-configuration)

---

## 🔧 Configuration Supabase Dashboard

### 1. Activer la confirmation d'email

1. Connectez-vous à votre projet Supabase : https://app.supabase.com
2. Allez dans **Authentication** > **Settings**
3. Dans la section **Email Auth** :
   - ✅ Cochez **"Enable email confirmations"**
   - ✅ Cochez **"Secure email change"** (recommandé)
   - ✅ Cochez **"Double confirm email changes"** (recommandé)

### 2. Configurer les URLs de redirection

Dans **Authentication** > **URL Configuration** :

#### Site URL (URL principale)
```
http://localhost:3000          # Pour le développement local
https://votre-app.onrender.com # Pour la production (remplacez par votre URL Render)
```

#### Redirect URLs (URLs autorisées pour les redirections)
Ajoutez ces URLs (une par ligne) :

**Pour le développement local :**
```
http://localhost:3000/verify-email.html
http://localhost:3000/reset-password.html
http://localhost:3000
```

**Pour la production (Render) :**
```
https://votre-app.onrender.com/verify-email.html
https://votre-app.onrender.com/reset-password.html
https://votre-app.onrender.com
```

⚠️ **Important** : Remplacez `votre-app.onrender.com` par votre URL Render réelle.

### 3. Personnaliser les templates d'email (optionnel)

Dans **Authentication** > **Email Templates** :

#### Email de confirmation (Confirmation Signup)
**📋 Voir le fichier `EMAIL_TEMPLATES_SUPABASE.md` pour les templates complets et professionnels**

Les templates incluent :
- Design moderne avec gradient bleu/violet
- Boutons d'action clairs
- Avertissements de sécurité
- Footer professionnel
- Compatible mobile et desktop

#### Email de réinitialisation de mot de passe (Reset Password)
**📋 Voir le fichier `EMAIL_TEMPLATES_SUPABASE.md` pour les templates complets et professionnels**

Les templates incluent :
- Design cohérent avec l'application
- Instructions claires de sécurité
- Avertissements d'expiration
- Conseils pour choisir un mot de passe fort

---

## 🔐 Variables d'environnement

### Fichier `.env` (local) ou Variables d'environnement Render

Créez un fichier `.env` à la racine du projet (ou configurez dans Render Dashboard) :

```env
# ============================================
# CONFIGURATION SUPABASE (OBLIGATOIRE)
# ============================================
SUPABASE_URL=https://votre-projet-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=votre_service_role_key_secrete
SUPABASE_ANON_KEY=votre_anon_key_publique

# ============================================
# CONFIGURATION SERVEUR
# ============================================
PORT=3000
NODE_ENV=production
APP_URL=https://votre-app.onrender.com

# ============================================
# CONFIGURATION POSTGRESQL (Optionnel - pour migrations SQL)
# ============================================
DB_HOST=aws-1-eu-west-1.pooler.supabase.com
DB_USER=postgres.votre-projet-id
DB_PASSWORD=votre_mot_de_passe_supabase
DB_NAME=postgres
DB_PORT=6543
DB_SSL=true
DB_SSL_REJECT_UNAUTHORIZED=false
```

### Où trouver ces valeurs dans Supabase ?

1. **SUPABASE_URL** :
   - Dashboard Supabase > **Settings** > **API**
   - Copiez **"Project URL"**

2. **SUPABASE_SERVICE_ROLE_KEY** :
   - Dashboard Supabase > **Settings** > **API**
   - Copiez **"service_role" secret key** (⚠️ Gardez-la secrète !)

3. **SUPABASE_ANON_KEY** :
   - Dashboard Supabase > **Settings** > **API**
   - Copiez **"anon" public key**

4. **APP_URL** :
   - URL de votre application Render (ex: `https://gestionnaire-clientele.onrender.com`)

---

## 📧 Configuration des emails

### Emails automatiques avec Supabase

Supabase envoie automatiquement :
- ✅ **Email de confirmation** lors de l'inscription
- ✅ **Email de réinitialisation** lors de la demande de mot de passe oublié

### Limites et quotas

- **Plan gratuit** : 3 emails/jour
- **Plan Pro** : Emails illimités

### Personnalisation des emails

1. Allez dans **Authentication** > **Email Templates**
2. Sélectionnez le template à modifier :
   - **Confirmation Signup** : Email de confirmation d'inscription
   - **Magic Link** : Lien magique (si activé)
   - **Change Email Address** : Changement d'email
   - **Reset Password** : Réinitialisation de mot de passe
   - **Invite User** : Invitation utilisateur

3. Personnalisez le sujet et le corps avec HTML

---

## 🔄 Configuration des redirections

### Flux d'authentification

#### 1. Inscription (`/register.html`)
```
Utilisateur remplit le formulaire
    ↓
POST /api/auth/register
    ↓
Supabase Auth crée l'utilisateur
    ↓
Supabase envoie email de confirmation
    ↓
Redirection vers /login.html?message=email-sent
```

#### 2. Vérification d'email (`/verify-email.html`)
```
Utilisateur clique sur le lien dans l'email
    ↓
Redirection vers /verify-email.html#access_token=...
    ↓
Page vérifie le token avec Supabase Auth
    ↓
Email confirmé → Redirection vers /login.html
```

#### 3. Connexion (`/login.html`)
```
Utilisateur entre email/mot de passe
    ↓
POST /api/auth/login
    ↓
Vérification email_confirmed_at
    ↓
Si non confirmé → Erreur 403 avec option de renvoyer l'email
Si confirmé → Token retourné → Redirection vers /index.html
```

#### 4. Mot de passe oublié (`/reset-password.html`)
```
Utilisateur clique sur "Mot de passe oublié"
    ↓
POST /api/auth/forgot-password
    ↓
Supabase envoie email de réinitialisation
    ↓
Redirection vers /reset-password.html#access_token=...
    ↓
Utilisateur entre nouveau mot de passe
    ↓
POST /api/auth/reset-password
    ↓
Mot de passe mis à jour → Redirection vers /login.html
```

### URLs de redirection dans le code

Les URLs de redirection sont définies dans :

1. **`controllers/authController.js`** :
   ```javascript
   emailRedirectTo: `${process.env.APP_URL || 'http://localhost:3000'}/verify-email.html`
   ```

2. **`verify-email.html`** :
   - Lit automatiquement le hash `#access_token=...` depuis l'URL
   - Vérifie avec Supabase Auth

---

## ✅ Test de la configuration

### 1. Vérifier les variables d'environnement

```bash
# Vérifier que les variables sont chargées
node -e "require('dotenv').config(); console.log('SUPABASE_URL:', process.env.SUPABASE_URL ? '✅' : '❌');"
```

### 2. Tester l'inscription

1. Allez sur `/register.html`
2. Créez un compte
3. Vérifiez que vous recevez l'email de confirmation
4. Cliquez sur le lien dans l'email
5. Vérifiez que vous êtes redirigé vers `/verify-email.html`
6. Vérifiez que l'email est confirmé

### 3. Tester la connexion

1. Allez sur `/login.html`
2. Connectez-vous avec un compte **non confirmé**
3. Vérifiez que vous recevez l'erreur "Email non vérifié"
4. Confirmez l'email puis reconnectez-vous
5. Vérifiez que la connexion fonctionne

### 4. Tester le mot de passe oublié

1. Allez sur `/login.html`
2. Cliquez sur "Mot de passe oublié"
3. Entrez votre email
4. Vérifiez que vous recevez l'email de réinitialisation
5. Cliquez sur le lien dans l'email
6. Vérifiez que vous êtes redirigé vers `/reset-password.html`
7. Entrez un nouveau mot de passe
8. Vérifiez que le mot de passe est mis à jour

---

## 🚨 Dépannage

### Problème : Les emails ne sont pas envoyés

**Solutions :**
1. Vérifiez que "Enable email confirmations" est activé dans Supabase Dashboard
2. Vérifiez les logs Supabase Dashboard > **Logs** > **Auth Logs**
3. Vérifiez que vous n'avez pas dépassé la limite d'emails (3/jour en gratuit)
4. Vérifiez que l'email n'est pas dans les spams

### Problème : Erreur "Redirect URL not allowed"

**Solutions :**
1. Vérifiez que l'URL est dans la liste **Redirect URLs** de Supabase Dashboard
2. Vérifiez que `APP_URL` dans `.env` correspond à votre URL Render
3. Les URLs doivent correspondre exactement (http vs https, avec/sans trailing slash)

### Problème : Erreur "Email not confirmed" même après confirmation

**Solutions :**
1. Vérifiez que `email_confirmed_at` n'est pas null dans Supabase Dashboard > **Authentication** > **Users**
2. Vérifiez que le middleware vérifie correctement `email_confirmed_at`
3. Déconnectez-vous et reconnectez-vous après confirmation

### Problème : Le token Supabase n'est pas valide

**Solutions :**
1. Vérifiez que `SUPABASE_SERVICE_ROLE_KEY` est correct dans `.env`
2. Vérifiez que `SUPABASE_ANON_KEY` est exposé via `/api/config`
3. Vérifiez les logs du serveur pour les erreurs d'authentification

---

## 📝 Checklist de configuration

Avant de déployer sur Render, vérifiez :

- [ ] ✅ Supabase Dashboard : "Enable email confirmations" activé
- [ ] ✅ Supabase Dashboard : Site URL configuré (production)
- [ ] ✅ Supabase Dashboard : Redirect URLs configurées
- [ ] ✅ Variables d'environnement Render configurées :
  - [ ] `SUPABASE_URL`
  - [ ] `SUPABASE_SERVICE_ROLE_KEY`
  - [ ] `SUPABASE_ANON_KEY`
  - [ ] `APP_URL` (URL Render)
  - [ ] `NODE_ENV=production`
  - [ ] `PORT=10000` (ou le port défini dans render.yaml)
- [ ] ✅ Test d'inscription fonctionne
- [ ] ✅ Test de vérification d'email fonctionne
- [ ] ✅ Test de connexion fonctionne
- [ ] ✅ Test de mot de passe oublié fonctionne

---

## 🔗 Liens utiles

- **Documentation Supabase Auth** : https://supabase.com/docs/guides/auth
- **Configuration Email** : https://supabase.com/docs/guides/auth/auth-email
- **Templates Email** : https://supabase.com/docs/guides/auth/auth-email-templates
- **Dashboard Supabase** : https://app.supabase.com

---

## 💡 Notes importantes

1. **SUPABASE_SERVICE_ROLE_KEY** : ⚠️ **NE JAMAIS** exposer cette clé côté frontend. Elle bypass toutes les règles RLS.

2. **SUPABASE_ANON_KEY** : Peut être exposée publiquement (sécurisée avec RLS). Elle est exposée via `/api/config` pour `verify-email.html`.

3. **Limite d'emails** : Le plan gratuit de Supabase limite à 3 emails/jour. Pour la production, considérez un plan payant.

4. **URLs de redirection** : Doivent correspondre exactement (protocole, domaine, chemin). `http://localhost:3000` ≠ `http://localhost:3000/`

5. **Environnement** : Utilisez `NODE_ENV=production` sur Render pour activer les optimisations.
