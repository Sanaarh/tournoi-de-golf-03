# Docs/GestionTournoi-AC-Tests.md

## Critères d’acceptation (AC) & Tests UI — Gestion Tournoi

### Objectif
Garantir que la page **Gestion tournoi** respecte :
- les règles métier (validation backend + schéma `backend/db/init/01_schema.sql`),
- la cohérence des dates,
- l’expérience utilisateur (pas de page vide, messages clairs),
- les actions CRUD (création/modification/affichage/suppression).

> **Mise à jour importante (backend)**  
> Le backend a été refactorisé pour séparer **routes** et **accès aux données** :
> - `routes/tournois.routes.js` : HTTP + validations + règles métier (sans SQL direct)
> - `repositories/tournoi.repository.js` : requêtes SQL
> Les règles métier restent identiques, mais certaines contraintes UI doivent refléter le comportement réel du backend.

---


## 1) AC — Navigation / Accès
- **AC-A1** : Un admin connecté peut accéder à `/admin/dashboard` et `/admin/tournois`.
- **AC-A2** : Un utilisateur non connecté est redirigé vers `/admin`.
- **AC-A3** : Le bouton “Retour au tableau de bord” renvoie à `/admin/dashboard`.
- **AC-A4** : Le bouton “Rafraîchir” recharge la liste des tournois.

---

## 2) AC — Création tournoi (UI)

### Champs obligatoires
- **AC-C1** : `nom` obligatoire (non vide).
- **AC-C2** : `date_tournoi` obligatoire au format `YYYY-MM-DD`.

### Capacités / équipes (aligné backend)
- **AC-C3** : `capacite_joueurs` est un entier **≥ 0**.
- **AC-C4** : si `capacite_joueurs > 0` alors `capacite_joueurs` doit être **multiple de 4**.
- **AC-C5** : `nombre_equipes_max` est **calculé automatiquement** par l’UI à partir de `capacite_joueurs` :  
  `nombre_equipes_max = capacite_joueurs / 4` (si capacité valide), sinon `0`.
- **AC-C6** : `nombre_equipes_max` est **en lecture seule** (car recalculé par le backend aussi).

> Note : si vous souhaitez permettre à l’admin de réduire manuellement `nombre_equipes_max`,
> il faudrait changer la règle backend (actuellement, le backend calcule et impose la valeur).

### Dates d’inscription (aligné backend)
- **AC-C7** : si `inscription_debut` et `inscription_fin` sont fournis : `inscription_debut ≤ inscription_fin`.
- **AC-C8** : si `inscription_fin` est fourni : `date_tournoi ≥ inscription_fin`.
- **AC-C9** : sinon, si `inscription_debut` est fourni : `date_tournoi ≥ inscription_debut`.

### Commandites (aligné backend)
- **AC-C10** : `limite_commandites` est un entier **≥ 0**.
- **AC-C11** : si `limite_commandites > 0` :
  - `capacite_joueurs` doit être **> 0**
  - et `limite_commandites` doit être **strictement inférieur** à `capacite_joueurs` :  
    `limite_commandites < capacite_joueurs`

### Blocage de validation
- **AC-C12** : si une règle est violée, l’UI affiche une erreur claire et empêche la validation.
- **AC-C13** : en cas de retour `400` du backend, l’UI affiche :
  - le message global,
  - et les erreurs détaillées (si fournies).

---

## 3) AC — Auto-remplissage du nombre d’équipes (mise à jour)

- **AC-AUTO1** : si l’admin saisit une `capacite_joueurs` valide (multiple de 4), alors  
  `nombre_equipes_max` se remplit automatiquement avec `capacite_joueurs / 4`.
- **AC-AUTO2** : si la capacité est vide/0/invalide, `nombre_equipes_max` affiche `0`.
- **AC-AUTO3** : le champ `nombre_equipes_max` est **non modifiable** (lecture seule).

---

## 4) AC — Modification tournoi
- **AC-M1** : la liste des tournois se charge automatiquement à l’ouverture de la page/onglet.
- **AC-M2** : après sélection, le formulaire se pré-remplit avec les valeurs existantes.
- **AC-M3** : champs modifiables : nom, lieu, dates, capacité, quota, inscriptions ouvertes.
- **AC-M4** : les mêmes validations que la création s’appliquent.
- **AC-M5** : succès → message + rafraîchissement de la liste.

---

## 5) AC — Affichage tournoi
- **AC-L1** : la page affiche une table listant au minimum :  
  ID, nom, lieu, date_tournoi, capacité, équipes max, inscriptions (ouvert/fermé + période), quota commandites.
- **AC-L2** : si aucun tournoi, afficher “Aucun tournoi disponible”.
- **AC-L3** : en cas d’erreur API, afficher un message clair et proposer “Rafraîchir”.

---

## 6) AC — Suppression tournoi
- **AC-S1** : sélection obligatoire.
- **AC-S2** : confirmation avant suppression.
- **AC-S3** : succès → message + retrait du tournoi de la liste (ou rafraîchissement).

---

## 7) Tests UI (checklist)

### Smoke tests
- **T-SM1** : login admin valide → dashboard visible.
- **T-SM2** : ouvrir `/admin/tournois` sans session → redirection `/admin`.
- **T-SM3** : charger la page → table visible (ou message “Aucun tournoi disponible”).

### Validation Création (alignée backend)
- **T-C1** : capacité = 70 → erreur (pas multiple de 4).
- **T-C2** : capacité = -1 → erreur (doit être ≥ 0).
- **T-C3** : début = 2026-03-10, fin = 2026-03-01 → erreur.
- **T-C4** : date tournoi = 2026-03-05, fin inscription = 2026-03-10 → erreur.
- **T-C5** : quota commandites = 500, capacité = 400 → erreur (quota doit être < capacité).
- **T-C6** : quota commandites = 1, capacité = 0 → erreur (capacité doit être > 0 si quota > 0).
- **T-C7** : tout valide → validation OK (et sauvegarde quand l’API est branchée).

### Auto-remplissage équipes
- **T-AUTO1** : capacité = 72 → équipes auto = 18.
- **T-AUTO2** : capacité = 0 → équipes = 0.
- **T-AUTO3** : essayer de modifier équipes → impossible (champ désactivé/readonly).

### Modification
- **T-M1** : liste chargée.
- **T-M2** : sélectionner tournoi → pré-remplissage OK.
- **T-M3** : modifier capacité non multiple de 4 → refus.
- **T-M4** : enregistrer modifs valides → succès + rafraîchissement.

### Suppression
- **T-S1** : sans sélection → bouton supprimé désactivé ou message.
- **T-S2** : sélectionner + confirmer → supprimé.
- **T-S3** : annuler confirmation → aucun changement.

---

## 8) Notes de cohérence Backend/UI

- Le backend **recalcule** `nombre_equipes_max` à partir de `capacite_joueurs`.  
  Pour éviter les incohérences, l’UI doit afficher ce champ en **lecture seule**.
- Les erreurs backend de validation (`400`) doivent être affichées clairement, idéalement champ par champ.
