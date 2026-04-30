/**
 * =============================================================================
 * TESTS — inscriptionTournoi.validator.js
 * =============================================================================
 *
 * Objectif :
 * Tester toutes les validations liées aux inscriptions publiques.
 *
 * Fonctions testées :
 * - parseId
 * - validateCreerEquipePayload
 * - validateRejoindreEquipePayload
 * - validateCommanditairePayload
 *
 * Cas couverts :
 * ✔ cas valides
 * ✔ cas invalides
 * ✔ validation email
 * ✔ validation code équipe
 * ✔ validation joueurs commanditaires
 * ✔ détection doublons joueurs
 */

import { describe, test, expect } from "@jest/globals";

import {
  parseId,
  validateCreerEquipePayload,
  validateRejoindreEquipePayload,
  validateCommanditairePayload,
} from "../../validators/inscriptionTournoi.validator.js";

/**
 * ============================================================================
 * TEST parseId()
 * ============================================================================
 */
describe("parseId (inscriptionTournoi)", () => {

  test("retourne null si invalide", () => {
    expect(parseId(0)).toBeNull();
    expect(parseId(-1)).toBeNull();
    expect(parseId("abc")).toBeNull();
  });

  test("retourne entier valide", () => {
    expect(parseId("1")).toBe(1);
    expect(parseId(10)).toBe(10);
  });

});

/**
 * ============================================================================
 * TEST validateCreerEquipePayload()
 * ============================================================================
 */
describe("validateCreerEquipePayload", () => {

  const validBody = {
    tournoi_id: 1,
    prenom: "Ali",
    nom: "Test",
    courriel: "ali@test.com",
    telephone: "12345",
    nom_equipe: "Equipe A",
  };

  test("payload valide", () => {

    const { ok } =
      validateCreerEquipePayload(validBody);

    expect(ok).toBe(true);

  });

  test("nom_equipe obligatoire", () => {

    const { ok } =
      validateCreerEquipePayload({
        ...validBody,
        nom_equipe: ""
      });

    expect(ok).toBe(false);

  });

  test("prenom obligatoire", () => {

    const { ok } =
      validateCreerEquipePayload({
        ...validBody,
        prenom: ""
      });

    expect(ok).toBe(false);

  });

  test("telephone trop long", () => {

    const { ok } =
      validateCreerEquipePayload({
        ...validBody,
        telephone: "1".repeat(31)
      });

    expect(ok).toBe(false);

  });

});

/**
 * ============================================================================
 * TEST validateRejoindreEquipePayload()
 * ============================================================================
 */
describe("validateRejoindreEquipePayload", () => {

  const validBody = {
    tournoi_id: 1,
    prenom: "Ali",
    nom: "Test",
    courriel: "ali@test.com",
    code_equipe: "ABC123",
  };

  test("payload valide", () => {

    const { ok } =
      validateRejoindreEquipePayload(validBody);

    expect(ok).toBe(true);

  });

  test("code obligatoire", () => {

    const { ok } =
      validateRejoindreEquipePayload({
        ...validBody,
        code_equipe: ""
      });

    expect(ok).toBe(false);

  });

  test("code invalide", () => {

    const { ok } =
      validateRejoindreEquipePayload({
        ...validBody,
        code_equipe: "abc"
      });

    expect(ok).toBe(false);

  });

  test("code lowercase converti uppercase", () => {

    const { cleaned } =
      validateRejoindreEquipePayload({
        ...validBody,
        code_equipe: "abc123"
      });

    expect(cleaned.code_equipe).toBe("ABC123");

  });

});

/**
 * ============================================================================
 * TEST validateCommanditairePayload()
 * ============================================================================
 */
describe("validateCommanditairePayload", () => {

  const baseBody = {
    tournoi_id: 1,
    prenom: "Ali",
    nom: "Test",
    courriel: "ali@test.com",
    type_commandite_id: 1,
  };

  test("payload valide minimal", () => {

    const { ok } =
      validateCommanditairePayload(baseBody);

    expect(ok).toBe(true);

  });

  test("type_commandite_ids requis", () => {

    const { ok } =
      validateCommanditairePayload({
        ...baseBody,
        type_commandite_id: null
      });

    expect(ok).toBe(false);

  });

  test("type_commandite_ids array valide", () => {

    const { ok } =
      validateCommanditairePayload({
        ...baseBody,
        type_commandite_ids: [1, 2]
      });

    expect(ok).toBe(true);

  });

  test("joueurs_par_type invalide (non objet)", () => {

    const { ok } =
      validateCommanditairePayload({
        ...baseBody,
        joueurs_par_type: "abc"
      });

    expect(ok).toBe(false);

  });

  test("clé type invalide", () => {

    const { ok } =
      validateCommanditairePayload({
        ...baseBody,
        joueurs_par_type: {
          abc: []
        }
      });

    expect(ok).toBe(false);

  });

  test("rows non tableau", () => {

    const { ok } =
      validateCommanditairePayload({
        ...baseBody,
        joueurs_par_type: {
          1: "abc"
        }
      });

    expect(ok).toBe(false);

  });

  test("détection doublon joueur", () => {

    const { ok } =
      validateCommanditairePayload({
        ...baseBody,
        joueurs_par_type: {
          1: [
            { prenom: "Ali", nom: "Test" },
            { prenom: "Ali", nom: "Test" }
          ]
        }
      });

    expect(ok).toBe(false);

  });

});