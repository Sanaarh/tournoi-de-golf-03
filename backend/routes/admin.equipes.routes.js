/**
 * --------------------------------------------------------------------
 * ROUTES D'ADMINISTRATION DES ÉQUIPES
 * --------------------------------------------------------------------
 *
 * Ce routeur regroupe toutes les routes permettant à un administrateur
 * de gérer les équipes d’un tournoi ainsi que certains participants
 * liés à ces équipes.
 *
 * Accès :
 * - Toutes les routes sont protégées par le middleware `requireAdmin`
 *
 * Fonctionnalités couvertes :
 * - rechercher des participants
 * - récupérer la liste complète des équipes
 * - créer une équipe
 * - supprimer une équipe
 * - consulter une équipe précise
 * - consulter les membres d’une équipe
 * - ajouter un participant existant à une équipe
 * - créer un nouveau participant puis l’ajouter à une équipe
 * - retirer un participant d’une équipe
 * - modifier une équipe
 * - gérer les joueurs commandités
 * - affecter un joueur commandité à une équipe
 * - modifier un participant
 * - déplacer un membre d’une équipe à une autre
 *
 * Important :
 * - Ce fichier ne contient pas de SQL.
 * - Les accès à la base sont délégués au repository :
 *   `../dal/admin.equipes.repository.js`
 */

import express from "express";
import requireAdmin from "../middlewares/requireAdmin.js";
import {
  addMembreToEquipe,
  countMembresEquipe,
  createEquipe,
  createParticipantAndAddToEquipe,
  deleteEquipeById,
  existsEquipeNameInTournoi,
  getAllEquipes,
  getEquipeById,
  getMembresByEquipeId,
  getParticipantById,
  isTournoiOpenByEquipeId,
  isTournoiOpenById,
  removeMembreFromEquipe,
  searchParticipants,
  updateEquipe,
  listJoueursCommanditesAdmin,
  updateJoueurCommanditeAdmin,
  deleteJoueurCommanditeAdmin,
  assignJoueurCommanditeToEquipe,
  isTournoiOpenByParticipantId,
  updateParticipantAdmin,
  moveMembreToEquipe,
} from "../dal/admin.equipes.repository.js";

import {
  parseId,
  validateAjouterMembrePayload,
  validateCreerEquipePayload,
  validateModifierEquipePayload,
  validateNouveauMembrePayload,
  validateJoueurCommanditeIdentitePayload,
  validateAssignJoueurCommanditeEquipePayload,
  validateModifierParticipantPayload,
  validateDeplacerMembrePayload,
} from "../validators/equipes.validator.js";

/**
 * Instance du routeur Express.
 */
const router = express.Router();

/**
 * Nombre maximal autorisé de membres par équipe.
 *
 * Cette constante est utilisée avant l’ajout ou le déplacement
 * de participants afin d’éviter qu’une équipe dépasse la limite.
 */
const MAX_MEMBRES_PAR_EQUIPE = 4;

/**
 * --------------------------------------------------------------------
 * GET /participants
 * --------------------------------------------------------------------
 * Recherche de participants.
 *
 * Query params :
 * - q     : texte recherché
 * - limit : nombre maximum de résultats
 *
 * Exemple :
 *   GET /participants?q=ali&limit=10
 *
 * Réponses :
 * - 200 : liste des participants trouvés
 * - 500 : erreur serveur
 */
router.get("/participants", requireAdmin, async (req, res) => {
  /**
   * On récupère la chaîne de recherche.
   * Si absente, on prend une chaîne vide.
   */
  const q = String(req.query?.q || "");

  /**
   * Conversion de la limite.
   * Si la valeur n'est pas un entier valide, on prend 20 par défaut.
   */
  const rawLimit = Number(req.query?.limit);
  const limit = Number.isInteger(rawLimit) ? rawLimit : 20;

  try {
    const participants = await searchParticipants(q, limit);
    res.json(participants);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

/**
 * --------------------------------------------------------------------
 * GET /equipes
 * --------------------------------------------------------------------
 * Retourne les équipes des tournois ouverts aux inscriptions uniquement.
 *
 * Réponses :
 * - 200 : liste des équipes
 * - 500 : erreur serveur
 */
router.get("/equipes", requireAdmin, async (req, res) => {
  try {
    const equipes = await getAllEquipes();
    res.json(equipes);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

/**
 * --------------------------------------------------------------------
 * POST /equipes
 * --------------------------------------------------------------------
 * Crée une nouvelle équipe dans un tournoi.
 *
 * Étapes :
 * 1. Validation du body
 * 2. Vérification que le tournoi existe et est ouvert
 * 3. Vérification qu'il n'existe pas déjà une équipe du même nom
 * 4. Création de l'équipe
 *
 * Réponses :
 * - 201 : équipe créée
 * - 400 : validation ou tournoi invalide
 * - 409 : tournoi fermé ou nom déjà utilisé
 * - 500 : erreur serveur
 */
router.post("/equipes", requireAdmin, async (req, res) => {
  const { ok, errors, cleaned } = validateCreerEquipePayload(req.body);

  if (!ok) {
    return res.status(400).json({ message: "Validation impossible", errors });
  }

  const { tournoi_id, nom_equipe } = cleaned;

  try {
    /**
     * Vérifie si le tournoi existe et s'il est ouvert.
     *
     * Valeurs possibles :
     * - null  : tournoi introuvable / invalide
     * - false : tournoi fermé
     * - true  : tournoi ouvert
     */
    const tournoiOpen = await isTournoiOpenById(tournoi_id);

    if (tournoiOpen === null) {
      return res.status(400).json({ message: "tournoi_id invalide." });
    }

    if (!tournoiOpen) {
      return res.status(409).json({
        message: "Seuls les tournois ouverts peuvent être modifiés.",
      });
    }

    /**
     * Vérifie l’unicité du nom de l’équipe dans le tournoi.
     */
    if (nom_equipe && (await existsEquipeNameInTournoi(tournoi_id, nom_equipe))) {
      return res.status(409).json({
        message: "Une équipe avec ce nom existe déjà dans ce tournoi.",
      });
    }

    const equipe = await createEquipe(tournoi_id, nom_equipe);

    return res.status(201).json({
      message: "Équipe créée avec succès",
      equipe,
    });
  } catch (err) {
    if (err?.message === "MAX_EQUIPES_ATTEINT") {
      return res.status(409).json({
        message: "Le nombre maximum d'équipes est atteint pour ce tournoi.",
      });
    }

    /**
     * 23503 = souvent une violation de clé étrangère en PostgreSQL.
     * Ici, on l’interprète comme un tournoi_id invalide.
     */
    if (err?.code === "23503") {
      return res.status(400).json({ message: "tournoi_id invalide." });
    }

    console.error(err);
    return res.status(500).json({ message: "Erreur serveur" });
  }
});

/**
 * --------------------------------------------------------------------
 * GET /joueurs-commandites?tournoi_id=
 * --------------------------------------------------------------------
 * Retourne les joueurs commandités sans équipe.
 *
 * Comportement :
 * - avec tournoi_id : filtre sur ce tournoi
 * - sans tournoi_id : limite aux tournois avec inscriptions ouvertes
 *
 * Réponses :
 * - 200 : liste retournée
 * - 400 : tournoi_id invalide
 * - 500 : erreur serveur
 */
router.get("/joueurs-commandites", requireAdmin, async (req, res) => {
  const raw = req.query?.tournoi_id;
  let tournoiId = null;

  /**
   * Le paramètre est optionnel.
   * Si fourni, il doit être un entier positif.
   */
  if (raw !== undefined && raw !== null && String(raw).trim() !== "") {
    const n = Number(raw);
    if (!Number.isInteger(n) || n <= 0) {
      return res.status(400).json({ message: "tournoi_id invalide." });
    }
    tournoiId = n;
  }

  try {
    const rows = await listJoueursCommanditesAdmin(tournoiId);
    return res.json(rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Erreur serveur" });
  }
});

/**
 * --------------------------------------------------------------------
 * PATCH /joueurs-commandites/:id
 * --------------------------------------------------------------------
 * Modifie l’identité d’un joueur commandité.
 *
 * Réponses :
 * - 200 : joueur mis à jour
 * - 400 : id ou payload invalide
 * - 404 : joueur introuvable
 * - 409 : tournoi fermé
 * - 500 : erreur serveur
 */
router.patch("/joueurs-commandites/:id", requireAdmin, async (req, res) => {
  const jcId = parseId(req.params.id);

  if (!jcId) {
    return res.status(400).json({ message: "ID joueur commandité invalide." });
  }

  const { ok, errors, cleaned } = validateJoueurCommanditeIdentitePayload(req.body);

  if (!ok) {
    return res.status(400).json({ message: "Validation impossible", errors });
  }

  try {
    const result = await updateJoueurCommanditeAdmin(jcId, cleaned);

    if (!result.ok) {
      if (result.code === "NOT_FOUND") {
        return res.status(404).json({ message: "Joueur commandité introuvable." });
      }

      if (result.code === "TOURNOI_FERME") {
        return res.status(409).json({
          message: "Seuls les tournois ouverts aux inscriptions peuvent être modifiés.",
        });
      }

      return res.status(400).json({ message: "Mise à jour impossible." });
    }

    return res.json({ message: "Joueur mis à jour." });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Erreur serveur" });
  }
});

/**
 * --------------------------------------------------------------------
 * DELETE /joueurs-commandites/:id
 * --------------------------------------------------------------------
 * Supprime un joueur commandité.
 *
 * Réponses :
 * - 200 : suppression réussie
 * - 400 : id invalide ou suppression impossible
 * - 404 : joueur introuvable
 * - 409 : tournoi fermé
 * - 500 : erreur serveur
 */
router.delete("/joueurs-commandites/:id", requireAdmin, async (req, res) => {
  const jcId = parseId(req.params.id);

  if (!jcId) {
    return res.status(400).json({ message: "ID joueur commandité invalide." });
  }

  try {
    const result = await deleteJoueurCommanditeAdmin(jcId);

    if (!result.ok) {
      if (result.code === "NOT_FOUND") {
        return res.status(404).json({ message: "Joueur commandité introuvable." });
      }

      if (result.code === "TOURNOI_FERME") {
        return res.status(409).json({
          message: "Seuls les tournois ouverts aux inscriptions peuvent être modifiés.",
        });
      }

      return res.status(400).json({ message: "Suppression impossible." });
    }

    return res.json({ message: "Joueur commandité supprimé." });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Erreur serveur" });
  }
});

/**
 * --------------------------------------------------------------------
 * POST /joueurs-commandites/:id/assigner-equipe
 * --------------------------------------------------------------------
 * Affecte un joueur commandité à une équipe.
 *
 * Le repository peut retourner plusieurs codes métier.
 * La route convertit ces codes en réponses HTTP explicites.
 *
 * Réponses :
 * - 200 : affectation ou déplacement réussi
 * - 400 : paramètres invalides ou tournoi différent
 * - 404 : joueur ou équipe introuvable
 * - 409 : tournoi fermé, équipe pleine, conflit, etc.
 * - 500 : erreur serveur
 */
router.post("/joueurs-commandites/:id/assigner-equipe", requireAdmin, async (req, res) => {
  const jcId = parseId(req.params.id);

  if (!jcId) {
    return res.status(400).json({ message: "ID joueur commandité invalide." });
  }

  const { ok, errors, cleaned } = validateAssignJoueurCommanditeEquipePayload(req.body);

  if (!ok) {
    return res.status(400).json({ message: "Validation impossible", errors });
  }

  try {
    const result = await assignJoueurCommanditeToEquipe(jcId, cleaned.equipe_id);

    if (!result.ok) {
      /**
       * Dictionnaire permettant de mapper un code métier
       * à un statut HTTP et un message lisible.
       */
      const map = {
        NOT_FOUND: [404, "Joueur commandité introuvable."],
        BAD_INPUT: [400, "Paramètres invalides."],
        EQUIPE_NOT_FOUND: [404, "Équipe introuvable."],
        TOURNOI_MISMATCH: [400, "L'équipe n'appartient pas au même tournoi que la commandite."],
        TOURNOI_FERME: [409, "Seuls les tournois ouverts aux inscriptions peuvent être modifiés."],
        EQUIPE_PLEINE: [409, "L'équipe compte déjà 4 joueurs."],
        COURRIEL_CONFLIT: [409, "Conflit de courriel interne — contactez un administrateur."],
        DEJA_EQUIPE: [409, "Ce participant est déjà rattaché à une équipe."],
      };

      const entry = map[result.code];

      if (entry) {
        return res.status(entry[0]).json({ message: entry[1] });
      }

      return res.status(400).json({ message: "Affectation impossible." });
    }

    return res.status(200).json({
      message:
        result.code === "CREATED"
          ? "Joueur affecté à l'équipe."
          : result.code === "MOVED"
            ? "Joueur déplacé vers l'équipe."
            : "Déjà dans cette équipe.",
      participant_id: result.participant_id,
      equipe_id: result.equipe_id,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Erreur serveur" });
  }
});

/**
 * --------------------------------------------------------------------
 * GET /equipes/:id
 * --------------------------------------------------------------------
 * Retourne une équipe selon son identifiant.
 *
 * Réponses :
 * - 200 : équipe trouvée
 * - 404 : équipe introuvable
 * - 500 : erreur serveur
 */
router.get("/equipes/:id", requireAdmin, async (req, res) => {
  try {
    const equipe = await getEquipeById(req.params.id);

    if (!equipe) {
      return res.status(404).json({ message: "Équipe introuvable" });
    }

    res.json(equipe);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

/**
 * --------------------------------------------------------------------
 * DELETE /equipes/:id
 * --------------------------------------------------------------------
 * Supprime une équipe.
 *
 * Vérifications :
 * - id valide
 * - équipe existante
 * - tournoi de l’équipe encore ouvert
 *
 * Réponses :
 * - 200 : suppression réussie
 * - 400 : id invalide
 * - 404 : équipe introuvable
 * - 409 : tournoi fermé
 * - 500 : erreur serveur
 */
router.delete("/equipes/:id", requireAdmin, async (req, res) => {
  const equipeId = parseId(req.params.id);

  if (!equipeId) {
    return res.status(400).json({ message: "ID d'équipe invalide." });
  }

  try {
    const tournoiOpen = await isTournoiOpenByEquipeId(equipeId);

    if (tournoiOpen === null) {
      return res.status(404).json({ message: "Équipe introuvable" });
    }

    if (!tournoiOpen) {
      return res.status(409).json({
        message: "Seuls les tournois ouverts peuvent être modifiés.",
      });
    }

    const deleted = await deleteEquipeById(equipeId);

    if (!deleted) {
      return res.status(404).json({ message: "Équipe introuvable" });
    }

    return res.json({
      message: "Équipe supprimée avec succès",
      equipe: deleted,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Erreur serveur" });
  }
});

/**
 * --------------------------------------------------------------------
 * GET /equipes/:id/membres
 * --------------------------------------------------------------------
 * Retourne les membres d’une équipe.
 *
 * Réponses :
 * - 200 : liste des membres
 * - 500 : erreur serveur
 */
router.get("/equipes/:id/membres", requireAdmin, async (req, res) => {
  try {
    const membres = await getMembresByEquipeId(req.params.id);
    res.json(membres);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

/**
 * --------------------------------------------------------------------
 * POST /equipes/:id/membres
 * --------------------------------------------------------------------
 * Ajoute un participant existant à une équipe.
 *
 * Vérifications :
 * - payload valide
 * - équipe existante
 * - tournoi ouvert
 * - participant existant
 * - participant et équipe du même tournoi
 * - équipe non complète
 *
 * Réponses :
 * - 201 : ajout réussi
 * - 400 : validation invalide ou tournoi différent
 * - 404 : équipe ou participant introuvable
 * - 409 : tournoi fermé, équipe pleine, doublon
 * - 500 : erreur serveur
 */
router.post("/equipes/:id/membres", requireAdmin, async (req, res) => {
  const { ok, errors, cleaned } = validateAjouterMembrePayload(req.params, req.body);

  if (!ok) {
    return res.status(400).json({ message: "Validation impossible", errors });
  }

  const { equipe_id, participant_id } = cleaned;

  try {
    const tournoiOpen = await isTournoiOpenByEquipeId(equipe_id);

    if (tournoiOpen === null) {
      return res.status(404).json({ message: "Équipe introuvable" });
    }

    if (!tournoiOpen) {
      return res.status(409).json({
        message: "Seuls les tournois ouverts peuvent être modifiés.",
      });
    }

    const equipe = await getEquipeById(equipe_id);
    if (!equipe) {
      return res.status(404).json({ message: "Équipe introuvable" });
    }

    const participant = await getParticipantById(participant_id);
    if (!participant) {
      return res.status(404).json({ message: "Participant introuvable" });
    }

    /**
     * Empêche l’ajout d’un participant d’un autre tournoi.
     */
    if (Number(participant.tournoi_id) !== Number(equipe.tournoi_id)) {
      return res.status(400).json({
        message: "Le participant n'appartient pas au même tournoi que l'équipe.",
      });
    }

    const total = await countMembresEquipe(equipe_id);

    if (total >= MAX_MEMBRES_PAR_EQUIPE) {
      return res.status(409).json({
        message: "L'équipe est déjà complète (4 joueurs).",
      });
    }

    const membre = await addMembreToEquipe(equipe_id, participant_id);

    return res.status(201).json({
      message: "Participant ajouté à l'équipe.",
      membre,
    });
  } catch (err) {
    /**
     * Gestion d’erreurs métier remontées depuis la base.
     */
    if (err?.constraint === "uq_participant_une_seule_equipe") {
      return res.status(409).json({
        message: "Ce participant est déjà membre d'une équipe.",
      });
    }

    if (err?.constraint === "uq_membre_equipe") {
      return res.status(409).json({
        message: "Ce participant est déjà dans cette équipe.",
      });
    }

    console.error(err);
    return res.status(500).json({ message: "Erreur serveur" });
  }
});

/**
 * --------------------------------------------------------------------
 * POST /equipes/:id/membres/nouveau
 * --------------------------------------------------------------------
 * Crée un nouveau participant puis l’ajoute immédiatement à une équipe.
 *
 * Réponses :
 * - 201 : participant créé et ajouté
 * - 400 : validation invalide
 * - 404 : équipe introuvable
 * - 409 : tournoi fermé, équipe pleine, courriel déjà utilisé, doublon
 * - 500 : erreur serveur
 */
router.post("/equipes/:id/membres/nouveau", requireAdmin, async (req, res) => {
  const { ok, errors, cleaned } = validateNouveauMembrePayload(req.params, req.body);

  if (!ok) {
    return res.status(400).json({ message: "Validation impossible", errors });
  }

  const { equipe_id, prenom, nom, courriel, telephone } = cleaned;

  try {
    const tournoiOpen = await isTournoiOpenByEquipeId(equipe_id);

    if (tournoiOpen === null) {
      return res.status(404).json({ message: "Équipe introuvable" });
    }

    if (!tournoiOpen) {
      return res.status(409).json({
        message: "Seuls les tournois ouverts peuvent être modifiés.",
      });
    }

    const equipe = await getEquipeById(equipe_id);
    if (!equipe) {
      return res.status(404).json({ message: "Équipe introuvable" });
    }

    const total = await countMembresEquipe(equipe_id);

    if (total >= MAX_MEMBRES_PAR_EQUIPE) {
      return res.status(409).json({
        message: "L'équipe est déjà complète (4 joueurs).",
      });
    }

    const result = await createParticipantAndAddToEquipe(equipe_id, {
      prenom,
      nom,
      courriel,
      telephone,
      type_participant: "EMPLOYE",
    });

    return res.status(201).json({
      message: "Nouveau participant créé et ajouté à l'équipe.",
      participant: result.participant,
      membre: result.membre,
    });
  } catch (err) {
    if (err?.code === "EQUIPE_NOT_FOUND") {
      return res.status(404).json({ message: "Équipe introuvable" });
    }

    if (err?.constraint === "uq_participant_tournoi_courriel") {
      return res.status(409).json({
        message: "Un participant avec ce courriel existe déjà dans ce tournoi.",
      });
    }

    if (err?.constraint === "uq_participant_une_seule_equipe") {
      return res.status(409).json({
        message: "Ce participant est déjà membre d'une équipe.",
      });
    }

    if (err?.constraint === "uq_membre_equipe") {
      return res.status(409).json({
        message: "Ce participant est déjà dans cette équipe.",
      });
    }

    console.error(err);
    return res.status(500).json({ message: "Erreur serveur" });
  }
});

/**
 * --------------------------------------------------------------------
 * DELETE /equipes/:id/membres/:participantId
 * --------------------------------------------------------------------
 * Retire un participant d’une équipe.
 *
 * Réponses :
 * - 200 : suppression réussie
 * - 400 : id invalide
 * - 404 : équipe ou membre introuvable
 * - 409 : tournoi fermé
 * - 500 : erreur serveur
 */
router.delete("/equipes/:id/membres/:participantId", requireAdmin, async (req, res) => {
  const equipeId = parseId(req.params.id);
  const participantId = parseId(req.params.participantId);

  if (!equipeId || !participantId) {
    return res.status(400).json({ message: "ID équipe ou participant invalide." });
  }

  try {
    const tournoiOpen = await isTournoiOpenByEquipeId(equipeId);

    if (tournoiOpen === null) {
      return res.status(404).json({ message: "Équipe introuvable" });
    }

    if (!tournoiOpen) {
      return res.status(409).json({
        message: "Seuls les tournois ouverts peuvent être modifiés.",
      });
    }

    const deleted = await removeMembreFromEquipe(equipeId, participantId);

    if (!deleted) {
      return res.status(404).json({
        message: "Membre introuvable dans cette équipe.",
      });
    }

    return res.json({
      message: "Participant retiré de l'équipe.",
      membre: deleted,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Erreur serveur" });
  }
});

/**
 * --------------------------------------------------------------------
 * PATCH /participants/:id
 * --------------------------------------------------------------------
 * Modifie les informations d’un participant.
 *
 * Réponses :
 * - 200 : participant mis à jour
 * - 400 : id ou payload invalide
 * - 404 : participant introuvable
 * - 409 : tournoi fermé ou courriel déjà existant
 * - 500 : erreur serveur
 */
router.patch("/participants/:id", requireAdmin, async (req, res) => {
  const participantId = parseId(req.params.id);

  if (!participantId) {
    return res.status(400).json({ message: "ID participant invalide." });
  }

  const { ok, errors, cleaned } = validateModifierParticipantPayload(req.body);

  if (!ok) {
    return res.status(400).json({ message: "Validation impossible", errors });
  }

  try {
    const tournoiOpen = await isTournoiOpenByParticipantId(participantId);

    if (tournoiOpen === null) {
      return res.status(404).json({ message: "Participant introuvable." });
    }

    if (!tournoiOpen) {
      return res.status(409).json({
        message: "Seuls les tournois ouverts peuvent être modifiés.",
      });
    }

    const updated = await updateParticipantAdmin(participantId, cleaned);

    if (!updated.ok) {
      return res.status(404).json({ message: "Participant introuvable." });
    }

    return res.status(200).json({
      message: "Participant mis à jour.",
      participant: updated.row,
    });
  } catch (err) {
    if (err?.constraint === "uq_participant_tournoi_courriel") {
      return res.status(409).json({
        message: "Un participant avec ce courriel existe déjà dans ce tournoi.",
      });
    }

    console.error(err);
    return res.status(500).json({ message: "Erreur serveur" });
  }
});

/**
 * --------------------------------------------------------------------
 * POST /equipes/:id/membres/:participantId/deplacer
 * --------------------------------------------------------------------
 * Déplace un membre d’une équipe source vers une équipe cible.
 *
 * Réponses :
 * - 200 : déplacement réussi ou aucun changement
 * - 400 : validation invalide ou tournoi mismatch
 * - 404 : équipe source/cible ou membre introuvable
 * - 409 : tournoi fermé ou équipe cible pleine
 * - 500 : erreur serveur
 */
router.post("/equipes/:id/membres/:participantId/deplacer", requireAdmin, async (req, res) => {
  const { ok, errors, cleaned } = validateDeplacerMembrePayload(req.params, req.body);

  if (!ok) {
    return res.status(400).json({ message: "Validation impossible", errors });
  }

  try {
    const tournoiOpen = await isTournoiOpenByEquipeId(cleaned.equipe_source_id);

    if (tournoiOpen === null) {
      return res.status(404).json({ message: "Équipe source introuvable." });
    }

    if (!tournoiOpen) {
      return res.status(409).json({
        message: "Seuls les tournois ouverts peuvent être modifiés.",
      });
    }

    const result = await moveMembreToEquipe(
      cleaned.equipe_source_id,
      cleaned.equipe_cible_id,
      cleaned.participant_id
    );

    if (!result.ok) {
      const map = {
        BAD_INPUT: [400, "Paramètres invalides."],
        SOURCE_NOT_FOUND: [404, "Équipe source introuvable."],
        TARGET_NOT_FOUND: [404, "Équipe cible introuvable."],
        MEMBRE_NOT_FOUND: [404, "Ce participant n'est pas membre de l'équipe source."],
        TOURNOI_MISMATCH: [400, "L'équipe cible doit appartenir au même tournoi."],
        EQUIPE_PLEINE: [409, "L'équipe cible est déjà complète (4 joueurs)."],
      };

      const entry = map[result.code];

      if (entry) {
        return res.status(entry[0]).json({ message: entry[1] });
      }

      return res.status(400).json({ message: "Déplacement impossible." });
    }

    return res.status(200).json({
      message:
        result.code === "NOOP"
          ? "Déjà dans cette équipe."
          : "Participant déplacé vers l'équipe.",
      participant_id: result.participant_id,
      equipe_id: result.equipe_id,
    });
  } catch (err) {
    if (err?.constraint === "uq_participant_une_seule_equipe") {
      return res.status(409).json({
        message: "Ce participant est déjà membre d'une équipe.",
      });
    }

    console.error(err);
    return res.status(500).json({ message: "Erreur serveur" });
  }
});

/**
 * --------------------------------------------------------------------
 * PUT /equipes/:id
 * --------------------------------------------------------------------
 * Modifie le nom d’une équipe.
 *
 * Vérifications :
 * - validation de l’input
 * - équipe existante
 * - tournoi ouvert
 * - nom unique dans le tournoi
 *
 * Réponses :
 * - 200 : modification réussie
 * - 400 : validation invalide
 * - 404 : équipe introuvable
 * - 409 : tournoi fermé ou doublon de nom
 * - 500 : erreur serveur
 */
router.put("/equipes/:id", requireAdmin, async (req, res) => {
  const { ok, errors, cleaned } = validateModifierEquipePayload(req.params, req.body);

  if (!ok) {
    return res.status(400).json({ message: "Validation impossible", errors });
  }

  const { equipe_id, nom_equipe } = cleaned;

  try {
    const tournoiOpen = await isTournoiOpenByEquipeId(equipe_id);

    if (tournoiOpen === null) {
      return res.status(404).json({ message: "Équipe introuvable" });
    }

    if (!tournoiOpen) {
      return res.status(409).json({
        message: "Seuls les tournois ouverts peuvent être modifiés.",
      });
    }

    const equipeExistante = await getEquipeById(equipe_id);

    if (!equipeExistante) {
      return res.status(404).json({ message: "Équipe introuvable" });
    }

    const duplicateName = await existsEquipeNameInTournoi(
      equipeExistante.tournoi_id,
      nom_equipe,
      equipe_id
    );

    if (duplicateName) {
      return res.status(409).json({
        message: "Une équipe avec ce nom existe déjà dans ce tournoi.",
      });
    }

    const equipe = await updateEquipe(equipe_id, nom_equipe);

    if (!equipe) {
      return res.status(404).json({ message: "Équipe introuvable" });
    }

    res.json({
      message: "Équipe modifiée avec succès",
      equipe,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

/**
 * Export du routeur pour montage dans l’application principale.
 */
export default router;