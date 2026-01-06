# 🚀 Guide de Déploiement - OptimumAssurPro

Ce guide vous explique comment déployer OptimumAssurPro sur différents hébergeurs gratuits.

## 📋 Prérequis

- Un compte GitHub (gratuit)
- Un compte Supabase (gratuit) - [supabase.com](https://supabase.com)
- Un compte sur l'un des hébergeurs ci-dessous

---

## 🌐 Option 1 : Render.com (Recommandé - Gratuit)

Render offre un plan gratuit avec :
- ✅ 750 heures gratuites par mois
- ✅ SSL automatique
- ✅ Déploiement automatique depuis GitHub
- ✅ Support des noms de domaine personnalisés

### Étapes de déploiement :

1. **Préparer le projet**
   ```bash
   # Assurez-vous que votre code est sur GitHub
   git add .
   git commit -m "Préparation pour déploiement"
   git push origin main
   ```

2. **Créer un compte Render**
   - Allez sur [render.com](https://render.com)
   - Créez un compte gratuit avec GitHub

3. **Créer un nouveau Web Service**
   - Cliquez sur "New +" → "Web Service"
   - Connectez votre repository GitHub
   - Sélectionnez le repository OptimumAssurPro

4. **Configurer le service**
   - **Name** : `optimum-assur-pro` (ou votre choix)
   - **Environment** : `Node`
   - **Build Command** : `npm install`
   - **Start Command** : `npm start`
   - **Plan** : `Free`

5. **Configurer les variables d'environnement**
   Dans la section "Environment Variables", ajoutez :
   ```
   NODE_ENV=production
   PORT=10000
   SUPABASE_URL=votre-url-supabase
   SUPABASE_SERVICE_ROLE_KEY=votre-service-role-key
   SUPABASE_ANON_KEY=votre-anon-key
   JWT_SECRET=votre-secret-jwt-tres-securise
   JWT_EXPIRES_IN=24h
   APP_URL=https://votre-app.onrender.com
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_USER=votre-email@gmail.com
   SMTP_PASSWORD=votre-mot-de-passe-app
   SMTP_FROM_NAME=OptimumAssurPro
   ```

6. **Déployer**
   - Cliquez sur "Create Web Service"
   - Attendez le déploiement (5-10 minutes)
   - Votre application sera disponible sur `https://votre-app.onrender.com`

### Ajouter un nom de domaine personnalisé (optionnel)

1. Dans les paramètres de votre service Render
2. Allez dans "Custom Domains"
3. Ajoutez votre domaine
4. Suivez les instructions DNS

---

## 🚂 Option 2 : Railway.app (Gratuit avec crédits)

Railway offre :
- ✅ $5 de crédits gratuits par mois
- ✅ Déploiement automatique
- ✅ SSL automatique
- ✅ Support des noms de domaine personnalisés

### Étapes de déploiement :

1. **Créer un compte Railway**
   - Allez sur [railway.app](https://railway.app)
   - Créez un compte avec GitHub

2. **Créer un nouveau projet**
   - Cliquez sur "New Project"
   - Sélectionnez "Deploy from GitHub repo"
   - Choisissez votre repository

3. **Configurer les variables d'environnement**
   - Cliquez sur votre service
   - Allez dans "Variables"
   - Ajoutez toutes les variables d'environnement (voir Option 1)

4. **Déployer**
   - Railway détecte automatiquement Node.js
   - Le déploiement démarre automatiquement
   - Votre app sera disponible sur `https://votre-app.up.railway.app`

---

## ▲ Option 3 : Vercel (Gratuit) ⭐ Recommandé

Vercel est excellent pour les applications Node.js :
- ✅ Plan gratuit généreux
- ✅ Déploiement ultra-rapide
- ✅ SSL automatique
- ✅ Support des noms de domaine personnalisés
- ✅ Déploiement automatique depuis GitHub

📖 **Consultez le guide détaillé** : [VERCEL_DEPLOY.md](./VERCEL_DEPLOY.md)

### Déploiement rapide :

1. **Poussez votre code sur GitHub**
2. **Créez un compte sur [vercel.com](https://vercel.com)**
3. **Importez votre repository GitHub**
4. **Configurez les variables d'environnement** (voir VERCEL_DEPLOY.md)
5. **Déployez !**

---

## 🔧 Configuration Post-Déploiement

### 1. Mettre à jour APP_URL

Après le déploiement, mettez à jour la variable `APP_URL` avec l'URL réelle de votre application :
```
APP_URL=https://votre-app.onrender.com
```

### 2. Exécuter les migrations

Les migrations s'exécutent automatiquement grâce au script `postinstall` dans `package.json`.

Si vous devez les exécuter manuellement :
```bash
npm run migrate
```

### 3. Configurer SMTP pour les emails

Pour Gmail :
1. Activez la validation en 2 étapes
2. Générez un "Mot de passe d'application"
3. Utilisez ce mot de passe dans `SMTP_PASSWORD`

### 4. Tester l'application

1. Visitez votre URL de déploiement
2. Créez un compte de test
3. Vérifiez que vous recevez l'email de vérification
4. Testez la connexion

---

## 🌍 Ajouter un nom de domaine personnalisé

### Sur Render :

1. Achetez un domaine (ex: Namecheap, GoDaddy, etc.)
2. Dans Render → Settings → Custom Domains
3. Ajoutez votre domaine
4. Configurez les DNS :
   - Type : `CNAME`
   - Name : `@` ou `www`
   - Value : `votre-app.onrender.com`

### Sur Railway :

1. Dans votre service → Settings → Domains
2. Ajoutez votre domaine
3. Suivez les instructions DNS fournies

### Sur Vercel :

1. Dans votre projet → Settings → Domains
2. Ajoutez votre domaine
3. Configurez les DNS selon les instructions

---

## 🔒 Sécurité en Production

### Variables d'environnement sensibles

⚠️ **NE JAMAIS** commiter les fichiers `.env` dans Git !

Les variables sensibles doivent être configurées dans le dashboard de l'hébergeur :
- `JWT_SECRET` : Utilisez un secret fort et unique
- `SUPABASE_SERVICE_ROLE_KEY` : Gardez-le secret
- `SMTP_PASSWORD` : Mot de passe d'application uniquement

### Recommandations

1. ✅ Utilisez des mots de passe forts pour JWT_SECRET
2. ✅ Activez HTTPS uniquement (SSL automatique)
3. ✅ Limitez les accès CORS si nécessaire
4. ✅ Surveillez les logs pour détecter les erreurs
5. ✅ Faites des sauvegardes régulières de votre base de données

---

## 📊 Monitoring et Logs

### Render
- Logs disponibles dans le dashboard
- Monitoring basique inclus

### Railway
- Logs en temps réel dans le dashboard
- Métriques de performance

### Vercel
- Logs dans le dashboard
- Analytics disponibles

---

## 🆘 Dépannage

### L'application ne démarre pas

1. Vérifiez les logs dans le dashboard
2. Vérifiez que toutes les variables d'environnement sont configurées
3. Vérifiez que `PORT` est correctement configuré

### Les emails ne sont pas envoyés

1. Vérifiez la configuration SMTP
2. Testez avec `npm run test-smtp` en local
3. Vérifiez que `APP_URL` est correct

### Erreurs de base de données

1. Vérifiez que Supabase est accessible
2. Vérifiez les credentials Supabase
3. Vérifiez que les migrations ont été exécutées

---

## 📝 Notes Importantes

- ⏰ Les plans gratuits peuvent avoir des limitations (temps d'inactivité, ressources)
- 💰 Pour un usage professionnel, considérez un plan payant
- 🔄 Les déploiements automatiques se font à chaque push sur GitHub
- 📧 Configurez SMTP correctement pour les emails de vérification

---

## 🎉 Félicitations !

Votre application OptimumAssurPro est maintenant en ligne ! 🚀

Pour toute question, consultez la documentation de votre hébergeur ou ouvrez une issue sur GitHub.

