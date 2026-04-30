# User story — Administration des équipes

## Contexte

Cette user story vient d'un besoin simple : permettre à l'administrateur de corriger les équipes d'un tournoi sans passer par la base de données.

L'idée était d'avoir une interface claire pour :
- voir les équipes existantes,
- modifier le nom d'une équipe,
- ajouter, modifier, retirer ou déplacer des participants,
- créer ou supprimer une équipe si nécessaire.

## Ce qui a été réalisé

### Interface admin

La page `AdminEquipes` permet maintenant de :
- afficher les équipes et leurs membres,
- éditer le nom d'une équipe,
- ouvrir un modal pour ajouter un participant,
- modifier un participant (prénom, nom, courriel, téléphone),
- retirer un participant avec confirmation,
- déplacer un participant d'une équipe à une autre en **drag & drop**,
- glisser-déposer un joueur commandité vers une équipe,
- supprimer une équipe avec confirmation.

Détails UX ajoutés :
- actions participant en boutons icônes (style soft),
- auto-scroll de la page pendant le drag (haut/bas) pour déposer dans une équipe plus loin.

### Intégration backend

Les actions de la page sont branchées sur les routes admin (`/admin/equipes`, `/admin/equipes/:id`, `/admin/equipes/:id/membres`, etc.).  
Le frontend ne simule plus les modifications : il consomme les réponses réelles de l'API.

Nouveaux endpoints ajoutés :
- `PATCH /admin/participants/:id` (édition participant),
- `POST /admin/equipes/:id/membres/:participantId/deplacer` (déplacement entre équipes).

## Règles métier retenues

Les validations suivantes ont été appliquées :

1. Une équipe ne peut pas dépasser **4 membres**.
2. Un participant doit appartenir au **même tournoi** que l'équipe.
3. Un participant ne peut pas être dans plusieurs équipes.
4. On ne peut pas créer (ou renommer) une équipe avec un **nom déjà utilisé dans le même tournoi**.
5. Le déplacement d'un participant est interdit vers une équipe d'un autre tournoi.
6. Les opérations de gestion sont autorisées seulement pour un **tournoi ouvert**.

> Ces règles sont contrôlées côté backend, avec un retour d'erreur clair.  
> Le frontend ajoute des validations simples pour éviter des actions inutiles (meilleure UX).

## Tests automatisés réalisés

### Backend (Jest + Supertest)

Ajout d'une suite dédiée sur `admin.equipes.routes` pour couvrir les cas principaux :
- succès sur les routes CRUD,
- refus si tournoi fermé,
- refus si équipe complète,
- refus si nom d'équipe dupliqué,
- validations des IDs/champs,
- endpoints participants (édition + déplacement).

### Frontend (Vitest + Testing Library)

Ajout de tests sur `AdminEquipes` pour vérifier :
- affichage de la page,
- validations de formulaires,
- édition du nom d'équipe,
- ajout de participant existant,
- suppression d'équipe via modal,
- stabilité des interactions de gestion côté équipe.



