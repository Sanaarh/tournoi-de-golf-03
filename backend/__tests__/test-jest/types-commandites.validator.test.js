/**
 * =============================================================================
 * TESTS — types-commandites.validator.js
 * =============================================================================
 *
 * Objectif :
 * Vérifier les fonctions de validation et de normalisation
 * pour les types de commandites.
 *
 * Fonctions testées :
 * - parseId
 * - validateTypeCommanditePayload
 */

import { describe, test, expect } from "@jest/globals";
import {
  parseId,
  validateTypeCommanditePayload,
} from "../../validators/types-commandites.validator.js";

/**
 * ============================================================================
 * TESTS parseId()
 * ============================================================================
 *
 * Vérifie qu'un identifiant doit être :
 * - un entier
 * - strictement positif
 */
describe("parseId (types-commandites.validator)", () => {
  test("retourne null pour undefined", () => {
    expect(parseId(undefined)).toBeNull();
  });

  test("retourne null pour null", () => {
    expect(parseId(null)).toBeNull();
  });

  test("retourne null pour 0", () => {
    expect(parseId(0)).toBeNull();
  });

  test("retourne null pour négatif", () => {
    expect(parseId(-1)).toBeNull();
  });

  test("retourne null pour texte", () => {
    expect(parseId("abc")).toBeNull();
  });

  test("retourne 1 pour '1'", () => {
    expect(parseId("1")).toBe(1);
  });

  test("retourne 10 pour 10", () => {
    expect(parseId(10)).toBe(10);
  });
});

/**
 * ============================================================================
 * TESTS validateTypeCommanditePayload()
 * ============================================================================
 *
 * Vérifie :
 * - les champs obligatoires
 * - les limites et contraintes numériques
 * - le nettoyage des valeurs
 * - le contenu de l'objet cleaned
 */
describe("validateTypeCommanditePayload", () => {
  /**
   * Payload valide de base réutilisé dans plusieurs tests.
   */
  const validBody = {
    tournoi_id: 1,
    nom: "Commandite Or",
    prix_cents: 50000,
    quota: 5,
    places_incluses: 4,
  };

  test("ok=true avec payload valide", () => {
    const { ok, errors } = validateTypeCommanditePayload(validBody);

    expect(ok).toBe(true);
    expect(errors).toEqual({});
  });

  test("ok=false si tournoi_id manquant", () => {
    const { ok, errors } = validateTypeCommanditePayload({
      ...validBody,
      tournoi_id: null,
    });

    expect(ok).toBe(false);
    expect(errors.tournoi_id).toBeDefined();
  });

  test("ok=false si tournoi_id invalide", () => {
    const { ok, errors } = validateTypeCommanditePayload({
      ...validBody,
      tournoi_id: "abc",
    });

    expect(ok).toBe(false);
    expect(errors.tournoi_id).toBeDefined();
  });

  test("ok=false si nom vide", () => {
    const { ok, errors } = validateTypeCommanditePayload({
      ...validBody,
      nom: "",
    });

    expect(ok).toBe(false);
    expect(errors.nom).toBeDefined();
  });

  test("ok=false si nom avec espaces seulement", () => {
    const { ok, errors } = validateTypeCommanditePayload({
      ...validBody,
      nom: "   ",
    });

    expect(ok).toBe(false);
    expect(errors.nom).toBeDefined();
  });

  test("ok=false si nom trop long (>120)", () => {
    const { ok, errors } = validateTypeCommanditePayload({
      ...validBody,
      nom: "A".repeat(121),
    });

    expect(ok).toBe(false);
    expect(errors.nom).toBeDefined();
  });

  test("ok=false si prix_cents manquant", () => {
    const { ok, errors } = validateTypeCommanditePayload({
      ...validBody,
      prix_cents: undefined,
    });

    expect(ok).toBe(false);
    expect(errors.prix_cents).toBeDefined();
  });

  test("ok=false si prix_cents négatif", () => {
    const { ok, errors } = validateTypeCommanditePayload({
      ...validBody,
      prix_cents: -1,
    });

    expect(ok).toBe(false);
    expect(errors.prix_cents).toBeDefined();
  });

  test("ok=true si prix_cents = 0", () => {
    const { ok } = validateTypeCommanditePayload({
      ...validBody,
      prix_cents: 0,
    });

    expect(ok).toBe(true);
  });

  test("ok=true si prix_cents est une chaîne numérique", () => {
    const { ok, cleaned } = validateTypeCommanditePayload({
      ...validBody,
      prix_cents: "50000",
    });

    expect(ok).toBe(true);
    expect(cleaned.prix_cents).toBe(50000);
  });

  test("ok=false si quota manquant", () => {
    const { ok, errors } = validateTypeCommanditePayload({
      ...validBody,
      quota: undefined,
    });

    expect(ok).toBe(false);
    expect(errors.quota).toBeDefined();
  });

  test("ok=false si quota négatif", () => {
    const { ok, errors } = validateTypeCommanditePayload({
      ...validBody,
      quota: -1,
    });

    expect(ok).toBe(false);
    expect(errors.quota).toBeDefined();
  });

  test("ok=false si quota = 0", () => {
    const { ok, errors } = validateTypeCommanditePayload({
      ...validBody,
      quota: 0,
    });

    expect(ok).toBe(false);
    expect(errors.quota).toBeDefined();
  });

  test("ok=true si quota est une chaîne numérique", () => {
    const { ok, cleaned } = validateTypeCommanditePayload({
      ...validBody,
      quota: "5",
    });

    expect(ok).toBe(true);
    expect(cleaned.quota).toBe(5);
  });

  test("ok=false si places_incluses manquant", () => {
    const { ok, errors } = validateTypeCommanditePayload({
      ...validBody,
      places_incluses: undefined,
    });

    expect(ok).toBe(false);
    expect(errors.places_incluses).toBeDefined();
  });

  test("ok=false si places_incluses négatif", () => {
    const { ok, errors } = validateTypeCommanditePayload({
      ...validBody,
      places_incluses: -1,
    });

    expect(ok).toBe(false);
    expect(errors.places_incluses).toBeDefined();
  });

  test("ok=true si places_incluses est une chaîne numérique", () => {
    const { ok, cleaned } = validateTypeCommanditePayload({
      ...validBody,
      places_incluses: "4",
    });

    expect(ok).toBe(true);
    expect(cleaned.places_incluses).toBe(4);
  });

  test("cleaned contient les bonnes valeurs", () => {
    const { cleaned } = validateTypeCommanditePayload(validBody);

    expect(cleaned.tournoi_id).toBe(1);
    expect(cleaned.nom).toBe("Commandite Or");
    expect(cleaned.prix_cents).toBe(50000);
    expect(cleaned.quota).toBe(5);
    expect(cleaned.places_incluses).toBe(4);
    expect(cleaned.description).toBeNull();
  });

  test("description acceptée après trim", () => {
    const { ok, cleaned } = validateTypeCommanditePayload({
      ...validBody,
      description: "  Visibilité logo  ",
    });

    expect(ok).toBe(true);
    expect(cleaned.description).toBe("Visibilité logo");
  });

  test("description vide devient null", () => {
    const { ok, cleaned } = validateTypeCommanditePayload({
      ...validBody,
      description: "   ",
    });

    expect(ok).toBe(true);
    expect(cleaned.description).toBeNull();
  });

  test("ok=false si description trop longue", () => {
    const { ok, errors, cleaned } = validateTypeCommanditePayload({
      ...validBody,
      description: "x".repeat(2001),
    });

    expect(ok).toBe(false);
    expect(errors.description).toBeDefined();
    expect(cleaned.description).toBeNull();
  });
});