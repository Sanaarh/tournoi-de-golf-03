/**
 * =============================================================================
 * TESTS — tournois.validator.js
 * =============================================================================
 *
 * Objectif :
 * Vérifier les règles de validation et de nettoyage
 * du payload de création / modification d'un tournoi.
 */

import { describe, test, expect } from "@jest/globals";
import { validateTournoiPayload } from "../../validators/tournois.validator.js";

/**
 * Dates fixes pour rendre les tests prévisibles.
 */
const TODAY = "2026-04-07";
const TOMORROW = "2026-04-08";
const YESTERDAY = "2026-04-06";
const LATER = "2026-04-15";

/**
 * Payload valide de base.
 *
 * IMPORTANT :
 * On garde une structure cohérente avec le validator actuel.
 */
const validBody = {
  nom: "Tournoi Printemps",
  lieu: "Gatineau",
  date_tournoi: LATER,
  inscription_debut: TODAY,
  inscription_fin: TOMORROW,
  inscriptions_ouvertes: false,
  capacite_joueurs: 4,
  limite_commandites: 0,
  prix_joueur: 25,
};

/**
 * ============================================================================
 * Champs obligatoires
 * ============================================================================
 */
describe("validateTournoiPayload - champs obligatoires", () => {
  test("ok=true avec payload valide", async () => {
    const { ok, errors } = await validateTournoiPayload(validBody, TODAY);

    expect(ok).toBe(true);
    expect(errors).toEqual({});
  });

  test("ok=false si nom manquant", async () => {
    const { ok, errors } = await validateTournoiPayload(
      { ...validBody, nom: "" },
      TODAY
    );

    expect(ok).toBe(false);
    expect(errors.nom).toBeDefined();
  });

  test("ok=false si date_tournoi manquante", async () => {
    const { ok, errors } = await validateTournoiPayload(
      { ...validBody, date_tournoi: "" },
      TODAY
    );

    expect(ok).toBe(false);
    expect(errors.date_tournoi).toBeDefined();
  });

  test("ok=false si date_tournoi format invalide", async () => {
    const { ok, errors } = await validateTournoiPayload(
      { ...validBody, date_tournoi: "07-04-2026" },
      TODAY
    );

    expect(ok).toBe(false);
    expect(errors.date_tournoi).toBeDefined();
  });
});

/**
 * ============================================================================
 * Date tournoi
 * ============================================================================
 */
describe("validateTournoiPayload - date tournoi", () => {
  test("ok=false si date_tournoi dans le passé", async () => {
    /**
     * Pour tester la règle 'date tournoi passée',
     * on retire les dates d'inscription afin d'éviter
     * qu'une autre règle prenne le dessus sur le message attendu.
     */
    const { ok, errors } = await validateTournoiPayload(
      {
        ...validBody,
        date_tournoi: YESTERDAY,
        inscription_debut: null,
        inscription_fin: null,
      },
      TODAY
    );

    expect(ok).toBe(false);
    expect(errors.date_tournoi).toMatch(/aujourd'hui|futur/i);
  });

  test("ok=true si date_tournoi = aujourd'hui", async () => {
    /**
     * On garde des dates d'inscription cohérentes pour ne pas invalider
     * le payload à cause d'une autre règle.
     */
    const { ok } = await validateTournoiPayload(
      {
        ...validBody,
        date_tournoi: TODAY,
        inscription_debut: null,
        inscription_fin: null,
      },
      TODAY
    );

    expect(ok).toBe(true);
  });
});

/**
 * ============================================================================
 * Capacité joueurs
 * ============================================================================
 */
describe("validateTournoiPayload - capacité joueurs", () => {
  test("ok=true si capacite_joueurs = 0", async () => {
    const { ok, errors } = await validateTournoiPayload(
      { ...validBody, capacite_joueurs: 0 },
      TODAY
    );

    expect(ok).toBe(true);
    expect(errors.capacite_joueurs).toBeUndefined();
  });

  test("ok=false si capacite_joueurs < 4 et non multiple de 4", async () => {
    const { ok, errors } = await validateTournoiPayload(
      { ...validBody, capacite_joueurs: 2 },
      TODAY
    );

    expect(ok).toBe(false);
    expect(errors.capacite_joueurs).toMatch(/multiple de 4/i);
  });

  test("ok=false si capacite_joueurs non multiple de 4", async () => {
    const { ok, errors } = await validateTournoiPayload(
      { ...validBody, capacite_joueurs: 10 },
      TODAY
    );

    expect(ok).toBe(false);
    expect(errors.capacite_joueurs).toMatch(/multiple de 4/i);
  });

  test("ok=true si capacite_joueurs = 16", async () => {
    const { ok } = await validateTournoiPayload(
      { ...validBody, capacite_joueurs: 16 },
      TODAY
    );

    expect(ok).toBe(true);
  });

  test("nombre_equipes_max calculé automatiquement", async () => {
    const { cleaned } = await validateTournoiPayload(
      { ...validBody, capacite_joueurs: 20 },
      TODAY
    );

    expect(cleaned.nombre_equipes_max).toBe(5);
  });
});

/**
 * ============================================================================
 * Prix joueur
 * ============================================================================
 */
describe("validateTournoiPayload - prix joueur", () => {
  test("ok=false si prix_joueur = 0", async () => {
    const { ok, errors } = await validateTournoiPayload(
      { ...validBody, prix_joueur: 0 },
      TODAY
    );

    expect(ok).toBe(false);
    expect(errors.prix_joueur).toBeDefined();
  });

  test("ok=false si prix_joueur négatif", async () => {
    const { ok, errors } = await validateTournoiPayload(
      { ...validBody, prix_joueur: -5 },
      TODAY
    );

    expect(ok).toBe(false);
    expect(errors.prix_joueur).toBeDefined();
  });

  test("ok=true si prix_joueur > 0", async () => {
    const { ok } = await validateTournoiPayload(
      { ...validBody, prix_joueur: 49.99 },
      TODAY
    );

    expect(ok).toBe(true);
  });
});

/**
 * ============================================================================
 * Dates inscription
 * ============================================================================
 */
describe("validateTournoiPayload - dates inscription", () => {
  test("ok=false si inscription_fin < inscription_debut", async () => {
    const { ok, errors } = await validateTournoiPayload(
      {
        ...validBody,
        inscription_debut: TOMORROW,
        inscription_fin: TODAY,
      },
      TODAY
    );

    expect(ok).toBe(false);
    expect(errors.inscription_fin).toBeDefined();
  });

  test("ok=false si date_tournoi < inscription_fin", async () => {
    const { ok, errors } = await validateTournoiPayload(
      {
        ...validBody,
        inscription_debut: TODAY,
        inscription_fin: LATER,
        date_tournoi: TOMORROW,
      },
      TODAY
    );

    expect(ok).toBe(false);
    expect(errors.date_tournoi).toBeDefined();
  });

  test("ok=false si seule la date de début est fournie", async () => {
    const { ok, errors } = await validateTournoiPayload(
      {
        ...validBody,
        inscription_debut: TODAY,
        inscription_fin: null,
      },
      TODAY
    );

    expect(ok).toBe(false);
    expect(
      errors.inscription_dates ||
      errors.inscription_fin ||
      errors.inscription_debut
    ).toBeDefined();
  });

  test("ok=false si seule la date de fin est fournie", async () => {
    const { ok, errors } = await validateTournoiPayload(
      {
        ...validBody,
        inscription_debut: null,
        inscription_fin: TOMORROW,
      },
      TODAY
    );

    expect(ok).toBe(false);
    expect(
      errors.inscription_dates ||
      errors.inscription_fin ||
      errors.inscription_debut
    ).toBeDefined();
  });

  test("ok=false si inscription_debut dans le passé", async () => {
    const { ok, errors } = await validateTournoiPayload(
      {
        ...validBody,
        inscription_debut: YESTERDAY,
        inscription_fin: TOMORROW,
      },
      TODAY
    );

    expect(ok).toBe(false);
    expect(errors.inscription_debut).toBeDefined();
  });
});

/**
 * ============================================================================
 * Inscriptions ouvertes
 * ============================================================================
 */
describe("validateTournoiPayload - inscriptions ouvertes", () => {
  test("ok=false si inscriptions_ouvertes=true sans dates d'inscription", async () => {
    const { ok, errors } = await validateTournoiPayload(
      {
        ...validBody,
        inscriptions_ouvertes: true,
        inscription_debut: null,
        inscription_fin: null,
      },
      TODAY
    );

    expect(ok).toBe(false);
    expect(errors.inscriptions_ouvertes).toBeDefined();
  });

  test("ok=false si inscriptions_ouvertes=true et inscription_fin dépassée", async () => {
    const { ok, errors } = await validateTournoiPayload(
      {
        ...validBody,
        inscriptions_ouvertes: true,
        inscription_debut: TODAY,
        inscription_fin: YESTERDAY,
      },
      TODAY
    );

    expect(ok).toBe(false);
    expect(errors.inscriptions_ouvertes || errors.inscription_fin).toBeDefined();
  });

  test("ok=true si inscriptions_ouvertes=false avec dates valides", async () => {
    const { ok } = await validateTournoiPayload(
      {
        ...validBody,
        inscriptions_ouvertes: false,
      },
      TODAY
    );

    expect(ok).toBe(true);
  });
});

/**
 * ============================================================================
 * Quota commandites
 * ============================================================================
 */
describe("validateTournoiPayload - quota commandites", () => {
  test("ok=false si limite_commandites >= capacite_joueurs", async () => {
    const { ok, errors } = await validateTournoiPayload(
      { ...validBody, capacite_joueurs: 8, limite_commandites: 8 },
      TODAY
    );

    expect(ok).toBe(false);
    expect(errors.limite_commandites).toBeDefined();
  });

  test("ok=true si limite_commandites < capacite_joueurs", async () => {
    const { ok } = await validateTournoiPayload(
      { ...validBody, capacite_joueurs: 8, limite_commandites: 4 },
      TODAY
    );

    expect(ok).toBe(true);
  });
});

/**
 * ============================================================================
 * Nom unique
 * ============================================================================
 */
describe("validateTournoiPayload - unicité du nom", () => {
  test("ok=false si le nom du tournoi existe déjà", async () => {
    const isNomUniqueFn = async () => false;

    const { ok, errors } = await validateTournoiPayload(
      validBody,
      TODAY,
      isNomUniqueFn
    );

    expect(ok).toBe(false);
    expect(errors.nom).toBeDefined();
  });

  test("ok=true si le nom du tournoi est unique", async () => {
    const isNomUniqueFn = async () => true;

    const { ok } = await validateTournoiPayload(
      validBody,
      TODAY,
      isNomUniqueFn
    );

    expect(ok).toBe(true);
  });
});