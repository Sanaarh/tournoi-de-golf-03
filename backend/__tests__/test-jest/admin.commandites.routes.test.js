/**
 * --------------------------------------------------------------------
 * Tests des routes admin.commandites.routes.js
 * --------------------------------------------------------------------
 *
 * Objectif :
 * Vérifier le comportement des routes d'administration
 * des commandites dans plusieurs scénarios :
 * - succès
 * - validation invalide
 * - ressource introuvable
 * - erreur serveur
 *
 * Routes testées :
 * - GET    /admin/commandites
 * - GET    /admin/commandites/:id
 * - PUT    /admin/commandites/:id
 * - DELETE /admin/commandites/:id
 */

import { jest } from "@jest/globals";
import request from "supertest";
import express from "express";

/**
 * --------------------------------------------------------------------
 * Mocks du repository
 * --------------------------------------------------------------------
 *
 * On simule les fonctions DAL pour tester uniquement
 * le comportement des routes sans accès réel à la base.
 */
const mockListCommanditesByTournoi = jest.fn();
const mockFindCommanditeAdminById = jest.fn();
const mockUpdateCommanditeById = jest.fn();
const mockDeleteCommanditeById = jest.fn();

await jest.unstable_mockModule("../../dal/admin.commandites.repository.js", () => ({
  listCommanditesByTournoi: (...args) => mockListCommanditesByTournoi(...args),
  findCommanditeAdminById: (...args) => mockFindCommanditeAdminById(...args),
  updateCommanditeById: (...args) => mockUpdateCommanditeById(...args),
  deleteCommanditeById: (...args) => mockDeleteCommanditeById(...args),
}));

/**
 * Mock du middleware requireAdmin
 *
 * Ici, on laisse toujours passer la requête afin de
 * tester uniquement la logique métier des routes.
 */
await jest.unstable_mockModule("../../middlewares/requireAdmin.js", () => ({
  default: (req, res, next) => next(),
}));

const { default: adminCommanditesRoutes } = await import("../../routes/admin.commandites.routes.js");

/**
 * Crée une mini application Express de test.
 */
function makeApp() {
  const app = express();
  app.use(express.json());
  app.use("/admin/commandites", adminCommanditesRoutes);
  return app;
}

describe("routes/admin.commandites.routes.js", () => {
  let app;
  let consoleErrorSpy;

  beforeEach(() => {
    app = makeApp();
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  /**
   * ================================================================
   * GET /admin/commandites
   * ================================================================
   */
  describe("GET /admin/commandites", () => {
    test("400 si tournoi_id manquant", async () => {
      const res = await request(app).get("/admin/commandites");

      expect(res.status).toBe(400);
      expect(res.body).toEqual({
        message: "tournoi_id obligatoire et invalide.",
      });
      expect(mockListCommanditesByTournoi).not.toHaveBeenCalled();
    });

    test("400 si tournoi_id invalide", async () => {
      const res = await request(app).get("/admin/commandites?tournoi_id=abc");

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("tournoi_id obligatoire et invalide.");
      expect(mockListCommanditesByTournoi).not.toHaveBeenCalled();
    });

    test("200 + liste des commandites", async () => {
      mockListCommanditesByTournoi.mockResolvedValueOnce([
        { id: 1, nom_entreprise: "ACME", nb_joueurs: 2 },
      ]);

      const res = await request(app).get("/admin/commandites?tournoi_id=5");

      expect(res.status).toBe(200);
      expect(res.body).toEqual([
        { id: 1, nom_entreprise: "ACME", nb_joueurs: 2 },
      ]);
      expect(mockListCommanditesByTournoi).toHaveBeenCalledTimes(1);
      expect(mockListCommanditesByTournoi).toHaveBeenCalledWith(5);
    });

    test("500 si le repository échoue", async () => {
      mockListCommanditesByTournoi.mockRejectedValueOnce(new Error("DB failure"));

      const res = await request(app).get("/admin/commandites?tournoi_id=5");

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ message: "Erreur serveur" });
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  /**
   * ================================================================
   * GET /admin/commandites/:id
   * ================================================================
   */
  describe("GET /admin/commandites/:id", () => {
    test("400 si id invalide", async () => {
      const res = await request(app).get("/admin/commandites/abc");

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ message: "ID invalide" });
      expect(mockFindCommanditeAdminById).not.toHaveBeenCalled();
    });

    test("404 si commandite introuvable", async () => {
      mockFindCommanditeAdminById.mockResolvedValueOnce(null);

      const res = await request(app).get("/admin/commandites/99");

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ message: "Commandite introuvable" });
    });

    test("200 + détail avec joueurs", async () => {
      mockFindCommanditeAdminById.mockResolvedValueOnce({
        id: 3,
        nom_entreprise: "X",
        joueurs: [{ id: 1, prenom: "A", nom: "B", ordre: 0 }],
      });

      const res = await request(app).get("/admin/commandites/3");

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(3);
      expect(res.body.joueurs).toHaveLength(1);
    });

    test("500 si le repository échoue", async () => {
      mockFindCommanditeAdminById.mockRejectedValueOnce(new Error("DB failure"));

      const res = await request(app).get("/admin/commandites/3");

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ message: "Erreur serveur" });
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  /**
   * ================================================================
   * PUT /admin/commandites/:id
   * ================================================================
   */
  describe("PUT /admin/commandites/:id", () => {
    test("400 si id invalide", async () => {
      const res = await request(app)
        .put("/admin/commandites/abc")
        .send({
          nom_entreprise: "ACME",
        });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ message: "ID invalide" });
      expect(mockUpdateCommanditeById).not.toHaveBeenCalled();
    });

    test("400 si validation échoue", async () => {
      const res = await request(app)
        .put("/admin/commandites/1")
        .send({ nom_entreprise: "" });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Validation impossible");
      expect(res.body.errors).toBeDefined();
      expect(mockUpdateCommanditeById).not.toHaveBeenCalled();
    });

    test("404 si commandite inexistante", async () => {
      mockUpdateCommanditeById.mockResolvedValueOnce({
        ok: false,
        code: "NOT_FOUND",
      });

      const res = await request(app)
        .put("/admin/commandites/1")
        .send({
          nom_entreprise: "ACME",
          nom_contact: "Jean",
          courriel_contact: "j@acme.com",
          telephone_contact: "",
          statut: "EN_ATTENTE",
          type_commandite_id: 2,
          joueurs: [],
        });

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ message: "Commandite introuvable" });
    });

    test("400 si mise à jour impossible avec message personnalisé", async () => {
      mockUpdateCommanditeById.mockResolvedValueOnce({
        ok: false,
        code: "BUSINESS_RULE",
        message: "Règle métier non respectée.",
      });

      const res = await request(app)
        .put("/admin/commandites/1")
        .send({
          nom_entreprise: "ACME",
          nom_contact: "Jean",
          courriel_contact: "j@acme.com",
          telephone_contact: "",
          statut: "EN_ATTENTE",
          type_commandite_id: 2,
          joueurs: [],
        });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({
        message: "Règle métier non respectée.",
      });
    });

    test("400 si quota du forfait atteint", async () => {
      mockUpdateCommanditeById.mockResolvedValueOnce({
        ok: false,
        code: "QUOTA_TYPE",
        message:
          "Le quota du forfait « Or » est atteint (4 inscriptions maximum). Choisissez un autre forfait ou augmentez le quota dans Types de commandites.",
      });

      const res = await request(app)
        .put("/admin/commandites/1")
        .send({
          nom_entreprise: "ACME",
          nom_contact: "Jean",
          courriel_contact: "j@acme.com",
          telephone_contact: "",
          statut: "EN_ATTENTE",
          type_commandite_id: 3,
          joueurs: [],
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/quota.*Or/i);
    });

    test("200 si mise à jour OK", async () => {
      mockUpdateCommanditeById.mockResolvedValueOnce({
        ok: true,
        row: { id: 1, nom_entreprise: "ACME" },
      });

      const res = await request(app)
        .put("/admin/commandites/1")
        .send({
          nom_entreprise: "ACME",
          nom_contact: "Jean",
          courriel_contact: "j@acme.com",
          telephone_contact: "",
          statut: "EN_ATTENTE",
          type_commandite_id: 2,
          joueurs: [],
        });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe("Commandite mise à jour");
      expect(res.body.commandite.id).toBe(1);
    });

    test("500 si le repository échoue", async () => {
      mockUpdateCommanditeById.mockRejectedValueOnce(new Error("DB failure"));

      const res = await request(app)
        .put("/admin/commandites/1")
        .send({
          nom_entreprise: "ACME",
          nom_contact: "Jean",
          courriel_contact: "j@acme.com",
          telephone_contact: "",
          statut: "EN_ATTENTE",
          type_commandite_id: 2,
          joueurs: [],
        });

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ message: "Erreur serveur" });
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  /**
   * ================================================================
   * DELETE /admin/commandites/:id
   * ================================================================
   */
  describe("DELETE /admin/commandites/:id", () => {
    test("400 si id invalide", async () => {
      const res = await request(app).delete("/admin/commandites/abc");

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ message: "ID invalide" });
      expect(mockDeleteCommanditeById).not.toHaveBeenCalled();
    });

    test("404 si commandite déjà absente", async () => {
      mockDeleteCommanditeById.mockResolvedValueOnce(false);

      const res = await request(app).delete("/admin/commandites/1");

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ message: "Commandite introuvable" });
    });

    test("200 si suppression réussie", async () => {
      mockDeleteCommanditeById.mockResolvedValueOnce(true);

      const res = await request(app).delete("/admin/commandites/1");

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ message: "Commandite supprimée" });
    });

    test("500 si le repository échoue", async () => {
      mockDeleteCommanditeById.mockRejectedValueOnce(new Error("DB failure"));

      const res = await request(app).delete("/admin/commandites/1");

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ message: "Erreur serveur" });
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });
});