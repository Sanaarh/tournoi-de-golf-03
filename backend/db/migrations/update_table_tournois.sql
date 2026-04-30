-- Ajout des colonnes manquantes
ALTER TABLE tournois
  ADD COLUMN IF NOT EXISTS inscription_debut DATE,
  ADD COLUMN IF NOT EXISTS inscription_fin DATE,
  ADD COLUMN IF NOT EXISTS limite_commandites INTEGER NOT NULL DEFAULT 0;

-- Remplacer la contrainte capacite_joueurs (>=0 → >=0 ET multiple de 4)
ALTER TABLE tournois
  DROP CONSTRAINT IF EXISTS tournois_capacite_joueurs_check;

ALTER TABLE tournois
  ADD CONSTRAINT tournois_capacite_joueurs_check
  CHECK (capacite_joueurs >= 0 AND capacite_joueurs % 4 = 0);

-- Ajouter les autres contraintes seulement si elles n'existent pas déjà
DO $$
BEGIN
  -- Cohérence équipes vs capacité
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_equipes_vs_capacite'
  ) THEN
    ALTER TABLE tournois
      ADD CONSTRAINT chk_equipes_vs_capacite
      CHECK (
        capacite_joueurs = 0
        OR nombre_equipes_max = 0
        OR nombre_equipes_max <= (capacite_joueurs / 4)
      );
  END IF;

  -- Période d'inscription valide
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_periode_inscription'
  ) THEN
    ALTER TABLE tournois
      ADD CONSTRAINT chk_periode_inscription
      CHECK (
        inscription_debut IS NULL
        OR inscription_fin IS NULL
        OR inscription_debut <= inscription_fin
      );
  END IF;

  -- Limite de commandites >= 0
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_limite_commandites'
  ) THEN
    ALTER TABLE tournois
      ADD CONSTRAINT chk_limite_commandites
      CHECK (limite_commandites >= 0);
  END IF;
END $$;
