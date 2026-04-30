/**
 * =============================================================================
 * TEST — validate middleware
 * =============================================================================
 *
 * Objectif :
 * Vérifier que le middleware validate()
 * fonctionne correctement.
 *
 * Cas testés :
 * - validation réussie
 * - validation échouée
 * - next() appelé correctement
 */

import { describe, test, expect, jest } from "@jest/globals";

/**
 * Mock validationError
 */
const mockValidationError = jest.fn((errors) => ({
  message: "Validation error",
  errors,
}));

/**
 * Mock module validation.js
 */
jest.unstable_mockModule(
  "../../utils/validation.js",
  () => ({
    validationError: mockValidationError,
  })
);

/**
 * Import middleware après mock
 */
const { validate } =
  await import("../../middlewares/validate.js");

/* =============================================================================
   Tests validate()
============================================================================= */

describe("validate middleware", () => {

  test("appelle next() si aucune erreur", () => {

    /**
     * Fake schema valide
     */
    const schemaFn = jest.fn(() => ({}));

    /**
     * Middleware créé
     */
    const middleware = validate(schemaFn);

    /**
     * Mocks Express
     */
    const req = {};
    const res = {};
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  test("retourne 400 si erreurs présentes", () => {

    const schemaFn = jest.fn(() => ({
      nom: "Erreur nom",
    }));

    const middleware = validate(schemaFn);

    /**
     * Mock response Express
     */
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    const req = {};
    const next = jest.fn();

    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);

    expect(res.json).toHaveBeenCalled();

    expect(next).not.toHaveBeenCalled();
  });

  test("validationError est appelée avec les erreurs", () => {

    const errors = {
      nom: "Erreur",
    };

    const schemaFn = jest.fn(() => errors);

    const middleware = validate(schemaFn);

    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    const req = {};
    const next = jest.fn();

    middleware(req, res, next);

    expect(mockValidationError)
      .toHaveBeenCalledWith(errors);
  });

});