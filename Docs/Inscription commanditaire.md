# Inscription commanditaire

## Public

- **GET** `/public/types-commandites?tournoi_id=ID` — formules du tournoi.
- **POST** `/public/inscription/commanditaire` — body : `tournoi_id`, `prenom`, `nom`, `courriel`, `telephone?`, `nom_entreprise?`, `type_commandite_id` ou `type_commandite_ids[]`. Réponse **201** + commandites créées.

Règles : tournoi existant, inscriptions ouvertes, types du tournoi, quotas type + `limite_commandites`, contact valide — le tout en transaction.

Règles de comptage actuelles (important) :
- Les commandites **EN_ATTENTE** ne bloquent plus les places.
- Les contrôles de quota/places lors de l'inscription commanditaire comptent
  uniquement les commandites **PAYEE**.
- Le quota par type et la limite tournoi s'appliquent sur les places joueurs
  réellement payées.

Précision quota tournoi :
- `limite_commandites` correspond au total maximal de joueurs commandités alloués par les types.
- Calcul applique côté admin/types : `somme(quota * places_incluses) <= limite_commandites`.
- Exemple : limite tournoi = 8, type Or (quota 2, places 2), type Argent (quota 4, places 1) -> `2*2 + 4*1 = 8` (valide).
- En modification admin du tournoi, `limite_commandites` ne peut pas descendre
  sous les places commanditées déjà utilisées (commandites `PAYEE`).

**Frontend :** `frontend/src/pages/InscriptionTournoi.jsx` (chargement types, POST réel, fallback si types KO).

**Tests :** `backend/__tests__/test-jest/public.routes.test.js`, `frontend/src/pages/InscriptionTournoi.test.jsx`.

---

## Données — `joueurs_commandites`

Une ligne par joueur nominatif ; `commandite_id` → `commandites`. **`participant_id`** : rempli quand l’admin affecte à une équipe. Schéma `backend/db/init/01_schema.sql` ; migration si besoin : `backend/db/migrations/add_joueur_commandite_participant_id.sql`.

---

## Admin — liste joueurs (`/admin/equipes`)

**Fichier :** `frontend/src/pages/AdminEquipes.jsx`.

- Liste = joueurs **sans** ligne dans `membres_equipes` (plus affichés après affectation). DAL : `listJoueursCommanditesAdmin`.
- Filtre **Tournoi** (ouverts aux inscriptions), panneau **droite sticky** (&lt;1100px : au-dessus des équipes), **Rafraîchir**.
- Actions : éditer prénom/nom, supprimer, **glisser-déposer** sur une carte équipe du **même tournoi** (max 4 membres).

### API (`/admin/...`, session admin)

| Méthode | Chemin | Corps / query | À retenir |
|--------|--------|----------------|-----------|
| GET | `/joueurs-commandites` | `tournoi_id?` (entier > 0) | Sans filtre = tournois ouverts. **400** si `tournoi_id` invalide. |
| PATCH | `/joueurs-commandites/:id` | `{ prenom, nom }` | **404** introuvable, **409** tournoi fermé. |
| DELETE | `/joueurs-commandites/:id` | — | Supprime ligne + participant lié si présent. |
| POST | `/joueurs-commandites/:id/assigner-equipe` | `{ equipe_id }` | Même tournoi, équipe non pleine. Crée participant `JOUEUR_COMMANDITE` ou déplace. **Courriel** : `courriel_contact` si libre sur le tournoi, sinon `local+jc<id>@domaine`, sinon `jc…@commandite.local`. Téléphone : `telephone_contact` si renseigné. |

Validateurs : `validateJoueurCommanditeIdentitePayload`, `validateAssignJoueurCommanditeEquipePayload` (`backend/validators/equipes.validator.js`).

**Tests :** `admin.equipes.routes.test.js` (bloc joueurs commandités), `equipes.validator.test.js`, `AdminEquipes.test.jsx`.

---

## Admin — commandites inscrites (`/admin/commandites`)

**Page :** `frontend/src/pages/GestionCommandites.jsx` (menu *Commandites inscrites*).

- **Tournoi** : liste déroulante limitée aux tournois **ouverts aux inscriptions** ; `tournoi_id` **obligatoire** pour charger la liste (`GET /admin/commandites?tournoi_id=`).
- **Tableau** : entreprise, contact, courriel, type de forfait, **statut** (`EN_ATTENTE` / `PAYEE` / `ECHEC`), date, nombre de joueurs nominatifs.
- **Clic sur une ligne** : chargement du **détail** (`GET /admin/commandites/:id`) — modal d’édition : entreprise, contact, courriel, téléphone, **changement de forfait** (`type_commandite_id`, quotas respectés côté API), **statut de paiement** (liste déroulante : en attente / payée / échec — mise à jour manuelle après vérification hors écran, ex. virement ou tableau de bord Stripe si vous l’utilisez ailleurs).
- **Joueurs nominatifs** dans le modal : autant de champs que `places_incluses` du type choisi ; enregistrement avec le **PUT**.
- **Supprimer** : confirmation ; `DELETE` sur `commandites` — **cascade** : `joueurs_commandites` et lignes **`paiements`** avec `commandite_id` (voir `01_schema.sql`).

### API (`/admin/commandites`, session admin)

| Méthode | Chemin | Remarques |
|--------|--------|-----------|
| GET | `/` | Query **`tournoi_id`** obligatoire (entier > 0). **400** sinon. |
| GET | `/:id` | Détail + tableau `joueurs`. **404** si introuvable. |
| PUT | `/:id` | Body validé par `validateUpdateCommanditePayload` : `nom_entreprise`, `nom_contact`, `courriel_contact`, `telephone_contact?`, **`statut`** (`EN_ATTENTE` \| `PAYEE` \| `ECHEC`), `type_commandite_id`, `joueurs[]` optionnel (`{ prenom, nom }`). Conflits de noms joueurs vs autres inscrits du tournoi gérés côté DAL. |
| DELETE | `/:id` | **404** si déjà absente. |

**Backend :** `backend/routes/admin.commandites.routes.js`, `backend/dal/admin.commandites.repository.js`, `backend/validators/commandites.admin.validator.js`.

**Voir aussi :** `Docs/Administration des équipes.md`, migrations dans `README.md`.
