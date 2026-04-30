/**
 * =============================================================================
 * UTILS — Fonctions utilitaires de validation
 * =============================================================================
 *
 * Fichier :
 * backend/utils/validation.js
 *
 * Objectif :
 * Fournir des fonctions utilitaires réutilisables
 * pour valider et convertir des données dans tout le projet.
 *
 * Fonctions disponibles :
 * - isNonEmptyString → vérifie qu'une string est valide
 * - isISODate → vérifie un format de date ISO (YYYY-MM-DD)
 * - toInt → convertit une valeur en entier
 * - parseBool → convertit une valeur en booléen
 * - validationError → retourne un format standard d'erreur
 *
 * Remarque :
 * Ces fonctions sont utilisées par :
 * - validators
 * - middlewares
 * - routes
 */


/**
 * Vérifie qu'une valeur est une chaîne non vide.
 *
 * @param {unknown} value
 * Valeur à vérifier.
 *
 * @param {number|null} maxLen
 * Longueur maximale autorisée (optionnelle).
 *
 * @returns {boolean}
 * true si la chaîne est valide, sinon false.
 */
export function isNonEmptyString(value, maxLen = null) {

  /**
   * Vérifie que la valeur est une chaîne
   */
  if (typeof value !== "string") return false;

  /**
   * Supprime les espaces inutiles
   */
  const v = value.trim();

  /**
   * Vérifie que la chaîne n'est pas vide
   */
  if (!v) return false;

  /**
   * Vérifie la longueur maximale si définie
   */
  if (maxLen && v.length > maxLen) return false;

  return true;
}


/**
 * Vérifie qu'une valeur correspond à une date ISO simple.
 *
 * Format attendu :
 * YYYY-MM-DD
 *
 * @param {unknown} value
 * Valeur à vérifier.
 *
 * @returns {boolean}
 * true si la date est valide, sinon false.
 */
export function isISODate(value) {

  /**
   * Vérifie que la valeur est une chaîne
   */
  if (typeof value !== "string") return false;

  /**
   * Vérifie le format YYYY-MM-DD
   */
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  /**
   * Vérifie que la date existe réellement
   */
  const d = new Date(value);

  return !Number.isNaN(d.getTime());
}


/**
 * Convertit une valeur en entier si possible.
 *
 * @param {unknown} value
 * Valeur à convertir.
 *
 * @returns {number|null}
 * - entier valide
 * - sinon null
 */
export function toInt(value) {

  /**
   * Conversion en nombre
   */
  const n = Number(value);

  /**
   * Vérifie que c'est un entier
   */
  return Number.isInteger(n) ? n : null;
}


/**
 * Convertit une valeur en booléen.
 *
 * Valeurs acceptées :
 * - true
 * - false
 * - "true"
 * - "false"
 *
 * @param {unknown} value
 *
 * @returns {boolean|null}
 * true, false ou null si invalide.
 */
export function parseBool(value) {

  /**
   * Cas boolean direct
   */
  if (typeof value === "boolean") return value;

  /**
   * Cas string "true"
   */
  if (value === "true") return true;

  /**
   * Cas string "false"
   */
  if (value === "false") return false;

  /**
   * Valeur invalide
   */
  return null;
}


/**
 * Génère un objet d'erreur de validation standard.
 *
 * Ce format est utilisé par :
 * - middlewares validate()
 * - routes API
 *
 * @param {object} errors
 * Liste des erreurs détectées.
 *
 * @returns {object}
 * Objet standardisé contenant :
 * {
 *   message: string,
 *   errors: object
 * }
 */
export function validationError(errors) {

  /**
   * Retour format standard
   */
  return {
    message: "Validation impossible",
    errors,
  };
}