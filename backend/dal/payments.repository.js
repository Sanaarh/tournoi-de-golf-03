/**
 * =============================================================================
 * DAL — PAYMENTS REPOSITORY
 * =============================================================================
 *
 * Fichier :
 * dal/payments.repository.js
 *
 * Rôle :
 * Gérer l'accès aux données liées aux paiements.
 *
 * Objectifs :
 * - Lire les informations d'un tournoi avant paiement
 * - Créer un paiement en attente
 * - Retrouver un paiement via Stripe
 * - Mettre à jour le statut d'un paiement
 * - Retourner les informations de confirmation
 *
 * IMPORTANT :
 * - Ce fichier ne contient que du SQL
 * - Aucun traitement HTTP ici
 * - Les erreurs sont gérées dans les routes ou services
 */

import { pool } from "../db/db.js";

/**
 * =============================================================================
 * Création d'un paiement en attente
 * =============================================================================
 *
 * Cette fonction crée une nouvelle entrée dans la table paiements
 * avec le statut 'EN_ATTENTE'.
 *
 * Supporte deux cas :
 * - Paiement d'un participant
 * - Paiement d'une commandite
 *
 * Le champ devise est fixé à 'cad'.
 *
 * @param {object} params
 * @param {number} params.tournoiId ID du tournoi
 * @param {number} params.montantCents Montant en cents
 * @param {string} params.stripeSessionId ID Stripe
 * @param {number|null} [params.participantId=null]
 * @param {number|null} [params.commanditeId=null]
 *
 * @returns {Promise<object|null>}
 */
export async function createPaiementEnAttente({
  tournoiId,
  montantCents,
  stripeSessionId,
  participantId = null,
  commanditeId = null,
}) {
  const result = await pool.query(
    `
    INSERT INTO paiements (
      tournoi_id,
      participant_id,
      commandite_id,
      montant_cents,
      devise,
      stripe_session_id,
      statut
    )
    VALUES ($1, $2, $3, $4, 'cad', $5, 'EN_ATTENTE')
    RETURNING id
    `,
    [
      tournoiId,
      participantId,
      commanditeId,
      montantCents,
      stripeSessionId,
    ]
  );

  /**
   * Retourne l'identifiant du paiement créé
   * ou null si aucun résultat
   */
  return result.rows[0] ?? null;
}

/**
 * =============================================================================
 * Recherche d'un tournoi pour paiement
 * =============================================================================
 *
 * Permet de récupérer :
 * - le nom
 * - le prix joueur
 * - si les inscriptions sont ouvertes
 *
 * Utilisé avant création de session Stripe.
 *
 * @param {number} tournoiId
 * @returns {Promise<object|null>}
 */
export async function findTournoiForPayment(tournoiId) {
  const result = await pool.query(
    `
    SELECT id, nom, prix_joueur, inscriptions_ouvertes
    FROM tournois
    WHERE id = $1
    `,
    [tournoiId]
  );

  return result.rows[0] ?? null;
}

/**
 * =============================================================================
 * Recherche d'un paiement via Stripe
 * =============================================================================
 *
 * Utilisé principalement dans :
 * - webhook Stripe
 * - validation retour paiement
 *
 * @param {string} stripeSessionId
 * @returns {Promise<object|null>}
 */
export async function findPaiementByStripeSessionId(stripeSessionId) {
  const result = await pool.query(
    `
    SELECT
      id,
      statut,
      tournoi_id,
      participant_id,
      commandite_id
    FROM paiements
    WHERE stripe_session_id = $1
    LIMIT 1
    `,
    [stripeSessionId]
  );

  return result.rows[0] ?? null;
}

/**
 * =============================================================================
 * Marquer un paiement en échec
 * =============================================================================
 *
 * Met à jour :
 * - statut = ECHEC
 * - stripe_payment_intent_id
 *
 * Utilisé quand Stripe signale un échec.
 *
 * @param {object} params
 * @param {string} params.stripeSessionId
 * @param {string|null} params.paymentIntentId
 *
 * @returns {Promise<void>}
 */
export async function markPaiementEchec({
  stripeSessionId,
  paymentIntentId = null,
}) {
  await pool.query(
    `
    UPDATE paiements
    SET
      statut = 'ECHEC',
      stripe_payment_intent_id = $1
    WHERE stripe_session_id = $2
    `,
    [paymentIntentId, stripeSessionId]
  );
}

/**
 * =============================================================================
 * Marquer un paiement comme payé
 * =============================================================================
 *
 * Met à jour :
 * - statut = PAYE
 * - participant_id ou commandite_id
 * - stripe_payment_intent_id
 *
 * Utilisé après confirmation Stripe.
 *
 * @param {object} params
 * @param {string} params.stripeSessionId
 * @param {string|null} params.paymentIntentId
 * @param {number|null} [params.participantId=null]
 * @param {number|null} [params.commanditeId=null]
 *
 * @returns {Promise<void>}
 */
export async function markPaiementPaye({
  stripeSessionId,
  paymentIntentId = null,
  participantId = null,
  commanditeId = null,
}) {
  await pool.query(
    `
    UPDATE paiements
    SET
      statut = 'PAYE',
      stripe_payment_intent_id = $1,
      participant_id = $2,
      commandite_id = $3
    WHERE stripe_session_id = $4
    `,
    [
      paymentIntentId,
      participantId,
      commanditeId,
      stripeSessionId,
    ]
  );
}

/**
 * =============================================================================
 * Recherche des informations de confirmation
 * =============================================================================
 *
 * Retourne toutes les informations nécessaires
 * après un paiement réussi.
 *
 * Supporte :
 * - confirmation participant
 * - confirmation commandite
 *
 * Jointures utilisées :
 * - participants
 * - équipes
 * - commandites
 *
 * @param {string} stripeSessionId
 * @returns {Promise<object|null>}
 */
export async function findConfirmationBySessionId(stripeSessionId) {
  const result = await pool.query(
    `
    SELECT
      pay.id AS paiement_id,
      pay.stripe_session_id,
      pay.statut AS paiement_statut,
      pay.montant_cents,
      pay.date_creation AS paiement_date,

      part.id AS participant_id,
      part.prenom AS participant_prenom,
      part.nom AS participant_nom,
      part.courriel AS participant_courriel,

      eq.id AS equipe_id,
      eq.nom_equipe,
      eq.code_secret,

      cmd.id AS commandite_id,
      cmd.statut AS commandite_statut

    FROM paiements pay

    LEFT JOIN participants part
      ON part.id = pay.participant_id

    LEFT JOIN membres_equipes me
      ON me.participant_id = part.id

    LEFT JOIN equipes eq
      ON eq.id = me.equipe_id

    LEFT JOIN commandites cmd
      ON cmd.id = pay.commandite_id

    WHERE pay.stripe_session_id = $1
    LIMIT 1
    `,
    [stripeSessionId]
  );

  return result.rows[0] ?? null;
}