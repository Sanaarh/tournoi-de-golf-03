-- Description optionnelle pour les types de commandites (admin + affichage).
ALTER TABLE types_commandites
  ADD COLUMN IF NOT EXISTS description TEXT;
