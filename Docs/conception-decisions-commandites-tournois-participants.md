# Conception — Décisions d'équipe (commandites, tournois et participants)

Ce document résume les **échanges de l'équipe** en conception et les **choix finaux retenus**.  
Les décisions présentées ici ont été **discutées en cours** et **validées avec le professeur**.

---

## 1. Types de commandite et lien avec le tournoi

**Question discutée :** faut-il définir les types de commandite directement pendant la création du tournoi ?

**Décision retenue :** séparer la création du tournoi et la gestion des types de commandite.

- La **création du tournoi** définit le cadre global : capacité (équipes / participants), dates, ouverture des inscriptions et quota réservé aux commandites.
- Les **types de commandite** sont gérés dans une structure dédiée (ex. `types_commandites`) liée au tournoi.
- L'admin peut donc configurer la commandite **après** avoir défini le tournoi.

**Pourquoi :** cette séparation simplifie le modèle, évite une création de tournoi trop lourde et clarifie les responsabilités.

---

## 2. Quota commandites dans le tournoi

**Question discutée :** comment limiter la place des commandites dans la capacité totale du tournoi ?

**Décision retenue :** fixer un quota commandites dans les paramètres du tournoi.

- Le tournoi conserve un **nombre total de places joueurs** comme référence principale.
- Une **portion de ces places** est réservée aux parcours commandite (selon le quota défini).
- Le détail des types de commandite est ensuite géré séparément par l'admin.

**Pourquoi :** on garde une capacité globale cohérente tout en encadrant la place des commandites.

---

## 3. Rôle de l'administrateur pour la commandite

**Question discutée :** qui contrôle la configuration détaillée des commandites ?

**Décision retenue :** la gestion opérationnelle des commandites relève de l'admin.

- L'admin gère les **types de commandite** rattachés à un tournoi.
- L'admin crée les **commandites** dans la limite du quota défini au tournoi.
- L'admin précise, par type, la **quantité autorisée** selon les besoins.

**Pourquoi :** le tournoi fixe le plafond global, puis l'admin répartit et ajuste le détail métier.

---

## 4. Parcours d'inscription des participants

**Question discutée :** faut-il garder un même parcours d'inscription pour tous les participants ?

**Décision retenue :** conserver des parcours distincts.

- **Employés et retraités** : inscription publique avec création d'équipe ou rejoindre une équipe avec un code secret.
- **Commandites** : parcours distinct, selon les règles définies côté commandite et administration.

**Problème identifié :** si trop de personnes créent leur propre équipe, on peut atteindre la limite d'équipes alors qu'il reste des places dans des équipes incomplètes.

**Pourquoi c'est important :** ce cas bloque de nouvelles créations d'équipe même si le tournoi n'est pas plein en nombre de joueurs.

---

## 5. Piste étudiée mais non retenue

**Question discutée :** faut-il implémenter un mécanisme avancé pour compléter automatiquement les équipes ?

**Pistes étudiées :**

- liste d'attente par courriel ;
- réservation de places au moment de la création d'équipe selon le nombre prévu de joueurs ;
- complétion des équipes incomplètes par l'admin à la fermeture des inscriptions.

**Décision retenue :** ne pas implémenter ce mécanisme dans le cadre du projet (contrainte de temps et complexité).

**Solution retenue :** conserver le modèle simple créer/rejoindre une équipe avec code, et traiter les cas limites par l'admin.

**Pourquoi :** solution plus réaliste pour l'échéancier du cours, avec un comportement clair et maîtrisé.

---

## 6. Lien avec les autres documents

**Décision retenue :** ce fichier reste un mémo des décisions de conception.

- Les autres documents dans `Docs/` décrivent surtout la partie technique (routes, écrans, implantation).
- Ce document complète ces fichiers en conservant les arbitrages de conception validés.

**Pourquoi :** séparer les choix de conception des détails techniques améliore la lisibilité globale.

---

## 7. Gestion des joueurs commandités et placement en équipe

Cette section précise les décisions sur la gestion des joueurs inclus dans une commandite.

### 7.1 Lien entre joueurs commandités et commandite

**Question discutée :** les joueurs commandités doivent-ils s'inscrire avec leur propre courriel ou via la commandite ?

**Décision retenue :** relier les joueurs commandités à la commandite (et non à une inscription indépendante).

- Les joueurs saisis dans un forfait commandite sont enregistrés dans une structure de liaison (ex. `joueurs_commandites`) reliée à la commandite.
- L'admin peut voir rapidement à quelle commandite appartient chaque joueur.
- Le placement de joueurs d'une même commandite dans une même équipe est plus simple.

**Pourquoi :** meilleure traçabilité, moins d'inscriptions dispersées et meilleure efficacité administrative.

### 7.2 Inscription des commanditaires et création d'équipes

**Question discutée :** faut-il créer automatiquement une équipe dès qu'une commandite est inscrite ?

**Décision retenue :** non. Les commanditaires et leurs joueurs sont d'abord placés dans une liste de gestion admin.

- L'admin place ensuite les joueurs dans les équipes selon les places disponibles.
- On évite de générer trop tôt des équipes incomplètes.

**Pourquoi :** cette approche donne plus de flexibilité à l'admin pour équilibrer les équipes.

### 7.3 Formulaire de saisie des joueurs par le commanditaire

**Question discutée :** à quel moment collecter les joueurs inclus dans une commandite ?

**Décision retenue :** prévoir un formulaire où le commanditaire saisit les joueurs qu'il veut inclure.

- Les informations sont collectées tôt et de façon structurée.
- L'admin dispose des données nécessaires pour préparer le pairing.

**Pourquoi :** meilleure organisation en amont et moins de corrections tardives.

### 7.4 Emplacement de la gestion des commandites

**Question discutée :** afficher les commandites dans la gestion des équipes ou dans une gestion séparée ?

**Décision retenue :** gestion séparée des commandites, avec lien clair vers la gestion des équipes.

- La **gestion des équipes** reste l'espace opérationnel (places libres, placement des joueurs commandités, glisser-déposer ou équivalent).
- La **gestion des commandites** reste dédiée au suivi administratif des forfaits et des inscriptions commanditaires.

**Pourquoi :** séparation claire des responsabilités, interface plus lisible et processus de pairing mieux organisé.

---

*Document rédigé par l'équipe à partir des réunions de conception ; arbitrages finaux validés avec le professeur.*
