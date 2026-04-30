/**
 * =============================================================================
 * MIDDLEWARE — Validation générique des requêtes
 * =============================================================================
 *
 * Fichier :
 * middlewares/validate.js
 *
 * Rôle :
 * Fournir un middleware Express permettant
 * de valider les données entrantes (req).
 *
 * Fonctionnement :
 * - Appelle une fonction de validation (schemaFn)
 * - Si erreurs → retourne 400 avec message structuré
 * - Sinon → passe au middleware suivant
 *
 * Utilisation typique :
 *
 * router.post(
 *   "/route",
 *   validate(monSchema),
 *   controllerFunction
 * );
 */

import { validationError } from "../utils/validation.js";

/**
 * Middleware générique de validation.
 *
 * @param {Function} schemaFn
 * Fonction qui reçoit req et retourne :
 * - un objet d'erreurs
 * - ou null / objet vide si valide
 *
 * @returns {Function}
 * Middleware Express (req, res, next)
 */
export function validate(schemaFn) {

  /**
   * Middleware retourné.
   */
  return (req, res, next) => {

    /**
     * Exécute la validation
     */
    const errors = schemaFn(req);

    /**
     * Si erreurs détectées :
     * retourne une réponse HTTP 400
     */
    if (errors && Object.keys(errors).length > 0) {

      return res
        .status(400)
        .json(validationError(errors));
    }

    /**
     * Sinon :
     * passe au middleware suivant
     */
    next();
  };
}