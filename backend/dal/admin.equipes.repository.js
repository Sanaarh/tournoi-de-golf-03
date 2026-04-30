/**
 * =============================================================================
 * DAL — ADMIN EQUIPES REPOSITORY
 * =============================================================================
 *
 * Fichier :
 * backend/dal/admin.equipes.repository.js
 *
 * Rôle :
 * Gérer les opérations d'accès aux données pour l'administration
 * des équipes, des membres, des participants et des joueurs commandités.
 *
 * Ce module permet notamment :
 * - lire les équipes et leurs membres
 * - créer / modifier / supprimer une équipe
 * - ajouter / retirer / déplacer un membre
 * - créer un participant puis l'ajouter à une équipe
 * - gérer les joueurs commandités et leur assignation à une équipe
 */

import { pool } from "../db/db.js";

/**
 * =============================================================================
 * Lecture des équipes
 * =============================================================================
 */

/**
 * Retourne les équipes des tournois ouverts aux inscriptions (`inscriptions_ouvertes`),
 * avec :
 * - le nom du tournoi
 * - l'état des inscriptions
 * - le nombre de membres
 *
 * @returns {Promise<object[]>}
 */
export async function getAllEquipes() {
  const result = await pool.query(`
    SELECT
      e.id,
      e.tournoi_id,
      e.nom_equipe,
      e.code_secret,
      e.date_creation,
      t.nom AS tournoi,
      t.inscriptions_ouvertes,
      COUNT(me.participant_id) AS nombre_membres
    FROM equipes e
    JOIN tournois t ON t.id = e.tournoi_id
    LEFT JOIN membres_equipes me ON me.equipe_id = e.id
    WHERE t.inscriptions_ouvertes = TRUE
    GROUP BY e.id, e.tournoi_id, e.nom_equipe, e.code_secret, e.date_creation, t.nom, t.inscriptions_ouvertes
    ORDER BY e.id
  `);

  return result.rows;
}

/**
 * Retourne une équipe par son identifiant.
 *
 * @param {number} id Identifiant de l'équipe
 * @returns {Promise<object|null>}
 */
export async function getEquipeById(id) {
  const result = await pool.query(
    `
    SELECT *
    FROM equipes
    WHERE id = $1
    `,
    [id]
  );

  return result.rows[0] || null;
}

/**
 * Retourne la liste des membres d'une équipe.
 *
 * @param {number} id Identifiant de l'équipe
 * @returns {Promise<object[]>}
 */
export async function getMembresByEquipeId(id) {
  const result = await pool.query(
    `
    SELECT
      p.id,
      p.nom,
      p.prenom,
      p.courriel,
      p.telephone,
      p.type_participant
    FROM membres_equipes me
    JOIN participants p ON p.id = me.participant_id
    WHERE me.equipe_id = $1
    `,
    [id]
  );

  return result.rows;
}

/**
 * Met à jour le nom d'une équipe.
 *
 * @param {number} id Identifiant de l'équipe
 * @param {string} nom_equipe Nouveau nom
 * @returns {Promise<object|null>}
 */
export async function updateEquipe(id, nom_equipe) {
  const result = await pool.query(
    `
    UPDATE equipes
    SET nom_equipe = $1
    WHERE id = $2
    RETURNING *
    `,
    [nom_equipe, id]
  );

  return result.rows[0] || null;
}

/**
 * =============================================================================
 * Création / suppression d'équipe
 * =============================================================================
 */

/**
 * Génère un code secret d'équipe.
 *
 * Le code utilise un alphabet volontairement restreint
 * pour éviter les caractères ambigus comme :
 * - I / 1
 * - O / 0
 *
 * @param {number} [length=6] Longueur du code
 * @returns {string}
 */
function generateCode(length = 6) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";

  for (let i = 0; i < length; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }

  return out;
}

/**
 * Crée une équipe avec un code secret unique.
 *
 * La fonction tente jusqu'à 12 fois en cas de collision
 * sur la contrainte d'unicité du code_secret.
 *
 * @param {number} tournoiId Identifiant du tournoi
 * @param {string|null} [nomEquipe=null] Nom optionnel de l'équipe
 * @returns {Promise<object|null>}
 */
export async function createEquipe(tournoiId, nomEquipe = null) {
  /**
   * Vérifie capacité maximale d'équipes
   */

  const countRes = await pool.query(
    `
    SELECT COUNT(*)::int AS total
    FROM equipes
    WHERE tournoi_id = $1
    `,
    [tournoiId]
  );

  const tournoiRes = await pool.query(
    `
    SELECT nombre_equipes_max
    FROM tournois
    WHERE id = $1
    `,
    [tournoiId]
  );

  const totalEquipes = countRes.rows[0].total;
  const maxEquipes = tournoiRes.rows[0].nombre_equipes_max;

  if (totalEquipes >= maxEquipes) {
    throw new Error("MAX_EQUIPES_ATTEINT");
  }

  for (let attempt = 0; attempt < 12; attempt++) {
    const code = generateCode(6);

    try {
      const result = await pool.query(
        
        `
        INSERT INTO equipes (tournoi_id, nom_equipe, code_secret)
        VALUES ($1, $2, $3)
        RETURNING id, tournoi_id, nom_equipe, code_secret, date_creation
        `,
        [tournoiId, nomEquipe, code]
      );

      return result.rows[0] || null;
    } catch (err) {
      /**
       * 23505 = violation d'unicité PostgreSQL
       *
       * Ici on suppose une collision sur code_secret,
       * donc on réessaie avec un nouveau code.
       */
      if (err?.code === "23505") continue;

      throw err;
    }
  }

  throw new Error("Impossible de générer un code d'équipe unique.");
}

/**
 * Supprime une équipe et retourne la ligne supprimée.
 *
 * @param {number} id Identifiant de l'équipe
 * @returns {Promise<object|null>}
 */
export async function deleteEquipeById(id) {
  const result = await pool.query(
    `
    DELETE FROM equipes
    WHERE id = $1
    RETURNING id, tournoi_id, nom_equipe, code_secret, date_creation
    `,
    [id]
  );

  return result.rows[0] || null;
}

/**
 * =============================================================================
 * Lecture participant / membres
 * =============================================================================
 */

/**
 * Retourne un participant par son identifiant.
 *
 * @param {number} id Identifiant du participant
 * @returns {Promise<object|null>}
 */
export async function getParticipantById(id) {
  const result = await pool.query(
    `
    SELECT id, tournoi_id, nom, prenom, courriel, telephone, type_participant
    FROM participants
    WHERE id = $1
    `,
    [id]
  );

  return result.rows[0] || null;
}

/**
 * Compte le nombre de membres d'une équipe.
 *
 * @param {number} equipeId Identifiant de l'équipe
 * @returns {Promise<number>}
 */
export async function countMembresEquipe(equipeId) {
  const result = await pool.query(
    `
    SELECT COUNT(*)::int AS total
    FROM membres_equipes
    WHERE equipe_id = $1
    `,
    [equipeId]
  );

  return result.rows[0]?.total ?? 0;
}

/**
 * Ajoute un participant existant à une équipe.
 *
 * @param {number} equipeId Identifiant de l'équipe
 * @param {number} participantId Identifiant du participant
 * @returns {Promise<object|null>}
 */
export async function addMembreToEquipe(equipeId, participantId) {
  const result = await pool.query(
    `
    INSERT INTO membres_equipes (equipe_id, participant_id)
    VALUES ($1, $2)
    RETURNING id, equipe_id, participant_id
    `,
    [equipeId, participantId]
  );

  return result.rows[0] || null;
}

/**
 * Retire un membre d'une équipe.
 *
 * @param {number} equipeId Identifiant de l'équipe
 * @param {number} participantId Identifiant du participant
 * @returns {Promise<object|null>}
 */
export async function removeMembreFromEquipe(equipeId, participantId) {
  const result = await pool.query(
    `
    DELETE FROM membres_equipes
    WHERE equipe_id = $1 AND participant_id = $2
    RETURNING id, equipe_id, participant_id
    `,
    [equipeId, participantId]
  );

  return result.rows[0] || null;
}

/**
 * =============================================================================
 * Création participant + ajout dans équipe
 * =============================================================================
 */

/**
 * Crée un nouveau participant puis l'ajoute à l'équipe.
 *
 * Cette opération est transactionnelle :
 * - vérifie d'abord que l'équipe existe
 * - crée le participant dans le même tournoi que l'équipe
 * - crée le lien dans membres_equipes
 *
 * @param {number} equipeId Identifiant de l'équipe
 * @param {object} participantPayload Données du participant
 * @returns {Promise<{ participant: object, membre: object|null }>}
 */
export async function createParticipantAndAddToEquipe(equipeId, participantPayload) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    /**
     * Vérifie que l'équipe existe et récupère son tournoi.
     */
    const equipeRes = await client.query(
      `
      SELECT id, tournoi_id
      FROM equipes
      WHERE id = $1
      `,
      [equipeId]
    );

    const equipe = equipeRes.rows[0] || null;

    if (!equipe) {
      const err = new Error("Équipe introuvable");
      err.code = "EQUIPE_NOT_FOUND";
      throw err;
    }

    /**
     * Le participant est créé dans le même tournoi que l'équipe.
     * Si aucun type n'est fourni, on utilise EMPLOYE par défaut.
     */
    const participantRes = await client.query(
      `
      INSERT INTO participants (tournoi_id, prenom, nom, courriel, telephone, type_participant)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, tournoi_id, prenom, nom, courriel, telephone, type_participant, date_creation
      `,
      [
        equipe.tournoi_id,
        participantPayload.prenom,
        participantPayload.nom,
        participantPayload.courriel,
        participantPayload.telephone || null,
        participantPayload.type_participant || "EMPLOYE",
      ]
    );

    const participant = participantRes.rows[0];

    /**
 * Vérifie la capacité totale du tournoi
 * avant d'ajouter un nouveau joueur.
 */

const capRes = await client.query(
  `
  SELECT capacite_joueurs
  FROM tournois
  WHERE id = $1
  `,
  [equipe.tournoi_id]
);

const capacite = Number(capRes.rows[0].capacite_joueurs);

/**
 * Compte tous les participants du tournoi
 */

const countRes = await client.query(
  `
  SELECT COUNT(*)::int AS total
  FROM participants
  WHERE tournoi_id = $1
  `,
  [equipe.tournoi_id]
);

const totalParticipants = Number(countRes.rows[0].total);

/**
 * Bloque si tournoi plein
 */

if (totalParticipants >= capacite) {
  await client.query("ROLLBACK");

  const err = new Error("Tournoi complet");
  err.code = "TOURNOI_COMPLET";
  throw err;
}

/**
 * Ajout du membre
 */

const membreRes = await client.query(
  `
  INSERT INTO membres_equipes (equipe_id, participant_id)
  VALUES ($1, $2)
  RETURNING id, equipe_id, participant_id
  `,
  [equipeId, participant.id]
);

    await client.query("COMMIT");

    return {
      participant,
      membre: membreRes.rows[0] || null
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/**
 * =============================================================================
 * Recherche participants
 * =============================================================================
 */

/**
 * Recherche des participants par :
 * - nom
 * - prénom
 * - courriel
 * - id
 *
 * Si la requête est vide :
 * retourne simplement les derniers participants.
 *
 * @param {string} [query=""] Texte de recherche
 * @param {number} [limit=20] Limite max de résultats
 * @returns {Promise<object[]>}
 */
export async function searchParticipants(query = "", limit = 20) {
  const q = String(query || "").trim();

  /**
   * Limite protégée entre 1 et 100.
   */
  const safeLimit =
    Number.isInteger(limit)
      ? Math.max(1, Math.min(limit, 100))
      : 20;

  if (!q) {
    const result = await pool.query(
      `
      SELECT id, nom, prenom, courriel
      FROM participants
      ORDER BY id DESC
      LIMIT $1
      `,
      [safeLimit]
    );

    return result.rows;
  }

  const like = `%${q}%`;

  const result = await pool.query(
    `
    SELECT id, nom, prenom, courriel
    FROM participants
    WHERE
      nom ILIKE $1
      OR prenom ILIKE $1
      OR courriel ILIKE $1
      OR CAST(id AS TEXT) ILIKE $1
    ORDER BY id DESC
    LIMIT $2
    `,
    [like, safeLimit]
  );

  return result.rows;
}

/**
 * =============================================================================
 * Vérifications liées au tournoi / aux équipes
 * =============================================================================
 */

/**
 * Vérifie si un nom d'équipe existe déjà dans le même tournoi.
 *
 * La comparaison est :
 * - insensible à la casse
 * - insensible aux espaces en début/fin
 *
 * Le paramètre excludeEquipeId permet d'exclure l'équipe courante
 * lors d'une modification.
 *
 * @param {number} tournoiId Identifiant du tournoi
 * @param {string} nomEquipe Nom à vérifier
 * @param {number|null} [excludeEquipeId=null] Équipe à exclure de la recherche
 * @returns {Promise<boolean>}
 */
export async function existsEquipeNameInTournoi(tournoiId, nomEquipe, excludeEquipeId = null) {
  const normalized = String(nomEquipe || "").trim();

  if (!normalized) return false;

  const params = [tournoiId, normalized];

  let sql = `
    SELECT 1
    FROM equipes
    WHERE tournoi_id = $1
      AND LOWER(TRIM(COALESCE(nom_equipe, ''))) = LOWER(TRIM($2))
  `;

  if (excludeEquipeId) {
    params.push(excludeEquipeId);
    sql += ` AND id <> $3`;
  }

  sql += ` LIMIT 1`;

  const result = await pool.query(sql, params);

  return result.rowCount > 0;
}

/**
 * Vérifie si les inscriptions sont ouvertes pour un tournoi.
 *
 * @param {number} tournoiId Identifiant du tournoi
 * @returns {Promise<boolean|null>} null si tournoi introuvable
 */
export async function isTournoiOpenById(tournoiId) {
  const result = await pool.query(
    `
    SELECT inscriptions_ouvertes
    FROM tournois
    WHERE id = $1
    `,
    [tournoiId]
  );

  if (result.rowCount === 0) return null;

  return Boolean(result.rows[0].inscriptions_ouvertes);
}

/**
 * Vérifie si les inscriptions sont ouvertes à partir d'un id d'équipe.
 *
 * @param {number} equipeId Identifiant de l'équipe
 * @returns {Promise<boolean|null>} null si équipe introuvable
 */
export async function isTournoiOpenByEquipeId(equipeId) {
  const result = await pool.query(
    `
    SELECT t.inscriptions_ouvertes
    FROM equipes e
    JOIN tournois t ON t.id = e.tournoi_id
    WHERE e.id = $1
    `,
    [equipeId]
  );

  if (result.rowCount === 0) return null;

  return Boolean(result.rows[0].inscriptions_ouvertes);
}

/**
 * Vérifie si les inscriptions sont ouvertes à partir d'un id de participant.
 *
 * @param {number} participantId Identifiant du participant
 * @returns {Promise<boolean|null>} null si participant introuvable
 */
export async function isTournoiOpenByParticipantId(participantId) {
  const result = await pool.query(
    `
    SELECT t.inscriptions_ouvertes
    FROM participants p
    JOIN tournois t ON t.id = p.tournoi_id
    WHERE p.id = $1
    `,
    [participantId]
  );

  if (result.rowCount === 0) return null;

  return Boolean(result.rows[0].inscriptions_ouvertes);
}

/**
 * =============================================================================
 * Mise à jour participant admin
 * =============================================================================
 */

/**
 * Met à jour un participant côté administration.
 *
 * @param {number} participantId Identifiant du participant
 * @param {object} payload Nouvelles données
 * @returns {Promise<{ ok: boolean, code?: string, row?: object }>}
 */
export async function updateParticipantAdmin(participantId, payload) {
  const pid = Number(participantId);

  if (!Number.isInteger(pid) || pid <= 0) {
    return { ok: false, code: "NOT_FOUND" };
  }

  const result = await pool.query(
    `
    UPDATE participants
    SET
      prenom = $2,
      nom = $3,
      courriel = $4,
      telephone = $5
    WHERE id = $1
    RETURNING id, tournoi_id, prenom, nom, courriel, telephone, type_participant
    `,
    [pid, payload.prenom, payload.nom, payload.courriel, payload.telephone]
  );

  if (result.rowCount === 0) {
    return { ok: false, code: "NOT_FOUND" };
  }

  return {
    ok: true,
    row: result.rows[0]
  };
}

/**
 * =============================================================================
 * Déplacement d'un membre vers une autre équipe
 * =============================================================================
 */

/**
 * Déplace un membre d'une équipe source vers une équipe cible.
 *
 * Règles :
 * - les deux équipes doivent exister
 * - elles doivent appartenir au même tournoi
 * - le participant doit se trouver dans l'équipe source
 * - l'équipe cible ne doit pas être pleine
 *
 * @param {number} sourceEquipeId Équipe d'origine
 * @param {number} targetEquipeId Équipe cible
 * @param {number} participantId Participant à déplacer
 * @returns {Promise<object>}
 */
export async function moveMembreToEquipe(sourceEquipeId, targetEquipeId, participantId) {
  const sourceId = Number(sourceEquipeId);
  const targetId = Number(targetEquipeId);
  const pid = Number(participantId);

  if (
    !Number.isInteger(sourceId) || sourceId <= 0 ||
    !Number.isInteger(targetId) || targetId <= 0 ||
    !Number.isInteger(pid) || pid <= 0
  ) {
    return { ok: false, code: "BAD_INPUT" };
  }

  /**
   * Si la source et la cible sont identiques,
   * aucun déplacement réel n'est nécessaire.
   */
  if (sourceId === targetId) {
    return { ok: true, code: "NOOP", equipe_id: targetId, participant_id: pid };
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const sourceRes = await client.query(
      `SELECT id, tournoi_id FROM equipes WHERE id = $1`,
      [sourceId]
    );

    if (sourceRes.rowCount === 0) {
      await client.query("ROLLBACK");
      return { ok: false, code: "SOURCE_NOT_FOUND" };
    }

    const targetRes = await client.query(
      `SELECT id, tournoi_id FROM equipes WHERE id = $1`,
      [targetId]
    );

    if (targetRes.rowCount === 0) {
      await client.query("ROLLBACK");
      return { ok: false, code: "TARGET_NOT_FOUND" };
    }

    const sourceTournoiId = Number(sourceRes.rows[0].tournoi_id);
    const targetTournoiId = Number(targetRes.rows[0].tournoi_id);

    if (sourceTournoiId !== targetTournoiId) {
      await client.query("ROLLBACK");
      return { ok: false, code: "TOURNOI_MISMATCH" };
    }

    /**
     * On vérifie que le participant est bien dans l'équipe source.
     */
    const memRes = await client.query(
      `SELECT equipe_id FROM membres_equipes WHERE participant_id = $1`,
      [pid]
    );

    const currentEquipeId =
      memRes.rows[0]?.equipe_id != null
        ? Number(memRes.rows[0].equipe_id)
        : null;

    if (currentEquipeId !== sourceId) {
      await client.query("ROLLBACK");
      return { ok: false, code: "MEMBRE_NOT_FOUND" };
    }

    /**
     * Une équipe ne peut pas dépasser 4 membres.
     */
    const total = await countMembresEquipeClient(client, targetId);

    if (total >= 4) {
      await client.query("ROLLBACK");
      return { ok: false, code: "EQUIPE_PLEINE" };
    }

    await client.query(
      `UPDATE membres_equipes SET equipe_id = $2 WHERE participant_id = $1`,
      [pid, targetId]
    );

    await client.query("COMMIT");

    return { ok: true, code: "MOVED", equipe_id: targetId, participant_id: pid };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/**
 * =============================================================================
 * Joueurs commandités — lecture
 * =============================================================================
 */

/**
 * Liste les joueurs saisis à l'inscription commanditaire.
 *
 * Retourne aussi :
 * - entreprise
 * - contact
 * - forfait
 * - tournoi
 * - équipe éventuelle
 *
 * Règles de filtre :
 * - sans tournoiId : seulement les tournois ouverts
 * - avec tournoiId : uniquement ce tournoi précis
 *
 * @param {number|null} [tournoiId=null] Filtre optionnel
 * @returns {Promise<object[]>}
 */
export async function listJoueursCommanditesAdmin(tournoiId = null) {
  const result = await pool.query(
    `
    SELECT
      jc.id AS joueur_commandite_id,
      jc.prenom AS joueur_prenom,
      jc.nom AS joueur_nom,
      jc.ordre,
      jc.participant_id AS joueur_participant_id,
      c.id AS commandite_id,
      c.nom_entreprise,
      c.nom_contact,
      c.courriel_contact,
      c.telephone_contact,
      c.statut AS commandite_statut,
      c.date_creation AS commandite_date_creation,
      tc.nom AS type_commandite_nom,
      tc.id AS type_commandite_id,
      t.id AS tournoi_id,
      t.nom AS tournoi_nom,
      e.id AS equipe_id,
      e.nom_equipe AS equipe_nom,
      e.code_secret AS equipe_code_secret
    FROM joueurs_commandites jc
    JOIN commandites c ON c.id = jc.commandite_id
    JOIN types_commandites tc ON tc.id = c.type_commandite_id
    JOIN tournois t ON t.id = c.tournoi_id
    LEFT JOIN membres_equipes me ON me.participant_id = jc.participant_id
    LEFT JOIN equipes e ON e.id = me.equipe_id
    WHERE (
      ($1::integer IS NOT NULL AND t.id = $1)
      OR ($1::integer IS NULL AND t.inscriptions_ouvertes = TRUE)
    )
    AND (
      jc.participant_id IS NULL
      OR NOT EXISTS (
        SELECT 1 FROM membres_equipes me_wait
        WHERE me_wait.participant_id = jc.participant_id
      )
    )
    ORDER BY t.id DESC, c.id ASC, jc.ordre ASC, jc.id ASC
    `,
    [tournoiId]
  );

  return result.rows;
}

/**
 * =============================================================================
 * Courriels synthétiques / gestion des conflits
 * =============================================================================
 */

/**
 * Génère un courriel synthétique pour un joueur commandité.
 *
 * Utilisé en dernier recours lorsqu'aucun courriel libre
 * n'est disponible pour ce joueur dans le tournoi.
 *
 * @param {number} joueurCommanditeId
 * @param {number} commanditeId
 * @param {number} tournoiId
 * @returns {string}
 */
function syntheticCourrielJoueurCommandite(joueurCommanditeId, commanditeId, tournoiId) {
  const local = `jc${joueurCommanditeId}-c${commanditeId}-t${tournoiId}`;
  return `${local}@commandite.local`;
}

/**
 * Longueur maximale autorisée pour le courriel d'un participant.
 */
const MAX_COURRIEL_PARTICIPANT = 150;

/**
 * Vérifie si un courriel est libre dans le tournoi.
 *
 * L'exclusion optionnelle permet d'ignorer un participant existant
 * lors d'une mise à jour.
 *
 * @param {object} client Client SQL transactionnel
 * @param {number} tournoiId Identifiant du tournoi
 * @param {string} courriel Courriel à tester
 * @param {number|null} excludeParticipantId Participant à exclure
 * @returns {Promise<string|null>} Courriel libre ou null
 */
async function courrielParticipantSiLibre(client, tournoiId, courriel, excludeParticipantId) {
  const trimmed = String(courriel ?? "").trim();

  if (!trimmed || trimmed.length > MAX_COURRIEL_PARTICIPANT) return null;

  const normalized = trimmed.toLowerCase();

  const clash = await client.query(
    `
    SELECT 1 FROM participants
    WHERE tournoi_id = $1
      AND LOWER(TRIM(courriel)) = $2
      AND ($3::integer IS NULL OR id <> $3)
    LIMIT 1
    `,
    [tournoiId, normalized, excludeParticipantId ?? null]
  );

  if (clash.rowCount > 0) return null;

  return trimmed;
}

/**
 * Produit une variante du courriel de contact
 * en ajoutant un suffixe +jc<id> avant le @.
 *
 * Exemple :
 * contact@email.com
 * devient
 * contact+jc12@email.com
 *
 * @param {string} email Courriel de base
 * @param {number} joueurCommanditeId Identifiant joueur commandité
 * @returns {string|null}
 */
function courrielContactAvecSuffixeJoueur(email, joueurCommanditeId) {
  const t = String(email ?? "").trim();
  const at = t.lastIndexOf("@");

  if (at <= 0 || at >= t.length - 1) return null;

  const local = t.slice(0, at);
  const domain = t.slice(at + 1).trim();

  if (!local || !domain) return null;

  /**
   * Si un suffixe jc existe déjà, on le retire avant d'en recréer un.
   */
  const cleanLocal = local.replace(/\+jc\d+$/i, "");

  const tagged = `${cleanLocal}+jc${joueurCommanditeId}@${domain}`;

  if (tagged.length > MAX_COURRIEL_PARTICIPANT) return null;

  return tagged;
}

/**
 * Détermine le courriel à enregistrer pour un joueur commandité.
 *
 * Ordre de priorité :
 * 1. courriel contact si libre
 * 2. courriel contact suffixé si libre
 * 3. courriel synthétique
 *
 * @param {object} client Client SQL transactionnel
 * @param {number} tournoiId Identifiant du tournoi
 * @param {string} courrielContact Courriel contact de la commandite
 * @param {number|null} excludeParticipantId Participant à exclure
 * @param {number} jid Identifiant joueur commandité
 * @param {number} commanditeId Identifiant commandite
 * @returns {Promise<string>}
 */
async function resolveCourrielJoueurCommandite(
  client,
  tournoiId,
  courrielContact,
  excludeParticipantId,
  jid,
  commanditeId
) {
  const base = await courrielParticipantSiLibre(
    client,
    tournoiId,
    courrielContact,
    excludeParticipantId
  );

  if (base) return base;

  const tagged = courrielContactAvecSuffixeJoueur(courrielContact, jid);

  if (tagged) {
    const ok = await courrielParticipantSiLibre(
      client,
      tournoiId,
      tagged,
      excludeParticipantId
    );

    if (ok) return ok;
  }

  return syntheticCourrielJoueurCommandite(jid, commanditeId, tournoiId);
}

/**
 * Compte le nombre de membres d'une équipe avec un client transactionnel.
 *
 * @param {object} client Client SQL
 * @param {number} equipeId Identifiant de l'équipe
 * @returns {Promise<number>}
 */
async function countMembresEquipeClient(client, equipeId) {
  const r = await client.query(
    `SELECT COUNT(*)::int AS total FROM membres_equipes WHERE equipe_id = $1`,
    [equipeId]
  );

  return r.rows[0]?.total ?? 0;
}

/**
 * =============================================================================
 * Joueurs commandités — modification
 * =============================================================================
 */

/**
 * Met à jour le prénom et le nom d'un joueur commandité.
 *
 * Si un participant existe déjà pour ce joueur,
 * les mêmes valeurs sont répercutées dans participants.
 *
 * @param {number} joueurCommanditeId Identifiant joueur commandité
 * @param {{ prenom: string; nom: string }} payload Données à appliquer
 * @returns {Promise<{ ok: boolean, code?: string }>}
 */
export async function updateJoueurCommanditeAdmin(joueurCommanditeId, payload) {
  const jid = Number(joueurCommanditeId);

  if (!Number.isInteger(jid) || jid <= 0) {
    return { ok: false, code: "NOT_FOUND" };
  }

  const prenom = String(payload?.prenom ?? "").trim();
  const nom = String(payload?.nom ?? "").trim();

  if (!prenom || !nom) {
    return { ok: false, code: "VALIDATION" };
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const jcRes = await client.query(
      `
      SELECT jc.id, jc.participant_id, c.tournoi_id
      FROM joueurs_commandites jc
      JOIN commandites c ON c.id = jc.commandite_id
      WHERE jc.id = $1
      `,
      [jid]
    );

    if (jcRes.rowCount === 0) {
      await client.query("ROLLBACK");
      return { ok: false, code: "NOT_FOUND" };
    }

    const tournoiId = jcRes.rows[0].tournoi_id;

    /**
     * La modification est bloquée si le tournoi est fermé.
     */
    const open = await isTournoiOpenById(tournoiId);

    if (!open) {
      await client.query("ROLLBACK");
      return { ok: false, code: "TOURNOI_FERME" };
    }

    await client.query(
      `UPDATE joueurs_commandites SET prenom = $2, nom = $3 WHERE id = $1`,
      [jid, prenom, nom]
    );

    const pid = jcRes.rows[0].participant_id;

    /**
     * Si un participant réel existe déjà, on synchronise son identité.
     */
    if (pid) {
      await client.query(
        `UPDATE participants SET prenom = $2, nom = $3 WHERE id = $1`,
        [pid, prenom, nom]
      );
    }

    await client.query("COMMIT");

    return { ok: true };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Supprime un joueur commandité.
 *
 * Si un participant lié existe déjà :
 * - il est supprimé
 * - son lien équipe disparaît aussi via les contraintes BDD si prévues
 *
 * @param {number} joueurCommanditeId Identifiant joueur commandité
 * @returns {Promise<{ ok: boolean, code?: string }>}
 */
export async function deleteJoueurCommanditeAdmin(joueurCommanditeId) {
  const jid = Number(joueurCommanditeId);

  if (!Number.isInteger(jid) || jid <= 0) {
    return { ok: false, code: "NOT_FOUND" };
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const jcRes = await client.query(
      `
      SELECT jc.id, jc.participant_id, c.tournoi_id
      FROM joueurs_commandites jc
      JOIN commandites c ON c.id = jc.commandite_id
      WHERE jc.id = $1
      `,
      [jid]
    );

    if (jcRes.rowCount === 0) {
      await client.query("ROLLBACK");
      return { ok: false, code: "NOT_FOUND" };
    }

    const open = await isTournoiOpenById(jcRes.rows[0].tournoi_id);

    if (!open) {
      await client.query("ROLLBACK");
      return { ok: false, code: "TOURNOI_FERME" };
    }

    const pid = jcRes.rows[0].participant_id;

    if (pid) {
      await client.query(`DELETE FROM participants WHERE id = $1`, [pid]);
    }

    await client.query(`DELETE FROM joueurs_commandites WHERE id = $1`, [jid]);

    await client.query("COMMIT");

    return { ok: true };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/**
 * =============================================================================
 * Joueurs commandités — assignation équipe
 * =============================================================================
 */

/**
 * Affecte ou déplace un joueur commandité vers une équipe.
 *
 * Cas possibles :
 * - joueur déjà lié à un participant et déjà dans la bonne équipe → NOOP
 * - joueur déjà lié à un participant mais dans une autre équipe → MOVED
 * - joueur non encore lié à un participant → CREATED
 *
 * Règles :
 * - tournoi ouvert obligatoire
 * - équipe existante
 * - même tournoi
 * - équipe non pleine
 *
 * @param {number} joueurCommanditeId Identifiant joueur commandité
 * @param {number} equipeId Identifiant équipe cible
 * @returns {Promise<object>}
 */
export async function assignJoueurCommanditeToEquipe(joueurCommanditeId, equipeId) {
  const jid = Number(joueurCommanditeId);
  const eid = Number(equipeId);

  if (!Number.isInteger(jid) || jid <= 0 || !Number.isInteger(eid) || eid <= 0) {
    return { ok: false, code: "BAD_INPUT" };
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const jcRes = await client.query(
      `
      SELECT jc.id, jc.commandite_id, jc.prenom, jc.nom, jc.participant_id,
             c.tournoi_id, c.courriel_contact, c.telephone_contact
      FROM joueurs_commandites jc
      JOIN commandites c ON c.id = jc.commandite_id
      WHERE jc.id = $1
      `,
      [jid]
    );

    if (jcRes.rowCount === 0) {
      await client.query("ROLLBACK");
      return { ok: false, code: "NOT_FOUND" };
    }

    const row = jcRes.rows[0];
    const tournoiId = Number(row.tournoi_id);

    const open = await isTournoiOpenById(tournoiId);

    if (!open) {
      await client.query("ROLLBACK");
      return { ok: false, code: "TOURNOI_FERME" };
    }

    const eqRes = await client.query(
      `SELECT id, tournoi_id FROM equipes WHERE id = $1`,
      [eid]
    );

    if (eqRes.rowCount === 0) {
      await client.query("ROLLBACK");
      return { ok: false, code: "EQUIPE_NOT_FOUND" };
    }

    if (Number(eqRes.rows[0].tournoi_id) !== tournoiId) {
      await client.query("ROLLBACK");
      return { ok: false, code: "TOURNOI_MISMATCH" };
    }

    const existingPid =
      row.participant_id
        ? Number(row.participant_id)
        : null;

    /**
     * Cas 1 :
     * le joueur a déjà un participant lié.
     */
    if (existingPid) {
      const memRes = await client.query(
        `SELECT equipe_id FROM membres_equipes WHERE participant_id = $1`,
        [existingPid]
      );

      const currentEquipeId =
        memRes.rows[0]?.equipe_id != null
          ? Number(memRes.rows[0].equipe_id)
          : null;

      /**
       * Si déjà dans la bonne équipe :
       * on ne déplace pas, mais on peut mettre à jour
       * courriel / téléphone du participant.
       */
      if (currentEquipeId === eid) {
        const courrielNoop = await resolveCourrielJoueurCommandite(
          client,
          tournoiId,
          row.courriel_contact,
          existingPid,
          jid,
          row.commandite_id
        );

        const telNoop =
          String(row.telephone_contact ?? "").trim() || null;

        await client.query(
          `
          UPDATE participants
          SET courriel = $2,
              telephone = COALESCE($3, telephone)
          WHERE id = $1
          `,
          [existingPid, courrielNoop, telNoop]
        );

        await client.query("COMMIT");

        return { ok: true, code: "NOOP", participant_id: existingPid, equipe_id: eid };
      }

      /**
       * Si déjà dans une autre équipe :
       * on retire l'ancien lien avant de l'ajouter à la nouvelle équipe.
       */
      if (currentEquipeId) {
        await client.query(
          `DELETE FROM membres_equipes WHERE participant_id = $1`,
          [existingPid]
        );
      }

      const total = await countMembresEquipeClient(client, eid);

      if (total >= 4) {
        await client.query("ROLLBACK");
        return { ok: false, code: "EQUIPE_PLEINE" };
      }

      await client.query(
        `INSERT INTO membres_equipes (equipe_id, participant_id) VALUES ($1, $2)`,
        [eid, existingPid]
      );

      const courriel = await resolveCourrielJoueurCommandite(
        client,
        tournoiId,
        row.courriel_contact,
        existingPid,
        jid,
        row.commandite_id
      );

      const telContact =
        String(row.telephone_contact ?? "").trim() || null;

      await client.query(
        `
        UPDATE participants
        SET courriel = $2,
            telephone = COALESCE($3, telephone)
        WHERE id = $1
        `,
        [existingPid, courriel, telContact]
      );

      await client.query("COMMIT");

      return { ok: true, code: "MOVED", participant_id: existingPid, equipe_id: eid };
    }

    /**
     * Cas 2 :
     * aucun participant n'existe encore pour ce joueur commandité.
     * On en crée un, puis on l'assigne à l'équipe.
     */
    const totalNew = await countMembresEquipeClient(client, eid);

    if (totalNew >= 4) {
      await client.query("ROLLBACK");
      return { ok: false, code: "EQUIPE_PLEINE" };
    }

    const courriel = await resolveCourrielJoueurCommandite(
      client,
      tournoiId,
      row.courriel_contact,
      null,
      jid,
      row.commandite_id
    );

    const telContact =
      String(row.telephone_contact ?? "").trim() || null;

    const pRes = await client.query(
      `
      INSERT INTO participants (tournoi_id, prenom, nom, courriel, telephone, type_participant)
      VALUES ($1, $2, $3, $4, $5, 'JOUEUR_COMMANDITE')
      RETURNING id
      `,
      [tournoiId, row.prenom, row.nom, courriel, telContact]
    );

    const newPid = pRes.rows[0].id;

    await client.query(
      `INSERT INTO membres_equipes (equipe_id, participant_id) VALUES ($1, $2)`,
      [eid, newPid]
    );

    await client.query(
      `UPDATE joueurs_commandites SET participant_id = $2 WHERE id = $1`,
      [jid, newPid]
    );

    await client.query("COMMIT");

    return { ok: true, code: "CREATED", participant_id: newPid, equipe_id: eid };
  } catch (err) {
    await client.query("ROLLBACK");

    /**
     * Mapping de certaines contraintes SQL
     * vers des codes métier plus clairs.
     */
    if (err?.constraint === "uq_participant_tournoi_courriel") {
      return { ok: false, code: "COURRIEL_CONFLIT" };
    }

    if (err?.constraint === "uq_participant_une_seule_equipe") {
      return { ok: false, code: "DEJA_EQUIPE" };
    }

    throw err;
  } finally {
    client.release();
  }
}