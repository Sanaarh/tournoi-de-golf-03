/**
 * dal/dashboard.repository.js
 * --------------------------------------------------------------------
 * Couche d'accès aux données pour les statistiques du tableau de bord admin.
 */

import { pool } from "../db/db.js";

/**
 * Retourne les compteurs du dashboard admin.
 *
 * Si tournoiId est fourni :
 * - les stats sont limitées à ce tournoi
 *
 * Sinon :
 * - les stats restent globales
 *
 * @param {number|null} tournoiId
 * @returns {Promise<{tournois:number,equipes:number,joueurs:number,commandites:number}>}
 */
export async function getDashboardStats(tournoiId = null) {
  const tid = Number(tournoiId);
  const hasTournoi = Number.isInteger(tid) && tid > 0;

  if (!hasTournoi) {
    const result = await pool.query(`
      SELECT
        (SELECT COUNT(*)::int FROM tournois) AS tournois,
        (SELECT COUNT(*)::int FROM equipes) AS equipes,
        (SELECT COUNT(*)::int FROM participants) AS joueurs,
        (SELECT COUNT(*)::int FROM commandites) AS commandites
    `);

    const row = result.rows?.[0] ?? {};

    return {
      tournois: row.tournois ?? 0,
      equipes: row.equipes ?? 0,
      joueurs: row.joueurs ?? 0,
      commandites: row.commandites ?? 0,
    };
  }

  const result = await pool.query(
    `
    SELECT
      1::int AS tournois,
      (
        SELECT COUNT(*)::int
        FROM equipes
        WHERE tournoi_id = $1
      ) AS equipes,
      (
        SELECT COUNT(*)::int
        FROM participants
        WHERE tournoi_id = $1
      ) AS joueurs,
      (
        SELECT COUNT(*)::int
        FROM commandites
        WHERE tournoi_id = $1
      ) AS commandites
    `,
    [tid]
  );

  const row = result.rows?.[0] ?? {};

  return {
    tournois: row.tournois ?? 0,
    equipes: row.equipes ?? 0,
    joueurs: row.joueurs ?? 0,
    commandites: row.commandites ?? 0,
  };
}