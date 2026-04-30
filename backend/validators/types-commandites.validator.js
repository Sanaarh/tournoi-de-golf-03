// backend/validators/types-commandites.validator.js

/**
 * =============================================================================
 * TYPES COMMANDITES VALIDATOR
 * =============================================================================
 *
 * Ce module contient les fonctions de validation et de normalisation
 * des payloads utilisés pour créer ou modifier un type de commandite.
 *
 * Objectif :
 * - Nettoyer les valeurs reçues
 * - Vérifier les contraintes de base
 * - Retourner des données prêtes à être utilisées
 *
 * Format retourné :
 * {
 *   ok: boolean,        // true si aucune erreur
 *   errors: object,     // liste des erreurs par champ
 *   cleaned: object     // données nettoyées
 * }
 */

/**
 * Longueur maximale autorisée pour la description.
 */
const DESCRIPTION_MAX = 2000;

/**
 * Nettoie un texte simple.
 *
 * Comportement :
 * - Retourne null si la valeur n'est pas une chaîne
 * - Supprime les espaces au début et à la fin
 * - Retourne null si la chaîne est vide après nettoyage
 *
 * @param {*} value Valeur brute reçue
 * @returns {string|null} Texte nettoyé ou null
 */
function normalizeText(value) {
  if (typeof value !== "string") return null;

  const v = value.trim();

  return v.length ? v : null;
}

/**
 * Nettoie la description.
 *
 * Différence avec normalizeText :
 * - accepte undefined ou null
 * - retourne null si vide
 *
 * Cette fonction permet de traiter correctement
 * un champ description optionnel.
 *
 * @param {*} value Valeur brute reçue
 * @returns {string|null} Description nettoyée ou null
 */
function normalizeDescription(value) {
  if (value === undefined || value === null) return null;

  if (typeof value !== "string") return null;

  const v = value.trim();

  return v.length ? v : null;
}

/**
 * Convertit une valeur en entier >= 0.
 *
 * Utilisé pour :
 * - prix_cents
 * - places_incluses
 *
 * Fonctionnement :
 * - convertit la valeur en nombre
 * - tronque les décimales
 * - refuse les valeurs négatives
 *
 * @param {*} value Valeur brute
 * @returns {number|null} Entier valide ou null
 */
function parseIntGE0(value) {
  const n = Number(value);

  if (!Number.isFinite(n)) return null;

  const i = Math.trunc(n);

  if (i < 0) return null;

  return i;
}

/**
 * Convertit une valeur en entier >= 1.
 *
 * Utilisé pour :
 * - quota (doit être au moins 1)
 *
 * @param {*} value Valeur brute
 * @returns {number|null} Entier valide ou null
 */
function parseIntGTE1(value) {
  const n = Number(value);

  if (!Number.isFinite(n)) return null;

  const i = Math.trunc(n);

  if (i < 1) return null;

  return i;
}

/**
 * Convertit une valeur brute en identifiant valide.
 *
 * Règles :
 * - doit être un entier strictement positif
 *
 * @param {*} raw Valeur brute
 * @returns {number|null} ID valide ou null
 */
export function parseId(raw) {
  const id = Number(raw);

  if (!Number.isInteger(id) || id <= 0) return null;

  return id;
}

/**
 * =============================================================================
 * Validation d'un type de commandite
 * =============================================================================
 *
 * Champs attendus :
 *
 * - tournoi_id        (obligatoire, entier > 0)
 * - nom               (obligatoire, texte <= 120 caractères)
 * - prix_cents        (obligatoire, entier >= 0)
 * - quota             (obligatoire, entier >= 1)
 * - places_incluses   (obligatoire, entier >= 0)
 * - description       (optionnelle, texte <= 2000 caractères)
 *
 * Cette fonction :
 * - valide les données reçues
 * - normalise les valeurs
 * - retourne un objet cleaned prêt à être utilisé
 *
 * @param {object} body Corps de requête reçu
 *
 * @returns {{
 *   ok: boolean,
 *   errors: object,
 *   cleaned: {
 *     tournoi_id: number|null,
 *     nom: string|null,
 *     prix_cents: number,
 *     quota: number,
 *     places_incluses: number,
 *     description: string|null
 *   }
 * }}
 */
export function validateTypeCommanditePayload(body) {
  const errors = {};

  /**
   * Nettoyage des champs principaux.
   */
  const tournoi_id = parseId(body?.tournoi_id);

  const nom = normalizeText(body?.nom);

  /**
   * Conversion des champs numériques.
   *
   * Ces valeurs sont converties avant validation
   * afin d'assurer leur format correct.
   */
  const prix_cents = parseIntGE0(body?.prix_cents);

  const quota = parseIntGTE1(body?.quota);

  const places_incluses = parseIntGE0(body?.places_incluses);

  /**
   * Nettoyage de la description.
   *
   * On vérifie également sa longueur maximale.
   */
  const descriptionRaw = normalizeDescription(body?.description);

  let description = descriptionRaw;

  if (descriptionRaw && descriptionRaw.length > DESCRIPTION_MAX) {
    description = null;

    errors.description =
      `La description ne doit pas dépasser ${DESCRIPTION_MAX} caractères.`;
  }

  /**
   * ==========================================================
   * Validation des champs obligatoires
   * ==========================================================
   */

  if (!tournoi_id) {
    errors.tournoi_id =
      "tournoi_id est obligatoire et doit être un entier positif.";
  }

  if (!nom) {
    errors.nom =
      "Le nom de la commandite est obligatoire.";
  }
  else if (nom.length > 120) {
    errors.nom =
      "Nom trop long (max 120 caractères).";
  }

  /**
   * ==========================================================
   * Validation des valeurs numériques
   * ==========================================================
   */

  if (prix_cents === null) {
    errors.prix_cents =
      "prix_cents est obligatoire et doit être un entier ≥ 0 (en cents).";
  }

  if (quota === null) {
    errors.quota =
      "quota est obligatoire et doit être un entier ≥ 1.";
  }

  if (places_incluses === null) {
    errors.places_incluses =
      "places_incluses est obligatoire et doit être un entier ≥ 0.";
  }

  /**
   * Détermine si la validation est réussie.
   */
  const ok = Object.keys(errors).length === 0;

  /**
   * Retour des données nettoyées.
   *
   * Même en cas d'erreur, cleaned est retourné
   * pour conserver une structure stable.
   */
  return {
    ok,
    errors,
    cleaned: {
      tournoi_id: tournoi_id ?? null,
      nom,
      prix_cents: prix_cents ?? 0,
      quota: quota ?? 0,
      places_incluses: places_incluses ?? 0,
      description,
    },
  };
}