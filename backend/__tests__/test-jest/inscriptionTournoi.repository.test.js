/**
 * =============================================================================
 * TESTS — inscriptionTournoi.repository.js
 * =============================================================================
 */

import { describe, test, expect, beforeEach, jest } from "@jest/globals";

const mockQuery = jest.fn();
const mockRelease = jest.fn();

const mockConnect = jest.fn(async () => ({
  query: mockQuery,
  release: mockRelease,
}));

jest.unstable_mockModule("../../db/db.js", () => ({
  pool: {
    connect: mockConnect,
  },
}));

const {
  verifierCourrielDejaInscritTournoi,
  verifierConflitsNomsJoueursTournoi,
  inscriptionCreerEquipe,
  inscriptionRejoindreEquipe,
  inscriptionCommandite,
} = await import("../../dal/inscriptionTournoi.repository.js");

beforeEach(() => {
  mockQuery.mockReset();
  mockRelease.mockReset();
  mockConnect.mockClear();
});

/* =============================================================================
   Helpers — séquences de mocks pour getDisponibiliteTournoi
   
   getDisponibiliteTournoi appelle dans l'ordre :
   1. getTournoi           → SELECT id, inscriptions_ouvertes, capacite_joueurs, nombre_equipes_max, limite_commandites
   2. countEquipes         → SELECT COUNT(*) AS total FROM equipes
   3. countParticipantsTournoi → SELECT (participants + joueurs_commandites PAYE) AS total
   4. countParticipantsPersonnelTournoi → SELECT COUNT(*) AS total FROM participants WHERE type = EMPLOYE_RETRAITE
   5. countJoueursCommanditesTournoi    → SELECT COUNT(*) AS total FROM joueurs_commandites PAYE
============================================================================= */

/**
 * Mock une séquence complète de getDisponibiliteTournoi
 * avec des valeurs laissant des places disponibles.
 */
function mockDisponibiliteOuverte() {
  // 1. getTournoi
  mockQuery.mockResolvedValueOnce({
    rows: [{
      id: 1,
      inscriptions_ouvertes: true,
      capacite_joueurs: 100,
      nombre_equipes_max: 25,
      limite_commandites: 20,
    }],
  });
  // 2. countEquipes
  mockQuery.mockResolvedValueOnce({ rows: [{ total: 5 }] });
  // 3. countParticipantsTournoi
  mockQuery.mockResolvedValueOnce({ rows: [{ total: 10 }] });
  // 4. countParticipantsPersonnelTournoi
  mockQuery.mockResolvedValueOnce({ rows: [{ total: 8 }] });
  // 5. countJoueursCommanditesTournoi
  mockQuery.mockResolvedValueOnce({ rows: [{ total: 2 }] });
}

/* =============================================================================
   verifierCourrielDejaInscritTournoi
============================================================================= */

describe("verifierCourrielDejaInscritTournoi()", () => {
  test("retourne existe=true si courriel trouvé", async () => {
    mockQuery.mockResolvedValueOnce({ rowCount: 1 });

    const result = await verifierCourrielDejaInscritTournoi(1, "test@mail.com");

    expect(result).toEqual({ existe: true });
    expect(mockRelease).toHaveBeenCalled();
  });

  test("retourne existe=false si aucun courriel trouvé", async () => {
    mockQuery.mockResolvedValueOnce({ rowCount: 0 });

    const result = await verifierCourrielDejaInscritTournoi(1, "new@mail.com");

    expect(result).toEqual({ existe: false });
  });

  test("retourne false si paramètres invalides", async () => {
    const result = await verifierCourrielDejaInscritTournoi(null, "");

    expect(result).toEqual({ existe: false });
  });
});

/* =============================================================================
   verifierConflitsNomsJoueursTournoi
============================================================================= */

describe("verifierConflitsNomsJoueursTournoi()", () => {
  test("retourne conflit=true si nom existe", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ p: "ali", n: "dupont" }],
    });

    const result = await verifierConflitsNomsJoueursTournoi(1, [
      { prenom: "Ali", nom: "Dupont" },
    ]);

    expect(result.conflit).toBe(true);
  });

  test("retourne conflit=false si aucun conflit", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const result = await verifierConflitsNomsJoueursTournoi(1, [
      { prenom: "Ali", nom: "Test" },
    ]);

    expect(result.conflit).toBe(false);
  });
});

/* =============================================================================
   inscriptionCreerEquipe
   
   Séquence complète :
   BEGIN
   → getDisponibiliteTournoi (5 requêtes)
   → [si totalParticipants check] countParticipantsTournoi (1 requête)
   → teamNameExistsInTournoi
   → emailExistsInTournoi
   → insertParticipant
   → insertEquipeWithUniqueCode (INSERT)
   → insertMembreEquipe
   COMMIT
============================================================================= */

describe("inscriptionCreerEquipe()", () => {
  test("crée participant + équipe avec succès", async () => {
    mockQuery
      .mockResolvedValueOnce(undefined) // BEGIN
      // getDisponibiliteTournoi (5 requêtes)
      .mockResolvedValueOnce({
        rows: [{
          id: 1,
          inscriptions_ouvertes: true,
          capacite_joueurs: 100,
          nombre_equipes_max: 25,
          limite_commandites: 20,
        }],
      }) // getTournoi
      .mockResolvedValueOnce({ rows: [{ total: 5 }] })  // countEquipes
      .mockResolvedValueOnce({ rows: [{ total: 10 }] }) // countParticipantsTournoi
      .mockResolvedValueOnce({ rows: [{ total: 8 }] })  // countParticipantsPersonnelTournoi
      .mockResolvedValueOnce({ rows: [{ total: 2 }] })  // countJoueursCommanditesTournoi
      // check capacité totale
      .mockResolvedValueOnce({ rows: [{ total: 10 }] }) // countParticipantsTournoi (2e appel)
      // vérifications unicité
      .mockResolvedValueOnce({ rowCount: 0 }) // teamNameExistsInTournoi
      .mockResolvedValueOnce({ rowCount: 0 }) // emailExistsInTournoi
      // INSERT participant
      .mockResolvedValueOnce({
        rows: [{ id: 1, prenom: "Ali", nom: "Test", courriel: "ali@mail.com" }],
      })
      // INSERT équipe
      .mockResolvedValueOnce({
        rows: [{
          id: 10,
          tournoi_id: 1,
          nom_equipe: "Equipe A",
          code_secret: "ABC123",
          date_creation: new Date(),
        }],
      })
      .mockResolvedValueOnce({}) // insertMembreEquipe
      .mockResolvedValueOnce({}); // COMMIT

    const result = await inscriptionCreerEquipe({
      tournoi_id: 1,
      prenom: "Ali",
      nom: "Test",
      courriel: "ali@mail.com",
      nom_equipe: "Equipe A",
    });

    expect(result.participant).toBeDefined();
    expect(result.equipe).toBeDefined();
    expect(result.equipe.id).toBe(10);
  });

  test("retourne erreur si tournoi inexistant", async () => {
    mockQuery
      .mockResolvedValueOnce({})  // BEGIN
      .mockResolvedValueOnce({ rows: [] }) // getTournoi → vide
      .mockResolvedValueOnce({}); // ROLLBACK

    const result = await inscriptionCreerEquipe({ tournoi_id: 99 });

    expect(result.error.status).toBe(404);
  });
});

/* =============================================================================
   inscriptionRejoindreEquipe

   Séquence :
   BEGIN
   → getTournoi (1 requête)
   → countParticipantsTournoi (si capacite > 0)
   → findEquipeByCode
   → countMembresEquipe
   → emailExistsInTournoi
   → insertParticipant
   → insertMembreEquipe
   COMMIT
============================================================================= */

describe("inscriptionRejoindreEquipe()", () => {
  test("rejoint une équipe existante", async () => {
    mockQuery
      .mockResolvedValueOnce({}) // BEGIN
      .mockResolvedValueOnce({
        rows: [{
          id: 1,
          inscriptions_ouvertes: true,
          capacite_joueurs: 100,
          nombre_equipes_max: 25,
          limite_commandites: 10,
        }],
      }) // getTournoi
      .mockResolvedValueOnce({ rows: [{ total: 10 }] }) // countParticipantsTournoi
      .mockResolvedValueOnce({
        rows: [{
          id: 1,
          tournoi_id: 1,
          nom_equipe: "Equipe A",
          code_secret: "ABC123",
        }],
      }) // findEquipeByCode
      .mockResolvedValueOnce({ rows: [{ total: 2 }] }) // countMembresEquipe
      .mockResolvedValueOnce({ rowCount: 0 }) // emailExistsInTournoi
      .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // insertParticipant
      .mockResolvedValueOnce({}) // insertMembreEquipe
      .mockResolvedValueOnce({}); // COMMIT

    const result = await inscriptionRejoindreEquipe({
      tournoi_id: 1,
      code_equipe: "ABC123",
      prenom: "Ali",
      nom: "Test",
      courriel: "new@mail.com",
    });

    expect(result.participant).toBeDefined();
    expect(result.equipe).toBeDefined();
  });
});

/* =============================================================================
   inscriptionCommandite

   Séquence :
   BEGIN
   → getTournoi
   → total places commanditées PAYEES (si limite > 0)
   → loadNomsJoueursDejaInscritsTournoi
   → pour chaque type : SELECT types_commandites + count commandites PAYEES for type + INSERT commandite
   COMMIT
============================================================================= */

describe("inscriptionCommandite()", () => {
  test("crée une commandite avec succès", async () => {
    mockQuery
      .mockResolvedValueOnce({}) // BEGIN
      .mockResolvedValueOnce({
        rows: [{
          id: 1,
          inscriptions_ouvertes: true,
          capacite_joueurs: 100,
          nombre_equipes_max: 25,
          limite_commandites: 10,
        }],
      }) // getTournoi
      .mockResolvedValueOnce({ rows: [{ total: 1 }] }) // total places commanditees PAYEES
      .mockResolvedValueOnce({ rows: [] }) // loadNomsJoueursDejaInscritsTournoi
      .mockResolvedValueOnce({
        rows: [{
          id: 1,
          tournoi_id: 1,
          quota: 5,
          places_incluses: 0,
          nom: "Or",
        }],
      }) // select type commandite
      .mockResolvedValueOnce({ rows: [{ total: 1 }] }) // count commandites for type
      .mockResolvedValueOnce({
        rows: [{
          id: 10,
          tournoi_id: 1,
          type_commandite_id: 1,
          nom_entreprise: "Entreprise Test",
        }],
      }) // insert commandite
      .mockResolvedValueOnce({}); // COMMIT

    const result = await inscriptionCommandite({
      tournoi_id: 1,
      type_commandite_id: 1,
      nom_entreprise: "Entreprise Test",
      nom_contact: "Ali",
      courriel_contact: "contact@mail.com",
    });

    expect(result.commandites).toBeDefined();
    expect(result.commandites).toHaveLength(1);
  });
});