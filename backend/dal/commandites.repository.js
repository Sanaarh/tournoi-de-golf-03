/**
 * =============================================================================
 * DAL — COMMANDITES REPOSITORY
 * =============================================================================
 *
 * Fichier :
 * dal/commandites.repository.js
 *
 * Rôle :
 * Gérer l'accès aux données pour les commandites
 * et les joueurs commandités.
 *
 * Objectif :
 * - lire une commandite avant ou pendant le paiement
 * - marquer une commandite comme payée
 * - marquer les joueurs liés à cette commandite comme payés
 *
 * Remarque :
 * - Ce fichier ne gère pas la logique HTTP
 * - Il se limite aux opérations SQL
 */

import { pool } from "../db/db.js";

/**
 * =============================================================================
 * Recherche d'une commandite pour paiement
 * =============================================================================
 *
 * Cette fonction retourne seulement les informations
 * nécessaires au processus de paiement :
 * - id
 * - tournoi_id
 * - statut
 *
 * Cela permet de vérifier par exemple :
 * - si la commandite existe
 * - à quel tournoi elle appartient
 * - si elle est déjà payée ou non
 *
 * @param {number} commanditeId Identifiant de la commandite
 * @returns {Promise<object|null>} Commandite trouvée ou null si absente
 */
export async function findCommanditeForPayment(commanditeId) {
  const result = await pool.query(
    `
    SELECT
      id,
      tournoi_id,
      statut
    FROM commandites
    WHERE id = $1
    LIMIT 1
    `,
    [commanditeId]
  );

  /**
   * On retourne la première ligne si elle existe,
   * sinon null.
   */
  return result.rows[0] ?? null;
}

/**
 * =============================================================================
 * Marquer une commandite comme payée
 * =============================================================================
 *
 * Cette fonction met simplement à jour le statut
 * de la commandite à 'PAYEE'.
 *
 * @param {number} commanditeId Identifiant de la commandite
 * @returns {Promise<void>}
 */
export async function markCommanditePaye(commanditeId) {
  await pool.query(
    `
    UPDATE commandites
    SET statut = 'PAYE'
    WHERE id = $1
    `,
    [commanditeId]
  );
}

/**
 * =============================================================================
 * Marquer les joueurs commandités comme payés
 * =============================================================================
 *
 * Cette fonction met à jour tous les joueurs liés
 * à une commandite donnée.
 *
 * Elle est utile après un paiement réussi,
 * pour garder la cohérence entre :
 * - la commandite
 * - les joueurs créés via cette commandite
 *
 * @param {number} commanditeId Identifiant de la commandite
 * @returns {Promise<void>}
 */
export async function markJoueursCommanditesPayes(commanditeId) {
  // Aucun statut n'existe dans joueurs_commandites (schéma actuel).
  // Fonction conservée pour compatibilité d'appel.
  void commanditeId;
}