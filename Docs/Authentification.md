# Authentification (Admin) — Documentation technique

Ce document décrit la logique d’authentification administrateur du projet **Tournoi de Golf** développé avec **React**, **Express** et **PostgreSQL**.

---

## 1) Technologies utilisées

### Backend
- **Node.js + Express** : création de l’API REST.
- **PostgreSQL** : stockage des comptes administrateurs.
- **pg (Pool)** : connexion à la base de données.
- **bcrypt** : hachage sécurisé des mots de passe.
- **cookie-parser** : lecture des cookies HTTP.
- **cors** : autorise le frontend à communiquer avec le backend avec gestion des cookies.

### Frontend
- **React (Vite)** : interface utilisateur.
- **React Router** : navigation entre les pages Admin.
- **fetch** : appels HTTP vers l’API avec `credentials: "include"`.

---

## 2) Structure backend liée à l’authentification

Le backend a été organisé de manière à **séparer le code d’accès aux données des routes**.

### Fichiers principaux
- `routes/auth.routes.js`  
  Gère la connexion, la vérification de session et la déconnexion.

- `routes/admin.routes.js`  
  Gère les comptes administrateurs (CRUD).

- `middlewares/requireAdmin.js`  
  Protège les routes d’administration.

- `repositories/admin.repository.js`  
  Regroupe les requêtes SQL liées aux administrateurs.

### Intérêt de cette séparation
Cette organisation permet :
- de rendre les routes plus lisibles ;
- d’éviter de mélanger SQL et logique HTTP ;
- de faciliter la maintenance ;
- de mieux respecter les bonnes pratiques d’architecture backend.

---

## 3) Modèle de données

Table concernée : `administrateurs`

### Champs utilisés
- `id` : identifiant unique de l’administrateur
- `nom_utilisateur` : nom de connexion, unique
- `mot_de_passe_hash` : mot de passe haché avec bcrypt
- `date_creation` : date de création du compte

---

## 4) Principes de sécurité

### 4.1 Gestion des mots de passe
Les mots de passe ne sont jamais stockés en clair.

Ils sont transformés avec `bcrypt.hash(...)` avant insertion ou mise à jour dans la base de données.

### Politique appliquée
Le mot de passe doit contenir :
- au moins **8 caractères**
- au moins **1 majuscule**
- au moins **1 chiffre**
- au moins **1 caractère spécial**

---

### 4.2 Cookie de session
Après une connexion réussie, le backend crée un cookie de session nommé :

`admin_id`

### Paramètres principaux du cookie
- `httpOnly: true`  
  Le cookie n’est pas accessible en JavaScript côté navigateur.

- `sameSite: "lax"`  
  Réduit certains risques liés aux requêtes cross-site.

- `secure: process.env.NODE_ENV === "production"`  
  Le cookie est sécurisé en production (HTTPS) et reste compatible en développement local.

- `path: "/"`  
  Le cookie est disponible sur toute l’application.

### Durée de session
Le cookie de session est configuré avec une **durée de 1 heure** :

- `maxAge: 3600000` (soit `Max-Age=3600` secondes).

---

## 5) Flux fonctionnels

## 5.1 Connexion administrateur

### Frontend
Depuis la page de connexion administrateur :
- l’utilisateur saisit `nom_utilisateur` et `mot_de_passe` ;
- le frontend envoie une requête :
  - `POST /auth/login`
  - avec un corps JSON
  - et `credentials: "include"` pour permettre la gestion du cookie.

### Backend
Dans `auth.routes.js` :

1. validation des champs ;
2. recherche de l’administrateur via le repository ;
3. comparaison du mot de passe avec bcrypt ;
4. création du cookie `admin_id` si la connexion réussit ;
5. retour des informations minimales de l’admin connecté.

### Exemple de réponse
```json
{
  "message": "Connecté",
  "admin": {
    "id": 1,
    "nom_utilisateur": "admin1"
  }
}
```

---

## 5.2 Vérification de session

### Endpoint
`GET /auth/me`

### Rôle
Cette route permet de savoir si un administrateur est actuellement connecté.

### Fonctionnement
1. lecture du cookie `admin_id` ;
2. validation de l’identifiant ;
3. recherche de l’administrateur en base via `admin.repository.js` ;
4. retour de l’objet admin si la session est valide.

### Utilisation côté frontend
- si `GET /auth/me` réussit, l’utilisateur peut rester sur l’espace admin ;
- si la requête échoue, il est redirigé vers la page de connexion.

---

## 5.3 Déconnexion

### Endpoint
`POST /auth/logout`

### Fonctionnement
Le backend supprime le cookie de session avec :

```js
res.clearCookie("admin_id", { path: "/" })
```

Après cela, l’utilisateur n’est plus considéré comme connecté.

---

## 6) Middleware de protection : `requireAdmin`

Fichier concerné : `middlewares/requireAdmin.js`

Ce middleware protège les routes d’administration.

### Étapes de fonctionnement
1. lecture du cookie `admin_id` ;
2. validation du format de l’identifiant ;
3. appel à `findAdminById(...)` dans `admin.repository.js` ;
4. si l’admin existe :
   - ajout de `req.admin`
   - ajout de `req.adminId`
   - appel à `next()`
5. sinon :
   - réponse `401`

### Données ajoutées à la requête
- `req.admin`
- `req.adminId`

Cela permet ensuite d’utiliser facilement l’identité de l’administrateur connecté dans les routes protégées.

---

## 7) Routes protégées

Toutes les routes sensibles sous `/admin` utilisent `requireAdmin`.

### Exemples
- `GET /admin/users`
- `POST /admin/users`
- `PUT /admin/users/:id`
- `DELETE /admin/users/:id`

Ainsi, seules les sessions administrateur valides peuvent accéder à ces routes.

---

## 8) Gestion des comptes administrateurs

Fichier concerné : `routes/admin.routes.js`

Cette partie permet de gérer les comptes administrateurs.

### Fonctions disponibles
- lister les administrateurs ;
- créer un administrateur ;
- modifier un administrateur ;
- supprimer un administrateur.

### Règles métier importantes
- le hash du mot de passe est généré avec bcrypt ;
- le hash n’est jamais renvoyé au frontend ;
- un administrateur ne peut pas supprimer son propre compte ;
- il est interdit de supprimer le dernier administrateur.

### Architecture
`admin.routes.js` ne contient plus les requêtes SQL directement.  
Les opérations sur la base sont déléguées à `admin.repository.js`.

---

## 9) Repository administrateur

Fichier concerné : `repositories/admin.repository.js`

Ce fichier centralise les accès à la base de données pour la table `administrateurs`.

### Exemples de fonctions
- `findAdminByUsername(...)`
- `findAdminById(...)`
- `listAdmins()`
- `createAdmin(...)`
- `updateAdmin(...)`
- `deleteAdminById(...)`
- `countAdmins()`

### Rôle
Le repository :
- exécute les requêtes SQL ;
- retourne des données au reste du backend ;
- ne gère pas les statuts HTTP ni les réponses Express.

---

## 10) CORS et cookies

Pour que l’authentification fonctionne entre le frontend et le backend en local, il faut une configuration cohérente.

### Exemple
- Frontend : `http://localhost:5173`
- Backend : `http://localhost:3000`

### Côté backend
Le serveur doit autoriser :
- l’origine du frontend ;
- l’envoi de cookies.

Exemple :
```js
cors({
  origin: ["http://localhost:5173", "http://127.0.0.1:5173"],
  credentials: true
})
```

Le backend doit aussi utiliser :

```js
cookieParser()
```

### Côté frontend
Chaque appel qui doit envoyer ou recevoir le cookie doit utiliser :

```js
credentials: "include"
```

Sans cela, la session ne fonctionne pas correctement.

---

## 11) Configuration environnement

Fichier : `backend/.env`

### Exemple
```env
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=mot_de_passe
DB_NAME=tournoi_golf
```

Ces variables sont lues dans la configuration de base de données du backend.

---

## 12) Vérifications utiles en cas de problème

### 12.1 Erreur liée à la base de données
Exemple :
`client password must be a string`

### Causes possibles
- variable `DB_PASSWORD` absente ;
- fichier `.env` mal placé ;
- variables non chargées.

### À vérifier
- présence du fichier `.env` dans `backend/`
- bon chargement de `dotenv/config`
- valeurs correctes pour la connexion PostgreSQL

---

### 12.2 Session qui ne fonctionne pas
Ca peut venir de :
- `credentials: "include"` oublié côté frontend ;
- `credentials: true` oublié dans `cors` ;
- nom du cookie incohérent ;
- backend et frontend lancés sur les mauvais ports.

---

### 12.3 Route inaccessible
Vérifier :
- que `auth.routes.js` est bien monté dans `server.js`
- que `admin.routes.js` est bien monté dans `server.js`
- que le backend tourne bien sur le port attendu

---

## 13) Résumé

L’authentification administrateur repose sur quatre éléments principaux :

1. vérification de l’utilisateur dans PostgreSQL ;  
2. comparaison du mot de passe avec **bcrypt** ;  
3. maintien de la session grâce au cookie **httpOnly `admin_id`** ;  
4. protection des routes sensibles avec le middleware **`requireAdmin`**.

L’architecture a été améliorée pour mieux séparer les responsabilités :
- les **routes** gèrent la logique HTTP ;
- les **middlewares** gèrent la protection d’accès ;
- les **repositories** gèrent les requêtes SQL.
