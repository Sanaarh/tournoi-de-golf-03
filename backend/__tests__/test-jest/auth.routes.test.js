/**
 * --------------------------------------------------------------------
 * Tests des routes d'authentification (auth.routes.js)
 * --------------------------------------------------------------------
 *
 * Fichier testé :
 * - routes/auth.routes.js
 *
 * Objectif :
 * Vérifier le bon fonctionnement du système
 * d'authentification des administrateurs :
 * - connexion
 * - vérification de session
 * - déconnexion
 *
 * Routes couvertes :
 * - POST /auth/login
 * - GET  /auth/me
 * - POST /auth/logout
 *
 * Comportements testés :
 *
 * POST /auth/login
 * - 400 si champs manquants
 * - 401 si utilisateur introuvable
 * - 401 si mot de passe invalide
 * - 200 si connexion valide
 * - 500 si erreur serveur
 *
 * GET /auth/me
 * - 401 si aucun cookie
 * - 401 si cookie invalide
 * - 401 si admin introuvable
 * - 200 si session valide
 * - 500 si erreur serveur
 *
 * POST /auth/logout
 * - 200 si cookie supprimé correctement
 *
 * Outils utilisés :
 * - Jest pour les tests unitaires
 * - Supertest pour simuler les requêtes HTTP
 * - cookie-parser pour gérer les cookies
 *
 * Mocks utilisés :
 * - Repository admin
 * - bcrypt.compare
 *
 * Particularités vérifiées :
 * - création correcte du cookie admin_id
 * - suppression du cookie lors du logout
 * - absence d'exposition du mot de passe hashé
 * --------------------------------------------------------------------
 */

import { jest } from "@jest/globals";
import express from "express";
import request from "supertest";
import cookieParser from "cookie-parser";

/**
 * --------------------------------------------------------------------
 * Mocks du repository admin
 * --------------------------------------------------------------------
 */
const mockFindAdminByUsername = jest.fn();
const mockFindAdminById = jest.fn();

await jest.unstable_mockModule("../../dal/admin.repository.js", () => ({
  findAdminByUsername: (...args) => mockFindAdminByUsername(...args),
  findAdminById: (...args) => mockFindAdminById(...args),
}));

/**
 * --------------------------------------------------------------------
 * Mock bcrypt
 * --------------------------------------------------------------------
 */
const mockBcryptCompare = jest.fn(async () => true);

await jest.unstable_mockModule("bcrypt", () => ({
  default: {
    compare: (...args) => mockBcryptCompare(...args),
  },
}));

const { default: authRouter } = await import("../../routes/auth.routes.js");

/**
 * --------------------------------------------------------------------
 * Helper : crée une mini app Express de test
 * --------------------------------------------------------------------
 */
function makeApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use("/auth", authRouter);
  return app;
}

describe("auth.routes.js (/auth)", () => {
  let consoleErrorSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  /**
   * ================================================================
   * POST /auth/login
   * ================================================================
   */
  test("POST /auth/login -> 400 champs manquants", async () => {
    const app = makeApp();

    const res = await request(app).post("/auth/login").send({
      nom_utilisateur: "admin1",
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/requis/i);
    expect(mockFindAdminByUsername).not.toHaveBeenCalled();
  });

  test("POST /auth/login -> trim du nom utilisateur", async () => {
    mockFindAdminByUsername.mockResolvedValueOnce({
      id: 5,
      nom_utilisateur: "admin5",
      mot_de_passe_hash: "HASH_DB",
    });

    mockBcryptCompare.mockResolvedValueOnce(true);

    const app = makeApp();

    const res = await request(app).post("/auth/login").send({
      nom_utilisateur: "   admin5   ",
      mot_de_passe: "Admin123!",
    });

    expect(res.status).toBe(200);
    expect(mockFindAdminByUsername).toHaveBeenCalledWith("admin5");
  });

  test("POST /auth/login -> 401 si user introuvable", async () => {
    mockFindAdminByUsername.mockResolvedValueOnce(null);

    const app = makeApp();
    const res = await request(app).post("/auth/login").send({
      nom_utilisateur: "nope",
      mot_de_passe: "Admin123!",
    });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ message: "Identifiants invalides" });
    expect(mockFindAdminByUsername).toHaveBeenCalledTimes(1);
    expect(mockFindAdminByUsername).toHaveBeenCalledWith("nope");
    expect(mockBcryptCompare).not.toHaveBeenCalled();
  });

  test("POST /auth/login -> 401 si mauvais mot de passe", async () => {
    mockFindAdminByUsername.mockResolvedValueOnce({
      id: 1,
      nom_utilisateur: "admin1",
      mot_de_passe_hash: "HASH_DB",
      date_creation: "2026-02-25T00:00:00.000Z",
    });
    mockBcryptCompare.mockResolvedValueOnce(false);

    const app = makeApp();
    const res = await request(app).post("/auth/login").send({
      nom_utilisateur: "admin1",
      mot_de_passe: "Wrong123!",
    });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ message: "Identifiants invalides" });
    expect(mockBcryptCompare).toHaveBeenCalledTimes(1);
    expect(mockBcryptCompare).toHaveBeenCalledWith("Wrong123!", "HASH_DB");
    expect(res.headers["set-cookie"]).toBeUndefined();
  });

  test("POST /auth/login -> 200 + set-cookie + admin (sans hash)", async () => {
    mockFindAdminByUsername.mockResolvedValueOnce({
      id: 7,
      nom_utilisateur: "admin7",
      mot_de_passe_hash: "HASH_DB",
      date_creation: "2026-02-25T00:00:00.000Z",
    });
    mockBcryptCompare.mockResolvedValueOnce(true);

    const app = makeApp();
    const res = await request(app).post("/auth/login").send({
      nom_utilisateur: "admin7",
      mot_de_passe: "Admin123!",
    });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      message: "Connecté",
      admin: { id: 7, nom_utilisateur: "admin7" },
    });

    const setCookie = res.headers["set-cookie"];
    expect(setCookie).toBeDefined();
    expect(setCookie.join(";")).toMatch(/admin_id=7/);
    expect(setCookie.join(";")).toMatch(/HttpOnly/i);
    expect(setCookie.join(";")).toMatch(/Max-Age=3600/i);
  });

  test("POST /auth/login -> 500 erreur serveur", async () => {
    mockFindAdminByUsername.mockRejectedValueOnce(new Error("DB down"));

    const app = makeApp();
    const res = await request(app).post("/auth/login").send({
      nom_utilisateur: "admin1",
      mot_de_passe: "Admin123!",
    });

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ message: "Erreur serveur" });
  });

  /**
   * ================================================================
   * GET /auth/me
   * ================================================================
   */
  test("GET /auth/me -> 401 si pas de cookie", async () => {
    const app = makeApp();
    const res = await request(app).get("/auth/me");

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ message: "Non connecté" });
    expect(mockFindAdminById).not.toHaveBeenCalled();
  });

  test("GET /auth/me -> 401 si cookie invalide", async () => {
    const app = makeApp();
    const res = await request(app)
      .get("/auth/me")
      .set("Cookie", ["admin_id=abc"]);

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ message: "Non connecté" });
    expect(mockFindAdminById).not.toHaveBeenCalled();
  });

  test("GET /auth/me -> 401 si cookie négatif", async () => {
    const app = makeApp();

    const res = await request(app)
      .get("/auth/me")
      .set("Cookie", ["admin_id=-1"]);

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ message: "Non connecté" });
    expect(mockFindAdminById).not.toHaveBeenCalled();
  });

  test("GET /auth/me -> 401 si admin introuvable", async () => {
    mockFindAdminById.mockResolvedValueOnce(null);

    const app = makeApp();
    const res = await request(app)
      .get("/auth/me")
      .set("Cookie", ["admin_id=999"]);

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ message: "Non connecté" });
    expect(mockFindAdminById).toHaveBeenCalledTimes(1);
    expect(mockFindAdminById).toHaveBeenCalledWith(999);
  });

  test("GET /auth/me -> 200 retourne admin", async () => {
    mockFindAdminById.mockResolvedValueOnce({
      id: 7,
      nom_utilisateur: "admin7",
      date_creation: "2026-02-25T00:00:00.000Z",
    });

    const app = makeApp();
    const res = await request(app)
      .get("/auth/me")
      .set("Cookie", ["admin_id=7"]);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      admin: {
        id: 7,
        nom_utilisateur: "admin7",
        date_creation: "2026-02-25T00:00:00.000Z",
      },
    });
  });

  test("GET /auth/me -> 500 erreur serveur", async () => {
    mockFindAdminById.mockRejectedValueOnce(new Error("DB down"));

    const app = makeApp();
    const res = await request(app)
      .get("/auth/me")
      .set("Cookie", ["admin_id=7"]);

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ message: "Erreur serveur" });
  });

  /**
   * ================================================================
   * POST /auth/logout
   * ================================================================
   */
  test("POST /auth/logout -> 200 + clear cookie", async () => {
    const app = makeApp();
    const res = await request(app)
      .post("/auth/logout")
      .set("Cookie", ["admin_id=7"]);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: "Déconnecté" });

    const setCookie = res.headers["set-cookie"];
    expect(setCookie).toBeDefined();
    expect(setCookie.join(";")).toMatch(/admin_id=/);
  });
});