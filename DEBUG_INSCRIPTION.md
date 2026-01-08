# 🔍 Guide de Débogage - Problème d'Inscription

## Problème signalé
- ✅ Message de succès affiché
- ❌ Aucun email reçu
- ❌ Utilisateur non visible dans Supabase Dashboard

## ✅ Vérifications à faire

### 1. Vérifier dans Supabase Dashboard

#### A. Vérifier si l'utilisateur est créé dans `auth.users`
1. Allez dans **Authentication** > **Users**
2. Recherchez l'email utilisé pour l'inscription
3. Si l'utilisateur existe :
   - ✅ L'inscription Supabase Auth fonctionne
   - ❌ Le problème est l'envoi d'email
4. Si l'utilisateur n'existe pas :
   - ❌ L'inscription échoue silencieusement
   - Vérifiez les logs du serveur

#### B. Vérifier la configuration Email
1. Allez dans **Authentication** > **Settings**
2. Vérifiez :
   - ✅ **"Enable email confirmations"** est coché
   - ✅ **"Secure email change"** est coché
3. Allez dans **Authentication** > **Email Templates**
4. Vérifiez que le template **"Confirmation Signup"** existe et est actif

#### C. Vérifier les URLs de redirection
1. Allez dans **Authentication** > **URL Configuration**
2. Vérifiez **Site URL** :
   - Local : `http://localhost:3000`
   - Production : `https://votre-app.onrender.com`
3. Vérifiez **Redirect URLs** contient :
   - `http://localhost:3000/verify-email.html` (local)
   - `https://votre-app.onrender.com/verify-email.html` (production)

#### D. Vérifier la table `entreprises`
1. Allez dans **Table Editor** > **entreprises**
2. Recherchez l'ID de l'utilisateur créé (depuis `auth.users`)
3. Si l'enregistrement existe :
   - ✅ L'insertion dans la table fonctionne
4. Si l'enregistrement n'existe pas :
   - ❌ Problème d'insertion dans la table
   - Vérifiez les logs du serveur

### 2. Vérifier les logs du serveur

Après une tentative d'inscription, vérifiez les logs pour :

```
📧 Tentative d'inscription avec Supabase Auth:
   Email: [email]
   URL de redirection: [url]
✅ Utilisateur Supabase Auth créé:
   ID: [uuid]
   Email: [email]
   Email confirmé: false
📝 Création de l'enregistrement dans la table entreprises...
✅ Entreprise créée dans la table: [id]
```

Si vous voyez des erreurs, notez-les.

### 3. Vérifier les variables d'environnement

Dans Render Dashboard ou votre `.env` :

```env
SUPABASE_URL=https://votre-projet.supabase.co
SUPABASE_SERVICE_ROLE_KEY=votre_service_role_key
SUPABASE_ANON_KEY=votre_anon_key
APP_URL=https://votre-app.onrender.com  # IMPORTANT pour les emails
```

### 4. Test manuel dans Supabase Dashboard

1. Allez dans **Authentication** > **Users**
2. Cliquez sur **"Add user"** (si l'utilisateur n'existe pas)
3. Créez un utilisateur manuellement
4. Vérifiez si l'email de confirmation est envoyé

### 5. Vérifier les emails dans Supabase

1. Allez dans **Logs** > **Auth Logs**
2. Recherchez les événements liés à votre email
3. Vérifiez s'il y a des erreurs d'envoi d'email

## 🔧 Solutions courantes

### Solution 1 : Activer les confirmations d'email
Si les confirmations d'email sont désactivées, Supabase n'enverra pas d'emails.

### Solution 2 : Configurer APP_URL
Si `APP_URL` n'est pas défini ou incorrect, les liens dans les emails seront invalides.

### Solution 3 : Vérifier les limites Supabase
Les comptes gratuits Supabase ont des limites d'envoi d'emails. Vérifiez votre quota.

### Solution 4 : Vérifier les spams
Les emails peuvent être dans le dossier spam. Vérifiez aussi les filtres anti-spam.

### Solution 5 : Utiliser SMTP personnalisé
Si Supabase SMTP ne fonctionne pas, configurez un SMTP personnalisé dans Supabase Dashboard.

## 📝 Checklist de débogage

- [ ] Utilisateur créé dans `auth.users` ?
- [ ] Enregistrement créé dans `entreprises` ?
- [ ] "Enable email confirmations" activé ?
- [ ] Site URL configuré correctement ?
- [ ] Redirect URLs contient `/verify-email.html` ?
- [ ] `APP_URL` défini dans les variables d'environnement ?
- [ ] Logs du serveur montrent des erreurs ?
- [ ] Email dans le dossier spam ?
- [ ] Quota Supabase non dépassé ?
