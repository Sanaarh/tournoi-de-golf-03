/**
 * =============================================================================
 * TEST — Route /health
 * =============================================================================
 *
 * Fichier :
 * health.route.test.js
 *
 * Objectif :
 * Vérifier que la route GET /health fonctionne correctement.
 *
 * Cette route est utilisée pour :
 * - vérifier que le serveur est actif
 * - tester rapidement l'état du backend
 * - servir de point de vérification pour le monitoring
 *
 * Bibliothèques utilisées :
 * - supertest → simule des requêtes HTTP
 * - jest → framework de test
 */

import { describe, test, expect } from "@jest/globals";
import request from "supertest";

/**
 * Import de l'application Express.
 *
 * Important :
 * On importe "app" sans lancer le serveur réel.
 */
import app from "../../server.js";

/**
 * =============================================================================
 * TESTS — /health
 * =============================================================================
 */
describe("TDG-21 - Tests route /health", () => {
  /**
   * Test principal :
   * Vérifie que la route répond correctement.
   */
  test("GET /health retourne 200 et { status: 'ok' }", async () => {
    /**
     * Simulation requête HTTP GET
     */
    const res = await request(app).get("/health");

    /**
     * Vérification du code HTTP
     */
    expect(res.statusCode).toBe(200);

    /**
     * Vérification du contenu JSON retourné
     */
    expect(res.body).toEqual({
      status: "ok",
    });
  });
});