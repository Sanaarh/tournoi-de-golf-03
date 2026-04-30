/**
 * --------------------------------------------------------------------
 * Routes d'administration des tournois
 * --------------------------------------------------------------------
 *
 * Ce routeur permet de gérer les tournois côté administration.
 *
 * Fonctionnalités disponibles :
 * - lister tous les tournois
 * - récupérer un tournoi selon son identifiant
 * - créer un nouveau tournoi
 * - modifier un tournoi existant
 * - supprimer un tournoi
 *
 * Accès :
 * - toutes les routes sont protégées par le middleware `requireAdmin`
 *
 * Validation :
 * - la validation des identifiants et du body est déléguée à
 *   `tournois.validator.js`
 *
 * Accès aux données :
 * - les opérations de lecture/écriture sont déléguées au repository
 *   `tournoi.repository.js`
 */

import express from "express";
import requireAdmin from "../middlewares/requireAdmin.js";
import {
  parseId,
  validateTournoiPayload,
} from "../validators/tournois.validator.js";
import {
  listTournois,
  findTournoiById,
  createTournoi,
  updateTournoi,
  deleteTournoi,
  existsTournoiByNom,
  countPlacesCommanditesPayeesByTournoi,
} from "../dal/tournoi.repository.js";

/**
 * Instance du routeur Express pour les tournois.
 */
const router = express.Router();

/**
 * --------------------------------------------------------------------
 * GET /
 * --------------------------------------------------------------------
 * Retourne la liste complète des tournois.
 *
 * Route finale :
 * - GET /admin/tournois
 *
 * Réponses :
 * - 200 : liste des tournois
 * - 500 : erreur serveur
 */
router.get("/", requireAdmin, async (req, res) => {
  try {
    /**
     * Lecture de tous les tournois via le repository.
     */
    const tournois = await listTournois();

    return res.status(200).json(tournois);
  } catch (err) {
    console.error("GET /admin/tournois:", err);
    return res.status(500).json({ message: "Erreur serveur" });
  }
});

/**
 * --------------------------------------------------------------------
 * GET /:id
 * --------------------------------------------------------------------
 * Retourne un tournoi précis selon son identifiant.
 *
 * Route finale :
 * - GET /admin/tournois/:id
 *
 * Paramètres :
 * - id : identifiant numérique du tournoi
 *
 * Réponses :
 * - 200 : tournoi trouvé
 * - 400 : identifiant invalide
 * - 404 : tournoi introuvable
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
     * Recherche du tournoi par son identifiant.
     */
    const tournoi = await findTournoiById(id);

    if (!tournoi) {
      return res.status(404).json({ message: "Tournoi introuvable" });
    }

    return res.status(200).json(tournoi);
  } catch (err) {
    console.error("GET /admin/tournois/:id:", err);
    return res.status(500).json({ message: "Erreur serveur" });
  }
});

/**
 * --------------------------------------------------------------------
 * POST /
 * --------------------------------------------------------------------
 * Crée un nouveau tournoi.
 *
 * Route finale :
 * - POST /admin/tournois
 *
 * Étapes :
 * 1. valider le body
 * 2. vérifier qu'aucun tournoi du même nom n'existe déjà
 * 3. créer le tournoi
 *
 * Réponses :
 * - 201 : tournoi créé
 * - 400 : validation impossible
 * - 409 : nom déjà utilisé ou autre tournoi déjà ouvert
 * - 500 : erreur serveur
 */
router.post("/", requireAdmin, async (req, res) => {
  /**
   * Validation et nettoyage des données du body.
   *
   * IMPORTANT :
   * validateTournoiPayload peut être asynchrone,
   * donc il faut attendre son résultat.
   */
  const { ok, errors, cleaned } = await validateTournoiPayload(req.body);

  if (!ok) {
    return res.status(400).json({
      message: "Validation impossible",
      errors,
    });
  }

  try {
    /**
     * Vérifie l'unicité du nom du tournoi avant création.
     */
    const nomExiste = await existsTournoiByNom(cleaned.nom);

    if (nomExiste) {
      return res.status(409).json({
        message: "Validation impossible",
        errors: {
          nom: "Un tournoi avec ce nom existe déjà.",
        },
      });
    }

    /**
     * Création du tournoi via le repository.
     */
    const tournoi = await createTournoi(cleaned);

    return res.status(201).json(tournoi);
  } catch (err) {
    /**
     * Gestion explicite de la contrainte PostgreSQL :
     * un seul tournoi peut être ouvert à la fois.
     */
    if (err?.constraint === "uq_un_seul_tournoi_ouvert") {
      return res.status(409).json({
        message: "Création refusée",
        errors: {
          tournoi:
            "Un autre tournoi est déjà ouvert. La création d’un autre tournoi ouvert n’est pas possible.",
        },
      });
    }

    /**
     * On log aussi err.detail lorsqu'il existe,
     * ce qui est utile avec PostgreSQL.
     */
    console.error("POST /admin/tournois:", err?.message, err?.detail || "");

    return res.status(500).json({
      message: "Erreur serveur",
      detail: err?.detail || err?.message || null,
    });
  }
});

/**
 * --------------------------------------------------------------------
 * PUT /:id
 * --------------------------------------------------------------------
 * Modifie un tournoi existant.
 *
 * Route finale :
 * - PUT /admin/tournois/:id
 *
 * Étapes :
 * 1. valider l'id
 * 2. valider le body
 * 3. vérifier qu'aucun autre tournoi ne porte déjà le même nom
 * 4. appliquer la mise à jour
 *
 * Réponses :
 * - 200 : tournoi modifié
 * - 400 : id invalide ou validation impossible
 * - 404 : tournoi introuvable
 * - 409 : nom déjà utilisé
 * - 500 : erreur serveur
 */
router.put("/:id", requireAdmin, async (req, res) => {
  /**
   * Validation de l'identifiant à modifier.
   */
  const id = parseId(req.params.id);

  if (!id) {
    return res.status(400).json({ message: "ID invalide" });
  }

  /**
   * Validation et nettoyage du body.
   *
   * IMPORTANT :
   * validateTournoiPayload peut être asynchrone,
   * donc il faut attendre son résultat.
   */
  const { ok, errors, cleaned } = await validateTournoiPayload(req.body);

  if (!ok) {
    return res.status(400).json({
      message: "Validation impossible",
      errors,
    });
  }

  try {
    /**
     * Vérifie l'unicité du nom, en excluant le tournoi courant.
     * Cela évite de considérer le même tournoi comme un doublon.
     */
    const nomExiste = await existsTournoiByNom(cleaned.nom, id);

    if (nomExiste) {
      return res.status(409).json({
        message: "Validation impossible",
        errors: {
          nom: "Un tournoi avec ce nom existe déjà.",
        },
      });
    }

    const placesCommanditesPayees = await countPlacesCommanditesPayeesByTournoi(id);
    if (cleaned.limite_commandites < placesCommanditesPayees) {
      return res.status(409).json({
        message: "Validation impossible",
        errors: {
          limite_commandites:
            `Impossible de réduire le quota commandites à ${cleaned.limite_commandites}: ${placesCommanditesPayees} place(s) commanditée(s) sont déjà utilisées.`,
        },
      });
    }

    /**
     * Mise à jour du tournoi.
     */
    const tournoi = await updateTournoi(id, cleaned);

    if (!tournoi) {
      return res.status(404).json({ message: "Tournoi introuvable" });
    }

    return res.status(200).json(tournoi);
  } catch (err) {
    console.error("PUT /admin/tournois/:id:", err?.message, err?.detail || "");

    return res.status(500).json({
      message: "Erreur serveur",
      detail: err?.detail || err?.message || null,
    });
  }
});

/**
 * --------------------------------------------------------------------
 * DELETE /:id
 * --------------------------------------------------------------------
 * Supprime un tournoi existant.
 *
 * Route finale :
 * - DELETE /admin/tournois/:id
 *
 * Paramètres :
 * - id : identifiant numérique du tournoi à supprimer
 *
 * Réponses :
 * - 200 : tournoi supprimé
 * - 400 : id invalide
 * - 404 : tournoi introuvable
 * - 500 : erreur serveur
 */
router.delete("/:id", requireAdmin, async (req, res) => {
  /**
   * Validation de l'identifiant à supprimer.
   */
  const id = parseId(req.params.id);

  if (!id) {
    return res.status(400).json({ message: "ID invalide" });
  }

  try {
    /**
     * Suppression via le repository.
     * On suppose que le repository retourne le tournoi supprimé,
     * ou null si aucun tournoi n'a été trouvé.
     */
    const tournoi = await deleteTournoi(id);

    if (!tournoi) {
      return res.status(404).json({ message: "Tournoi introuvable" });
    }

    return res.status(200).json({
      message: "Tournoi supprimé",
      tournoi,
    });
  } catch (err) {
    console.error("DELETE /admin/tournois/:id:", err?.message, err?.detail || "");

    return res.status(500).json({
      message: "Erreur serveur",
      detail: err?.detail || null,
    });
  }
});

/**
 * Export du routeur pour montage dans l'application principale.
 */
export default router;