/**
 * --------------------------------------------------------------------
 * Tests des routes publiques (public.routes.js)
 * --------------------------------------------------------------------
 *
 * Fichier testé :
 * - routes/public.routes.js
 *
 * Objectif :
 * Vérifier le comportement des routes publiques du site utilisées
 * par le frontend sans authentification administrateur.
 *
 * Routes couvertes :
 * - GET  /public/tournoi-actif
 * - GET  /public/types-commandites?tournoi_id=ID
 * - POST /public/inscription/creer-equipe
 * - POST /public/inscription/rejoindre-equipe
 * - POST /public/inscription/commanditaire
 * - POST /public/inscription/verifier-noms-joueurs
 *
 * Fonctionnalités testées :
 * - récupération du tournoi actif
 * - récupération des types de commandites d'un tournoi
 * - création d'équipe avec inscription du participant
 * - ajout d'un participant à une équipe existante
 * - inscription d'un commanditaire
 * - vérification de conflits de noms de joueurs
 *
 * Outils utilisés :
 * - Jest
 * - Supertest
 * - Express
 *
 * Dépendances simulées :
 * - repository tournoi
 * - repository inscription tournoi
 * - repository types-commandites
 *
 * Types de scénarios testés :
 * - validation invalide (400)
 * - ressource introuvable (404)
 * - succès (200 / 201)
 * - erreur serveur (500)
 *
 * Cas particuliers vérifiés :
 * - trim des champs texte
 * - conversion du téléphone vide en null
 * - mise en majuscules du code d'équipe
 * - propagation des erreurs métier retournées par le DAL
 * - limite maximale de joueurs à vérifier
 * - valeur par défaut de nom_entreprise
 * - passage de joueurs_par_type au DAL
 * --------------------------------------------------------------------
 */

import { jest } from "@jest/globals";
import request from "supertest";
import express from "express";

/**
 * --------------------------------------------------------------------
 * Mocks des dépendances DAL
 * --------------------------------------------------------------------
 */
const mockFindActiveTournoi = jest.fn();
const mockInscriptionCreerEquipe = jest.fn();
const mockInscriptionRejoindreEquipe = jest.fn();
const mockInscriptionCommandite = jest.fn();
const mockVerifierConflitsNomsJoueursTournoi = jest.fn();
const mockListTypesCommanditesByTournoi = jest.fn();
const mockCourrielDejaInscrit = jest.fn();
const mockNomEquipeDejaExiste = jest.fn();
const mockCodeEquipeRejoignable = jest.fn();
const mockVerifierDisponibiliteAvantPaiement = jest.fn();

await jest.unstable_mockModule("../../dal/tournoi.repository.js", () => ({
  findActiveTournoi: (...args) => mockFindActiveTournoi(...args),
  findTournoiById: jest.fn(),
  listTournois: jest.fn(),
}));

await jest.unstable_mockModule("../../dal/inscriptionTournoi.repository.js", () => ({
  inscriptionCreerEquipe: (...args) => mockInscriptionCreerEquipe(...args),
  inscriptionRejoindreEquipe: (...args) => mockInscriptionRejoindreEquipe(...args),
  inscriptionCommandite: (...args) => mockInscriptionCommandite(...args),
  verifierConflitsNomsJoueursTournoi: (...args) =>
    mockVerifierConflitsNomsJoueursTournoi(...args),
  courrielDejaInscrit: (...args) => mockCourrielDejaInscrit(...args),
  nomEquipeDejaExiste: (...args) => mockNomEquipeDejaExiste(...args),
  codeEquipeRejoignable: (...args) => mockCodeEquipeRejoignable(...args),
  verifierDisponibiliteAvantPaiement: jest.fn().mockResolvedValue({ ok: true }),
}));

await jest.unstable_mockModule("../../dal/types-commandites.repository.js", () => ({
  listTypesCommanditesByTournoi: (...args) => mockListTypesCommanditesByTournoi(...args),
}));

const { default: publicRoutes } = await import("../../routes/public.routes.js");

/**
 * --------------------------------------------------------------------
 * Helper : crée une mini application Express de test
 * --------------------------------------------------------------------
 */
function makeApp() {
  const app = express();
  app.use(express.json());
  app.use("/public", publicRoutes);
  return app;
}

describe("routes/public.routes.js", () => {
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
   * GET /public/tournoi-actif
   * ================================================================
   */
  describe("GET /public/tournoi-actif", () => {
    test("retourne 200 + le tournoi actif si trouvé", async () => {
      mockFindActiveTournoi.mockResolvedValueOnce({
        id: 5,
        nom: "Tournoi Printemps",
        lieu: "Ottawa",
        date_tournoi: "2026-05-20",
        inscriptions_ouvertes: true,
      });

      const res = await request(app).get("/public/tournoi-actif");

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
  id: 5,
  nom: "Tournoi Printemps",
  lieu: "Ottawa",
  date_tournoi: "2026-05-20",
  inscriptions_ouvertes: true,
  participants_inscrits: 0,
  places_restantes: 0,
});
      expect(mockFindActiveTournoi).toHaveBeenCalledTimes(1);
    });

    test("retourne 404 si aucun tournoi actif", async () => {
      mockFindActiveTournoi.mockResolvedValueOnce(null);

      const res = await request(app).get("/public/tournoi-actif");

      expect(res.status).toBe(404);
      expect(res.body).toEqual({
        message: "Aucun tournoi ouvert aux inscriptions pour le moment.",
      });
    });

    test("retourne 500 si erreur serveur", async () => {
      mockFindActiveTournoi.mockRejectedValueOnce(new Error("DB down"));

      const res = await request(app).get("/public/tournoi-actif");

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ message: "Erreur serveur" });
    });
  });

  /**
   * ================================================================
   * GET /public/types-commandites
   * ================================================================
   */
  describe("GET /public/types-commandites", () => {
    test("retourne 400 si tournoi_id absent", async () => {
      const res = await request(app).get("/public/types-commandites");

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ message: "tournoi_id invalide" });
      expect(mockListTypesCommanditesByTournoi).not.toHaveBeenCalled();
    });

    test("retourne 400 si tournoi_id invalide", async () => {
      const res = await request(app).get("/public/types-commandites?tournoi_id=abc");

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ message: "tournoi_id invalide" });
      expect(mockListTypesCommanditesByTournoi).not.toHaveBeenCalled();
    });

    test("retourne 200 + liste des types", async () => {
      mockListTypesCommanditesByTournoi.mockResolvedValueOnce([
        { id: 1, tournoi_id: 7, nom: "Or", prix_cents: 250000, quota: 4, places_incluses: 4 },
      ]);

      const res = await request(app).get("/public/types-commandites?tournoi_id=7");

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(mockListTypesCommanditesByTournoi).toHaveBeenCalledWith(7);
    });

    test("retourne 500 si erreur serveur", async () => {
      mockListTypesCommanditesByTournoi.mockRejectedValueOnce(new Error("DB error"));

      const res = await request(app).get("/public/types-commandites?tournoi_id=7");

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ message: "Erreur serveur" });
    });
  });

  /**
   * ================================================================
   * POST /public/inscription/creer-equipe
   * ================================================================
   */
  describe("POST /public/inscription/creer-equipe", () => {
    test("retourne 400 si tournoi_id invalide", async () => {
      const res = await request(app).post("/public/inscription/creer-equipe").send({
        tournoi_id: 0,
        prenom: "Ali",
        nom: "Squalli",
        courriel: "ali@test.com",
        nom_equipe: "Les Aigles",
      });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Validation impossible");
      expect(res.body.errors.tournoi_id).toBeDefined();
      expect(mockInscriptionCreerEquipe).not.toHaveBeenCalled();
    });

    test("retourne 400 si champs participant obligatoires manquants", async () => {
      const res = await request(app).post("/public/inscription/creer-equipe").send({
        tournoi_id: 1,
        prenom: "",
        nom: "Squalli",
        courriel: "ali@test.com",
        nom_equipe: "Les Aigles",
      });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Validation impossible");
      expect(res.body.errors.prenom).toBeDefined();
      expect(mockInscriptionCreerEquipe).not.toHaveBeenCalled();
    });

    test("retourne 400 si format courriel invalide", async () => {
      const res = await request(app).post("/public/inscription/creer-equipe").send({
        tournoi_id: 1,
        prenom: "Ali",
        nom: "Squalli",
        courriel: "ali-test.com",
        nom_equipe: "Les Aigles",
      });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Validation impossible");
      expect(res.body.errors.courriel).toBeDefined();
      expect(mockInscriptionCreerEquipe).not.toHaveBeenCalled();
    });

    test("retourne 400 si nom_equipe manquant", async () => {
      const res = await request(app).post("/public/inscription/creer-equipe").send({
        tournoi_id: 1,
        prenom: "Ali",
        nom: "Squalli",
        courriel: "ali@test.com",
        nom_equipe: "",
      });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Validation impossible");
      expect(res.body.errors.nom_equipe).toBeDefined();
      expect(mockInscriptionCreerEquipe).not.toHaveBeenCalled();
    });

    test("retourne 400 si nom_equipe dépasse la limite", async () => {
      const res = await request(app).post("/public/inscription/creer-equipe").send({
        tournoi_id: 1,
        prenom: "Ali",
        nom: "Squalli",
        courriel: "ali@test.com",
        nom_equipe: "A".repeat(121),
      });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Validation impossible");
      expect(res.body.errors.nom_equipe).toBeDefined();
      expect(mockInscriptionCreerEquipe).not.toHaveBeenCalled();
    });

    test("retourne 201 si création réussie", async () => {
      mockInscriptionCreerEquipe.mockResolvedValueOnce({
        participant: {
          id: 10,
          prenom: "Ali",
          nom: "Squalli",
          courriel: "ali@test.com",
        },
        equipe: {
          id: 25,
          nom_equipe: "Les Aigles",
          code_secret: "ABC123",
        },
      });

      const res = await request(app).post("/public/inscription/creer-equipe").send({
        tournoi_id: 1,
        prenom: " Ali ",
        nom: " Squalli ",
        courriel: " ali@test.com ",
        telephone: " 6130000000 ",
        nom_equipe: " Les Aigles ",
      });

      expect(res.status).toBe(201);
      expect(res.body.message).toMatch(/créée/i);
      expect(res.body.participant).toEqual({
        id: 10,
        prenom: "Ali",
        nom: "Squalli",
        courriel: "ali@test.com",
      });
      expect(res.body.equipe).toEqual({
        id: 25,
        nom_equipe: "Les Aigles",
        code_secret: "ABC123",
      });

      expect(mockInscriptionCreerEquipe).toHaveBeenCalledWith({
        tournoi_id: 1,
        prenom: "Ali",
        nom: "Squalli",
        courriel: "ali@test.com",
        telephone: "6130000000",
        nom_equipe: "Les Aigles",
        categorie_participant: "employe",
      });
    });

    test("retourne telephone=null si téléphone vide", async () => {
      mockInscriptionCreerEquipe.mockResolvedValueOnce({
        participant: { id: 1 },
        equipe: { id: 2, code_secret: "XYZ789" },
      });

      const res = await request(app).post("/public/inscription/creer-equipe").send({
        tournoi_id: 1,
        prenom: "Ali",
        nom: "Squalli",
        courriel: "ali@test.com",
        telephone: "",
        nom_equipe: "Les Lions",
      });

      expect(res.status).toBe(201);

      expect(mockInscriptionCreerEquipe).toHaveBeenCalledWith({
        tournoi_id: 1,
        prenom: "Ali",
        nom: "Squalli",
        courriel: "ali@test.com",
        telephone: null,
        nom_equipe: "Les Lions",
        categorie_participant: "employe",
      });
    });

    test("retourne le status/message du DAL si result.error existe", async () => {
      mockInscriptionCreerEquipe.mockResolvedValueOnce({
        error: {
          status: 409,
          message: "Cette équipe existe déjà",
        },
      });

      const res = await request(app).post("/public/inscription/creer-equipe").send({
        tournoi_id: 1,
        prenom: "Ali",
        nom: "Squalli",
        courriel: "ali@test.com",
        nom_equipe: "Les Aigles",
      });

      expect(res.status).toBe(409);
      expect(res.body).toEqual({ message: "Cette équipe existe déjà" });
    });

    test("retourne 500 si exception serveur", async () => {
      mockInscriptionCreerEquipe.mockRejectedValueOnce(new Error("DB error"));

      const res = await request(app).post("/public/inscription/creer-equipe").send({
        tournoi_id: 1,
        prenom: "Ali",
        nom: "Squalli",
        courriel: "ali@test.com",
        nom_equipe: "Les Aigles",
      });

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ message: "Erreur serveur" });
    });
  });

  /**
   * ================================================================
   * POST /public/inscription/rejoindre-equipe
   * ================================================================
   */
  describe("POST /public/inscription/rejoindre-equipe", () => {
    test("retourne 400 si tournoi_id invalide", async () => {
      const res = await request(app).post("/public/inscription/rejoindre-equipe").send({
        tournoi_id: -1,
        prenom: "Ali",
        nom: "Squalli",
        courriel: "ali@test.com",
        code_equipe: "ABC123",
      });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Validation impossible");
      expect(res.body.errors.tournoi_id).toBeDefined();
      expect(mockInscriptionRejoindreEquipe).not.toHaveBeenCalled();
    });

    test("retourne 400 si champs obligatoires manquants", async () => {
      const res = await request(app).post("/public/inscription/rejoindre-equipe").send({
        tournoi_id: 1,
        prenom: "Ali",
        nom: "",
        courriel: "ali@test.com",
        code_equipe: "ABC123",
      });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Validation impossible");
      expect(res.body.errors.nom).toBeDefined();
      expect(mockInscriptionRejoindreEquipe).not.toHaveBeenCalled();
    });

    test("retourne 400 si code_equipe manquant", async () => {
      const res = await request(app).post("/public/inscription/rejoindre-equipe").send({
        tournoi_id: 1,
        prenom: "Ali",
        nom: "Squalli",
        courriel: "ali@test.com",
        code_equipe: "",
      });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Validation impossible");
      expect(res.body.errors.code_equipe).toBeDefined();
      expect(mockInscriptionRejoindreEquipe).not.toHaveBeenCalled();
    });

    test("retourne 400 si format du code invalide", async () => {
      const res = await request(app).post("/public/inscription/rejoindre-equipe").send({
        tournoi_id: 1,
        prenom: "Ali",
        nom: "Squalli",
        courriel: "ali@test.com",
        code_equipe: "ab12",
      });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Validation impossible");
      expect(res.body.errors.code_equipe).toBeDefined();
      expect(mockInscriptionRejoindreEquipe).not.toHaveBeenCalled();
    });

    test("retourne 201 si ajout réussi", async () => {
      mockInscriptionRejoindreEquipe.mockResolvedValueOnce({
        participant: {
          id: 11,
          prenom: "Ali",
          nom: "Squalli",
          courriel: "ali@test.com",
        },
        equipe: {
          id: 25,
          nom_equipe: "Les Aigles",
          code_secret: "ABC123",
        },
      });

      const res = await request(app).post("/public/inscription/rejoindre-equipe").send({
        tournoi_id: 1,
        prenom: " Ali ",
        nom: " Squalli ",
        courriel: " ali@test.com ",
        telephone: " 6131111111 ",
        code_equipe: "abc123",
      });

      expect(res.status).toBe(201);
      expect(res.body.message).toMatch(/ajout/i);
      expect(res.body.participant).toEqual({
        id: 11,
        prenom: "Ali",
        nom: "Squalli",
        courriel: "ali@test.com",
      });
      expect(res.body.equipe).toEqual({
        id: 25,
        nom_equipe: "Les Aigles",
        code_secret: "ABC123",
      });

      expect(mockInscriptionRejoindreEquipe).toHaveBeenCalledWith({
        tournoi_id: 1,
        prenom: "Ali",
        nom: "Squalli",
        courriel: "ali@test.com",
        telephone: "6131111111",
        code_equipe: "ABC123",
        categorie_participant: "employe",
      });
    });

    test("retourne telephone=null si téléphone vide", async () => {
      mockInscriptionRejoindreEquipe.mockResolvedValueOnce({
        participant: { id: 1 },
        equipe: { id: 2, code_secret: "ABC123" },
      });

      const res = await request(app).post("/public/inscription/rejoindre-equipe").send({
        tournoi_id: 1,
        prenom: "Ali",
        nom: "Squalli",
        courriel: "ali@test.com",
        telephone: "",
        code_equipe: "ABC123",
      });

      expect(res.status).toBe(201);

      expect(mockInscriptionRejoindreEquipe).toHaveBeenCalledWith({
        tournoi_id: 1,
        prenom: "Ali",
        nom: "Squalli",
        courriel: "ali@test.com",
        telephone: null,
        code_equipe: "ABC123",
        categorie_participant: "employe",
      });
    });

    test("retourne le status/message du DAL si result.error existe", async () => {
      mockInscriptionRejoindreEquipe.mockResolvedValueOnce({
        error: {
          status: 404,
          message: "Équipe introuvable",
        },
      });

      const res = await request(app).post("/public/inscription/rejoindre-equipe").send({
        tournoi_id: 1,
        prenom: "Ali",
        nom: "Squalli",
        courriel: "ali@test.com",
        code_equipe: "ABC123",
      });

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ message: "Équipe introuvable" });
    });

    test("retourne 500 si exception serveur", async () => {
      mockInscriptionRejoindreEquipe.mockRejectedValueOnce(new Error("DB error"));

      const res = await request(app).post("/public/inscription/rejoindre-equipe").send({
        tournoi_id: 1,
        prenom: "Ali",
        nom: "Squalli",
        courriel: "ali@test.com",
        code_equipe: "ABC123",
      });

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ message: "Erreur serveur" });
    });
  });

  /**
   * ================================================================
   * POST /public/inscription/commanditaire
   * ================================================================
   */
  describe("POST /public/inscription/commanditaire", () => {
    test("retourne 400 si aucun type de commandite", async () => {
      const res = await request(app).post("/public/inscription/commanditaire").send({
        tournoi_id: 1,
        prenom: "Ali",
        nom: "Squalli",
        courriel: "ali@test.com",
      });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Validation impossible");
      expect(res.body.errors.type_commandite_ids).toBeDefined();
      expect(mockInscriptionCommandite).not.toHaveBeenCalled();
    });

    test("retourne 201 si inscription commanditaire réussie", async () => {
      mockInscriptionCommandite.mockResolvedValueOnce({
        commandites: [
          { id: 101, tournoi_id: 1, type_commandite_id: 1, nom_entreprise: "ACME" },
          { id: 102, tournoi_id: 1, type_commandite_id: 2, nom_entreprise: "ACME" },
        ],
      });

      const res = await request(app).post("/public/inscription/commanditaire").send({
        tournoi_id: 1,
        prenom: "Ali",
        nom: "Squalli",
        courriel: "ali@test.com",
        telephone: "6131111111",
        nom_entreprise: "ACME",
        type_commandite_ids: [1, 2],
      });

      expect(res.status).toBe(201);
      expect(res.body.message).toMatch(/Inscription commanditaire/i);
      expect(res.body.commandites).toHaveLength(2);
      expect(res.body.commandite_id).toBe(101);
      expect(res.body.commandite).toEqual({
        id: 101,
        tournoi_id: 1,
        type_commandite_id: 1,
        nom_entreprise: "ACME",
      });

      expect(mockInscriptionCommandite).toHaveBeenCalledWith({
        tournoi_id: 1,
        type_commandite_ids: [1, 2],
        nom_entreprise: "ACME",
        nom_contact: "Ali Squalli",
        courriel_contact: "ali@test.com",
        telephone_contact: "6131111111",
        joueurs_par_type: {},
      });
    });

    test("utilise prenom+nom comme nom_entreprise par défaut", async () => {
      mockInscriptionCommandite.mockResolvedValueOnce({
        commandites: [{ id: 201, tournoi_id: 1, type_commandite_id: 1 }],
      });

      const res = await request(app).post("/public/inscription/commanditaire").send({
        tournoi_id: 1,
        prenom: "Ali",
        nom: "Squalli",
        courriel: "ali@test.com",
        telephone: "",
        type_commandite_ids: [1],
      });

      expect(res.status).toBe(201);

      expect(mockInscriptionCommandite).toHaveBeenCalledWith({
        tournoi_id: 1,
        type_commandite_ids: [1],
        nom_entreprise: "Ali Squalli",
        nom_contact: "Ali Squalli",
        courriel_contact: "ali@test.com",
        telephone_contact: null,
        joueurs_par_type: {},
      });
    });

    test("passe joueurs_par_type au DAL", async () => {
      mockInscriptionCommandite.mockResolvedValueOnce({
        commandites: [{ id: 301, tournoi_id: 1, type_commandite_id: 1 }],
      });

      const res = await request(app).post("/public/inscription/commanditaire").send({
        tournoi_id: 1,
        prenom: "Ali",
        nom: "Squalli",
        courriel: "ali@test.com",
        type_commandite_ids: [1],
        joueurs_par_type: {
          "1": [
            { prenom: "Jean", nom: "Dupont" },
            { prenom: "Marc", nom: "Tremblay" },
          ],
        },
      });

      expect(res.status).toBe(201);

      expect(mockInscriptionCommandite).toHaveBeenCalledWith({
        tournoi_id: 1,
        type_commandite_ids: [1],
        nom_entreprise: "Ali Squalli",
        nom_contact: "Ali Squalli",
        courriel_contact: "ali@test.com",
        telephone_contact: null,
        joueurs_par_type: {
          "1": [
            { prenom: "Jean", nom: "Dupont" },
            { prenom: "Marc", nom: "Tremblay" },
          ],
        },
      });
    });

    test("retourne le status/message du DAL si result.error existe", async () => {
      mockInscriptionCommandite.mockResolvedValueOnce({
        error: {
          status: 409,
          message: "Quota de commandites atteint",
        },
      });

      const res = await request(app).post("/public/inscription/commanditaire").send({
        tournoi_id: 1,
        prenom: "Ali",
        nom: "Squalli",
        courriel: "ali@test.com",
        type_commandite_ids: [1],
      });

      expect(res.status).toBe(409);
      expect(res.body).toEqual({ message: "Quota de commandites atteint" });
    });

    test("retourne 201 même si commandites est absent ou invalide", async () => {
      mockInscriptionCommandite.mockResolvedValueOnce({ commandites: null });

      const res = await request(app).post("/public/inscription/commanditaire").send({
        tournoi_id: 1,
        prenom: "Ali",
        nom: "Squalli",
        courriel: "ali@test.com",
        type_commandite_ids: [1],
      });

      expect(res.status).toBe(201);
      expect(res.body).toEqual({
        message: "Inscription commanditaire enregistrée avec succès",
        commandite_id: null,
        commandite: null,
        commandites: [],
      });
    });

    test("retourne 500 si exception serveur", async () => {
      mockInscriptionCommandite.mockRejectedValueOnce(new Error("DB error"));

      const res = await request(app).post("/public/inscription/commanditaire").send({
        tournoi_id: 1,
        prenom: "Ali",
        nom: "Squalli",
        courriel: "ali@test.com",
        type_commandite_ids: [1],
      });

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ message: "Erreur serveur" });
    });
  });

  /**
   * ================================================================
   * POST /public/inscription/verifier-noms-joueurs
   * ================================================================
   */
  describe("POST /public/inscription/verifier-noms-joueurs", () => {
    test("retourne 400 si tournoi_id invalide", async () => {
      const res = await request(app).post("/public/inscription/verifier-noms-joueurs").send({
        tournoi_id: 0,
        joueurs: [{ prenom: "A", nom: "B" }],
      });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ message: "tournoi_id invalide" });
      expect(mockVerifierConflitsNomsJoueursTournoi).not.toHaveBeenCalled();
    });

    test("retourne 400 si joueurs n'est pas un tableau", async () => {
      const res = await request(app).post("/public/inscription/verifier-noms-joueurs").send({
        tournoi_id: 1,
        joueurs: { prenom: "A", nom: "B" },
      });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ message: "joueurs doit être un tableau" });
      expect(mockVerifierConflitsNomsJoueursTournoi).not.toHaveBeenCalled();
    });

    test("retourne 400 si trop de joueurs à vérifier", async () => {
      const joueurs = Array.from({ length: 41 }, (_, i) => ({
        prenom: `Prenom${i}`,
        nom: `Nom${i}`,
      }));

      const res = await request(app).post("/public/inscription/verifier-noms-joueurs").send({
        tournoi_id: 1,
        joueurs,
      });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ message: "Trop de joueurs à vérifier" });
      expect(mockVerifierConflitsNomsJoueursTournoi).not.toHaveBeenCalled();
    });

    test("retourne 200 + conflit selon le DAL", async () => {
      mockVerifierConflitsNomsJoueursTournoi.mockResolvedValueOnce({ conflit: true });

      const res = await request(app).post("/public/inscription/verifier-noms-joueurs").send({
        tournoi_id: 1,
        joueurs: [{ prenom: "Jean", nom: "Dupont" }],
      });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ conflit: true });
      expect(mockVerifierConflitsNomsJoueursTournoi).toHaveBeenCalledWith(1, [
        { prenom: "Jean", nom: "Dupont" },
      ]);
    });

    test("nettoie les joueurs et ignore ceux incomplets", async () => {
      mockVerifierConflitsNomsJoueursTournoi.mockResolvedValueOnce({ conflit: false });

      const res = await request(app).post("/public/inscription/verifier-noms-joueurs").send({
        tournoi_id: 1,
        joueurs: [
          { prenom: " Jean ", nom: " Dupont " },
          { prenom: "", nom: "Incomplet" },
          { prenom: "SansNom", nom: "" },
          {},
        ],
      });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ conflit: false });
      expect(mockVerifierConflitsNomsJoueursTournoi).toHaveBeenCalledWith(1, [
        { prenom: "Jean", nom: "Dupont" },
      ]);
    });

    test("retourne 500 si exception serveur", async () => {
      mockVerifierConflitsNomsJoueursTournoi.mockRejectedValueOnce(new Error("DB error"));

      const res = await request(app).post("/public/inscription/verifier-noms-joueurs").send({
        tournoi_id: 1,
        joueurs: [{ prenom: "Jean", nom: "Dupont" }],
      });

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ message: "Erreur serveur" });
    });
  });
});