/**
 * db.js
 * Accès base de données PostgreSQL (pg.Pool).
 *
 * Responsabilités :
 * - Charger la configuration via les variables d'environnement (dotenv).
 * - Valider les paramètres DB_* au démarrage pour éviter des erreurs pg ambiguës.
 * - Fournir un pool de connexions réutilisable dans l'application (routes, middlewares).
 *
 * Variables attendues (backend/.env) :
 * - DB_HOST
 * - DB_PORT
 * - DB_USER
 * - DB_PASSWORD
 * - DB_NAME
 */

import "dotenv/config";
import pg from "pg";

const { Pool } = pg;

/**
 * Retourne une variable d'environnement obligatoire.
 * @param {string} name Nom de la variable (ex: "DB_HOST")
 * @returns {string} Valeur non vide
 * @throws {Error} Si la variable est absente ou vide
 */
function getRequiredEnv(name) {
  const value = process.env[name];
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(
      `Configuration invalide: ${name} doit être défini (fichier backend/.env).`
    );
  }
  return value.trim();
}

/**
 * Parse un entier obligatoire depuis une variable d'environnement.
 * @param {string} name Nom de la variable (ex: "DB_PORT")
 * @returns {number} Entier
 * @throws {Error} Si la valeur n'est pas un entier valide
 */
function getRequiredIntEnv(name) {
  const raw = getRequiredEnv(name);
  const num = Number(raw);
  if (!Number.isInteger(num) || num <= 0) {
    throw new Error(`Configuration invalide: ${name} doit être un entier positif.`);
  }
  return num;
}

/**
 * Configuration DB (lisible et centralisée).
 * L'application échoue rapidement si une valeur est manquante, ce qui facilite le diagnostic.
 */
const dbConfig = {
  host: getRequiredEnv("DB_HOST"),
  port: getRequiredIntEnv("DB_PORT"),
  user: getRequiredEnv("DB_USER"),
  password: getRequiredEnv("DB_PASSWORD"),
  database: getRequiredEnv("DB_NAME"),
};

/**
 * Pool PostgreSQL (gestion automatique des connexions).
 * À utiliser partout via pool.query(...) ou via l'objet db plus bas.
 */
export const pool = new Pool(dbConfig);

/**
 * Diagnostics utiles en développement.
 * - "connect" : indique qu'une connexion du pool a été établie.
 * - "error"   : erreurs inattendues sur une connexion idle du pool.
 */
pool.on("connect", () => {
  console.log("Connexion PostgreSQL établie");
});

pool.on("error", (err) => {
  console.error("Erreur PostgreSQL (pool):", err);
});

/**
 * Couche minimale d'accès DB.
 * Permet d'écrire db.query(...) sans importer directement pool dans chaque module.
 */
export const db = {
  /**
   * Exécute une requête SQL paramétrée.
   * @param {string} text Requête SQL
   * @param {any[]} [params] Paramètres SQL ($1, $2, ...)
   */
  query(text, params) {
    return pool.query(text, params);
  },
  pool,
};
 