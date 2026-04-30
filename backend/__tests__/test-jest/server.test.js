/**
 * =============================================================================
 * TEST — server.js
 * =============================================================================
 *
 * Objectif :
 * Vérifier que les routes principales du serveur fonctionnent.
 *
 * Routes testées :
 * - GET /
 * - GET /health
 * - POST /__test/json
 * - GET /__test/cookies
 * - Route inexistante → 404
 */

import { describe, test, expect } from "@jest/globals";
import request from "supertest";

/**
 * IMPORTANT :
 * On force le mode test
 */
process.env.NODE_ENV = "test";

/**
 * Import app Express
 */
import app from "../../server.js";

/* =============================================================================
   Tests server
============================================================================= */

describe("Server routes principales", () => {

  /**
   * --------------------------------------------------------------------------
   * GET /
   * --------------------------------------------------------------------------
   */
  test("GET / retourne 'OK'", async () => {

    const res = await request(app).get("/");

    expect(res.statusCode).toBe(200);

    expect(res.text).toBe("OK");
  });

  /**
   * --------------------------------------------------------------------------
   * GET /health
   * --------------------------------------------------------------------------
   */
  test("GET /health retourne status ok", async () => {

    const res = await request(app).get("/health");

    expect(res.statusCode).toBe(200);

    expect(res.body).toEqual({
      status: "ok",
    });
  });

});

/* =============================================================================
   Tests routes test internes
============================================================================= */

describe("Routes internes __test", () => {

  /**
   * --------------------------------------------------------------------------
   * express.json()
   * --------------------------------------------------------------------------
   */
  test("POST /__test/json retourne le body", async () => {

    const res = await request(app)
      .post("/__test/json")
      .send({ test: true });

    expect(res.statusCode).toBe(200);

    expect(res.body).toEqual({
      received: { test: true },
    });
  });

  /**
   * --------------------------------------------------------------------------
   * cookie-parser
   * --------------------------------------------------------------------------
   */
  test("GET /__test/cookies retourne cookies", async () => {

    const res = await request(app)
      .get("/__test/cookies")
      .set("Cookie", ["admin_id=1"]);

    expect(res.statusCode).toBe(200);

    expect(res.body.cookies).toMatchObject({
      admin_id: "1",
    });
  });

});

/* =============================================================================
   Tests erreurs
============================================================================= */

describe("Gestion erreurs", () => {

  /**
   * --------------------------------------------------------------------------
   * Route inconnue
   * --------------------------------------------------------------------------
   */
  test("Route inconnue retourne 404", async () => {

    const res = await request(app)
      .get("/route-inexistante");

    expect(res.statusCode).toBe(404);

    expect(res.body).toEqual({
      message: "Route introuvable",
    });
  });

});