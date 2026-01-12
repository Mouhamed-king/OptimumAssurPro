# Migration : Ajout de la catégorie de véhicule

## 📋 Description

Cette migration ajoute le champ `categorie_vehicule` à la table `contrats` pour séparer les catégories :
- **TPV** : Transport Public de Voyageurs
- **VP/CI** : Véhicule Particulier/Camionnette

## 🚀 Méthodes d'exécution

### Option 1 : Via Supabase Dashboard (Recommandé - Plus simple)

1. **Connectez-vous** à votre projet Supabase : https://app.supabase.com
2. Allez dans **SQL Editor** (menu de gauche)
3. Cliquez sur **"New query"**
4. **Ouvrez** le fichier `database/add-categorie-vehicule.sql` dans votre éditeur
5. **Copiez tout le contenu** du fichier
6. **Collez** dans l'éditeur SQL de Supabase
7. Cliquez sur **"Run"** ou appuyez sur `Ctrl+Enter` (Windows) / `Cmd+Enter` (Mac)

✅ **Avantages** : Pas besoin de configurer les variables d'environnement PostgreSQL

### Option 2 : Via script Node.js

Si vous avez configuré les variables PostgreSQL dans votre `.env` :

```bash
npm run migrate-categorie
```

**Variables requises dans `.env`** :
```env
DB_HOST=votre-host-postgresql.supabase.co
DB_USER=postgres.votre-projet-id
DB_PASSWORD=votre-mot-de-passe
DB_NAME=postgres
DB_PORT=5432
DB_SSL=true
```

## ✅ Ce que fait la migration

1. ✅ Ajoute la colonne `categorie_vehicule` à la table `contrats`
2. ✅ Définit la valeur par défaut à `'VP/CI'`
3. ✅ Ajoute une contrainte CHECK pour n'accepter que `'TPV'` ou `'VP/CI'`
4. ✅ Crée un index pour optimiser les requêtes par catégorie
5. ✅ Met à jour tous les contrats existants avec `'VP/CI'` par défaut
6. ✅ Ajoute un commentaire descriptif sur la colonne

## ⚠️ Sécurité

- ✅ **Sûr à exécuter** : Ne supprime aucune donnée
- ✅ **Idempotent** : Peut être exécuté plusieurs fois sans problème
- ✅ **Pas de perte de données** : Les contrats existants sont préservés

## 🔍 Vérification après migration

Pour vérifier que la migration a réussi, exécutez cette requête dans Supabase SQL Editor :

```sql
SELECT 
    column_name, 
    data_type, 
    column_default,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'contrats' 
AND column_name = 'categorie_vehicule';
```

Vous devriez voir :
- `column_name`: `categorie_vehicule`
- `data_type`: `character varying`
- `column_default`: `'VP/CI'::character varying`
- `is_nullable`: `NO`

## 📊 Impact sur l'application

Après la migration :
- ✅ Les nouveaux contrats devront spécifier une catégorie (TPV ou VP/CI)
- ✅ Les contrats existants seront automatiquement marqués comme VP/CI
- ✅ La page Clients affichera deux sous-onglets (TPV et VP/CI)
- ✅ Le bordereau permettra de filtrer par catégorie
- ✅ Les rapports pourront être filtrés par catégorie

## 🐛 En cas de problème

Si vous rencontrez une erreur :

1. **Vérifiez les permissions** : Assurez-vous d'avoir les droits d'administration sur la base de données
2. **Vérifiez la connexion** : Si vous utilisez le script Node.js, vérifiez vos variables d'environnement
3. **Utilisez l'Option 1** : Le SQL Editor de Supabase est généralement plus fiable

## 📝 Notes

- Les contrats créés avant la migration seront automatiquement marqués comme `VP/CI`
- Vous pouvez modifier manuellement la catégorie d'un contrat existant si nécessaire
- La catégorie est obligatoire pour tous les nouveaux contrats
