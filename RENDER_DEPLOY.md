# 🚀 Déploiement sur Render.com - Guide Complet

Render.com est une excellente alternative à Vercel, plus simple et plus fiable pour les applications Node.js/Express.

## 📋 Prérequis

- Un compte GitHub (gratuit)
- Un compte Render.com (gratuit) - [render.com](https://render.com)
- Un compte Supabase (gratuit) - [supabase.com](https://supabase.com)

---

## 🎯 Étapes de Déploiement

### 1. Préparer le code sur GitHub

Assurez-vous que tout votre code est sur GitHub :

```bash
git add .
git commit -m "Préparation pour déploiement Render"
git push origin main
```

### 2. Créer un compte Render

1. Allez sur [render.com](https://render.com)
2. Cliquez sur "Get Started for Free"
3. Connectez-vous avec votre compte GitHub

### 3. Créer un nouveau Web Service

1. Dans le dashboard Render, cliquez sur **"New +"** → **"Web Service"**
2. Connectez votre repository GitHub si ce n'est pas déjà fait
3. Sélectionnez le repository **OptimumAssurPro**

### 4. Configurer le Service

Remplissez les champs suivants :

- **Name** : `optimum-assur-pro` (ou votre choix)
- **Environment** : `Node`
- **Region** : Choisissez la région la plus proche (ex: Frankfurt pour l'Europe)
- **Branch** : `main`
- **Root Directory** : (laissez vide)
- **Build Command** : `npm install`
- **Start Command** : `npm start`
- **Plan** : `Free` (gratuit)

### 5. Configurer les Variables d'Environnement

Dans la section **"Environment Variables"**, ajoutez toutes ces variables :

```env
NODE_ENV=production
PORT=10000

# Supabase
SUPABASE_URL=https://votre-projet.supabase.co
SUPABASE_SERVICE_ROLE_KEY=votre_service_role_key_secrete
SUPABASE_ANON_KEY=votre_anon_key_publique

# JWT
JWT_SECRET=votre_secret_jwt_tres_securise_changez_moi
JWT_EXPIRES_IN=24h

# Email SMTP
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=votre-email@gmail.com
SMTP_PASSWORD=votre-mot-de-passe-app
SMTP_FROM_NAME=OptimumAssurPro

# URL de l'application (à mettre à jour après le déploiement)
APP_URL=https://optimum-assur-pro.onrender.com
```

⚠️ **IMPORTANT** : Remplacez toutes les valeurs par vos vraies valeurs !

### 6. Déployer

1. Cliquez sur **"Create Web Service"**
2. Render va automatiquement :
   - Cloner votre repository
   - Installer les dépendances (`npm install`)
   - Démarrer l'application (`npm start`)
3. Attendez 5-10 minutes pour le premier déploiement

### 7. Mettre à jour APP_URL

Une fois le déploiement terminé :

1. Render vous donnera une URL comme : `https://optimum-assur-pro.onrender.com`
2. Allez dans **Settings** → **Environment Variables**
3. Mettez à jour `APP_URL` avec votre URL Render complète :
   ```
   APP_URL=https://optimum-assur-pro.onrender.com
   ```
4. Cliquez sur **"Save Changes"**
5. Render redéploiera automatiquement

---

## ✅ Vérification

Une fois déployé, testez :

1. **Page d'accueil** : `https://votre-app.onrender.com/`
   - Doit afficher la page de connexion

2. **Page d'inscription** : `https://votre-app.onrender.com/register.html`
   - Doit afficher le formulaire d'inscription

3. **API Health** : `https://votre-app.onrender.com/api/health`
   - Doit retourner `{"status":"OK",...}`

4. **Créer un compte de test**
   - Vérifiez que vous recevez l'email de vérification

5. **Se connecter**
   - Vérifiez que la connexion fonctionne

---

## 🔧 Configuration SMTP pour Gmail

Si vous utilisez Gmail :

1. Activez la **validation en 2 étapes** sur votre compte Google
2. Générez un **"Mot de passe d'application"** :
   - Allez sur [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
   - Sélectionnez "Mail" et "Autre (nom personnalisé)"
   - Entrez "OptimumAssurPro"
   - Copiez le mot de passe généré
3. Utilisez ce mot de passe dans `SMTP_PASSWORD`

---

## 🌍 Ajouter un Nom de Domaine Personnalisé (Optionnel)

1. Dans Render → **Settings** → **Custom Domains**
2. Cliquez sur **"Add Custom Domain"**
3. Entrez votre domaine (ex: `app.votredomaine.com`)
4. Configurez les DNS selon les instructions Render :
   - Type : `CNAME`
   - Name : `app` (ou `@` pour le domaine racine)
   - Value : `votre-app.onrender.com`

---

## 📊 Avantages de Render

✅ **Gratuit** : Plan gratuit généreux (750 heures/mois)
✅ **Simple** : Configuration très facile
✅ **Fiable** : Moins de problèmes que Vercel pour Node.js
✅ **SSL Automatique** : HTTPS inclus
✅ **Déploiement Auto** : Redéploie automatiquement à chaque push GitHub
✅ **Logs en Temps Réel** : Voir les logs directement dans le dashboard

---

## 🐛 Dépannage

### L'application ne démarre pas

1. Vérifiez les **logs** dans Render → **Logs**
2. Vérifiez que toutes les variables d'environnement sont correctes
3. Vérifiez que `PORT` est bien défini (Render utilise le port défini dans `PORT`)

### Erreur "Cannot find module"

1. Vérifiez que `package.json` contient toutes les dépendances
2. Vérifiez les logs de build dans Render

### Erreur de connexion à la base de données

1. Vérifiez que `SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` sont corrects
2. Vérifiez que votre projet Supabase est actif

### Les emails ne sont pas envoyés

1. Vérifiez la configuration SMTP
2. Vérifiez que `APP_URL` est correcte
3. Vérifiez les logs pour voir les erreurs SMTP

---

## 🔄 Mises à Jour

À chaque fois que vous poussez du code sur GitHub :

1. Render détecte automatiquement les changements
2. Redéploie automatiquement l'application
3. Vous pouvez voir le statut dans le dashboard Render

---

## 📞 Support

- **Documentation Render** : [render.com/docs](https://render.com/docs)
- **Support Render** : Disponible dans le dashboard

---

**Bon déploiement ! 🚀**

