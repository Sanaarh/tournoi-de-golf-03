/**
 * --------------------------------------------------------------------
 * Tests des routes d'administration des types de commandites
 * --------------------------------------------------------------------
 *
 * Fichier testé :
 * - routes/types-commandites.routes.js
 *
 * Objectif :
 * Vérifier le bon fonctionnement des routes CRUD utilisées
 * pour la gestion des types de commandites côté administration.
 *
 * Routes couvertes :
 * - GET    /admin/types-commandites
 * - GET    /admin/types-commandites/:id
 * - POST   /admin/types-commandites
 * - PUT    /admin/types-commandites/:id
 * - DELETE /admin/types-commandites/:id
 *
 * Fonctionnalités testées :
 * - lecture de la liste des types
 * - lecture filtrée par tournoi
 * - lecture d'un type par id
 * - création d'un type de commandite
 * - modification d'un type de commandite
 * - suppression d'un type de commandite
 * - validation des identifiants
 * - validation des données du body
 * - validation des quotas
 * - respect de la limite de commandites d'un tournoi
 * - protection via requireAdmin
 * - gestion des erreurs serveur
 *
 * Outils utilisés :
 * - Jest
 * - Supertest
 * - Express
 *
 * Dépendances simulées :
 * - middleware requireAdmin
 * - repository types-commandites
 * - repository tournoi
 * --------------------------------------------------------------------
 */

import { jest } from "@jest/globals";
import express from "express";
import request from "supertest";

/**
 * --------------------------------------------------------------------
 * Mock du middleware requireAdmin
 * --------------------------------------------------------------------
 *
 * Par défaut, on laisse passer la requête afin de tester
 * uniquement la logique métier des routes.
 */
const mockRequireAdmin = jest.fn((req, res, next) => next());

await jest.unstable_mockModule("../../middlewares/requireAdmin.js", () => ({
  default: (req, res, next) => mockRequireAdmin(req, res, next),
}));

/**
 * --------------------------------------------------------------------
 * Mocks du repository des types de commandites
 * --------------------------------------------------------------------
 */
const mockListTypesCommandites = jest.fn();
const mockListTypesCommanditesByTournoi = jest.fn();
const mockFindTypeCommanditeById = jest.fn();
const mockCreateTypeCommandite = jest.fn();
const mockUpdateTypeCommandite = jest.fn();
const mockDeleteTypeCommandite = jest.fn();
const mockSumQuotasTypesForTournoi = jest.fn();
const mockCountCommanditesForType = jest.fn();

await jest.unstable_mockModule("../../dal/types-commandites.repository.js", () => ({
  listTypesCommandites: (...args) => mockListTypesCommandites(...args),
  listTypesCommanditesByTournoi: (...args) => mockListTypesCommanditesByTournoi(...args),
  findTypeCommanditeById: (...args) => mockFindTypeCommanditeById(...args),
  createTypeCommandite: (...args) => mockCreateTypeCommandite(...args),
  updateTypeCommandite: (...args) => mockUpdateTypeCommandite(...args),
  deleteTypeCommandite: (...args) => mockDeleteTypeCommandite(...args),
  sumQuotasTypesForTournoi: (...args) => mockSumQuotasTypesForTournoi(...args),
  countCommanditesForType: (...args) => mockCountCommanditesForType(...args),
}));

/**
 * --------------------------------------------------------------------
 * Mock du repository des tournois
 * --------------------------------------------------------------------
 */
const mockFindTournoiById = jest.fn();

await jest.unstable_mockModule("../../dal/tournoi.repository.js", () => ({
  findTournoiById: (...args) => mockFindTournoiById(...args),
}));

const { default: typesCommanditesRouter } = await import(
  "../../routes/types-commandites.routes.js"
);

/**
 * --------------------------------------------------------------------
 * Helper : crée une mini app Express de test
 * --------------------------------------------------------------------
 */
function makeApp() {
  const app = express();
  app.use(express.json());
  app.use("/admin/types-commandites", typesCommanditesRouter);
  return app;
}

describe("types-commandites.routes.js (/admin/types-commandites)", () => {
  let consoleErrorSpy;

  beforeEach(() => {
    jest.clearAllMocks();

    mockRequireAdmin.mockImplementation((req, res, next) => {
      req.adminId = 1;
      next();
    });

    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  /**
   * ================================================================
   * GET /admin/types-commandites
   * ================================================================
   */
  describe("GET /admin/types-commandites", () => {
    test("retourne 200 + liste", async () => {
      mockListTypesCommandites.mockResolvedValueOnce([
        {
          id: 1,
          tournoi_id: 1,
          nom: "Or",
          prix_cents: 50000,
          quota: 5,
          places_incluses: 4,
          nb_commandites: 2,
        },
      ]);

      const app = makeApp();
      const res = await request(app).get("/admin/types-commandites");

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(mockListTypesCommandites).toHaveBeenCalledTimes(1);
    });

    test("retourne 200 si filtré par tournoi valide", async () => {
      mockListTypesCommanditesByTournoi.mockResolvedValueOnce([
        {
          id: 1,
          tournoi_id: 1,
          nom: "Argent",
          quota: 10,
        },
      ]);

      const app = makeApp();
      const res = await request(app).get("/admin/types-commandites?tournoi_id=1");

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(mockListTypesCommanditesByTournoi).toHaveBeenCalledWith(1);
    });

    test("retourne 400 si tournoi_id invalide", async () => {
      const app = makeApp();
      const res = await request(app).get("/admin/types-commandites?tournoi_id=abc");

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ message: "tournoi_id invalide" });
      expect(mockListTypesCommandites).not.toHaveBeenCalled();
      expect(mockListTypesCommanditesByTournoi).not.toHaveBeenCalled();
    });

    test("retourne 500 si erreur serveur", async () => {
      mockListTypesCommandites.mockRejectedValueOnce(new Error("DB error"));

      const app = makeApp();
      const res = await request(app).get("/admin/types-commandites");

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ message: "Erreur serveur" });
    });
  });

  /**
   * ================================================================
   * GET /admin/types-commandites/:id
   * ================================================================
   */
  describe("GET /admin/types-commandites/:id", () => {
    test("retourne 400 si id invalide", async () => {
      const app = makeApp();
      const res = await request(app).get("/admin/types-commandites/abc");

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ message: "ID invalide" });
      expect(mockFindTypeCommanditeById).not.toHaveBeenCalled();
    });

    test("retourne 200 si type trouvé", async () => {
      mockFindTypeCommanditeById.mockResolvedValueOnce({
        id: 5,
        tournoi_id: 1,
        nom: "Or",
        quota: 5,
      });

      const app = makeApp();
      const res = await request(app).get("/admin/types-commandites/5");

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(5);
      expect(mockFindTypeCommanditeById).toHaveBeenCalledWith(5);
    });

    test("retourne 404 si type introuvable", async () => {
      mockFindTypeCommanditeById.mockResolvedValueOnce(null);

      const app = makeApp();
      const res = await request(app).get("/admin/types-commandites/999");

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ message: "Type de commandite introuvable" });
    });

    test("retourne 500 si erreur serveur", async () => {
      mockFindTypeCommanditeById.mockRejectedValueOnce(new Error("DB error"));

      const app = makeApp();
      const res = await request(app).get("/admin/types-commandites/5");

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ message: "Erreur serveur" });
    });
  });

  /**
   * ================================================================
   * POST /admin/types-commandites
   * ================================================================
   */
  describe("POST /admin/types-commandites", () => {
    test("retourne 400 si payload invalide", async () => {
      const app = makeApp();
      const res = await request(app).post("/admin/types-commandites").send({
        nom: "",
      });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Validation impossible");
      expect(res.body.errors).toEqual(expect.any(Object));
      expect(mockFindTournoiById).not.toHaveBeenCalled();
      expect(mockCreateTypeCommandite).not.toHaveBeenCalled();
    });

    test("retourne 400 si tournoi introuvable", async () => {
      mockFindTournoiById.mockResolvedValueOnce(null);

      const app = makeApp();
      const res = await request(app).post("/admin/types-commandites").send({
        tournoi_id: 999,
        nom: "Argent",
        prix_cents: 30000,
        quota: 10,
        places_incluses: 2,
      });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Validation impossible");
      expect(res.body.errors?.tournoi_id).toMatch(/n'existe pas/i);
      expect(mockCreateTypeCommandite).not.toHaveBeenCalled();
    });

    test("retourne 400 si tournoi fermé aux inscriptions", async () => {
      mockFindTournoiById.mockResolvedValueOnce({
        id: 1,
        nom: "Tournoi principal",
        inscriptions_ouvertes: false,
        limite_commandites: 50,
      });

      const app = makeApp();
      const res = await request(app).post("/admin/types-commandites").send({
        tournoi_id: 1,
        nom: "Argent",
        prix_cents: 30000,
        quota: 10,
        places_incluses: 2,
      });

      expect(res.status).toBe(400);
      expect(res.body.errors?.tournoi_id).toMatch(/ouvert/i);
      expect(mockSumQuotasTypesForTournoi).not.toHaveBeenCalled();
      expect(mockCreateTypeCommandite).not.toHaveBeenCalled();
    });

    test("retourne 400 si somme des quotas dépasse la limite tournoi", async () => {
      mockFindTournoiById.mockResolvedValueOnce({
        id: 1,
        nom: "Tournoi principal",
        inscriptions_ouvertes: true,
        limite_commandites: 12,
      });
      mockSumQuotasTypesForTournoi.mockResolvedValueOnce(12);

      const app = makeApp();
      const res = await request(app).post("/admin/types-commandites").send({
        tournoi_id: 1,
        nom: "Platine",
        prix_cents: 100,
        quota: 1,
        places_incluses: 1,
      });

      expect(res.status).toBe(400);
      expect(res.body.errors?.quota).toMatch(/limite/i);
      expect(mockCreateTypeCommandite).not.toHaveBeenCalled();
    });

    test("retourne 400 si quota 0 (refusé)", async () => {
      const app = makeApp();
      const res = await request(app).post("/admin/types-commandites").send({
        tournoi_id: 1,
        nom: "Brouillon",
        prix_cents: 0,
        quota: 0,
        places_incluses: 0,
      });

      expect(res.status).toBe(400);
      expect(res.body.errors?.quota).toMatch(/≥ 1|entier/i);
      expect(mockFindTournoiById).not.toHaveBeenCalled();
      expect(mockCreateTypeCommandite).not.toHaveBeenCalled();
    });

    test("retourne 201 succès", async () => {
      mockFindTournoiById.mockResolvedValueOnce({
        id: 1,
        nom: "Tournoi principal",
        inscriptions_ouvertes: true,
        limite_commandites: 100,
      });
      mockSumQuotasTypesForTournoi.mockResolvedValueOnce(0);

      mockCreateTypeCommandite.mockResolvedValueOnce({
        id: 10,
        tournoi_id: 1,
        nom: "Argent",
        prix_cents: 30000,
        quota: 10,
        places_incluses: 2,
        description: "Test",
        date_creation: "2026-03-01T00:00:00.000Z",
      });

      const app = makeApp();
      const res = await request(app).post("/admin/types-commandites").send({
        tournoi_id: 1,
        nom: "Argent",
        prix_cents: 30000,
        quota: 10,
        places_incluses: 2,
        description: "Test",
      });

      expect(res.status).toBe(201);
      expect(res.body.nom).toBe("Argent");
      expect(mockFindTournoiById).toHaveBeenCalledTimes(1);
      expect(mockSumQuotasTypesForTournoi).toHaveBeenCalledWith(1, null);
      expect(mockCreateTypeCommandite).toHaveBeenCalledTimes(1);
    });

    test("retourne 500 + detail si erreur serveur", async () => {
      mockFindTournoiById.mockResolvedValueOnce({
        id: 1,
        nom: "Tournoi principal",
        inscriptions_ouvertes: true,
        limite_commandites: 100,
      });
      mockSumQuotasTypesForTournoi.mockResolvedValueOnce(0);

      const err = new Error("Insert failed");
      err.detail = "insert detail";
      mockCreateTypeCommandite.mockRejectedValueOnce(err);

      const app = makeApp();
      const res = await request(app).post("/admin/types-commandites").send({
        tournoi_id: 1,
        nom: "Argent",
        prix_cents: 30000,
        quota: 10,
        places_incluses: 2,
      });

      expect(res.status).toBe(500);
      expect(res.body).toEqual({
        message: "Erreur serveur",
        detail: "insert detail",
      });
    });
  });

  /**
   * ================================================================
   * PUT /admin/types-commandites/:id
   * ================================================================
   */
  describe("PUT /admin/types-commandites/:id", () => {
    test("retourne 400 si id invalide", async () => {
      const app = makeApp();
      const res = await request(app).put("/admin/types-commandites/abc").send({
        tournoi_id: 1,
        nom: "Or",
        prix_cents: 1000,
        quota: 2,
        places_incluses: 2,
      });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ message: "ID invalide" });
      expect(mockUpdateTypeCommandite).not.toHaveBeenCalled();
    });

    test("retourne 400 si payload invalide", async () => {
      const app = makeApp();
      const res = await request(app).put("/admin/types-commandites/5").send({
        nom: "",
      });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Validation impossible");
      expect(res.body.errors).toEqual(expect.any(Object));
      expect(mockFindTypeCommanditeById).not.toHaveBeenCalled();
    });

    test("retourne 404 si type introuvable avant modification", async () => {
      mockFindTypeCommanditeById.mockResolvedValueOnce(null);

      const app = makeApp();
      const res = await request(app).put("/admin/types-commandites/5").send({
        tournoi_id: 1,
        nom: "Or",
        prix_cents: 1000,
        quota: 2,
        places_incluses: 2,
      });

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ message: "Type de commandite introuvable" });
    });

    test("retourne 400 si tournoi spécifié introuvable", async () => {
      mockFindTypeCommanditeById.mockResolvedValueOnce({
        id: 5,
        tournoi_id: 1,
        nom: "Or",
        quota: 5,
      });
      mockFindTournoiById.mockResolvedValueOnce(null);

      const app = makeApp();
      const res = await request(app).put("/admin/types-commandites/5").send({
        tournoi_id: 999,
        nom: "Or",
        prix_cents: 1000,
        quota: 5,
        places_incluses: 2,
      });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Validation impossible");
      expect(res.body.errors?.tournoi_id).toMatch(/n'existe pas/i);
    });

    test("retourne 400 si quota inférieur aux commandites existantes", async () => {
      mockFindTypeCommanditeById.mockResolvedValueOnce({
        id: 5,
        tournoi_id: 1,
        nom: "Or",
        quota: 5,
      });
      mockFindTournoiById.mockResolvedValueOnce({
        id: 1,
        inscriptions_ouvertes: false,
        limite_commandites: 20,
      });
      mockCountCommanditesForType.mockResolvedValueOnce(3);

      const app = makeApp();
      const res = await request(app).put("/admin/types-commandites/5").send({
        tournoi_id: 1,
        nom: "Or",
        prix_cents: 1000,
        quota: 2,
        places_incluses: 2,
      });

      expect(res.status).toBe(400);
      expect(res.body.errors?.quota).toMatch(/inscrites/i);
      expect(mockUpdateTypeCommandite).not.toHaveBeenCalled();
    });

    test("retourne 400 si la somme des quotas dépasse la limite tournoi", async () => {
      mockFindTypeCommanditeById.mockResolvedValueOnce({
        id: 5,
        tournoi_id: 1,
        nom: "Or",
        quota: 5,
      });
      mockFindTournoiById.mockResolvedValueOnce({
        id: 1,
        limite_commandites: 10,
      });
      mockCountCommanditesForType.mockResolvedValueOnce(1);
      mockSumQuotasTypesForTournoi.mockResolvedValueOnce(10);

      const app = makeApp();
      const res = await request(app).put("/admin/types-commandites/5").send({
        tournoi_id: 1,
        nom: "Or",
        prix_cents: 1000,
        quota: 1,
        places_incluses: 2,
      });

      expect(res.status).toBe(400);
      expect(res.body.errors?.quota).toMatch(/limite/i);
      expect(mockUpdateTypeCommandite).not.toHaveBeenCalled();
    });

    test("retourne 200 succès", async () => {
      mockFindTypeCommanditeById.mockResolvedValueOnce({
        id: 5,
        tournoi_id: 1,
      });

      mockFindTournoiById.mockResolvedValueOnce({
        id: 1,
        limite_commandites: 100,
      });

      mockCountCommanditesForType.mockResolvedValueOnce(1);
      mockSumQuotasTypesForTournoi.mockResolvedValueOnce(10);

      mockUpdateTypeCommandite.mockResolvedValueOnce({
        id: 5,
        nom: "Or",
      });

      const app = makeApp();
      const res = await request(app).put("/admin/types-commandites/5").send({
        tournoi_id: 1,
        nom: "Or",
        prix_cents: 50000,
        quota: 5,
        places_incluses: 4,
      });

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(5);
      expect(mockUpdateTypeCommandite).toHaveBeenCalled();
    });

    test("retourne 404 si update retourne null", async () => {
      mockFindTypeCommanditeById.mockResolvedValueOnce({
        id: 5,
        tournoi_id: 1,
      });

      mockFindTournoiById.mockResolvedValueOnce({
        id: 1,
        limite_commandites: 100,
      });

      mockCountCommanditesForType.mockResolvedValueOnce(1);
      mockSumQuotasTypesForTournoi.mockResolvedValueOnce(10);
      mockUpdateTypeCommandite.mockResolvedValueOnce(null);

      const app = makeApp();
      const res = await request(app).put("/admin/types-commandites/5").send({
        tournoi_id: 1,
        nom: "Or",
        prix_cents: 50000,
        quota: 5,
        places_incluses: 4,
      });

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ message: "Type de commandite introuvable" });
    });

    test("retourne 500 + detail si erreur serveur", async () => {
      mockFindTypeCommanditeById.mockResolvedValueOnce({
        id: 5,
        tournoi_id: 1,
      });

      mockFindTournoiById.mockResolvedValueOnce({
        id: 1,
        limite_commandites: 100,
      });

      mockCountCommanditesForType.mockResolvedValueOnce(1);
      mockSumQuotasTypesForTournoi.mockResolvedValueOnce(10);

      const err = new Error("Update failed");
      err.detail = "update detail";
      mockUpdateTypeCommandite.mockRejectedValueOnce(err);

      const app = makeApp();
      const res = await request(app).put("/admin/types-commandites/5").send({
        tournoi_id: 1,
        nom: "Or",
        prix_cents: 50000,
        quota: 5,
        places_incluses: 4,
      });

      expect(res.status).toBe(500);
      expect(res.body).toEqual({
        message: "Erreur serveur",
        detail: "update detail",
      });
    });
  });

  /**
   * ================================================================
   * DELETE /admin/types-commandites/:id
   * ================================================================
   */
  describe("DELETE /admin/types-commandites/:id", () => {
    test("retourne 400 si id invalide", async () => {
      const app = makeApp();
      const res = await request(app).delete("/admin/types-commandites/abc");

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ message: "ID invalide" });
      expect(mockDeleteTypeCommandite).not.toHaveBeenCalled();
    });

    test("retourne 404 si introuvable", async () => {
      mockDeleteTypeCommandite.mockResolvedValueOnce(null);

      const app = makeApp();
      const res = await request(app).delete("/admin/types-commandites/999");

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ message: "Type de commandite introuvable" });
    });

    test("retourne 200 si suppression réussie", async () => {
      mockDeleteTypeCommandite.mockResolvedValueOnce({
        id: 5,
        nom: "Or",
      });

      const app = makeApp();
      const res = await request(app).delete("/admin/types-commandites/5");

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        message: "Type de commandite supprimé",
        type_commandite: {
          id: 5,
          nom: "Or",
        },
      });
    });

    test("retourne 500 + detail si erreur serveur", async () => {
      const err = new Error("Delete failed");
      err.detail = "delete detail";
      mockDeleteTypeCommandite.mockRejectedValueOnce(err);

      const app = makeApp();
      const res = await request(app).delete("/admin/types-commandites/5");

      expect(res.status).toBe(500);
      expect(res.body).toEqual({
        message: "Erreur serveur",
        detail: "delete detail",
      });
    });
  });

  /**
   * ================================================================
   * Middleware requireAdmin
   * ================================================================
   */
  test("retourne 401 si requireAdmin bloque l'accès", async () => {
    mockRequireAdmin.mockImplementationOnce((req, res) => {
      return res.status(401).json({ message: "Non autorisé" });
    });

    const app = makeApp();
    const res = await request(app).get("/admin/types-commandites");

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ message: "Non autorisé" });
  });
});