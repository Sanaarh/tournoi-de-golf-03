/**
 * dal/types-commandites.repository.js
 * --------------------------------------------------------------------
 * Couche d'accès aux données (Repository) pour la ressource "types_commandites".
 *
 * Objectif :
 * - Centraliser toutes les requêtes SQL liées à la table "types_commandites".
 * - Éviter d'écrire du SQL directement dans les routes.
 */

import { pool } from "../db/db.js";

export async function listTypesCommandites() {
  const result = await pool.query(
    `
    SELECT
      tc.id,
      tc.tournoi_id,
      tc.nom,
      tc.prix_cents,
      tc.quota,
      tc.places_incluses,
      tc.description,
      tc.date_creation,
      COUNT(c.id)::int AS nb_commandites
    FROM types_commandites tc
    LEFT JOIN commandites c
      ON c.type_commandite_id = tc.id
     AND c.statut = 'PAYEE'
    WHERE tc.quota > 0
    GROUP BY tc.id
    ORDER BY tc.date_creation DESC, tc.id DESC
    `
  );

  return result.rows;
}

export async function listTypesCommanditesByTournoi(tournoiId) {
  const result = await pool.query(
    `
    SELECT
      tc.id,
      tc.tournoi_id,
      tc.nom,
      tc.prix_cents,
      tc.quota,
      tc.places_incluses,
      tc.description,
      tc.date_creation,
      COUNT(c.id)::int AS nb_commandites
    FROM types_commandites tc
    LEFT JOIN commandites c
      ON c.type_commandite_id = tc.id
     AND c.statut = 'PAYEE'
    WHERE tc.tournoi_id = $1
      AND tc.quota > 0
    GROUP BY tc.id
    ORDER BY tc.date_creation DESC, tc.id DESC
    `,
    [tournoiId]
  );

  return result.rows;
}

export async function findTypeCommanditeById(id) {
  const result = await pool.query(
    `
    SELECT
      tc.id,
      tc.tournoi_id,
      tc.nom,
      tc.prix_cents,
      tc.quota,
      tc.places_incluses,
      tc.description,
      tc.date_creation,
      COUNT(c.id)::int AS nb_commandites
    FROM types_commandites tc
    LEFT JOIN commandites c
      ON c.type_commandite_id = tc.id
     AND c.statut = 'PAYEE'
    WHERE tc.id = $1
    GROUP BY tc.id
    `,
    [id]
  );

  return result.rows[0] ?? null;
}

/**
 * Somme des places commanditées allouées pour un tournoi.
 *
 * Calcul :
 * - quota * places_incluses pour chaque type
 *
 * Utile pour comparer au quota global du tournoi (limite_commandites),
 * qui représente un maximum de joueurs commandités.
 *
 * @param {number} tournoiId
 * @param {number|null} excludeTypeId
 * @returns {Promise<number>}
 */
export async function sumQuotasTypesForTournoi(tournoiId, excludeTypeId = null) {
  const result = await pool.query(
    `
    SELECT COALESCE(SUM(quota * places_incluses), 0)::int AS total
    FROM types_commandites
    WHERE tournoi_id = $1
      AND quota > 0
      AND ($2::int IS NULL OR id <> $2)
    `,
    [tournoiId, excludeTypeId]
  );

  return Number(result.rows[0]?.total ?? 0);
}

/**
 * Nombre de commandites PAYEES pour ce type.
 *
 * @param {number} typeCommanditeId
 * @returns {Promise<number>}
 */
export async function countCommanditesForType(typeCommanditeId) {
  const result = await pool.query(
    `
    SELECT COUNT(*)::int AS total
    FROM commandites
    WHERE type_commandite_id = $1
      AND statut = 'PAYEE'
    `,
    [typeCommanditeId]
  );

  return Number(result.rows[0]?.total ?? 0);
}

export async function createTypeCommandite(data) {
  const result = await pool.query(
    `
    INSERT INTO types_commandites (
      tournoi_id,
      nom,
      prix_cents,
      quota,
      places_incluses,
      description
    )
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING
      id,
      tournoi_id,
      nom,
      prix_cents,
      quota,
      places_incluses,
      description,
      date_creation
    `,
    [
      data.tournoi_id,
      data.nom,
      data.prix_cents,
      data.quota,
      data.places_incluses,
      data.description ?? null,
    ]
  );

  return result.rows[0];
}

export async function updateTypeCommandite(id, data) {
  const result = await pool.query(
    `
    UPDATE types_commandites
    SET
      tournoi_id = $1,
      nom = $2,
      prix_cents = $3,
      quota = $4,
      places_incluses = $5,
      description = $6
    WHERE id = $7
    RETURNING
      id,
      tournoi_id,
      nom,
      prix_cents,
      quota,
      places_incluses,
      description,
      date_creation
    `,
    [
      data.tournoi_id,
      data.nom,
      data.prix_cents,
      data.quota,
      data.places_incluses,
      data.description ?? null,
      id,
    ]
  );

  return result.rows[0] ?? null;
}

/**
 * Supprime un type de commandite.
 * Les lignes de `commandites` qui pointent vers ce type sont supprimées d’abord
 * (contrainte FK sans CASCADE sur `commandites.type_commandite_id`), puis les
 * `joueurs_commandites` et `paiements` liés à ces commandites suivent les CASCADE SQL.
 */
export async function deleteTypeCommandite(id) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`DELETE FROM commandites WHERE type_commandite_id = $1`, [id]);
    const result = await client.query(
      `
      DELETE FROM types_commandites
      WHERE id = $1
      RETURNING id, nom
      `,
      [id]
    );
    await client.query("COMMIT");
    return result.rows[0] ?? null;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
