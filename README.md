# Tournoi de Golf - Projet Web

Application web permettant de gérer un tournoi de golf (Frontend + Backend), avec inscription des joueurs, gestion des équipes, administration du tournoi, et simulation de paiement via Stripe en mode test.

---

## Equipe projet

- Sanaa Kaouthar Rahem
- Ali Squali
- Meriem Ouachour

## Prérequis

- Git
- Node.js (LTS recommandée) + npm
- Docker Desktop recommandé
- PostgreSQL si vous ne passez pas par Docker
- Un compte Stripe en **mode test / sandbox**
- Stripe CLI pour tester les webhooks en local

> Remarque :
> Stripe CLI peut être installé sur Windows en téléchargeant le fichier `windows` zip depuis les releases GitHub officielles, puis en ajoutant le dossier contenant `stripe.exe` au `Path`. Stripe documente aussi une installation via Scoop.

---

## Dépendances / configuration (Backend)

### 1) Créer le fichier `backend/.env`

Depuis la racine du dépôt, créez manuellement le fichier `backend/.env`.

Exemple recommandé :

```env
PORT=3000

DB_HOST=localhost
DB_PORT=5433
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=tournoi_golf

STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxxxxxxxxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxx
FRONTEND_URL=http://localhost:5173
BACKEND_URL=http://localhost:3000
```

### 2) Vérifier les valeurs PostgreSQL

Dans cette version du projet, **Docker** expose PostgreSQL sur le port **5433** pour éviter les conflits avec une installation PostgreSQL locale.

Valeurs attendues **avec Docker** (`docker compose up`) :

- `DB_HOST=localhost`
- `DB_PORT=5433`
- `DB_NAME=tournoi_golf`
- `DB_USER=postgres`
- `DB_PASSWORD=postgres`

Si un membre de l’équipe utilise **PostgreSQL installé sur sa machine** (sans Docker pour la base), il adopte en général **`DB_PORT=5432`**. Le fichier `backend/.env` reste **personnel** (non versionné) : chacun met le port qui correspond à son environnement. Voir aussi `Docs/db.md`.

---

## Base de données PostgreSQL

Le schéma principal est dans `backend/db/init/01_schema.sql`.
Ce script crée les tables, contraintes, index et l'utilisateur admin par défaut.

### Structure BDD du projet

```text
backend/db/
├── init/
│   └── 01_schema.sql
└── migrations/
    ├── update_table_tournois.sql
    ├── add_prix_joueur_tournois.sql
    ├── add_joueurs_commandites.sql
    ├── add_joueur_commandite_participant_id.sql
    ├── add_types_commandites_description.sql
    ├── remove_types_commandites_quota_zero.sql
    ├── fix_paiements_xor_and_commandites_statut.sql
    └── add_participant_types_employe_retraite.sql
```

### Option A - PostgreSQL avec Docker (recommandé)

Depuis la racine du projet :

```bash
docker compose up -d
```

Au premier démarrage, Docker exécute automatiquement les scripts présents dans `backend/db/init/`.

Vérifier que PostgreSQL répond :

```bash
docker compose exec postgres psql -U postgres -d tournoi_golf -c "SELECT now();"
```

### Réinitialiser complètement la BDD Docker (si nécessaire)

```bash
docker compose down -v
docker compose up -d
```

> Attention : `down -v` supprime les données locales de la base.

### Option B - PostgreSQL sans Docker

1. Démarrer PostgreSQL local.
2. Créer la base :

```sql
CREATE DATABASE tournoi_golf;
```

3. Appliquer le schéma initial :

```bash
psql -h localhost -p 5432 -U postgres -d tournoi_golf -f backend/db/init/01_schema.sql
```

4. Vérifier les tables :

```sql
\dt
```

### Migrations SQL (`backend/db/migrations/`)

À exécuter depuis la racine du repo.

**Bash (Docker) :**

```bash
docker compose exec -T postgres psql -U postgres -d tournoi_golf < backend/db/migrations/NOM_DU_FICHIER.sql
```

**PowerShell (Docker) :**

```powershell
Get-Content -Raw backend\db\migrations\NOM_DU_FICHIER.sql | docker compose exec -T postgres psql -U postgres -d tournoi_golf
```

**Sans Docker :**

```bash
psql -h localhost -p 5432 -U postgres -d tournoi_golf -f backend/db/migrations/NOM_DU_FICHIER.sql
```

### Ordre recommandé des migrations (base existante ancienne)

1. `update_table_tournois.sql`
2. `add_prix_joueur_tournois.sql`
3. `add_joueurs_commandites.sql`
4. `add_joueur_commandite_participant_id.sql`
5. `add_types_commandites_description.sql`
6. `remove_types_commandites_quota_zero.sql`
7. `fix_paiements_xor_and_commandites_statut.sql`
8. `add_participant_types_employe_retraite.sql`

Les migrations sont conçues pour être rejouables autant que possible (`IF EXISTS`, `IF NOT EXISTS`).

### Vérifications rapides après migration

```sql
-- Vérifier les valeurs de statut commandite
SELECT DISTINCT statut FROM commandites ORDER BY 1;

-- Vérifier les types participant autorisés
SELECT DISTINCT type_participant FROM participants ORDER BY 1;
```

Détail technique complémentaire : `Docs/db.md`.

---

## Installation des dépendances

### Backend

```bash
cd backend
npm install
```

### Frontend

```bash
cd ../frontend
npm install
```

---

## Démarrer l'application

### Backend

Dans un terminal :

```bash
cd backend
npm run dev
```

Backend : `http://localhost:3000`

### Frontend

Dans un second terminal :

```bash
cd frontend
npm run dev
```

Frontend : `http://localhost:5173`

---

## Accès administrateur

La base initialise un admin par défaut via le script SQL :

- Utilisateur : `admin`
- Mot de passe : `Admin123!`

Page de connexion :

```text
http://localhost:5173/admin
```

---

# Configuration Stripe (mode test)

## 1) Récupérer la clé secrète Stripe

Connectez-vous à votre Dashboard Stripe en **mode test / sandbox**, puis allez dans :

```text
Developers > API keys
```

Copiez la **Secret key** de test qui commence par :

```text
sk_test_
```

Ajoutez-la dans :

```env
STRIPE_SECRET_KEY=sk_test_...
```

## 2) Installer Stripe CLI

### Windows
Méthode recommandée :
1. Télécharger le fichier `windows` zip depuis les releases Stripe CLI. Lien : https://github.com/stripe/stripe-cli/releases/download/v1.39.0/stripe_1.39.0_windows_x86_64.zip
2. Dézipper l’archive.
3. Mettre `stripe.exe` dans un dossier, par exemple :

```text
C:\stripe-cli\
```

4. Ajouter ce dossier au `Path`:
Ouvre le menu Démarrer
Tape variables d’environnement
Clique sur Modifier les variables d’environnement système
Dans la fenêtre qui s’ouvre, clique sur Variables d’environnement...
cherche la ligne Path
clique dessus
clique sur Modifier
clique sur Nouveau
ajoute : C:\stripe\
clique sur OK
reclique sur OK
ferme puis rouvre ton terminal

### Vérifier l’installation

Dans un nouveau terminal :

```bash
stripe --version
```

Si `stripe` n’est pas reconnu dans Git Bash, vous pouvez utiliser directement :

```bash
/c/stripe-cli/stripe.exe --version
```

---

## 3) Connecter Stripe CLI à votre compte

Dans un terminal :

```bash
/c/stripe-cli/stripe.exe login
```

Puis :
- appuyez sur **Enter**
- validez l’autorisation dans le navigateur

---

## 4) Écouter les webhooks Stripe en local

Dans un autre terminal, lancez :

```bash
/c/stripe-cli/stripe.exe listen --forward-to localhost:3000/payments/webhook

ou

stripe listen --api-key sk_test_51TL5tyRqIqyukWEabZX2yruPxDkUZTkj4PmSJpdRY4l9FmvC7Wb8D2hkuuhtVE6btkIZXbJT0DSwrXfRlNKgzl4l00VI0HZrDP --forward-to localhost:3000/payments/webhook
```

Cette commande :
- relaie les événements Stripe vers votre backend local
- retourne un **webhook signing secret** commençant par `whsec_...` à copier dans `backend/.env`

Exemple de sortie :

```text
Ready! Your webhook signing secret is whsec_xxxxxxxxxxxxx
```

Ajoutez cette valeur dans :

```env
STRIPE_WEBHOOK_SECRET=whsec_...
```

Puis redémarrez le backend :

```bash
cd backend
npm run dev
```

---

## 5) Lancer l’application pour les tests Stripe

Gardez **3 éléments actifs** :

### Terminal 1 - Backend

```bash
cd backend
npm run dev
```

### Terminal 2 - Frontend

```bash
cd frontend
npm run dev
```

### Terminal 3 - Stripe CLI

```bash
/c/stripe-cli/stripe.exe listen --forward-to localhost:3000/payments/webhook

ou

stripe listen --api-key sk_test_xxxxxxxxxxxxxxxxxxxxx --forward-to localhost:3000/payments/webhook
```

---

## 6) Tester un paiement Stripe

Le projet utilise Stripe en **mode test**. Les transactions test ne déplacent pas de vrai argent.

### Carte de test recommandée

Utilisez :

- **Numéro** : `4242 4242 4242 4242`
- **Date** : `12/34`
- **CVC** : `123`

---

## Fonctionnement Stripe dans ce projet

### Cas joueur - créer une équipe
1. Le joueur remplit le formulaire d’inscription.
2. Il choisit **Créer une équipe**.
3. Il paie via Stripe Checkout.
4. Après paiement réussi, le webhook Stripe :
   - crée le participant
   - crée l’équipe
   - génère le code d’équipe
   - lie le paiement au participant
5. La page de confirmation affiche le **code de l’équipe** à partager.

### Cas joueur - rejoindre une équipe
1. Le joueur entre un **code d’équipe existant**.
2. Il paie via Stripe.
3. Après paiement réussi, le webhook l’ajoute à l’équipe correspondante.

---

## Pages Stripe utilisées côté frontend

- `/paiement/succes`
- `/paiement/annule`

### `/paiement/succes`
Cette page :
- affiche la confirmation du paiement
- affiche le montant
- affiche le participant
- affiche le **code de l’équipe** si une équipe a été créée
- permet d’imprimer un ticket

### `/paiement/annule`
Cette page informe l’utilisateur que le paiement a été annulé ou interrompu.

---

## Tests automatisés

### Frontend (Vitest)

```bash
cd frontend
npm run test
```

### Backend (Jest)

```bash
cd backend
npm test
```

---

## Notes importantes 

### Si Stripe CLI n’est pas dans le Path
Utilisez directement :

```bash
/c/stripe-cli/stripe.exe listen --forward-to localhost:3000/payments/webhook
```

au lieu de :

```bash
stripe listen --forward-to localhost:3000/payments/webhook
```

### Si PostgreSQL local entre en conflit avec Docker
Le projet utilise par défaut :

```env
DB_PORT=5433
```

et dans `docker-compose.yml` :

```yaml
ports:
  - "5433:5432"
```

### Si le webhook ne fonctionne pas
Vérifiez :
- que `STRIPE_WEBHOOK_SECRET` est bien celui renvoyé par `stripe listen`
- que le terminal Stripe CLI est bien resté ouvert
- que le backend tourne bien sur `http://localhost:3000`

---

## Videos de demonstration

- [Demo - Creation tournoi](Docs/video/creation%20tournoi.mp4)
- [Demo - Gestion des equipes](Docs/video/gestion%20des%20equipes.mp4)
- [Demo - Types commandite et commandites inscrites](Docs/video/types%20Commandite-Commandite%20Inscrit.mp4)
- [Demo - Inscription commanditaire](Docs/video/inscription%20commanditaire.mp4)
- [Demo - Inscription en creant une equipe](Docs/video/inscription%20en%20creant%20une%20equipe.mp4)
- [Demo - Inscription en rejoignant une equipe](Docs/video/inscription%20en%20rejoignamt%20une%20equipe.mp4)
- [Demo - Gestion admin](Docs/video/gestion%20admin.mp4)
- [Demo - Page publique Sponsors](Docs/video/Page%20public%20sponsors.mp4)

---

