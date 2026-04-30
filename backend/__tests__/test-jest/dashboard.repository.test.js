/**
 * =============================================================================
 * TESTS — dashboard.repository.js
 * =============================================================================
 *
 * Objectif :
 * Tester la fonction du repository utilisée
 * pour récupérer les statistiques du dashboard admin.
 *
 * Fonction testée :
 * - getDashboardStats
 *
 * Approche :
 * - mock de pool.query
 * - vérification des valeurs retournées
 * - vérification des valeurs par défaut
 */

import { describe, test, expect, beforeEach, jest } from "@jest/globals";

/**
 * Mock principal de pool.query.
 */
const mockPoolQuery = jest.fn();

/**
 * Mock du module db.js.
 *
 * On remplace les accès réels à la base
 * par un mock contrôlé dans les tests.
 */
jest.unstable_mockModule("../../db/db.js", () => ({
  pool: {
    query: mockPoolQuery,
  },
}));

/**
 * Import du repository après le mock.
 */
const { getDashboardStats } = await import("../../dal/dashboard.repository.js");

/**
 * Réinitialise les mocks avant chaque test.
 */
beforeEach(() => {
  jest.clearAllMocks();
});

/**
 * ============================================================================
 * TESTS getDashboardStats()
 * ============================================================================
 */
describe("getDashboardStats()", () => {
  test("retourne les statistiques du dashboard", async () => {
    mockPoolQuery.mockResolvedValueOnce({
      rows: [
        {
          tournois: 3,
          equipes: 12,
          joueurs: 48,
          commandites: 7,
        },
      ],
    });

    const result = await getDashboardStats();

    expect(result).toEqual({
      tournois: 3,
      equipes: 12,
      joueurs: 48,
      commandites: 7,
    });

    expect(mockPoolQuery).toHaveBeenCalledTimes(1);
  });

  test("retourne des zéros si aucune ligne n'est retournée", async () => {
    mockPoolQuery.mockResolvedValueOnce({
      rows: [],
    });

    const result = await getDashboardStats();

    expect(result).toEqual({
      tournois: 0,
      equipes: 0,
      joueurs: 0,
      commandites: 0,
    });
  });

  test("retourne 0 pour les champs absents", async () => {
    mockPoolQuery.mockResolvedValueOnce({
      rows: [
        {
          tournois: 5,
        },
      ],
    });

    const result = await getDashboardStats();

    expect(result).toEqual({
      tournois: 5,
      equipes: 0,
      joueurs: 0,
      commandites: 0,
    });
  });
});