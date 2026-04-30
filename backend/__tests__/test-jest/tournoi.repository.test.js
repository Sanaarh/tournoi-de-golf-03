/**
 * =============================================================================
 * TESTS — tournoi.repository.js
 * =============================================================================
 *
 * Fonctions testées :
 * - listTournois
 * - findActiveTournoi
 * - findTournoiById
 * - createTournoi
 * - updateTournoi
 * - existsTournoiByNom
 * - deleteTournoi
 */

import { describe, test, expect, beforeEach, jest } from "@jest/globals";

/**
 * Mock principal de pool.query
 */
const mockQuery = jest.fn();

/**
 * Mock du module db.js
 */
jest.unstable_mockModule("../../db/db.js", () => ({
  pool: {
    query: mockQuery,
  },
}));

/**
 * Import après mock
 */
const {
  listTournois,
  findActiveTournoi,
  findTournoiById,
  createTournoi,
  updateTournoi,
  existsTournoiByNom,
  deleteTournoi,
} = await import("../../dal/tournoi.repository.js");

/**
 * Reset mocks
 */
beforeEach(() => {
  jest.clearAllMocks();
});

/* =============================================================================
   listTournois
============================================================================= */

describe("listTournois()", () => {
  test("retourne une liste de tournois", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 1, nom: "Tournoi A" }],
    });

    const result = await listTournois();

    expect(result.length).toBe(1);
    expect(result[0].nom).toBe("Tournoi A");
  });
});

/* =============================================================================
   findActiveTournoi
============================================================================= */

describe("findActiveTournoi()", () => {
  test("retourne un tournoi actif", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 1 }],
    });

    const result = await findActiveTournoi();

    expect(result.id).toBe(1);
  });

  test("retourne null si aucun tournoi actif", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [],
    });

    const result = await findActiveTournoi();

    expect(result).toBeNull();
  });
});

/* =============================================================================
   findTournoiById
============================================================================= */

describe("findTournoiById()", () => {
  test("retourne un tournoi existant", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 5 }],
    });

    const result = await findTournoiById(5);

    expect(result.id).toBe(5);
  });

  test("retourne null si introuvable", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [],
    });

    const result = await findTournoiById(99);

    expect(result).toBeNull();
  });
});

/* =============================================================================
   createTournoi
============================================================================= */

describe("createTournoi()", () => {
  test("crée un tournoi", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 1, nom: "Tournoi X" }],
    });

    const result = await createTournoi({
      nom: "Tournoi X",
      lieu: "Ottawa",
      date_tournoi: "2026-06-01",
      inscription_debut: null,
      inscription_fin: null,
      inscriptions_ouvertes: true,
      capacite_joueurs: 100,
      nombre_equipes_max: 25,
      limite_commandites: 10,
      prix_joueur: 150,
    });

    expect(result.nom).toBe("Tournoi X");
  });
});

/* =============================================================================
   updateTournoi
============================================================================= */

describe("updateTournoi()", () => {
  test("met à jour un tournoi existant", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 1 }],
    });

    const result = await updateTournoi(1, {
      nom: "Tournoi Modifié",
      lieu: "Montréal",
      date_tournoi: "2026-07-01",
      inscription_debut: null,
      inscription_fin: null,
      inscriptions_ouvertes: false,
      capacite_joueurs: 80,
      nombre_equipes_max: 20,
      limite_commandites: 5,
      prix_joueur: 120,
    });

    expect(result.id).toBe(1);
  });

  test("retourne null si tournoi absent", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [],
    });

    const result = await updateTournoi(99, {});

    expect(result).toBeNull();
  });
});

/* =============================================================================
   existsTournoiByNom
============================================================================= */

describe("existsTournoiByNom()", () => {
  test("retourne true si existe", async () => {
    mockQuery.mockResolvedValueOnce({
      rowCount: 1,
    });

    const result = await existsTournoiByNom("Tournoi A");

    expect(result).toBe(true);
  });

  test("retourne false si inexistant", async () => {
    mockQuery.mockResolvedValueOnce({
      rowCount: 0,
    });

    const result = await existsTournoiByNom("XYZ");

    expect(result).toBe(false);
  });
});

/* =============================================================================
   deleteTournoi
============================================================================= */

describe("deleteTournoi()", () => {
  test("supprime un tournoi existant", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 1 }],
    });

    const result = await deleteTournoi(1);

    expect(result.id).toBe(1);
  });

  test("retourne null si introuvable", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [],
    });

    const result = await deleteTournoi(99);

    expect(result).toBeNull();
  });
});