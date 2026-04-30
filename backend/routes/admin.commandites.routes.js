/**
 * --------------------------------------------------------------------
 * Routes d'administration des commandites inscrites
 * --------------------------------------------------------------------
 *
 * Ce routeur permet à un administrateur de :
 * - lister les commandites d’un tournoi
 * - consulter le détail d’une commandite
 * - modifier une commandite existante
 * - supprimer une commandite
 *
 * Montage dans server.js :
 *   /admin/commandites
 *
 * Endpoints disponibles :
 * - GET    /admin/commandites?tournoi_id=
 * - GET    /admin/commandites/:id
 * - PUT    /admin/commandites/:id
 * - DELETE /admin/commandites/:id
 *
 * Sécurité :
 * - Toutes les routes passent par le middleware `requireAdmin`
 *   afin de restreindre l’accès aux administrateurs.
 */

import express from "express";
import requireAdmin from "../middlewares/requireAdmin.js";
import {
  parseId,
  validateUpdateCommanditePayload,
} from "../validators/commandites.admin.validator.js";
import {
  listCommanditesByTournoi,
  findCommanditeAdminById,
  updateCommanditeById,
  deleteCommanditeById,
} from "../dal/admin.commandites.repository.js";

/**
 * Instance du routeur Express dédiée aux commandites côté admin.
 */
const router = express.Router();

/**
 * --------------------------------------------------------------------
 * GET /
 * --------------------------------------------------------------------
 * Liste toutes les commandites rattachées à un tournoi.
 *
 * Query params attendus :
 * - tournoi_id : identifiant numérique du tournoi
 *
 * Exemple :
 *   GET /admin/commandites?tournoi_id=3
 *
 * Réponses possibles :
 * - 200 : liste retournée avec succès
 * - 400 : tournoi_id absent ou invalide
 * - 500 : erreur serveur
 */
router.get("/", requireAdmin, async (req, res) => {
  /**
   * On récupère l'identifiant du tournoi depuis la query string
   * puis on le valide/convertit avec `parseId`.
   *
   * Exemple :
   * req.query.tournoi_id = "5"  ->  5
   * req.query.tournoi_id = "abc" -> invalide
   */
  const tournoi_id = parseId(req.query?.tournoi_id);

  /**
   * Si l'identifiant est absent ou invalide, on arrête immédiatement
   * la requête avec une erreur 400 (Bad Request).
   */
  if (!tournoi_id) {
    return res.status(400).json({
      message: "tournoi_id obligatoire et invalide.",
    });
  }

  try {
    /**
     * Appel au repository pour récupérer les commandites
     * du tournoi demandé.
     */
    const rows = await listCommanditesByTournoi(tournoi_id);

    /**
     * On retourne simplement la liste telle qu’elle vient
     * de la couche d’accès aux données.
     */
    return res.status(200).json(rows);
  } catch (err) {
    /**
     * En cas d’erreur imprévue (SQL, connexion DB, etc.),
     * on log l’erreur côté serveur et on renvoie un 500.
     */
    console.error("GET /admin/commandites:", err);
    return res.status(500).json({ message: "Erreur serveur" });
  }
});

/**
 * --------------------------------------------------------------------
 * GET /:id
 * --------------------------------------------------------------------
 * Retourne le détail d’une commandite précise selon son identifiant.
 *
 * Paramètres :
 * - id : identifiant numérique de la commandite
 *
 * Exemple :
 *   GET /admin/commandites/12
 *
 * Réponses possibles :
 * - 200 : commandite trouvée
 * - 400 : id invalide
 * - 404 : commandite inexistante
 * - 500 : erreur serveur
 */
router.get("/:id", requireAdmin, async (req, res) => {
  /**
   * Validation de l'identifiant reçu dans l'URL.
   */
  const id = parseId(req.params.id);

  if (!id) {
    return res.status(400).json({ message: "ID invalide" });
  }

  try {
    /**
     * Recherche de la commandite par son identifiant.
     */
    const row = await findCommanditeAdminById(id);

    /**
     * Si aucune ligne n'est trouvée, on renvoie 404.
     */
    if (!row) {
      return res.status(404).json({ message: "Commandite introuvable" });
    }

    /**
     * Sinon, on retourne l’objet trouvé.
     */
    return res.status(200).json(row);
  } catch (err) {
    console.error("GET /admin/commandites/:id:", err);
    return res.status(500).json({ message: "Erreur serveur" });
  }
});

/**
 * --------------------------------------------------------------------
 * PUT /:id
 * --------------------------------------------------------------------
 * Met à jour une commandite existante.
 *
 * Paramètres :
 * - id : identifiant numérique de la commandite à modifier
 *
 * Corps attendu :
 * - données modifiables d’une commandite
 *
 * Étapes :
 * 1. Valider l'id
 * 2. Valider et nettoyer le body avec le validator
 * 3. Appeler le repository pour faire la mise à jour
 * 4. Retourner le bon code HTTP selon le résultat
 *
 * Réponses possibles :
 * - 200 : mise à jour réussie
 * - 400 : id invalide ou payload invalide
 * - 404 : commandite inexistante
 * - 500 : erreur serveur
 */
router.put("/:id", requireAdmin, async (req, res) => {
  /**
   * Validation de l'identifiant de la commandite.
   */
  const id = parseId(req.params.id);

  if (!id) {
    return res.status(400).json({ message: "ID invalide" });
  }

  /**
   * Validation du corps de la requête.
   *
   * Le validator retourne généralement :
   * - ok      : booléen indiquant si la validation passe
   * - errors  : tableau/liste des erreurs de validation
   * - cleaned : version nettoyée/prête à être envoyée au repository
   */
  const { ok, errors, cleaned } = validateUpdateCommanditePayload(req.body);

  if (!ok) {
    return res.status(400).json({
      message: "Validation impossible",
      errors,
    });
  }

  try {
    /**
     * Tentative de mise à jour en base.
     *
     * Le repository retourne un objet de résultat,
     * par exemple :
     * - { ok: true, row: ... }
     * - { ok: false, code: "NOT_FOUND" }
     * - { ok: false, message: "..." }
     */
    const result = await updateCommanditeById(id, cleaned);

    /**
     * Si la mise à jour échoue, on interprète le code retour
     * pour envoyer la bonne réponse HTTP.
     */
    if (!result.ok) {
      if (result.code === "NOT_FOUND") {
        return res.status(404).json({ message: "Commandite introuvable" });
      }

      return res.status(400).json({
        message: result.message || "Mise à jour impossible.",
      });
    }

    /**
     * Si tout s’est bien passé, on retourne un message de succès
     * ainsi que la commandite mise à jour.
     */
    return res.status(200).json({
      message: "Commandite mise à jour",
      commandite: result.row,
    });
  } catch (err) {
    console.error("PUT /admin/commandites/:id:", err);
    return res.status(500).json({ message: "Erreur serveur" });
  }
});

/**
 * --------------------------------------------------------------------
 * DELETE /:id
 * --------------------------------------------------------------------
 * Supprime une commandite à partir de son identifiant.
 *
 * Paramètres :
 * - id : identifiant numérique de la commandite à supprimer
 *
 * Réponses possibles :
 * - 200 : suppression réussie
 * - 400 : id invalide
 * - 404 : commandite inexistante
 * - 500 : erreur serveur
 */
router.delete("/:id", requireAdmin, async (req, res) => {
  /**
   * Validation de l'identifiant passé dans l'URL.
   */
  const id = parseId(req.params.id);

  if (!id) {
    return res.status(400).json({ message: "ID invalide" });
  }

  try {
    /**
     * Suppression de la commandite.
     *
     * Le repository retourne généralement :
     * - true  : suppression effectuée
     * - false : aucune ligne trouvée à supprimer
     */
    const deleted = await deleteCommanditeById(id);

    if (!deleted) {
      return res.status(404).json({ message: "Commandite introuvable" });
    }

    return res.status(200).json({ message: "Commandite supprimée" });
  } catch (err) {
    console.error("DELETE /admin/commandites/:id:", err);
    return res.status(500).json({ message: "Erreur serveur" });
  }
});

/**
 * Export du routeur afin de pouvoir le monter
 * dans le point d’entrée principal de l’application.
 */
export default router;