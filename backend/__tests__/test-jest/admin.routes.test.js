/**
 * --------------------------------------------------------------------
 * Tests des routes administrateurs (admin.routes.js)
 * --------------------------------------------------------------------
 *
 * Fichier testé :
 * - routes/admin.routes.js
 *
 * Objectif :
 * Vérifier le bon fonctionnement des routes d'administration
 * liées à :
 * - la gestion des comptes administrateurs (CRUD)
 * - l'affichage des statistiques du tableau de bord
 *
 * Routes couvertes :
 * - GET    /admin/users
 * - GET    /admin/dashboard/stats
 * - POST   /admin/users
 * - PUT    /admin/users/:id
 * - DELETE /admin/users/:id
 *
 * Stratégie utilisée :
 * - Le middleware requireAdmin est mocké pour simuler
 *   un utilisateur administrateur authentifié.
 * - bcrypt est mocké pour éviter un vrai hash.
 * - Les repositories sont mockés pour contrôler
 *   les réponses retournées.
 *
 * Outils utilisés :
 * - Jest
 * - Supertest
 * - Express
 *
 * Types de scénarios testés :
 * - succès
 * - validation invalide
 * - conflit
 * - introuvable
 * - non autorisé
 * - erreur serveur
 *
 * Particularités vérifiées :
 * - politique de mot de passe
 * - hashage bcrypt simulé
 * - protection contre la suppression de son propre compte
 * - protection contre la suppression du dernier administrateur
 * --------------------------------------------------------------------
 */

import { jest } from "@jest/globals";
import express from "express";
import request from "supertest";

/**
 * --------------------------------------------------------------------
 * Mocks
 * --------------------------------------------------------------------
 */

const mockRequireAdmin = jest.fn((req, res, next) => next());

await jest.unstable_mockModule("../../middlewares/requireAdmin.js", () => ({
  default: (req, res, next) => mockRequireAdmin(req, res, next),
}));

const mockBcryptHash = jest.fn(async () => "HASHED_PASSWORD");

await jest.unstable_mockModule("bcrypt", () => ({
  default: {
    hash: (...args) => mockBcryptHash(...args),
  },
}));

const mockListAdmins = jest.fn();
const mockCreateAdmin = jest.fn();
const mockUpdateAdmin = jest.fn();
const mockDeleteAdminById = jest.fn();
const mockCountAdmins = jest.fn();
const mockGetDashboardStats = jest.fn();

await jest.unstable_mockModule("../../dal/admin.repository.js", () => ({
  listAdmins: (...args) => mockListAdmins(...args),
  createAdmin: (...args) => mockCreateAdmin(...args),
  updateAdmin: (...args) => mockUpdateAdmin(...args),
  deleteAdminById: (...args) => mockDeleteAdminById(...args),
  countAdmins: (...args) => mockCountAdmins(...args),
}));

await jest.unstable_mockModule("../../dal/dashboard.repository.js", () => ({
  getDashboardStats: (...args) => mockGetDashboardStats(...args),
}));

const { default: adminRouter } = await import("../../routes/admin.routes.js");

/**
 * --------------------------------------------------------------------
 * Helper : crée une app Express de test
 * --------------------------------------------------------------------
 */
function makeApp() {
  const app = express();
  app.use(express.json());
  app.use("/admin", adminRouter);
  return app;
}

describe("admin.routes.js (/admin/users)", () => {
  let consoleErrorSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    mockRequireAdmin.mockImplementation((req, res, next) => {
      req.adminId = 1;
      next();
    });
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  /**
   * ================================================================
   * GET /admin/users
   * ================================================================
   */
  test("GET /admin/users -> 200 + liste", async () => {
    mockListAdmins.mockResolvedValueOnce([
      { id: 1, nom_utilisateur: "admin1", date_creation: "2026-02-25T00:00:00.000Z" },
      { id: 2, nom_utilisateur: "admin2", date_creation: "2026-02-25T00:00:00.000Z" },
    ]);

    const app = makeApp();
    const res = await request(app).get("/admin/users");

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(mockListAdmins).toHaveBeenCalledTimes(1);
  });

  test("GET /admin/users -> 500 si erreur repository", async () => {
    mockListAdmins.mockRejectedValueOnce(new Error("DB down"));

    const app = makeApp();
    const res = await request(app).get("/admin/users");

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ message: "Erreur serveur" });
  });

  /**
   * ================================================================
   * GET /admin/dashboard/stats
   * ================================================================
   */
  test("GET /admin/dashboard/stats -> 200 + compteurs", async () => {
    mockGetDashboardStats.mockResolvedValueOnce({
      tournois: 2,
      equipes: 6,
      joueurs: 19,
      commandites: 4,
    });

    const app = makeApp();
    const res = await request(app).get("/admin/dashboard/stats");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      tournois: 2,
      equipes: 6,
      joueurs: 19,
      commandites: 4,
    });
  });

  test("GET /admin/dashboard/stats -> 500 si erreur repository", async () => {
    mockGetDashboardStats.mockRejectedValueOnce(new Error("DB down"));

    const app = makeApp();
    const res = await request(app).get("/admin/dashboard/stats");

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ message: "Erreur serveur" });
  });

  /**
   * ================================================================
   * POST /admin/users
   * ================================================================
   */
  test("POST /admin/users -> 400 champs manquants", async () => {
    const app = makeApp();
    const res = await request(app).post("/admin/users").send({ nom_utilisateur: "" });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Champs manquants");
    expect(mockCreateAdmin).not.toHaveBeenCalled();
  });

  test("POST /admin/users -> 400 mot de passe invalide", async () => {
    const app = makeApp();
    const res = await request(app).post("/admin/users").send({
      nom_utilisateur: "admin3",
      mot_de_passe: "abc",
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Mot de passe invalide/i);
    expect(mockBcryptHash).not.toHaveBeenCalled();
    expect(mockCreateAdmin).not.toHaveBeenCalled();
  });

  test("POST /admin/users -> 201 succès", async () => {
    mockCreateAdmin.mockResolvedValueOnce({
      id: 3,
      nom_utilisateur: "admin3",
      date_creation: "2026-02-25T00:00:00.000Z",
    });

    const app = makeApp();
    const res = await request(app).post("/admin/users").send({
      nom_utilisateur: "admin3",
      mot_de_passe: "Admin123!",
    });

    expect(res.status).toBe(201);
    expect(res.body.nom_utilisateur).toBe("admin3");
    expect(mockBcryptHash).toHaveBeenCalledTimes(1);
    expect(mockCreateAdmin).toHaveBeenCalledTimes(1);
    expect(mockCreateAdmin).toHaveBeenCalledWith("admin3", "HASHED_PASSWORD");
  });

  test("POST /admin/users -> 409 username déjà utilisé (code 23505)", async () => {
    mockCreateAdmin.mockRejectedValueOnce({ code: "23505" });

    const app = makeApp();
    const res = await request(app).post("/admin/users").send({
      nom_utilisateur: "admin1",
      mot_de_passe: "Admin123!",
    });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ message: "Nom d'utilisateur déjà utilisé" });
  });

  test("POST /admin/users -> 500 si erreur serveur inattendue", async () => {
    mockCreateAdmin.mockRejectedValueOnce(new Error("DB down"));

    const app = makeApp();
    const res = await request(app).post("/admin/users").send({
      nom_utilisateur: "adminX",
      mot_de_passe: "Admin123!",
    });

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ message: "Erreur serveur" });
  });

  /**
   * ================================================================
   * PUT /admin/users/:id
   * ================================================================
   */
  test("PUT /admin/users/:id -> 400 id invalide", async () => {
    const app = makeApp();
    const res = await request(app).put("/admin/users/abc").send({ nom_utilisateur: "x" });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ message: "ID invalide" });
    expect(mockUpdateAdmin).not.toHaveBeenCalled();
  });

  test("PUT /admin/users/:id -> 400 aucune modification fournie", async () => {
    const app = makeApp();
    const res = await request(app).put("/admin/users/2").send({});

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ message: "Aucune modification fournie" });
    expect(mockUpdateAdmin).not.toHaveBeenCalled();
  });

  test("PUT /admin/users/:id -> 400 mot de passe invalide", async () => {
    const app = makeApp();
    const res = await request(app).put("/admin/users/2").send({ mot_de_passe: "abc" });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Mot de passe invalide/i);
    expect(mockBcryptHash).not.toHaveBeenCalled();
    expect(mockUpdateAdmin).not.toHaveBeenCalled();
  });

  test("PUT /admin/users/:id -> 404 si introuvable", async () => {
    mockUpdateAdmin.mockResolvedValueOnce(null);

    const app = makeApp();
    const res = await request(app).put("/admin/users/999").send({ nom_utilisateur: "new" });

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ message: "Admin introuvable" });
    expect(mockUpdateAdmin).toHaveBeenCalledTimes(1);
  });

  test("PUT /admin/users/:id -> 200 succès (username)", async () => {
    mockUpdateAdmin.mockResolvedValueOnce({
      id: 2,
      nom_utilisateur: "admin2_new",
      date_creation: "2026-02-25T00:00:00.000Z",
    });

    const app = makeApp();
    const res = await request(app).put("/admin/users/2").send({
      nom_utilisateur: "admin2_new",
    });

    expect(res.status).toBe(200);
    expect(res.body.nom_utilisateur).toBe("admin2_new");
    expect(mockUpdateAdmin).toHaveBeenCalledTimes(1);
    expect(mockUpdateAdmin).toHaveBeenCalledWith(2, {
      nom_utilisateur: "admin2_new",
    });
  });

  test("PUT /admin/users/:id -> 200 succès (mot de passe)", async () => {
    mockUpdateAdmin.mockResolvedValueOnce({
      id: 2,
      nom_utilisateur: "admin2",
      date_creation: "2026-02-25T00:00:00.000Z",
    });

    const app = makeApp();
    const res = await request(app).put("/admin/users/2").send({
      mot_de_passe: "Admin123!",
    });

    expect(res.status).toBe(200);
    expect(mockBcryptHash).toHaveBeenCalledTimes(1);
    expect(mockUpdateAdmin).toHaveBeenCalledWith(2, {
      mot_de_passe_hash: "HASHED_PASSWORD",
    });
  });

  test("PUT /admin/users/:id -> 200 succès (username + mot de passe)", async () => {
    mockUpdateAdmin.mockResolvedValueOnce({
      id: 2,
      nom_utilisateur: "admin2_new",
      date_creation: "2026-02-25T00:00:00.000Z",
    });

    const app = makeApp();
    const res = await request(app).put("/admin/users/2").send({
      nom_utilisateur: "admin2_new",
      mot_de_passe: "Admin123!",
    });

    expect(res.status).toBe(200);
    expect(mockBcryptHash).toHaveBeenCalledTimes(1);
    expect(mockUpdateAdmin).toHaveBeenCalledWith(2, {
      nom_utilisateur: "admin2_new",
      mot_de_passe_hash: "HASHED_PASSWORD",
    });
  });

  test("PUT /admin/users/:id -> 409 username déjà utilisé (23505)", async () => {
    mockUpdateAdmin.mockRejectedValueOnce({ code: "23505" });

    const app = makeApp();
    const res = await request(app).put("/admin/users/2").send({
      nom_utilisateur: "admin1",
    });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ message: "Nom d'utilisateur déjà utilisé" });
  });

  test("PUT /admin/users/:id -> 500 si erreur serveur inattendue", async () => {
    mockUpdateAdmin.mockRejectedValueOnce(new Error("DB down"));

    const app = makeApp();
    const res = await request(app)
      .put("/admin/users/2")
      .send({ nom_utilisateur: "admin_new" });

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ message: "Erreur serveur" });
  });

  /**
   * ================================================================
   * DELETE /admin/users/:id
   * ================================================================
   */
  test("DELETE /admin/users/:id -> 400 id invalide", async () => {
    const app = makeApp();
    const res = await request(app).delete("/admin/users/0");

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ message: "ID invalide" });
    expect(mockCountAdmins).not.toHaveBeenCalled();
  });

  test("DELETE /admin/users/:id -> 400 interdit supprimer soi-même", async () => {
    mockRequireAdmin.mockImplementation((req, res, next) => {
      req.adminId = 2;
      next();
    });

    const app = makeApp();
    const res = await request(app).delete("/admin/users/2");

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ message: "Impossible de supprimer votre propre compte" });
    expect(mockCountAdmins).not.toHaveBeenCalled();
  });

  test("DELETE /admin/users/:id -> 400 interdit supprimer dernier admin", async () => {
    mockCountAdmins.mockResolvedValueOnce(1);

    const app = makeApp();
    const res = await request(app).delete("/admin/users/2");

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/au moins un administrateur doit exister/i);
    expect(mockCountAdmins).toHaveBeenCalledTimes(1);
    expect(mockDeleteAdminById).not.toHaveBeenCalled();
  });

  test("DELETE /admin/users/:id -> 404 si introuvable", async () => {
    mockCountAdmins.mockResolvedValueOnce(2);
    mockDeleteAdminById.mockResolvedValueOnce(0);

    const app = makeApp();
    const res = await request(app).delete("/admin/users/999");

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ message: "Admin introuvable" });
    expect(mockCountAdmins).toHaveBeenCalledTimes(1);
    expect(mockDeleteAdminById).toHaveBeenCalledTimes(1);
    expect(mockDeleteAdminById).toHaveBeenCalledWith(999);
  });

  test("DELETE /admin/users/:id -> 204 succès", async () => {
    mockCountAdmins.mockResolvedValueOnce(2);
    mockDeleteAdminById.mockResolvedValueOnce(1);

    const app = makeApp();
    const res = await request(app).delete("/admin/users/2");

    expect(res.status).toBe(204);
    expect(res.text).toBe("");
    expect(mockCountAdmins).toHaveBeenCalledTimes(1);
    expect(mockDeleteAdminById).toHaveBeenCalledTimes(1);
    expect(mockDeleteAdminById).toHaveBeenCalledWith(2);
  });

  test("DELETE /admin/users/:id -> 500 si erreur repository sur countAdmins", async () => {
    mockCountAdmins.mockRejectedValueOnce(new Error("DB down"));

    const app = makeApp();
    const res = await request(app).delete("/admin/users/2");

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ message: "Erreur serveur" });
  });

  test("DELETE /admin/users/:id -> 500 si deleteAdminById échoue", async () => {
    mockCountAdmins.mockResolvedValueOnce(2);
    mockDeleteAdminById.mockRejectedValueOnce(new Error("DB down"));

    const app = makeApp();
    const res = await request(app).delete("/admin/users/2");

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ message: "Erreur serveur" });
  });

  /**
   * ================================================================
   * Middleware requireAdmin
   * ================================================================
   */
  test("toutes les routes -> 401 si requireAdmin bloque", async () => {
    mockRequireAdmin.mockImplementation((req, res) => {
      return res.status(401).json({ message: "Non autorisé" });
    });

    const app = makeApp();
    const res = await request(app).get("/admin/users");

    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Non autorisé");
  });
});