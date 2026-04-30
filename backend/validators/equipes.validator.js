/**
 * =============================================================================
 * EQUIPES VALIDATOR
 * =============================================================================
 *
 * Ce module contient toutes les fonctions de validation utilisées
 * par les routes admin liées à la gestion des équipes et participants.
 *
 * Chaque fonction retourne toujours un objet de la forme :
 *
 * {
 *   ok: boolean,
 *   errors: object,
 *   cleaned: object
 * }
 *
 * Objectifs principaux :
 * - Valider les entrées utilisateur
 * - Nettoyer les valeurs
 * - Appliquer des limites de longueur
 * - Préparer des données propres pour la suite du traitement
 */

/**
 * Limites maximales autorisées pour les différents champs texte.
 */
const LIMITS = {
  NOM_EQUIPE_MAX: 120,
  PRENOM_MAX: 80,
  NOM_MAX: 80,
  COURRIEL_MAX: 150,
  TELEPHONE_MAX: 30,
};

/**
 * Nettoie une valeur texte.
 *
 * - Retourne null si la valeur n'est pas une chaîne
 * - Supprime les espaces au début et à la fin
 * - Retourne null si la chaîne est vide après nettoyage
 *
 * @param {*} value Valeur brute reçue
 * @returns {string|null} Texte nettoyé ou null
 */
function safeTrim(value) {
  if (typeof value !== "string") return null;

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Convertit une valeur en identifiant entier positif.
 *
 * @param {*} raw Valeur brute reçue
 * @returns {number|null} ID valide ou null
 */
export function parseId(raw) {
  const n = Number(raw);

  if (!Number.isInteger(n) || n <= 0) return null;

  return n;
}

/**
 * Vérifie si un courriel respecte un format simple valide.
 *
 * @param {string} email Courriel à vérifier
 * @returns {boolean} true si valide
 */
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * ============================================================================
 * POST /admin/equipes
 * ============================================================================
 *
 * Valide le payload pour créer une équipe.
 *
 * @param {object} body Données reçues dans la requête
 * @returns {{
 *   ok: boolean,
 *   errors: object,
 *   cleaned: {
 *     tournoi_id: number|null,
 *     nom_equipe: string|null
 *   }
 * }}
 */
export function validateCreerEquipePayload(body) {
  const errors = {};

  const tournoi_id = parseId(body?.tournoi_id);

  if (!tournoi_id) {
    errors.tournoi_id =
      "tournoi_id est requis et doit être un entier positif.";
  }

  const nom_equipe = safeTrim(body?.nom_equipe) || null;

  if (nom_equipe && nom_equipe.length > LIMITS.NOM_EQUIPE_MAX) {
    errors.nom_equipe =
      `Le nom d'équipe dépasse ${LIMITS.NOM_EQUIPE_MAX} caractères.`;
  }

  const ok = Object.keys(errors).length === 0;

  return {
    ok,
    errors,
    cleaned: {
      tournoi_id,
      nom_equipe,
    },
  };
}

/**
 * ============================================================================
 * POST /admin/equipes/:id/membres
 * ============================================================================
 *
 * Valide le payload pour ajouter un participant existant à une équipe.
 *
 * @param {object} params Paramètres de route
 * @param {object} body Corps de requête
 * @returns {{
 *   ok: boolean,
 *   errors: object,
 *   cleaned: {
 *     equipe_id: number|null,
 *     participant_id: number|null
 *   }
 * }}
 */
export function validateAjouterMembrePayload(params, body) {
  const errors = {};

  const equipe_id = parseId(params?.id);

  if (!equipe_id) {
    errors.equipe_id = "ID d'équipe invalide.";
  }

  const participant_id = parseId(body?.participant_id);

  if (!participant_id) {
    errors.participant_id =
      "participant_id est requis (entier positif).";
  }

  const ok = Object.keys(errors).length === 0;

  return {
    ok,
    errors,
    cleaned: {
      equipe_id,
      participant_id,
    },
  };
}

/**
 * ============================================================================
 * POST /admin/equipes/:id/membres/nouveau
 * ============================================================================
 *
 * Valide le payload pour créer un nouveau participant
 * et l'ajouter à une équipe.
 *
 * @param {object} params Paramètres URL
 * @param {object} body Corps de requête
 * @returns {{ ok: boolean, errors: object, cleaned: object }}
 */
export function validateNouveauMembrePayload(params, body) {
  const errors = {};

  const equipe_id = parseId(params?.id);

  if (!equipe_id) {
    errors.equipe_id = "ID d'équipe invalide.";
  }

  const prenom = safeTrim(body?.prenom);

  if (!prenom) {
    errors.prenom = "Le prénom est obligatoire.";
  } else if (prenom.length > LIMITS.PRENOM_MAX) {
    errors.prenom =
      `Le prénom dépasse ${LIMITS.PRENOM_MAX} caractères.`;
  }

  const nom = safeTrim(body?.nom);

  if (!nom) {
    errors.nom = "Le nom est obligatoire.";
  } else if (nom.length > LIMITS.NOM_MAX) {
    errors.nom =
      `Le nom dépasse ${LIMITS.NOM_MAX} caractères.`;
  }

  const courriel = safeTrim(body?.courriel);

  if (!courriel) {
    errors.courriel = "Le courriel est obligatoire.";
  } else if (courriel.length > LIMITS.COURRIEL_MAX) {
    errors.courriel =
      `Le courriel dépasse ${LIMITS.COURRIEL_MAX} caractères.`;
  } else if (!isValidEmail(courriel)) {
    errors.courriel = "Courriel invalide.";
  }

  const telephone = safeTrim(body?.telephone) || null;

  if (telephone && telephone.length > LIMITS.TELEPHONE_MAX) {
    errors.telephone =
      `Le téléphone dépasse ${LIMITS.TELEPHONE_MAX} caractères.`;
  }

  const ok = Object.keys(errors).length === 0;

  return {
    ok,
    errors,
    cleaned: {
      equipe_id,
      prenom,
      nom,
      courriel,
      telephone,
    },
  };
}

/**
 * ============================================================================
 * PUT /admin/equipes/:id
 * ============================================================================
 *
 * Valide la modification du nom d'une équipe.
 *
 * @param {object} params Paramètres URL
 * @param {object} body Corps requête
 * @returns {{ ok: boolean, errors: object, cleaned: object }}
 */
export function validateModifierEquipePayload(params, body) {
  const errors = {};

  const equipe_id = parseId(params?.id);

  if (!equipe_id) {
    errors.equipe_id = "ID d'équipe invalide.";
  }

  const nom_equipe = safeTrim(body?.nom_equipe);

  if (!nom_equipe) {
    errors.nom_equipe = "Le nom d'équipe est requis.";
  } else if (nom_equipe.length > LIMITS.NOM_EQUIPE_MAX) {
    errors.nom_equipe =
      `Le nom d'équipe dépasse ${LIMITS.NOM_EQUIPE_MAX} caractères.`;
  }

  const ok = Object.keys(errors).length === 0;

  return {
    ok,
    errors,
    cleaned: {
      equipe_id,
      nom_equipe,
    },
  };
}

/**
 * ============================================================================
 * PATCH /admin/joueurs-commandites/:id
 * ============================================================================
 *
 * Valide la modification de l'identité d'un joueur commandité.
 *
 * @param {object} body Données requête
 * @returns {{ ok: boolean, errors: object, cleaned: object }}
 */
export function validateJoueurCommanditeIdentitePayload(body) {
  const errors = {};

  const prenom = safeTrim(body?.prenom);
  const nom = safeTrim(body?.nom);

  if (!prenom) {
    errors.prenom = "Le prénom est requis.";
  } else if (prenom.length > LIMITS.PRENOM_MAX) {
    errors.prenom =
      `Le prénom dépasse ${LIMITS.PRENOM_MAX} caractères.`;
  }

  if (!nom) {
    errors.nom = "Le nom est requis.";
  } else if (nom.length > LIMITS.NOM_MAX) {
    errors.nom =
      `Le nom dépasse ${LIMITS.NOM_MAX} caractères.`;
  }

  const ok = Object.keys(errors).length === 0;

  return {
    ok,
    errors,
    cleaned: {
      prenom,
      nom,
    },
  };
}

/**
 * ============================================================================
 * POST /admin/joueurs-commandites/:id/assigner-equipe
 * ============================================================================
 *
 * Valide l'assignation d'un joueur commandité à une équipe.
 *
 * @param {object} body Données requête
 * @returns {{ ok: boolean, errors: object, cleaned: object }}
 */
export function validateAssignJoueurCommanditeEquipePayload(body) {
  const errors = {};

  const equipe_id = parseId(body?.equipe_id);

  if (!equipe_id) {
    errors.equipe_id =
      "equipe_id est requis et doit être un entier positif.";
  }

  const ok = Object.keys(errors).length === 0;

  return {
    ok,
    errors,
    cleaned: {
      equipe_id,
    },
  };
}

/**
 * ============================================================================
 * PATCH /admin/participants/:id
 * ============================================================================
 *
 * Valide la modification d'un participant.
 *
 * @param {object} body Données reçues
 * @returns {{ ok: boolean, errors: object, cleaned: object }}
 */
export function validateModifierParticipantPayload(body) {
  const errors = {};

  const prenom = safeTrim(body?.prenom);
  const nom = safeTrim(body?.nom);
  const courriel = safeTrim(body?.courriel);
  const telephone = safeTrim(body?.telephone) || null;

  if (!prenom) {
    errors.prenom = "Le prénom est obligatoire.";
  } else if (prenom.length > LIMITS.PRENOM_MAX) {
    errors.prenom = `Le prénom dépasse ${LIMITS.PRENOM_MAX} caractères.`;
  }

  if (!nom) {
    errors.nom = "Le nom est obligatoire.";
  } else if (nom.length > LIMITS.NOM_MAX) {
    errors.nom = `Le nom dépasse ${LIMITS.NOM_MAX} caractères.`;
  }

  if (!courriel) {
    errors.courriel = "Le courriel est obligatoire.";
  } else if (courriel.length > LIMITS.COURRIEL_MAX) {
    errors.courriel = `Le courriel dépasse ${LIMITS.COURRIEL_MAX} caractères.`;
  } else if (!isValidEmail(courriel)) {
    errors.courriel = "Courriel invalide.";
  }

  if (telephone && telephone.length > LIMITS.TELEPHONE_MAX) {
    errors.telephone = `Le téléphone dépasse ${LIMITS.TELEPHONE_MAX} caractères.`;
  }

  const ok = Object.keys(errors).length === 0;

  return {
    ok,
    errors,
    cleaned: {
      prenom,
      nom,
      courriel,
      telephone,
    },
  };
}

/**
 * ============================================================================
 * POST /admin/equipes/:id/membres/:participantId/deplacer
 * ============================================================================
 *
 * Valide le déplacement d'un membre d'une équipe source
 * vers une équipe cible.
 *
 * @param {object} params Paramètres de route
 * @param {object} body Corps requête
 * @returns {{ ok: boolean, errors: object, cleaned: object }}
 */
export function validateDeplacerMembrePayload(params, body) {
  const errors = {};

  const equipe_source_id = parseId(params?.id);
  const participant_id = parseId(params?.participantId);
  const equipe_cible_id = parseId(body?.equipe_cible_id);

  if (!equipe_source_id) {
    errors.equipe_source_id = "ID équipe source invalide.";
  }

  if (!participant_id) {
    errors.participant_id = "ID participant invalide.";
  }

  if (!equipe_cible_id) {
    errors.equipe_cible_id =
      "equipe_cible_id est requis et doit être un entier positif.";
  }

  const ok = Object.keys(errors).length === 0;

  return {
    ok,
    errors,
    cleaned: {
      equipe_source_id,
      participant_id,
      equipe_cible_id,
    },
  };
}