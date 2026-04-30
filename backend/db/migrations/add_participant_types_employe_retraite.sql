-- Sépare employé / retraité en base (conserve EMPLOYE_RETRAITE pour les lignes existantes).
ALTER TABLE participants DROP CONSTRAINT IF EXISTS participants_type_participant_check;
ALTER TABLE participants ADD CONSTRAINT participants_type_participant_check
  CHECK (type_participant IN ('EMPLOYE','RETRAITE','EMPLOYE_RETRAITE','JOUEUR_COMMANDITE'));
