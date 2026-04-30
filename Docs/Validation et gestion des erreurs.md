# Validation et gestion des erreurs - API

## Principe

La validation est faite a 3 niveaux :
- frontend (UX)
- routes/validators backend (entrees HTTP)
- DAL/repository (regles metier + contraintes SQL)

## Format de reponse d'erreur

Minimal :

```json
{ "message": "Erreur serveur" }
```

Quand validation detaillee :

```json
{
  "message": "Validation impossible",
  "errors": {
    "champ": "message explicatif"
  }
}
```

## Codes HTTP utilises

- `200` succes
- `201` creation
- `400` donnees invalides
- `401` non authentifie
- `404` ressource introuvable
- `409` conflit metier
- `500` erreur serveur

## Cas metier importants actuellement

- inscription refusee si tournoi ferme
- inscription refusee si capacite atteinte
- equipe refusee si pleine ou code invalide
- creation equipe admin refusee si nombre maximum d'equipes atteint
- doublon de courriel sur tournoi bloque
- commandite refusee si quotas/limites depasses
- modification tournoi refusee si `limite_commandites` descend sous les places
  commanditees deja utilisees (`PAYEE`)
- paiement stripe valide mais echec metier => statut `ECHEC` trace et renvoye clairement

## Paiement et webhooks

- le webhook Stripe finalise le resultat metier
- statuts commandite utilises : `EN_ATTENTE`, `PAYEE`, `ECHEC`
- contraintes SQL alignees pour accepter le flux "en attente puis association"

## Tests effectues

### Authentification / session
- `backend/__tests__/test-jest/auth.routes.test.js`

### Validation inscription
- `backend/__tests__/test-jest/inscriptionTournoi.validator.test.js`
- `backend/__tests__/test-jest/inscriptionTournoi.repository.test.js`
- `backend/__tests__/test-jest/public.routes.test.js`

### Paiements
- `backend/__tests__/test-jest/payments.routes.test.js`
- `backend/__tests__/test-jest/payments.repository.test.js`

### Types commandites (validation metier)
- `backend/__tests__/test-jest/types-commandites.validator.test.js`
- `backend/__tests__/test-jest/types-commandites.routes.test.js`
- `backend/__tests__/test-jest/types-commandites.repository.test.js`

## Ce que ces tests valident

- codes HTTP attendus (`200/201/400/401/404/409/500`)
- format des erreurs (`message`, `errors`)
- conflits metier (quota, capacite, doublons, statut inscriptions)
- transitions de statut paiement (`EN_ATTENTE` -> `PAYEE` ou `ECHEC`)
