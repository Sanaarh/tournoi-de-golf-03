/**
 * =============================================================================
 * TESTS — admin.commandites.repository.js
 * =============================================================================
 *
 * Objectif :
 * Vérifier les fonctions du repository admin des commandites.
 *
 * Fonctions testées :
 * - listCommanditesByTournoi
 * - findCommanditeAdminById
 * - updateCommanditeById
 * - deleteCommanditeById
 *
 * Particularité :
 * Ce fichier utilise des mocks pour :
 * - la connexion PostgreSQL (pool / client)
 * - la vérification des conflits de joueurs dans le tournoi
 */

import { describe, test, expect, beforeEach, jest } from "@jest/globals";

/**
 * Mocks partagés.
 *
 * pool.query :
 * - utilisé pour les fonctions simples
 *
 * pool.connect :
 * - utilisé par la transaction dans updateCommanditeById()
 *
 * verifierConflitsMock :
 * - mock de la fonction externe qui vérifie les conflits
 */
const mockPoolQuery = jest.fn();
const mockClientQuery = jest.fn();
const mockRelease = jest.fn();

const mockPoolConnect = jest.fn(() => ({
  query: mockClientQuery,
  release: mockRelease,
}));

const verifierConflitsMock = jest.fn();

/**
 * Mock du module db.js
 */
jest.unstable_mockModule("../../db/db.js", () => ({
  pool: {
    query: mockPoolQuery,
    connect: mockPoolConnect,
  },
}));

/**
 * Mock du module inscriptionTournoi.repository.js
 */
jest.unstable_mockModule("../../dal/inscriptionTournoi.repository.js", () => ({
  verifierConflitsNomsJoueursTournoiExcluantCommandite: verifierConflitsMock,
}));

/**
 * Import du repository APRÈS les mocks.
 *
 * En ESM avec unstable_mockModule, il faut importer après la déclaration
 * des mocks pour que Jest injecte bien les dépendances simulées.
 */
const {
  listCommanditesByTournoi,
  findCommanditeAdminById,
  updateCommanditeById,
  deleteCommanditeById,
} = await import("../../dal/admin.commandites.repository.js");

/**
 * Remise à zéro des mocks avant chaque test
 * pour éviter les interférences entre scénarios.
 */
beforeEach(() => {
  jest.clearAllMocks();
});

/**
 * ============================================================================
 * TESTS listCommanditesByTournoi()
 * ============================================================================
 */
describe("listCommanditesByTournoi()", () => {
  test("retourne [] si tournoiId invalide", async () => {
    const result = await listCommanditesByTournoi("abc");

    expect(result).toEqual([]);
    expect(mockPoolQuery).not.toHaveBeenCalled();
  });

  test("retourne les lignes de la requête SQL", async () => {
    const fakeRows = [
      {
        id: 1,
        tournoi_id: 10,
        nom_entreprise: "ABC Inc.",
        nb_joueurs: 4,
      },
    ];

    mockPoolQuery.mockResolvedValueOnce({
      rows: fakeRows,
    });

    const result = await listCommanditesByTournoi(10);

    expect(mockPoolQuery).toHaveBeenCalledTimes(1);
    expect(result).toEqual(fakeRows);
  });
});

/**
 * ============================================================================
 * TESTS findCommanditeAdminById()
 * ============================================================================
 */
describe("findCommanditeAdminById()", () => {
  test("retourne null si id invalide", async () => {
    const result = await findCommanditeAdminById(0);

    expect(result).toBeNull();
    expect(mockPoolQuery).not.toHaveBeenCalled();
  });

  test("retourne null si la commandite n'existe pas", async () => {
    mockPoolQuery.mockResolvedValueOnce({
      rowCount: 0,
      rows: [],
    });

    const result = await findCommanditeAdminById(5);

    expect(result).toBeNull();
    expect(mockPoolQuery).toHaveBeenCalledTimes(1);
  });

  test("retourne le détail de la commandite avec les joueurs", async () => {
    mockPoolQuery
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [
          {
            id: 5,
            tournoi_id: 1,
            type_commandite_id: 2,
            nom_entreprise: "Entreprise X",
            tournoi_nom: "Tournoi 2026",
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          { id: 1, prenom: "Ali", nom: "Test", ordre: 0 },
          { id: 2, prenom: "Sara", nom: "Test", ordre: 1 },
        ],
      });

    const result = await findCommanditeAdminById(5);

    expect(mockPoolQuery).toHaveBeenCalledTimes(2);
    expect(result).toEqual({
      id: 5,
      tournoi_id: 1,
      type_commandite_id: 2,
      nom_entreprise: "Entreprise X",
      tournoi_nom: "Tournoi 2026",
      joueurs: [
        { id: 1, prenom: "Ali", nom: "Test", ordre: 0 },
        { id: 2, prenom: "Sara", nom: "Test", ordre: 1 },
      ],
    });
  });
});

/**
 * ============================================================================
 * TESTS updateCommanditeById()
 * ============================================================================
 */
describe("updateCommanditeById()", () => {
  /**
   * Payload valide de base utilisé dans plusieurs tests.
   */
  const validPayload = {
    nom_entreprise: "Entreprise ABC",
    nom_contact: "Ali Squalli",
    courriel_contact: "ali@test.com",
    telephone_contact: "6130000000",
    statut: "EN_ATTENTE",
    type_commandite_id: 2,
    joueurs: [
      { prenom: "Jean", nom: "Dupont" },
      { prenom: "Sara", nom: "Martin" },
    ],
  };

  test("retourne NOT_FOUND si id invalide", async () => {
    const result = await updateCommanditeById("abc", validPayload);

    expect(result).toEqual({
      ok: false,
      code: "NOT_FOUND",
    });
    expect(mockPoolConnect).not.toHaveBeenCalled();
  });

  test("retourne BAD_TYPE si type_commandite_id invalide", async () => {
    const result = await updateCommanditeById(1, {
      ...validPayload,
      type_commandite_id: "abc",
    });

    expect(result).toEqual({
      ok: false,
      code: "BAD_TYPE",
    });
    expect(mockPoolConnect).not.toHaveBeenCalled();
  });

  test("retourne NOT_FOUND si la commandite n'existe pas", async () => {
    mockClientQuery
      .mockResolvedValueOnce(undefined) // BEGIN
      .mockResolvedValueOnce({
        rowCount: 0,
        rows: [],
      }) // SELECT ... FOR UPDATE
      .mockResolvedValueOnce(undefined); // ROLLBACK

    const result = await updateCommanditeById(1, validPayload);

    expect(result).toEqual({
      ok: false,
      code: "NOT_FOUND",
    });
    expect(mockClientQuery).toHaveBeenCalled();
    expect(mockRelease).toHaveBeenCalled();
  });

  test("retourne BAD_TYPE si le type de commandite ne correspond pas au tournoi", async () => {
    mockClientQuery
      .mockResolvedValueOnce(undefined) // BEGIN
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ id: 1, tournoi_id: 99, type_commandite_id: 1 }],
      })
      .mockResolvedValueOnce({
        rowCount: 0,
        rows: [],
      })
      .mockResolvedValueOnce(undefined); // ROLLBACK

    const result = await updateCommanditeById(1, validPayload);

    expect(result.ok).toBe(false);
    expect(result.code).toBe("BAD_TYPE");
    expect(result.message).toMatch(/invalide/i);
  });

  test("retourne QUOTA_TYPE si le quota du nouveau type est atteint", async () => {
    mockClientQuery
      .mockResolvedValueOnce(undefined) // BEGIN
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ id: 1, tournoi_id: 10, type_commandite_id: 1 }],
      })
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ id: 2, nom: "Forfait Or", places_incluses: 2, quota: 1 }],
      })
      .mockResolvedValueOnce({
        rows: [{ n: 1 }],
      })
      .mockResolvedValueOnce(undefined); // ROLLBACK

    const result = await updateCommanditeById(1, validPayload);

    expect(result.ok).toBe(false);
    expect(result.code).toBe("QUOTA_TYPE");
  });

  test("retourne JOUEURS_COUNT si le nombre de joueurs ne correspond pas aux places incluses", async () => {
    mockClientQuery
      .mockResolvedValueOnce(undefined) // BEGIN
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ id: 1, tournoi_id: 10, type_commandite_id: 2 }],
      })
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ id: 2, nom: "Forfait Or", places_incluses: 3, quota: 5 }],
      })
      .mockResolvedValueOnce(undefined); // ROLLBACK

    const result = await updateCommanditeById(1, validPayload);

    expect(result.ok).toBe(false);
    expect(result.code).toBe("JOUEURS_COUNT");
  });

  test("retourne JOUEURS_INCOMPLET si un joueur n'a pas prénom et nom", async () => {
    mockClientQuery
      .mockResolvedValueOnce(undefined) // BEGIN
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ id: 1, tournoi_id: 10, type_commandite_id: 2 }],
      })
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ id: 2, nom: "Forfait Or", places_incluses: 2, quota: 5 }],
      })
      .mockResolvedValueOnce(undefined); // ROLLBACK

    const result = await updateCommanditeById(1, {
      ...validPayload,
      joueurs: [
        { prenom: "Jean", nom: "Dupont" },
        { prenom: "", nom: "Martin" },
      ],
    });

    expect(result.ok).toBe(false);
    expect(result.code).toBe("JOUEURS_INCOMPLET");
  });

  test("retourne JOUEURS_DOUBLON si deux joueurs ont le même nom complet", async () => {
    mockClientQuery
      .mockResolvedValueOnce(undefined) // BEGIN
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ id: 1, tournoi_id: 10, type_commandite_id: 2 }],
      })
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ id: 2, nom: "Forfait Or", places_incluses: 2, quota: 5 }],
      })
      .mockResolvedValueOnce(undefined); // ROLLBACK

    const result = await updateCommanditeById(1, {
      ...validPayload,
      joueurs: [
        { prenom: "Jean", nom: "Dupont" },
        { prenom: "jean", nom: "dupont" },
      ],
    });

    expect(result.ok).toBe(false);
    expect(result.code).toBe("JOUEURS_DOUBLON");
  });

  test("retourne JOUEURS_CONFLIT si les joueurs existent déjà dans le tournoi", async () => {
    verifierConflitsMock.mockResolvedValueOnce({
      conflit: true,
    });

    mockClientQuery
      .mockResolvedValueOnce(undefined) // BEGIN
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ id: 1, tournoi_id: 10, type_commandite_id: 2 }],
      })
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ id: 2, nom: "Forfait Or", places_incluses: 2, quota: 5 }],
      })
      .mockResolvedValueOnce(undefined); // ROLLBACK

    const result = await updateCommanditeById(1, validPayload);

    expect(result.ok).toBe(false);
    expect(result.code).toBe("JOUEURS_CONFLIT");
    expect(verifierConflitsMock).toHaveBeenCalledTimes(1);
  });

  test("retourne ok=true si la mise à jour réussit", async () => {
    verifierConflitsMock.mockResolvedValueOnce({
      conflit: false,
    });

    mockClientQuery
      .mockResolvedValueOnce(undefined) // BEGIN
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ id: 1, tournoi_id: 10, type_commandite_id: 2 }],
      })
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ id: 2, nom: "Forfait Or", places_incluses: 2, quota: 5 }],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            tournoi_id: 10,
            type_commandite_id: 2,
            nom_entreprise: "Entreprise ABC",
            nom_contact: "Ali Squalli",
            courriel_contact: "ali@test.com",
            telephone_contact: "6130000000",
            statut: "EN_ATTENTE",
            date_creation: "2026-04-15",
          },
        ],
      }) // UPDATE
      .mockResolvedValueOnce(undefined) // DELETE joueurs
      .mockResolvedValueOnce(undefined) // INSERT joueur 1
      .mockResolvedValueOnce(undefined) // INSERT joueur 2
      .mockResolvedValueOnce(undefined); // COMMIT

    const result = await updateCommanditeById(1, validPayload);

    expect(result.ok).toBe(true);
    expect(result.row).toBeDefined();
    expect(mockRelease).toHaveBeenCalled();
  });

  test("fait un rollback si une erreur SQL est lancée", async () => {
    mockClientQuery
      .mockResolvedValueOnce(undefined) // BEGIN
      .mockRejectedValueOnce(new Error("DB failure")) // SELECT FOR UPDATE plante
      .mockResolvedValueOnce(undefined); // ROLLBACK

    await expect(updateCommanditeById(1, validPayload)).rejects.toThrow("DB failure");

    expect(mockRelease).toHaveBeenCalled();
  });
});

/**
 * ============================================================================
 * TESTS deleteCommanditeById()
 * ============================================================================
 */
describe("deleteCommanditeById()", () => {
  test("retourne false si id invalide", async () => {
    const result = await deleteCommanditeById("abc");

    expect(result).toBe(false);
    expect(mockPoolQuery).not.toHaveBeenCalled();
  });

  test("retourne false si aucune ligne supprimée", async () => {
    mockPoolQuery.mockResolvedValueOnce({
      rowCount: 0,
    });

    const result = await deleteCommanditeById(5);

    expect(result).toBe(false);
  });

  test("retourne true si suppression réussie", async () => {
    mockPoolQuery.mockResolvedValueOnce({
      rowCount: 1,
    });

    const result = await deleteCommanditeById(5);

    expect(result).toBe(true);
  });
});