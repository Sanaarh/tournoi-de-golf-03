/**
 * --------------------------------------------------------------------
 * Routes d'authentification des administrateurs
 * --------------------------------------------------------------------
 *
 * Ce routeur gère les opérations d'authentification côté admin.
 *
 * Endpoints disponibles :
 * - POST /auth/login  : authentifie un administrateur et crée un cookie
 * - GET  /auth/me     : retourne l'administrateur actuellement connecté
 * - POST /auth/logout : supprime le cookie de session
 *
 * Fonctionnement général :
 * - la connexion se fait avec `nom_utilisateur` et `mot_de_passe`
 * - si les identifiants sont valides, un cookie de session est créé
 * - les routes qui ont besoin de connaître l'admin connecté lisent
 *   ensuite ce cookie
 */

import { Router } from "express";
import bcrypt from "bcrypt";
import { findAdminByUsername, findAdminById } from "../dal/admin.repository.js";

/**
 * Instance du routeur Express.
 */
const router = Router();

/**
 * Nom du cookie utilisé pour représenter la session admin.
 *
 * Exemple :
 * - admin_id=3
 */
const COOKIE_NAME = "admin_id";

/**
 * Durée de vie du cookie de session.
 *
 * Ici : 1 heure en millisecondes.
 */
const ONE_HOUR_MS = 60 * 60 * 1000;

/**
 * Configuration standard du cookie de session.
 *
 * Détails :
 * - httpOnly : empêche l'accès au cookie depuis JavaScript côté navigateur
 * - sameSite : limite certains envois inter-sites
 * - secure   : activé uniquement en production (HTTPS)
 * - path     : rend le cookie disponible sur toute l'application
 * - maxAge   : durée de validité du cookie
 */
const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: ONE_HOUR_MS,
};

/**
 * Nettoie et valide une valeur texte.
 *
 * Comportement :
 * - accepte uniquement une chaîne de caractères
 * - supprime les espaces au début et à la fin
 * - retourne null si la valeur est vide après trim
 *
 * @param {unknown} value Valeur reçue depuis la requête
 * @returns {string|null} Texte nettoyé ou null si invalide
 */
function normalizeText(value) {
  if (typeof value !== "string") return null;

  const v = value.trim();
  return v.length ? v : null;
}

/**
 * --------------------------------------------------------------------
 * POST /auth/login
 * --------------------------------------------------------------------
 * Authentifie un administrateur à partir de son nom d'utilisateur
 * et de son mot de passe.
 *
 * Body attendu :
 * - nom_utilisateur
 * - mot_de_passe
 *
 * Étapes :
 * 1. validation minimale des champs reçus
 * 2. recherche de l'administrateur par nom d'utilisateur
 * 3. comparaison du mot de passe saisi avec le hash stocké
 * 4. création du cookie de session si la connexion est valide
 *
 * Réponses :
 * - 200 : connexion réussie
 * - 400 : champs manquants ou invalides
 * - 401 : identifiants incorrects
 * - 500 : erreur serveur
 */
router.post("/login", async (req, res) => {
  try {
    /**
     * Nettoyage du nom d'utilisateur.
     */
    const nom_utilisateur = normalizeText(req.body?.nom_utilisateur);

    /**
     * On garde le mot de passe seulement s'il est bien fourni sous forme de texte.
     */
    const mot_de_passe =
      typeof req.body?.mot_de_passe === "string" ? req.body.mot_de_passe : null;

    /**
     * Validation minimale de présence.
     */
    if (!nom_utilisateur || !mot_de_passe) {
      return res.status(400).json({
        message: "nom_utilisateur et mot_de_passe requis",
      });
    }

    /**
     * Recherche de l'administrateur correspondant au nom d'utilisateur.
     */
    const admin = await findAdminByUsername(nom_utilisateur);

    /**
     * Si aucun admin n'est trouvé, on retourne une erreur d'authentification.
     */
    if (!admin) {
      return res.status(401).json({ message: "Identifiants invalides" });
    }

    /**
     * Comparaison du mot de passe en clair avec le hash stocké.
     */
    const ok = await bcrypt.compare(mot_de_passe, admin.mot_de_passe_hash);

    if (!ok) {
      return res.status(401).json({ message: "Identifiants invalides" });
    }

    /**
     * Si l'authentification réussit, on crée le cookie de session.
     */
    res.cookie(COOKIE_NAME, String(admin.id), COOKIE_OPTIONS);

    /**
     * On retourne uniquement les informations utiles côté client,
     * sans exposer le hash du mot de passe.
     */
    return res.status(200).json({
      message: "Connecté",
      admin: {
        id: admin.id,
        nom_utilisateur: admin.nom_utilisateur,
      },
    });
  } catch (err) {
    console.error("POST /auth/login:", err);
    return res.status(500).json({ message: "Erreur serveur" });
  }
});

/**
 * --------------------------------------------------------------------
 * GET /auth/me
 * --------------------------------------------------------------------
 * Retourne l'administrateur actuellement connecté, à partir du cookie.
 *
 * Étapes :
 * 1. lecture du cookie `admin_id`
 * 2. validation de sa valeur
 * 3. recherche de l'administrateur correspondant
 *
 * Réponses :
 * - 200 : administrateur connecté trouvé
 * - 401 : pas connecté ou cookie invalide
 * - 500 : erreur serveur
 */
router.get("/me", async (req, res) => {
  try {
    /**
     * Lecture du cookie de session.
     */
    const adminIdRaw = req.cookies?.[COOKIE_NAME];

    if (!adminIdRaw) {
      return res.status(401).json({ message: "Non connecté" });
    }

    /**
     * Conversion et validation de l'identifiant.
     */
    const adminId = Number(adminIdRaw);

    if (!Number.isInteger(adminId) || adminId <= 0) {
      return res.status(401).json({ message: "Non connecté" });
    }

    /**
     * Recherche de l'administrateur correspondant.
     */
    const admin = await findAdminById(adminId);

    if (!admin) {
      return res.status(401).json({ message: "Non connecté" });
    }

    /**
     * Si tout est valide, on retourne l'admin connecté.
     */
    return res.status(200).json({ admin });
  } catch (err) {
    console.error("GET /auth/me:", err);
    return res.status(500).json({ message: "Erreur serveur" });
  }
});

/**
 * --------------------------------------------------------------------
 * POST /auth/logout
 * --------------------------------------------------------------------
 * Met fin à la session courante en supprimant le cookie admin.
 *
 * Réponses :
 * - 200 : déconnexion réussie
 */
router.post("/logout", (req, res) => {
  /**
   * Suppression du cookie en gardant le même path que celui utilisé
   * lors de sa création.
   */
  res.clearCookie(COOKIE_NAME, { path: "/" });

  return res.status(200).json({ message: "Déconnecté" });
});

/**
 * Export du routeur pour montage dans l'application principale.
 */
export default router;