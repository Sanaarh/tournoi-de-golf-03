/**
 * =============================================================================
 * TESTS — types-commandites.repository.js
 * =============================================================================
 *
 * Fonctions testées :
 * - listTypesCommandites
 * - listTypesCommanditesByTournoi
 * - findTypeCommanditeById
 * - sumQuotasTypesForTournoi
 * - countCommanditesForType
 * - createTypeCommandite
 * - updateTypeCommandite
 * - deleteTypeCommandite
 */

import { describe, test, expect, beforeEach, jest } from "@jest/globals";

/**
 * Mock query
 */
const mockQuery = jest.fn();
const mockRelease = jest.fn();

/**
 * Mock connect()
 */
const mockConnect = jest.fn(async () => ({
  query: mockQuery,
  release: mockRelease,
}));

/**
 * Mock db
 */
jest.unstable_mockModule("../../db/db.js", () => ({
  pool: {
    query: mockQuery,
    connect: mockConnect,
  },
}));

/**
 * Import repository
 */
const {
  listTypesCommandites,
  listTypesCommanditesByTournoi,
  findTypeCommanditeById,
  sumQuotasTypesForTournoi,
  countCommanditesForType,
  createTypeCommandite,
  updateTypeCommandite,
  deleteTypeCommandite,
} = await import("../../dal/types-commandites.repository.js");

/**
 * Reset mocks
 */
beforeEach(() => {
  jest.clearAllMocks();
});

/* =============================================================================
   listTypesCommandites
============================================================================= */

describe("listTypesCommandites()", () => {
  test("retourne une liste de types", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 1 }],
    });

    const result = await listTypesCommandites();

    expect(result.length).toBe(1);
  });
});

/* =============================================================================
   listTypesCommanditesByTournoi
============================================================================= */

describe("listTypesCommanditesByTournoi()", () => {
  test("retourne les types d'un tournoi", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 2 }],
    });

    const result = await listTypesCommanditesByTournoi(1);

    expect(result[0].id).toBe(2);
  });
});

/* =============================================================================
   findTypeCommanditeById
============================================================================= */

describe("findTypeCommanditeById()", () => {
  test("retourne un type existant", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 1 }],
    });

    const result = await findTypeCommanditeById(1);

    expect(result.id).toBe(1);
  });

  test("retourne null si absent", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [],
    });

    const result = await findTypeCommanditeById(99);

    expect(result).toBeNull();
  });
});

/* =============================================================================
   sumQuotasTypesForTournoi
============================================================================= */

describe("sumQuotasTypesForTournoi()", () => {
  test("retourne la somme des quotas", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ total: 10 }],
    });

    const result =
      await sumQuotasTypesForTournoi(1);

    expect(result).toBe(10);
  });
});

/* =============================================================================
   countCommanditesForType
============================================================================= */

describe("countCommanditesForType()", () => {
  test("retourne le nombre de commandites", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ total: 5 }],
    });

    const result =
      await countCommanditesForType(1);

    expect(result).toBe(5);
  });
});

/* =============================================================================
   createTypeCommandite
============================================================================= */

describe("createTypeCommandite()", () => {
  test("crée un type", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 1 }],
    });

    const result =
      await createTypeCommandite({
        tournoi_id: 1,
        nom: "Or",
        prix_cents: 50000,
        quota: 5,
        places_incluses: 4,
      });

    expect(result.id).toBe(1);
  });
});

/* =============================================================================
   updateTypeCommandite
============================================================================= */

describe("updateTypeCommandite()", () => {
  test("met à jour un type existant", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 1 }],
    });

    const result =
      await updateTypeCommandite(1, {
        tournoi_id: 1,
        nom: "Argent",
        prix_cents: 30000,
        quota: 3,
        places_incluses: 2,
      });

    expect(result.id).toBe(1);
  });

  test("retourne null si introuvable", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [],
    });

    const result =
      await updateTypeCommandite(99, {});

    expect(result).toBeNull();
  });
});

/* =============================================================================
   deleteTypeCommandite
============================================================================= */

describe("deleteTypeCommandite()", () => {
  test("supprime un type avec transaction", async () => {
    mockQuery
      .mockResolvedValueOnce({}) // BEGIN
      .mockResolvedValueOnce({}) // DELETE commandites
      .mockResolvedValueOnce({
        rows: [{ id: 1 }],
      }) // DELETE type
      .mockResolvedValueOnce({}); // COMMIT

    const result =
      await deleteTypeCommandite(1);

    expect(result.id).toBe(1);
    expect(mockRelease).toHaveBeenCalled();
  });

  test("rollback si erreur", async () => {
    mockQuery
      .mockResolvedValueOnce({}) // BEGIN
      .mockRejectedValueOnce(new Error("SQL ERROR"));

    await expect(
      deleteTypeCommandite(1)
    ).rejects.toThrow();

    expect(mockRelease).toHaveBeenCalled();
  });
});