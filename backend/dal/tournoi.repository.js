/**
 * dal/tournoi.repository.js
 * --------------------------------------------------------------------
 * Couche d'accès aux données (Repository) pour la ressource "tournois".
 *
 * Objectif :
 * - Centraliser toutes les requêtes SQL liées à la table "tournois".
 * - Éviter d'écrire du SQL directement dans les routes.
 *
 * Table concernée :
 * - tournois
 *
 * Remarques :
 * - Ce fichier ne gère pas HTTP (req, res, status).
 * - Il se contente d'exécuter les requêtes SQL et de retourner les données.
 */

import { pool } from "../db/db.js";

/**
 * Liste tous les tournois.
 *
 * @returns {Promise<object[]>} tableau de tournois
 */
export async function listTournois() {
  const result = await pool.query(
    `
    SELECT
      id, nom, lieu, date_tournoi,
      inscription_debut, inscription_fin, inscriptions_ouvertes,
      capacite_joueurs, nombre_equipes_max, limite_commandites, prix_joueur,
      date_creation
    FROM tournois
    ORDER BY date_creation DESC, id DESC
    `
  );

  return result.rows;
}

/**
 * Retourne le tournoi actuellement ouvert aux inscriptions.
 *
 * Logique :
 * - inscriptions_ouvertes = true
 * - on retourne le premier tournoi trouvé selon l'ordre le plus pertinent
 *
 * @returns {Promise<object|null>} tournoi actif ou null s'il n'existe pas
 */
export async function findActiveTournoi() {
  const result = await pool.query(
    `
    SELECT
      id, nom, lieu, date_tournoi,
      inscription_debut, inscription_fin, inscriptions_ouvertes,
      capacite_joueurs, nombre_equipes_max, limite_commandites, prix_joueur,
      date_creation
    FROM tournois
    WHERE inscriptions_ouvertes = TRUE
    ORDER BY date_tournoi ASC, id ASC
    LIMIT 1
    `
  );

  return result.rows[0] ?? null;
}

/**
 * Trouve un tournoi par son identifiant.
 *
 * @param {number} id
 * @returns {Promise<object|null>} tournoi ou null si introuvable
 */
export async function findTournoiById(id) {
  const result = await pool.query(
    `
    SELECT
      id, nom, lieu, date_tournoi,
      inscription_debut, inscription_fin, inscriptions_ouvertes,
      capacite_joueurs, nombre_equipes_max, limite_commandites, prix_joueur,
      date_creation
    FROM tournois
    WHERE id = $1
    `,
    [id]
  );

  return result.rows[0] ?? null;
}

/**
 * Crée un tournoi.
 *
 * @param {object} data
 * @param {string} data.nom
 * @param {string|null} data.lieu
 * @param {string} data.date_tournoi
 * @param {string|null} data.inscription_debut
 * @param {string|null} data.inscription_fin
 * @param {boolean} data.inscriptions_ouvertes
 * @param {number} data.capacite_joueurs
 * @param {number} data.nombre_equipes_max
 * @param {number} data.limite_commandites
 * @param {number} data.prix_joueur
 * @returns {Promise<object>} tournoi créé
 */
export async function createTournoi(data) {
  const result = await pool.query(
    `
    INSERT INTO tournois (
      nom, lieu, date_tournoi,
      inscription_debut, inscription_fin, inscriptions_ouvertes,
      capacite_joueurs, nombre_equipes_max, limite_commandites, prix_joueur
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
    RETURNING
      id, nom, lieu, date_tournoi,
      inscription_debut, inscription_fin, inscriptions_ouvertes,
      capacite_joueurs, nombre_equipes_max, limite_commandites, prix_joueur,
      date_creation
    `,
    [
      data.nom,
      data.lieu,
      data.date_tournoi,
      data.inscription_debut,
      data.inscription_fin,
      data.inscriptions_ouvertes,
      data.capacite_joueurs,
      data.nombre_equipes_max,
      data.limite_commandites,
      data.prix_joueur,
    ]
  );

  return result.rows[0];
}

/**
 * Met à jour un tournoi existant.
 *
 * @param {number} id
 * @param {object} data
 * @param {string} data.nom
 * @param {string|null} data.lieu
 * @param {string} data.date_tournoi
 * @param {string|null} data.inscription_debut
 * @param {string|null} data.inscription_fin
 * @param {boolean} data.inscriptions_ouvertes
 * @param {number} data.capacite_joueurs
 * @param {number} data.nombre_equipes_max
 * @param {number} data.limite_commandites
 * @param {number} data.prix_joueur
 * @returns {Promise<object|null>} tournoi modifié ou null si introuvable
 */
export async function updateTournoi(id, data) {
  const result = await pool.query(
    `
    UPDATE tournois
    SET
      nom = $1,
      lieu = $2,
      date_tournoi = $3,
      inscription_debut = $4,
      inscription_fin = $5,
      inscriptions_ouvertes = $6,
      capacite_joueurs = $7,
      nombre_equipes_max = $8,
      limite_commandites = $9,
      prix_joueur = $10
    WHERE id = $11
    RETURNING
      id, nom, lieu, date_tournoi,
      inscription_debut, inscription_fin, inscriptions_ouvertes,
      capacite_joueurs, nombre_equipes_max, limite_commandites, prix_joueur,
      date_creation
    `,
    [
      data.nom,
      data.lieu,
      data.date_tournoi,
      data.inscription_debut,
      data.inscription_fin,
      data.inscriptions_ouvertes,
      data.capacite_joueurs,
      data.nombre_equipes_max,
      data.limite_commandites,
      data.prix_joueur,
      id,
    ]
  );

  return result.rows[0] ?? null;
}

/**
 * Vérifie si un tournoi avec ce nom existe déjà.
 *
 * @param {string} nom
 * @param {number|null} excludeId - exclure cet id (utile pour le PUT)
 * @returns {Promise<boolean>}
 */
export async function existsTournoiByNom(nom, excludeId = null) {
  const result = await pool.query(
    `
    SELECT 1 FROM tournois
    WHERE LOWER(nom) = LOWER($1)
      AND ($2::int IS NULL OR id <> $2)
    LIMIT 1
    `,
    [nom, excludeId]
  );
  return result.rowCount > 0;
}

/**
 * Supprime un tournoi.
 *
 * @param {number} id
 * @returns {Promise<object|null>} tournoi supprimé (id, nom) ou null si introuvable
 */
export async function deleteTournoi(id) {
  const result = await pool.query(
    `
    DELETE FROM tournois
    WHERE id = $1
    RETURNING id, nom
    `,
    [id]
  );

  return result.rows[0] ?? null;
}

/**
 * Calcule le nombre de places commanditées déjà consommées
 * pour un tournoi, en se basant sur les commandites PAYEES.
 *
 * Règle:
 * - somme des places_incluses des types liés aux commandites PAYEES
 *
 * @param {number} tournoiId
 * @returns {Promise<number>}
 */
export async function countPlacesCommanditesPayeesByTournoi(tournoiId) {
  const result = await pool.query(
    `
    SELECT COALESCE(SUM(tc.places_incluses), 0)::int AS total
    FROM commandites c
    INNER JOIN types_commandites tc ON tc.id = c.type_commandite_id
    WHERE c.tournoi_id = $1
      AND c.statut = 'PAYEE'
    `,
    [tournoiId]
  );

  return Number(result.rows[0]?.total ?? 0);
}