# Documentation module Types de commandites

## Objectif
Permettre a l'administrateur de gerer les types de commandites d'un tournoi (creation, modification, affichage, suppression).

## Backend

Routes admin disponibles :
- `GET /admin/types-commandites`
- `GET /admin/types-commandites/:id`
- `POST /admin/types-commandites`
- `PUT /admin/types-commandites/:id`
- `DELETE /admin/types-commandites/:id`

Fichiers principaux :
- `backend/routes/types-commandites.routes.js`
- `backend/dal/types-commandites.repository.js`
- `backend/validators/types-commandites.validator.js`

Validation appliquee :
- `tournoi_id` obligatoire, entier > 0
- `nom` obligatoire, non vide, max 120 caracteres
- `prix_cents`, `places_incluses` : entiers >= 0 ; **`quota` : entier >= 1** (les types à quota 0 ne sont pas acceptés et n’apparaissent pas dans les listes API)
- limite tournoi : `limite_commandites` represente un maximum de **joueurs commandites** allouables via les types, calcule avec :
  - `total_places = somme(quota * places_incluses)` pour les types du tournoi
  - la creation / modification d’un type est refusee si `total_places` depasse `limite_commandites`

Ajout important :
- verification de l'existence du tournoi avant POST/PUT (`findTournoiById`)
- si tournoi inexistant -> `400 Validation impossible` avec `errors.tournoi_id`.
- verification de la limite globale du tournoi via le calcul `quota * places_incluses` (et non plus la simple somme des quotas).

## Frontend
Page admin :
- `frontend/src/pages/GestionTypesCommandites.jsx`
- route : `/admin/types-commandites`
Integration :
- route ajoutee dans `frontend/src/App.jsx`
- carte ajoutee dans `frontend/src/pages/AdminDashboard.jsx`
Fonctionnalites UI :
- onglets Creation / Modification / Affichage / Suppression
- formulaire avec les champs : `tournoi_id`, `nom`, `prix_cents`, `quota`, `places_incluses`
- messages succes/erreur + confirmation de suppression.

## Tests

Backend :
- `backend/__tests__/test-jest/types-commandites.routes.test.js`
- cas verifies : GET, POST invalide, POST valide, DELETE introuvable.

Frontend :
- `frontend/src/pages/GestionTypesCommandites.test.jsx`
- cas verifies : affichage page/onglets, chargement liste, validation formulaire vide, suppression avec modal + DELETE.

## Codes HTTP utilises
- `200` succes
- `201` creation
- `400` validation impossible
- `404` introuvable
- `500` erreur serveur

## Conclusion
Le module est operationnel en backend et frontend, avec validations, gestion d'erreurs claire, et couverture de tests de base.