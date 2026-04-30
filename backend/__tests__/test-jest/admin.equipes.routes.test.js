
/**
 * --------------------------------------------------------------------
 * Tests du routeur d'administration des équipes
 * --------------------------------------------------------------------
 *
 * Fichier testé :
 * - routes/admin.equipes.routes.js
 *
 * Objectif :
 * - vérifier le comportement HTTP de toutes les routes admin liées
 *   à la gestion des équipes, des membres, des participants et des
 *   joueurs commandités
 * - s'assurer que chaque route retourne le bon code HTTP et le bon
 *   message selon les différents scénarios métier
 *
 * Outils utilisés :
 * - Jest : framework de test
 * - Supertest : simulation de requêtes HTTP sur une app Express
 * - Express : création d'une application de test minimale
 *
 * Stratégie de test :
 * - le middleware `requireAdmin` est mocké pour autoriser l'accès
 *   sans dépendre d'une vraie authentification
 * - toutes les fonctions du repository sont mockées afin de :
 *   - isoler la logique du routeur
 *   - éviter tout accès réel à la base de données
 *   - contrôler précisément les réponses simulées
 *
 * Ce fichier couvre notamment :
 * - GET    /admin/participants
 * - GET    /admin/equipes
 * - POST   /admin/equipes
 * - GET    /admin/equipes/:id
 * - PUT    /admin/equipes/:id
 * - DELETE /admin/equipes/:id
 * - GET    /admin/equipes/:id/membres
 * - POST   /admin/equipes/:id/membres
 * - POST   /admin/equipes/:id/membres/nouveau
 * - DELETE /admin/equipes/:id/membres/:participantId
 * - PATCH  /admin/participants/:id
 * - POST   /admin/equipes/:id/membres/:participantId/deplacer
 * - GET    /admin/joueurs-commandites
 * - PATCH  /admin/joueurs-commandites/:id
 * - DELETE /admin/joueurs-commandites/:id
 * - POST   /admin/joueurs-commandites/:id/assigner-equipe
 *
 * Types de scénarios vérifiés :
 * - succès (200 / 201)
 * - validation invalide (400)
 * - ressource introuvable (404)
 * - conflit métier / tournoi fermé / doublon (409)
 * - erreur serveur inattendue (500)
 *
 * Important :
 * - ce fichier ne teste pas le SQL
 * - ce fichier ne teste pas le repository lui-même
 * - ce fichier teste uniquement la logique des routes Express
 *   et la transformation des résultats métier en réponses HTTP
 * --------------------------------------------------------------------
 */

import { jest } from "@jest/globals";
import express from "express";
import request from "supertest";

const mockRequireAdmin = jest.fn((req, res, next) => next());

await jest.unstable_mockModule("../../middlewares/requireAdmin.js", () => ({
  default: (req, res, next) => mockRequireAdmin(req, res, next),
}));

const mockRepo = {
  addMembreToEquipe: jest.fn(),
  countMembresEquipe: jest.fn(),
  createEquipe: jest.fn(),
  createParticipantAndAddToEquipe: jest.fn(),
  deleteEquipeById: jest.fn(),
  existsEquipeNameInTournoi: jest.fn(),
  getAllEquipes: jest.fn(),
  getEquipeById: jest.fn(),
  getMembresByEquipeId: jest.fn(),
  getParticipantById: jest.fn(),
  isTournoiOpenByEquipeId: jest.fn(),
  isTournoiOpenById: jest.fn(),
  removeMembreFromEquipe: jest.fn(),
  searchParticipants: jest.fn(),
  updateEquipe: jest.fn(),
  listJoueursCommanditesAdmin: jest.fn(),
  updateJoueurCommanditeAdmin: jest.fn(),
  deleteJoueurCommanditeAdmin: jest.fn(),
  assignJoueurCommanditeToEquipe: jest.fn(),
  isTournoiOpenByParticipantId: jest.fn(),
  updateParticipantAdmin: jest.fn(),
  moveMembreToEquipe: jest.fn(),
};

await jest.unstable_mockModule("../../dal/admin.equipes.repository.js", () => ({
  addMembreToEquipe: (...args) => mockRepo.addMembreToEquipe(...args),
  countMembresEquipe: (...args) => mockRepo.countMembresEquipe(...args),
  createEquipe: (...args) => mockRepo.createEquipe(...args),
  createParticipantAndAddToEquipe: (...args) => mockRepo.createParticipantAndAddToEquipe(...args),
  deleteEquipeById: (...args) => mockRepo.deleteEquipeById(...args),
  existsEquipeNameInTournoi: (...args) => mockRepo.existsEquipeNameInTournoi(...args),
  getAllEquipes: (...args) => mockRepo.getAllEquipes(...args),
  getEquipeById: (...args) => mockRepo.getEquipeById(...args),
  getMembresByEquipeId: (...args) => mockRepo.getMembresByEquipeId(...args),
  getParticipantById: (...args) => mockRepo.getParticipantById(...args),
  isTournoiOpenByEquipeId: (...args) => mockRepo.isTournoiOpenByEquipeId(...args),
  isTournoiOpenById: (...args) => mockRepo.isTournoiOpenById(...args),
  removeMembreFromEquipe: (...args) => mockRepo.removeMembreFromEquipe(...args),
  searchParticipants: (...args) => mockRepo.searchParticipants(...args),
  updateEquipe: (...args) => mockRepo.updateEquipe(...args),
  listJoueursCommanditesAdmin: (...args) => mockRepo.listJoueursCommanditesAdmin(...args),
  updateJoueurCommanditeAdmin: (...args) => mockRepo.updateJoueurCommanditeAdmin(...args),
  deleteJoueurCommanditeAdmin: (...args) => mockRepo.deleteJoueurCommanditeAdmin(...args),
  assignJoueurCommanditeToEquipe: (...args) => mockRepo.assignJoueurCommanditeToEquipe(...args),
  isTournoiOpenByParticipantId: (...args) => mockRepo.isTournoiOpenByParticipantId(...args),
  updateParticipantAdmin: (...args) => mockRepo.updateParticipantAdmin(...args),
  moveMembreToEquipe: (...args) => mockRepo.moveMembreToEquipe(...args),
}));

const { default: adminEquipesRouter } = await import("../../routes/admin.equipes.routes.js");

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use("/admin", adminEquipesRouter);
  return app;
}

describe("admin.equipes.routes.js (/admin)", () => {
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

  describe("GET /admin/participants", () => {
    test("200 recherche participants avec limit par défaut", async () => {
      mockRepo.searchParticipants.mockResolvedValueOnce([{ id: 1, prenom: "Ali" }]);
      const app = makeApp();

      const res = await request(app).get("/admin/participants").query({ q: "ali" });

      expect(res.status).toBe(200);
      expect(res.body).toEqual([{ id: 1, prenom: "Ali" }]);
      expect(mockRepo.searchParticipants).toHaveBeenCalledWith("ali", 20);
    });

    test("200 recherche participants avec limit explicite", async () => {
      mockRepo.searchParticipants.mockResolvedValueOnce([]);
      const app = makeApp();

      const res = await request(app).get("/admin/participants").query({ q: "a", limit: "10" });

      expect(res.status).toBe(200);
      expect(mockRepo.searchParticipants).toHaveBeenCalledWith("a", 10);
    });

    test("500 si searchParticipants échoue", async () => {
      mockRepo.searchParticipants.mockRejectedValueOnce(new Error("db"));
      const app = makeApp();

      const res = await request(app).get("/admin/participants").query({ q: "ali" });

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ message: "Erreur serveur" });
    });
  });

  describe("GET /admin/equipes", () => {
    test("200 liste des equipes", async () => {
      mockRepo.getAllEquipes.mockResolvedValueOnce([{ id: 1, nom_equipe: "Birdies" }]);
      const app = makeApp();

      const res = await request(app).get("/admin/equipes");

      expect(res.status).toBe(200);
      expect(res.body).toEqual([{ id: 1, nom_equipe: "Birdies" }]);
      expect(mockRepo.getAllEquipes).toHaveBeenCalledTimes(1);
    });

    test("500 si getAllEquipes échoue", async () => {
      mockRepo.getAllEquipes.mockRejectedValueOnce(new Error("db"));
      const app = makeApp();

      const res = await request(app).get("/admin/equipes");

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ message: "Erreur serveur" });
    });
  });

  describe("POST /admin/equipes", () => {
    test("400 si validation échoue", async () => {
      const app = makeApp();

      const res = await request(app).post("/admin/equipes").send({});

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Validation impossible");
      expect(mockRepo.createEquipe).not.toHaveBeenCalled();
    });

    test("400 si tournoi_id invalide via isTournoiOpenById = null", async () => {
      mockRepo.isTournoiOpenById.mockResolvedValueOnce(null);
      const app = makeApp();

      const res = await request(app).post("/admin/equipes").send({
        tournoi_id: 1,
        nom_equipe: "Les Aigles",
      });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/tournoi_id invalide/i);
    });

    test("409 si tournoi fermé", async () => {
      mockRepo.isTournoiOpenById.mockResolvedValueOnce(false);
      const app = makeApp();

      const res = await request(app).post("/admin/equipes").send({
        tournoi_id: 1,
        nom_equipe: "Les Aigles",
      });

      expect(res.status).toBe(409);
      expect(res.body.message).toMatch(/tournois ouverts/i);
      expect(mockRepo.createEquipe).not.toHaveBeenCalled();
    });

    test("409 si nom dupliqué dans le tournoi", async () => {
      mockRepo.isTournoiOpenById.mockResolvedValueOnce(true);
      mockRepo.existsEquipeNameInTournoi.mockResolvedValueOnce(true);
      const app = makeApp();

      const res = await request(app).post("/admin/equipes").send({
        tournoi_id: 1,
        nom_equipe: "Les Aigles",
      });

      expect(res.status).toBe(409);
      expect(res.body.message).toMatch(/existe d[ée]j[àa]/i);
      expect(mockRepo.createEquipe).not.toHaveBeenCalled();
    });

    test("201 création succès", async () => {
      mockRepo.isTournoiOpenById.mockResolvedValueOnce(true);
      mockRepo.existsEquipeNameInTournoi.mockResolvedValueOnce(false);
      mockRepo.createEquipe.mockResolvedValueOnce({ id: 2, tournoi_id: 1, nom_equipe: "Les Albatros" });
      const app = makeApp();

      const res = await request(app).post("/admin/equipes").send({
        tournoi_id: 1,
        nom_equipe: "Les Albatros",
      });

      expect(res.status).toBe(201);
      expect(res.body.equipe.id).toBe(2);
      expect(mockRepo.createEquipe).toHaveBeenCalledWith(1, "Les Albatros");
    });

    test("400 si createEquipe lève 23503", async () => {
      const err = new Error("fk");
      err.code = "23503";
      mockRepo.isTournoiOpenById.mockResolvedValueOnce(true);
      mockRepo.existsEquipeNameInTournoi.mockResolvedValueOnce(false);
      mockRepo.createEquipe.mockRejectedValueOnce(err);
      const app = makeApp();

      const res = await request(app).post("/admin/equipes").send({
        tournoi_id: 1,
        nom_equipe: "Les Albatros",
      });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/tournoi_id invalide/i);
    });

    test("500 si createEquipe échoue autrement", async () => {
      mockRepo.isTournoiOpenById.mockResolvedValueOnce(true);
      mockRepo.existsEquipeNameInTournoi.mockResolvedValueOnce(false);
      mockRepo.createEquipe.mockRejectedValueOnce(new Error("db"));
      const app = makeApp();

      const res = await request(app).post("/admin/equipes").send({
        tournoi_id: 1,
        nom_equipe: "Les Albatros",
      });

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ message: "Erreur serveur" });
    });
  });

  describe("GET /admin/joueurs-commandites", () => {
    test("200 sans filtre", async () => {
      mockRepo.listJoueursCommanditesAdmin.mockResolvedValueOnce([]);
      const app = makeApp();

      const res = await request(app).get("/admin/joueurs-commandites");

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
      expect(mockRepo.listJoueursCommanditesAdmin).toHaveBeenCalledWith(null);
    });

    test("200 avec tournoi_id valide", async () => {
      const rows = [{ joueur_commandite_id: 1, tournoi_id: 3 }];
      mockRepo.listJoueursCommanditesAdmin.mockResolvedValueOnce(rows);
      const app = makeApp();

      const res = await request(app).get("/admin/joueurs-commandites").query({ tournoi_id: "3" });

      expect(res.status).toBe(200);
      expect(res.body).toEqual(rows);
      expect(mockRepo.listJoueursCommanditesAdmin).toHaveBeenCalledWith(3);
    });

    test("400 si tournoi_id invalide", async () => {
      const app = makeApp();

      const res = await request(app).get("/admin/joueurs-commandites").query({ tournoi_id: "abc" });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/tournoi_id invalide/i);
    });

    test("400 si tournoi_id = 0", async () => {
      const app = makeApp();

      const res = await request(app).get("/admin/joueurs-commandites").query({ tournoi_id: "0" });

      expect(res.status).toBe(400);
    });

    test("500 si listJoueursCommanditesAdmin échoue", async () => {
      mockRepo.listJoueursCommanditesAdmin.mockRejectedValueOnce(new Error("db"));
      const app = makeApp();

      const res = await request(app).get("/admin/joueurs-commandites");

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ message: "Erreur serveur" });
    });
  });

  describe("PATCH /admin/joueurs-commandites/:id", () => {
    test("400 si prenom manquant", async () => {
      const app = makeApp();

      const res = await request(app).patch("/admin/joueurs-commandites/1").send({ nom: "X" });

      expect(res.status).toBe(400);
      expect(mockRepo.updateJoueurCommanditeAdmin).not.toHaveBeenCalled();
    });

    test("400 si nom manquant", async () => {
      const app = makeApp();

      const res = await request(app).patch("/admin/joueurs-commandites/1").send({ prenom: "A" });

      expect(res.status).toBe(400);
    });

    test("400 si id invalide", async () => {
      const app = makeApp();

      const res = await request(app).patch("/admin/joueurs-commandites/0").send({ prenom: "A", nom: "B" });

      expect(res.status).toBe(400);
    });

    test("200 succès", async () => {
      mockRepo.updateJoueurCommanditeAdmin.mockResolvedValueOnce({ ok: true });
      const app = makeApp();

      const res = await request(app).patch("/admin/joueurs-commandites/5").send({ prenom: "A", nom: "B" });

      expect(res.status).toBe(200);
      expect(mockRepo.updateJoueurCommanditeAdmin).toHaveBeenCalledWith(5, { prenom: "A", nom: "B" });
    });

    test("404 introuvable", async () => {
      mockRepo.updateJoueurCommanditeAdmin.mockResolvedValueOnce({ ok: false, code: "NOT_FOUND" });
      const app = makeApp();

      const res = await request(app).patch("/admin/joueurs-commandites/99").send({ prenom: "A", nom: "B" });

      expect(res.status).toBe(404);
    });

    test("409 tournoi fermé", async () => {
      mockRepo.updateJoueurCommanditeAdmin.mockResolvedValueOnce({ ok: false, code: "TOURNOI_FERME" });
      const app = makeApp();

      const res = await request(app).patch("/admin/joueurs-commandites/2").send({ prenom: "A", nom: "B" });

      expect(res.status).toBe(409);
    });

    test("400 pour code inconnu", async () => {
      mockRepo.updateJoueurCommanditeAdmin.mockResolvedValueOnce({ ok: false, code: "OTHER" });
      const app = makeApp();

      const res = await request(app).patch("/admin/joueurs-commandites/2").send({ prenom: "A", nom: "B" });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/mise à jour impossible/i);
    });

    test("500 si updateJoueurCommanditeAdmin échoue", async () => {
      mockRepo.updateJoueurCommanditeAdmin.mockRejectedValueOnce(new Error("db"));
      const app = makeApp();

      const res = await request(app).patch("/admin/joueurs-commandites/2").send({ prenom: "A", nom: "B" });

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ message: "Erreur serveur" });
    });
  });

  describe("DELETE /admin/joueurs-commandites/:id", () => {
    test("400 si id invalide", async () => {
      const app = makeApp();

      const res = await request(app).delete("/admin/joueurs-commandites/abc");

      expect(res.status).toBe(400);
    });

    test("200 succès", async () => {
      mockRepo.deleteJoueurCommanditeAdmin.mockResolvedValueOnce({ ok: true });
      const app = makeApp();

      const res = await request(app).delete("/admin/joueurs-commandites/3");

      expect(res.status).toBe(200);
      expect(mockRepo.deleteJoueurCommanditeAdmin).toHaveBeenCalledWith(3);
    });

    test("404 introuvable", async () => {
      mockRepo.deleteJoueurCommanditeAdmin.mockResolvedValueOnce({ ok: false, code: "NOT_FOUND" });
      const app = makeApp();

      const res = await request(app).delete("/admin/joueurs-commandites/404");

      expect(res.status).toBe(404);
    });

    test("409 tournoi fermé", async () => {
      mockRepo.deleteJoueurCommanditeAdmin.mockResolvedValueOnce({ ok: false, code: "TOURNOI_FERME" });
      const app = makeApp();

      const res = await request(app).delete("/admin/joueurs-commandites/2");

      expect(res.status).toBe(409);
    });

    test("400 pour code inconnu", async () => {
      mockRepo.deleteJoueurCommanditeAdmin.mockResolvedValueOnce({ ok: false, code: "OTHER" });
      const app = makeApp();

      const res = await request(app).delete("/admin/joueurs-commandites/2");

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/suppression impossible/i);
    });

    test("500 si deleteJoueurCommanditeAdmin échoue", async () => {
      mockRepo.deleteJoueurCommanditeAdmin.mockRejectedValueOnce(new Error("db"));
      const app = makeApp();

      const res = await request(app).delete("/admin/joueurs-commandites/2");

      expect(res.status).toBe(500);
    });
  });

  describe("POST /admin/joueurs-commandites/:id/assigner-equipe", () => {
    test("400 si equipe_id manquant", async () => {
      const app = makeApp();

      const res = await request(app).post("/admin/joueurs-commandites/9/assigner-equipe").send({});

      expect(res.status).toBe(400);
      expect(mockRepo.assignJoueurCommanditeToEquipe).not.toHaveBeenCalled();
    });

    test("400 si id joueur invalide", async () => {
      const app = makeApp();

      const res = await request(app).post("/admin/joueurs-commandites/0/assigner-equipe").send({ equipe_id: 2 });

      expect(res.status).toBe(400);
    });

    test("409 équipe pleine", async () => {
      mockRepo.assignJoueurCommanditeToEquipe.mockResolvedValueOnce({ ok: false, code: "EQUIPE_PLEINE" });
      const app = makeApp();

      const res = await request(app).post("/admin/joueurs-commandites/9/assigner-equipe").send({ equipe_id: 2 });

      expect(res.status).toBe(409);
    });

    test("200 créé", async () => {
      mockRepo.assignJoueurCommanditeToEquipe.mockResolvedValueOnce({
        ok: true,
        code: "CREATED",
        participant_id: 100,
        equipe_id: 2,
      });
      const app = makeApp();

      const res = await request(app).post("/admin/joueurs-commandites/9/assigner-equipe").send({ equipe_id: 2 });

      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/affecté/i);
      expect(res.body.participant_id).toBe(100);
      expect(res.body.equipe_id).toBe(2);
    });

    test("200 déplacé", async () => {
      mockRepo.assignJoueurCommanditeToEquipe.mockResolvedValueOnce({
        ok: true,
        code: "MOVED",
        participant_id: 50,
        equipe_id: 3,
      });
      const app = makeApp();

      const res = await request(app).post("/admin/joueurs-commandites/8/assigner-equipe").send({ equipe_id: 3 });

      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/déplacé/i);
    });

    test("200 noop", async () => {
      mockRepo.assignJoueurCommanditeToEquipe.mockResolvedValueOnce({
        ok: true,
        code: "NOOP",
        participant_id: 50,
        equipe_id: 2,
      });
      const app = makeApp();

      const res = await request(app).post("/admin/joueurs-commandites/8/assigner-equipe").send({ equipe_id: 2 });

      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/déjà dans cette équipe/i);
    });

    test.each([
      ["NOT_FOUND", 404],
      ["BAD_INPUT", 400],
      ["EQUIPE_NOT_FOUND", 404],
      ["TOURNOI_MISMATCH", 400],
      ["TOURNOI_FERME", 409],
      ["COURRIEL_CONFLIT", 409],
      ["DEJA_EQUIPE", 409],
    ])("mappe %s correctement", async (code, status) => {
      mockRepo.assignJoueurCommanditeToEquipe.mockResolvedValueOnce({ ok: false, code });
      const app = makeApp();

      const res = await request(app).post("/admin/joueurs-commandites/5/assigner-equipe").send({ equipe_id: 1 });

      expect(res.status).toBe(status);
    });

    test("400 pour code dépôt inconnu", async () => {
      mockRepo.assignJoueurCommanditeToEquipe.mockResolvedValueOnce({ ok: false, code: "UNKNOWN_CODE" });
      const app = makeApp();

      const res = await request(app).post("/admin/joueurs-commandites/5/assigner-equipe").send({ equipe_id: 1 });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/affectation impossible/i);
    });

    test("500 si assignJoueurCommanditeToEquipe échoue", async () => {
      mockRepo.assignJoueurCommanditeToEquipe.mockRejectedValueOnce(new Error("db"));
      const app = makeApp();

      const res = await request(app).post("/admin/joueurs-commandites/5/assigner-equipe").send({ equipe_id: 1 });

      expect(res.status).toBe(500);
    });
  });

  describe("GET /admin/equipes/:id", () => {
    test("404 si introuvable", async () => {
      mockRepo.getEquipeById.mockResolvedValueOnce(null);
      const app = makeApp();

      const res = await request(app).get("/admin/equipes/999");

      expect(res.status).toBe(404);
      expect(res.body.message).toMatch(/introuvable/i);
    });

    test("200 si équipe trouvée", async () => {
      mockRepo.getEquipeById.mockResolvedValueOnce({ id: 1, nom_equipe: "Birdies" });
      const app = makeApp();

      const res = await request(app).get("/admin/equipes/1");

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ id: 1, nom_equipe: "Birdies" });
    });

    test("500 si getEquipeById échoue", async () => {
      mockRepo.getEquipeById.mockRejectedValueOnce(new Error("db"));
      const app = makeApp();

      const res = await request(app).get("/admin/equipes/1");

      expect(res.status).toBe(500);
    });
  });

  describe("DELETE /admin/equipes/:id", () => {
    test("400 si id invalide", async () => {
      const app = makeApp();

      const res = await request(app).delete("/admin/equipes/abc");

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/id d'équipe invalide/i);
    });

    test("404 si équipe introuvable via isTournoiOpenByEquipeId = null", async () => {
      mockRepo.isTournoiOpenByEquipeId.mockResolvedValueOnce(null);
      const app = makeApp();

      const res = await request(app).delete("/admin/equipes/1");

      expect(res.status).toBe(404);
    });

    test("409 si tournoi fermé", async () => {
      mockRepo.isTournoiOpenByEquipeId.mockResolvedValueOnce(false);
      const app = makeApp();

      const res = await request(app).delete("/admin/equipes/1");

      expect(res.status).toBe(409);
    });

    test("404 si deleteEquipeById retourne false", async () => {
      mockRepo.isTournoiOpenByEquipeId.mockResolvedValueOnce(true);
      mockRepo.deleteEquipeById.mockResolvedValueOnce(false);
      const app = makeApp();

      const res = await request(app).delete("/admin/equipes/1");

      expect(res.status).toBe(404);
    });

    test("200 succès", async () => {
      mockRepo.isTournoiOpenByEquipeId.mockResolvedValueOnce(true);
      mockRepo.deleteEquipeById.mockResolvedValueOnce({ id: 1, nom_equipe: "Equipe X" });
      const app = makeApp();

      const res = await request(app).delete("/admin/equipes/1");

      expect(res.status).toBe(200);
      expect(res.body.equipe.id).toBe(1);
    });

    test("500 si deleteEquipeById échoue", async () => {
      mockRepo.isTournoiOpenByEquipeId.mockResolvedValueOnce(true);
      mockRepo.deleteEquipeById.mockRejectedValueOnce(new Error("db"));
      const app = makeApp();

      const res = await request(app).delete("/admin/equipes/1");

      expect(res.status).toBe(500);
    });
  });

  describe("GET /admin/equipes/:id/membres", () => {
    test("200 liste membres", async () => {
      mockRepo.getMembresByEquipeId.mockResolvedValueOnce([
        { id: 12, prenom: "Sam", nom: "Lee", courriel: "sam@x.com" },
      ]);
      const app = makeApp();

      const res = await request(app).get("/admin/equipes/1/membres");

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(mockRepo.getMembresByEquipeId).toHaveBeenCalledWith("1");
    });

    test("500 si getMembresByEquipeId échoue", async () => {
      mockRepo.getMembresByEquipeId.mockRejectedValueOnce(new Error("db"));
      const app = makeApp();

      const res = await request(app).get("/admin/equipes/1/membres");

      expect(res.status).toBe(500);
    });
  });

  describe("POST /admin/equipes/:id/membres", () => {
    test("400 si validation échoue", async () => {
      const app = makeApp();

      const res = await request(app).post("/admin/equipes/1/membres").send({});

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Validation impossible");
    });

    test("404 si équipe introuvable via isTournoiOpenByEquipeId = null", async () => {
      mockRepo.isTournoiOpenByEquipeId.mockResolvedValueOnce(null);
      const app = makeApp();

      const res = await request(app).post("/admin/equipes/1/membres").send({ participant_id: 77 });

      expect(res.status).toBe(404);
    });

    test("409 si tournoi fermé", async () => {
      mockRepo.isTournoiOpenByEquipeId.mockResolvedValueOnce(false);
      const app = makeApp();

      const res = await request(app).post("/admin/equipes/1/membres").send({ participant_id: 77 });

      expect(res.status).toBe(409);
    });

    test("404 si getEquipeById retourne null", async () => {
      mockRepo.isTournoiOpenByEquipeId.mockResolvedValueOnce(true);
      mockRepo.getEquipeById.mockResolvedValueOnce(null);
      const app = makeApp();

      const res = await request(app).post("/admin/equipes/1/membres").send({ participant_id: 77 });

      expect(res.status).toBe(404);
    });

    test("404 si participant introuvable", async () => {
      mockRepo.isTournoiOpenByEquipeId.mockResolvedValueOnce(true);
      mockRepo.getEquipeById.mockResolvedValueOnce({ id: 1, tournoi_id: 2 });
      mockRepo.getParticipantById.mockResolvedValueOnce(null);
      const app = makeApp();

      const res = await request(app).post("/admin/equipes/1/membres").send({ participant_id: 77 });

      expect(res.status).toBe(404);
    });

    test("400 si participant autre tournoi", async () => {
      mockRepo.isTournoiOpenByEquipeId.mockResolvedValueOnce(true);
      mockRepo.getEquipeById.mockResolvedValueOnce({ id: 1, tournoi_id: 2 });
      mockRepo.getParticipantById.mockResolvedValueOnce({ id: 77, tournoi_id: 9 });
      const app = makeApp();

      const res = await request(app).post("/admin/equipes/1/membres").send({ participant_id: 77 });

      expect(res.status).toBe(400);
    });

    test("409 si équipe complète", async () => {
      mockRepo.isTournoiOpenByEquipeId.mockResolvedValueOnce(true);
      mockRepo.getEquipeById.mockResolvedValueOnce({ id: 1, tournoi_id: 2 });
      mockRepo.getParticipantById.mockResolvedValueOnce({ id: 77, tournoi_id: 2 });
      mockRepo.countMembresEquipe.mockResolvedValueOnce(4);
      const app = makeApp();

      const res = await request(app).post("/admin/equipes/1/membres").send({ participant_id: 77 });

      expect(res.status).toBe(409);
    });

    test("201 succès", async () => {
      mockRepo.isTournoiOpenByEquipeId.mockResolvedValueOnce(true);
      mockRepo.getEquipeById.mockResolvedValueOnce({ id: 1, tournoi_id: 2 });
      mockRepo.getParticipantById.mockResolvedValueOnce({ id: 77, tournoi_id: 2 });
      mockRepo.countMembresEquipe.mockResolvedValueOnce(2);
      mockRepo.addMembreToEquipe.mockResolvedValueOnce({ id: 999, equipe_id: 1, participant_id: 77 });
      const app = makeApp();

      const res = await request(app).post("/admin/equipes/1/membres").send({ participant_id: 77 });

      expect(res.status).toBe(201);
      expect(res.body.membre.participant_id).toBe(77);
    });

    test("409 si contrainte uq_participant_une_seule_equipe", async () => {
      const err = new Error("dup");
      err.constraint = "uq_participant_une_seule_equipe";
      mockRepo.isTournoiOpenByEquipeId.mockResolvedValueOnce(true);
      mockRepo.getEquipeById.mockResolvedValueOnce({ id: 1, tournoi_id: 2 });
      mockRepo.getParticipantById.mockResolvedValueOnce({ id: 77, tournoi_id: 2 });
      mockRepo.countMembresEquipe.mockResolvedValueOnce(2);
      mockRepo.addMembreToEquipe.mockRejectedValueOnce(err);
      const app = makeApp();

      const res = await request(app).post("/admin/equipes/1/membres").send({ participant_id: 77 });

      expect(res.status).toBe(409);
      expect(res.body.message).toMatch(/déjà membre d'une équipe/i);
    });

    test("409 si contrainte uq_membre_equipe", async () => {
      const err = new Error("dup");
      err.constraint = "uq_membre_equipe";
      mockRepo.isTournoiOpenByEquipeId.mockResolvedValueOnce(true);
      mockRepo.getEquipeById.mockResolvedValueOnce({ id: 1, tournoi_id: 2 });
      mockRepo.getParticipantById.mockResolvedValueOnce({ id: 77, tournoi_id: 2 });
      mockRepo.countMembresEquipe.mockResolvedValueOnce(2);
      mockRepo.addMembreToEquipe.mockRejectedValueOnce(err);
      const app = makeApp();

      const res = await request(app).post("/admin/equipes/1/membres").send({ participant_id: 77 });

      expect(res.status).toBe(409);
      expect(res.body.message).toMatch(/déjà dans cette équipe/i);
    });

    test("500 si addMembreToEquipe échoue autrement", async () => {
      mockRepo.isTournoiOpenByEquipeId.mockResolvedValueOnce(true);
      mockRepo.getEquipeById.mockResolvedValueOnce({ id: 1, tournoi_id: 2 });
      mockRepo.getParticipantById.mockResolvedValueOnce({ id: 77, tournoi_id: 2 });
      mockRepo.countMembresEquipe.mockResolvedValueOnce(2);
      mockRepo.addMembreToEquipe.mockRejectedValueOnce(new Error("db"));
      const app = makeApp();

      const res = await request(app).post("/admin/equipes/1/membres").send({ participant_id: 77 });

      expect(res.status).toBe(500);
    });
  });

  describe("POST /admin/equipes/:id/membres/nouveau", () => {
    test("400 si validation échoue", async () => {
      const app = makeApp();

      const res = await request(app).post("/admin/equipes/1/membres/nouveau").send({
        prenom: "A",
        nom: "B",
        courriel: "invalide",
      });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Validation impossible");
    });

    test("404 si équipe introuvable via isTournoiOpenByEquipeId = null", async () => {
      mockRepo.isTournoiOpenByEquipeId.mockResolvedValueOnce(null);
      const app = makeApp();

      const res = await request(app).post("/admin/equipes/1/membres/nouveau").send({
        prenom: "Ali",
        nom: "Test",
        courriel: "ali@test.com",
      });

      expect(res.status).toBe(404);
    });

    test("409 si tournoi fermé", async () => {
      mockRepo.isTournoiOpenByEquipeId.mockResolvedValueOnce(false);
      const app = makeApp();

      const res = await request(app).post("/admin/equipes/1/membres/nouveau").send({
        prenom: "Ali",
        nom: "Test",
        courriel: "ali@test.com",
      });

      expect(res.status).toBe(409);
    });

    test("404 si getEquipeById retourne null", async () => {
      mockRepo.isTournoiOpenByEquipeId.mockResolvedValueOnce(true);
      mockRepo.getEquipeById.mockResolvedValueOnce(null);
      const app = makeApp();

      const res = await request(app).post("/admin/equipes/1/membres/nouveau").send({
        prenom: "Ali",
        nom: "Test",
        courriel: "ali@test.com",
      });

      expect(res.status).toBe(404);
    });

    test("409 si équipe complète", async () => {
      mockRepo.isTournoiOpenByEquipeId.mockResolvedValueOnce(true);
      mockRepo.getEquipeById.mockResolvedValueOnce({ id: 1, tournoi_id: 2 });
      mockRepo.countMembresEquipe.mockResolvedValueOnce(4);
      const app = makeApp();

      const res = await request(app).post("/admin/equipes/1/membres/nouveau").send({
        prenom: "Ali",
        nom: "Test",
        courriel: "ali@test.com",
      });

      expect(res.status).toBe(409);
    });

    test("201 succès", async () => {
      mockRepo.isTournoiOpenByEquipeId.mockResolvedValueOnce(true);
      mockRepo.getEquipeById.mockResolvedValueOnce({ id: 1, tournoi_id: 2 });
      mockRepo.countMembresEquipe.mockResolvedValueOnce(1);
      mockRepo.createParticipantAndAddToEquipe.mockResolvedValueOnce({
        participant: { id: 90, prenom: "Ali", nom: "Test", courriel: "ali@test.com" },
        membre: { id: 501, equipe_id: 1, participant_id: 90 },
      });
      const app = makeApp();

      const res = await request(app).post("/admin/equipes/1/membres/nouveau").send({
        prenom: "Ali",
        nom: "Test",
        courriel: "ali@test.com",
        telephone: "555-0101",
      });

      expect(res.status).toBe(201);
      expect(res.body.participant.id).toBe(90);
      expect(res.body.membre.participant_id).toBe(90);
      expect(mockRepo.createParticipantAndAddToEquipe).toHaveBeenCalledWith(1, {
        prenom: "Ali",
        nom: "Test",
        courriel: "ali@test.com",
        telephone: "555-0101",
        type_participant: "EMPLOYE",
      });
    });

    test("404 si code EQUIPE_NOT_FOUND", async () => {
      const err = new Error("not found");
      err.code = "EQUIPE_NOT_FOUND";
      mockRepo.isTournoiOpenByEquipeId.mockResolvedValueOnce(true);
      mockRepo.getEquipeById.mockResolvedValueOnce({ id: 1, tournoi_id: 2 });
      mockRepo.countMembresEquipe.mockResolvedValueOnce(1);
      mockRepo.createParticipantAndAddToEquipe.mockRejectedValueOnce(err);
      const app = makeApp();

      const res = await request(app).post("/admin/equipes/1/membres/nouveau").send({
        prenom: "Ali",
        nom: "Test",
        courriel: "ali@test.com",
      });

      expect(res.status).toBe(404);
    });

    test("409 si courriel déjà existant", async () => {
      const err = new Error("duplicate");
      err.constraint = "uq_participant_tournoi_courriel";
      mockRepo.isTournoiOpenByEquipeId.mockResolvedValueOnce(true);
      mockRepo.getEquipeById.mockResolvedValueOnce({ id: 1, tournoi_id: 2 });
      mockRepo.countMembresEquipe.mockResolvedValueOnce(1);
      mockRepo.createParticipantAndAddToEquipe.mockRejectedValueOnce(err);
      const app = makeApp();

      const res = await request(app).post("/admin/equipes/1/membres/nouveau").send({
        prenom: "Ali",
        nom: "Test",
        courriel: "ali@test.com",
      });

      expect(res.status).toBe(409);
    });

    test("409 si contrainte uq_participant_une_seule_equipe", async () => {
      const err = new Error("dup");
      err.constraint = "uq_participant_une_seule_equipe";
      mockRepo.isTournoiOpenByEquipeId.mockResolvedValueOnce(true);
      mockRepo.getEquipeById.mockResolvedValueOnce({ id: 1, tournoi_id: 2 });
      mockRepo.countMembresEquipe.mockResolvedValueOnce(1);
      mockRepo.createParticipantAndAddToEquipe.mockRejectedValueOnce(err);
      const app = makeApp();

      const res = await request(app).post("/admin/equipes/1/membres/nouveau").send({
        prenom: "Ali",
        nom: "Test",
        courriel: "ali@test.com",
      });

      expect(res.status).toBe(409);
    });

    test("409 si contrainte uq_membre_equipe", async () => {
      const err = new Error("dup");
      err.constraint = "uq_membre_equipe";
      mockRepo.isTournoiOpenByEquipeId.mockResolvedValueOnce(true);
      mockRepo.getEquipeById.mockResolvedValueOnce({ id: 1, tournoi_id: 2 });
      mockRepo.countMembresEquipe.mockResolvedValueOnce(1);
      mockRepo.createParticipantAndAddToEquipe.mockRejectedValueOnce(err);
      const app = makeApp();

      const res = await request(app).post("/admin/equipes/1/membres/nouveau").send({
        prenom: "Ali",
        nom: "Test",
        courriel: "ali@test.com",
      });

      expect(res.status).toBe(409);
    });

    test("500 si createParticipantAndAddToEquipe échoue autrement", async () => {
      mockRepo.isTournoiOpenByEquipeId.mockResolvedValueOnce(true);
      mockRepo.getEquipeById.mockResolvedValueOnce({ id: 1, tournoi_id: 2 });
      mockRepo.countMembresEquipe.mockResolvedValueOnce(1);
      mockRepo.createParticipantAndAddToEquipe.mockRejectedValueOnce(new Error("db"));
      const app = makeApp();

      const res = await request(app).post("/admin/equipes/1/membres/nouveau").send({
        prenom: "Ali",
        nom: "Test",
        courriel: "ali@test.com",
      });

      expect(res.status).toBe(500);
    });
  });

  describe("DELETE /admin/equipes/:id/membres/:participantId", () => {
    test("400 si ids invalides", async () => {
      const app = makeApp();

      const res = await request(app).delete("/admin/equipes/0/membres/abc");

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/id équipe ou participant invalide/i);
    });

    test("404 si équipe introuvable via isTournoiOpenByEquipeId = null", async () => {
      mockRepo.isTournoiOpenByEquipeId.mockResolvedValueOnce(null);
      const app = makeApp();

      const res = await request(app).delete("/admin/equipes/1/membres/77");

      expect(res.status).toBe(404);
    });

    test("409 si tournoi fermé", async () => {
      mockRepo.isTournoiOpenByEquipeId.mockResolvedValueOnce(false);
      const app = makeApp();

      const res = await request(app).delete("/admin/equipes/1/membres/77");

      expect(res.status).toBe(409);
    });

    test("404 si membre absent", async () => {
      mockRepo.isTournoiOpenByEquipeId.mockResolvedValueOnce(true);
      mockRepo.removeMembreFromEquipe.mockResolvedValueOnce(false);
      const app = makeApp();

      const res = await request(app).delete("/admin/equipes/1/membres/77");

      expect(res.status).toBe(404);
    });

    test("200 succès", async () => {
      mockRepo.isTournoiOpenByEquipeId.mockResolvedValueOnce(true);
      mockRepo.removeMembreFromEquipe.mockResolvedValueOnce({ id: 33, equipe_id: 1, participant_id: 77 });
      const app = makeApp();

      const res = await request(app).delete("/admin/equipes/1/membres/77");

      expect(res.status).toBe(200);
      expect(res.body.membre.participant_id).toBe(77);
    });

    test("500 si removeMembreFromEquipe échoue", async () => {
      mockRepo.isTournoiOpenByEquipeId.mockResolvedValueOnce(true);
      mockRepo.removeMembreFromEquipe.mockRejectedValueOnce(new Error("db"));
      const app = makeApp();

      const res = await request(app).delete("/admin/equipes/1/membres/77");

      expect(res.status).toBe(500);
    });
  });

  describe("PATCH /admin/participants/:id", () => {
    test("400 si id invalide", async () => {
      const app = makeApp();

      const res = await request(app).patch("/admin/participants/abc").send({
        prenom: "Ali",
        nom: "Test",
        courriel: "ali@test.com",
      });

      expect(res.status).toBe(400);
    });

    test("400 si validation échoue", async () => {
      const app = makeApp();

      const res = await request(app).patch("/admin/participants/5").send({ prenom: "Ali" });

      expect(res.status).toBe(400);
      expect(mockRepo.updateParticipantAdmin).not.toHaveBeenCalled();
    });

    test("404 si participant introuvable via isTournoiOpenByParticipantId = null", async () => {
      mockRepo.isTournoiOpenByParticipantId.mockResolvedValueOnce(null);
      const app = makeApp();

      const res = await request(app).patch("/admin/participants/5").send({
        prenom: "Ali",
        nom: "Test",
        courriel: "ali@test.com",
      });

      expect(res.status).toBe(404);
    });

    test("409 si tournoi fermé", async () => {
      mockRepo.isTournoiOpenByParticipantId.mockResolvedValueOnce(false);
      const app = makeApp();

      const res = await request(app).patch("/admin/participants/5").send({
        prenom: "Ali",
        nom: "Test",
        courriel: "ali@test.com",
      });

      expect(res.status).toBe(409);
    });

    test("404 si updateParticipantAdmin retourne ok:false", async () => {
      mockRepo.isTournoiOpenByParticipantId.mockResolvedValueOnce(true);
      mockRepo.updateParticipantAdmin.mockResolvedValueOnce({ ok: false });
      const app = makeApp();

      const res = await request(app).patch("/admin/participants/5").send({
        prenom: "Ali",
        nom: "Test",
        courriel: "ali@test.com",
      });

      expect(res.status).toBe(404);
    });

    test("200 succès", async () => {
      mockRepo.isTournoiOpenByParticipantId.mockResolvedValueOnce(true);
      mockRepo.updateParticipantAdmin.mockResolvedValueOnce({
        ok: true,
        row: { id: 5, prenom: "Ali", nom: "Test", courriel: "ali@test.com", telephone: null },
      });
      const app = makeApp();

      const res = await request(app).patch("/admin/participants/5").send({
        prenom: "Ali",
        nom: "Test",
        courriel: "ali@test.com",
        telephone: "",
      });

      expect(res.status).toBe(200);
      expect(mockRepo.updateParticipantAdmin).toHaveBeenCalledWith(5, {
        prenom: "Ali",
        nom: "Test",
        courriel: "ali@test.com",
        telephone: null,
      });
    });

    test("409 si contrainte uq_participant_tournoi_courriel", async () => {
      const err = new Error("dup");
      err.constraint = "uq_participant_tournoi_courriel";
      mockRepo.isTournoiOpenByParticipantId.mockResolvedValueOnce(true);
      mockRepo.updateParticipantAdmin.mockRejectedValueOnce(err);
      const app = makeApp();

      const res = await request(app).patch("/admin/participants/5").send({
        prenom: "Ali",
        nom: "Test",
        courriel: "ali@test.com",
      });

      expect(res.status).toBe(409);
    });

    test("500 si updateParticipantAdmin échoue autrement", async () => {
      mockRepo.isTournoiOpenByParticipantId.mockResolvedValueOnce(true);
      mockRepo.updateParticipantAdmin.mockRejectedValueOnce(new Error("db"));
      const app = makeApp();

      const res = await request(app).patch("/admin/participants/5").send({
        prenom: "Ali",
        nom: "Test",
        courriel: "ali@test.com",
      });

      expect(res.status).toBe(500);
    });
  });

  describe("POST /admin/equipes/:id/membres/:participantId/deplacer", () => {
    test("400 si validation échoue", async () => {
      const app = makeApp();

      const res = await request(app)
        .post("/admin/equipes/1/membres/10/deplacer")
        .send({});

      expect(res.status).toBe(400);
      expect(mockRepo.moveMembreToEquipe).not.toHaveBeenCalled();
    });

    test("404 si équipe source introuvable via isTournoiOpenByEquipeId = null", async () => {
      mockRepo.isTournoiOpenByEquipeId.mockResolvedValueOnce(null);
      const app = makeApp();

      const res = await request(app)
        .post("/admin/equipes/1/membres/10/deplacer")
        .send({ equipe_cible_id: 2 });

      expect(res.status).toBe(404);
    });

    test("409 si tournoi fermé", async () => {
      mockRepo.isTournoiOpenByEquipeId.mockResolvedValueOnce(false);
      const app = makeApp();

      const res = await request(app)
        .post("/admin/equipes/1/membres/10/deplacer")
        .send({ equipe_cible_id: 2 });

      expect(res.status).toBe(409);
    });

    test("200 succès", async () => {
      mockRepo.isTournoiOpenByEquipeId.mockResolvedValueOnce(true);
      mockRepo.moveMembreToEquipe.mockResolvedValueOnce({
        ok: true,
        code: "MOVED",
        participant_id: 10,
        equipe_id: 2,
      });
      const app = makeApp();

      const res = await request(app)
        .post("/admin/equipes/1/membres/10/deplacer")
        .send({ equipe_cible_id: 2 });

      expect(res.status).toBe(200);
      expect(res.body.equipe_id).toBe(2);
      expect(mockRepo.moveMembreToEquipe).toHaveBeenCalledWith(1, 2, 10);
    });

    test("200 noop", async () => {
      mockRepo.isTournoiOpenByEquipeId.mockResolvedValueOnce(true);
      mockRepo.moveMembreToEquipe.mockResolvedValueOnce({
        ok: true,
        code: "NOOP",
        participant_id: 10,
        equipe_id: 1,
      });
      const app = makeApp();

      const res = await request(app)
        .post("/admin/equipes/1/membres/10/deplacer")
        .send({ equipe_cible_id: 1 });

      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/déjà dans cette équipe/i);
    });

    test.each([
      ["BAD_INPUT", 400],
      ["SOURCE_NOT_FOUND", 404],
      ["TARGET_NOT_FOUND", 404],
      ["MEMBRE_NOT_FOUND", 404],
      ["TOURNOI_MISMATCH", 400],
      ["EQUIPE_PLEINE", 409],
    ])("mappe %s correctement", async (code, status) => {
      mockRepo.isTournoiOpenByEquipeId.mockResolvedValueOnce(true);
      mockRepo.moveMembreToEquipe.mockResolvedValueOnce({ ok: false, code });
      const app = makeApp();

      const res = await request(app)
        .post("/admin/equipes/1/membres/10/deplacer")
        .send({ equipe_cible_id: 2 });

      expect(res.status).toBe(status);
    });

    test("400 pour code inconnu", async () => {
      mockRepo.isTournoiOpenByEquipeId.mockResolvedValueOnce(true);
      mockRepo.moveMembreToEquipe.mockResolvedValueOnce({ ok: false, code: "UNKNOWN" });
      const app = makeApp();

      const res = await request(app)
        .post("/admin/equipes/1/membres/10/deplacer")
        .send({ equipe_cible_id: 2 });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/déplacement impossible/i);
    });

    test("409 si contrainte uq_participant_une_seule_equipe", async () => {
      const err = new Error("dup");
      err.constraint = "uq_participant_une_seule_equipe";
      mockRepo.isTournoiOpenByEquipeId.mockResolvedValueOnce(true);
      mockRepo.moveMembreToEquipe.mockRejectedValueOnce(err);
      const app = makeApp();

      const res = await request(app)
        .post("/admin/equipes/1/membres/10/deplacer")
        .send({ equipe_cible_id: 2 });

      expect(res.status).toBe(409);
    });

    test("500 si moveMembreToEquipe échoue autrement", async () => {
      mockRepo.isTournoiOpenByEquipeId.mockResolvedValueOnce(true);
      mockRepo.moveMembreToEquipe.mockRejectedValueOnce(new Error("db"));
      const app = makeApp();

      const res = await request(app)
        .post("/admin/equipes/1/membres/10/deplacer")
        .send({ equipe_cible_id: 2 });

      expect(res.status).toBe(500);
    });
  });

  describe("PUT /admin/equipes/:id", () => {
    test("400 si id invalide", async () => {
      const app = makeApp();
      const res = await request(app).put("/admin/equipes/abc").send({ nom_equipe: "Nom" });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Validation impossible");
      expect(res.body.errors.equipe_id).toBeDefined();
    });

    test("409 si tournoi fermé", async () => {
      mockRepo.isTournoiOpenByEquipeId.mockResolvedValueOnce(false);
      const app = makeApp();

      const res = await request(app).put("/admin/equipes/10").send({ nom_equipe: "Nouveau nom" });

      expect(res.status).toBe(409);
    });

    test("404 si équipe introuvable via isTournoiOpenByEquipeId = null", async () => {
      mockRepo.isTournoiOpenByEquipeId.mockResolvedValueOnce(null);
      const app = makeApp();

      const res = await request(app).put("/admin/equipes/10").send({ nom_equipe: "Nouveau nom" });

      expect(res.status).toBe(404);
    });

    test("404 si getEquipeById retourne null", async () => {
      mockRepo.isTournoiOpenByEquipeId.mockResolvedValueOnce(true);
      mockRepo.getEquipeById.mockResolvedValueOnce(null);
      const app = makeApp();

      const res = await request(app).put("/admin/equipes/10").send({ nom_equipe: "Nouveau nom" });

      expect(res.status).toBe(404);
    });

    test("409 si nom dupliqué dans le tournoi", async () => {
      mockRepo.isTournoiOpenByEquipeId.mockResolvedValueOnce(true);
      mockRepo.getEquipeById.mockResolvedValueOnce({ id: 10, tournoi_id: 3, nom_equipe: "Equipe 10" });
      mockRepo.existsEquipeNameInTournoi.mockResolvedValueOnce(true);
      const app = makeApp();

      const res = await request(app).put("/admin/equipes/10").send({ nom_equipe: "Equipe deja prise" });

      expect(res.status).toBe(409);
      expect(mockRepo.updateEquipe).not.toHaveBeenCalled();
    });

    test("404 si updateEquipe retourne null", async () => {
      mockRepo.isTournoiOpenByEquipeId.mockResolvedValueOnce(true);
      mockRepo.getEquipeById.mockResolvedValueOnce({ id: 10, tournoi_id: 3, nom_equipe: "Equipe 10" });
      mockRepo.existsEquipeNameInTournoi.mockResolvedValueOnce(false);
      mockRepo.updateEquipe.mockResolvedValueOnce(null);
      const app = makeApp();

      const res = await request(app).put("/admin/equipes/10").send({ nom_equipe: "Nouveau nom" });

      expect(res.status).toBe(404);
    });

    test("200 succès", async () => {
      mockRepo.isTournoiOpenByEquipeId.mockResolvedValueOnce(true);
      mockRepo.getEquipeById.mockResolvedValueOnce({ id: 10, tournoi_id: 3, nom_equipe: "Equipe 10" });
      mockRepo.existsEquipeNameInTournoi.mockResolvedValueOnce(false);
      mockRepo.updateEquipe.mockResolvedValueOnce({ id: 10, tournoi_id: 3, nom_equipe: "Nouveau nom" });
      const app = makeApp();

      const res = await request(app).put("/admin/equipes/10").send({ nom_equipe: "Nouveau nom" });

      expect(res.status).toBe(200);
      expect(res.body.equipe.nom_equipe).toBe("Nouveau nom");
      expect(mockRepo.updateEquipe).toHaveBeenCalledWith(10, "Nouveau nom");
    });

    test("500 si updateEquipe échoue", async () => {
      mockRepo.isTournoiOpenByEquipeId.mockResolvedValueOnce(true);
      mockRepo.getEquipeById.mockResolvedValueOnce({ id: 10, tournoi_id: 3, nom_equipe: "Equipe 10" });
      mockRepo.existsEquipeNameInTournoi.mockResolvedValueOnce(false);
      mockRepo.updateEquipe.mockRejectedValueOnce(new Error("db"));
      const app = makeApp();

      const res = await request(app).put("/admin/equipes/10").send({ nom_equipe: "Nouveau nom" });

      expect(res.status).toBe(500);
    });
  });
});