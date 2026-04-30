/**
 * =============================================================================
 * TEST — utils/validation.js
 * =============================================================================
 *
 * Fonctions testées :
 * - isNonEmptyString
 * - isISODate
 * - toInt
 * - parseBool
 * - validationError
 *
 * Objectif :
 * Vérifier que toutes les fonctions utilitaires
 * de validation fonctionnent correctement.
 */

import { describe, test, expect } from "@jest/globals";

/**
 * Import des fonctions à tester
 */
import {
  isNonEmptyString,
  isISODate,
  toInt,
  parseBool,
  validationError,
} from "../../utils/validation.js";

/* =============================================================================
   Tests isNonEmptyString
============================================================================= */

describe("isNonEmptyString()", () => {

  test("retourne true pour string valide", () => {
    expect(isNonEmptyString("hello")).toBe(true);
  });

  test("retourne false pour string vide", () => {
    expect(isNonEmptyString("")).toBe(false);
  });

  test("retourne false pour string avec seulement espaces", () => {
    expect(isNonEmptyString("   ")).toBe(false);
  });

  test("retourne false pour valeur non string", () => {
    expect(isNonEmptyString(123)).toBe(false);
  });

  test("retourne false si dépasse maxLen", () => {
    expect(isNonEmptyString("abcdef", 5)).toBe(false);
  });

  test("retourne true si respecte maxLen", () => {
    expect(isNonEmptyString("abc", 5)).toBe(true);
  });

});

/* =============================================================================
   Tests isISODate
============================================================================= */

describe("isISODate()", () => {

  test("retourne true pour date ISO valide", () => {
    expect(isISODate("2024-01-01")).toBe(true);
  });

  test("retourne false pour format invalide", () => {
    expect(isISODate("01-01-2024")).toBe(false);
  });

  test("retourne false pour string invalide", () => {
    expect(isISODate("invalid-date")).toBe(false);
  });

  test("retourne false pour valeur non string", () => {
    expect(isISODate(123)).toBe(false);
  });

});

/* =============================================================================
   Tests toInt
============================================================================= */

describe("toInt()", () => {

  test("retourne entier valide", () => {
    expect(toInt(10)).toBe(10);
  });

  test("retourne entier depuis string", () => {
    expect(toInt("5")).toBe(5);
  });

  test("retourne null pour float", () => {
    expect(toInt(5.5)).toBeNull();
  });

  test("retourne null pour string non numérique", () => {
    expect(toInt("abc")).toBeNull();
  });

});

/* =============================================================================
   Tests parseBool
============================================================================= */

describe("parseBool()", () => {

  test("retourne true pour boolean true", () => {
    expect(parseBool(true)).toBe(true);
  });

  test("retourne false pour boolean false", () => {
    expect(parseBool(false)).toBe(false);
  });

  test("retourne true pour string 'true'", () => {
    expect(parseBool("true")).toBe(true);
  });

  test("retourne false pour string 'false'", () => {
    expect(parseBool("false")).toBe(false);
  });

  test("retourne null pour valeur invalide", () => {
    expect(parseBool("yes")).toBeNull();
  });

});

/* =============================================================================
   Tests validationError
============================================================================= */

describe("validationError()", () => {

  test("retourne format d'erreur standard", () => {

    const errors = {
      nom: "Champ requis",
    };

    const result = validationError(errors);

    expect(result).toEqual({
      message: "Validation impossible",
      errors,
    });

  });

});