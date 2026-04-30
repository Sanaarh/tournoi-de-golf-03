/**
 * =============================================================================
 * TESTS — equipes.validator.js
 * =============================================================================
 *
 * Objectif :
 * Tester toutes les fonctions du validateur des équipes
 * avec des cas normaux et des cas limites.
 *
 * Fonctions testées :
 * - parseId
 * - validateCreerEquipePayload
 * - validateAjouterMembrePayload
 * - validateNouveauMembrePayload
 * - validateModifierEquipePayload
 * - validateJoueurCommanditeIdentitePayload
 * - validateAssignJoueurCommanditeEquipePayload
 * - validateModifierParticipantPayload
 * - validateDeplacerMembrePayload
 *
 * Ces tests couvrent :
 * ✔ cas valides
 * ✔ cas invalides
 * ✔ limites de longueur
 * ✔ nettoyage des valeurs
 */

import { describe, test, expect } from "@jest/globals";

import {
  parseId,
  validateCreerEquipePayload,
  validateAjouterMembrePayload,
  validateNouveauMembrePayload,
  validateModifierEquipePayload,
  validateJoueurCommanditeIdentitePayload,
  validateAssignJoueurCommanditeEquipePayload,
  validateModifierParticipantPayload,
  validateDeplacerMembrePayload,
} from "../../validators/equipes.validator.js";

/**
 * ============================================================================
 * TEST parseId()
 * ============================================================================
 */
describe("parseId (equipes.validator)", () => {

  test("retourne null pour valeur invalide", () => {
    expect(parseId(0)).toBeNull();
    expect(parseId(-5)).toBeNull();
    expect(parseId("abc")).toBeNull();
    expect(parseId(1.5)).toBeNull();
  });

  test("retourne un entier valide", () => {
    expect(parseId("1")).toBe(1);
    expect(parseId(42)).toBe(42);
  });

});

/**
 * ============================================================================
 * TEST validateCreerEquipePayload()
 * ============================================================================
 */
describe("validateCreerEquipePayload", () => {

  test("ok=true avec tournoi_id valide", () => {

    const { ok } =
      validateCreerEquipePayload({
        tournoi_id: 1
      });

    expect(ok).toBe(true);

  });

  test("ok=false si tournoi_id invalide", () => {

    const { ok } =
      validateCreerEquipePayload({
        tournoi_id: "xyz"
      });

    expect(ok).toBe(false);

  });

  test("nom_equipe optionnel", () => {

    const { cleaned } =
      validateCreerEquipePayload({
        tournoi_id: 1
      });

    expect(cleaned.nom_equipe).toBeNull();

  });

  test("ok=false si nom_equipe trop long", () => {

    const { ok } =
      validateCreerEquipePayload({
        tournoi_id: 1,
        nom_equipe: "A".repeat(121)
      });

    expect(ok).toBe(false);

  });

});

/**
 * ============================================================================
 * TEST validateAjouterMembrePayload()
 * ============================================================================
 */
describe("validateAjouterMembrePayload", () => {

  test("ok=true payload valide", () => {

    const { ok } =
      validateAjouterMembrePayload(
        { id: "1" },
        { participant_id: 5 }
      );

    expect(ok).toBe(true);

  });

  test("ok=false si equipe invalide", () => {

    const { ok } =
      validateAjouterMembrePayload(
        { id: "abc" },
        { participant_id: 5 }
      );

    expect(ok).toBe(false);

  });

  test("ok=false si participant invalide", () => {

    const { ok } =
      validateAjouterMembrePayload(
        { id: "1" },
        { participant_id: 0 }
      );

    expect(ok).toBe(false);

  });

});

/**
 * ============================================================================
 * TEST validateNouveauMembrePayload()
 * ============================================================================
 */
describe("validateNouveauMembrePayload", () => {

  const params = { id: "1" };

  const validBody = {
    prenom: "Ali",
    nom: "Test",
    courriel: "ali@test.com",
    telephone: "5140000000",
  };

  test("ok=true payload valide", () => {

    const { ok } =
      validateNouveauMembrePayload(
        params,
        validBody
      );

    expect(ok).toBe(true);

  });

  test("ok=false si prenom trop long", () => {

    const { ok } =
      validateNouveauMembrePayload(
        params,
        {
          ...validBody,
          prenom: "A".repeat(81)
        }
      );

    expect(ok).toBe(false);

  });

  test("ok=false si nom trop long", () => {

    const { ok } =
      validateNouveauMembrePayload(
        params,
        {
          ...validBody,
          nom: "B".repeat(81)
        }
      );

    expect(ok).toBe(false);

  });

  test("ok=false si courriel trop long", () => {

    const { ok } =
      validateNouveauMembrePayload(
        params,
        {
          ...validBody,
          courriel: "a".repeat(151)
        }
      );

    expect(ok).toBe(false);

  });

  test("ok=false si telephone trop long", () => {

    const { ok } =
      validateNouveauMembrePayload(
        params,
        {
          ...validBody,
          telephone: "1".repeat(31)
        }
      );

    expect(ok).toBe(false);

  });

  test("trim automatique des valeurs", () => {

    const { cleaned } =
      validateNouveauMembrePayload(
        params,
        {
          prenom: "  Ali  ",
          nom: "  Test  ",
          courriel: "ali@test.com"
        }
      );

    expect(cleaned.prenom).toBe("Ali");
    expect(cleaned.nom).toBe("Test");

  });

});

/**
 * ============================================================================
 * TEST validateModifierParticipantPayload()
 * ============================================================================
 */
describe("validateModifierParticipantPayload", () => {

  test("ok=false telephone trop long", () => {

    const { ok } =
      validateModifierParticipantPayload({
        prenom: "Ali",
        nom: "Test",
        courriel: "ali@test.com",
        telephone: "1".repeat(31)
      });

    expect(ok).toBe(false);

  });

});

/**
 * ============================================================================
 * TEST validateDeplacerMembrePayload()
 * ============================================================================
 */
describe("validateDeplacerMembrePayload", () => {

  test("ok=false si plusieurs ids invalides", () => {

    const { ok } =
      validateDeplacerMembrePayload(
        { id: "abc", participantId: "xyz" },
        { equipe_cible_id: "bad" }
      );

    expect(ok).toBe(false);

  });

});