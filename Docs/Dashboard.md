# Dashboard Admin — Documentation

Ce document décrit le fonctionnement du **tableau de bord administrateur**.

---

## 1) Objectif

Le dashboard permet à un administrateur connecté de :

- voir rapidement les indicateurs clés (KPI) ;
- accéder aux écrans principaux d'administration ;
- suivre l'état global des données du système.

---

## 2) Route frontend

- Page : `/admin/dashboard`
- Composant : `frontend/src/pages/AdminDashboard.jsx`

Au chargement :

1. le frontend vérifie la session avec `GET /auth/me` ;
2. si la session est valide, il charge les statistiques via `GET /admin/dashboard/stats` ;
3. il charge aussi la liste des admins (`GET /admin/users`) pour le KPI administrateurs.

Si la session n'est pas valide, l'utilisateur est redirigé vers `/admin`.

---

## 3) API utilisée

### Endpoint

- `GET /admin/dashboard/stats`

### Protection

- Route protégée par `requireAdmin` (session admin obligatoire).

### Réponse attendue (200)

```json
{
  "tournois": 3,
  "equipes": 12,
  "joueurs": 45,
  "commandites": 8
}
```

### Codes de réponse

- `200` : statistiques retournées
- `401` : non connecté / accès refusé
- `500` : erreur serveur

---

## 4) KPI affichés

Le dashboard affiche les KPI suivants :

- **Tournois** : nombre total de tournois ;
- **Equipes** : nombre total d'équipes ;
- **Participants** : nombre total de participants (joueurs) ;
- **Commandites** : nombre total de commandites inscrites ;
- **Administrateurs** : nombre total de comptes admin.

---

## 5) Portée des statistiques

Les statistiques affichées sont actuellement des **totaux globaux** sur la base de données (tous les tournois), et non seulement sur le tournoi ouvert.

---

## 6) Tests

Tests liés au dashboard :

- Frontend : `frontend/src/pages/AdminDashboard.test.jsx`
- Backend (route stats) : `backend/__tests__/test-jest/admin.routes.test.js`

