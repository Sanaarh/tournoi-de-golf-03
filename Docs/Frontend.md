# Frontend - Tournoi de Golf

## Stack

- React + Vite
- React Router
- CSS global dans `frontend/src/App.css`
- appels API via `fetch`

## Routes frontend actuelles

Routes publiques :
- `/`
- `/tournoi`
- `/tournoi/:id`
- `/inscription`
- `/inscription/:tournoiId`
- `/sponsors`
- `/paiement/succes`
- `/paiement/annule`

Routes admin :
- `/admin`
- `/admin/dashboard`
- `/admin/users`
- `/admin/equipes`
- `/admin/tournois`
- `/admin/types-commandites`
- `/admin/commandites`

Definition centralisee dans `frontend/src/App.jsx`.

## Pages importantes

- `Tournoi.jsx` : liste avec onglets (actuel / a venir / passes)
- `TournoiDetail.jsx` : detail d'un tournoi + carte inscription
- `InscriptionTournoi.jsx` : parcours inscription participant et commanditaire
- `PaiementSucces.jsx` : etat final (paiement confirme ou echec metier)
- `Sponsors.jsx` : affichage types commandites publics
- `GestionTournoi.jsx` : creation/modification admin avec synchronisation automatique
  `capacite_joueurs <-> nombre_equipes_max` (x4 / /4) et reset du formulaire de
  modification sur la valeur serveur en cas de refus backend
- `AdminEquipes.jsx` : creation equipe avec message metier explicite si le nombre
  maximum d'equipes est atteint

## Regles de communication API

- base locale : `http://localhost:3000`
- routes admin avec session : `credentials: "include"`
- gestion standard : verifier `res.ok`, puis parser JSON

## Note de coherence

Le frontend affiche les indicateurs metier recents :
- participants inscrits
- places restantes
- statut d'ouverture des inscriptions

## Tests effectues

Fichier principal de test frontend :
- `frontend/src/App.test.jsx`

Ce test valide le rendu global de l'application et les routes principales.

Tests backend relies au frontend (API consommees par l'UI) :
- `backend/__tests__/test-jest/public.routes.test.js`
- `backend/__tests__/test-jest/payments.routes.test.js`
- `backend/__tests__/test-jest/types-commandites.routes.test.js`

Ces tests couvrent les endpoints utilises par les pages frontend (tournois, inscription, paiement, types de commandites).

## Commandes

Frontend :
```bash
cd frontend
npm run test
```

Backend :
```bash
cd backend
npm test
```
