-- À exécuter une fois sur une base déjà créée avant l'ajout de la table joueurs_commandites.
-- Les nouvelles installs utilisent déjà backend/db/init/01_schema.sql.

CREATE TABLE IF NOT EXISTS joueurs_commandites (
  id SERIAL PRIMARY KEY,
  commandite_id INTEGER NOT NULL REFERENCES commandites(id) ON DELETE CASCADE,
  prenom VARCHAR(80) NOT NULL,
  nom VARCHAR(80) NOT NULL,
  ordre INTEGER NOT NULL DEFAULT 0,
  statut VARCHAR(20) NOT NULL DEFAULT 'EN_ATTENTE'
);