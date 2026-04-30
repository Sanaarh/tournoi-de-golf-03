/**
 * =============================================================================
 * DAL — INSCRIPTION TOURNOI REPOSITORY
 * =============================================================================
 *
 * Fichier :
 * dal/inscriptionTournoi.repository.js
 *
 * Rôle :
 * Gérer toute la logique d'inscription publique au tournoi.
 *
 * Objectifs principaux :
 * - Créer un participant EMPLOYE ou RETRAITE + créer une équipe + l'ajouter comme membre
 * - Créer un participant EMPLOYE ou RETRAITE + rejoindre une équipe via code_secret
 * - Créer une ou plusieurs commandites et leurs joueurs nominatifs
 *
 * IMPORTANT :
 * - Ce fichier contient de la logique transactionnelle (BEGIN / COMMIT / ROLLBACK)
 * - Aucune logique HTTP ici (pas de req/res)
 * - Les fonctions retournent des objets métiers ou des erreurs structurées
 */

import { pool } from "../db/db.js";

/**
 * Détermine le type stocké pour un employé ou un retraité (hors commandite).
 * Accepte `categorie_participant` (employe | retraite) ou `type_participant` déjà en base.
 *
 * @param {object} input
 * @returns {"EMPLOYE"|"RETRAITE"}
 */
function resolveTypeEmployeOuRetraite(input) {
  const explicit = String(input?.type_participant ?? "").trim().toUpperCase();
  if (explicit === "EMPLOYE" || explicit === "RETRAITE") {
    return explicit;
  }
  const cat = String(input?.categorie_participant ?? "").trim().toLowerCase();
  if (cat === "retraite") return "RETRAITE";
  if (cat === "employe" || cat === "employé") return "EMPLOYE";
  return "EMPLOYE";
}

/**
 * Génère un code alphanumérique court et facile à partager.
 *
 * L'alphabet évite volontairement les caractères ambigus
 * comme I, O, 0 ou 1.
 *
 * @param {number} len Longueur du code (par défaut 6)
 * @returns {string}
 */
function generateCode(len = 6) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";

  for (let i = 0; i < len; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }

  return out;
}

/**
 * Compte le nombre d'équipes d'un tournoi.
 *
 * Utilisé pour vérifier la capacité maximale d'équipes.
 *
 * @param {import("pg").PoolClient} client
 * @param {number} tournoiId
 * @returns {Promise<number>}
 */
async function countEquipes(client, tournoiId) {
  const r = await client.query(
    `SELECT COUNT(*)::int AS total FROM equipes WHERE tournoi_id = $1`,
    [tournoiId]
  );

  return r.rows[0]?.total ?? 0;
}

/**
 * Compte le nombre total de joueurs d'un tournoi.
 *
 * IMPORTANT :
 * On compte seulement les joueurs des commandites PAYEES.
 * Les commandites EN_ATTENTE ne doivent PAS bloquer le paiement.
 */
async function countParticipantsTournoi(client, tournoiId) {
  const r = await client.query(
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

  return Number(r.rows[0]?.total ?? 0);
}

/**
 * Compte seulement les participants employes / retraites.
 *
 * IMPORTANT :
 * Les joueurs commandités convertis en participants
 * (type_participant = JOUEUR_COMMANDITE) ne doivent PAS
 * être comptés dans les places réservées aux employés/retraités.
 *
 * @param {import("pg").PoolClient} client
 * @param {number} tournoiId
 * @returns {Promise<number>}
 */
async function countParticipantsPersonnelTournoi(client, tournoiId) {
  const r = await client.query(
    `
    SELECT COUNT(*)::int AS total
    FROM participants
    WHERE tournoi_id = $1
      AND type_participant IN ('EMPLOYE', 'RETRAITE', 'EMPLOYE_RETRAITE')
    `,
    [tournoiId]
  );

  return Number(r.rows[0]?.total ?? 0);
}

/**
 * Compte seulement les joueurs lies aux commandites PAYEES.
 *
 * IMPORTANT :
 * Les commandites EN_ATTENTE ne doivent pas
 * être comptées dans les quotas.
 */
async function countJoueursCommanditesTournoi(client, tournoiId) {
  const r = await client.query(
    `
    SELECT COUNT(*)::int AS total
    FROM joueurs_commandites jc
    INNER JOIN commandites c ON c.id = jc.commandite_id
    WHERE c.tournoi_id = $1
      AND c.statut = 'PAYEE'
    `,
    [tournoiId]
  );

  return Number(r.rows[0]?.total ?? 0);
}

/**
 * Retourne un résumé complet de disponibilité d'un tournoi.
 *
 * Règles métier :
 * - capacite_joueurs = capacité totale du tournoi
 * - limite_commandites = places réservées aux commandites
 * - les employés/retraités ne peuvent utiliser que :
 *   capacite_joueurs - limite_commandites
 *
 * @param {import("pg").PoolClient} client
 * @param {number} tournoiId
 * @returns {Promise<null | {
 *   tournoi: object,
 *   totalEquipes: number,
 *   totalJoueurs: number,
 *   totalPersonnel: number,
 *   totalCommandites: number,
 *   placesTotales: number,
 *   placesReserveesCommandites: number,
 *   placesPersonnelMax: number,
 *   placesPersonnelRestantes: number,
 *   placesCommanditesRestantes: number,
 *   tournoiComplet: boolean,
 *   peutCreerEquipe: boolean,
 *   peutRejoindreEquipe: boolean
 * }>}
 */
async function getDisponibiliteTournoi(client, tournoiId) {
  const tournoi = await getTournoi(client, tournoiId);

  if (!tournoi) return null;

  const totalEquipes = await countEquipes(client, tournoiId);
  const totalJoueurs = await countParticipantsTournoi(client, tournoiId);
  const totalPersonnel = await countParticipantsPersonnelTournoi(client, tournoiId);
  const totalCommandites = await countJoueursCommanditesTournoi(client, tournoiId);

  const placesTotales = Number(tournoi.capacite_joueurs ?? 0);
  const placesReserveesCommandites = Math.max(Number(tournoi.limite_commandites ?? 0), 0);
  const placesPersonnelMax = Math.max(placesTotales - placesReserveesCommandites, 0);
  const equipesPersonnelMax = Math.floor(placesPersonnelMax / 4);

  const placesPersonnelRestantes = Math.max(placesPersonnelMax - totalPersonnel, 0);
  const placesCommanditesRestantes = Math.max(placesReserveesCommandites - totalCommandites, 0);

  const tournoiComplet = totalJoueurs >= placesTotales;

  return {
    tournoi,
    totalEquipes,
    totalJoueurs,
    totalPersonnel,
    totalCommandites,
    placesTotales,
    placesReserveesCommandites,
    placesPersonnelMax,
    placesPersonnelRestantes,
    placesCommanditesRestantes,
    tournoiComplet,
    peutCreerEquipe:
      !tournoiComplet &&
      totalEquipes < equipesPersonnelMax,
    peutRejoindreEquipe:
      !tournoiComplet &&
      placesPersonnelRestantes > 0,
  };
}

/**
 * Vérification publique avant paiement.
 *
 * @param {number} tournoiId
 * @param {"participant"|"commandite"} typePaiement
 * @param {"creer"|"rejoindre"|null} optionEquipe
 * @returns {Promise<{ ok: boolean, status?: number, message?: string, data?: object }>}
 */
export async function verifierDisponibiliteAvantPaiement(
  tournoiId,
  typePaiement = "participant",
  optionEquipe = null
) {
  const tid = Number(tournoiId);

  if (!Number.isInteger(tid) || tid <= 0) {
    return {
      ok: false,
      status: 400,
      message: "Tournoi invalide.",
    };
  }

  const client = await pool.connect();

  try {
    const dispo = await getDisponibiliteTournoi(client, tid);

    if (!dispo) {
      return {
        ok: false,
        status: 404,
        message: "Tournoi introuvable.",
      };
    }

    if (!dispo.tournoi.inscriptions_ouvertes) {
      return {
        ok: false,
        status: 400,
        message: "Les inscriptions sont fermées pour ce tournoi.",
      };
    }

    if (typePaiement === "participant") {
      if (dispo.tournoiComplet) {
        return {
          ok: false,
          status: 400,
          message: "Le tournoi est complet.",
          data: dispo,
        };
      }

      if (dispo.placesPersonnelRestantes <= 0) {
        return {
          ok: false,
          status: 400,
          message:
            "Aucune place n'est encore disponible pour les employés et retraités. Les places restantes sont réservées aux commandites.",
          data: dispo,
        };
      }

      if (optionEquipe === "creer" && !dispo.peutCreerEquipe) {
        return {
          ok: false,
          status: 400,
          message:
            "Le nombre maximum d'équipes est atteint. Veuillez rejoindre une équipe existante.",
          data: dispo,
        };
      }

      if (optionEquipe === "rejoindre" && !dispo.peutRejoindreEquipe) {
        return {
          ok: false,
          status: 400,
          message:
            "Aucune place n'est disponible pour rejoindre une équipe.",
          data: dispo,
        };
      }
    }

    if (typePaiement === "commandite") {
      if (dispo.tournoiComplet) {
        return {
          ok: false,
          status: 400,
          message: "Le tournoi est complet.",
          data: dispo,
        };
      }

      if (dispo.placesCommanditesRestantes <= 0) {
        return {
          ok: false,
          status: 400,
          message:
            "Le quota de places réservées aux commandites est atteint.",
          data: dispo,
        };
      }
    }

    return {
      ok: true,
      data: dispo,
    };
  } finally {
    client.release();
  }
}

/**
 * Vérifie si un courriel existe déjà dans le tournoi.
 *
 * La comparaison est insensible à la casse et ignore
 * les espaces en début et fin.
 *
 * @param {import("pg").PoolClient} client
 * @param {number} tournoiId
 * @param {string} courriel
 * @returns {Promise<boolean>}
 */
async function emailExistsInTournoi(client, tournoiId, courriel) {
  const r = await client.query(
    `
    SELECT 1
    FROM participants
    WHERE tournoi_id = $1
      AND LOWER(TRIM(courriel)) = LOWER(TRIM($2))
    LIMIT 1
    `,
    [tournoiId, courriel]
  );

  return r.rowCount > 0;
}

/**
 * Vérification publique réutilisable avant paiement.
 *
 * Permet de savoir si un courriel est déjà inscrit au tournoi.
 *
 * @param {number} tournoiId
 * @param {string} courriel
 * @returns {Promise<{ existe: boolean }>}
 */
export async function verifierCourrielDejaInscritTournoi(tournoiId, courriel) {
  const tid = Number(tournoiId);
  const email = String(courriel ?? "").trim();

  if (!Number.isInteger(tid) || tid <= 0 || !email) {
    return { existe: false };
  }

  const client = await pool.connect();

  try {
    const existe = await emailExistsInTournoi(client, tid, email);
    return { existe };
  } finally {
    client.release();
  }
}

/**
 * Récupère un tournoi avec les champs utiles
 * pour appliquer les règles métier.
 *
 * @param {import("pg").PoolClient} client
 * @param {number} tournoiId
 * @returns {Promise<object|null>}
 */
async function getTournoi(client, tournoiId) {
  const r = await client.query(
    `
    SELECT id, inscriptions_ouvertes, capacite_joueurs, nombre_equipes_max, limite_commandites
    FROM tournois
    WHERE id = $1
    `,
    [tournoiId]
  );

  return r.rows[0] ?? null;
}

/**
 * Message centralisé pour les conflits de noms
 * de joueurs commandités.
 */
const MSG_JOUEUR_CMD_DEJA_INSCRIT_TOURNOI =
  "Un ou plusieurs joueurs nommés sont déjà inscrits à ce tournoi (employé, retraité ou commanditaire). Vérifiez les prénoms et noms.";

/**
 * Charge les couples (prénom, nom) déjà pris pour ce tournoi :
 * - participants
 * - joueurs commandités
 *
 * Format de clé :
 * lower(trim(prenom))|lower(trim(nom))
 *
 * @param {import("pg").PoolClient} client
 * @param {number} tournoiId
 * @returns {Promise<Set<string>>}
 */
async function loadNomsJoueursDejaInscritsTournoi(client, tournoiId) {
  const r = await client.query(
    `
    SELECT LOWER(TRIM(prenom)) AS p, LOWER(TRIM(nom)) AS n
    FROM participants
    WHERE tournoi_id = $1
    UNION
    SELECT LOWER(TRIM(jc.prenom)), LOWER(TRIM(jc.nom))
    FROM joueurs_commandites jc
    INNER JOIN commandites c ON c.id = jc.commandite_id
    WHERE c.tournoi_id = $1
    `,
    [tournoiId]
  );

  return new Set(r.rows.map((row) => `${row.p}|${row.n}`));
}

/**
 * Normalise un couple prénom/nom en clé unique.
 *
 * @param {string} prenom
 * @param {string} nom
 * @returns {string|null}
 */
function nomNormaliseKey(prenom, nom) {
  const p = String(prenom ?? "").trim().toLowerCase();
  const n = String(nom ?? "").trim().toLowerCase();

  if (!p || !n) return null;

  return `${p}|${n}`;
}

/**
 * Vérifie si au moins un couple (prénom, nom)
 * parmi les candidats existe déjà dans le tournoi.
 *
 * @param {number} tournoiId
 * @param {Array<{ prenom?: string; nom?: string }>} candidats
 * @returns {Promise<{ conflit: boolean }>}
 */
export async function verifierConflitsNomsJoueursTournoi(tournoiId, candidats) {
  const tid = Number(tournoiId);

  if (!Number.isInteger(tid) || tid <= 0) {
    return { conflit: false };
  }

  const list = Array.isArray(candidats) ? candidats : [];
  const touches = [];

  for (const c of list) {
    const k = nomNormaliseKey(c?.prenom, c?.nom);
    if (k) touches.push(k);
  }

  if (touches.length === 0) {
    return { conflit: false };
  }

  const client = await pool.connect();

  try {
    const deja = await loadNomsJoueursDejaInscritsTournoi(client, tid);

    for (const k of touches) {
      if (deja.has(k)) {
        return { conflit: true };
      }
    }

    return { conflit: false };
  } finally {
    client.release();
  }
}

/**
 * Même règle que verifierConflitsNomsJoueursTournoi,
 * mais les joueurs déjà liés à excludeCommanditeId
 * sont ignorés.
 *
 * @param {import("pg").PoolClient} client
 * @param {number} tournoiId
 * @param {number} excludeCommanditeId
 * @returns {Promise<Set<string>>}
 */
async function loadNomsJoueursDejaInscritsTournoiExcluantCommandite(
  client,
  tournoiId,
  excludeCommanditeId
) {
  const ex = Number(excludeCommanditeId);
  const exId = Number.isInteger(ex) && ex > 0 ? ex : null;

  const r = await client.query(
    `
    SELECT LOWER(TRIM(prenom)) AS p, LOWER(TRIM(nom)) AS n
    FROM participants
    WHERE tournoi_id = $1
    UNION
    SELECT LOWER(TRIM(jc.prenom)), LOWER(TRIM(jc.nom))
    FROM joueurs_commandites jc
    INNER JOIN commandites c ON c.id = jc.commandite_id
    WHERE c.tournoi_id = $1
      AND ($2::integer IS NULL OR jc.commandite_id <> $2)
    `,
    [tournoiId, exId]
  );

  return new Set(r.rows.map((row) => `${row.p}|${row.n}`));
}

/**
 * Vérifie les conflits de noms en excluant
 * une commandite donnée.
 *
 * @param {number} tournoiId
 * @param {number} excludeCommanditeId
 * @param {Array<{ prenom?: string; nom?: string }>} candidats
 * @returns {Promise<{ conflit: boolean }>}
 */
export async function verifierConflitsNomsJoueursTournoiExcluantCommandite(
  tournoiId,
  excludeCommanditeId,
  candidats
) {
  const tid = Number(tournoiId);

  if (!Number.isInteger(tid) || tid <= 0) {
    return { conflit: false };
  }

  const list = Array.isArray(candidats) ? candidats : [];
  const touches = [];

  for (const c of list) {
    const k = nomNormaliseKey(c?.prenom, c?.nom);
    if (k) touches.push(k);
  }

  if (touches.length === 0) {
    return { conflit: false };
  }

  const client = await pool.connect();

  try {
    const deja = await loadNomsJoueursDejaInscritsTournoiExcluantCommandite(
      client,
      tid,
      excludeCommanditeId
    );

    for (const k of touches) {
      if (deja.has(k)) {
        return { conflit: true };
      }
    }

    return { conflit: false };
  } finally {
    client.release();
  }
}

/**
 * Crée un participant.
 *
 * @param {import("pg").PoolClient} client
 * @param {object} p
 * @returns {Promise<object>}
 */
async function insertParticipant(client, p) {
  const r = await client.query(
    `
    INSERT INTO participants (tournoi_id, prenom, nom, courriel, telephone, type_participant)
    VALUES ($1,$2,$3,$4,$5,$6)
    RETURNING id, tournoi_id, prenom, nom, courriel, telephone, type_participant, date_creation
    `,
    [p.tournoi_id, p.prenom, p.nom, p.courriel, p.telephone ?? null, p.type_participant]
  );

  return r.rows[0];
}

/**
 * Vérifie si un nom d'équipe existe déjà
 * dans un tournoi.
 *
 * @param {import("pg").PoolClient} client
 * @param {number} tournoiId
 * @param {string} nomEquipe
 * @returns {Promise<boolean>}
 */
async function teamNameExistsInTournoi(client, tournoiId, nomEquipe) {
  const r = await client.query(
    `
    SELECT 1
    FROM equipes
    WHERE tournoi_id = $1
      AND LOWER(TRIM(nom_equipe)) = LOWER(TRIM($2))
    LIMIT 1
    `,
    [tournoiId, nomEquipe]
  );

  return r.rowCount > 0;
}

/**
 * Crée une équipe avec génération de code unique.
 *
 * En cas de collision sur code_secret, la fonction
 * réessaie jusqu'à 12 fois.
 *
 * @param {import("pg").PoolClient} client
 * @param {number} tournoiId
 * @param {string|null} nomEquipe
 * @returns {Promise<object>}
 */
async function insertEquipeWithUniqueCode(client, tournoiId, nomEquipe) {
  for (let attempt = 0; attempt < 12; attempt++) {
    const code = generateCode(6);

    try {
      const r = await client.query(
        `
        INSERT INTO equipes (tournoi_id, nom_equipe, code_secret)
        VALUES ($1,$2,$3)
        RETURNING id, tournoi_id, nom_equipe, code_secret, date_creation
        `,
        [tournoiId, nomEquipe ?? null, code]
      );

      return r.rows[0];
    } catch (err) {
      if (err?.code === "23505") continue;
      throw err;
    }
  }

  throw new Error("Impossible de générer un code d'équipe unique.");
}

/**
 * Ajoute un participant à une équipe.
 *
 * @param {import("pg").PoolClient} client
 * @param {number} equipeId
 * @param {number} participantId
 * @returns {Promise<void>}
 */
async function insertMembreEquipe(client, equipeId, participantId) {
  await client.query(
    `
    INSERT INTO membres_equipes (equipe_id, participant_id)
    VALUES ($1,$2)
    `,
    [equipeId, participantId]
  );
}

/**
 * Récupère une équipe à partir de son code secret.
 *
 * @param {import("pg").PoolClient} client
 * @param {string} code
 * @returns {Promise<object|null>}
 */
async function findEquipeByCode(client, code) {
  const r = await client.query(
    `
    SELECT id, tournoi_id, nom_equipe, code_secret, date_creation
    FROM equipes
    WHERE code_secret = $1
    `,
    [code]
  );

  return r.rows[0] ?? null;
}

/**
 * Compte le nombre de membres d'une équipe.
 *
 * @param {import("pg").PoolClient} client
 * @param {number} equipeId
 * @returns {Promise<number>}
 */
async function countMembresEquipe(client, equipeId) {
  const r = await client.query(
    `SELECT COUNT(*)::int AS total FROM membres_equipes WHERE equipe_id = $1`,
    [equipeId]
  );

  return r.rows[0]?.total ?? 0;
}

/**
 * Insère les joueurs d'une commandite.
 *
 * @param {import("pg").PoolClient} client
 * @param {number} commanditeId
 * @param {Array<{ prenom: string; nom: string }>} joueurs
 * @returns {Promise<void>}
 */
async function insertJoueursCommandite(client, commanditeId, joueurs) {
  let ordre = 0;

  for (const j of joueurs) {
    ordre += 1;

    await client.query(
      `
      INSERT INTO joueurs_commandites (commandite_id, prenom, nom, ordre)
      VALUES ($1, $2, $3, $4)
      `,
      [commanditeId, j.prenom, j.nom, ordre]
    );
  }
}

/**
 * Normalise la structure joueurs_par_type.
 *
 * @param {unknown} raw
 * @returns {Record<number, Array<{ prenom: string; nom: string }>>}
 */
function normalizeJoueursParType(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};

  const out = {};

  for (const [k, v] of Object.entries(raw)) {
    const id = Number(k);

    if (!Number.isInteger(id) || id <= 0) continue;
    if (!Array.isArray(v)) continue;

    out[id] = v.map((row) => ({
      prenom: String(row?.prenom ?? "").trim(),
      nom: String(row?.nom ?? "").trim(),
    }));
  }

  return out;
}

/**
 * Traduit certaines erreurs SQL en erreurs métier lisibles.
 *
 * @param {any} err
 * @returns {{ status: number, message: string }|null}
 */
function mapDatabaseError(err) {
  if (
    err?.code === "23514" &&
    err?.constraint === "participants_type_participant_check"
  ) {
    return {
      status: 400,
      message:
        "La base de données n’accepte pas encore les types EMPLOYE ou RETRAITE. Appliquez la migration SQL add_participant_types_employe_retraite.sql sur PostgreSQL, puis réessayez.",
    };
  }

  if (err?.code !== "23505") return null;

  if (err?.constraint === "uq_participant_tournoi_courriel") {
    return {
      status: 409,
      message: "Un participant avec ce courriel est déjà inscrit à ce tournoi",
    };
  }

  if (err?.constraint === "uq_participant_une_seule_equipe") {
    return {
      status: 409,
      message: "Ce participant est déjà membre d’une équipe pour ce tournoi",
    };
  }

  if (err?.constraint === "uq_membre_equipe") {
    return {
      status: 409,
      message: "Ce participant est déjà dans cette équipe",
    };
  }

  return {
    status: 409,
    message: "Conflit de données : inscription déjà existante ou invalide",
  };
}

/**
 * Création d'une équipe par un employé/retraité.
 *
 * Flux :
 * 1. Vérifier le tournoi
 * 2. Vérifier les règles métier
 * 3. Créer le participant
 * 4. Créer l'équipe
 * 5. Ajouter le participant comme membre
 *
 * @param {object} input
 * @returns {Promise<object>}
 */
export async function inscriptionCreerEquipe(input) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

        const dispo = await getDisponibiliteTournoi(client, input.tournoi_id);

    if (!dispo) {
      await client.query("ROLLBACK");
      return { error: { status: 404, message: "Tournoi introuvable" } };
    }

    const tournoi = dispo.tournoi;

    if (!tournoi.inscriptions_ouvertes) {
      await client.query("ROLLBACK");
      return { error: { status: 400, message: "Inscriptions fermées pour ce tournoi" } };
    }

    if (dispo.tournoiComplet) {
      await client.query("ROLLBACK");
      return { error: { status: 400, message: "Le tournoi est complet" } };
    }

    if (dispo.placesPersonnelRestantes <= 0) {
      await client.query("ROLLBACK");
      return {
        error: {
          status: 400,
          message:
            "Aucune place n'est encore disponible pour les employés et retraités. Les places restantes sont réservées aux commandites.",
        },
      };
    }

    if (!dispo.peutCreerEquipe) {
      await client.query("ROLLBACK");
      return {
        error: {
          status: 400,
          message:
            "Le nombre maximum d'équipes est atteint. Veuillez rejoindre une équipe existante.",
        },
      };
    }

    if (tournoi.capacite_joueurs > 0) {
      const totalParticipants = await countParticipantsTournoi(client, input.tournoi_id);

      if (totalParticipants >= tournoi.capacite_joueurs) {
        await client.query("ROLLBACK");
        return {
          error: {
            status: 400,
            message: "Capacité maximale de joueurs atteinte pour ce tournoi",
          },
        };
      }
    }

    const nomEquipeExiste = await teamNameExistsInTournoi(
      client,
      input.tournoi_id,
      input.nom_equipe
    );

    if (nomEquipeExiste) {
      await client.query("ROLLBACK");
      return {
        error: {
          status: 409,
          message: "Ce nom d’équipe est déjà utilisé pour ce tournoi",
        },
      };
    }

    const courrielExiste = await emailExistsInTournoi(
      client,
      input.tournoi_id,
      input.courriel
    );

    if (courrielExiste) {
      await client.query("ROLLBACK");
      return {
        error: {
          status: 409,
          message: "Un participant avec ce courriel est déjà inscrit à ce tournoi",
        },
      };
    }

    const participant = await insertParticipant(client, {
      tournoi_id: input.tournoi_id,
      prenom: input.prenom,
      nom: input.nom,
      courriel: input.courriel,
      telephone: input.telephone ?? null,
      type_participant: resolveTypeEmployeOuRetraite(input),
    });

    const equipe = await insertEquipeWithUniqueCode(
      client,
      input.tournoi_id,
      input.nom_equipe ?? null
    );

    await insertMembreEquipe(client, equipe.id, participant.id);

    await client.query("COMMIT");
    return { participant, equipe };
  } catch (err) {
    await client.query("ROLLBACK");

    const mapped = mapDatabaseError(err);
    if (mapped) {
      return { error: mapped };
    }

    throw err;
  } finally {
    client.release();
  }
}

/**
 * Permet à un participant de rejoindre une équipe
 * via son code secret.
 *
 * @param {object} input
 * @returns {Promise<object>}
 */
export async function inscriptionRejoindreEquipe(input) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const tournoi = await getTournoi(client, input.tournoi_id);

    if (!tournoi) {
      await client.query("ROLLBACK");
      return { error: { status: 404, message: "Tournoi introuvable" } };
    }

    if (!tournoi.inscriptions_ouvertes) {
      await client.query("ROLLBACK");
      return { error: { status: 400, message: "Inscriptions fermées pour ce tournoi" } };
    }

    if (tournoi.capacite_joueurs > 0) {
      const totalParticipants = await countParticipantsTournoi(client, input.tournoi_id);

      if (totalParticipants >= tournoi.capacite_joueurs) {
        await client.query("ROLLBACK");
        return {
          error: {
            status: 400,
            message: "Capacité maximale de joueurs atteinte pour ce tournoi",
          },
        };
      }
    }

    const equipe = await findEquipeByCode(client, input.code_equipe);

    if (!equipe) {
      await client.query("ROLLBACK");
      return { error: { status: 404, message: "Code d’équipe invalide" } };
    }

    if (equipe.tournoi_id !== input.tournoi_id) {
      await client.query("ROLLBACK");
      return { error: { status: 400, message: "Ce code ne correspond pas au tournoi actif" } };
    }

    const nbMembres = await countMembresEquipe(client, equipe.id);

    if (nbMembres >= 4) {
      await client.query("ROLLBACK");
      return { error: { status: 400, message: "Équipe complète (4 membres maximum)" } };
    }

    const courrielExiste = await emailExistsInTournoi(
      client,
      input.tournoi_id,
      input.courriel
    );

    if (courrielExiste) {
      await client.query("ROLLBACK");
      return {
        error: {
          status: 409,
          message: "Un participant avec ce courriel est déjà inscrit à ce tournoi",
        },
      };
    }

    const participant = await insertParticipant(client, {
      tournoi_id: input.tournoi_id,
      prenom: input.prenom,
      nom: input.nom,
      courriel: input.courriel,
      telephone: input.telephone ?? null,
      type_participant: resolveTypeEmployeOuRetraite(input),
    });

    await insertMembreEquipe(client, equipe.id, participant.id);

    await client.query("COMMIT");
    return { participant, equipe };
  } catch (err) {
    await client.query("ROLLBACK");

    const mapped = mapDatabaseError(err);
    if (mapped) {
      return { error: mapped };
    }

    throw err;
  } finally {
    client.release();
  }
}

/**
 * Inscription commandite.
 *
 * Peut créer une ou plusieurs lignes de commandites
 * selon les types demandés.
 *
 * @param {object} input
 * @returns {Promise<object>}
 */
export async function inscriptionCommandite(input) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const joueursParType = normalizeJoueursParType(input.joueurs_par_type);

    const tournoi = await getTournoi(client, input.tournoi_id);

    if (!tournoi) {
      await client.query("ROLLBACK");
      return { error: { status: 404, message: "Tournoi introuvable" } };
    }

    if (!tournoi.inscriptions_ouvertes) {
      await client.query("ROLLBACK");
      return { error: { status: 400, message: "Inscriptions fermées pour ce tournoi" } };
    }

    const requestedTypeIds = Array.isArray(input.type_commandite_ids)
      ? input.type_commandite_ids
      : [input.type_commandite_id];

    const typeIds = [...new Set(
      requestedTypeIds.map(Number).filter((n) => Number.isInteger(n) && n > 0)
    )];

    if (typeIds.length === 0) {
      await client.query("ROLLBACK");
      return { error: { status: 400, message: "Aucun type de commandite valide fourni" } };
    }

    let totalPlacesCommanditesPayees = 0;
    let placesAjouteesDansCetteDemande = 0;
    if (tournoi.limite_commandites > 0) {
      const totalPlacesRes = await client.query(
        `
        SELECT COALESCE(SUM(tc.places_incluses), 0)::int AS total
        FROM commandites c
        INNER JOIN types_commandites tc ON tc.id = c.type_commandite_id
        WHERE c.tournoi_id = $1
          AND c.statut = 'PAYEE'
        `,
        [input.tournoi_id]
      );
      totalPlacesCommanditesPayees = Number(totalPlacesRes.rows[0]?.total ?? 0);
    }

    const nomsPris = await loadNomsJoueursDejaInscritsTournoi(client, input.tournoi_id);

    for (const typeId of typeIds) {
      const liste = joueursParType[typeId] ?? [];

      for (const row of liste) {
        const k = nomNormaliseKey(row.prenom, row.nom);

        if (k && nomsPris.has(k)) {
          await client.query("ROLLBACK");
          return { error: { status: 400, message: MSG_JOUEUR_CMD_DEJA_INSCRIT_TOURNOI } };
        }
      }
    }

    const commandites = [];

    for (const typeId of typeIds) {
      const typeRes = await client.query(
        `
        SELECT id, tournoi_id, quota, places_incluses, nom
        FROM types_commandites
        WHERE id = $1
        `,
        [typeId]
      );

      const type = typeRes.rows[0] ?? null;

      if (!type || Number(type.tournoi_id) !== Number(input.tournoi_id)) {
        await client.query("ROLLBACK");
        return {
          error: {
            status: 400,
            message: `Type de commandite invalide (${typeId}) pour ce tournoi`,
          },
        };
      }

      const placesIncluses = Math.max(0, Number(type.places_incluses) || 0);
      const listeJoueurs = joueursParType[typeId] ?? [];

      if (placesIncluses > 0) {
        if (listeJoueurs.length !== placesIncluses) {
          await client.query("ROLLBACK");
          return {
            error: {
              status: 400,
              message:
                `Le forfait sélectionné exige exactement ${placesIncluses} joueur(s) nommé(s) pour « ${type.nom} » (reçu : ${listeJoueurs.length}).`,
            },
          };
        }

        for (let i = 0; i < listeJoueurs.length; i++) {
          const p = listeJoueurs[i];

          if (!p.prenom || !p.nom) {
            await client.query("ROLLBACK");
            return {
              error: {
                status: 400,
                message:
                  `Prénom et nom obligatoires pour chaque joueur (forfait « ${type.nom} », ligne ${i + 1}).`,
              },
            };
          }
        }
      } else if (listeJoueurs.length > 0) {
        await client.query("ROLLBACK");
        return {
          error: {
            status: 400,
            message:
              `Ce forfait (« ${type.nom} ») n'inclut pas de joueurs : ne fournissez pas de liste de joueurs.`,
          },
        };
      }

      if (type.quota > 0) {
        const countRes = await client.query(
          `
          SELECT COUNT(*)::int AS total
          FROM commandites
          WHERE type_commandite_id = $1
            AND statut = 'PAYEE'
          `,
          [typeId]
        );

        const currentForType = countRes.rows[0]?.total ?? 0;

        if (currentForType >= type.quota) {
          await client.query("ROLLBACK");
          return {
            error: {
              status: 400,
              message: `Quota atteint pour le type de commandite ${typeId}`,
            },
          };
        }
      }

      if (tournoi.limite_commandites > 0) {
        const totalApresInsertion =
          totalPlacesCommanditesPayees +
          placesAjouteesDansCetteDemande +
          placesIncluses;

        if (totalApresInsertion > tournoi.limite_commandites) {
          await client.query("ROLLBACK");
          return {
            error: {
              status: 400,
              message: "Limite de joueurs commandites atteinte pour ce tournoi",
            },
          };
        }
      }

      const insertRes = await client.query(
        `
        INSERT INTO commandites (
          tournoi_id, type_commandite_id,
          nom_entreprise, nom_contact, courriel_contact, telephone_contact
        )
        VALUES ($1,$2,$3,$4,$5,$6)
        RETURNING
          id, tournoi_id, type_commandite_id,
          nom_entreprise, nom_contact, courriel_contact, telephone_contact,
          statut, date_creation
        `,
        [
          input.tournoi_id,
          typeId,
          input.nom_entreprise,
          input.nom_contact,
          input.courriel_contact,
          input.telephone_contact ?? null,
        ]
      );

      const rowCommandite = insertRes.rows[0];
      commandites.push(rowCommandite);
      placesAjouteesDansCetteDemande += placesIncluses;

      if (placesIncluses > 0 && listeJoueurs.length > 0) {
        await insertJoueursCommandite(client, rowCommandite.id, listeJoueurs);
      }
    }

    await client.query("COMMIT");
    return { commandites };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Vérifie si un courriel existe déjà dans la table participants
 * pour un tournoi donné.
 *
 * Cette fonction sert à bloquer l'utilisateur dès l'étape 1
 * avant de passer à l'étape 2.
 *
 * @param {number} tournoiId
 * @param {string} courriel
 * @returns {Promise<boolean>}
 */
export async function courrielDejaInscrit(tournoiId, courriel) {
  const sql = `
    SELECT EXISTS (
      SELECT 1
      FROM participants
      WHERE tournoi_id = $1
        AND LOWER(courriel) = LOWER($2)
    ) AS existe
  `;

  const result = await pool.query(sql, [tournoiId, courriel]);

  return Boolean(result.rows[0]?.existe);
}

/**
 * Vérifie si un nom d'équipe existe déjà
 * pour un tournoi donné.
 *
 * @param {number} tournoiId
 * @param {string} nomEquipe
 * @returns {Promise<boolean>}
 */
export async function nomEquipeDejaExiste(tournoiId, nomEquipe) {
  const sql = `
    SELECT EXISTS (
      SELECT 1
      FROM equipes
      WHERE tournoi_id = $1
        AND LOWER(TRIM(nom_equipe)) = LOWER(TRIM($2))
    ) AS existe
  `;

  const result = await pool.query(sql, [tournoiId, nomEquipe]);

  return Boolean(result.rows[0]?.existe);
}

/**
 * Vérifie si un code d'équipe est encore rejoignable
 * pour le tournoi actif.
 *
 * Règles :
 * - le code doit exister
 * - l'équipe doit appartenir au tournoi demandé
 * - l'équipe doit avoir moins de 4 membres
 *
 * @param {number} tournoiId
 * @param {string} codeEquipe
 * @returns {Promise<boolean>}
 */
export async function codeEquipeRejoignable(tournoiId, codeEquipe) {
  const sql = `
    SELECT
      e.id,
      COUNT(me.id)::int AS nb_membres
    FROM equipes e
    LEFT JOIN membres_equipes me ON me.equipe_id = e.id
    WHERE e.tournoi_id = $1
      AND UPPER(TRIM(e.code_secret)) = UPPER(TRIM($2))
    GROUP BY e.id
  `;

  const result = await pool.query(sql, [tournoiId, codeEquipe]);
  const equipe = result.rows[0];

  /**
   * Aucun résultat = code inexistant pour ce tournoi.
   */
  if (!equipe) {
    return false;
  }

  /**
   * Une équipe de 4 membres est complète :
   * - 1 créateur
   * - puis 3 utilisations du code maximum
   */
  if (Number(equipe.nb_membres) >= 4) {
    return false;
  }

  return true;
}