/**
 * =============================================================================
 * TEST — requireAdmin middleware
 * =============================================================================
 *
 * Fichier testé :
 * middlewares/requireAdmin.js
 *
 * Objectif :
 * Vérifier que le middleware protège correctement les routes admin.
 *
 * Cas testés :
 * 1) Aucun cookie → 401 Non connecté
 * 2) Cookie invalide → 401 Session invalide
 * 3) Admin inexistant → 401 Session invalide
 * 4) Admin valide → next() appelé
 * 5) Erreur serveur → 500 Erreur serveur
 */

import { describe, test, expect, jest, beforeEach } from "@jest/globals";

/**
 * Mock du repository admin
 */
const mockFindAdminById = jest.fn();

/**
 * Mock du module admin.repository.js
 */
jest.unstable_mockModule(
  "../../dal/admin.repository.js",
  () => ({
    findAdminById: mockFindAdminById,
  })
);

/**
 * Import du middleware après mock
 */
const requireAdmin =
  (await import("../../middlewares/requireAdmin.js")).default;

/**
 * Reset des mocks avant chaque test
 */
beforeEach(() => {
  jest.clearAllMocks();
});

/* =============================================================================
   Tests requireAdmin
============================================================================= */

describe("Middleware requireAdmin", () => {

  /**
   * --------------------------------------------------------------------------
   * Cas 1 — Aucun cookie
   * --------------------------------------------------------------------------
   */
  test("retourne 401 si aucun cookie", async () => {

    const req = {
      cookies: {},
    };

    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    const next = jest.fn();

    await requireAdmin(req, res, next);

    expect(res.status)
      .toHaveBeenCalledWith(401);

    expect(res.json)
      .toHaveBeenCalledWith({
        message: "Non connecté",
      });

    expect(next)
      .not.toHaveBeenCalled();
  });

  /**
   * --------------------------------------------------------------------------
   * Cas 2 — Cookie invalide
   * --------------------------------------------------------------------------
   */
  test("retourne 401 si cookie invalide", async () => {

    const req = {
      cookies: {
        admin_id: "abc",
      },
    };

    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    const next = jest.fn();

    await requireAdmin(req, res, next);

    expect(res.status)
      .toHaveBeenCalledWith(401);

    expect(res.json)
      .toHaveBeenCalledWith({
        message: "Session invalide",
      });

    expect(next)
      .not.toHaveBeenCalled();
  });

  /**
   * --------------------------------------------------------------------------
   * Cas 3 — Admin inexistant en base
   * --------------------------------------------------------------------------
   */
  test("retourne 401 si admin introuvable", async () => {

    mockFindAdminById
      .mockResolvedValueOnce(null);

    const req = {
      cookies: {
        admin_id: "1",
      },
    };

    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    const next = jest.fn();

    await requireAdmin(req, res, next);

    expect(mockFindAdminById)
      .toHaveBeenCalledWith(1);

    expect(res.status)
      .toHaveBeenCalledWith(401);

    expect(res.json)
      .toHaveBeenCalledWith({
        message: "Session invalide",
      });

    expect(next)
      .not.toHaveBeenCalled();
  });

  /**
   * --------------------------------------------------------------------------
   * Cas 4 — Admin valide
   * --------------------------------------------------------------------------
   */
  test("autorise la requête si admin valide", async () => {

    mockFindAdminById
      .mockResolvedValueOnce({
        id: 1,
        nom_utilisateur: "admin",
      });

    const req = {
      cookies: {
        admin_id: "1",
      },
    };

    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    const next = jest.fn();

    await requireAdmin(req, res, next);

    /**
     * Vérifie que l'admin est attaché à req
     */
    expect(req.admin).toEqual({
      id: 1,
      nom_utilisateur: "admin",
    });

    expect(req.adminId)
      .toBe(1);

    /**
     * Vérifie que next() est appelé
     */
    expect(next)
      .toHaveBeenCalled();
  });

  /**
   * --------------------------------------------------------------------------
   * Cas 5 — Erreur serveur
   * --------------------------------------------------------------------------
   */
  test("retourne 500 si erreur serveur", async () => {

    mockFindAdminById
      .mockRejectedValueOnce(
        new Error("Erreur DB")
      );

    const req = {
      cookies: {
        admin_id: "1",
      },
    };

    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    const next = jest.fn();

    await requireAdmin(req, res, next);

    expect(res.status)
      .toHaveBeenCalledWith(500);

    expect(res.json)
      .toHaveBeenCalledWith({
        message: "Erreur serveur",
      });
  });

});