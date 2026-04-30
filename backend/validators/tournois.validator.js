// backend/validators/tournois.validator.js

/**
 * =============================================================================
 * TOURNOIS VALIDATOR
 * =============================================================================
 *
 * Ce module contient les fonctions de validation et de nettoyage
 * du payload utilisé pour créer ou modifier un tournoi.
 *
 * Règles principales appliquées :
 * - nom obligatoire
 * - nom unique (via fonction injectée)
 * - date du tournoi obligatoire et non passée
 * - capacité minimale de 4 joueurs
 * - capacité multiple de 4
 * - prix du joueur strictement supérieur à 0
 * - dates d'inscription valides et cohérentes
 * - dates d'inscription obligatoires ensemble
 * - début d'inscription non passé
 * - impossible d'ouvrir les inscriptions sans dates valides
 * - quota commandites cohérent avec la capacité
 *
 * La fonction exportée retourne toujours :
 * {
 *   ok: boolean,
 *   errors: object,
 *   cleaned: object
 * }
 */

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
function normalizeText(value) {
  if (typeof value !== "string") return null;

  const v = value.trim();
  return v.length ? v : null;
}

/**
 * Convertit une valeur en entier >= 0.
 *
 * Cette fonction est utilisée pour les champs entiers
 * comme la capacité ou le quota de commandites.
 *
 * @param {*} value Valeur brute à convertir
 * @returns {number|null} Entier >= 0 ou null si invalide
 */
function parseIntGE0(value) {
  const n = Number(value);

  if (!Number.isFinite(n)) return null;

  const i = Math.trunc(n);

  if (i < 0) return null;

  return i;
}

/**
 * Convertit une valeur en nombre >= 0 avec arrondi à 2 décimales.
 *
 * @param {*} value Valeur brute à convertir
 * @returns {number|null} Nombre >= 0 ou null si invalide
 */
function parseNumberGE0(value) {
  const n = Number(value);

  if (!Number.isFinite(n) || n < 0) return null;

  return Math.round(n * 100) / 100;
}

/**
 * Convertit une valeur en booléen.
 *
 * Valeurs acceptées :
 * - true / false
 * - "true" / "false"
 *
 * Toute autre valeur retourne false.
 *
 * @param {*} value Valeur brute reçue
 * @returns {boolean} Booléen normalisé
 */
function parseBool(value) {
  if (typeof value === "boolean") return value;

  if (typeof value === "string") {
    const v = value.trim().toLowerCase();

    if (v === "true") return true;
    if (v === "false") return false;
  }

  return false;
}

/**
 * Vérifie le format strict YYYY-MM-DD.
 *
 * @param {*} value Valeur à valider
 * @returns {boolean} true si le format est valide
 */
function isDateYYYYMMDD(value) {
  if (typeof value !== "string") return false;
  return /^\d{4}-\d{2}-\d{2}$/.test(value.trim());
}

/**
 * Compare deux dates au format YYYY-MM-DD.
 *
 * Grâce au format normalisé, une comparaison lexicographique
 * suffit pour comparer les dates.
 *
 * @param {string} a Première date
 * @param {string} b Deuxième date
 * @returns {number}
 * -1 si a < b
 *  0 si a === b
 *  1 si a > b
 */
function cmpDate(a, b) {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/**
 * Convertit une valeur brute en identifiant entier positif.
 *
 * @param {*} raw Valeur brute
 * @returns {number|null} ID valide ou null
 */
export function parseId(raw) {
  const id = Number(raw);

  if (!Number.isInteger(id) || id <= 0) return null;

  return id;
}

/**
 * Valide et nettoie le payload d'un tournoi.
 *
 * IMPORTANT :
 * - `nombre_equipes_max` est calculé ici automatiquement
 * - `isNomUniqueFn` permet d'injecter une règle métier externe
 *   pour vérifier si le nom du tournoi existe déjà
 *
 * @param {object} body Corps de requête
 * @param {string} [today] Date du jour au format YYYY-MM-DD (utile pour les tests)
 * @param {(nom: string, body?: object) => boolean|Promise<boolean>} [isNomUniqueFn]
 * Fonction optionnelle qui retourne true si le nom est unique, sinon false
 *
 * @returns {Promise<{
 *   ok: boolean,
 *   errors: object,
 *   cleaned: {
 *     nom: string|null,
 *     lieu: string|null,
 *     date_tournoi: string|null,
 *     inscription_debut: string|null,
 *     inscription_fin: string|null,
 *     inscriptions_ouvertes: boolean,
 *     capacite_joueurs: number,
 *     nombre_equipes_max: number,
 *     limite_commandites: number,
 *     prix_joueur: number
 *   }
 * }>}
 */
/**
 * Retourne la date locale du jour au format YYYY-MM-DD
 * Corrige le bug des fuseaux horaires (UTC vs local)
 */
function getLocalTodayYYYYMMDD() {

  const now = new Date();

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export async function validateTournoiPayload(
  body,
  today = getLocalTodayYYYYMMDD(),
  isNomUniqueFn
) {
  const errors = {};

  /**
   * Nettoyage des champs texte principaux.
   */
  const nom = normalizeText(body?.nom);
  const lieu = normalizeText(body?.lieu);

  /**
   * Nettoyage des dates.
   *
   * On conserve null si la date n'est pas fournie
   * ou vide après trim.
   */
  const date_tournoi =
    typeof body?.date_tournoi === "string"
      ? body.date_tournoi.trim()
      : null;

  const inscription_debut =
    typeof body?.inscription_debut === "string" && body.inscription_debut.trim()
      ? body.inscription_debut.trim()
      : null;

  const inscription_fin =
    typeof body?.inscription_fin === "string" && body.inscription_fin.trim()
      ? body.inscription_fin.trim()
      : null;

  /**
   * Lecture des champs booléens et numériques.
   */
  const inscriptions_ouvertes = parseBool(body?.inscriptions_ouvertes);
  const capacite_joueurs = parseIntGE0(body?.capacite_joueurs ?? 0);
  const limite_commandites = parseIntGE0(body?.limite_commandites ?? 0);
  const prix_joueur = parseNumberGE0(body?.prix_joueur ?? 0);

  // ===========================================================================
  // Validation des champs obligatoires
  // ===========================================================================

  if (!nom) {
    errors.nom = "Le nom du tournoi est obligatoire.";
  }

  if (!date_tournoi || !isDateYYYYMMDD(date_tournoi)) {
    errors.date_tournoi = "La date du tournoi est obligatoire (YYYY-MM-DD).";
  } else if (cmpDate(date_tournoi, today) === -1) {
    errors.date_tournoi = "La date du tournoi doit être aujourd'hui ou dans le futur.";
  }

  // ===========================================================================
  // Validation longueurs
  // ===========================================================================

  if (nom && nom.length > 120) {
    errors.nom = "Nom trop long (max 120).";
  }

  if (lieu && lieu.length > 120) {
    errors.lieu = "Lieu trop long (max 120).";
  }

  // ===========================================================================
  // Validation unicité du nom du tournoi
  // ===========================================================================

  /**
   * Si une fonction métier d'unicité est fournie, on l'utilise.
   * Cela permet de garder la validation découplée de la base de données.
   */
  if (!errors.nom && nom && typeof isNomUniqueFn === "function") {
    const isUnique = await isNomUniqueFn(nom, body);

    if (!isUnique) {
      errors.nom = "Un tournoi avec ce nom existe déjà.";
    }
  }

  // ===========================================================================
  // Validation des nombres
  // ===========================================================================

  if (capacite_joueurs === null) {
    errors.capacite_joueurs = "Capacité joueurs invalide (entier ≥ 0).";
  }

  if (limite_commandites === null) {
    errors.limite_commandites = "Quota commandites invalide (entier ≥ 0).";
  }

  if (prix_joueur === null) {
    errors.prix_joueur = "Le prix du joueur doit être un nombre supérieur ou égal à 0.";
  }

  /**
   * Règle métier ajoutée :
   * la capacité doit être d'au moins 4 joueurs.
   */
  if (capacite_joueurs !== null && capacite_joueurs > 0 && capacite_joueurs < 4) {
    errors.capacite_joueurs = "La capacité minimale est de 4 joueurs.";
  }

  /**
   * Règle métier ajoutée :
   * le prix du joueur doit être strictement supérieur à 0.
   */
  if (prix_joueur !== null && prix_joueur <= 0) {
    errors.prix_joueur = "Le prix du joueur doit être supérieur à 0.";
  }

  // ===========================================================================
  // Validation multiple de 4
  // ===========================================================================

  if (
    capacite_joueurs !== null &&
    capacite_joueurs > 0 &&
    capacite_joueurs % 4 !== 0
  ) {
    errors.capacite_joueurs = "La capacité doit être un multiple de 4.";
  }

  // ===========================================================================
  // Calcul du nombre maximal d'équipes
  // ===========================================================================

  /**
   * Le nombre d'équipes est calculé uniquement si la capacité est valide,
   * strictement positive et divisible par 4.
   */
  let nombre_equipes_max = 0;

  if (
    capacite_joueurs !== null &&
    capacite_joueurs >= 4 &&
    capacite_joueurs % 4 === 0
  ) {
    nombre_equipes_max = capacite_joueurs / 4;
  }

  // ===========================================================================
  // Validation quota commandites
  // ===========================================================================

  /**
   * Le quota commandites est exprimé ici en nombre de joueurs.
   */
  if (limite_commandites !== null && limite_commandites > 0) {
    if (capacite_joueurs === null || capacite_joueurs <= 0) {
      errors.limite_commandites =
        "Définir d’abord la capacité totale avant le quota commandites.";
    } else if (limite_commandites >= capacite_joueurs) {
      errors.limite_commandites =
        "Le quota commandites doit être inférieur au total des joueurs.";
    }
  }

  // ===========================================================================
  // Validation des dates d'inscription
  // ===========================================================================

  if (inscription_debut && !isDateYYYYMMDD(inscription_debut)) {
    errors.inscription_debut = "Format invalide (YYYY-MM-DD).";
  }

  if (inscription_fin && !isDateYYYYMMDD(inscription_fin)) {
    errors.inscription_fin = "Format invalide (YYYY-MM-DD).";
  }

  /**
   * Règle métier ajoutée :
   * les deux dates doivent être fournies ensemble.
   */
  if ((inscription_debut && !inscription_fin) || (!inscription_debut && inscription_fin)) {
    errors.inscription_dates =
      "Les dates de début et de fin d’inscription doivent être fournies ensemble.";
  }

  /**
   * Règle métier ajoutée :
   * la date de début d'inscription ne peut pas être dans le passé.
   */
  if (
    inscription_debut &&
    isDateYYYYMMDD(inscription_debut) &&
    cmpDate(inscription_debut, today) === -1
  ) {
    errors.inscription_debut =
      "La date de début d’inscription doit être aujourd'hui ou dans le futur.";
  }

  /**
   * Cohérence chronologique entre début et fin d'inscription.
   */
  if (
    inscription_debut &&
    inscription_fin &&
    isDateYYYYMMDD(inscription_debut) &&
    isDateYYYYMMDD(inscription_fin) &&
    cmpDate(inscription_debut, inscription_fin) === 1
  ) {
    errors.inscription_fin =
      "La date de fin d’inscription doit être ≥ à la date de début.";
  }

  // ===========================================================================
  // Ouverture des inscriptions
  // ===========================================================================

  /**
   * Règle métier ajoutée :
   * on ne peut pas ouvrir les inscriptions sans période d'inscription complète.
   */
  if (inscriptions_ouvertes && (!inscription_debut || !inscription_fin)) {
    errors.inscriptions_ouvertes =
      "Impossible d’ouvrir les inscriptions sans dates de début et de fin.";
  }

  /**
   * Règle déjà présente :
   * on ne peut pas ouvrir les inscriptions si la fin est déjà dépassée.
   */
  if (
    inscriptions_ouvertes &&
    inscription_fin &&
    isDateYYYYMMDD(inscription_fin) &&
    cmpDate(inscription_fin, today) === -1
  ) {
    errors.inscriptions_ouvertes =
      "Impossible d'ouvrir les inscriptions : la date de fin est déjà dépassée.";
  }

  // ===========================================================================
  // Cohérence date tournoi vs dates d'inscription
  // ===========================================================================

  if (date_tournoi && isDateYYYYMMDD(date_tournoi)) {
    if (
      inscription_fin &&
      isDateYYYYMMDD(inscription_fin) &&
      cmpDate(date_tournoi, inscription_fin) === -1
    ) {
      errors.date_tournoi =
        "La date du tournoi ne peut pas être avant la fin des inscriptions.";
    } else if (
      inscription_debut &&
      isDateYYYYMMDD(inscription_debut) &&
      cmpDate(date_tournoi, inscription_debut) === -1
    ) {
      errors.date_tournoi =
        "La date du tournoi ne peut pas être avant le début des inscriptions.";
    }
  }

  const ok = Object.keys(errors).length === 0;

  return {
    ok,
    errors,
    cleaned: {
      nom,
      lieu,
      date_tournoi,
      inscription_debut,
      inscription_fin,
      inscriptions_ouvertes,
      capacite_joueurs: capacite_joueurs ?? 0,
      nombre_equipes_max,
      limite_commandites: limite_commandites ?? 0,
      prix_joueur: prix_joueur ?? 0,
    },
  };
}