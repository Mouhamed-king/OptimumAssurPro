# 🚗 OptimumAssurPro - Gestion Clients Assurance Automobile

## 📋 Description

Application web complète pour la gestion des clients d'une entreprise d'assurance automobile.  
Système centralisé et sécurisé permettant de stocker, consulter et suivre les informations des clients et de leurs contrats d'assurance en temps réel.

Cette application permet de gérer les assurances renouvelables sur des périodes de 1, 3, 6 ou 12 mois, d'avoir une vision claire des clients actifs et de réduire le risque de perte de données grâce à une base de données cloud sécurisée.

---

## ✨ Fonctionnalités

### 👥 Gestion des Clients
- Ajouter, consulter, modifier et supprimer des clients
- Informations complètes : nom, prénom, téléphone, email, adresse
- Association avec les véhicules assurés
- Historique des contrats par client

### 🚙 Gestion des Véhicules
- Enregistrement des véhicules par client
- Informations : marque, modèle, immatriculation, année, couleur
- Association automatique avec les contrats

### 📄 Gestion des Contrats
- Création et suivi des contrats d'assurance
- Types de contrats : Tous risques, Tiers, etc.
- Durées : 1, 3, 6 ou 12 mois
- Suivi des échéances de renouvellement
- Renouvellement automatique des contrats
- Alertes pour les contrats à renouveler

### 🔐 Authentification Multi-Entreprises
- Système d'authentification sécurisé avec JWT
- Chaque entreprise peut se connecter via email et mot de passe
- Séparation complète des données entre entreprises
- Sessions persistantes (localStorage/sessionStorage)

### 📊 Dashboard Interactif
- Statistiques en temps réel :
  - Nombre de clients actifs
  - Contrats actifs
  - Renouvellements à venir
  - Contrats expirant ce mois
- Notifications et alertes visuelles
- Vue d'ensemble des contrats à renouveler

### 🔔 Notifications
- Alertes pour les renouvellements à venir
- Notifications des contrats expirés
- Badge de notifications en temps réel

### 🔍 Recherche et Filtres
- Recherche rapide par nom, téléphone, email
- Filtres par statut (actifs, inactifs, expirés)
- Tri et organisation des données

---

## 🛠️ Technologies Utilisées

### Frontend
- **HTML5** - Structure sémantique
- **CSS3** - Design moderne et responsive
- **JavaScript (Vanilla)** - Logique côté client
- **Font Awesome 6.4.0** - Icônes
- **Polices** : Poppins (titres), Roboto (texte), Inter (UI)

### Backend
- **Node.js** - Runtime JavaScript
- **Express.js** - Framework web
- **JWT** - Authentification sécurisée
- **bcryptjs** - Hachage des mots de passe
- **express-validator** - Validation des données

### Base de Données
- **Supabase** - Plateforme cloud PostgreSQL avec Connection Pooling
- **PostgreSQL** - Base de données relationnelle (via Supabase)
- **pg** - Driver PostgreSQL pour Node.js (Connection Pooling Supabase)

### Sécurité
- Authentification JWT avec expiration
- Mots de passe hachés avec bcrypt
- Validation des données côté serveur
- CORS configuré
- SSL/TLS pour les connexions Supabase

---

## 🎨 Design UI

L'application utilise une charte graphique moderne et professionnelle :

### Palette de Couleurs
- **Couleur principale** : `#1E3A8A` (Bleu profond - inspire confiance)
- **Couleur secondaire** : `#2563EB` (Bleu vif - boutons et actions)
- **Couleur d'accent** : `#F59E0B` (Jaune/orangé - alertes et notifications)
- **Couleur de fond** : `#F3F4F6` (Gris très clair - aération)
- **Couleur de texte** : `#111827` (Noir anthracite - lisibilité)
- **Texte secondaire** : `#6B7280` (Gris moyen - descriptions)

### Caractéristiques du Design
- ✅ Interface responsive (mobile, tablette, desktop)
- ✅ Cartes avec ombres légères et coins arrondis
- ✅ Animations fluides et transitions
- ✅ Dashboard avec statistiques visuelles
- ✅ Navigation intuitive avec sidebar
- ✅ Alertes et notifications visuelles
- ✅ Design moderne et professionnel

---

## 📁 Structure du Projet

```
OptimumAssurPro/
├── index.html              # Page principale (Dashboard)
├── login.html              # Page de connexion
├── server.js               # Serveur Express
├── package.json            # Configuration npm
├── README.md               # Documentation
├── .env                    # Variables d'environnement (non versionné)
├── env.example            # Exemple de configuration
├── Procfile                # Configuration déploiement (Heroku/Railway)
│
├── css/                    # Styles CSS
│   ├── style.css          # Styles principaux
│   └── login.css          # Styles page de connexion
│
├── js/                     # JavaScript Frontend
│   ├── app.js             # Logique principale
│   ├── login.js           # Gestion authentification
│   └── api.js             # Appels API centralisés
│
├── database/               # Configuration Base de Données
│   ├── connection.js      # Connexion PostgreSQL/Supabase
│   ├── migrate.js         # Migration des tables
│   ├── seed.js            # Données de test
│   └── clean-test-data.js # Nettoyage données test
│
├── routes/                 # Routes API
│   ├── auth.js            # Authentification
│   ├── clients.js         # Gestion clients
│   ├── contracts.js       # Gestion contrats
│   ├── stats.js           # Statistiques
│   └── notifications.js   # Notifications
│
├── controllers/            # Contrôleurs API
│   ├── authController.js
│   ├── clientController.js
│   └── contractController.js
│
└── middleware/             # Middleware Express
    └── auth.js            # Vérification JWT
```

---

## 🚀 Installation

### Prérequis
- **Node.js** (v14 ou supérieur)
- **npm** ou **yarn**
- **Compte Supabase** (gratuit) - [supabase.com](https://supabase.com)

### Installation Complète

1. **Cloner le projet** :
   ```bash
   git clone https://github.com/ton-utilisateur/optimum-assur-pro.git
   cd OptimumAssurPro
   ```

2. **Installer les dépendances** :
   ```bash
   npm install
   ```

3. **Configurer Supabase** :
   
   a. Créer un projet sur [supabase.com](https://supabase.com)
   
   b. Aller dans **Settings → Database → Connection pooling**
   
   c. Copier les informations de connexion :
      - Host : `aws-1-eu-west-1.pooler.supabase.com` (ou votre région)
      - Port : `6543` (Connection Pooling)
      - Database : `postgres`
      - User : `postgres.votre-projet-id`
      - Password : Votre mot de passe Supabase
   
   d. Créer un fichier `.env` à la racine :
      ```env
      # Configuration Supabase PostgreSQL
      DB_HOST=aws-1-eu-west-1.pooler.supabase.com
      DB_USER=postgres.votre-projet-id
      DB_PASSWORD=votre_mot_de_passe_supabase
      DB_NAME=postgres
      DB_PORT=6543
      
      # SSL obligatoire pour Supabase
      DB_SSL=true
      DB_SSL_REJECT_UNAUTHORIZED=false
      
      # Configuration JWT
      JWT_SECRET=votre_secret_jwt_tres_securise_changez_moi
      JWT_EXPIRES_IN=24h
      
      # Configuration du serveur
      PORT=3000
      NODE_ENV=production
      
      # Supabase API (optionnel)
      SUPABASE_URL=https://votre-projet.supabase.co
      SUPABASE_ANON_KEY=votre_cle_api
      ```

4. **Initialiser la base de données** :
   ```bash
   npm run migrate
   ```
   Cela créera automatiquement toutes les tables nécessaires dans Supabase.

5. **Charger les données de test (optionnel)** :
   ```bash
   npm run seed
   ```
   Cela créera une entreprise de test :
   - Email : `test@assurance.com`
   - Mot de passe : `password123`

6. **Nettoyer les données de test (si nécessaire)** :
   ```bash
   npm run clean
   ```
   Supprime toutes les données de test pour commencer avec une base vide.

7. **Démarrer le serveur** :
   ```bash
   npm run dev    # Mode développement (avec nodemon)
   # ou
   npm start      # Mode production
   ```

8. **Accéder à l'application** :
   - Frontend : http://localhost:3000
   - Page de connexion : http://localhost:3000/login.html
   - API : http://localhost:3000/api

---

## 📖 Utilisation

### Première Connexion

1. **Créer un compte entreprise** :
   - Utiliser les données de test : `test@assurance.com` / `password123`
   - Ou créer une nouvelle entreprise via l'API `/api/auth/register`

2. **Se connecter** :
   - Aller sur http://localhost:3000/login.html
   - Entrer l'email et le mot de passe
   - Cocher "Se souvenir de moi" pour une session persistante

### Gestion des Clients

1. **Ajouter un client** :
   - Cliquer sur "Clients" dans la sidebar
   - Cliquer sur "Ajouter un client"
   - Remplir le formulaire avec les informations du client
   - Cliquer sur "Enregistrer"

2. **Modifier un client** :
   - Cliquer sur l'icône "Modifier" à côté du client
   - Modifier les informations
   - Sauvegarder

3. **Supprimer un client** :
   - Cliquer sur l'icône "Supprimer"
   - Confirmer la suppression
   - ⚠️ Cela supprimera aussi tous ses contrats

### Gestion des Contrats

1. **Créer un contrat** :
   - Aller dans "Contrats"
   - Cliquer sur "Nouveau contrat"
   - Sélectionner le client et le véhicule
   - Remplir les détails (type, durée, montant)
   - Enregistrer

2. **Renouveler un contrat** :
   - Cliquer sur "Renouveler" sur un contrat actif
   - Le système créera automatiquement un nouveau contrat
   - L'ancien contrat sera marqué comme "renouvelé"

### Dashboard

- Consulter les statistiques en temps réel
- Voir les alertes de renouvellement
- Accéder rapidement aux contrats à renouveler

---

## 🔧 Commandes Disponibles

```bash
# Démarrer en mode développement (avec rechargement automatique)
npm run dev

# Démarrer en mode production
npm start

# Créer les tables dans la base de données
npm run migrate

# Charger les données de test
npm run seed

# Nettoyer les données de test
npm run clean
```

---

## 🔒 Sécurité

- ✅ Authentification JWT avec expiration
- ✅ Mots de passe hachés avec bcrypt (10 rounds)
- ✅ Validation des données côté serveur
- ✅ CORS configuré pour la sécurité
- ✅ SSL/TLS pour les connexions Supabase
- ✅ Protection contre les injections SQL (requêtes paramétrées)
- ✅ Séparation des données par entreprise

---

## 🌐 Déploiement

### Déploiement sur Heroku/Railway

1. **Créer un compte** sur Heroku ou Railway

2. **Configurer les variables d'environnement** :
   - Copier toutes les variables du fichier `.env`
   - Les ajouter dans les paramètres du projet

3. **Déployer** :
   ```bash
   git push heroku main
   # ou
   git push railway main
   ```

Le fichier `Procfile` est déjà configuré pour le déploiement.

---

## 📊 Base de Données

### Tables Principales

- **entreprises** : Informations des entreprises
- **clients** : Liste des clients par entreprise
- **vehicules** : Véhicules des clients
- **contrats** : Contrats d'assurance
- **notifications** : Alertes et notifications

### Relations

- Une entreprise a plusieurs clients
- Un client a plusieurs véhicules
- Un client a plusieurs contrats
- Un contrat est lié à un client et un véhicule

---

## 🚧 Améliorations Futures

- [ ] Notifications automatiques par SMS ou email pour les renouvellements
- [ ] Paiement en ligne directement depuis le dashboard (Orange Money, Wave)
- [ ] Tableau de bord avec statistiques avancées (graphiques, tendances)
- [ ] Application mobile pour une gestion en déplacement
- [ ] Export des données en PDF/Excel
- [ ] Système de rappels automatiques
- [ ] Gestion des sinistres
- [ ] Historique complet des modifications

---

## 📝 API Documentation

### Authentification

- `POST /api/auth/register` - Créer un compte entreprise
- `POST /api/auth/login` - Se connecter
- `GET /api/auth/me` - Obtenir les informations de l'entreprise connectée

### Clients

- `GET /api/clients` - Liste des clients
- `GET /api/clients/:id` - Détails d'un client
- `POST /api/clients` - Créer un client
- `PUT /api/clients/:id` - Modifier un client
- `DELETE /api/clients/:id` - Supprimer un client

### Contrats

- `GET /api/contracts` - Liste des contrats
- `GET /api/contracts/:id` - Détails d'un contrat
- `POST /api/contracts` - Créer un contrat
- `POST /api/contracts/:id/renew` - Renouveler un contrat
- `PUT /api/contracts/:id` - Modifier un contrat
- `DELETE /api/contracts/:id` - Supprimer un contrat

### Statistiques

- `GET /api/stats/dashboard` - Statistiques du dashboard

### Notifications

- `GET /api/notifications` - Liste des notifications
- `PUT /api/notifications/:id/read` - Marquer comme lu

---

## 🚀 Déploiement

OptimumAssurPro peut être déployé facilement sur plusieurs plateformes gratuites.

### Hébergeurs Recommandés

- **Vercel** ⭐ (Recommandé) - Plan gratuit généreux, déploiement ultra-rapide
- **Render.com** - Plan gratuit avec 750h/mois
- **Railway.app** - $5 de crédits gratuits par mois

### Guide Complet de Déploiement

📖 **Consultez le fichier [VERCEL_DEPLOY.md](./VERCEL_DEPLOY.md) pour un guide détaillé Vercel** avec :
- Instructions étape par étape pour Vercel
- Configuration des variables d'environnement
- Ajout d'un nom de domaine personnalisé
- Dépannage et sécurité en production

📖 **Consultez le fichier [DEPLOY.md](./DEPLOY.md) pour d'autres hébergeurs** (Render, Railway)

### Déploiement Rapide (Vercel) ⚡

1. Poussez votre code sur GitHub
2. Créez un compte sur [vercel.com](https://vercel.com)
3. Importez votre repository GitHub
4. Configurez les variables d'environnement (voir VERCEL_DEPLOY.md)
5. Déployez ! Votre app sera en ligne en 2 minutes

### Variables d'Environnement Requises

```env
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

---

## 👤 Auteur

**MęȚźĂ kìŃğ**

Projet développé pour une entreprise familiale d'assurance automobile.

---

## 🙏 Remerciements

- **Supabase** pour l'hébergement PostgreSQL gratuit
- **Express.js** pour le framework backend
- **Font Awesome** pour les icônes
- **Communauté open source** pour les outils utilisés
