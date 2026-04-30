/**
 * =============================================================================
 * TESTS — commandites.repository.js
 * =============================================================================
 */

import { describe, test, expect, beforeEach, jest } from "@jest/globals";

const mockPoolQuery = jest.fn();

jest.unstable_mockModule("../../db/db.js", () => ({
  pool: {
    query: mockPoolQuery,
  },
}));

const {
  findCommanditeForPayment,
  markCommanditePaye,
  markJoueursCommanditesPayes,
} = await import("../../dal/commandites.repository.js");

beforeEach(() => {
  jest.clearAllMocks();
});

/* ============================================================================
   findCommanditeForPayment()
============================================================================ */

describe("findCommanditeForPayment()", () => {
  test("retourne la commandite si trouvée", async () => {
    mockPoolQuery.mockResolvedValueOnce({
      rows: [{ id: 1, tournoi_id: 10, statut: "EN_ATTENTE" }],
    });

    const result = await findCommanditeForPayment(1);

    expect(result).toEqual({ id: 1, tournoi_id: 10, statut: "EN_ATTENTE" });
    expect(mockPoolQuery).toHaveBeenCalledTimes(1);
  });

  test("retourne null si aucune commandite trouvée", async () => {
    mockPoolQuery.mockResolvedValueOnce({ rows: [] });

    const result = await findCommanditeForPayment(999);

    expect(result).toBeNull();
    expect(mockPoolQuery).toHaveBeenCalledTimes(1);
  });
});

/* ============================================================================
   markCommanditePaye()
============================================================================ */

describe("markCommanditePaye()", () => {
  test("exécute la mise à jour du statut PAYE", async () => {
    mockPoolQuery.mockResolvedValueOnce({});

    await markCommanditePaye(5);

    expect(mockPoolQuery).toHaveBeenCalledTimes(1);
    expect(mockPoolQuery).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE commandites"),
      [5]
    );
  });
});

/* ============================================================================
   markJoueursCommanditesPayes()
============================================================================
   NOTE : La fonction est un no-op (void commanditeId) dans la version actuelle
   du repository — elle ne fait aucune requête SQL.
   Le test vérifie simplement qu'elle s'exécute sans erreur.
============================================================================ */

describe("markJoueursCommanditesPayes()", () => {
  test("s'exécute sans erreur (no-op dans la version actuelle)", async () => {
    await expect(markJoueursCommanditesPayes(7)).resolves.not.toThrow();

    // Aucune requête SQL n'est émise car la fonction est un no-op.
    expect(mockPoolQuery).toHaveBeenCalledTimes(0);
  });
});