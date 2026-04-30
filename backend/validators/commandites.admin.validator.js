/**
 * Validation des payloads admin pour la ressource commandites (inscriptions).
 *
 * Ce module contient :
 * - des fonctions utilitaires pour nettoyer et convertir les données
 * - la validation complète du payload reçu lors de la mise à jour d'une commandite
 */

/**
 * Nettoie une valeur en chaîne de caractères.
 *
 * - Retourne une chaîne vide si la valeur est null ou undefined
 * - Convertit la valeur en texte puis supprime les espaces au début et à la fin
 *
 * @param {*} v Valeur à nettoyer
 * @returns {string} Chaîne nettoyée
 */
function safeTrim(v) {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

/**
 * Tente de convertir une valeur en identifiant entier positif.
 *
 * @param {*} raw Valeur brute reçue
 * @returns {number|null} L'identifiant si valide, sinon null
 */
export function parseId(raw) {
  const id = Number(raw);

  // Un ID valide doit être un entier strictement positif
  if (!Number.isInteger(id) || id <= 0) return null;

  return id;
}

/**
 * Liste des statuts autorisés pour une commandite.
 */
const STATUTS = new Set(["EN_ATTENTE", "PAYEE", "ECHEC"]);

/**
 * Limites maximales de longueur pour les différents champs.
 */
const LIMITS = {
  NOM_ENTREPRISE: 160,
  NOM_CONTACT: 160,
  COURRIEL: 160,
  TELEPHONE: 30,
  JOUEUR_PRENOM: 80,
  JOUEUR_NOM: 80,
};

/**
 * Nombre maximal de joueurs pouvant être associés à la commandite.
 */
const MAX_JOUEURS = 24;

/**
 * Vérifie si un courriel respecte un format simple valide.
 *
 * Cette validation est volontairement simple :
 * elle vérifie surtout la structure générale "texte@texte.domaine".
 *
 * @param {string} email Courriel à valider
 * @returns {boolean} true si le format semble valide, sinon false
 */
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Valide et nettoie le payload de mise à jour d'une commandite.
 *
 * Champs validés :
 * - nom_entreprise
 * - nom_contact
 * - courriel_contact
 * - telephone_contact
 * - statut
 * - type_commandite_id
 * - joueurs
 *
 * Retour :
 * - { ok: false, errors } si erreurs de validation
 * - { ok: true, cleaned } si les données sont valides
 *
 * @param {object} body Payload reçu dans la requête
 * @returns {{ ok: boolean, errors?: object, cleaned?: object }}
 */
export function validateUpdateCommanditePayload(body) {
  /**
   * Objet qui accumule toutes les erreurs de validation.
   * La clé correspond au nom du champ en erreur.
   */
  const errors = {};

  /**
   * Nettoyage des champs texte principaux.
   */
  const nom_entreprise = safeTrim(body?.nom_entreprise);
  const nom_contact = safeTrim(body?.nom_contact);

  /**
   * Le courriel est nettoyé puis converti en minuscules
   * pour uniformiser la valeur avant traitement.
   */
  const courriel_contact = safeTrim(body?.courriel_contact).toLowerCase();

  /**
   * Le téléphone est optionnel.
   *
   * Si la valeur est absente, null ou vide après nettoyage,
   * on stocke null. Sinon, on garde la chaîne nettoyée.
   */
  const telephone_raw = body?.telephone_contact;
  const telephone_contact =
    telephone_raw === null || telephone_raw === undefined || safeTrim(telephone_raw) === ""
      ? null
      : safeTrim(telephone_raw);

  /**
   * Le statut est nettoyé puis transformé en majuscules
   * afin de comparer avec les valeurs autorisées.
   */
  const statutRaw = safeTrim(body?.statut).toUpperCase();

  /**
   * Conversion et validation de l'identifiant du type de commandite.
   */
  const type_commandite_id = parseId(body?.type_commandite_id);

  // ----------------------------
  // Validation nom de l'entreprise
  // ----------------------------
  if (!nom_entreprise) {
    errors.nom_entreprise = "Le nom de l'entreprise est obligatoire.";
  } else if (nom_entreprise.length > LIMITS.NOM_ENTREPRISE) {
    errors.nom_entreprise = `Maximum ${LIMITS.NOM_ENTREPRISE} caractères.`;
  }

  // ----------------------------
  // Validation nom du contact
  // ----------------------------
  if (!nom_contact) {
    errors.nom_contact = "Le nom du contact est obligatoire.";
  } else if (nom_contact.length > LIMITS.NOM_CONTACT) {
    errors.nom_contact = `Maximum ${LIMITS.NOM_CONTACT} caractères.`;
  }

  // ----------------------------
  // Validation courriel
  // ----------------------------
  if (!courriel_contact) {
    errors.courriel_contact = "Le courriel est obligatoire.";
  } else if (courriel_contact.length > LIMITS.COURRIEL) {
    errors.courriel_contact = `Maximum ${LIMITS.COURRIEL} caractères.`;
  } else if (!isValidEmail(courriel_contact)) {
    errors.courriel_contact = "Format de courriel invalide.";
  }

  // ----------------------------
  // Validation téléphone (optionnel)
  // ----------------------------
  if (telephone_contact !== null && telephone_contact.length > LIMITS.TELEPHONE) {
    errors.telephone_contact = `Maximum ${LIMITS.TELEPHONE} caractères.`;
  }

  // ----------------------------
  // Validation statut
  // ----------------------------
  if (!STATUTS.has(statutRaw)) {
    errors.statut = "Statut invalide (EN_ATTENTE, PAYEE ou ECHEC).";
  }

  // ----------------------------
  // Validation type_commandite_id
  // ----------------------------
  if (!type_commandite_id) {
    errors.type_commandite_id = "type_commandite_id invalide.";
  }

  /**
   * Tableau final des joueurs nettoyés.
   *
   * Chaque joueur sera transformé en objet :
   * { prenom: string, nom: string }
   */
  /** @type {Array<{ prenom: string; nom: string }>} */
  let joueurs = [];

  /**
   * Valeur brute reçue pour les joueurs.
   */
  const rawJoueurs = body?.joueurs;

  // Si le champ joueurs est absent, on considère qu'il n'y a aucun joueur
  if (rawJoueurs === undefined || rawJoueurs === null) {
    joueurs = [];
  }
  // Si joueurs est présent, il doit obligatoirement être un tableau
  else if (!Array.isArray(rawJoueurs)) {
    errors.joueurs = "joueurs doit être un tableau.";
  }
  // On limite aussi le nombre maximal d'entrées
  else if (rawJoueurs.length > MAX_JOUEURS) {
    errors.joueurs = `Au plus ${MAX_JOUEURS} entrées joueurs.`;
  } else {
    /**
     * Nettoyage et validation de chaque joueur.
     *
     * Remarque :
     * ici on vérifie uniquement les longueurs maximales.
     * On ne force pas le prénom et le nom à être obligatoires.
     */
    joueurs = rawJoueurs.map((item, i) => {
      const prenom = safeTrim(item?.prenom);
      const nom = safeTrim(item?.nom);

      // Validation de la longueur du prénom
      if (prenom.length > LIMITS.JOUEUR_PRENOM) {
        errors[`joueurs.${i}.prenom`] = `Maximum ${LIMITS.JOUEUR_PRENOM} caractères.`;
      }

      // Validation de la longueur du nom
      if (nom.length > LIMITS.JOUEUR_NOM) {
        errors[`joueurs.${i}.nom`] = `Maximum ${LIMITS.JOUEUR_NOM} caractères.`;
      }

      return { prenom, nom };
    });
  }

  /**
   * Si au moins une erreur existe, on retourne l'objet errors
   * sans retourner les données nettoyées.
   */
  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  /**
   * Si tout est valide, on retourne les données nettoyées
   * prêtes à être utilisées dans le reste de l'application.
   */
  return {
    ok: true,
    cleaned: {
      nom_entreprise,
      nom_contact,
      courriel_contact,
      telephone_contact,
      statut: statutRaw,
      type_commandite_id,
      joueurs,
    },
  };
}