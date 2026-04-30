/**
 * =============================================================================
 * DAL — ADMIN COMMANDITES REPOSITORY
 * =============================================================================
 *
 * Fichier :
 * backend/dal/admin.commandites.repository.js
 *
 * Rôle :
 * Gérer les opérations liées aux commandites côté administration.
 *
 * Ce module permet :
 * - Lister les commandites d’un tournoi
 * - Obtenir le détail d’une commandite
 * - Mettre à jour une commandite
 * - Supprimer une commandite
 *
 * Particularité :
 * Certaines opérations utilisent une TRANSACTION SQL
 * pour garantir l’intégrité des données.
 */

import { pool } from "../db/db.js";

/**
 * Fonction externe utilisée pour vérifier
 * qu’un joueur n’existe pas déjà dans le tournoi.
 *
 * Permet d’éviter les doublons entre :
 * - joueurs normaux
 * - joueurs commandités
 * - autres types d’inscriptions
 */
import {
  verifierConflitsNomsJoueursTournoiExcluantCommandite
} from "./inscriptionTournoi.repository.js";

/**
 * Message affiché lorsqu’un conflit de noms est détecté.
 */
const MSG_NOM_DEJA_PRIS =
  "Un ou plusieurs joueurs nommés sont déjà inscrits à ce tournoi (employé, retraité ou autre commanditaire).";

/**
 * Nettoie un champ prénom ou nom joueur.
 *
 * - Convertit en string
 * - Supprime espaces inutiles
 *
 * @param {*} v
 * @returns {string}
 */
function trimJoueursField(v) {
  return String(v ?? "").trim();
}

/**
 * Génère une clé unique pour un joueur.
 *
 * Sert à détecter les doublons dans la liste
 * des joueurs d’une même commandite.
 *
 * Exemple :
 * "ali|dupont"
 *
 * @param {string} prenom
 * @param {string} nom
 *
 * @returns {string|null}
 */
function keyJoueur(prenom, nom) {

  const p = trimJoueursField(prenom).toLowerCase();
  const n = trimJoueursField(nom).toLowerCase();

  /**
   * Si un champ est vide → joueur invalide
   */
  if (!p || !n) return null;

  return `${p}|${n}`;
}

/**
 * =============================================================================
 * Liste des commandites d’un tournoi
 * =============================================================================
 *
 * @param {number} tournoiId
 *
 * @returns {Promise<Array>}
 */
export async function listCommanditesByTournoi(tournoiId) {

  const tid = Number(tournoiId);

  /**
   * Vérification de validité de l’identifiant.
   */
  if (!Number.isInteger(tid) || tid <= 0)
    return [];

  /**
   * Requête SQL :
   * - récupère les commandites
   * - ajoute le nombre de joueurs liés
   */
  const r = await pool.query(
    `
    SELECT
      c.id,
      c.tournoi_id,
      c.type_commandite_id,
      c.nom_entreprise,
      c.nom_contact,
      c.courriel_contact,
      c.telephone_contact,
      c.statut,
      c.date_creation,
      tc.nom AS type_commandite_nom,

      (
        SELECT COUNT(*)::int
        FROM joueurs_commandites jc
        WHERE jc.commandite_id = c.id
      ) AS nb_joueurs

    FROM commandites c

    INNER JOIN types_commandites tc
      ON tc.id = c.type_commandite_id

    WHERE c.tournoi_id = $1

    ORDER BY
      c.date_creation DESC,
      c.id DESC
    `,
    [tid]
  );

  return r.rows;
}

/**
 * =============================================================================
 * Détail d’une commandite
 * =============================================================================
 *
 * Retourne :
 * - les informations principales
 * - les joueurs nominatifs liés
 *
 * @param {number} id
 *
 * @returns {Promise<object|null>}
 */
export async function findCommanditeAdminById(id) {

  const cid = Number(id);

  if (!Number.isInteger(cid) || cid <= 0)
    return null;

  /**
   * Récupération des données principales.
   */
  const r = await pool.query(
    `
    SELECT
      c.id,
      c.tournoi_id,
      c.type_commandite_id,
      c.nom_entreprise,
      c.nom_contact,
      c.courriel_contact,
      c.telephone_contact,
      c.statut,
      c.date_creation,

      tc.nom AS type_commandite_nom,
      tc.places_incluses AS type_places_incluses,
      tc.quota AS type_quota,

      t.nom AS tournoi_nom

    FROM commandites c

    INNER JOIN types_commandites tc
      ON tc.id = c.type_commandite_id

    INNER JOIN tournois t
      ON t.id = c.tournoi_id

    WHERE c.id = $1
    `,
    [cid]
  );

  /**
   * Si aucune commandite trouvée.
   */
  if (r.rowCount === 0)
    return null;

  const row = r.rows[0];

  /**
   * Récupération des joueurs liés.
   */
  const j = await pool.query(
    `
    SELECT id, prenom, nom, ordre
    FROM joueurs_commandites
    WHERE commandite_id = $1
    ORDER BY ordre ASC, id ASC
    `,
    [cid]
  );

  /**
   * Fusion des données.
   */
  return {
    ...row,
    joueurs: j.rows
  };
}

/**
 * =============================================================================
 * Mise à jour d’une commandite
 * =============================================================================
 *
 * Fonction critique utilisant une transaction.
 *
 * Étapes principales :
 * 1. Vérifier que la commandite existe
 * 2. Vérifier le type de commandite
 * 3. Vérifier quota disponible
 * 4. Vérifier cohérence joueurs
 * 5. Vérifier doublons joueurs
 * 6. Vérifier conflits tournoi
 * 7. Mettre à jour commandite
 * 8. Recréer les joueurs
 *
 * @param {number} id
 * @param {object} payload
 *
 * @returns {Promise<object>}
 */
export async function updateCommanditeById(id, payload) {

  const cid = Number(id);

  if (!Number.isInteger(cid) || cid <= 0) {
    return {
      ok: false,
      code: "NOT_FOUND"
    };
  }

  const statut = payload.statut;

  const typeId =
    Number(payload.type_commandite_id);

  if (!Number.isInteger(typeId) || typeId <= 0) {
    return {
      ok: false,
      code: "BAD_TYPE"
    };
  }

  /**
   * Ouverture connexion transactionnelle.
   */
  const client = await pool.connect();

  try {

    await client.query("BEGIN");

    /**
     * Vérifie que la commandite existe
     * et verrouille la ligne.
     */
    const cur = await client.query(
      `
      SELECT id, tournoi_id, type_commandite_id
      FROM commandites
      WHERE id = $1
      FOR UPDATE
      `,
      [cid]
    );

    if (cur.rowCount === 0) {

      await client.query("ROLLBACK");

      return {
        ok: false,
        code: "NOT_FOUND"
      };
    }

    const tournoiId =
      cur.rows[0].tournoi_id;

    /**
     * Vérification du type de commandite.
     */
    const tc = await client.query(
      `
      SELECT
        id,
        nom,
        places_incluses,
        quota

      FROM types_commandites

      WHERE id = $1
      AND tournoi_id = $2
      `,
      [typeId, tournoiId]
    );

    if (tc.rowCount === 0) {

      await client.query("ROLLBACK");

      return {
        ok: false,
        code: "BAD_TYPE",
        message:
          "Type de commandite invalide pour ce tournoi."
      };
    }

    /**
     * Vérification du quota.
     */
    const typeNom =
      String(tc.rows[0].nom ?? "").trim()
      || `#${typeId}`;

    const quotaType =
      Math.max(
        0,
        Number(tc.rows[0].quota) || 0
      );

    const currentTypeId =
      Number(cur.rows[0].type_commandite_id);

    /**
     * Si changement de type :
     * vérifier quota disponible.
     */
    if (
      quotaType > 0 &&
      currentTypeId !== typeId
    ) {

      const cnt = await client.query(
        `
        SELECT COUNT(*)::int AS n
        FROM commandites
        WHERE type_commandite_id = $1
        AND tournoi_id = $2
        `,
        [typeId, tournoiId]
      );

      const used =
        cnt.rows[0]?.n ?? 0;

      if (used >= quotaType) {

        await client.query("ROLLBACK");

        return {
          ok: false,
          code: "QUOTA_TYPE",
          message:
            `Le quota du forfait « ${typeNom} » est atteint (${quotaType} inscription${quotaType > 1 ? "s" : ""} maximum). ` +
            "Choisissez un autre forfait ou augmentez le quota dans Types de commandites.",
        };
      }
    }

    /**
     * Vérification du nombre de joueurs attendu.
     */
    const places =
      Number(tc.rows[0].places_incluses ?? 0);

    const joueurs =
      Array.isArray(payload.joueurs)
        ? payload.joueurs
        : [];

    if (joueurs.length !== places) {

      await client.query("ROLLBACK");

      return {
        ok: false,
        code: "JOUEURS_COUNT",
        message:
          places === 0
            ? "Ce forfait n'inclut aucun joueur nominatif : ne envoyez aucune ligne joueur."
            : `Ce forfait exige exactement ${places} joueur(s) nominatif(s) (prénom et nom chacun).`,
      };
    }

    /**
     * Nettoyage des joueurs.
     */
    const normalized =
      joueurs.map((j) => ({
        prenom:
          trimJoueursField(j?.prenom),
        nom:
          trimJoueursField(j?.nom),
      }));

    /**
     * Vérification champs obligatoires.
     */
    if (places > 0) {

      for (let i = 0; i < normalized.length; i++) {

        if (
          !normalized[i].prenom ||
          !normalized[i].nom
        ) {

          await client.query("ROLLBACK");

          return {
            ok: false,
            code: "JOUEURS_INCOMPLET",
            message:
              "Chaque place joueur du forfait requiert un prénom et un nom.",
          };
        }
      }
    }

    /**
     * Vérification doublons locaux.
     */
    const seen = new Set();

    for (const j of normalized) {

      const k =
        keyJoueur(
          j.prenom,
          j.nom
        );

      if (!k) continue;

      if (seen.has(k)) {

        await client.query("ROLLBACK");

        return {
          ok: false,
          code: "JOUEURS_DOUBLON",
          message:
            "Deux joueurs ne peuvent pas avoir le même prénom et le même nom.",
        };
      }

      seen.add(k);
    }

    /**
     * Vérification conflits tournoi.
     */
    if (places > 0) {

      const { conflit } =
        await verifierConflitsNomsJoueursTournoiExcluantCommandite(
          tournoiId,
          cid,
          normalized
        );

      if (conflit) {

        await client.query("ROLLBACK");

        return {
          ok: false,
          code: "JOUEURS_CONFLIT",
          message:
            MSG_NOM_DEJA_PRIS,
        };
      }
    }

    /**
     * Mise à jour commandite.
     */
    const res =
      await client.query(
        `
        UPDATE commandites
        SET
          nom_entreprise = $2,
          nom_contact = $3,
          courriel_contact = $4,
          telephone_contact = $5,
          statut = $6,
          type_commandite_id = $7

        WHERE id = $1

        RETURNING
          id,
          tournoi_id,
          type_commandite_id,
          nom_entreprise,
          nom_contact,
          courriel_contact,
          telephone_contact,
          statut,
          date_creation
        `,
        [
          cid,
          payload.nom_entreprise,
          payload.nom_contact,
          payload.courriel_contact,
          payload.telephone_contact ?? null,
          statut,
          typeId,
        ]
      );

    /**
     * Suppression anciens joueurs.
     */
    await client.query(
      `DELETE FROM joueurs_commandites WHERE commandite_id = $1`,
      [cid]
    );

    /**
     * Insertion nouveaux joueurs.
     */
    for (
      let ordre = 0;
      ordre < normalized.length;
      ordre++
    ) {

      const j =
        normalized[ordre];

      await client.query(
        `
        INSERT INTO joueurs_commandites
        (commandite_id, prenom, nom, ordre)

        VALUES ($1, $2, $3, $4)
        `,
        [
          cid,
          j.prenom,
          j.nom,
          ordre
        ]
      );
    }

    /**
     * Validation finale.
     */
    await client.query("COMMIT");

    return {
      ok: true,
      row: res.rows[0]
    };

  }
  catch (err) {

    /**
     * En cas d’erreur :
     * annuler transaction.
     */
    await client.query("ROLLBACK");

    throw err;
  }
  finally {

    /**
     * Libération connexion.
     */
    client.release();
  }
}

/**
 * =============================================================================
 * Suppression d’une commandite
 * =============================================================================
 *
 * @param {number} id
 *
 * @returns {Promise<boolean>}
 */
export async function deleteCommanditeById(id) {

  const cid = Number(id);

  if (!Number.isInteger(cid) || cid <= 0)
    return false;

  const r = await pool.query(
    `
    DELETE FROM commandites
    WHERE id = $1
    RETURNING id
    `,
    [cid]
  );

  /**
   * Retourne true si suppression effectuée.
   */
  return r.rowCount > 0;
}