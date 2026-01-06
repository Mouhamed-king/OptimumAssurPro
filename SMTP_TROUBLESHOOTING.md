# 🔧 Guide de dépannage SMTP sur Render

## Problème : Les emails de vérification ne sont pas envoyés depuis Render

### Vérifications à faire :

#### 1. Vérifier les variables d'environnement sur Render

Allez dans votre dashboard Render → Votre service → **Environment** et vérifiez que toutes ces variables sont définies :

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=votre-email@gmail.com
SMTP_PASSWORD=votre-mot-de-passe-app
SMTP_FROM_NAME=OptimumAssurPro
APP_URL=https://votre-app.onrender.com
```

⚠️ **IMPORTANT** : 
- `SMTP_PASSWORD` doit être un **mot de passe d'application Gmail**, pas votre mot de passe habituel
- **Vous pouvez réutiliser le même mot de passe d'application** sur plusieurs services (Vercel, Render, etc.) - pas besoin d'en créer un nouveau
- `APP_URL` doit être l'URL complète de votre application Render (ex: `https://optimum-assur-pro.onrender.com`), **pas** l'URL Vercel

#### 2. Vérifier les logs Render

Dans le dashboard Render → Votre service → **Logs**, cherchez :
- `📧 Configuration SMTP:` - Vérifiez que toutes les variables sont configurées
- `❌ Erreur` ou `⚠️` - Messages d'erreur SMTP
- `📤 Envoi de l'email` - Confirmation d'envoi

#### 3. Problèmes courants avec Gmail

**a) Mot de passe d'application requis**

Gmail nécessite un "mot de passe d'application" pour les connexions SMTP :

> 💡 **Note** : Si vous avez déjà un mot de passe d'application qui fonctionne sur Vercel, vous pouvez réutiliser le même sur Render. Pas besoin d'en créer un nouveau, sauf si celui-ci a été révoqué ou expiré.

1. Allez sur [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
2. Activez la **validation en 2 étapes** si ce n'est pas déjà fait
3. Générez un nouveau mot de passe d'application :
   - Sélectionnez "Mail"
   - Sélectionnez "Autre (nom personnalisé)"
   - Entrez "OptimumAssurPro"
   - Cliquez sur "Générer"
4. Copiez le mot de passe généré (16 caractères sans espaces)
5. Utilisez ce mot de passe dans `SMTP_PASSWORD` sur Render

**b) Gmail bloque les connexions "moins sécurisées"**

Si vous voyez l'erreur "Less secure app access", vous devez :
1. Utiliser un mot de passe d'application (voir ci-dessus)
2. Ne PAS activer "Accès aux applications moins sécurisées" (cette option est obsolète)

#### 4. Tester la configuration SMTP

Vous pouvez tester la configuration SMTP en créant un compte de test. Les logs Render afficheront :
- Les détails de la configuration SMTP au démarrage
- Les erreurs détaillées si l'envoi échoue
- Le Message ID si l'email est envoyé avec succès

#### 5. Vérifier que l'email n'est pas dans les spams

Parfois les emails sont envoyés mais arrivent dans le dossier spam. Vérifiez :
- Le dossier spam/courrier indésirable
- Les filtres Gmail
- Les règles de tri automatique

#### 6. Alternative : Utiliser un autre service SMTP

Si Gmail pose problème, vous pouvez utiliser :
- **SendGrid** (gratuit jusqu'à 100 emails/jour)
- **Mailgun** (gratuit jusqu'à 5000 emails/mois)
- **Amazon SES** (très économique)
- **Resend** (moderne et simple)

### Commandes utiles pour déboguer

Sur Render, dans les logs, vous devriez voir :

```
📧 Configuration SMTP:
   Host: smtp.gmail.com
   Port: 587
   Secure: false
   User: abc***
   Password: ***CONFIGURÉ***
```

Si vous voyez `NON CONFIGURÉ`, les variables d'environnement ne sont pas correctement définies.

### Solution rapide

1. Vérifiez que toutes les variables SMTP sont définies sur Render
2. Régénérez un mot de passe d'application Gmail
3. Mettez à jour `SMTP_PASSWORD` sur Render
4. Redéployez l'application (Render redéploie automatiquement après modification des variables)
5. Testez la création d'un compte
6. Vérifiez les logs Render pour voir les erreurs détaillées

### Support

Si le problème persiste après ces vérifications :
1. Copiez les logs Render (sections avec erreurs SMTP)
2. Vérifiez que le token de vérification existe bien dans Supabase
3. Vérifiez que `APP_URL` est correctement configuré

