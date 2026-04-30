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
 * Cette route permet :
 * - de vérifier que le serveur est actif
 * - de confirmer que l'API répond correctement
 * - d'utiliser un point de contrôle simple (monitoring)
 *
 * Outils utilisés :
 * - Jest : framework de test
 * - Supertest : simulation de requêtes HTTP
 */

import { describe, test, expect } from "@jest/globals";
import request from "supertest";

/**
 * Import de l'application Express.
 *
 * IMPORTANT :
 * On importe "app" directement,
 * sans lancer app.listen().
 */
import app from "../../server.js";

/**
 * =============================================================================
 * TESTS — /health
 * =============================================================================
 */
describe("TDG-21 - Tests route /health", () => {

  /**
   * --------------------------------------------------------------------------
   * Test principal
   * Vérifie que la route retourne bien un statut OK.
   * --------------------------------------------------------------------------
   */
  test("GET /health retourne 200 et { status: 'ok' }", async () => {
    const res = await request(app).get("/health");

    /**
     * Vérifie que la requête HTTP réussit
     */
    expect(res.statusCode).toBe(200);

    /**
     * Vérifie que la réponse JSON est correcte
     */
    expect(res.body).toEqual({
      status: "ok",
    });
  });

  /**
   * --------------------------------------------------------------------------
   * Vérifie que la réponse est bien au format JSON
   * --------------------------------------------------------------------------
   */
  test("GET /health retourne un content-type JSON", async () => {
    const res = await request(app).get("/health");

    expect(res.headers["content-type"])
      .toMatch(/application\/json/);
  });

  /**
   * --------------------------------------------------------------------------
   * Vérifie que la route existe réellement
   * (évite erreurs 404 accidentelles)
   * --------------------------------------------------------------------------
   */
  test("GET /health ne retourne pas 404", async () => {
    const res = await request(app).get("/health");

    expect(res.statusCode).not.toBe(404);
  });

});