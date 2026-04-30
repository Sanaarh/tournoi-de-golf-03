/**
 * =============================================================================
 * DAL — ADMIN REPOSITORY
 * =============================================================================
 *
 * Fichier :
 * dal/admin.repository.js
 *
 * Rôle :
 * Couche d'accès aux données (DAO / Repository) pour la table
 * "administrateurs".
 *
 * Objectifs :
 * - Centraliser tout le SQL lié aux administrateurs
 * - Éviter d'écrire des requêtes SQL directement dans les routes
 * - Retourner uniquement des données, sans logique HTTP
 *
 * Table concernée :
 * - administrateurs(id, nom_utilisateur, mot_de_passe_hash, date_creation)
 *
 * Remarques :
 * - Les fonctions ici ne gèrent ni req/res ni statuts HTTP.
 * - Elles retournent des objets, des tableaux, null ou des compteurs,
 *   et laissent les couches supérieures gérer les réponses API.
 */

import { pool } from "../db/db.js";

/**
 * =============================================================================
 * Recherche d'un administrateur par nom d'utilisateur
 * =============================================================================
 *
 * Utilité :
 * - principalement pour l'authentification / connexion
 *
 * Cette fonction retourne l'administrateur complet,
 * y compris le mot_de_passe_hash, car il est nécessaire
 * pour comparer le mot de passe fourni au login.
 *
 * @param {string} nom_utilisateur Nom d'utilisateur à rechercher
 * @returns {Promise<object|null>} Admin complet (avec hash) ou null si absent
 */
export async function findAdminByUsername(nom_utilisateur) {
  const result = await pool.query(
    `SELECT id, nom_utilisateur, mot_de_passe_hash, date_creation
     FROM administrateurs
     WHERE nom_utilisateur = $1`,
    [nom_utilisateur]
  );

  /**
   * On retourne le premier résultat s'il existe,
   * sinon null.
   */
  return result.rows[0] ?? null;
}

/**
 * =============================================================================
 * Recherche d'un administrateur par ID
 * =============================================================================
 *
 * Utilité :
 * - généralement pour retrouver l'utilisateur connecté
 * - par exemple dans une route du type /auth/me
 *
 * Ici, on ne retourne pas le hash du mot de passe,
 * car il n'est pas nécessaire pour ce type de lecture.
 *
 * @param {number} id Identifiant de l'administrateur
 * @returns {Promise<object|null>} Admin sans hash ou null si absent
 */
export async function findAdminById(id) {
  const result = await pool.query(
    `SELECT id, nom_utilisateur, date_creation
     FROM administrateurs
     WHERE id = $1`,
    [id]
  );

  return result.rows[0] ?? null;
}

/**
 * =============================================================================
 * Liste de tous les administrateurs
 * =============================================================================
 *
 * Retourne tous les administrateurs sans leur hash,
 * triés par identifiant croissant.
 *
 * @returns {Promise<object[]>} Liste des administrateurs
 */
export async function listAdmins() {
  const result = await pool.query(
    `SELECT id, nom_utilisateur, date_creation
     FROM administrateurs
     ORDER BY id ASC`
  );

  return result.rows;
}

/**
 * =============================================================================
 * Création d'un administrateur
 * =============================================================================
 *
 * Le mot de passe reçu ici doit déjà être hashé
 * avant l'appel de cette fonction.
 *
 * Cette fonction ne retourne pas le hash dans la réponse,
 * seulement les informations utiles à afficher ou manipuler.
 *
 * @param {string} nom_utilisateur Nom d'utilisateur du nouvel admin
 * @param {string} mot_de_passe_hash Mot de passe déjà hashé
 * @returns {Promise<object>} Administrateur créé (sans hash)
 */
export async function createAdmin(nom_utilisateur, mot_de_passe_hash) {
  const result = await pool.query(
    `INSERT INTO administrateurs (nom_utilisateur, mot_de_passe_hash)
     VALUES ($1, $2)
     RETURNING id, nom_utilisateur, date_creation`,
    [nom_utilisateur, mot_de_passe_hash]
  );

  return result.rows[0];
}

/**
 * =============================================================================
 * Mise à jour d'un administrateur
 * =============================================================================
 *
 * Cette fonction construit la requête UPDATE dynamiquement
 * selon les champs présents dans l'objet fields.
 *
 * Champs possibles :
 * - nom_utilisateur
 * - mot_de_passe_hash
 *
 * Cas possibles :
 * - aucun champ -> retourne null
 * - un seul champ -> met à jour uniquement ce champ
 * - deux champs -> met à jour les deux
 *
 * @param {number} id Identifiant de l'administrateur
 * @param {{ nom_utilisateur?: string, mot_de_passe_hash?: string }} fields
 * Champs à mettre à jour
 *
 * @returns {Promise<object|null>} Admin modifié (sans hash) ou null si introuvable / rien à faire
 */
export async function updateAdmin(id, fields) {
  /**
   * updates :
   * - contient les morceaux de SQL du SET
   *
   * values :
   * - contient les valeurs correspondantes aux paramètres SQL
   *
   * idx :
   * - compteur pour numéroter dynamiquement les placeholders $1, $2, etc.
   */
  const updates = [];
  const values = [];
  let idx = 1;

  /**
   * Construction dynamique de la partie SET
   * seulement avec les champs réellement fournis.
   */
  if (fields.nom_utilisateur) {
    updates.push(`nom_utilisateur = $${idx++}`);
    values.push(fields.nom_utilisateur);
  }

  if (fields.mot_de_passe_hash) {
    updates.push(`mot_de_passe_hash = $${idx++}`);
    values.push(fields.mot_de_passe_hash);
  }

  /**
   * Si aucun champ n'est fourni,
   * on ne fait aucune requête SQL.
   */
  if (updates.length === 0) return null;

  /**
   * L'id est ajouté en dernier paramètre
   * pour la clause WHERE.
   */
  values.push(id);

  const result = await pool.query(
    `UPDATE administrateurs
     SET ${updates.join(", ")}
     WHERE id = $${idx}
     RETURNING id, nom_utilisateur, date_creation`,
    values
  );

  /**
   * Retourne l'admin modifié si trouvé,
   * sinon null.
   */
  return result.rows[0] ?? null;
}

/**
 * =============================================================================
 * Suppression d'un administrateur
 * =============================================================================
 *
 * Retourne le nombre de lignes supprimées :
 * - 0 si aucun admin n'a été trouvé
 * - 1 si la suppression a réussi
 *
 * Cette fonction est utile quand la couche supérieure
 * veut décider elle-même du message ou du statut HTTP.
 *
 * @param {number} id Identifiant de l'administrateur
 * @returns {Promise<number>} Nombre de lignes supprimées
 */
export async function deleteAdminById(id) {
  const result = await pool.query(
    `DELETE FROM administrateurs
     WHERE id = $1`,
    [id]
  );

  return result.rowCount;
}

/**
 * =============================================================================
 * Comptage des administrateurs
 * =============================================================================
 *
 * Utilité :
 * - empêcher la suppression du dernier administrateur
 * - afficher des statistiques simples
 *
 * @returns {Promise<number>} Nombre total d'administrateurs
 */
export async function countAdmins() {
  const result = await pool.query(
    `SELECT COUNT(*)::int AS total FROM administrateurs`
  );

  /**
   * Si jamais la structure retournée est vide,
   * on protège avec 0 par défaut.
   */
  return result.rows?.[0]?.total ?? 0;
}