/**
 * =============================================================================
 * TEST — Middlewares globaux (JSON, Cookies, CORS)
 * =============================================================================
 *
 * Fichier :
 * middlewares.test.js
 *
 * Objectif :
 * Vérifier que les middlewares globaux du serveur Express
 * fonctionnent correctement.
 *
 * Middlewares testés :
 * - express.json()
 * - cookie-parser
 * - cors
 *
 * Outils utilisés :
 * - Jest : framework de test
 * - Supertest : simulation requêtes HTTP
 */

import { describe, test, expect } from "@jest/globals";
import request from "supertest";

/**
 * Import de l'application Express
 *
 * IMPORTANT :
 * On importe app directement,
 * sans démarrer app.listen().
 */
import app from "../../server.js";

/**
 * =============================================================================
 * TESTS — Middlewares globaux
 * =============================================================================
 */
describe("TDG-21 - Tests middlewares (json, cookies, cors)", () => {

  /**
   * --------------------------------------------------------------------------
   * Test express.json()
   * Vérifie que le body JSON est bien reçu et parsé.
   * --------------------------------------------------------------------------
   */
  test("express.json() : POST /__test/json renvoie le body reçu", async () => {
    const res = await request(app)
      .post("/__test/json")
      .send({ hello: "world" })
      .set("Content-Type", "application/json");

    /**
     * Vérifie que la requête réussit
     */
    expect(res.statusCode).toBe(200);

    /**
     * Vérifie que le body JSON est bien traité
     */
    expect(res.body).toEqual({
      received: { hello: "world" },
    });
  });

  /**
   * --------------------------------------------------------------------------
   * Test JSON invalide
   * Vérifie que express.json() retourne une erreur 400.
   * --------------------------------------------------------------------------
   */
  test("express.json() : JSON invalide => 400", async () => {
    const res = await request(app)
      .post("/__test/json")
      .set("Content-Type", "application/json")
      .send("{bad json");

    expect(res.statusCode).toBe(400);
  });

  /**
   * --------------------------------------------------------------------------
   * Test cookie-parser
   * Vérifie que les cookies sont correctement lus.
   * --------------------------------------------------------------------------
   */
  test("cookie-parser : lit les cookies envoyés", async () => {
    const res = await request(app)
      .get("/__test/cookies")
      .set("Cookie", ["admin_id=123", "theme=dark"]);

    expect(res.statusCode).toBe(200);

    /**
     * Vérifie que les cookies sont correctement extraits
     */
    expect(res.body.cookies).toMatchObject({
      admin_id: "123",
      theme: "dark",
    });
  });

  /**
   * --------------------------------------------------------------------------
   * Test CORS (requête normale)
   * Vérifie que les headers CORS sont retournés.
   * --------------------------------------------------------------------------
   */
  test("CORS : renvoie Access-Control-Allow-Origin + credentials sur requête normale", async () => {
    const origin = "http://localhost:5173";

    const res = await request(app)
      .get("/health")
      .set("Origin", origin);

    expect(res.headers["access-control-allow-origin"])
      .toBe(origin);

    expect(res.headers["access-control-allow-credentials"])
      .toBe("true");
  });

  /**
   * --------------------------------------------------------------------------
   * Test CORS preflight (OPTIONS)
   * Vérifie la gestion des requêtes OPTIONS.
   * --------------------------------------------------------------------------
   */
  test("CORS : preflight OPTIONS renvoie les headers CORS", async () => {
    const origin = "http://localhost:5173";

    const res = await request(app)
      .options("/health")
      .set("Origin", origin)
      .set("Access-Control-Request-Method", "GET");

    /**
     * Certains serveurs retournent 200 ou 204
     */
    expect([200, 204]).toContain(res.statusCode);

    expect(res.headers["access-control-allow-origin"])
      .toBe(origin);

    expect(res.headers["access-control-allow-credentials"])
      .toBe("true");
  });

  /**
   * --------------------------------------------------------------------------
   * Test supplémentaire recommandé
   * Vérifie que Content-Type JSON est bien défini.
   * --------------------------------------------------------------------------
   */
  test("express.json() : retourne Content-Type JSON", async () => {
    const res = await request(app)
      .post("/__test/json")
      .send({ test: true });

    expect(res.headers["content-type"])
      .toMatch(/application\/json/);
  });

});