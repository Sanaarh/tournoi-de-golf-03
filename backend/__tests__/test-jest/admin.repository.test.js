/**
 * =============================================================================
 * TESTS — admin.repository.js
 * =============================================================================
 *
 * Objectif :
 * Tester les fonctions du repository des administrateurs.
 *
 * Fonctions testées :
 * - findAdminByUsername
 * - findAdminById
 * - listAdmins
 * - createAdmin
 * - updateAdmin
 * - deleteAdminById
 * - countAdmins
 *
 * Approche :
 * - mock de pool.query
 * - vérification des valeurs retournées
 * - vérification des cas limites
 */

import { describe, test, expect, beforeEach, jest } from "@jest/globals";

/**
 * Mock principal de pool.query
 */
const mockPoolQuery = jest.fn();

/**
 * Mock du module db.js
 */
jest.unstable_mockModule("../../db/db.js", () => ({
  pool: {
    query: mockPoolQuery,
  },
}));

/**
 * Import du repository après la déclaration du mock.
 */
const {
  findAdminByUsername,
  findAdminById,
  listAdmins,
  createAdmin,
  updateAdmin,
  deleteAdminById,
  countAdmins,
} = await import("../../dal/admin.repository.js");

/**
 * Réinitialise les mocks entre les tests.
 */
beforeEach(() => {
  jest.clearAllMocks();
});

/**
 * ============================================================================
 * TESTS findAdminByUsername()
 * ============================================================================
 */
describe("findAdminByUsername()", () => {
  test("retourne un admin complet si trouvé", async () => {
    mockPoolQuery.mockResolvedValueOnce({
      rows: [
        {
          id: 1,
          nom_utilisateur: "admin",
          mot_de_passe_hash: "hash123",
          date_creation: "2026-04-15",
        },
      ],
    });

    const result = await findAdminByUsername("admin");

    expect(result).toEqual({
      id: 1,
      nom_utilisateur: "admin",
      mot_de_passe_hash: "hash123",
      date_creation: "2026-04-15",
    });
    expect(mockPoolQuery).toHaveBeenCalledTimes(1);
  });

  test("retourne null si aucun admin trouvé", async () => {
    mockPoolQuery.mockResolvedValueOnce({
      rows: [],
    });

    const result = await findAdminByUsername("introuvable");

    expect(result).toBeNull();
  });
});

/**
 * ============================================================================
 * TESTS findAdminById()
 * ============================================================================
 */
describe("findAdminById()", () => {
  test("retourne un admin sans hash si trouvé", async () => {
    mockPoolQuery.mockResolvedValueOnce({
      rows: [
        {
          id: 2,
          nom_utilisateur: "ali",
          date_creation: "2026-04-15",
        },
      ],
    });

    const result = await findAdminById(2);

    expect(result).toEqual({
      id: 2,
      nom_utilisateur: "ali",
      date_creation: "2026-04-15",
    });
  });

  test("retourne null si l'id n'existe pas", async () => {
    mockPoolQuery.mockResolvedValueOnce({
      rows: [],
    });

    const result = await findAdminById(999);

    expect(result).toBeNull();
  });
});

/**
 * ============================================================================
 * TESTS listAdmins()
 * ============================================================================
 */
describe("listAdmins()", () => {
  test("retourne la liste des administrateurs", async () => {
    const rows = [
      { id: 1, nom_utilisateur: "admin1", date_creation: "2026-04-10" },
      { id: 2, nom_utilisateur: "admin2", date_creation: "2026-04-11" },
    ];

    mockPoolQuery.mockResolvedValueOnce({ rows });

    const result = await listAdmins();

    expect(result).toEqual(rows);
  });

  test("retourne un tableau vide s'il n'y a aucun admin", async () => {
    mockPoolQuery.mockResolvedValueOnce({
      rows: [],
    });

    const result = await listAdmins();

    expect(result).toEqual([]);
  });
});

/**
 * ============================================================================
 * TESTS createAdmin()
 * ============================================================================
 */
describe("createAdmin()", () => {
  test("retourne l'admin créé", async () => {
    mockPoolQuery.mockResolvedValueOnce({
      rows: [
        {
          id: 3,
          nom_utilisateur: "nouveauAdmin",
          date_creation: "2026-04-15",
        },
      ],
    });

    const result = await createAdmin("nouveauAdmin", "hash456");

    expect(result).toEqual({
      id: 3,
      nom_utilisateur: "nouveauAdmin",
      date_creation: "2026-04-15",
    });
    expect(mockPoolQuery).toHaveBeenCalledTimes(1);
  });
});

/**
 * ============================================================================
 * TESTS updateAdmin()
 * ============================================================================
 */
describe("updateAdmin()", () => {
  test("retourne null si aucun champ à mettre à jour", async () => {
    const result = await updateAdmin(1, {});

    expect(result).toBeNull();
    expect(mockPoolQuery).not.toHaveBeenCalled();
  });

  test("met à jour seulement nom_utilisateur", async () => {
    mockPoolQuery.mockResolvedValueOnce({
      rows: [
        {
          id: 1,
          nom_utilisateur: "adminModifie",
          date_creation: "2026-04-01",
        },
      ],
    });

    const result = await updateAdmin(1, {
      nom_utilisateur: "adminModifie",
    });

    expect(result).toEqual({
      id: 1,
      nom_utilisateur: "adminModifie",
      date_creation: "2026-04-01",
    });
  });

  test("met à jour seulement mot_de_passe_hash", async () => {
    mockPoolQuery.mockResolvedValueOnce({
      rows: [
        {
          id: 1,
          nom_utilisateur: "admin",
          date_creation: "2026-04-01",
        },
      ],
    });

    const result = await updateAdmin(1, {
      mot_de_passe_hash: "nouveauHash",
    });

    expect(result).toEqual({
      id: 1,
      nom_utilisateur: "admin",
      date_creation: "2026-04-01",
    });
  });

  test("met à jour les deux champs", async () => {
    mockPoolQuery.mockResolvedValueOnce({
      rows: [
        {
          id: 1,
          nom_utilisateur: "adminFinal",
          date_creation: "2026-04-01",
        },
      ],
    });

    const result = await updateAdmin(1, {
      nom_utilisateur: "adminFinal",
      mot_de_passe_hash: "hashFinal",
    });

    expect(result).toEqual({
      id: 1,
      nom_utilisateur: "adminFinal",
      date_creation: "2026-04-01",
    });
  });

  test("retourne null si l'admin n'existe pas", async () => {
    mockPoolQuery.mockResolvedValueOnce({
      rows: [],
    });

    const result = await updateAdmin(999, {
      nom_utilisateur: "ghost",
    });

    expect(result).toBeNull();
  });
});

/**
 * ============================================================================
 * TESTS deleteAdminById()
 * ============================================================================
 */
describe("deleteAdminById()", () => {
  test("retourne 1 si suppression réussie", async () => {
    mockPoolQuery.mockResolvedValueOnce({
      rowCount: 1,
    });

    const result = await deleteAdminById(1);

    expect(result).toBe(1);
  });

  test("retourne 0 si aucun admin supprimé", async () => {
    mockPoolQuery.mockResolvedValueOnce({
      rowCount: 0,
    });

    const result = await deleteAdminById(999);

    expect(result).toBe(0);
  });
});

/**
 * ============================================================================
 * TESTS countAdmins()
 * ============================================================================
 */
describe("countAdmins()", () => {
  test("retourne le nombre total d'admins", async () => {
    mockPoolQuery.mockResolvedValueOnce({
      rows: [{ total: 5 }],
    });

    const result = await countAdmins();

    expect(result).toBe(5);
  });

  test("retourne 0 si rows est vide", async () => {
    mockPoolQuery.mockResolvedValueOnce({
      rows: [],
    });

    const result = await countAdmins();

    expect(result).toBe(0);
  });

  test("retourne 0 si total est absent", async () => {
    mockPoolQuery.mockResolvedValueOnce({
      rows: [{}],
    });

    const result = await countAdmins();

    expect(result).toBe(0);
  });
});