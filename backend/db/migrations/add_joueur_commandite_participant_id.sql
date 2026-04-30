-- Lien optionnel vers un participant créé lors de l'affectation du joueur commandité à une équipe.
ALTER TABLE joueurs_commandites
  ADD COLUMN IF NOT EXISTS participant_id INTEGER REFERENCES participants(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_joueurs_commandites_participant_id ON joueurs_commandites(participant_id);
