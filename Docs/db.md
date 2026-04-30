# Base de donnees (PostgreSQL)

## Fichiers de reference

- schema initial : `backend/db/init/01_schema.sql`
- migrations : `backend/db/migrations/*.sql`

## Lancement rapide (Docker recommande)

```bash
docker compose up -d
```

Reset complet local :

```bash
docker compose down -v
docker compose up -d
```

## Ports

- avec le `docker compose` du projet : `DB_PORT=5433`
- avec PostgreSQL local (sans Docker) : souvent `DB_PORT=5432`

Configurer `backend/.env` selon votre environnement.

## Migrations existantes

1. `update_table_tournois.sql`
2. `add_prix_joueur_tournois.sql`
3. `add_joueurs_commandites.sql`
4. `add_joueur_commandite_participant_id.sql`
5. `add_types_commandites_description.sql`
6. `remove_types_commandites_quota_zero.sql`
7. `fix_paiements_xor_and_commandites_statut.sql`
8. `add_participant_types_employe_retraite.sql`

## Commandes migration

Bash (Docker) :

```bash
docker compose exec -T postgres psql -U postgres -d tournoi_golf < backend/db/migrations/NOM_DU_FICHIER.sql
```

PowerShell (Docker) :

```powershell
Get-Content -Raw backend\db\migrations\NOM_DU_FICHIER.sql | docker compose exec -T postgres psql -U postgres -d tournoi_golf
```

Sans Docker :

```bash
psql -h localhost -p 5432 -U postgres -d tournoi_golf -f backend/db/migrations/NOM_DU_FICHIER.sql
```

## Verifications utiles

```sql
SELECT DISTINCT statut FROM commandites ORDER BY 1;
SELECT DISTINCT type_participant FROM participants ORDER BY 1;
```

Attendu :
- `commandites.statut` : `EN_ATTENTE`, `PAYEE`, `ECHEC`
- `participants.type_participant` : `EMPLOYE`, `RETRAITE`, `EMPLOYE_RETRAITE`, `JOUEUR_COMMANDITE`

## Tests lies a la base de donnees

Tests backend qui valident les regles SQL et metier :
- `backend/__tests__/test-jest/inscriptionTournoi.repository.test.js`
- `backend/__tests__/test-jest/payments.repository.test.js`
- `backend/__tests__/test-jest/types-commandites.repository.test.js`
- `backend/__tests__/test-jest/public.routes.test.js`

Points verifies :
- contraintes de capacite et d'unicite
- coherence des paiements (participant/commandite)
- application des quotas commandites
- mapping des erreurs SQL vers des messages metier

Commande :
```bash
cd backend
npm test
```
