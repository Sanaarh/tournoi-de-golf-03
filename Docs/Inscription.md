# Module Inscription

## Vue d'ensemble

Le module d'inscription couvre 3 parcours publics :
- employe/retraite : creer une equipe
- employe/retraite : rejoindre une equipe
- commanditaire : choisir un type de commandite et declarer les joueurs inclus

Le frontend principal est `frontend/src/pages/InscriptionTournoi.jsx`.

## API utilisees (public)

- `GET /public/tournoi-actif`
- `GET /public/types-commandites?tournoi_id=...`
- `POST /public/inscription/verifier-courriel`
- `POST /public/inscription/verifier-nom-equipe`
- `POST /public/inscription/verifier-code-equipe`
- `POST /public/inscription/verifier-noms-joueurs`
- `POST /public/inscription/commanditaire` (creation commandite en attente)

Paiement :
- `POST /payments/create-checkout-session`
- webhook Stripe : `POST /payments/webhook`
- confirmation : `GET /payments/confirmation`

## Logique metier essentielle

- `inscriptions_ouvertes` doit etre vrai pour accepter une inscription.
- Controle de capacite tournoi et limite equipe (max 4 membres).
- Anti-doublons courriel participant sur un tournoi.
- Anti-doublons de joueurs nominatifs commandites.
- Quotas commandites appliques via types de commandites.
- Les commandites `EN_ATTENTE` ne bloquent pas les places ; les compteurs
  d'inscription commanditaire utilisent les commandites `PAYEE`.

## Types participants

Valeurs gerees en base :
- `EMPLOYE`
- `RETRAITE`
- `EMPLOYE_RETRAITE` (heritage ancien)
- `JOUEUR_COMMANDITE`

Le flux frontend envoie `categorie_participant` (`employe` ou `retraite`) pour stocker le bon type.

## Fichiers backend principaux

- `backend/routes/public.routes.js`
- `backend/routes/payments.routes.js`
- `backend/dal/inscriptionTournoi.repository.js`
- `backend/validators/inscriptionTournoi.validator.js`

## Retour utilisateur

Le frontend affiche :
- etats de validation champ par champ
- conflits metier (tournoi ferme, equipe pleine, doublons)
- etat de paiement/confirmation apres retour Stripe

## Tests effectues

### Backend (Jest)

Fichiers :
- `backend/__tests__/test-jest/public.routes.test.js`
- `backend/__tests__/test-jest/inscriptionTournoi.validator.test.js`
- `backend/__tests__/test-jest/inscriptionTournoi.repository.test.js`
- `backend/__tests__/test-jest/payments.routes.test.js`
- `backend/__tests__/test-jest/payments.repository.test.js`

Points verifies :
- validation des payloads d'inscription (participant et commanditaire)
- regles metier (tournoi ouvert, capacite, equipe, doublons)
- creation session Stripe et gestion des erreurs
- webhook paiement reussi / echec et mise a jour des statuts
- recuperation de confirmation de paiement

### Frontend

Le frontend est couvert au niveau integration globale par :
- `frontend/src/App.test.jsx`

### Commandes de test

Backend :
```bash
cd backend
npm test
```

Frontend :
```bash
cd frontend
npm run test
```
