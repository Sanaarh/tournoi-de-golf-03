import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

import authRoutes from "./routes/auth.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import tournoisRoutes from "./routes/tournois.routes.js";
import publicRoutes from "./routes/public.routes.js";
import adminEquipesRoutes from "./routes/admin.equipes.routes.js";
import typesCommanditesRoutes from "./routes/types-commandites.routes.js";
import adminCommanditesRoutes from "./routes/admin.commandites.routes.js";
import paymentsRoutes from "./routes/payments.routes.js";

const app = express();

const PORT = Number(process.env.PORT) || 3000;
const ALLOWED_ORIGINS = [
  "http://127.0.0.1:5173",
  "http://localhost:5173",
];

/**
 * IMPORTANT :
 * Le webhook Stripe doit recevoir le body brut.
 * On applique express.raw() seulement sur cette route,
 * AVANT express.json().
 */
app.use("/payments/webhook", express.raw({ type: "application/json" }));

/**
 * Middlewares globaux
 */
app.use(express.json());
app.use(cookieParser());

app.use(
  cors({
    origin: ALLOWED_ORIGINS,
    credentials: true,
  })
);

/**
 * Santé
 */
app.get("/", (req, res) => {
  return res.status(200).send("OK");
});

app.get("/health", (req, res) => {
  return res.status(200).json({ status: "ok" });
});

/**
 * API
 */
app.use("/auth", authRoutes);
app.use("/public", publicRoutes);

app.use("/admin", adminEquipesRoutes);
app.use("/admin/tournois", tournoisRoutes);
app.use("/admin/types-commandites", typesCommanditesRoutes);
app.use("/admin/commandites", adminCommanditesRoutes);
app.use("/admin", adminRoutes);

/**
 * Routes paiements
 * Ici, le routeur contient déjà :
 * - POST /create-checkout-session
 * - POST /webhook
 * - GET /confirmation
 */
app.use("/payments", paymentsRoutes);

/**
 * Tests
 */
if (process.env.NODE_ENV === "test") {
  app.post("/__test/json", (req, res) => {
    return res.status(200).json({ received: req.body });
  });

  app.get("/__test/cookies", (req, res) => {
    return res.status(200).json({ cookies: req.cookies || {} });
  });
}

/**
 * 404
 */
app.use((req, res) => {
  return res.status(404).json({ message: "Route introuvable" });
});

export default app;

if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, () => {
    console.log(`Backend démarré sur http://localhost:${PORT}`);
  });
}