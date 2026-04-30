# Documentation du module de paiement Stripe

## 1. Vue d'ensemble

Ce module gère le paiement en ligne des inscriptions au tournoi de golf avec Stripe.  
L'implémentation actuelle repose sur deux fichiers principaux :

- `routes/payments.routes.js` : gestion des routes HTTP, validation, création de session Stripe, traitement du webhook et retour de confirmation. fileciteturn5file0
- `dal/payments.repository.js` : gestion des accès SQL liés aux paiements et à la confirmation. fileciteturn5file0

L'objectif de cette conception est de séparer :

- la logique HTTP et Stripe dans la couche **routes**,
- la logique SQL dans la couche **DAL**.

Cette approche rend le module plus clair, plus maintenable et plus facile à tester.

---

## 2. Conception actuelle du module

### 2.1 Couche `routes`

Le fichier `payments.routes.js` contient trois endpoints principaux : fileciteturn5file0

- `POST /payments/create-checkout-session`
- `POST /payments/webhook`
- `GET /payments/confirmation?session_id=...`

Il contient aussi plusieurs fonctions utilitaires :

- `safeTrim()` pour nettoyer les chaînes de caractères, fileciteturn5file0
- `parsePositiveInt()` pour valider les entiers positifs, fileciteturn5file0
- `toStripeAmount()` pour convertir les dollars en cents Stripe, fileciteturn5file0
- `isValidEmail()` pour vérifier le format d'un courriel, fileciteturn5file0
- `normalizeMetadata()` pour fusionner les metadata de la session Stripe et du `payment_intent`, fileciteturn5file0
- `hasRequiredMetadata()` pour vérifier la présence des metadata minimales. fileciteturn5file0

### 2.2 Couche `dal`

Le fichier `payments.repository.js` centralise l'accès aux données de paiement : fileciteturn5file0

- création d'un paiement en attente avec `createPaiementEnAttente()`,
- lecture d'un tournoi pour préparer le paiement avec `findTournoiForPayment()`,
- recherche d'un paiement par session Stripe avec `findPaiementByStripeSessionId()`,
- mise à jour en échec avec `markPaiementEchec()`,
- mise à jour en payé avec `markPaiementPaye()`,
- récupération des informations de confirmation avec `findConfirmationBySessionId()`. fileciteturn5file0

Cette séparation correspond bien à l'objectif architectural demandé : pas de SQL direct dans la route, seulement dans le DAL.

---

## 3. Flux Stripe

## 3.1 Flux de checkout

Le flux de checkout démarre quand le frontend appelle `POST /payments/create-checkout-session`. Cette route lit les données envoyées par le client : `tournoi_id`, `prenom`, `nom`, `courriel`, `telephone`, `optionEquipe`, `nom_equipe` et `code_equipe` selon le cas. fileciteturn5file0

### Étapes du traitement

1. **Validation des données**
   - vérification des champs obligatoires,
   - validation du courriel,
   - validation du choix d'équipe (`creer` ou `rejoindre`),
   - vérification de `nom_equipe` si on crée une équipe,
   - vérification de `code_equipe` si on rejoint une équipe. fileciteturn5file0

2. **Lecture du tournoi**
   - la route appelle `findTournoiForPayment(tournoi_id)`,
   - elle vérifie que le tournoi existe,
   - elle vérifie que les inscriptions sont ouvertes. fileciteturn5file0

3. **Calcul du montant Stripe**
   - le prix du tournoi (`prix_joueur`) est converti en cents grâce à `toStripeAmount()`. fileciteturn5file0

4. **Création des metadata Stripe**
   - les informations nécessaires à l'inscription sont copiées dans `metadata`,
   - les mêmes metadata sont également placées dans `payment_intent_data.metadata`. fileciteturn5file0

5. **Création de la session Stripe**
   - appel à `stripe.checkout.sessions.create(...)`,
   - création d'un produit libellé `Inscription tournoi de golf - ${tournoi.nom}`,
   - définition de `success_url` et `cancel_url`. fileciteturn5file0

6. **Création d'un paiement EN_ATTENTE**
   - le système appelle `createPaiementEnAttente(...)`,
   - un enregistrement est créé dans la table `paiements` avec :
     - `tournoi_id`,
     - `montant_cents`,
     - `stripe_session_id`,
     - `statut = 'EN_ATTENTE'`. fileciteturn5file0

7. **Réponse au frontend**
   - la route retourne `200` avec :
     - `url`,
     - `sessionId`. fileciteturn5file0

---

## 3.2 Flux de retour utilisateur

Après le paiement ou l'annulation, Stripe redirige l'utilisateur vers l'une des deux URL suivantes :

- succès : `FRONTEND_URL/paiement/succes?session_id={CHECKOUT_SESSION_ID}`
- annulation : `FRONTEND_URL/paiement/annule` fileciteturn5file0

### Interprétation du retour

Le retour frontend est utile pour l'expérience utilisateur, mais **il ne constitue pas la preuve finale du paiement**.  
La source de vérité du paiement est le **webhook Stripe**, pas la redirection navigateur.

Le frontend peut ensuite appeler `GET /payments/confirmation?session_id=...` pour récupérer l'état du paiement, du participant et de l'équipe. fileciteturn5file0

---

## 3.3 Flux webhook

Le webhook Stripe est géré par `POST /payments/webhook`. fileciteturn5file0

### Étapes du traitement

1. **Lecture de la signature Stripe**
   - récupération de `stripe-signature` dans les headers,
   - lecture de `STRIPE_WEBHOOK_SECRET`. fileciteturn5file0

2. **Validation de la signature**
   - appel à `stripe.webhooks.constructEvent(req.body, signature, webhookSecret)`,
   - si la signature est invalide, la route retourne `400`. fileciteturn5file0

3. **Traitement des événements**
   - `checkout.session.completed`
   - `checkout.session.expired` fileciteturn5file0

### Cas `checkout.session.completed`

Quand Stripe confirme qu'une session de checkout est terminée :

1. la route récupère `stripeSessionId` et `paymentIntentId`, fileciteturn5file0
2. elle recherche le paiement local avec `findPaiementByStripeSessionId(...)`, fileciteturn5file0
3. si le paiement n'existe pas, elle retourne `404`, fileciteturn5file0
4. si le paiement est déjà `PAYEE`, elle retourne `200` pour éviter un double traitement, fileciteturn5file0
5. elle relit éventuellement les metadata du `payment_intent`, fileciteturn5file0
6. elle fusionne les metadata avec `normalizeMetadata(...)`, fileciteturn5file0
7. elle vérifie les metadata minimales avec `hasRequiredMetadata(...)`, fileciteturn5file0
8. si les metadata sont incomplètes, elle appelle `markPaiementEchec(...)` puis retourne `400`, fileciteturn5file0
9. sinon elle déclenche :
   - `inscriptionCreerEquipe(...)` si `option_equipe === "creer"`,
   - `inscriptionRejoindreEquipe(...)` si `option_equipe === "rejoindre"`. fileciteturn5file0
10. si l'inscription échoue côté métier, elle marque le paiement en `ECHEC`, fileciteturn5file0
11. si tout se passe bien, elle marque le paiement en `PAYEE` avec `markPaiementPaye(...)` et associe le `participant_id`. fileciteturn5file0

### Cas `checkout.session.expired`

Quand la session Stripe expire :

- la route appelle `markPaiementEchec(...)`,
- le statut du paiement devient `ECHEC`. fileciteturn5file0

---

## 4. Statuts de paiement

L'implémentation actuelle utilise trois statuts métier.

### 4.1 `EN_ATTENTE`

Ce statut est créé dès que la session Stripe est générée, avant le paiement final.  
Il est inséré par `createPaiementEnAttente(...)`. fileciteturn5file0

Cela signifie :

- le client a commencé le processus de paiement,
- mais Stripe n'a pas encore confirmé le succès final.

### 4.2 `PAYEE`

Ce statut est appliqué dans le webhook après :

- réception de `checkout.session.completed`,
- validation des metadata,
- création réussie de l'inscription,
- mise à jour du paiement avec `markPaiementPaye(...)`. fileciteturn5file0

Cela signifie :

- le paiement est confirmé,
- l'inscription a été créée,
- le participant est lié au paiement.

### 4.3 `ECHEC`

Ce statut est appliqué si :

- la session Stripe expire,
- les metadata Stripe sont incomplètes,
- une erreur métier se produit après paiement,
- un traitement n'aboutit pas correctement. fileciteturn5file0

Le passage à `ECHEC` est fait via `markPaiementEchec(...)`.

---

## 5. Rôle précis du DAL

Le fichier `dal/payments.repository.js` joue un rôle central dans la persistance des paiements.

### `createPaiementEnAttente(...)`

Crée la ligne initiale dans `paiements` avec :

- `tournoi_id`,
- `participant_id = NULL`,
- `commandite_id = NULL`,
- `montant_cents`,
- `devise = 'cad'`,
- `stripe_session_id`,
- `statut = 'EN_ATTENTE'`. fileciteturn5file0

### `findTournoiForPayment(...)`

Récupère les informations minimales du tournoi :

- `id`,
- `nom`,
- `prix_joueur`,
- `inscriptions_ouvertes`. fileciteturn5file0

Cette lecture permet à la route de vérifier le contexte avant d'appeler Stripe.

### `findPaiementByStripeSessionId(...)`

Retrouve un paiement déjà créé à partir de la session Stripe.  
Cette fonction est utilisée dans le webhook pour reprendre le traitement du paiement. fileciteturn5file0

### `markPaiementEchec(...)`

Met à jour :

- `statut = 'ECHEC'`,
- `stripe_payment_intent_id`. fileciteturn5file0

### `markPaiementPaye(...)`

Met à jour :

- `statut = 'PAYEE'`,
- `stripe_payment_intent_id`,
- `participant_id`. fileciteturn5file0

### `findConfirmationBySessionId(...)`

Retourne toutes les données utiles à l'écran de confirmation :

- informations du paiement,
- participant,
- équipe reliée via `membres_equipes`. fileciteturn5file0

---

## 6. Sécurité

## 6.1 Vérification de signature Stripe

Le webhook utilise `stripe.webhooks.constructEvent(...)` avec la signature reçue et `STRIPE_WEBHOOK_SECRET`.  
Cela empêche qu'une requête externe non signée soit traitée comme un vrai webhook Stripe. fileciteturn5file0

## 6.2 Secret Stripe dans les variables d'environnement

Le module dépend de :

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `FRONTEND_URL` fileciteturn5file0

La clé secrète Stripe est vérifiée dès le chargement du module. Si elle manque, une erreur est levée. fileciteturn5file0

## 6.3 Le webhook comme source de vérité

Le code actuel respecte une bonne pratique importante :  
le paiement n'est réellement validé qu'au moment du webhook, pas au moment de la redirection du navigateur. fileciteturn5file0

## 6.4 Prévention du double traitement

Le webhook vérifie :

- si le paiement existe,
- si le statut est déjà `PAYEE`. fileciteturn5file0

Cela limite le risque de traiter plusieurs fois le même événement Stripe.

## 6.5 Point d'attention technique

Pour Stripe, `req.body` du webhook doit normalement être reçu en **raw body** dans Express, sinon la vérification de signature peut échouer.  
Ce point ne se voit pas directement dans `payments.routes.js`, car il dépend généralement de la configuration de `server.js`. C'est donc une exigence de configuration à documenter.

---

## 7. Configuration requise

## 7.1 Variables d'environnement

Le module nécessite au minimum :

```env
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
FRONTEND_URL=http://localhost:5173
```

### Rôle de chaque variable

- `STRIPE_SECRET_KEY` : permet d'initialiser le client Stripe serveur,
- `STRIPE_WEBHOOK_SECRET` : permet de valider la signature du webhook,
- `FRONTEND_URL` : permet de construire les URL de retour succès et annulation. fileciteturn5file0

## 7.2 Configuration Express recommandée

Pour que le webhook fonctionne correctement, la route webhook doit recevoir le body brut.  
Exemple recommandé dans `server.js` :

```js
app.use("/payments/webhook", express.raw({ type: "application/json" }));
app.use(express.json());
```

Sans cela, Stripe peut retourner une erreur de signature.

---

## 8. Critères d'acceptation (AC)

Les critères suivants décrivent ce que ton code actuel fait.

### AC1 — Création de session valide

Quand le frontend envoie des données valides pour une inscription, l'API crée une session Stripe et retourne `200` avec `url` et `sessionId`. fileciteturn5file0

### AC2 — Validation des données

Si `tournoi_id`, `prenom`, `nom` ou `courriel` sont absents ou invalides, la route retourne `400`. fileciteturn5file0

### AC3 — Validation email

Si le courriel n'est pas valide, la route retourne `400`. fileciteturn5file0

### AC4 — Validation du mode équipe

Si `optionEquipe` n'est ni `creer` ni `rejoindre`, la route retourne `400`. fileciteturn5file0

### AC5 — Nom d'équipe obligatoire en création

Si `optionEquipe === "creer"` et que `nom_equipe` est vide, la route retourne `400`. fileciteturn5file0

### AC6 — Code d'équipe obligatoire en rejoindre

Si `optionEquipe === "rejoindre"` et que `code_equipe` est vide, la route retourne `400`. fileciteturn5file0

### AC7 — Tournoi introuvable

Si le tournoi n'existe pas, la route retourne `404`. fileciteturn5file0

### AC8 — Inscriptions fermées

Si `inscriptions_ouvertes` est faux, la route retourne `400`. fileciteturn5file0

### AC9 — Prix invalide

Si `prix_joueur` est nul, négatif ou invalide pour Stripe, la route retourne `400`. fileciteturn5file0

### AC10 — Paiement en attente créé

Lors de la création de la session Stripe, un paiement `EN_ATTENTE` est créé dans la base. fileciteturn5file0

### AC11 — Paiement confirmé par webhook

Lors d'un `checkout.session.completed`, le système met à jour le paiement et crée l'inscription. fileciteturn5file0

### AC12 — Paiement expiré

Lors d'un `checkout.session.expired`, le paiement passe à `ECHEC`. fileciteturn5file0

### AC13 — Confirmation disponible

Le frontend peut récupérer la confirmation par `session_id` avec le paiement, le participant et l'équipe. fileciteturn5file0

---

## 9. Tests à prévoir

## 9.1 Tests sur `POST /payments/create-checkout-session`

- données manquantes -> `400`
- email invalide -> `400`
- option d'équipe invalide -> `400`
- nom d'équipe manquant en mode créer -> `400`
- code d'équipe manquant en mode rejoindre -> `400`
- tournoi introuvable -> `404`
- inscriptions fermées -> `400`
- prix invalide -> `400`
- session Stripe créée avec succès -> `200` + création du paiement en attente

## 9.2 Tests sur `POST /payments/webhook`

- secret webhook absent -> `500`
- signature invalide -> `400`
- paiement introuvable -> `404`
- paiement déjà traité -> `200`
- metadata incomplète -> `400` + passage à `ECHEC`
- succès en mode créer -> `200` + passage à `PAYEE`
- succès en mode rejoindre -> `200` + passage à `PAYEE`
- erreur métier dans l'inscription -> `4xx` + passage à `ECHEC`
- événement `checkout.session.expired` -> `200` + passage à `ECHEC`

## 9.3 Tests sur `GET /payments/confirmation`

- `session_id` manquant -> `400`
- confirmation introuvable -> `404`
- confirmation trouvée -> `200`

## 9.4 Tests DAL

- insertion d'un paiement en attente,
- lecture d'un tournoi,
- lecture d'un paiement par session,
- mise à jour en `ECHEC`,
- mise à jour en `PAYEE`,
- lecture de la confirmation finale.

---

## 10. Erreurs possibles

Voici les principales erreurs possibles dans le module actuel.

### Erreurs de configuration

- `STRIPE_SECRET_KEY` manquante,
- `STRIPE_WEBHOOK_SECRET` manquant,
- `FRONTEND_URL` incorrecte,
- webhook non configuré avec raw body.

### Erreurs de validation

- données d'inscription manquantes,
- courriel invalide,
- option équipe invalide,
- nom d'équipe manquant,
- code d'équipe manquant,
- `tournoi_id` invalide.

### Erreurs métier

- tournoi inexistant,
- inscriptions fermées,
- prix du joueur invalide,
- metadata Stripe incomplète,
- paiement Stripe introuvable localement,
- erreur lors de `inscriptionCreerEquipe(...)`,
- erreur lors de `inscriptionRejoindreEquipe(...)`.

### Erreurs techniques

- erreur Stripe pendant la création de session,
- erreur Stripe lors de la relecture du `payment_intent`,
- erreur base de données dans le DAL,
- erreur SQL lors de la mise à jour du statut,
- incohérence entre Stripe et la base locale.

---

## 11. Points forts de ce que tu as fait

Par rapport au code actuel, il y a plusieurs bons choix techniques :

1. **Bonne séparation des responsabilités**
   - la route ne contient plus de SQL direct,
   - le DAL centralise les requêtes. fileciteturn5file0

2. **Utilisation correcte de Stripe Checkout**
   - session de paiement créée côté serveur,
   - metadata envoyées à Stripe. fileciteturn5file0

3. **Validation d'entrée côté backend**
   - ce qui évite de dépendre uniquement du frontend. fileciteturn5file0

4. **Workflow robuste avec webhook**
   - la validation finale passe bien par le webhook. fileciteturn5file0

5. **Gestion des statuts claire**
   - `EN_ATTENTE`, `PAYEE`, `ECHEC`. fileciteturn5file0

6. **Préparation au test**
   - DAL séparé,
   - logique de route identifiable,
   - points de mock bien clairs.

---

## 12. Limites ou points d'amélioration possibles

Sans changer ton code, voici les points qu'on peut noter dans la documentation.

- Les fonctions utilitaires pourraient être extraites dans un fichier `utils`.
- La gestion des logs pourrait être uniformisée.
- La configuration webhook doit être explicitement vérifiée dans le serveur Express.
- Une gestion plus explicite de l'idempotence Stripe pourrait être documentée davantage.
- Certains messages pourraient être centralisés dans des constantes si le projet grossit.

Ces points sont des améliorations possibles, mais ils ne remettent pas en cause la qualité générale de ce que tu as déjà fait.

---

## 13. Conclusion

Le module de paiement que tu as mis en place est bien structuré et cohérent avec une architecture backend propre.  
Le flux Stripe est correctement découpé entre :

- création de session,
- redirection utilisateur,
- confirmation réelle par webhook,
- consultation finale par session Stripe. fileciteturn5file0

La séparation entre `payments.routes.js` et `payments.repository.js` est pertinente et facilite :

- la maintenance,
- les tests automatisés,
- la compréhension du flux,
- la documentation du système.

Cette documentation décrit fidèlement ce que ton code fait actuellement, sans modifier ton implémentation. fileciteturn5file0
