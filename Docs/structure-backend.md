# Backend Express : structure + middlewares + health check

## Objectif

Mettre en place un backend Express fonctionnel, bien structuré, avec :

- un point d’entrée unique (`server.js`)
- des middlewares de base (JSON, cookies, CORS)
- une route de test `/health` (et `/` si présent)
- une vérification via navigateur / frontend / console

---

# 1) Structure backend

## Choix d’architecture

Nous avons gardé **un seul point d’entrée** : `backend/server.js`.

Pourquoi ?

- On travaille à 3 sur le projet : avoir un fichier principal unique évite de se perdre.
- Les routes restent séparées dans des fichiers dédiés (`/routes`) pour alléger `server.js`.

## Structure obtenue

backend/
├── server.js
├── routes/
│   ├── auth.routes.js
│   ├── admin.routes.js
│   └── tournois.routes.js
├── middlewares/
└── db/

---

# 2) Middlewares de base

## express.json()

Permet de lire les données JSON envoyées par le frontend (ex : formulaire login).

Exemple : `req.body` accessible.

## cookie-parser

Permet de lire les cookies envoyés par le navigateur.

Utile pour la gestion de session admin (cookies httpOnly).

## CORS

Permet au frontend (`http://localhost:5173`) d’appeler le backend (`http://localhost:3000`).

Configuration utilisée :

- `origin` : autoriser `http://localhost:5173` et `http://127.0.0.1:5173`
- `credentials: true` : autoriser l’envoi/réception de cookies

---

# 3) Route de santé

## Route /health

But : vérifier rapidement que le serveur Express fonctionne.

Réponse attendue :

- status 200
- JSON : `{ "status": "ok" }`

## Route /

On a aussi gardé `/` comme test simple (health check basique).

Réponse attendue :

- status 200
- texte `"OK"`

Pourquoi garder les deux ?

- `/` est un test très simple (réponse texte).
- `/health` est plus standard côté API (réponse JSON), souvent utilisé en production/monitoring.

---

# 4) Handler 404

Si l’utilisateur appelle une route inexistante, le serveur répond :

- status 404
- JSON : `{ "message": "Route introuvable" }`

Cela permet de valider que le routing est correct et que le backend ne “crash” pas.

---

# 5) Tests automatisés (TDG-56)

Les tests manuels ont été remplacés par des tests automatisés avec Jest et Supertest.

Les tests s’exécutent en environnement `NODE_ENV=test`.

## Lancer les tests

```bash
cd backend
npm test
```

Script utilisé (`package.json`) :

```bash
"test": "cross-env NODE_OPTIONS=--experimental-vm-modules NODE_ENV=test jest"
```

## Tests API (`api-health.test.js`)

### GET /health

Vérifie :

- status 200
- `{ "status": "ok" }`

### GET /

Vérifie :

- status 200
- `"OK"`

### Route inconnue

Vérifie :

- status 404
- `{ "message": "Route introuvable" }`

---

## Tests Middlewares (`middlewares.test.js`)

### express.json()

- Envoi d’un body JSON
- Vérification de `req.body`
- JSON invalide → status 400

### cookie-parser

- Envoi de cookies via Supertest
- Vérification de `req.cookies`

### CORS

Vérification des headers :

- `Access-Control-Allow-Origin`
- `Access-Control-Allow-Credentials`
- Vérification du comportement `OPTIONS` (preflight)

---

## Résultat attendu

```bash
Test Suites: 3 passed
Tests: 8 passed
```

---

# Conclusion

Le backend Express est validé par des tests automatisés :

- Structure claire (server.js + routes séparées)
- Middlewares testés automatiquement
- Routes `/` et `/health` validées
- Gestion 404 testée
- Exécution automatique via Jest

Cette approche améliore la fiabilité et permet une validation continue du backend.