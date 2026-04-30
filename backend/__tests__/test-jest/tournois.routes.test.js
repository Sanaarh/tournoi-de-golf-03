/**
 * =============================================================================
 * TESTS — routes/tournois.routes.js
 * =============================================================================
 */

import { describe, test, expect, beforeEach, jest } from "@jest/globals";
import request from "supertest";

/**
 * Mock requireAdmin
 */
jest.unstable_mockModule("../../middlewares/requireAdmin.js", () => ({
  default: (req, res, next) => {
    req.admin = { id: 1 };
    next();
  },
}));

/**
 * Mock repository Tournoi
 */
const mockListTournois = jest.fn();
const mockFindTournoiById = jest.fn();
const mockExistsTournoiByNom = jest.fn();
const mockCreateTournoi = jest.fn();
const mockUpdateTournoi = jest.fn();
const mockDeleteTournoi = jest.fn();
const mockFindActiveTournoi = jest.fn(); 
const mockCountPlacesCommanditesPayeesByTournoi = jest.fn();

jest.unstable_mockModule("../../dal/tournoi.repository.js", () => ({
  listTournois: mockListTournois,
  findTournoiById: mockFindTournoiById,
  existsTournoiByNom: mockExistsTournoiByNom,
  createTournoi: mockCreateTournoi,
  updateTournoi: mockUpdateTournoi,
  deleteTournoi: mockDeleteTournoi,
  findActiveTournoi: mockFindActiveTournoi, 
  countPlacesCommanditesPayeesByTournoi: mockCountPlacesCommanditesPayeesByTournoi,
}));

/**
 * Import app après mocks
 */
const { default: app } = await import("../../server.js");

/**
 * Reset mocks
 */
beforeEach(() => {
  jest.clearAllMocks();
});

/**
 * Payload VALIDE (très important)
 */
const validBody = {
  nom: "Tournoi Test",
  lieu: "Ottawa",

  date_tournoi: "2026-06-20",

  inscription_debut: "2026-05-01",
  inscription_fin: "2026-05-30",

  inscriptions_ouvertes: false,

  capacite_joueurs: 16,
  limite_commandites: 4,
  prix_joueur: 50,
};

describe("routes/tournois.routes.js", () => {

  /* ========================================================= */
  /* POST /admin/tournois */
  /* ========================================================= */

  describe("POST /admin/tournois", () => {

    test("retourne 400 si validation échoue", async () => {

      const res = await request(app)
        .post("/admin/tournois")
        .send({
          ...validBody,
          nom: "",
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Validation impossible");
      expect(res.body.errors).toBeDefined();

      expect(mockExistsTournoiByNom).not.toHaveBeenCalled();
      expect(mockCreateTournoi).not.toHaveBeenCalled();
    });

    test("retourne 409 si un tournoi du même nom existe déjà", async () => {

      mockExistsTournoiByNom.mockResolvedValue(true);
      mockCountPlacesCommanditesPayeesByTournoi.mockResolvedValue(0);

      const res = await request(app)
        .post("/admin/tournois")
        .send(validBody);

      expect(res.status).toBe(409);

      expect(res.body).toEqual({
        message: "Validation impossible",
        errors: { nom: "Un tournoi avec ce nom existe déjà." },
      });

      expect(mockCreateTournoi).not.toHaveBeenCalled();
    });

    test("retourne 201 si création réussie", async () => {

      mockExistsTournoiByNom.mockResolvedValue(false);
      mockCountPlacesCommanditesPayeesByTournoi.mockResolvedValue(0);

      mockCreateTournoi.mockResolvedValue({
        id: 10,
      });

      const res = await request(app)
        .post("/admin/tournois")
        .send(validBody);

      expect(res.status).toBe(201);
      expect(res.body.id).toBe(10);

      expect(mockCreateTournoi).toHaveBeenCalledTimes(1);
    });

    test("retourne 500 si erreur serveur", async () => {

      mockExistsTournoiByNom.mockResolvedValue(false);
      mockCountPlacesCommanditesPayeesByTournoi.mockResolvedValue(0);

      mockCreateTournoi.mockRejectedValue(
        new Error("violates constraint xyz")
      );

      const res = await request(app)
        .post("/admin/tournois")
        .send(validBody);

      expect(res.status).toBe(500);

      expect(res.body).toEqual({
        message: "Erreur serveur",
        detail: "violates constraint xyz",
      });
    });

  });

  /* ========================================================= */
  /* PUT /admin/tournois/:id */
  /* ========================================================= */

  describe("PUT /admin/tournois/:id", () => {

    test("retourne 400 si validation échoue", async () => {

      const res = await request(app)
        .put("/admin/tournois/3")
        .send({
          ...validBody,
          nom: "",
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Validation impossible");
      expect(res.body.errors).toBeDefined();

      expect(mockUpdateTournoi).not.toHaveBeenCalled();
    });

    test("retourne 409 si nom déjà utilisé", async () => {

      mockExistsTournoiByNom.mockResolvedValue(true);

      const res = await request(app)
        .put("/admin/tournois/3")
        .send({
          ...validBody,
          nom: "Tournoi Modifié",
        });

      expect(res.status).toBe(409);

      expect(res.body).toEqual({
        message: "Validation impossible",
        errors: { nom: "Un tournoi avec ce nom existe déjà." },
      });

      expect(mockUpdateTournoi).not.toHaveBeenCalled();
    });

    test("retourne 404 si tournoi introuvable", async () => {

      mockExistsTournoiByNom.mockResolvedValue(false);
      mockCountPlacesCommanditesPayeesByTournoi.mockResolvedValue(0);

      mockUpdateTournoi.mockResolvedValue(null);

      const res = await request(app)
        .put("/admin/tournois/99")
        .send(validBody);

      expect(res.status).toBe(404);

      expect(res.body).toEqual({
        message: "Tournoi introuvable",
      });
    });

    test("retourne 200 si modification réussie", async () => {

      mockExistsTournoiByNom.mockResolvedValue(false);
      mockCountPlacesCommanditesPayeesByTournoi.mockResolvedValue(0);

      mockUpdateTournoi.mockResolvedValue({
        id: 3,
      });

      const res = await request(app)
        .put("/admin/tournois/3")
        .send(validBody);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(3);

      expect(mockUpdateTournoi).toHaveBeenCalledTimes(1);
    });

    test("retourne 500 si erreur serveur", async () => {

      mockExistsTournoiByNom.mockResolvedValue(false);

      mockUpdateTournoi.mockRejectedValue(
        new Error("update detail")
      );

      const res = await request(app)
        .put("/admin/tournois/3")
        .send(validBody);

      expect(res.status).toBe(500);

      expect(res.body).toEqual({
        message: "Erreur serveur",
        detail: "update detail",
      });
    });

    test("retourne 409 si limite_commandites descend sous les places deja utilisees", async () => {
      mockExistsTournoiByNom.mockResolvedValue(false);
      mockCountPlacesCommanditesPayeesByTournoi.mockResolvedValue(8);

      const res = await request(app)
        .put("/admin/tournois/3")
        .send({
          ...validBody,
          limite_commandites: 7,
        });

      expect(res.status).toBe(409);
      expect(res.body.message).toBe("Validation impossible");
      expect(res.body.errors?.limite_commandites).toContain("Impossible de réduire le quota commandites");
      expect(mockUpdateTournoi).not.toHaveBeenCalled();
    });

  });

});