# Instructions pour recréer les tables Supabase

## 📋 Fichier SQL créé

Le fichier `database/recreate-tables.sql` contient le script complet pour recréer toutes les tables.

## ⚠️ ATTENTION IMPORTANTE

**Ce script supprime toutes les tables existantes et les recrée !**

- ✅ **Sauvegardez vos données** avant d'exécuter ce script si vous avez des données importantes
- ✅ **Les utilisateurs Supabase Auth ne seront pas supprimés** (seulement les tables de données)
- ✅ **Les relations entre tables seront recréées automatiquement**

## 🚀 Comment exécuter le script

### Option 1 : Via Supabase Dashboard (Recommandé)

1. **Connectez-vous** à votre projet Supabase : https://app.supabase.com
2. Allez dans **SQL Editor** (menu de gauche)
3. Cliquez sur **"New query"**
4. **Ouvrez** le fichier `database/recreate-tables.sql` dans votre éditeur
5. **Copiez tout le contenu** du fichier
6. **Collez** dans l'éditeur SQL de Supabase
7. Cliquez sur **"Run"** ou appuyez sur `Ctrl+Enter` (Windows) / `Cmd+Enter` (Mac)

### Option 2 : Via psql (ligne de commande)

Si vous avez accès à psql avec les credentials PostgreSQL :

```bash
psql -h [DB_HOST] -U [DB_USER] -d [DB_NAME] -f database/recreate-tables.sql
```

Remplacez :
- `[DB_HOST]` : Votre host PostgreSQL (ex: `aws-1-eu-west-1.pooler.supabase.com`)
- `[DB_USER]` : Votre utilisateur PostgreSQL (ex: `postgres.votre-projet-id`)
- `[DB_NAME]` : Généralement `postgres`

## 📊 Tables créées

Le script crée les tables suivantes dans cet ordre :

1. **entreprises**
   - `id` : UUID (référence `auth.users.id`)
   - `nom`, `email`, `telephone`, `adresse`
   - `created_at`, `updated_at`

2. **clients**
   - `id` : SERIAL (auto-increment)
   - `entreprise_id` : UUID (référence `entreprises.id`)
   - `nom`, `prenom`, `telephone`, `email`, `adresse`
   - `created_at`, `updated_at`

3. **vehicules**
   - `id` : SERIAL (auto-increment)
   - `client_id` : INTEGER (référence `clients.id`)
   - `marque`, `modele`, `immatriculation`, `annee`, `couleur`
   - `created_at`, `updated_at`

4. **contrats**
   - `id` : SERIAL (auto-increment)
   - `client_id` : INTEGER (référence `clients.id`)
   - `vehicule_id` : INTEGER (référence `vehicules.id`)
   - `entreprise_id` : UUID (référence `entreprises.id`)
   - `numero_contrat`, `type_contrat`, `duree_mois`
   - `date_debut`, `date_fin`
   - `montant`, `montant_paye`, `montant_restant`
   - `statut` : 'actif', 'expire', 'renouvele', 'annule'
   - `created_at`, `updated_at`

5. **notifications**
   - `id` : SERIAL (auto-increment)
   - `entreprise_id` : UUID (référence `entreprises.id`)
   - `contrat_id` : INTEGER (référence `contrats.id`, nullable)
   - `type`, `titre`, `message`
   - `lu` : BOOLEAN (défaut: false)
   - `created_at`

## 🔧 Fonctionnalités incluses

### Index créés pour optimiser les requêtes :
- `idx_entreprises_email` : Recherche par email
- `idx_clients_entreprise` : Filtrage par entreprise
- `idx_clients_nom` : Recherche par nom/prénom
- `idx_vehicules_client` : Filtrage par client
- `idx_vehicules_immatriculation` : Recherche par immatriculation
- `idx_contrats_client`, `idx_contrats_entreprise`, `idx_contrats_vehicule` : Filtrage
- `idx_contrats_date_fin` : Recherche par date de fin
- `idx_contrats_statut` : Filtrage par statut
- `idx_notifications_entreprise`, `idx_notifications_lu` : Filtrage des notifications

### Triggers automatiques :
- **`update_updated_at_column()`** : Fonction qui met à jour `updated_at` automatiquement
- **Triggers** : Appliqués sur `entreprises`, `clients`, `vehicules`, `contrats`

### Contraintes de clés étrangères :
- Toutes les relations sont définies avec `ON DELETE CASCADE` ou `ON DELETE SET NULL`
- Les contraintes UNIQUE sont appliquées où nécessaire

## ✅ Vérification après exécution

Après avoir exécuté le script, vérifiez que :

1. **Les tables existent** :
   ```sql
   SELECT table_name 
   FROM information_schema.tables 
   WHERE table_schema = 'public' 
   AND table_name IN ('entreprises', 'clients', 'vehicules', 'contrats', 'notifications');
   ```
   Devrait retourner 5 lignes.

2. **Les index existent** :
   ```sql
   SELECT indexname 
   FROM pg_indexes 
   WHERE schemaname = 'public' 
   AND tablename IN ('entreprises', 'clients', 'vehicules', 'contrats', 'notifications');
   ```
   Devrait retourner plusieurs index.

3. **La fonction existe** :
   ```sql
   SELECT proname 
   FROM pg_proc 
   WHERE proname = 'update_updated_at_column';
   ```
   Devrait retourner 1 ligne.

## 🔄 Après la recréation

Une fois les tables recréées :

1. **Les utilisateurs Supabase Auth** existent toujours dans `auth.users`
2. **Vous devrez créer les enregistrements** dans la table `entreprises` pour chaque utilisateur
3. **Les données** des autres tables (clients, véhicules, contrats, notifications) seront vides

### Créer un enregistrement entreprise pour un utilisateur existant

Si vous avez déjà des utilisateurs dans Supabase Auth, vous pouvez créer les enregistrements correspondants :

```sql
-- Exemple : Créer un enregistrement entreprise pour un utilisateur
INSERT INTO entreprises (id, nom, email)
SELECT 
    id,
    COALESCE(raw_user_meta_data->>'nom', 'Utilisateur'),
    email
FROM auth.users
WHERE id NOT IN (SELECT id FROM entreprises);
```

## 📝 Notes importantes

- **UUID pour entreprises** : L'ID de la table `entreprises` utilise UUID et référence directement `auth.users.id`
- **Cascade delete** : Si un utilisateur est supprimé de `auth.users`, son entreprise et toutes ses données associées seront supprimées automatiquement
- **Colonnes de paiement** : Les colonnes `montant_paye` et `montant_restant` sont incluses dans la table `contrats` avec des valeurs par défaut de 0

## 🆘 En cas d'erreur

Si vous rencontrez une erreur lors de l'exécution :

1. **Vérifiez les logs** dans Supabase Dashboard > Logs
2. **Vérifiez les contraintes** : Assurez-vous qu'il n'y a pas de données orphelines
3. **Exécutez section par section** : Vous pouvez exécuter le script en plusieurs parties si nécessaire

---

**Le script est prêt à être utilisé !** 🚀
