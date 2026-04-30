-- Alignement avec 01_schema.sql : colonne utilisée par listTournois / CRUD admin.
ALTER TABLE tournois
  ADD COLUMN IF NOT EXISTS prix_joueur NUMERIC(10,2) NOT NULL DEFAULT 0;

ALTER TABLE tournois
  DROP CONSTRAINT IF EXISTS tournois_prix_joueur_check;

ALTER TABLE tournois
  ADD CONSTRAINT tournois_prix_joueur_check
  CHECK (prix_joueur >= 0);
