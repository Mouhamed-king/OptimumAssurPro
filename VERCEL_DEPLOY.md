# 🚀 Guide de Déploiement sur Vercel - OptimumAssurPro

## 📋 Prérequis

- Un compte GitHub (gratuit)
- Un compte Vercel (gratuit) - [vercel.com](https://vercel.com)
- Un compte Supabase (gratuit) - [supabase.com](https://supabase.com)

---

## 🌐 Déploiement sur Vercel

Vercel est une excellente plateforme pour déployer des applications Node.js avec :
- ✅ Plan gratuit généreux
- ✅ Déploiement ultra-rapide
- ✅ SSL automatique
- ✅ Support des noms de domaine personnalisés
- ✅ Déploiement automatique depuis GitHub

### Étapes de déploiement :

#### 1. Préparer le code sur GitHub

```bash
# Initialiser Git si ce n'est pas déjà fait
git init

# Ajouter tous les fichiers
git add .

# Créer un commit
git commit -m "Préparation pour déploiement Vercel"

# Créer un repository sur GitHub et pousser le code
git remote add origin https://github.com/votre-username/optimum-assur-pro.git
git branch -M main
git push -u origin main
```

#### 2. Créer un compte Vercel

1. Allez sur [vercel.com](https://vercel.com)
2. Cliquez sur "Sign Up"
3. Connectez-vous avec votre compte GitHub

#### 3. Importer le projet

1. Dans le dashboard Vercel, cliquez sur "Add New..." → "Project"
2. Sélectionnez votre repository GitHub `optimum-assur-pro`
3. Cliquez sur "Import"

#### 4. Configurer le projet

**Paramètres de build :**
- **Framework Preset** : `Other`
- **Root Directory** : `./` (laisser vide)
- **Build Command** : (laisser vide - pas de build nécessaire)
- **Output Directory** : (laisser vide)
- **Install Command** : `npm install`

#### 5. Configurer les variables d'environnement

Dans la section "Environment Variables", ajoutez **TOUTES** ces variables :

```
NODE_ENV=production
PORT=3000

# Supabase
SUPABASE_URL=https://votre-projet.supabase.co
SUPABASE_SERVICE_ROLE_KEY=votre_service_role_key_secrete
SUPABASE_ANON_KEY=votre_anon_key_publique

# JWT
JWT_SECRET=votre_secret_jwt_tres_securise_changez_moi
JWT_EXPIRES_IN=24h

# Application
APP_URL=https://votre-app.vercel.app

# SMTP (Email)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=votre-email@gmail.com
SMTP_PASSWORD=votre-mot-de-passe-app
SMTP_FROM_NAME=OptimumAssurPro
```

⚠️ **Important** : Après le premier déploiement, mettez à jour `APP_URL` avec l'URL réelle de votre application Vercel.

#### 6. Déployer

1. Cliquez sur "Deploy"
2. Attendez 2-3 minutes pour le déploiement
3. Votre application sera disponible sur `https://votre-app.vercel.app`

---

## 🔧 Configuration Post-Déploiement

### 1. Mettre à jour APP_URL

Après le premier déploiement :

1. Allez dans votre projet Vercel → Settings → Environment Variables
2. Trouvez `APP_URL`
3. Mettez à jour avec votre URL Vercel : `https://votre-app.vercel.app`
4. Redéployez (ou attendez le prochain déploiement automatique)

### 2. Exécuter les migrations de base de données

Les migrations doivent être exécutées manuellement dans Supabase :

1. Allez sur [app.supabase.com](https://app.supabase.com)
2. Sélectionnez votre projet
3. Allez dans "SQL Editor"
4. Exécutez le script `database/add-payment-columns.sql` si ce n'est pas déjà fait

### 3. Configurer SMTP pour les emails

Pour Gmail :
1. Activez la validation en 2 étapes sur votre compte Google
2. Générez un "Mot de passe d'application"
3. Utilisez ce mot de passe dans `SMTP_PASSWORD` dans Vercel

---

## 🌍 Ajouter un nom de domaine personnalisé

### Sur Vercel :

1. **Achetez un domaine** (ex: Namecheap, GoDaddy, etc.)

2. **Dans Vercel** :
   - Allez dans votre projet → Settings → Domains
   - Cliquez sur "Add Domain"
   - Entrez votre domaine (ex: `optimumassurpro.com`)

3. **Configurez les DNS** :
   - Vercel vous donnera des enregistrements DNS à ajouter
   - Ajoutez-les dans votre fournisseur de domaine :
     - Type : `A` ou `CNAME`
     - Name : `@` ou `www`
     - Value : (fourni par Vercel)

4. **Attendez la propagation DNS** (5-30 minutes)

5. **Mettez à jour APP_URL** dans Vercel avec votre nouveau domaine

---

## 🔄 Déploiements automatiques

Vercel déploie automatiquement à chaque push sur GitHub :

- **Push sur `main`** → Déploiement en production
- **Pull Request** → Déploiement de prévisualisation

---

## 📊 Monitoring et Logs

### Voir les logs :

1. Allez dans votre projet Vercel
2. Cliquez sur "Deployments"
3. Cliquez sur un déploiement
4. Allez dans "Functions" → "View Function Logs"

### Métriques :

- Vercel fournit des métriques de performance automatiquement
- Consultez l'onglet "Analytics" dans votre projet

---

## 🆘 Dépannage

### L'application ne démarre pas

1. Vérifiez les logs dans Vercel
2. Vérifiez que toutes les variables d'environnement sont configurées
3. Vérifiez que `PORT` n'est pas nécessaire (Vercel gère cela automatiquement)

### Erreur 500

1. Vérifiez les logs de fonction dans Vercel
2. Vérifiez la configuration Supabase
3. Vérifiez que les migrations ont été exécutées

### Les emails ne sont pas envoyés

1. Vérifiez la configuration SMTP dans les variables d'environnement
2. Vérifiez que `APP_URL` est correct
3. Testez avec `npm run test-smtp` en local

### Erreurs de base de données

1. Vérifiez que Supabase est accessible
2. Vérifiez les credentials Supabase
3. Vérifiez que les migrations ont été exécutées

---

## ✅ Checklist de déploiement

- [ ] Code poussé sur GitHub
- [ ] Projet créé sur Vercel
- [ ] Toutes les variables d'environnement configurées
- [ ] Migrations SQL exécutées dans Supabase
- [ ] SMTP configuré
- [ ] APP_URL mis à jour après le premier déploiement
- [ ] Application testée sur l'URL Vercel
- [ ] Nom de domaine configuré (optionnel)

---

## 🎉 Félicitations !

Votre application OptimumAssurPro est maintenant en ligne sur Vercel ! 🚀

Pour toute question, consultez la [documentation Vercel](https://vercel.com/docs) ou ouvrez une issue sur GitHub.

