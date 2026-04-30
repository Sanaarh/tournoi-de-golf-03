/**
 * --------------------------------------------------------------------
 * Tests des routes de paiement Stripe (payments.routes.js)
 * --------------------------------------------------------------------
 *
 * Fichier testé :
 * - routes/payments.routes.js
 *
 * Objectif :
 * Vérifier le bon fonctionnement des routes liées aux paiements
 * Stripe pour les inscriptions de participants et les paiements
 * de commandites.
 *
 * Routes couvertes :
 * - POST /payments/create-checkout-session
 * - POST /payments/webhook
 * - GET  /payments/confirmation
 *
 * Fonctionnalités testées :
 * - validation des données d'inscription
 * - validation du format du courriel
 * - validation des choix d'équipe
 * - création d'une session Stripe
 * - création d'un paiement en attente
 * - traitement des événements Stripe reçus par webhook
 * - marquage des paiements PAYE ou ECHEC
 * - création d'inscription après paiement confirmé
 * - récupération d'une confirmation de paiement
 *
 * Outils utilisés :
 * - Jest
 * - Mocks Jest
 * - inspection directe du routeur Express
 *
 * Dépendances simulées :
 * - Stripe checkout
 * - Stripe webhooks
 * - Stripe payment intents
 * - repository des paiements
 * - repository des inscriptions tournoi
 * - repository des commandites
 *
 * Types de scénarios testés :
 * - validation invalide (400)
 * - ressource introuvable (404)
 * - succès (200)
 * - conflit (409)
 * - erreur serveur (500)
 *
 * Cas particuliers vérifiés :
 * - normalisation du code d'équipe en majuscules
 * - conversion des montants en cents
 * - metadata Stripe incomplète
 * - paiement déjà traité
 * - paiement expiré
 * - événement Stripe non géré
 * - confirmation avec ou sans participant/équipe/commandite
 * --------------------------------------------------------------------
 */

import { jest, describe, beforeAll, beforeEach, test, expect } from "@jest/globals";

/**
 * --------------------------------------------------------------------
 * Mocks Stripe
 * --------------------------------------------------------------------
 */
const mockStripeCheckoutCreate = jest.fn();
const mockStripeCheckoutSessionsRetrieve = jest.fn();
const mockStripeConstructEvent = jest.fn();
const mockStripePaymentIntentsRetrieve = jest.fn();

/**
 * --------------------------------------------------------------------
 * Mocks DAL paiements
 * --------------------------------------------------------------------
 */
const mockCreatePaiementEnAttente = jest.fn();
const mockFindConfirmationBySessionId = jest.fn();
const mockFindPaiementByStripeSessionId = jest.fn();
const mockFindTournoiForPayment = jest.fn();
const mockMarkPaiementEchec = jest.fn();
const mockMarkPaiementPaye = jest.fn();

/**
 * --------------------------------------------------------------------
 * Mocks DAL inscription tournoi
 * --------------------------------------------------------------------
 */
const mockInscriptionCreerEquipe = jest.fn();
const mockInscriptionRejoindreEquipe = jest.fn();
const mockVerifierCourrielDejaInscritTournoi = jest.fn();
const mockVerifierDisponibiliteAvantPaiement = jest.fn();

/**
 * --------------------------------------------------------------------
 * Mocks DAL commandites
 * --------------------------------------------------------------------
 */
const mockFindCommanditeForPayment = jest.fn();
const mockMarkCommanditePaye = jest.fn();
const mockMarkJoueursCommanditesPayes = jest.fn();

let router;

/**
 * Retourne le handler Express correspondant à une route.
 *
 * @param {object} router
 * @param {"get"|"post"} method
 * @param {string} path
 * @returns {Function}
 */
function getRouteHandler(router, method, path) {
  const layer = router.stack.find(
    (item) => item.route && item.route.path === path && item.route.methods[method]
  );

  if (!layer) {
    throw new Error(`Route introuvable: [${method.toUpperCase()}] ${path}`);
  }

  return layer.route.stack[0].handle;
}

/**
 * Crée un faux objet res Express.
 *
 * @returns {object}
 */
function createMockRes() {
  const res = {};

  res.statusCode = 200;
  res.body = null;
  res.text = null;

  res.status = jest.fn((code) => {
    res.statusCode = code;
    return res;
  });

  res.json = jest.fn((payload) => {
    res.body = payload;
    return res;
  });

  res.send = jest.fn((payload) => {
    res.text = payload;
    return res;
  });

  return res;
}

beforeAll(async () => {
  process.env.STRIPE_SECRET_KEY = "sk_test_mocked";
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_mocked";
  process.env.FRONTEND_URL = "http://localhost:5173";

  await jest.unstable_mockModule("stripe", () => ({
    default: jest.fn().mockImplementation(() => ({
      checkout: {
        sessions: {
          create: mockStripeCheckoutCreate,
          retrieve: mockStripeCheckoutSessionsRetrieve,
        },
      },
      webhooks: {
        constructEvent: mockStripeConstructEvent,
      },
      paymentIntents: {
        retrieve: mockStripePaymentIntentsRetrieve,
      },
    })),
  }));

  await jest.unstable_mockModule("../../dal/payments.repository.js", () => ({
    createPaiementEnAttente: mockCreatePaiementEnAttente,
    findConfirmationBySessionId: mockFindConfirmationBySessionId,
    findPaiementByStripeSessionId: mockFindPaiementByStripeSessionId,
    findTournoiForPayment: mockFindTournoiForPayment,
    markPaiementEchec: mockMarkPaiementEchec,
    markPaiementPaye: mockMarkPaiementPaye,
  }));

  await jest.unstable_mockModule("../../dal/inscriptionTournoi.repository.js", () => ({
  inscriptionCreerEquipe: mockInscriptionCreerEquipe,
  inscriptionRejoindreEquipe: mockInscriptionRejoindreEquipe,
  verifierCourrielDejaInscritTournoi: mockVerifierCourrielDejaInscritTournoi,
  verifierDisponibiliteAvantPaiement: mockVerifierDisponibiliteAvantPaiement,
  

  verifierConflitsNomsJoueursTournoi: jest.fn(),
  verifierConflitsNomsJoueursTournoiExcluantCommandite: jest.fn(),
  inscriptionCommandite: jest.fn(),
  courrielDejaInscrit: jest.fn(),
  nomEquipeDejaExiste: jest.fn(),
  codeEquipeRejoignable: jest.fn(),
}));

  await jest.unstable_mockModule("../../dal/commandites.repository.js", () => ({
    findCommanditeForPayment: mockFindCommanditeForPayment,
    markCommanditePaye: mockMarkCommanditePaye,
    markJoueursCommanditesPayes: mockMarkJoueursCommanditesPayes,
  }));

  const mod = await import("../../routes/payments.routes.js");
  router = mod.default;
});

beforeEach(() => {
  jest.clearAllMocks();
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_mocked";
  mockStripeCheckoutSessionsRetrieve.mockReset();
  mockVerifierDisponibiliteAvantPaiement.mockResolvedValue({ ok: true });
});

/* -------------------------------------------------------------------------- */
/*                      POST /payments/create-checkout-session                */
/* -------------------------------------------------------------------------- */

describe("POST /payments/create-checkout-session", () => {
  describe("paiement participant", () => {
    test("retourne 400 si données minimales invalides", async () => {
      const handler = getRouteHandler(router, "post", "/create-checkout-session");
      const req = {
        body: {
          tournoi_id: "",
          prenom: "",
          nom: "",
          courriel: "",
        },
      };
      const res = createMockRes();

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.body).toEqual({
        message: "Données d'inscription invalides.",
      });
    });

    test("retourne 400 si le courriel est invalide", async () => {
      const handler = getRouteHandler(router, "post", "/create-checkout-session");
      const req = {
        body: {
          tournoi_id: 1,
          prenom: "Ali",
          nom: "Test",
          courriel: "mauvais-email",
          optionEquipe: "creer",
          nom_equipe: "Aigles",
        },
      };
      const res = createMockRes();

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.body.message).toBe("Format de courriel invalide.");
    });

    test("retourne 400 si optionEquipe est invalide", async () => {
      const handler = getRouteHandler(router, "post", "/create-checkout-session");
      const req = {
        body: {
          tournoi_id: 1,
          prenom: "Ali",
          nom: "Test",
          courriel: "ali@test.com",
          optionEquipe: "autre",
        },
      };
      const res = createMockRes();

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.body.message).toBe("Option d'équipe invalide.");
    });

    test("retourne 400 si nom_equipe manque pour creer", async () => {
      const handler = getRouteHandler(router, "post", "/create-checkout-session");
      const req = {
        body: {
          tournoi_id: 1,
          prenom: "Ali",
          nom: "Test",
          courriel: "ali@test.com",
          optionEquipe: "creer",
          nom_equipe: "",
        },
      };
      const res = createMockRes();

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.body.message).toBe("Le nom d'équipe est requis.");
    });

    test("retourne 400 si code_equipe manque pour rejoindre", async () => {
      const handler = getRouteHandler(router, "post", "/create-checkout-session");
      const req = {
        body: {
          tournoi_id: 1,
          prenom: "Ali",
          nom: "Test",
          courriel: "ali@test.com",
          optionEquipe: "rejoindre",
          code_equipe: "",
        },
      };
      const res = createMockRes();

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.body.message).toBe("Le code d'équipe est requis.");
    });

    test("retourne 400 si categorie_participant est invalide", async () => {
      const handler = getRouteHandler(router, "post", "/create-checkout-session");
      const req = {
        body: {
          tournoi_id: 1,
          prenom: "Ali",
          nom: "Test",
          courriel: "ali@test.com",
          optionEquipe: "creer",
          nom_equipe: "Aigles",
          categorie_participant: "autre",
        },
      };
      const res = createMockRes();

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.body.message).toBe(
        "Catégorie participant invalide (employe ou retraite)."
      );
    });

    test("retourne 404 si le tournoi est introuvable", async () => {
      mockFindTournoiForPayment.mockResolvedValue(null);

      const handler = getRouteHandler(router, "post", "/create-checkout-session");
      const req = {
        body: {
          tournoi_id: 1,
          prenom: "Ali",
          nom: "Test",
          courriel: "ali@test.com",
          optionEquipe: "creer",
          nom_equipe: "Aigles",
        },
      };
      const res = createMockRes();

      await handler(req, res);

      expect(mockFindTournoiForPayment).toHaveBeenCalledWith(1);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.body.message).toBe("Tournoi introuvable.");
    });

    test("retourne 400 si inscriptions fermées", async () => {
      mockFindTournoiForPayment.mockResolvedValue({
        id: 1,
        nom: "Tournoi 2026",
        prix_joueur: 150,
        inscriptions_ouvertes: false,
      });

      const handler = getRouteHandler(router, "post", "/create-checkout-session");
      const req = {
        body: {
          tournoi_id: 1,
          prenom: "Ali",
          nom: "Test",
          courriel: "ali@test.com",
          optionEquipe: "creer",
          nom_equipe: "Aigles",
        },
      };
      const res = createMockRes();

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.body.message).toBe("Les inscriptions sont fermées pour ce tournoi.");
    });

    test("retourne 409 si le courriel est déjà inscrit au tournoi", async () => {
      mockFindTournoiForPayment.mockResolvedValue({
        id: 1,
        nom: "Tournoi 2026",
        prix_joueur: 150,
        inscriptions_ouvertes: true,
      });

      mockVerifierCourrielDejaInscritTournoi.mockResolvedValue({
        existe: true,
      });

      const handler = getRouteHandler(router, "post", "/create-checkout-session");
      const req = {
        body: {
          tournoi_id: 1,
          prenom: "Ali",
          nom: "Test",
          courriel: "ali@test.com",
          optionEquipe: "creer",
          nom_equipe: "Aigles",
        },
      };
      const res = createMockRes();

      await handler(req, res);

      expect(mockVerifierCourrielDejaInscritTournoi).toHaveBeenCalledWith(1, "ali@test.com");
      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.body.message).toBe(
        "Un participant avec ce courriel est déjà inscrit à ce tournoi."
      );
    });

    test("retourne 400 si prix_joueur invalide ou nul", async () => {
      mockFindTournoiForPayment.mockResolvedValue({
        id: 1,
        nom: "Tournoi 2026",
        prix_joueur: 0,
        inscriptions_ouvertes: true,
      });

      mockVerifierCourrielDejaInscritTournoi.mockResolvedValue({
        existe: false,
      });

      const handler = getRouteHandler(router, "post", "/create-checkout-session");
      const req = {
        body: {
          tournoi_id: 1,
          prenom: "Ali",
          nom: "Test",
          courriel: "ali@test.com",
          optionEquipe: "creer",
          nom_equipe: "Aigles",
        },
      };
      const res = createMockRes();

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.body.message).toBe("Le prix du joueur est invalide ou nul pour ce tournoi.");
    });

    test("retourne 200 et crée une session Stripe pour creer", async () => {
      mockFindTournoiForPayment.mockResolvedValue({
        id: 1,
        nom: "Tournoi 2026",
        prix_joueur: 150,
        inscriptions_ouvertes: true,
      });

      mockVerifierCourrielDejaInscritTournoi.mockResolvedValue({
        existe: false,
      });

      mockStripeCheckoutCreate.mockResolvedValue({
        id: "cs_test_123",
        url: "https://stripe.test/session/123",
      });

      mockCreatePaiementEnAttente.mockResolvedValue({ id: 99 });

      const handler = getRouteHandler(router, "post", "/create-checkout-session");
      const req = {
        body: {
          tournoi_id: 1,
          prenom: "Ali",
          nom: "Squalli",
          courriel: "ali@test.com",
          telephone: "6130000000",
          optionEquipe: "creer",
          nom_equipe: "Les Aigles",
        },
      };
      const res = createMockRes();

      await handler(req, res);

      expect(mockStripeCheckoutCreate).toHaveBeenCalledTimes(1);
      const stripeArgCreer = mockStripeCheckoutCreate.mock.calls[0][0];
      expect(stripeArgCreer.metadata.categorie_participant).toBe("employe");
      expect(mockCreatePaiementEnAttente).toHaveBeenCalledWith({
        tournoiId: 1,
        montantCents: 15000,
        stripeSessionId: "cs_test_123",
      });

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.body).toEqual({
        url: "https://stripe.test/session/123",
        sessionId: "cs_test_123",
      });
    });

    test("retourne 200 et accepte rejoindre avec code en majuscules", async () => {
      mockFindTournoiForPayment.mockResolvedValue({
        id: 2,
        nom: "Tournoi Pro",
        prix_joueur: 200,
        inscriptions_ouvertes: true,
      });

      mockVerifierCourrielDejaInscritTournoi.mockResolvedValue({
        existe: false,
      });

      mockStripeCheckoutCreate.mockResolvedValue({
        id: "cs_test_999",
        url: "https://stripe.test/session/999",
      });

      mockCreatePaiementEnAttente.mockResolvedValue({ id: 100 });

      const handler = getRouteHandler(router, "post", "/create-checkout-session");
      const req = {
        body: {
          tournoi_id: 2,
          prenom: "Yahya",
          nom: "Squalli",
          courriel: "yahya@test.com",
          optionEquipe: "rejoindre",
          code_equipe: "abc123",
        },
      };
      const res = createMockRes();

      await handler(req, res);

      expect(mockStripeCheckoutCreate).toHaveBeenCalledTimes(1);

      const stripeArg = mockStripeCheckoutCreate.mock.calls[0][0];
      expect(stripeArg.metadata.code_equipe).toBe("ABC123");
      expect(stripeArg.metadata.categorie_participant).toBe("employe");

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.body.sessionId).toBe("cs_test_999");
    });

    test("retourne 500 si une erreur serveur survient", async () => {
      mockFindTournoiForPayment.mockRejectedValue(new Error("DB en panne"));

      const handler = getRouteHandler(router, "post", "/create-checkout-session");
      const req = {
        body: {
          tournoi_id: 1,
          prenom: "Ali",
          nom: "Test",
          courriel: "ali@test.com",
          optionEquipe: "creer",
          nom_equipe: "Aigles",
        },
      };
      const res = createMockRes();

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.body.message).toBe("Erreur serveur lors de la création du paiement.");
      expect(res.body.detail).toBe("DB en panne");
    });
  });

  describe("paiement commandite", () => {
    test("retourne 400 si données de commandite invalides", async () => {
      const handler = getRouteHandler(router, "post", "/create-checkout-session");
      const req = {
        body: {
          typePaiement: "commandite",
          tournoi_id: "",
          commandite_id: "",
          courriel: "",
          montant: "",
        },
      };
      const res = createMockRes();

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.body.message).toBe("Données de commandite invalides.");
    });

    test("retourne 400 si le courriel commandite est invalide", async () => {
      const handler = getRouteHandler(router, "post", "/create-checkout-session");
      const req = {
        body: {
          typePaiement: "commandite",
          tournoi_id: 1,
          commandite_id: 2,
          courriel: "bad",
          montant: 250,
        },
      };
      const res = createMockRes();

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.body.message).toBe("Format de courriel invalide.");
    });

    test("retourne 400 si le montant commandite est invalide", async () => {
      const handler = getRouteHandler(router, "post", "/create-checkout-session");
      const req = {
        body: {
          typePaiement: "commandite",
          tournoi_id: 1,
          commandite_id: 2,
          courriel: "cmd@test.com",
          montant: 0,
        },
      };
      const res = createMockRes();

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.body.message).toBe("Montant de commandite invalide.");
    });

    test("retourne 404 si le tournoi commandite est introuvable", async () => {
      mockFindTournoiForPayment.mockResolvedValue(null);

      const handler = getRouteHandler(router, "post", "/create-checkout-session");
      const req = {
        body: {
          typePaiement: "commandite",
          tournoi_id: 1,
          commandite_id: 2,
          courriel: "cmd@test.com",
          montant: 250,
        },
      };
      const res = createMockRes();

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.body.message).toBe("Tournoi introuvable.");
    });

    test("retourne 400 si les inscriptions sont fermées pour commandite", async () => {
      mockFindTournoiForPayment.mockResolvedValue({
        id: 1,
        nom: "Tournoi 2026",
        inscriptions_ouvertes: false,
      });

      const handler = getRouteHandler(router, "post", "/create-checkout-session");
      const req = {
        body: {
          typePaiement: "commandite",
          tournoi_id: 1,
          commandite_id: 2,
          courriel: "cmd@test.com",
          montant: 250,
        },
      };
      const res = createMockRes();

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.body.message).toBe("Les inscriptions sont fermées pour ce tournoi.");
    });

    test("retourne 404 si la commandite est introuvable", async () => {
      mockFindTournoiForPayment.mockResolvedValue({
        id: 1,
        nom: "Tournoi 2026",
        inscriptions_ouvertes: true,
      });

      mockFindCommanditeForPayment.mockResolvedValue(null);

      const handler = getRouteHandler(router, "post", "/create-checkout-session");
      const req = {
        body: {
          typePaiement: "commandite",
          tournoi_id: 1,
          commandite_id: 2,
          courriel: "cmd@test.com",
          montant: 250,
        },
      };
      const res = createMockRes();

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.body.message).toBe("Commandite introuvable.");
    });

    test("retourne 400 si la commandite n'appartient pas au tournoi", async () => {
      mockFindTournoiForPayment.mockResolvedValue({
        id: 1,
        nom: "Tournoi 2026",
        inscriptions_ouvertes: true,
      });

      mockFindCommanditeForPayment.mockResolvedValue({
        id: 2,
        tournoi_id: 99,
      });

      const handler = getRouteHandler(router, "post", "/create-checkout-session");
      const req = {
        body: {
          typePaiement: "commandite",
          tournoi_id: 1,
          commandite_id: 2,
          courriel: "cmd@test.com",
          montant: 250,
        },
      };
      const res = createMockRes();

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.body.message).toBe("Cette commandite n'appartient pas au tournoi sélectionné.");
    });

    test("retourne 200 et crée une session Stripe pour commandite", async () => {
      mockFindTournoiForPayment.mockResolvedValue({
        id: 1,
        nom: "Tournoi 2026",
        inscriptions_ouvertes: true,
      });

      mockFindCommanditeForPayment.mockResolvedValue({
        id: 2,
        tournoi_id: 1,
      });

      mockStripeCheckoutCreate.mockResolvedValue({
        id: "cs_cmd_123",
        url: "https://stripe.test/session/cmd123",
      });

      mockCreatePaiementEnAttente.mockResolvedValue({ id: 501 });

      const handler = getRouteHandler(router, "post", "/create-checkout-session");
      const req = {
        body: {
          typePaiement: "commandite",
          tournoi_id: 1,
          commandite_id: 2,
          courriel: "cmd@test.com",
          montant: 250,
        },
      };
      const res = createMockRes();

      await handler(req, res);

      expect(mockStripeCheckoutCreate).toHaveBeenCalledTimes(1);
      expect(mockCreatePaiementEnAttente).toHaveBeenCalledWith({
        tournoiId: 1,
        montantCents: 25000,
        stripeSessionId: "cs_cmd_123",
        commanditeId: 2,
      });

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.body).toEqual({
        url: "https://stripe.test/session/cmd123",
        sessionId: "cs_cmd_123",
      });
    });
  });

  test("retourne 400 si typePaiement est invalide", async () => {
    const handler = getRouteHandler(router, "post", "/create-checkout-session");
    const req = {
      body: {
        typePaiement: "autre",
      },
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.body.message).toBe("typePaiement invalide.");
  });
});

/* -------------------------------------------------------------------------- */
/*                              POST /payments/webhook                        */
/* -------------------------------------------------------------------------- */

describe("POST /payments/webhook", () => {
  test("retourne 500 si STRIPE_WEBHOOK_SECRET manque", async () => {
    process.env.STRIPE_WEBHOOK_SECRET = "";

    const handler = getRouteHandler(router, "post", "/webhook");
    const req = {
      headers: { "stripe-signature": "sig_test" },
      body: Buffer.from("raw-body"),
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.text).toBe("Webhook secret manquant.");
  });

  test("retourne 400 si la signature Stripe est invalide", async () => {
    mockStripeConstructEvent.mockImplementation(() => {
      throw new Error("signature invalide");
    });

    const handler = getRouteHandler(router, "post", "/webhook");
    const req = {
      headers: { "stripe-signature": "bad_sig" },
      body: Buffer.from("raw-body"),
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.text).toContain("Webhook Error: signature invalide");
  });

  test("retourne 200 avec warning si le paiement Stripe est introuvable", async () => {
    mockStripeConstructEvent.mockReturnValue({
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_missing",
          payment_intent: "pi_123",
          metadata: {
            tournoi_id: "1",
            prenom: "Ali",
            nom: "Test",
            courriel: "ali@test.com",
            option_equipe: "creer",
            nom_equipe: "Aigles",
          },
        },
      },
    });

    mockFindPaiementByStripeSessionId.mockResolvedValue(null);

    const handler = getRouteHandler(router, "post", "/webhook");
    const req = {
      headers: { "stripe-signature": "sig_ok" },
      body: Buffer.from("raw-body"),
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.body).toEqual({
      received: true,
      warning: "Paiement introuvable pour cette session Stripe.",
    });
  });

  test("retourne 200 si le paiement a déjà été traité", async () => {
    mockStripeConstructEvent.mockReturnValue({
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_paid",
          payment_intent: "pi_paid",
          metadata: {},
        },
      },
    });

    mockFindPaiementByStripeSessionId.mockResolvedValue({
      id: 1,
      statut: "PAYE",
      tournoi_id: 1,
    });

    const handler = getRouteHandler(router, "post", "/webhook");
    const req = {
      headers: { "stripe-signature": "sig_ok" },
      body: Buffer.from("raw-body"),
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.body).toEqual({
      received: true,
      message: "Paiement déjà traité.",
    });
  });

  test("retourne 200 et marque ECHEC si metadata participant incomplète", async () => {
    mockStripeConstructEvent.mockReturnValue({
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_meta_bad",
          payment_intent: "pi_meta_bad",
          metadata: {
            type_paiement: "participant",
            tournoi_id: "1",
            prenom: "Ali",
          },
        },
      },
    });

    mockFindPaiementByStripeSessionId.mockResolvedValue({
      id: 2,
      statut: "EN_ATTENTE",
      tournoi_id: 1,
    });

    mockStripePaymentIntentsRetrieve.mockResolvedValue({
      metadata: {},
    });

    const handler = getRouteHandler(router, "post", "/webhook");
    const req = {
      headers: { "stripe-signature": "sig_ok" },
      body: Buffer.from("raw-body"),
    };
    const res = createMockRes();

    await handler(req, res);

    expect(mockMarkPaiementEchec).toHaveBeenCalledWith({
      stripeSessionId: "cs_meta_bad",
      paymentIntentId: "pi_meta_bad",
    });

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.body).toEqual({
      received: true,
      warning:
        "Metadata Stripe participant incomplète. Impossible de créer l'inscription après paiement.",
    });
  });

  test("retourne 200 et crée l'inscription pour option creer", async () => {
    mockStripeConstructEvent.mockReturnValue({
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_create_ok",
          payment_intent: "pi_create_ok",
          metadata: {
            type_paiement: "participant",
            tournoi_id: "1",
            prenom: "Ali",
            nom: "Squalli",
            courriel: "ali@test.com",
            telephone: "6130000000",
            option_equipe: "creer",
            nom_equipe: "Les Aigles",
            code_equipe: "",
          },
        },
      },
    });

    mockFindPaiementByStripeSessionId.mockResolvedValue({
      id: 10,
      statut: "EN_ATTENTE",
      tournoi_id: 1,
    });

    mockStripePaymentIntentsRetrieve.mockResolvedValue({
      metadata: {},
    });

    mockInscriptionCreerEquipe.mockResolvedValue({
      participant: { id: 55, prenom: "Ali" },
      equipe: { id: 7, nom_equipe: "Les Aigles" },
    });

    const handler = getRouteHandler(router, "post", "/webhook");
    const req = {
      headers: { "stripe-signature": "sig_ok" },
      body: Buffer.from("raw-body"),
    };
    const res = createMockRes();

    await handler(req, res);

    expect(mockInscriptionCreerEquipe).toHaveBeenCalledWith({
      tournoi_id: 1,
      prenom: "Ali",
      nom: "Squalli",
      courriel: "ali@test.com",
      telephone: "6130000000",
      nom_equipe: "Les Aigles",
      categorie_participant: "",
    });

    expect(mockMarkPaiementPaye).toHaveBeenCalledWith({
      stripeSessionId: "cs_create_ok",
      paymentIntentId: "pi_create_ok",
      participantId: 55,
    });

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.body).toEqual({ received: true });
  });

  test("retourne 200 et crée l'inscription pour option rejoindre", async () => {
    mockStripeConstructEvent.mockReturnValue({
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_join_ok",
          payment_intent: "pi_join_ok",
          metadata: {
            type_paiement: "participant",
            tournoi_id: "3",
            prenom: "Yahya",
            nom: "Squalli",
            courriel: "yahya@test.com",
            telephone: "",
            option_equipe: "rejoindre",
            nom_equipe: "",
            code_equipe: "ABC123",
          },
        },
      },
    });

    mockFindPaiementByStripeSessionId.mockResolvedValue({
      id: 11,
      statut: "EN_ATTENTE",
      tournoi_id: 3,
    });

    mockStripePaymentIntentsRetrieve.mockResolvedValue({
      metadata: {},
    });

    mockInscriptionRejoindreEquipe.mockResolvedValue({
      participant: { id: 88, prenom: "Yahya" },
      equipe: { id: 9, nom_equipe: "Tigres" },
    });

    const handler = getRouteHandler(router, "post", "/webhook");
    const req = {
      headers: { "stripe-signature": "sig_ok" },
      body: Buffer.from("raw-body"),
    };
    const res = createMockRes();

    await handler(req, res);

    expect(mockInscriptionRejoindreEquipe).toHaveBeenCalledWith({
      tournoi_id: 3,
      prenom: "Yahya",
      nom: "Squalli",
      courriel: "yahya@test.com",
      telephone: null,
      code_equipe: "ABC123",
      categorie_participant: "",
    });

    expect(mockMarkPaiementPaye).toHaveBeenCalledWith({
      stripeSessionId: "cs_join_ok",
      paymentIntentId: "pi_join_ok",
      participantId: 88,
    });

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.body).toEqual({ received: true });
  });

  test("retourne 200 et marque ECHEC si option équipe invalide", async () => {
    mockStripeConstructEvent.mockReturnValue({
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_bad_option",
          payment_intent: "pi_bad_option",
          metadata: {
            type_paiement: "participant",
            tournoi_id: "1",
            prenom: "Ali",
            nom: "Test",
            courriel: "ali@test.com",
            telephone: "",
            option_equipe: "autre",
            nom_equipe: "Aigles",
          },
        },
      },
    });

    mockFindPaiementByStripeSessionId.mockResolvedValue({
      id: 12,
      statut: "EN_ATTENTE",
      tournoi_id: 1,
    });

    mockStripePaymentIntentsRetrieve.mockResolvedValue({
      metadata: {},
    });

    const handler = getRouteHandler(router, "post", "/webhook");
    const req = {
      headers: { "stripe-signature": "sig_ok" },
      body: Buffer.from("raw-body"),
    };
    const res = createMockRes();

    await handler(req, res);

    expect(mockMarkPaiementEchec).toHaveBeenCalledWith({
      stripeSessionId: "cs_bad_option",
      paymentIntentId: "pi_bad_option",
    });

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.body).toEqual({
      received: true,
      warning:
        "Metadata Stripe participant incomplète. Impossible de créer l'inscription après paiement.",
    });
  });

  test("retourne 200 et marque ECHEC si erreur métier après paiement", async () => {
    mockStripeConstructEvent.mockReturnValue({
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_business_error",
          payment_intent: "pi_business_error",
          metadata: {
            type_paiement: "participant",
            tournoi_id: "1",
            prenom: "Ali",
            nom: "Squalli",
            courriel: "ali@test.com",
            telephone: "",
            option_equipe: "creer",
            nom_equipe: "Les Aigles",
            code_equipe: "",
          },
        },
      },
    });

    mockFindPaiementByStripeSessionId.mockResolvedValue({
      id: 13,
      statut: "EN_ATTENTE",
      tournoi_id: 1,
    });

    mockStripePaymentIntentsRetrieve.mockResolvedValue({
      metadata: {},
    });

    mockInscriptionCreerEquipe.mockResolvedValue({
      error: {
        status: 409,
        message: "Équipe déjà existante",
      },
    });

    const handler = getRouteHandler(router, "post", "/webhook");
    const req = {
      headers: { "stripe-signature": "sig_ok" },
      body: Buffer.from("raw-body"),
    };
    const res = createMockRes();

    await handler(req, res);

    expect(mockMarkPaiementEchec).toHaveBeenCalledWith({
      stripeSessionId: "cs_business_error",
      paymentIntentId: "pi_business_error",
    });

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.body).toEqual({
      received: true,
      warning: "Équipe déjà existante",
    });
  });

  test("continue même si la relecture du payment_intent échoue", async () => {
    mockStripeConstructEvent.mockReturnValue({
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_pi_fail",
          payment_intent: "pi_fail",
          metadata: {
            type_paiement: "participant",
            tournoi_id: "1",
            prenom: "Ali",
            nom: "Squalli",
            courriel: "ali@test.com",
            telephone: "",
            option_equipe: "creer",
            nom_equipe: "Les Aigles",
            code_equipe: "",
          },
        },
      },
    });

    mockFindPaiementByStripeSessionId.mockResolvedValue({
      id: 14,
      statut: "EN_ATTENTE",
      tournoi_id: 1,
    });

    mockStripePaymentIntentsRetrieve.mockRejectedValue(new Error("Stripe down"));

    mockInscriptionCreerEquipe.mockResolvedValue({
      participant: { id: 999 },
      equipe: { id: 777 },
    });

    const handler = getRouteHandler(router, "post", "/webhook");
    const req = {
      headers: { "stripe-signature": "sig_ok" },
      body: Buffer.from("raw-body"),
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(mockMarkPaiementPaye).toHaveBeenCalled();
  });

  test("retourne 200 et marque ECHEC si metadata commandite incomplète", async () => {
    mockStripeConstructEvent.mockReturnValue({
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_cmd_meta_bad",
          payment_intent: "pi_cmd_meta_bad",
          metadata: {
            type_paiement: "commandite",
            tournoi_id: "1",
          },
        },
      },
    });

    mockFindPaiementByStripeSessionId.mockResolvedValue({
      id: 15,
      statut: "EN_ATTENTE",
      tournoi_id: 1,
    });

    mockStripePaymentIntentsRetrieve.mockResolvedValue({
      metadata: {},
    });

    const handler = getRouteHandler(router, "post", "/webhook");
    const req = {
      headers: { "stripe-signature": "sig_ok" },
      body: Buffer.from("raw-body"),
    };
    const res = createMockRes();

    await handler(req, res);

    expect(mockMarkPaiementEchec).toHaveBeenCalledWith({
      stripeSessionId: "cs_cmd_meta_bad",
      paymentIntentId: "pi_cmd_meta_bad",
    });

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.body).toEqual({
      received: true,
      warning:
        "Metadata Stripe commandite incomplète. Impossible de confirmer la commandite après paiement.",
    });
  });

  test("retourne 200 et marque ECHEC si commandite_id est invalide", async () => {
    mockStripeConstructEvent.mockReturnValue({
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_cmd_bad_id",
          payment_intent: "pi_cmd_bad_id",
          metadata: {
            type_paiement: "commandite",
            tournoi_id: "1",
            commandite_id: "abc",
            courriel: "cmd@test.com",
          },
        },
      },
    });

    mockFindPaiementByStripeSessionId.mockResolvedValue({
      id: 16,
      statut: "EN_ATTENTE",
      tournoi_id: 1,
    });

    mockStripePaymentIntentsRetrieve.mockResolvedValue({
      metadata: {},
    });

    const handler = getRouteHandler(router, "post", "/webhook");
    const req = {
      headers: { "stripe-signature": "sig_ok" },
      body: Buffer.from("raw-body"),
    };
    const res = createMockRes();

    await handler(req, res);

    expect(mockMarkPaiementEchec).toHaveBeenCalledWith({
      stripeSessionId: "cs_cmd_bad_id",
      paymentIntentId: "pi_cmd_bad_id",
    });

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.body).toEqual({
      received: true,
      warning: "commandite_id invalide dans les metadata Stripe.",
    });
  });

  test("retourne 200 et confirme une commandite", async () => {
    mockStripeConstructEvent.mockReturnValue({
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_cmd_ok",
          payment_intent: "pi_cmd_ok",
          metadata: {
            type_paiement: "commandite",
            tournoi_id: "1",
            commandite_id: "22",
            courriel: "cmd@test.com",
          },
        },
      },
    });

    mockFindPaiementByStripeSessionId.mockResolvedValue({
      id: 17,
      statut: "EN_ATTENTE",
      tournoi_id: 1,
    });

    mockStripePaymentIntentsRetrieve.mockResolvedValue({
      metadata: {},
    });

    const handler = getRouteHandler(router, "post", "/webhook");
    const req = {
      headers: { "stripe-signature": "sig_ok" },
      body: Buffer.from("raw-body"),
    };
    const res = createMockRes();

    await handler(req, res);

    expect(mockMarkCommanditePaye).toHaveBeenCalledWith(22);
    expect(mockMarkJoueursCommanditesPayes).toHaveBeenCalledWith(22);
    expect(mockMarkPaiementPaye).toHaveBeenCalledWith({
      stripeSessionId: "cs_cmd_ok",
      paymentIntentId: "pi_cmd_ok",
      commanditeId: 22,
    });

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.body).toEqual({ received: true });
  });

  test("retourne 200 et marque ECHEC si type_paiement est absent ou invalide", async () => {
    mockStripeConstructEvent.mockReturnValue({
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_bad_type",
          payment_intent: "pi_bad_type",
          metadata: {},
        },
      },
    });

    mockFindPaiementByStripeSessionId.mockResolvedValue({
      id: 18,
      statut: "EN_ATTENTE",
      tournoi_id: 1,
    });

    mockStripePaymentIntentsRetrieve.mockResolvedValue({
      metadata: {},
    });

    const handler = getRouteHandler(router, "post", "/webhook");
    const req = {
      headers: { "stripe-signature": "sig_ok" },
      body: Buffer.from("raw-body"),
    };
    const res = createMockRes();

    await handler(req, res);

    expect(mockMarkPaiementEchec).toHaveBeenCalledWith({
      stripeSessionId: "cs_bad_type",
      paymentIntentId: "pi_bad_type",
    });

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.body).toEqual({
      received: true,
      warning: "type_paiement absent ou invalide dans les metadata Stripe.",
    });
  });

  test("retourne 200 et marque ECHEC pour checkout.session.expired", async () => {
    mockStripeConstructEvent.mockReturnValue({
      type: "checkout.session.expired",
      data: {
        object: {
          id: "cs_expired",
        },
      },
    });

    const handler = getRouteHandler(router, "post", "/webhook");
    const req = {
      headers: { "stripe-signature": "sig_ok" },
      body: Buffer.from("raw-body"),
    };
    const res = createMockRes();

    await handler(req, res);

    expect(mockMarkPaiementEchec).toHaveBeenCalledWith({
      stripeSessionId: "cs_expired",
      paymentIntentId: null,
    });

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.body).toEqual({ received: true });
  });

  test("retourne 200 pour un autre événement Stripe non géré", async () => {
    mockStripeConstructEvent.mockReturnValue({
      type: "payment_intent.created",
      data: {
        object: {
          id: "pi_created",
        },
      },
    });

    const handler = getRouteHandler(router, "post", "/webhook");
    const req = {
      headers: { "stripe-signature": "sig_ok" },
      body: Buffer.from("raw-body"),
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.body).toEqual({ received: true });
  });

  test("retourne 500 si une erreur serveur survient pendant le traitement du webhook", async () => {
    mockStripeConstructEvent.mockReturnValue({
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_server_error",
          payment_intent: "pi_server_error",
          metadata: {
            type_paiement: "participant",
            tournoi_id: "1",
            prenom: "Ali",
            nom: "Test",
            courriel: "ali@test.com",
            option_equipe: "creer",
            nom_equipe: "Aigles",
          },
        },
      },
    });

    mockFindPaiementByStripeSessionId.mockRejectedValue(new Error("Lecture paiement impossible"));

    const handler = getRouteHandler(router, "post", "/webhook");
    const req = {
      headers: { "stripe-signature": "sig_ok" },
      body: Buffer.from("raw-body"),
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.body.message).toBe("Erreur serveur dans le webhook Stripe.");
    expect(res.body.detail).toBe("Lecture paiement impossible");
  });
});

/* -------------------------------------------------------------------------- */
/*                          GET /payments/confirmation                        */
/* -------------------------------------------------------------------------- */

describe("GET /payments/confirmation", () => {
  test("retourne 400 si session_id manque", async () => {
    const handler = getRouteHandler(router, "get", "/confirmation");
    const req = {
      query: {},
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.body.message).toBe("session_id manquant.");
  });

  test("retourne 404 si la confirmation est introuvable", async () => {
    mockFindConfirmationBySessionId.mockResolvedValue(null);

    const handler = getRouteHandler(router, "get", "/confirmation");
    const req = {
      query: {
        session_id: "cs_unknown",
      },
    };
    const res = createMockRes();

    await handler(req, res);

    expect(mockFindConfirmationBySessionId).toHaveBeenCalledWith("cs_unknown");
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.body.message).toBe("Confirmation introuvable pour cette session.");
  });

  test("retourne 200 avec paiement + participant + équipe créée", async () => {
    mockFindConfirmationBySessionId.mockResolvedValue({
      paiement_id: 1,
      stripe_session_id: "cs_ok",
      paiement_statut: "PAYE",
      montant_cents: 15000,
      paiement_date: "2026-04-01",
      participant_id: 10,
      participant_prenom: "Ali",
      participant_nom: "Squalli",
      participant_courriel: "ali@test.com",
      equipe_id: 20,
      nom_equipe: "Les Aigles",
      code_secret: "ABC123",
      commandite_id: null,
      commandite_statut: null,
    });

    mockStripeCheckoutSessionsRetrieve.mockResolvedValue({
      id: "cs_ok",
      metadata: {
        option_equipe: "creer",
      },
      payment_intent: "pi_test_ok",
    });

    mockStripePaymentIntentsRetrieve.mockResolvedValue({
      metadata: {
        option_equipe: "creer",
      },
    });

    const handler = getRouteHandler(router, "get", "/confirmation");
    const req = {
      query: {
        session_id: "cs_ok",
      },
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.body).toEqual({
      paiement: {
        id: 1,
        stripe_session_id: "cs_ok",
        statut: "PAYE",
        montant_cents: 15000,
        date_creation: "2026-04-01",
      },
      participant: {
        id: 10,
        prenom: "Ali",
        nom: "Squalli",
        courriel: "ali@test.com",
      },
      equipe: {
        id: 20,
        nom_equipe: "Les Aigles",
        code_secret: "ABC123",
      },
      commandite: null,
      option_equipe: "creer",
    });
  });

  test("retourne 200 sans code_secret si option rejoindre", async () => {
    mockFindConfirmationBySessionId.mockResolvedValue({
      paiement_id: 1,
      stripe_session_id: "cs_join",
      paiement_statut: "PAYE",
      montant_cents: 15000,
      paiement_date: "2026-04-01",
      participant_id: 10,
      participant_prenom: "Ali",
      participant_nom: "Squalli",
      participant_courriel: "ali@test.com",
      equipe_id: 20,
      nom_equipe: "Les Tigres",
      code_secret: "ABC123",
      commandite_id: null,
      commandite_statut: null,
    });

    mockStripeCheckoutSessionsRetrieve.mockResolvedValue({
      id: "cs_join",
      metadata: {
        option_equipe: "rejoindre",
      },
      payment_intent: "pi_join",
    });

    mockStripePaymentIntentsRetrieve.mockResolvedValue({
      metadata: {
        option_equipe: "rejoindre",
      },
    });

    const handler = getRouteHandler(router, "get", "/confirmation");
    const req = {
      query: {
        session_id: "cs_join",
      },
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.body).toEqual({
      paiement: {
        id: 1,
        stripe_session_id: "cs_join",
        statut: "PAYE",
        montant_cents: 15000,
        date_creation: "2026-04-01",
      },
      participant: {
        id: 10,
        prenom: "Ali",
        nom: "Squalli",
        courriel: "ali@test.com",
      },
      equipe: {
        id: 20,
        nom_equipe: "Les Tigres",
        code_secret: null,
      },
      commandite: null,
      option_equipe: "rejoindre",
    });
  });

  test("retourne 200 avec participant null et équipe null", async () => {
    mockFindConfirmationBySessionId.mockResolvedValue({
      paiement_id: 2,
      stripe_session_id: "cs_no_participant",
      paiement_statut: "EN_ATTENTE",
      montant_cents: 20000,
      paiement_date: "2026-04-01",
      participant_id: null,
      participant_prenom: null,
      participant_nom: null,
      participant_courriel: null,
      equipe_id: null,
      nom_equipe: null,
      code_secret: null,
      commandite_id: null,
      commandite_statut: null,
    });

    mockStripeCheckoutSessionsRetrieve.mockResolvedValue({
      id: "cs_no_participant",
      metadata: {},
      payment_intent: "pi_no_participant",
    });

    mockStripePaymentIntentsRetrieve.mockResolvedValue({
      metadata: {},
    });

    const handler = getRouteHandler(router, "get", "/confirmation");
    const req = {
      query: {
        session_id: "cs_no_participant",
      },
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.body.participant).toBeNull();
    expect(res.body.equipe).toBeNull();
    expect(res.body.commandite).toBeNull();
    expect(res.body.option_equipe).toBe("");
  });

  test("retourne 200 avec commandite", async () => {
    mockFindConfirmationBySessionId.mockResolvedValue({
      paiement_id: 3,
      stripe_session_id: "cs_cmd",
      paiement_statut: "PAYE",
      montant_cents: 25000,
      paiement_date: "2026-04-05",
      participant_id: null,
      participant_prenom: null,
      participant_nom: null,
      participant_courriel: null,
      equipe_id: null,
      nom_equipe: null,
      code_secret: null,
      commandite_id: 77,
      commandite_statut: "PAYE",
    });

    mockStripeCheckoutSessionsRetrieve.mockResolvedValue({
      id: "cs_cmd",
      metadata: {
        type_paiement: "commandite",
      },
      payment_intent: "pi_cmd",
    });

    mockStripePaymentIntentsRetrieve.mockResolvedValue({
      metadata: {
        type_paiement: "commandite",
      },
    });

    const handler = getRouteHandler(router, "get", "/confirmation");
    const req = {
      query: {
        session_id: "cs_cmd",
      },
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.body).toEqual({
      paiement: {
        id: 3,
        stripe_session_id: "cs_cmd",
        statut: "PAYE",
        montant_cents: 25000,
        date_creation: "2026-04-05",
      },
      participant: null,
      equipe: null,
      commandite: {
        id: 77,
        statut: "PAYE",
      },
      option_equipe: "",
    });
  });

  test("retourne 500 si erreur serveur", async () => {
    mockFindConfirmationBySessionId.mockRejectedValue(new Error("DB confirm KO"));

    const handler = getRouteHandler(router, "get", "/confirmation");
    const req = {
      query: {
        session_id: "cs_error",
      },
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.body.message).toBe("Erreur serveur lors de la récupération de la confirmation.");
    expect(res.body.detail).toBe("DB confirm KO");
  });
});