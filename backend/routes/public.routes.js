/**
 * --------------------------------------------------------------------
 * Routes publiques du site
 * --------------------------------------------------------------------
 *
 * Ce routeur regroupe les endpoints accessibles sans connexion
 * administrateur. Il permet au frontend public de :
 * - consulter tous les tournois
 * - consulter un tournoi précis
 * - consulter le tournoi actif
 * - consulter les types de commandites d'un tournoi
 * - créer une équipe dans le cadre d'une inscription
 * - rejoindre une équipe existante
 * - inscrire un commanditaire
 * - vérifier si certains noms de joueurs existent déjà
 *
 * Endpoints disponibles :
 * - GET  /public/tournois
 * - GET  /public/tournois/:id
 * - GET  /public/tournoi-actif
 * - GET  /public/types-commandites?tournoi_id=ID
 * - POST /public/inscription/creer-equipe
 * - POST /public/inscription/rejoindre-equipe
 * - POST /public/inscription/commanditaire
 * - POST /public/inscription/verifier-noms-joueurs
 * - POST /public/inscription/verifier-courriel
 * - POST /public/inscription/verifier-nom-equipe
 * - POST /public/inscription/verifier-code-equipe
 */

import express from "express";
import { pool } from "../db/db.js";
import {
  findActiveTournoi,
  listTournois,
  findTournoiById,
} from "../dal/tournoi.repository.js";
import {
  inscriptionCreerEquipe,
  inscriptionCommandite,
  inscriptionRejoindreEquipe,
  verifierConflitsNomsJoueursTournoi,
   verifierDisponibiliteAvantPaiement,
  courrielDejaInscrit,
  nomEquipeDejaExiste,
  codeEquipeRejoignable,
} from "../dal/inscriptionTournoi.repository.js";
import { listTypesCommanditesByTournoi } from "../dal/types-commandites.repository.js";
import {
  parseId,
  validateCreerEquipePayload,
  validateRejoindreEquipePayload,
  validateCommanditairePayload,
} from "../validators/inscriptionTournoi.validator.js";

/**
 * Instance du routeur Express pour les routes publiques.
 */
const router = express.Router();

/**
 * Nombre maximum de joueurs qu'on accepte de vérifier
 * en une seule requête pour éviter un appel trop lourd.
 */
const MAX_JOUEURS_VERIF_NOMS = 40;

/**
 * Compte le nombre total de joueurs inscrits dans un tournoi.
 *
 * Inclut :
 * - les participants classiques
 * - les joueurs liés aux commandites
 *
 * @param {number} tournoiId
 * @returns {Promise<number>}
 */
async function countParticipantsPublic(tournoiId) {
  const result = await pool.query(
    `
    SELECT
      (
        SELECT COUNT(*)::int
        FROM participants
        WHERE tournoi_id = $1
      )
      +
      (
        SELECT COUNT(*)::int
        FROM joueurs_commandites jc
        INNER JOIN commandites c ON c.id = jc.commandite_id
        WHERE c.tournoi_id = $1
        AND c.statut = 'PAYEE'
        AND jc.participant_id IS NULL
      ) AS total
    `,
    [tournoiId]
  );

  return result.rows[0]?.total ?? 0;
}

/**
 * Enrichit un tournoi avec :
 * - participants_inscrits
 * - places_restantes
 *
 * @param {object|null} tournoi
 * @returns {Promise<object|null>}
 */
async function enrichTournoiWithPlaces(tournoi) {
  if (!tournoi) return null;

  const participantsInscrits = await countParticipantsPublic(tournoi.id);
  const capacite = Number(tournoi.capacite_joueurs ?? 0);

  return {
    ...tournoi,
    participants_inscrits: participantsInscrits,
    places_restantes:
      capacite > 0 ? Math.max(capacite - participantsInscrits, 0) : 0,
  };
}

/**
 * --------------------------------------------------------------------
 * GET /public/tournois
 * --------------------------------------------------------------------
 * Retourne tous les tournois créés avec le compteur de places.
 *
 * Réponses :
 * - 200 : liste des tournois
 * - 500 : erreur serveur
 */
router.get("/tournois", async (req, res) => {
  try {
    const tournois = await listTournois();

    const enrichedTournois = await Promise.all(
      (Array.isArray(tournois) ? tournois : []).map((tournoi) =>
        enrichTournoiWithPlaces(tournoi)
      )
    );

    return res.status(200).json(enrichedTournois);
  } catch (err) {
    console.error("GET /public/tournois:", err);
    return res.status(500).json({
      message: "Erreur serveur lors du chargement des tournois.",
    });
  }
});

/**
 * --------------------------------------------------------------------
 * GET /public/tournois/:id
 * --------------------------------------------------------------------
 * Retourne un tournoi précis selon son identifiant
 * avec le compteur de places.
 *
 * Réponses :
 * - 200 : tournoi trouvé
 * - 400 : identifiant invalide
 * - 404 : tournoi introuvable
 * - 500 : erreur serveur
 */
router.get("/tournois/:id", async (req, res) => {
  const id = parseId(req.params.id);

  if (!id) {
    return res.status(400).json({
      message: "ID de tournoi invalide.",
    });
  }

  try {
    const tournoi = await findTournoiById(id);

    if (!tournoi) {
      return res.status(404).json({
        message: "Tournoi introuvable.",
      });
    }

    const enrichedTournoi = await enrichTournoiWithPlaces(tournoi);

    return res.status(200).json(enrichedTournoi);
  } catch (err) {
    console.error("GET /public/tournois/:id:", err);
    return res.status(500).json({
      message: "Erreur serveur.",
    });
  }
});

/**
 * --------------------------------------------------------------------
 * GET /public/tournoi-actif
 * --------------------------------------------------------------------
 * Retourne le tournoi actuellement ouvert aux inscriptions
 * avec le compteur de places.
 *
 * Réponses :
 * - 200 : tournoi trouvé
 * - 404 : aucun tournoi actuellement ouvert
 * - 500 : erreur serveur
 */
router.get("/tournoi-actif", async (req, res) => {
  try {
    /**
     * Recherche du tournoi actif côté repository.
     */
    const tournoi = await findActiveTournoi();

    /**
     * Si aucun tournoi n'est disponible, on retourne 404.
     */
    if (!tournoi) {
      return res.status(404).json({
        message: "Aucun tournoi ouvert aux inscriptions pour le moment.",
      });
    }

    /**
     * Enrichit le tournoi actif avec :
     * - participants_inscrits
     * - places_restantes
     */
    const enrichedTournoi = await enrichTournoiWithPlaces(tournoi);

    return res.status(200).json(enrichedTournoi);
  } catch (err) {
    console.error("GET /public/tournoi-actif:", err);
    return res.status(500).json({ message: "Erreur serveur" });
  }
});

/**
 * --------------------------------------------------------------------
 * GET /public/disponibilite-tournoi?tournoi_id=ID
 * --------------------------------------------------------------------
 * Retourne l'état de disponibilité d'un tournoi pour l'inscription :
 * - création d'équipe possible ou non
 * - rejoindre une équipe possible ou non
 * - places restantes côté participants
 * - places restantes côté commandites
 *
 * Réponses :
 * - 200 : disponibilité retournée
 * - 400 : tournoi_id invalide
 * - 404 : tournoi introuvable
 * - 500 : erreur serveur
 */
router.get("/disponibilite-tournoi", async (req, res) => {
  try {
    const tournoiId = parseId(req.query?.tournoi_id);

    if (!tournoiId) {
      return res.status(400).json({
        message: "tournoi_id invalide",
      });
    }

    const dispoParticipant = await verifierDisponibiliteAvantPaiement(
      tournoiId,
      "participant",
      "creer"
    );

    if (!dispoParticipant.ok && dispoParticipant.status === 404) {
      return res.status(404).json({
        message: "Tournoi introuvable.",
      });
    }

    const dispoRejoindre = await verifierDisponibiliteAvantPaiement(
      tournoiId,
      "participant",
      "rejoindre"
    );

    const dispoCommandite = await verifierDisponibiliteAvantPaiement(
      tournoiId,
      "commandite"
    );

    const data =
      dispoParticipant.data ||
      dispoRejoindre.data ||
      dispoCommandite.data ||
      null;

    return res.status(200).json({
      peutCreerEquipe: Boolean(dispoParticipant.ok),
      peutRejoindreEquipe: Boolean(dispoRejoindre.ok),
      placesPersonnelRestantes: data?.placesPersonnelRestantes ?? 0,
      placesCommanditesRestantes: data?.placesCommanditesRestantes ?? 0,
      tournoiComplet: data?.tournoiComplet ?? false,
    });
  } catch (err) {
    console.error("GET /public/disponibilite-tournoi:", err);
    return res.status(500).json({
      message: "Erreur serveur",
    });
  }
});
/**
 * --------------------------------------------------------------------
 * GET /public/types-commandites?tournoi_id=ID
 * --------------------------------------------------------------------
 * Retourne la liste des types de commandites disponibles
 * pour un tournoi donné.
 *
 * Query attendue :
 * - tournoi_id
 *
 * Réponses :
 * - 200 : liste des types
 * - 400 : tournoi_id invalide
 * - 500 : erreur serveur
 */
router.get("/types-commandites", async (req, res) => {
  /**
   * Validation de l'identifiant du tournoi à partir de la query string.
   */
  const tournoi_id = parseId(req.query?.tournoi_id);

  if (!tournoi_id) {
    return res.status(400).json({ message: "tournoi_id invalide" });
  }

  try {
    const types = await listTypesCommanditesByTournoi(tournoi_id);
    return res.status(200).json(types);
  } catch (err) {
    console.error("GET /public/types-commandites:", err);
    return res.status(500).json({ message: "Erreur serveur" });
  }
});

/**
 * --------------------------------------------------------------------
 * POST /public/inscription/creer-equipe
 * --------------------------------------------------------------------
 * Permet à un participant public de :
 * - créer une nouvelle équipe
 * - s'inscrire comme premier membre de cette équipe
 *
 * Body attendu :
 * - tournoi_id
 * - prenom
 * - nom
 * - courriel
 * - telephone (optionnel)
 * - nom_equipe
 *
 * Réponses :
 * - 201 : équipe et participant créés avec succès
 * - 400 : validation impossible
 * - autre code : erreur métier retournée par le repository
 * - 500 : erreur serveur
 */
router.post("/inscription/creer-equipe", async (req, res) => {
  /**
   * Validation et nettoyage du body.
   */
  const { ok, errors, cleaned } = validateCreerEquipePayload(req.body);

  if (!ok) {
    return res.status(400).json({
      message: "Validation impossible",
      errors,
    });
  }

  try {
    /**
     * Le repository gère la logique métier complète
     * de création de l'équipe et du participant.
     */
    const result = await inscriptionCreerEquipe(cleaned);

    /**
     * Si le repository retourne une erreur métier,
     * on respecte le code et le message qu'il fournit.
     */
    if (result?.error) {
      return res.status(result.error.status).json({
        message: result.error.message,
      });
    }

    return res.status(201).json({
      message: "Équipe créée avec succès",
      participant: result.participant,
      equipe: result.equipe,
    });
  } catch (err) {
    console.error("POST /public/inscription/creer-equipe:", err);
    return res.status(500).json({ message: "Erreur serveur" });
  }
});

/**
 * --------------------------------------------------------------------
 * POST /public/inscription/rejoindre-equipe
 * --------------------------------------------------------------------
 * Permet à un participant public de rejoindre une équipe existante
 * en utilisant un code d'équipe.
 *
 * Body attendu :
 * - tournoi_id
 * - prenom
 * - nom
 * - courriel
 * - telephone (optionnel)
 * - code_equipe
 *
 * Réponses :
 * - 201 : participant ajouté à l'équipe
 * - 400 : validation impossible
 * - autre code : erreur métier retournée par le repository
 * - 500 : erreur serveur
 */
router.post("/inscription/rejoindre-equipe", async (req, res) => {
  /**
   * Validation et nettoyage du body.
   */
  const { ok, errors, cleaned } = validateRejoindreEquipePayload(req.body);

  if (!ok) {
    return res.status(400).json({
      message: "Validation impossible",
      errors,
    });
  }

  try {
    /**
     * Le repository gère la logique métier de rattachement
     * du participant à une équipe existante.
     */
    const result = await inscriptionRejoindreEquipe(cleaned);

    /**
     * Si une erreur métier est retournée, on la transmet au frontend.
     */
    if (result?.error) {
      return res.status(result.error.status).json({
        message: result.error.message,
      });
    }

    return res.status(201).json({
      message: "Participant ajouté à l'équipe avec succès",
      participant: result.participant,
      equipe: result.equipe,
    });
  } catch (err) {
    console.error("POST /public/inscription/rejoindre-equipe:", err);
    return res.status(500).json({ message: "Erreur serveur" });
  }
});

/**
 * --------------------------------------------------------------------
 * POST /public/inscription/commanditaire
 * --------------------------------------------------------------------
 * Permet d'enregistrer une inscription de commanditaire
 * depuis l'espace public du site.
 *
 * Body attendu :
 * - tournoi_id
 * - prenom
 * - nom
 * - courriel
 * - telephone (optionnel)
 * - nom_entreprise (optionnel)
 * - type_commandite_id ou type_commandite_ids[]
 * - joueurs_par_type (optionnel selon la logique métier)
 *
 * Particularité :
 * - si nom_entreprise n'est pas fourni, on utilise
 *   "prenom nom" comme valeur de remplacement
 *
 * Réponses :
 * - 201 : inscription commanditaire créée
 * - 400 : validation impossible
 * - autre code : erreur métier retournée par le repository
 * - 500 : erreur serveur
 */
router.post("/inscription/commanditaire", async (req, res) => {
  /**
   * Validation et nettoyage du body.
   */
  const { ok, errors, cleaned } = validateCommanditairePayload(req.body);

  if (!ok) {
    return res.status(400).json({
      message: "Validation impossible",
      errors,
    });
  }

  try {
    /**
     * Construction du payload attendu par le repository.
     *
     * On transforme les données venant du formulaire public
     * vers la structure métier de la commandite.
     */
    const result = await inscriptionCommandite({
      tournoi_id: cleaned.tournoi_id,
      type_commandite_ids: cleaned.type_commandite_ids,
      nom_entreprise: cleaned.nom_entreprise || `${cleaned.prenom} ${cleaned.nom}`,
      nom_contact: `${cleaned.prenom} ${cleaned.nom}`,
      courriel_contact: cleaned.courriel,
      telephone_contact: cleaned.telephone || null,
      joueurs_par_type: cleaned.joueurs_par_type || {},
    });

    /**
     * Si le repository retourne une erreur métier,
     * on la relaie telle quelle.
     */
    if (result?.error) {
      return res.status(result.error.status).json({
        message: result.error.message,
      });
    }

    /**
     * Le repository peut retourner plusieurs commandites.
     * On récupère la première pour simplifier la réponse principale.
     */
    const commandites = Array.isArray(result.commandites) ? result.commandites : [];
    const premiereCommandite = commandites[0] ?? null;

    return res.status(201).json({
      message: "Inscription commanditaire enregistrée avec succès",
      commandite_id: premiereCommandite?.id ?? null,
      commandite: premiereCommandite,
      commandites,
    });
  } catch (err) {
    console.error("POST /public/inscription/commanditaire:", err);
    return res.status(500).json({ message: "Erreur serveur" });
  }
});

/**
 * --------------------------------------------------------------------
 * POST /public/inscription/verifier-noms-joueurs
 * --------------------------------------------------------------------
 * Vérifie si au moins un joueur nommé est déjà inscrit dans le tournoi.
 *
 * Body attendu :
 * {
 *   tournoi_id,
 *   joueurs: [
 *     { prenom, nom },
 *     ...
 *   ]
 * }
 *
 * Objectif :
 * - éviter des doublons visibles avant soumission finale
 * - vérifier des noms de participants ou de joueurs commandités
 *
 * Réponses :
 * - 200 : retourne { conflit: boolean }
 * - 400 : tournoi_id invalide, joueurs invalide, trop de joueurs
 * - 500 : erreur serveur
 */
router.post("/inscription/verifier-noms-joueurs", async (req, res) => {
  /**
   * Validation de l'identifiant du tournoi.
   */
  const tournoi_id = parseId(req.body?.tournoi_id);

  if (!tournoi_id) {
    return res.status(400).json({ message: "tournoi_id invalide" });
  }

  /**
   * Vérifie que joueurs est bien un tableau.
   */
  const joueurs = req.body?.joueurs;

  if (!Array.isArray(joueurs)) {
    return res.status(400).json({ message: "joueurs doit être un tableau" });
  }

  /**
   * Protection contre un volume trop grand.
   */
  if (joueurs.length > MAX_JOUEURS_VERIF_NOMS) {
    return res.status(400).json({ message: "Trop de joueurs à vérifier" });
  }

  /**
   * Nettoyage des joueurs :
   * - on garde seulement ceux qui ont un prénom et un nom non vides
   * - on retire les espaces inutiles
   */
  const cleaned = [];

  for (const j of joueurs) {
    const prenom = String(j?.prenom ?? "").trim();
    const nom = String(j?.nom ?? "").trim();

    if (prenom && nom) {
      cleaned.push({ prenom, nom });
    }
  }

  try {
    /**
     * Vérifie les conflits de noms dans le tournoi.
     */
    const { conflit } = await verifierConflitsNomsJoueursTournoi(
      tournoi_id,
      cleaned
    );

    return res.status(200).json({ conflit });
  } catch (err) {
    console.error("POST /public/inscription/verifier-noms-joueurs:", err);
    return res.status(500).json({ message: "Erreur serveur" });
  }
});

/**
 * Vérifie si un courriel est déjà inscrit pour un tournoi.
 *
 * URL :
 * POST /public/inscription/verifier-courriel
 *
 * Body attendu :
 * {
 *   "tournoi_id": 1,
 *   "courriel": "test@test.com"
 * }
 */
router.post("/inscription/verifier-courriel", async (req, res) => {
  try {
    const tournoiId = Number(req.body?.tournoi_id);
    const courriel = String(req.body?.courriel || "").trim().toLowerCase();

    if (!Number.isInteger(tournoiId) || tournoiId <= 0 || !courriel) {
      return res.status(400).json({
        message: "Données invalides.",
      });
    }

    const existe = await courrielDejaInscrit(tournoiId, courriel);

    return res.json({ existe });
  } catch (error) {
    console.error("Erreur verifier-courriel :", error);

    return res.status(500).json({
      message: "Erreur lors de la vérification du courriel.",
    });
  }
});

/**
 * Vérifie si un nom d'équipe existe déjà
 * pour un tournoi.
 */
router.post("/inscription/verifier-nom-equipe", async (req, res) => {
  try {
    const tournoiId = Number(req.body?.tournoi_id);
    const nomEquipe = String(req.body?.nom_equipe || "").trim();

    if (!Number.isInteger(tournoiId) || tournoiId <= 0 || !nomEquipe) {
      return res.status(400).json({
        message: "Données invalides.",
      });
    }

    const existe = await nomEquipeDejaExiste(tournoiId, nomEquipe);

    return res.json({ existe });
  } catch (error) {
    console.error("Erreur verifier-nom-equipe :", error);

    return res.status(500).json({
      message: "Erreur lors de la vérification du nom d'équipe.",
    });
  }
});

/**
 * Vérifie si un code d'équipe est valide
 * pour le tournoi actif et si l'équipe
 * peut encore être rejointe.
 */
router.post("/inscription/verifier-code-equipe", async (req, res) => {
  try {
    const tournoiId = Number(req.body?.tournoi_id);
    const codeEquipe = String(req.body?.code_equipe || "").trim().toUpperCase();

    if (!Number.isInteger(tournoiId) || tournoiId <= 0 || !codeEquipe) {
      return res.status(400).json({
        message: "Données invalides.",
      });
    }

    const existe = await codeEquipeRejoignable(tournoiId, codeEquipe);

    return res.json({ existe });
  } catch (error) {
    console.error("Erreur verifier-code-equipe :", error);

    return res.status(500).json({
      message: "Erreur lors de la vérification du code d'équipe.",
    });
  }
});

/**
 * Export du routeur pour montage dans l'application principale.
 */
export default router;