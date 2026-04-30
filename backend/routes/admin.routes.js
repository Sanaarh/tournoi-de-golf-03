/**
 * --------------------------------------------------------------------
 * Routes d'administration : gestion des comptes administrateurs
 * et statistiques du tableau de bord.
 * --------------------------------------------------------------------
 *
 * Base de routage :
 * - Montée dans server.js sous /admin
 *
 * Endpoints disponibles :
 * - GET    /admin/dashboard/stats : retourne les statistiques globales
 * - GET    /admin/users           : retourne la liste des administrateurs
 * - POST   /admin/users           : crée un nouvel administrateur
 * - PUT    /admin/users/:id       : modifie un administrateur existant
 * - DELETE /admin/users/:id       : supprime un administrateur
 *
 * Règles métier :
 * - Toutes les routes nécessitent une session administrateur valide
 *   via le middleware `requireAdmin`
 * - Un administrateur ne peut pas supprimer son propre compte
 * - Le dernier administrateur ne peut pas être supprimé
 *
 * Important :
 * - Ce fichier ne contient pas de SQL
 * - Les accès base de données sont délégués aux repositories :
 *   - ../dal/admin.repository.js
 *   - ../dal/dashboard.repository.js
 */

import express from "express";
import bcrypt from "bcrypt";
import requireAdmin from "../middlewares/requireAdmin.js";
import {
  listAdmins,
  createAdmin,
  updateAdmin,
  deleteAdminById,
  countAdmins,
} from "../dal/admin.repository.js";
import { getDashboardStats } from "../dal/dashboard.repository.js";

/**
 * Instance du routeur Express.
 */
const router = express.Router();

/**
 * Nombre de tours utilisé pour le hashage bcrypt.
 *
 * Plus la valeur est élevée, plus le hash est coûteux à calculer.
 * Ici, 10 représente un compromis classique entre sécurité et performance.
 */
const SALT_ROUNDS = 10;

/**
 * Vérifie si un mot de passe respecte la politique minimale.
 *
 * Règles :
 * - minimum 8 caractères
 * - au moins 1 lettre majuscule
 * - au moins 1 chiffre
 * - au moins 1 caractère spécial
 *
 * @param {string} password Mot de passe brut saisi par l'utilisateur
 * @returns {boolean} true si valide, sinon false
 */
function isValidPassword(password) {
  return /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/.test(password);
}

/**
 * Retourne le message standard associé à l'échec
 * de la politique de mot de passe.
 *
 * @returns {string} message d'erreur lisible côté client
 */
function passwordPolicyMessage() {
  return "Mot de passe invalide (min 8 caractères, 1 majuscule, 1 chiffre, 1 caractère spécial).";
}

/**
 * Normalise une valeur texte.
 *
 * Objectif :
 * - vérifier que la valeur est bien une chaîne
 * - supprimer les espaces en début et fin
 * - retourner null si la chaîne est vide après trim
 *
 * @param {unknown} value Valeur reçue depuis la requête
 * @returns {string|null} texte nettoyé ou null si invalide/vide
 */
function normalizeText(value) {
  if (typeof value !== "string") return null;

  const v = value.trim();
  return v.length ? v : null;
}

/**
 * Convertit un paramètre d'identifiant en entier positif.
 *
 * @param {string} raw Valeur brute provenant des paramètres URL
 * @returns {number|null} entier positif valide ou null si invalide
 */
function parseId(raw) {
  const id = Number(raw);

  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }

  return id;
}

/**
 * --------------------------------------------------------------------
 * GET /admin/users
 * --------------------------------------------------------------------
 * Retourne la liste des administrateurs.
 *
 * Remarque :
 * - les mots de passe hashés ne devraient pas être retournés
 * - cette responsabilité appartient généralement au repository
 *
 * Réponses :
 * - 200 : succès
 * - 500 : erreur serveur
 */
router.get("/users", requireAdmin, async (req, res) => {
  try {
    const rows = await listAdmins();
    return res.status(200).json(rows);
  } catch (err) {
    console.error("GET /admin/users:", err);
    return res.status(500).json({ message: "Erreur serveur" });
  }
});

/**
 * --------------------------------------------------------------------
 * GET /admin/dashboard/stats
 * --------------------------------------------------------------------
 * Retourne les statistiques globales du tableau de bord admin.
 *
 * Exemples de statistiques possibles :
 * - nombre de tournois
 * - nombre d'équipes
 * - nombre de joueurs
 * - nombre de commandites
 *
 * Réponses :
 * - 200 : succès
 * - 500 : erreur serveur
 */
router.get("/dashboard/stats", requireAdmin, async (req, res) => {
  try {
    const stats = await getDashboardStats();
    return res.status(200).json(stats);
  } catch (err) {
    console.error("GET /admin/dashboard/stats:", err);
    return res.status(500).json({ message: "Erreur serveur" });
  }
});

/**
 * --------------------------------------------------------------------
 * POST /admin/users
 * --------------------------------------------------------------------
 * Crée un nouvel administrateur.
 *
 * Body attendu :
 * - nom_utilisateur
 * - mot_de_passe
 *
 * Étapes :
 * 1. validation de présence
 * 2. validation de la politique de mot de passe
 * 3. hashage du mot de passe avec bcrypt
 * 4. création de l'utilisateur via le repository
 *
 * Réponses :
 * - 201 : admin créé
 * - 400 : données manquantes ou mot de passe invalide
 * - 409 : nom d'utilisateur déjà utilisé
 * - 500 : erreur serveur
 */
router.post("/users", requireAdmin, async (req, res) => {
  /**
   * Nettoyage du nom d'utilisateur.
   * Si la valeur est absente, non texte ou vide après trim,
   * on obtiendra null.
   */
  const nom_utilisateur = normalizeText(req.body?.nom_utilisateur);

  /**
   * On conserve le mot de passe brut seulement si c'est bien une chaîne.
   */
  const mot_de_passe =
    typeof req.body?.mot_de_passe === "string" ? req.body.mot_de_passe : null;

  /**
   * Vérifie que les champs obligatoires sont présents.
   */
  if (!nom_utilisateur || !mot_de_passe) {
    return res.status(400).json({ message: "Champs manquants" });
  }

  /**
   * Vérifie que le mot de passe respecte la politique définie.
   */
  if (!isValidPassword(mot_de_passe)) {
    return res.status(400).json({ message: passwordPolicyMessage() });
  }

  try {
    /**
     * Hash du mot de passe avant insertion.
     * On ne stocke jamais le mot de passe brut en base.
     */
    const hash = await bcrypt.hash(mot_de_passe, SALT_ROUNDS);

    /**
     * Création du compte via la couche repository.
     */
    const created = await createAdmin(nom_utilisateur, hash);

    return res.status(201).json(created);
  } catch (err) {
    /**
     * 23505 = violation d'unicité PostgreSQL.
     * Ici, cela correspond à un nom d'utilisateur déjà existant.
     */
    if (err?.code === "23505") {
      return res.status(409).json({ message: "Nom d'utilisateur déjà utilisé" });
    }

    console.error("POST /admin/users:", err);
    return res.status(500).json({ message: "Erreur serveur" });
  }
});

/**
 * --------------------------------------------------------------------
 * PUT /admin/users/:id
 * --------------------------------------------------------------------
 * Modifie un administrateur existant.
 *
 * Champs acceptés :
 * - nom_utilisateur (optionnel)
 * - mot_de_passe   (optionnel)
 *
 * Contraintes :
 * - l'id doit être valide
 * - il faut au moins une donnée à modifier
 * - si le mot de passe est fourni, il doit respecter la politique
 *
 * Réponses :
 * - 200 : admin modifié
 * - 400 : id invalide, aucune modification, mot de passe invalide
 * - 404 : admin introuvable
 * - 409 : nom d'utilisateur déjà utilisé
 * - 500 : erreur serveur
 */
router.put("/users/:id", requireAdmin, async (req, res) => {
  /**
   * Validation de l'identifiant dans l'URL.
   */
  const id = parseId(req.params.id);

  if (!id) {
    return res.status(400).json({ message: "ID invalide" });
  }

  /**
   * Nettoyage du nom d'utilisateur éventuel.
   */
  const nom_utilisateur = normalizeText(req.body?.nom_utilisateur);

  /**
   * Lecture éventuelle du nouveau mot de passe.
   */
  const mot_de_passe =
    typeof req.body?.mot_de_passe === "string" ? req.body.mot_de_passe : null;

  /**
   * Il faut au moins une donnée à modifier.
   */
  if (!nom_utilisateur && !mot_de_passe) {
    return res.status(400).json({ message: "Aucune modification fournie" });
  }

  /**
   * Si un nouveau mot de passe est fourni,
   * on valide sa conformité à la politique.
   */
  if (mot_de_passe && !isValidPassword(mot_de_passe)) {
    return res.status(400).json({ message: passwordPolicyMessage() });
  }

  try {
    /**
     * Objet contenant uniquement les champs à modifier.
     * Cela évite d'envoyer des valeurs inutiles au repository.
     */
    const fields = {};

    if (nom_utilisateur) {
      fields.nom_utilisateur = nom_utilisateur;
    }

    if (mot_de_passe) {
      /**
       * On hash le nouveau mot de passe avant mise à jour.
       */
      fields.mot_de_passe_hash = await bcrypt.hash(mot_de_passe, SALT_ROUNDS);
    }

    /**
     * Mise à jour via le repository.
     */
    const updated = await updateAdmin(id, fields);

    /**
     * Si aucun admin n'a été trouvé avec cet id.
     */
    if (!updated) {
      return res.status(404).json({ message: "Admin introuvable" });
    }

    return res.status(200).json(updated);
  } catch (err) {
    if (err?.code === "23505") {
      return res.status(409).json({ message: "Nom d'utilisateur déjà utilisé" });
    }

    console.error("PUT /admin/users/:id:", err);
    return res.status(500).json({ message: "Erreur serveur" });
  }
});

/**
 * --------------------------------------------------------------------
 * DELETE /admin/users/:id
 * --------------------------------------------------------------------
 * Supprime un administrateur.
 *
 * Règles métier :
 * - l'id doit être valide
 * - un administrateur ne peut pas supprimer son propre compte
 * - le dernier administrateur ne peut pas être supprimé
 *
 * Réponses :
 * - 204 : suppression réussie
 * - 400 : id invalide, auto-suppression interdite, dernier admin
 * - 404 : admin introuvable
 * - 500 : erreur serveur
 */
router.delete("/users/:id", requireAdmin, async (req, res) => {
  /**
   * Validation de l'identifiant cible.
   */
  const id = parseId(req.params.id);

  if (!id) {
    return res.status(400).json({ message: "ID invalide" });
  }

  /**
   * Protection contre la suppression de son propre compte.
   *
   * Le middleware requireAdmin est supposé avoir placé l'id
   * de l'administrateur connecté dans req.adminId.
   */
  if (req.adminId && Number(req.adminId) === id) {
    return res.status(400).json({
      message: "Impossible de supprimer votre propre compte",
    });
  }

  try {
    /**
     * On vérifie combien d'administrateurs existent encore.
     * On interdit la suppression s'il n'en reste qu'un.
     */
    const total = await countAdmins();

    if (total <= 1) {
      return res.status(400).json({
        message: "Suppression impossible : au moins un administrateur doit exister",
      });
    }

    /**
     * Suppression via le repository.
     * On s'attend ici à recevoir le nombre de lignes supprimées.
     */
    const deletedCount = await deleteAdminById(id);

    if (deletedCount === 0) {
      return res.status(404).json({ message: "Admin introuvable" });
    }

    /**
     * 204 = succès sans contenu de réponse.
     */
    return res.status(204).send();
  } catch (err) {
    console.error("DELETE /admin/users/:id:", err);
    return res.status(500).json({ message: "Erreur serveur" });
  }
});

/**
 * Export du routeur pour être monté dans l'application principale.
 */
export default router;