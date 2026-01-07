# Configuration SendGrid pour OptimumAssurPro

SendGrid est un service SMTP fiable qui fonctionne bien avec les hébergeurs cloud comme Render. Il offre **100 emails gratuits par jour**.

## Étapes de configuration

### 1. Créer un compte SendGrid

1. Allez sur [https://sendgrid.com](https://sendgrid.com)
2. Cliquez sur **"Start for free"** ou **"Sign Up"**
3. Remplissez le formulaire d'inscription
4. Vérifiez votre email

### 2. Créer une clé API SendGrid

1. Une fois connecté, allez dans **Settings** → **API Keys**
2. Cliquez sur **"Create API Key"**
3. Donnez un nom à votre clé (ex: "OptimumAssurPro Production")
4. Sélectionnez **"Full Access"** ou **"Restricted Access"** avec les permissions suivantes :
   - **Mail Send** → **Full Access**
5. Cliquez sur **"Create & View"**
6. **IMPORTANT** : Copiez la clé API immédiatement (vous ne pourrez plus la voir après)
   - La clé ressemble à : `SG.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

### 3. Vérifier votre domaine (optionnel mais recommandé)

Pour améliorer la délivrabilité des emails :

1. Allez dans **Settings** → **Sender Authentication**
2. Cliquez sur **"Authenticate Your Domain"**
3. Suivez les instructions pour ajouter les enregistrements DNS

**Note** : Pour un usage simple, vous pouvez utiliser l'email de vérification SendGrid sans vérifier votre domaine.

### 4. Configurer les variables d'environnement sur Render

Dans votre service Render, ajoutez/modifiez ces variables d'environnement :

```
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=apikey
SMTP_PASSWORD=SG.votre_cle_api_sendgrid_ici
SMTP_FROM_NAME=OptimumAssurPro
APP_URL=https://optimumassurpro.onrender.com
```

**Important** :
- `SMTP_USER` doit être exactement `apikey` (en minuscules)
- `SMTP_PASSWORD` doit être votre clé API SendGrid complète (commence par `SG.`)
- `SMTP_PORT` peut être `587` (STARTTLS) ou `465` (SSL) - utilisez `587` avec `SMTP_SECURE=false`

### 5. Alternative : Port 465 avec SSL

Si le port 587 ne fonctionne pas, essayez :

```
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=apikey
SMTP_PASSWORD=SG.votre_cle_api_sendgrid_ici
```

### 6. Redéployer sur Render

1. Sauvegardez les variables d'environnement sur Render
2. Redéployez votre service
3. Testez la création d'un compte

## Vérification

Après le déploiement, vérifiez les logs Render. Vous devriez voir :

```
📧 Configuration SMTP:
   Host: smtp.sendgrid.net
   Port: 587
   Secure: false
   User: apikey***
   Password: ***CONFIGURÉ***
```

Lors de l'envoi d'un email, vous devriez voir :

```
✅ Email envoyé avec succès
```

## Limites SendGrid

- **Plan gratuit** : 100 emails par jour
- **Plan Essentials** ($19.95/mois) : 50,000 emails par mois
- **Plan Pro** ($89.95/mois) : 100,000 emails par mois

Pour la plupart des applications, le plan gratuit est suffisant.

## Dépannage

### Erreur d'authentification
- Vérifiez que `SMTP_USER` est exactement `apikey` (pas `apikey@sendgrid.com` ou autre)
- Vérifiez que votre clé API est correcte et complète
- Assurez-vous que la clé API a les permissions "Mail Send"

### Erreur de connexion
- Vérifiez que `SMTP_HOST` est `smtp.sendgrid.net`
- Essayez le port 465 avec `SMTP_SECURE=true` si le port 587 ne fonctionne pas
- Vérifiez que votre compte SendGrid est actif

### Emails non reçus
- Vérifiez votre dossier spam
- Vérifiez les logs SendGrid dans le dashboard SendGrid (Activity)
- Vérifiez que votre compte SendGrid n'a pas atteint la limite quotidienne

## Support SendGrid

- Documentation : [https://docs.sendgrid.com](https://docs.sendgrid.com)
- Support : Disponible dans le dashboard SendGrid

