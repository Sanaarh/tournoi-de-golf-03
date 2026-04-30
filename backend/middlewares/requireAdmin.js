/**
 * =============================================================================
 * MIDDLEWARE — requireAdmin
 * =============================================================================
 *
 * Fichier :
 * middlewares/requireAdmin.js
 *
 * Objectif :
 * Protéger les routes réservées aux administrateurs.
 *
 * Fonctionnement :
 * 1) Vérifie la présence du cookie "admin_id"
 * 2) Vérifie que l'id est valide (> 0)
 * 3) Vérifie que l'admin existe en base
 * 4) Attache l'admin à req.admin
 * 5) Passe au middleware suivant
 *
 * Sinon :
 * → retourne HTTP 401 (Non autorisé)
 */

import { findAdminById } from "../dal/admin.repository.js";

/**
 * Nom du cookie utilisé pour la session admin.
 * Doit correspondre à celui défini dans auth.routes.js.
 */
const COOKIE_NAME = "admin_id";

/**
 * Parse un entier positif.
 *
 * @param {unknown} raw
 * Valeur brute provenant du cookie.
 *
 * @returns {number|null}
 * - entier valide (> 0)
 * - sinon null
 */
function parsePositiveInt(raw) {
  const n = Number(raw);

  /**
   * Vérifie :
   * - entier
   * - positif
   */
  if (!Number.isInteger(n) || n <= 0) return null;

  return n;
}

/**
 * Middleware principal requireAdmin.
 *
 * Vérifie qu'un administrateur valide est connecté.
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @param {import("express").NextFunction} next
 */
export default async function requireAdmin(req, res, next) {
  try {

    /**
     * Étape 1 :
     * Lecture du cookie admin_id
     */
    const adminIdRaw =
      req.cookies?.[COOKIE_NAME];

    /**
     * Aucun cookie → utilisateur non connecté
     */
    if (!adminIdRaw) {
      return res
        .status(401)
        .json({ message: "Non connecté" });
    }

    /**
     * Étape 2 :
     * Validation du format du cookie
     */
    const adminId =
      parsePositiveInt(adminIdRaw);

    /**
     * Cookie invalide
     */
    if (!adminId) {
      return res
        .status(401)
        .json({ message: "Session invalide" });
    }

    /**
     * Étape 3 :
     * Vérifier existence admin en base
     */
    const admin =
      await findAdminById(adminId);

    /**
     * Admin inexistant
     */
    if (!admin) {
      return res
        .status(401)
        .json({ message: "Session invalide" });
    }

    /**
     * Étape 4 :
     * Attacher l'admin à la requête
     */
    req.admin = admin;

    /**
     * Alias pratique
     */
    req.adminId = admin.id;

    /**
     * Étape 5 :
     * Autoriser la suite
     */
    return next();

  } catch (err) {

    /**
     * Gestion erreur serveur
     */
    console.error(
      "requireAdmin middleware:",
      err
    );

    return res
      .status(500)
      .json({
        message: "Erreur serveur",
      });
  }
}