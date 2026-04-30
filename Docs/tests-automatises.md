# Tests automatisés

Les tests automatisés du backend sont réalisés avec **Jest**.

## Installation des dépendances

Avant de lancer les tests, il faut installer les dépendances du projet :

```bash
cd backend
npm install
```

## Lancer les tests

Une fois les dépendances installées, exécuter :

```bash
npm test
```

## Mode watch

Pour relancer automatiquement les tests à chaque modification :

```bash
npm run test:watch
```

## Coverage des tests

Pour afficher le pourcentage de couverture du code :

```bash
npm run test:coverage
```

Un dossier `coverage/` est généré pour consulter le rapport détaillé.

## Emplacement des tests

Les tests se trouvent dans :

```text
backend/__tests__/test-jest/
```

## Technologies utilisées

- **Jest**
- **Supertest**
