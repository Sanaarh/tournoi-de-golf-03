/**
 * --------------------------------------------------------------------
 * Routes d'administration des types de commandites
 * --------------------------------------------------------------------
 *
 * Ce routeur permet de gérer les types de commandites côté administration.
 *
 * Fonctionnalités disponibles :
 * - lister tous les types de commandites
 * - filtrer les types de commandites par tournoi
 * - récupérer un type de commandite selon son identifiant
 * - créer un nouveau type de commandite
 * - modifier un type de commandite existant
 * - supprimer un type de commandite
 *
 * Base de routage :
 * - montée dans server.js sous /admin/types-commandites
 *
 * Endpoints principaux :
 * - GET    /admin/types-commandites
 * - GET    /admin/types-commandites/:id
 * - POST   /admin/types-commandites
 * - PUT    /admin/types-commandites/:id
 * - DELETE /admin/types-commandites/:id
 *
 * Accès :
 * - toutes les routes sont protégées par le middleware `requireAdmin`
 *
 * Validation :
 * - la validation des ids et du body est déléguée à
 *   `types-commandites.validator.js`
 *
 * Données :
 * - les opérations de lecture/écriture sont déléguées aux repositories
 *   `types-commandites.repository.js` et `tournoi.repository.js`
 */

import express from "express";
import requireAdmin from "../middlewares/requireAdmin.js";
import {
  parseId,
  validateTypeCommanditePayload,
} from "../validators/types-commandites.validator.js";
import {
  listTypesCommandites,
  listTypesCommanditesByTournoi,
  findTypeCommanditeById,
  createTypeCommandite,
  updateTypeCommandite,
  deleteTypeCommandite,
  sumQuotasTypesForTournoi,
  countCommanditesForType,
} from "../dal/types-commandites.repository.js";
import { findTournoiById } from "../dal/tournoi.repository.js";

/**
 * Instance du routeur Express pour les types de commandites.
 */
const router = express.Router();

/**
 * Vérifie que le total des places commanditées allouées par les types
 * ne dépasse pas la limite fixée sur le tournoi.
 *
 * Règle :
 * - total = somme( quota * places_incluses ) sur les types
 * - ce total doit rester <= limite_commandites du tournoi
 *
 * @param {object} tournoi Tournoi cible
 * @param {number} sumOthers Somme des places des autres types
 * @param {number} newPlaces Nouveau volume (quota * places_incluses)
 * @returns {object|null} objet d'erreur de validation ou null si valide
 */
function assertQuotasWithinTournoiLimite(tournoi, sumOthers, newPlaces) {
  const limite = Number(tournoi?.limite_commandites ?? 0);

  /**
   * Si la limite est absente, nulle ou <= 0,
   * on considère qu'il n'y a pas de restriction à appliquer.
   */
  if (limite <= 0) return null;

  const n = Number(newPlaces);
  const add = Number.isFinite(n) ? n : 0;
  const total = sumOthers + add;

  if (total > limite) {
    return {
      quota:
        `Le total des places commanditées allouées par les types (${total}) dépasse la limite du tournoi (${limite}). Ajustez quota/places incluses, ou augmentez la limite du tournoi.`,
    };
  }

  return null;
}

/**
 * --------------------------------------------------------------------
 * GET /
 * --------------------------------------------------------------------
 * Retourne la liste des types de commandites.
 *
 * Route finale :
 * - GET /admin/types-commandites
 *
 * Paramètre optionnel :
 * - tournoi_id : permet de filtrer les types pour un tournoi précis
 *
 * Exemples :
 * - GET /admin/types-commandites
 * - GET /admin/types-commandites?tournoi_id=3
 *
 * Réponses :
 * - 200 : liste des types
 * - 400 : tournoi_id invalide
 * - 500 : erreur serveur
 */
router.get("/", requireAdmin, async (req, res) => {
  /**
   * Si tournoi_id est présent dans la query string,
   * on le valide. Sinon, on garde null pour signaler
   * qu'aucun filtre ne doit être appliqué.
   */
  const tournoiId =
    typeof req.query.tournoi_id === "string" && req.query.tournoi_id.trim()
      ? parseId(req.query.tournoi_id)
      : null;

  if (req.query.tournoi_id && !tournoiId) {
    return res.status(400).json({ message: "tournoi_id invalide" });
  }

  try {
    /**
     * Si un tournoi_id valide est fourni,
     * on retourne uniquement les types de ce tournoi.
     * Sinon, on retourne tous les types.
     */
    if (tournoiId) {
      const types = await listTypesCommanditesByTournoi(tournoiId);
      return res.status(200).json(types);
    } else {
      const types = await listTypesCommandites();
      return res.status(200).json(types);
    }
  } catch (err) {
    console.error("GET /admin/types-commandites:", err);
    return res.status(500).json({ message: "Erreur serveur" });
  }
});

/**
 * --------------------------------------------------------------------
 * GET /:id
 * --------------------------------------------------------------------
 * Retourne un type de commandite précis selon son identifiant.
 *
 * Route finale :
 * - GET /admin/types-commandites/:id
 *
 * Réponses :
 * - 200 : type trouvé
 * - 400 : id invalide
 * - 404 : type introuvable
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
    const typeCommandite = await findTypeCommanditeById(id);

    if (!typeCommandite) {
      return res.status(404).json({ message: "Type de commandite introuvable" });
    }

    return res.status(200).json(typeCommandite);
  } catch (err) {
    console.error("GET /admin/types-commandites/:id:", err);
    return res.status(500).json({ message: "Erreur serveur" });
  }
});

/**
 * --------------------------------------------------------------------
 * POST /
 * --------------------------------------------------------------------
 * Crée un nouveau type de commandite.
 *
 * Route finale :
 * - POST /admin/types-commandites
 *
 * Étapes :
 * 1. valider le body
 * 2. vérifier que le tournoi existe
 * 3. vérifier que le tournoi est encore ouvert aux inscriptions
 * 4. vérifier que la somme des quotas ne dépasse pas la limite du tournoi
 * 5. créer le type de commandite
 *
 * Réponses :
 * - 201 : type créé
 * - 400 : validation impossible
 * - 500 : erreur serveur
 */
router.post("/", requireAdmin, async (req, res) => {
  /**
   * Validation et nettoyage des données du body.
   */
  const { ok, errors, cleaned } = validateTypeCommanditePayload(req.body);

  if (!ok) {
    return res.status(400).json({
      message: "Validation impossible",
      errors,
    });
  }

  try {
    /**
     * Vérifie que le tournoi cible existe.
     */
    const tournoi = await findTournoiById(cleaned.tournoi_id);

    if (!tournoi) {
      return res.status(400).json({
        message: "Validation impossible",
        errors: {
          tournoi_id: "Le tournoi spécifié n'existe pas.",
        },
      });
    }

    /**
     * La création d'un type de commandite n'est permise
     * que si le tournoi est encore ouvert aux inscriptions.
     */
    if (!tournoi.inscriptions_ouvertes) {
      return res.status(400).json({
        message: "Validation impossible",
        errors: {
          tournoi_id:
            "La création d'un type de commandite n'est possible que pour un tournoi ouvert aux inscriptions.",
        },
      });
    }

    /**
     * Somme des quotas existants du tournoi.
     * Ici, on passe null comme id à exclure car on est en création.
     */
    const sumExisting = await sumQuotasTypesForTournoi(cleaned.tournoi_id, null);

    /**
     * Vérifie si le nouveau quota ferait dépasser
     * la limite de commandites du tournoi.
     */
    const quotaErr = assertQuotasWithinTournoiLimite(tournoi, sumExisting, cleaned.quota * cleaned.places_incluses);

    if (quotaErr) {
      return res.status(400).json({
        message: "Validation impossible",
        errors: quotaErr,
      });
    }

    /**
     * Création du type de commandite.
     */
    const typeCommandite = await createTypeCommandite(cleaned);

    return res.status(201).json(typeCommandite);
  } catch (err) {
    console.error("POST /admin/types-commandites:", err?.message, err?.detail || "");
    return res.status(500).json({
      message: "Erreur serveur",
      detail: err?.detail || null,
    });
  }
});

/**
 * --------------------------------------------------------------------
 * PUT /:id
 * --------------------------------------------------------------------
 * Modifie un type de commandite existant.
 *
 * Route finale :
 * - PUT /admin/types-commandites/:id
 *
 * Étapes :
 * 1. valider l'id
 * 2. valider le body
 * 3. vérifier que le type existe déjà
 * 4. vérifier que le tournoi cible existe
 * 5. vérifier que le nouveau quota n'est pas inférieur
 *    au nombre de commandites déjà inscrites
 * 6. vérifier que la somme des quotas reste dans la limite du tournoi
 * 7. appliquer la mise à jour
 *
 * Réponses :
 * - 200 : type modifié
 * - 400 : validation impossible
 * - 404 : type introuvable
 * - 500 : erreur serveur
 */
router.put("/:id", requireAdmin, async (req, res) => {
  /**
   * Validation de l'id dans l'URL.
   */
  const id = parseId(req.params.id);

  if (!id) {
    return res.status(400).json({ message: "ID invalide" });
  }

  /**
   * Validation du body.
   */
  const { ok, errors, cleaned } = validateTypeCommanditePayload(req.body);

  if (!ok) {
    return res.status(400).json({
      message: "Validation impossible",
      errors,
    });
  }

  try {
    /**
     * Vérifie que le type à modifier existe.
     */
    const existing = await findTypeCommanditeById(id);

    if (!existing) {
      return res.status(404).json({ message: "Type de commandite introuvable" });
    }

    /**
     * Vérifie que le tournoi cible existe.
     */
    const tournoi = await findTournoiById(cleaned.tournoi_id);

    if (!tournoi) {
      return res.status(400).json({
        message: "Validation impossible",
        errors: {
          tournoi_id: "Le tournoi spécifié n'existe pas.",
        },
      });
    }

    /**
     * Nombre de commandites déjà inscrites pour ce type.
     * On ne peut pas réduire le quota en-dessous de ce nombre.
     */
    const nbInscrits = await countCommanditesForType(id);

    if (cleaned.quota < nbInscrits) {
      return res.status(400).json({
        message: "Validation impossible",
        errors: {
          quota: `Le quota ne peut pas être inférieur au nombre de commandites déjà inscrites pour ce type (${nbInscrits}).`,
        },
      });
    }

    /**
     * Somme des quotas des autres types du tournoi.
     * Ici, on exclut l'id courant car on le remplace.
     */
    const sumOthers = await sumQuotasTypesForTournoi(cleaned.tournoi_id, id);

    const quotaErr = assertQuotasWithinTournoiLimite(tournoi, sumOthers, cleaned.quota * cleaned.places_incluses);

    if (quotaErr) {
      return res.status(400).json({
        message: "Validation impossible",
        errors: quotaErr,
      });
    }

    /**
     * Mise à jour du type de commandite.
     */
    const typeCommandite = await updateTypeCommandite(id, cleaned);

    if (!typeCommandite) {
      return res.status(404).json({ message: "Type de commandite introuvable" });
    }

    return res.status(200).json(typeCommandite);
  } catch (err) {
    console.error("PUT /admin/types-commandites/:id:", err?.message, err?.detail || "");
    return res.status(500).json({
      message: "Erreur serveur",
      detail: err?.detail || null,
    });
  }
});

/**
 * --------------------------------------------------------------------
 * DELETE /:id
 * --------------------------------------------------------------------
 * Supprime un type de commandite.
 *
 * Route finale :
 * - DELETE /admin/types-commandites/:id
 *
 * Réponses :
 * - 200 : suppression réussie
 * - 400 : id invalide
 * - 404 : type introuvable
 * - 500 : erreur serveur
 */
router.delete("/:id", requireAdmin, async (req, res) => {
  /**
   * Validation de l'id reçu dans l'URL.
   */
  const id = parseId(req.params.id);

  if (!id) {
    return res.status(400).json({ message: "ID invalide" });
  }

  try {
    /**
     * Suppression du type.
     * Le repository retourne l'objet supprimé ou null.
     */
    const deleted = await deleteTypeCommandite(id);

    if (!deleted) {
      return res.status(404).json({ message: "Type de commandite introuvable" });
    }

    return res.status(200).json({
      message: "Type de commandite supprimé",
      type_commandite: deleted,
    });
  } catch (err) {
    console.error("DELETE /admin/types-commandites/:id:", err?.message, err?.detail || "");
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