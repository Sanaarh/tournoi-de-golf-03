-- Aligne les contraintes avec le flux Stripe du projet :
-- 1) commandites.statut accepte PAYEE (et non PAYE)
-- 2) paiements autorise EN_ATTENTE sans participant_id/commandite_id
--    puis association au moment du webhook.

ALTER TABLE commandites
  DROP CONSTRAINT IF EXISTS commandites_statut_check;

ALTER TABLE commandites
  ADD CONSTRAINT commandites_statut_check
  CHECK (statut IN ('EN_ATTENTE', 'PAYEE', 'ECHEC'));

ALTER TABLE paiements
  DROP CONSTRAINT IF EXISTS chk_paiement_xor;

ALTER TABLE paiements
  ADD CONSTRAINT chk_paiement_xor
  CHECK (NOT (participant_id IS NOT NULL AND commandite_id IS NOT NULL));
