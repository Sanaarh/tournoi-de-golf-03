// backend/validators/inscriptionTournoi.validator.js

/**
 * =============================================================================
 * INSCRIPTION TOURNOI VALIDATOR
 * =============================================================================
 *
 * Ce module contient les fonctions de validation utilisées pour les
 * inscriptions publiques au tournoi.
 *
 * Il couvre principalement trois scénarios :
 * - création d'une nouvelle équipe
 * - rejoindre une équipe existante
 * - inscription en tant que commanditaire
 *
 * Les fonctions exportées retournent toujours un objet de la forme :
 * {
 *   ok: boolean,      // true si aucune erreur de validation
 *   errors: object,   // liste des erreurs par champ
 *   cleaned: object   // données nettoyées prêtes à être utilisées
 * }
 */

/**
 * Limites maximales autorisées pour les différents champs texte.
 */
const LIMITS = {
  PRENOM_MAX: 80,
  NOM_MAX: 80,
  COURRIEL_MAX: 150,
  TELEPHONE_MAX: 30,
  NOM_EQUIPE_MAX: 120,
};

/**
 * Nettoie une valeur texte.
 *
 * Si la valeur n'est pas une chaîne, retourne une chaîne vide.
 * Sinon, supprime les espaces au début et à la fin.
 *
 * @param {*} value Valeur brute reçue
 * @returns {string} Chaîne nettoyée ou chaîne vide
 */
function safeTrim(value) {
  if (typeof value !== "string") return "";
  return value.trim();
}

/**
 * Catégorie employé / retraité pour inscription équipe (optionnel, défaut employe).
 *
 * @param {object} body
 * @param {object} errors
 * @returns {"employe"|"retraite"|null}
 */
function parseCategorieEmployeRetraite(body, errors) {
  let raw = safeTrim(body?.categorie_participant).toLowerCase();
  if (!raw) return "employe";
  if (raw === "employé") raw = "employe";
  if (!["employe", "retraite"].includes(raw)) {
    errors.categorie_participant = "Valeur invalide : employe ou retraite.";
    return null;
  }
  return raw;
}

/**
 * Génère une clé normalisée à partir du prénom et du nom d'un joueur.
 *
 * Cette clé est utilisée pour détecter les doublons de joueurs
 * indépendamment des majuscules/minuscules.
 *
 * Exemple :
 * - "Ali", "Dupont"
 * - "ALI", "dupont"
 *
 * donneront la même clé.
 *
 * Si le prénom ou le nom est vide après nettoyage,
 * la fonction retourne null.
 *
 * @param {string} prenom Prénom du joueur
 * @param {string} nom Nom du joueur
 * @returns {string|null} Clé unique normalisée ou null
 */
function joueurNomKey(prenom, nom) {
  const p = safeTrim(prenom).toLowerCase();
  const n = safeTrim(nom).toLowerCase();

  // Impossible de construire une clé si l'une des deux valeurs manque
  if (!p || !n) return null;

  return `${p}\n${n}`;
}

/**
 * Vérifie s'il existe au moins deux joueurs complets
 * qui partagent la même combinaison prénom + nom.
 *
 * Le contrôle est fait sur l'ensemble des joueurs,
 * tous types de commandite confondus.
 *
 * @param {Record<string, Array<{ prenom: string; nom: string }>>} joueursParType
 * @returns {boolean} true si un doublon complet est trouvé, sinon false
 */
function hasDuplicateJoueurNames(joueursParType) {
  const seen = new Set();

  // On parcourt chaque liste de joueurs associée à un type de commandite
  for (const rows of Object.values(joueursParType)) {
    if (!Array.isArray(rows)) continue;

    for (const row of rows) {
      const k = joueurNomKey(row?.prenom, row?.nom);

      // On ignore les joueurs incomplets
      if (!k) continue;

      // Si la clé existe déjà, on a trouvé un doublon
      if (seen.has(k)) return true;

      seen.add(k);
    }
  }

  return false;
}

/**
 * Vérifie le format général d'un courriel.
 *
 * @param {string} email Courriel à valider
 * @returns {boolean} true si le format est valide
 */
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Vérifie le format d'un code d'équipe.
 *
 * Règle :
 * - exactement 6 caractères
 * - uniquement lettres majuscules et chiffres
 *
 * @param {string} code Code d'équipe
 * @returns {boolean} true si le code est valide
 */
function isValidTeamCode(code) {
  return /^[A-Z0-9]{6}$/.test(code);
}

/**
 * Convertit une valeur brute en entier positif valide.
 *
 * Utilisé pour valider les identifiants (tournoi, type de commandite, etc.).
 *
 * @param {*} raw Valeur brute reçue
 * @returns {number|null} Entier positif valide ou null
 */
export function parseId(raw) {
  const n = Number(raw);

  // Un identifiant valide doit être un entier strictement positif
  if (!Number.isInteger(n) || n <= 0) return null;

  return n;
}

/**
 * Valide les champs communs d'un participant.
 *
 * Champs validés :
 * - prenom
 * - nom
 * - courriel
 * - telephone
 *
 * Les erreurs sont ajoutées directement dans l'objet `errors`
 * passé en paramètre.
 *
 * @param {object} body Corps de requête
 * @param {object} errors Objet contenant les erreurs de validation
 * @returns {{
 *   prenom: string|null,
 *   nom: string|null,
 *   courriel: string|null,
 *   telephone: string|null
 * }}
 */
function validateParticipantFields(body, errors) {
  const prenom = safeTrim(body?.prenom);
  const nom = safeTrim(body?.nom);
  const courriel = safeTrim(body?.courriel);

  /**
   * Le téléphone est optionnel.
   * Si vide après nettoyage, on le convertit en null.
   */
  const telephone = safeTrim(body?.telephone) || null;

  // ----------------------------
  // Validation prénom
  // ----------------------------
  if (!prenom) {
    errors.prenom = "Le prénom est obligatoire.";
  } else if (prenom.length > LIMITS.PRENOM_MAX) {
    errors.prenom = `Le prénom dépasse ${LIMITS.PRENOM_MAX} caractères.`;
  }

  // ----------------------------
  // Validation nom
  // ----------------------------
  if (!nom) {
    errors.nom = "Le nom est obligatoire.";
  } else if (nom.length > LIMITS.NOM_MAX) {
    errors.nom = `Le nom dépasse ${LIMITS.NOM_MAX} caractères.`;
  }

  // ----------------------------
  // Validation courriel
  // ----------------------------
  if (!courriel) {
    errors.courriel = "Le courriel est obligatoire.";
  } else if (!isValidEmail(courriel)) {
    errors.courriel = "Format de courriel invalide.";
  } else if (courriel.length > LIMITS.COURRIEL_MAX) {
    errors.courriel = `Le courriel dépasse ${LIMITS.COURRIEL_MAX} caractères.`;
  }

  // ----------------------------
  // Validation téléphone
  // ----------------------------
  if (telephone && telephone.length > LIMITS.TELEPHONE_MAX) {
    errors.telephone = `Le téléphone dépasse ${LIMITS.TELEPHONE_MAX} caractères.`;
  }

  return {
    prenom: prenom || null,
    nom: nom || null,
    courriel: courriel || null,
    telephone,
  };
}

/**
 * =============================================================================
 * POST /public/inscription/creer-equipe
 * =============================================================================
 *
 * Valide le payload de création d'une équipe.
 *
 * Champs attendus :
 * - tournoi_id
 * - prenom
 * - nom
 * - courriel
 * - telephone (optionnel)
 * - nom_equipe
 *
 * @param {object} body Corps de requête
 * @returns {{ ok: boolean, errors: object, cleaned: object }}
 */
export function validateCreerEquipePayload(body) {
  const errors = {};

  /**
   * Validation de l'identifiant du tournoi.
   */
  const tournoi_id = parseId(body?.tournoi_id);

  if (!tournoi_id) {
    errors.tournoi_id = "tournoi_id est requis (entier positif).";
  }

  /**
   * Validation des champs du participant principal.
   */
  const participant = validateParticipantFields(body, errors);

  /**
   * Validation du nom d'équipe.
   */
  const nom_equipe = safeTrim(body?.nom_equipe) || null;

  if (!nom_equipe) {
    errors.nom_equipe = "Le nom d'équipe est obligatoire.";
  } else if (nom_equipe.length > LIMITS.NOM_EQUIPE_MAX) {
    errors.nom_equipe = `Le nom d'équipe dépasse ${LIMITS.NOM_EQUIPE_MAX} caractères.`;
  }

  const categorie_participant =
    parseCategorieEmployeRetraite(body, errors) ?? "employe";

  const ok = Object.keys(errors).length === 0;

  return {
    ok,
    errors,
    cleaned: {
      tournoi_id,
      ...participant,
      nom_equipe,
      categorie_participant,
    },
  };
}

/**
 * =============================================================================
 * POST /public/inscription/rejoindre-equipe
 * =============================================================================
 *
 * Valide le payload permettant à un participant
 * de rejoindre une équipe existante.
 *
 * Champs attendus :
 * - tournoi_id
 * - prenom
 * - nom
 * - courriel
 * - telephone (optionnel)
 * - code_equipe
 *
 * @param {object} body Corps de requête
 * @returns {{ ok: boolean, errors: object, cleaned: object }}
 */
export function validateRejoindreEquipePayload(body) {
  const errors = {};

  /**
   * Validation de l'identifiant du tournoi.
   */
  const tournoi_id = parseId(body?.tournoi_id);

  if (!tournoi_id) {
    errors.tournoi_id = "tournoi_id est requis (entier positif).";
  }

  /**
   * Validation des champs du participant.
   */
  const participant = validateParticipantFields(body, errors);

  /**
   * Le code d'équipe est nettoyé puis converti en majuscules
   * avant validation.
   */
  const code_equipe = safeTrim(body?.code_equipe).toUpperCase() || null;

  if (!code_equipe) {
    errors.code_equipe = "Le code d'équipe est obligatoire.";
  } else if (!isValidTeamCode(code_equipe)) {
    errors.code_equipe =
      "Le code d'équipe doit contenir 6 caractères alphanumériques majuscules.";
  }

  const categorie_participant =
    parseCategorieEmployeRetraite(body, errors) ?? "employe";

  const ok = Object.keys(errors).length === 0;

  return {
    ok,
    errors,
    cleaned: {
      tournoi_id,
      ...participant,
      code_equipe,
      categorie_participant,
    },
  };
}

/**
 * =============================================================================
 * POST /public/inscription/commanditaire
 * =============================================================================
 *
 * Valide le payload d'une inscription commanditaire.
 *
 * Champs principaux :
 * - tournoi_id
 * - prenom
 * - nom
 * - courriel
 * - telephone (optionnel)
 * - nom_entreprise (optionnel)
 * - type_commandite_id ou type_commandite_ids
 * - joueurs_par_type / joueurs_commandite (optionnel)
 *
 * @param {object} body Corps de requête
 * @returns {{ ok: boolean, errors: object, cleaned: object }}
 */
export function validateCommanditairePayload(body) {
  const errors = {};

  /**
   * Validation de l'identifiant du tournoi.
   */
  const tournoi_id = parseId(body?.tournoi_id);

  if (!tournoi_id) {
    errors.tournoi_id = "tournoi_id est requis (entier positif).";
  }

  /**
   * Validation des champs participant.
   */
  const participant = validateParticipantFields(body, errors);

  /**
   * Le nom d'entreprise est optionnel.
   * Si vide, il sera converti en null.
   */
  const nom_entreprise = safeTrim(body?.nom_entreprise) || null;

  /**
   * Le payload accepte soit :
   * - un seul type_commandite_id
   * - un tableau type_commandite_ids
   */
  const rawTypeId = body?.type_commandite_id;
  const rawTypeIds = body?.type_commandite_ids;

  /**
   * Tableau final des IDs de types de commandite valides.
   */
  let type_commandite_ids = [];

  if (Array.isArray(rawTypeIds)) {
    /**
     * Si on reçoit un tableau, on parse chaque valeur
     * et on garde seulement les IDs valides.
     */
    type_commandite_ids = rawTypeIds.map(parseId).filter((v) => v !== null);
  } else if (rawTypeId !== undefined && rawTypeId !== null) {
    /**
     * Si on reçoit un seul ID, on le transforme
     * en tableau de taille 1.
     */
    const parsed = parseId(rawTypeId);

    if (parsed) {
      type_commandite_ids = [parsed];
    }
  }

  if (type_commandite_ids.length === 0) {
    errors.type_commandite_ids = "Au moins un type de commandite est requis.";
  }

  /**
   * Structure finale normalisée des joueurs par type de commandite.
   *
   * Format attendu :
   * {
   *   "1": [{ prenom, nom }, ...],
   *   "2": [{ prenom, nom }, ...]
   * }
   */
  let joueurs_par_type = {};

  /**
   * Le payload supporte deux noms possibles
   * pour rester compatible avec différentes sources :
   * - joueurs_par_type
   * - joueurs_commandite
   */
  const rawJoueurs = body?.joueurs_par_type ?? body?.joueurs_commandite;

  if (rawJoueurs !== undefined && rawJoueurs !== null) {
    /**
     * On exige ici un objet et non un tableau.
     */
    if (typeof rawJoueurs !== "object" || Array.isArray(rawJoueurs)) {
      errors.joueurs_par_type =
        "joueurs_par_type doit être un objet (id de type → liste de joueurs).";
    } else {
      /**
       * Parcours de chaque type de commandite
       * et normalisation des joueurs associés.
       */
      for (const [key, rows] of Object.entries(rawJoueurs)) {
        const tid = parseId(key);

        // La clé doit représenter un ID valide de type de commandite
        if (!tid) {
          errors[`joueurs_par_type.${key}`] =
            "Identifiant de type de commandite invalide.";
          continue;
        }

        // La valeur associée à chaque type doit être un tableau
        if (!Array.isArray(rows)) {
          errors[`joueurs_par_type.${key}`] =
            "La liste de joueurs doit être un tableau.";
          continue;
        }

        /**
         * Nettoyage des joueurs :
         * chaque joueur est converti en objet { prenom, nom }
         * avec suppression des espaces inutiles.
         */
        joueurs_par_type[String(tid)] = rows.map((row) => ({
          prenom: safeTrim(row?.prenom),
          nom: safeTrim(row?.nom),
        }));
      }
    }
  }

  /**
   * On vérifie les doublons seulement si aucune erreur
   * de structure joueurs_par_type n'a déjà été détectée.
   */
  const joueursParTypeErrors = Object.keys(errors).some(
    (k) => k === "joueurs_par_type" || k.startsWith("joueurs_par_type.")
  );

  if (!joueursParTypeErrors && hasDuplicateJoueurNames(joueurs_par_type)) {
    errors.joueurs_par_type =
      "Chaque joueur doit avoir une combinaison prénom et nom unique (pas deux fois la même personne).";
  }

  const ok = Object.keys(errors).length === 0;

  return {
    ok,
    errors,
    cleaned: {
      tournoi_id,
      ...participant,
      nom_entreprise,
      type_commandite_ids,
      joueurs_par_type,
    },
  };
}