# 📦 Configuration GitHub pour Vercel

## Étapes pour pousser votre code sur GitHub

### 1. Créer un nouveau repository sur GitHub

1. Allez sur [github.com](https://github.com)
2. Cliquez sur le bouton **"+"** en haut à droite → **"New repository"**
3. Nommez votre repository (ex: `optimum-assur-pro`)
4. **Ne cochez PAS** "Initialize with README" (vous avez déjà un README)
5. Cliquez sur **"Create repository"**

### 2. Ajouter le remote et pousser le code

Dans PowerShell, exécutez ces commandes (remplacez `votre-username` par votre nom d'utilisateur GitHub) :

```powershell
# Ajouter le remote GitHub
git remote add origin https://github.com/votre-username/optimum-assur-pro.git

# Renommer la branche en 'main' (si nécessaire)
git branch -M main

# Pousser le code vers GitHub
git push -u origin main
```

**Si vous utilisez SSH** au lieu de HTTPS :

```powershell
git remote add origin git@github.com:votre-username/optimum-assur-pro.git
git branch -M main
git push -u origin main
```

### 3. Si vous avez déjà un repository GitHub

Si vous avez déjà créé le repository sur GitHub, utilisez simplement :

```powershell
git remote add origin https://github.com/votre-username/votre-repo-name.git
git branch -M main
git push -u origin main
```

---

## 🔐 Authentification GitHub

Si vous êtes invité à vous authentifier :

### Option 1 : Personal Access Token (Recommandé)
1. Allez sur GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Cliquez sur "Generate new token"
3. Donnez-lui un nom et cochez `repo`
4. Copiez le token généré
5. Utilisez-le comme mot de passe lors du `git push`

### Option 2 : GitHub CLI
```powershell
# Installer GitHub CLI (si pas déjà installé)
winget install GitHub.cli

# S'authentifier
gh auth login

# Pousser le code
git push -u origin main
```

---

## ✅ Vérification

Après le push, vérifiez que tout est bien sur GitHub :

```powershell
# Vérifier le remote
git remote -v

# Vérifier le statut
git status
```

Vous devriez voir votre code sur `https://github.com/votre-username/optimum-assur-pro`

---

## 🚀 Prochaine étape : Déploiement sur Vercel

Une fois le code sur GitHub, suivez les instructions dans [VERCEL_DEPLOY.md](./VERCEL_DEPLOY.md) pour déployer sur Vercel !

