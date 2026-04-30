-- Types avec quota 0 : retirés (non supportés ; commandites liées supprimées d’abord).
DELETE FROM commandites
WHERE type_commandite_id IN (SELECT id FROM types_commandites WHERE quota = 0);

DELETE FROM types_commandites
WHERE quota = 0;
