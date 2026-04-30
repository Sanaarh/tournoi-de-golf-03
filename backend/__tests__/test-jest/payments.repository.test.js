/**
 * =============================================================================
 * TESTS — payments.repository.js
 * =============================================================================
 *
 * Objectif :
 * Tester les opérations liées aux paiements :
 *
 * Fonctions testées :
 * - createPaiementEnAttente
 * - findTournoiForPayment
 * - findPaiementByStripeSessionId
 * - markPaiementEchec
 * - markPaiementPaye
 * - findConfirmationBySessionId
 *
 * Approche :
 * - Mock du pool.query
 * - Vérification des valeurs retournées
 * - Vérification des paramètres SQL
 */

import { describe, test, expect, beforeEach, jest } from "@jest/globals";

/**
 * Mock principal de pool.query
 */
const mockQuery = jest.fn();

/**
 * Mock du module db.js
 *
 * Remplace pool.query par notre mock.
 */
jest.unstable_mockModule("../../db/db.js", () => ({
  pool: {
    query: mockQuery,
  },
}));

/**
 * Import du repository après mock
 */
const {
  createPaiementEnAttente,
  findTournoiForPayment,
  findPaiementByStripeSessionId,
  markPaiementEchec,
  markPaiementPaye,
  findConfirmationBySessionId,
} = await import("../../dal/payments.repository.js");

/**
 * Reset des mocks avant chaque test
 */
beforeEach(() => {
  jest.clearAllMocks();
});

/* =============================================================================
   createPaiementEnAttente
============================================================================= */

describe("createPaiementEnAttente()", () => {
  test("crée un paiement en attente", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 10 }],
    });

    const result = await createPaiementEnAttente({
      tournoiId: 1,
      montantCents: 5000,
      stripeSessionId: "sess_123",
      participantId: 2,
    });

    expect(result).toEqual({ id: 10 });

    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO paiements"),
      [1, 2, null, 5000, "sess_123"]
    );
  });

  test("retourne null si aucun résultat", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [],
    });

    const result = await createPaiementEnAttente({
      tournoiId: 1,
      montantCents: 5000,
      stripeSessionId: "sess_123",
    });

    expect(result).toBeNull();
  });
});

/* =============================================================================
   findTournoiForPayment
============================================================================= */

describe("findTournoiForPayment()", () => {
  test("retourne un tournoi existant", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: 1,
          nom: "Tournoi Test",
          prix_joueur: 100,
          inscriptions_ouvertes: true,
        },
      ],
    });

    const result = await findTournoiForPayment(1);

    expect(result.nom).toBe("Tournoi Test");
  });

  test("retourne null si tournoi absent", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [],
    });

    const result = await findTournoiForPayment(99);

    expect(result).toBeNull();
  });
});

/* =============================================================================
   findPaiementByStripeSessionId
============================================================================= */

describe("findPaiementByStripeSessionId()", () => {
  test("retourne un paiement existant", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: 1,
          statut: "EN_ATTENTE",
          tournoi_id: 1,
        },
      ],
    });

    const result =
      await findPaiementByStripeSessionId("sess_123");

    expect(result.id).toBe(1);
  });

  test("retourne null si non trouvé", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [],
    });

    const result =
      await findPaiementByStripeSessionId("unknown");

    expect(result).toBeNull();
  });
});

/* =============================================================================
   markPaiementEchec
============================================================================= */

describe("markPaiementEchec()", () => {
  test("met à jour le statut ECHEC", async () => {
    mockQuery.mockResolvedValueOnce({});

    await markPaiementEchec({
      stripeSessionId: "sess_123",
      paymentIntentId: "pi_456",
    });

    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE paiements"),
      ["pi_456", "sess_123"]
    );
  });
});

/* =============================================================================
   markPaiementPaye
============================================================================= */

describe("markPaiementPaye()", () => {
  test("met à jour le statut PAYE", async () => {
    mockQuery.mockResolvedValueOnce({});

    await markPaiementPaye({
      stripeSessionId: "sess_123",
      paymentIntentId: "pi_456",
      participantId: 2,
      commanditeId: null,
    });

    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE paiements"),
      ["pi_456", 2, null, "sess_123"]
    );
  });
});

/* =============================================================================
   findConfirmationBySessionId
============================================================================= */

describe("findConfirmationBySessionId()", () => {
  test("retourne une confirmation complète", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          paiement_id: 1,
          participant_prenom: "Ali",
          nom_equipe: "Equipe A",
        },
      ],
    });

    const result =
      await findConfirmationBySessionId("sess_123");

    expect(result.paiement_id).toBe(1);
  });

  test("retourne null si non trouvé", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [],
    });

    const result =
      await findConfirmationBySessionId("sess_x");

    expect(result).toBeNull();
  });
});