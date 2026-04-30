/**
 * --------------------------------------------------------------------
 * Tests des routes de paiement Stripe (payments.routes.js)
 * --------------------------------------------------------------------
 *
 * Fichier testé :
 * - routes/payments.routes.js
 *
 * Objectif :
 * Vérifier le bon fonctionnement des routes liées aux paiements :
 * - création d'une session Stripe
 * - traitement du webhook Stripe
 * - récupération de la confirmation de paiement
 *
 * Routes couvertes :
 * - POST   /payments/create-checkout-session
 * - POST   /payments/webhook
 * - GET    /payments/confirmation
 *
 * Fonctionnalités testées :
 * - validation des données d'inscription
 * - validation du format du courriel
 * - validation des options d'équipe
 * - création d'une session Stripe
 * - gestion des erreurs Stripe
 * - traitement des webhooks Stripe
 * - création d'inscription après paiement
 * - gestion des paiements expirés
 * - récupération des confirmations de paiement
 *
 * Stratégie utilisée :
 * - Stripe est mocké (checkout, webhook, paymentIntent)
 * - Les repositories DAL sont mockés
 * - Les réponses HTTP sont simulées
 * - Les objets req/res Express sont simulés
 *
 * Outils utilisés :
 * - Jest
 * - Mocks Jest
 * - Router Express inspecté directement
 *
 * Types de scénarios testés :
 * - validation invalide (400)
 * - ressource introuvable (404)
 * - succès (200)
 * - erreur serveur (500)
 * - webhook Stripe valide/invalide
 *
 * Particularités vérifiées :
 * - transformation des montants en cents
 * - gestion des metadata Stripe
 * - création d'inscription après paiement
 * - marquage des paiements PAYE / ECHEC
 * - gestion des paiements expirés
 * - récupération complète des confirmations
 * --------------------------------------------------------------------
 */

import express from "express";
import Stripe from "stripe";
import {
  createPaiementEnAttente,
  findConfirmationBySessionId,
  findPaiementByStripeSessionId,
  findTournoiForPayment,
  markPaiementEchec,
  markPaiementPaye,
} from "../dal/payments.repository.js";
import {
  inscriptionCreerEquipe,
  inscriptionRejoindreEquipe,
  verifierCourrielDejaInscritTournoi,
  verifierDisponibiliteAvantPaiement,
} from "../dal/inscriptionTournoi.repository.js";
import {
  findCommanditeForPayment,
  markCommanditePaye,
  markJoueursCommanditesPayes,
} from "../dal/commandites.repository.js";


const router = express.Router();

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
if (!stripeSecretKey) {
  throw new Error("STRIPE_SECRET_KEY manquante dans backend/.env");
}

const stripe = new Stripe(stripeSecretKey);

function safeTrim(value) {
  return String(value || "").trim();
}

function parsePositiveInt(raw) {
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) return null;
  return n;
}

function toStripeAmount(rawDollars) {
  const amount = Number(rawDollars);
  if (!Number.isFinite(amount) || amount < 0) return null;
  return Math.round(amount * 100);
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function normalizeMetadata(sessionMetadata = {}, paymentIntentMetadata = {}) {
  return {
    type_paiement: safeTrim(
      sessionMetadata?.type_paiement || paymentIntentMetadata?.type_paiement
    ),

    tournoi_id: safeTrim(
      sessionMetadata?.tournoi_id || paymentIntentMetadata?.tournoi_id
    ),

    // participant
    prenom: safeTrim(sessionMetadata?.prenom || paymentIntentMetadata?.prenom),
    nom: safeTrim(sessionMetadata?.nom || paymentIntentMetadata?.nom),
    courriel: safeTrim(
      sessionMetadata?.courriel || paymentIntentMetadata?.courriel
    ),
    telephone: safeTrim(
      sessionMetadata?.telephone || paymentIntentMetadata?.telephone
    ),
    option_equipe: safeTrim(
      sessionMetadata?.option_equipe || paymentIntentMetadata?.option_equipe
    ),
    nom_equipe: safeTrim(
      sessionMetadata?.nom_equipe || paymentIntentMetadata?.nom_equipe
    ),
    code_equipe: safeTrim(
      sessionMetadata?.code_equipe || paymentIntentMetadata?.code_equipe
    ).toUpperCase(),

    categorie_participant: safeTrim(
      sessionMetadata?.categorie_participant ||
        paymentIntentMetadata?.categorie_participant
    ).toLowerCase(),

    // commandite
    commandite_id: safeTrim(
      sessionMetadata?.commandite_id || paymentIntentMetadata?.commandite_id
    ),
  };
}

function hasRequiredParticipantMetadata(meta) {
  return Boolean(
    meta.tournoi_id &&
      meta.prenom &&
      meta.nom &&
      meta.courriel &&
      meta.option_equipe &&
      ["creer", "rejoindre"].includes(meta.option_equipe)
  );
}

function hasRequiredCommanditeMetadata(meta) {
  return Boolean(
    meta.tournoi_id &&
      meta.commandite_id &&
      meta.courriel
  );
}

router.post("/create-checkout-session", async (req, res) => {
  try {
    const typePaiement = safeTrim(req.body?.typePaiement || "participant");

    // ---------------------------------------------------------------
    // CAS 1 : PAIEMENT PARTICIPANT
    // ---------------------------------------------------------------
    if (typePaiement === "participant") {
      const tournoi_id = parsePositiveInt(req.body?.tournoi_id);
      const prenom = safeTrim(req.body?.prenom);
      const nom = safeTrim(req.body?.nom);
      const courriel = safeTrim(req.body?.courriel);
      const telephone = safeTrim(req.body?.telephone);
      const optionEquipe = safeTrim(req.body?.optionEquipe);

      const nom_equipe = safeTrim(req.body?.nom_equipe);
      const code_equipe = safeTrim(req.body?.code_equipe).toUpperCase();

      let categorie_participant = safeTrim(req.body?.categorie_participant).toLowerCase();
      if (!categorie_participant) {
        categorie_participant = "employe";
      } else if (categorie_participant === "employé") {
        categorie_participant = "employe";
      }
      if (!["employe", "retraite"].includes(categorie_participant)) {
        return res.status(400).json({
          message: "Catégorie participant invalide (employe ou retraite).",
        });
      }

      if (!tournoi_id || !prenom || !nom || !courriel) {
        return res.status(400).json({
          message: "Données d'inscription invalides.",
        });
      }

      if (!isValidEmail(courriel)) {
        return res.status(400).json({
          message: "Format de courriel invalide.",
        });
      }

      if (!optionEquipe || !["creer", "rejoindre"].includes(optionEquipe)) {
        return res.status(400).json({
          message: "Option d'équipe invalide.",
        });
      }

      if (optionEquipe === "creer" && !nom_equipe) {
        return res.status(400).json({
          message: "Le nom d'équipe est requis.",
        });
      }

      if (optionEquipe === "rejoindre" && !code_equipe) {
        return res.status(400).json({
          message: "Le code d'équipe est requis.",
        });
      }

      const tournoi = await findTournoiForPayment(tournoi_id);

      if (!tournoi) {
        return res.status(404).json({
          message: "Tournoi introuvable.",
        });
      }

      if (!tournoi.inscriptions_ouvertes) {
        return res.status(400).json({
          message: "Les inscriptions sont fermées pour ce tournoi.",
        });
      }

      const courrielExiste = await verifierCourrielDejaInscritTournoi(
        tournoi_id,
        courriel
      );

      if (courrielExiste.existe) {
        return res.status(409).json({
          message: "Un participant avec ce courriel est déjà inscrit à ce tournoi.",
        });
      }

      const dispoAvantPaiement = await verifierDisponibiliteAvantPaiement(
  tournoi_id,
  "participant",
  optionEquipe
);

if (!dispoAvantPaiement.ok) {
  return res.status(dispoAvantPaiement.status || 400).json({
    message: dispoAvantPaiement.message || "Inscription impossible pour le moment.",
  });
}

      const montantCents = toStripeAmount(tournoi.prix_joueur);

      if (montantCents === null || montantCents <= 0) {
        return res.status(400).json({
          message: "Le prix du joueur est invalide ou nul pour ce tournoi.",
        });
      }

      const successUrl = `${process.env.FRONTEND_URL}/paiement/succes?session_id={CHECKOUT_SESSION_ID}`;

      const stripeMetadata = {
        type_paiement: "participant",
        tournoi_id: String(tournoi.id),
        prenom,
        nom,
        courriel,
        telephone: telephone || "",
        option_equipe: optionEquipe,
        nom_equipe: nom_equipe || "",
        code_equipe: code_equipe || "",
        categorie_participant: categorie_participant,
      };

      console.log("Metadata participant envoyée à Stripe :", stripeMetadata);

      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        customer_email: courriel,
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "cad",
              product_data: {
                name: `Inscription tournoi de golf - ${tournoi.nom}`,
                description: `${prenom} ${nom}`,
              },
              unit_amount: montantCents,
            },
          },
        ],
        metadata: stripeMetadata,
        payment_intent_data: {
          metadata: stripeMetadata,
        },
        success_url: successUrl,
        cancel_url: `${process.env.FRONTEND_URL}/paiement/annule`,
      });

      await createPaiementEnAttente({
        tournoiId: tournoi.id,
        montantCents,
        stripeSessionId: session.id,
      });

      return res.status(200).json({
        url: session.url,
        sessionId: session.id,
      });
    }

    // ---------------------------------------------------------------
    // CAS 2 : PAIEMENT COMMANDITE
    // ---------------------------------------------------------------
    if (typePaiement === "commandite") {
      const tournoi_id = parsePositiveInt(req.body?.tournoi_id);
      const commandite_id = parsePositiveInt(req.body?.commandite_id);
      const courriel = safeTrim(req.body?.courriel);
      const montantCents = toStripeAmount(req.body?.montant);

      if (!tournoi_id || !commandite_id || !courriel) {
        return res.status(400).json({
          message: "Données de commandite invalides.",
        });
      }

      if (!isValidEmail(courriel)) {
        return res.status(400).json({
          message: "Format de courriel invalide.",
        });
      }

      if (montantCents === null || montantCents <= 0) {
        return res.status(400).json({
          message: "Montant de commandite invalide.",
        });
      }

      const tournoi = await findTournoiForPayment(tournoi_id);

      if (!tournoi) {
        return res.status(404).json({
          message: "Tournoi introuvable.",
        });
      }

      if (!tournoi.inscriptions_ouvertes) {
        return res.status(400).json({
          message: "Les inscriptions sont fermées pour ce tournoi.",
        });
      }

            const dispoAvantPaiement = await verifierDisponibiliteAvantPaiement(
        tournoi_id,
        "commandite"
      );

      if (!dispoAvantPaiement.ok) {
        return res.status(dispoAvantPaiement.status || 400).json({
          message: dispoAvantPaiement.message || "Commandite impossible pour le moment.",
        });
      }


      const commandite = await findCommanditeForPayment(commandite_id);

      if (!commandite) {
        return res.status(404).json({
          message: "Commandite introuvable.",
        });
      }

      if (Number(commandite.tournoi_id) !== Number(tournoi_id)) {
        return res.status(400).json({
          message: "Cette commandite n'appartient pas au tournoi sélectionné.",
        });
      }

      const successUrl = `${process.env.FRONTEND_URL}/paiement/succes?session_id={CHECKOUT_SESSION_ID}`;

      const stripeMetadata = {
        type_paiement: "commandite",
        tournoi_id: String(tournoi.id),
        commandite_id: String(commandite.id),
        courriel,
      };

      console.log("Metadata commandite envoyée à Stripe :", stripeMetadata);

      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        customer_email: courriel,
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "cad",
              product_data: {
                name: `Commandite tournoi de golf - ${tournoi.nom}`,
                description: `Commandite #${commandite.id}`,
              },
              unit_amount: montantCents,
            },
          },
        ],
        metadata: stripeMetadata,
        payment_intent_data: {
          metadata: stripeMetadata,
        },
        success_url: successUrl,
        cancel_url: `${process.env.FRONTEND_URL}/paiement/annule`,
      });

      await createPaiementEnAttente({
        tournoiId: tournoi.id,
        montantCents,
        stripeSessionId: session.id,
        commanditeId: commandite.id,
      });

      return res.status(200).json({
        url: session.url,
        sessionId: session.id,
      });
    }

    return res.status(400).json({
      message: "typePaiement invalide.",
    });
  } catch (err) {
    console.error("POST /payments/create-checkout-session:", err);
    return res.status(500).json({
      message: "Erreur serveur lors de la création du paiement.",
      detail: err?.message || null,
    });
  }
});

router.post("/webhook", async (req, res) => {
  const signature = req.headers["stripe-signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    return res.status(500).send("Webhook secret manquant.");
  }

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, signature, webhookSecret);
    console.log("Webhook reçu :", event.type);
  } catch (err) {
    console.error("Stripe webhook signature error:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const stripeSessionId = session.id;
      const paymentIntentId = session.payment_intent || null;

      console.log("=== checkout.session.completed ===");
      console.log("Session payée :", stripeSessionId);
      console.log("Metadata session Stripe :", session.metadata || {});

      const paiement = await findPaiementByStripeSessionId(stripeSessionId);

      if (!paiement) {
        console.error("Paiement introuvable pour la session :", stripeSessionId);
        return res.status(200).json({
          received: true,
          warning: "Paiement introuvable pour cette session Stripe.",
        });
      }

      if (paiement.statut === "PAYE") {
        return res.status(200).json({
          received: true,
          message: "Paiement déjà traité.",
        });
      }

      let paymentIntentMetadata = {};

      if (paymentIntentId) {
        try {
          const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
          paymentIntentMetadata = paymentIntent?.metadata || {};
          console.log("Metadata payment_intent Stripe :", paymentIntentMetadata);
        } catch (err) {
          console.error("Impossible de relire le payment_intent :", err.message);
        }
      }

      const metadata = normalizeMetadata(
        session.metadata || {},
        paymentIntentMetadata
      );

      console.log("Metadata fusionnée utilisée :", metadata);

      // -------------------------------------------------------------
      // CAS 1 : WEBHOOK PARTICIPANT
      // -------------------------------------------------------------
      if (metadata.type_paiement === "participant") {
        if (!hasRequiredParticipantMetadata(metadata)) {
          await markPaiementEchec({
            stripeSessionId,
            paymentIntentId,
          });

          return res.status(200).json({
            received: true,
            warning:
              "Metadata Stripe participant incomplète. Impossible de créer l'inscription après paiement.",
          });
        }

        const tournoi_id = parsePositiveInt(metadata.tournoi_id);
        const prenom = metadata.prenom;
        const nom = metadata.nom;
        const courriel = metadata.courriel;
        const telephone = metadata.telephone || null;
        const optionEquipe = metadata.option_equipe;
        const nom_equipe = metadata.nom_equipe;
        const code_equipe = metadata.code_equipe;

        let inscriptionResponse;

        /**
 * Vérification finale au moment réel du paiement
 * (IMPORTANT — évite dépassement tournoi)
 */

const dispoFinale = await verifierDisponibiliteAvantPaiement(
  tournoi_id,
  "participant",
  optionEquipe
);

if (!dispoFinale.ok) {
  console.error(
    "Tournoi complet au moment du webhook Stripe :",
    dispoFinale.message
  );

  await markPaiementEchec({
    stripeSessionId,
    paymentIntentId,
  });

  return res.status(200).json({
    received: true,
    warning: dispoFinale.message,
  });
}

        if (optionEquipe === "creer") {
          inscriptionResponse = await inscriptionCreerEquipe({
            tournoi_id,
            prenom,
            nom,
            courriel,
            telephone,
            nom_equipe,
            categorie_participant: metadata.categorie_participant,
          });
        } else if (optionEquipe === "rejoindre") {
          inscriptionResponse = await inscriptionRejoindreEquipe({
            tournoi_id,
            prenom,
            nom,
            courriel,
            telephone,
            code_equipe,
            categorie_participant: metadata.categorie_participant,
          });
        } else {
          await markPaiementEchec({
            stripeSessionId,
            paymentIntentId,
          });

          return res.status(200).json({
            received: true,
            warning: "Option équipe invalide dans metadata Stripe.",
          });
        }

        console.log("Résultat inscription webhook :", inscriptionResponse);
        console.log(
          "Erreur détaillée inscription webhook :",
          inscriptionResponse?.error || null
        );

        if (inscriptionResponse?.error) {
          console.error(
            "Erreur métier après paiement Stripe :",
            inscriptionResponse.error
          );

          await markPaiementEchec({
            stripeSessionId,
            paymentIntentId,
          });

          return res.status(200).json({
            received: true,
            warning: inscriptionResponse.error.message,
          });
        }

        const participant = inscriptionResponse?.participant ?? null;

        await markPaiementPaye({
          stripeSessionId,
          paymentIntentId,
          participantId: participant?.id ?? null,
        });

        console.log(
          "Paiement participant marqué PAYE pour session :",
          stripeSessionId
        );

        return res.status(200).json({ received: true });
      }

      // -------------------------------------------------------------
      // CAS 2 : WEBHOOK COMMANDITE
      // -------------------------------------------------------------
      if (metadata.type_paiement === "commandite") {
        if (!hasRequiredCommanditeMetadata(metadata)) {
          await markPaiementEchec({
            stripeSessionId,
            paymentIntentId,
          });

          return res.status(200).json({
            received: true,
            warning:
              "Metadata Stripe commandite incomplète. Impossible de confirmer la commandite après paiement.",
          });
        }

        const commanditeId = parsePositiveInt(metadata.commandite_id);

        if (!commanditeId) {
          await markPaiementEchec({
            stripeSessionId,
            paymentIntentId,
          });

          return res.status(200).json({
            received: true,
            warning: "commandite_id invalide dans les metadata Stripe.",
          });
        }

        await markCommanditePaye(commanditeId);
        await markJoueursCommanditesPayes(commanditeId);

        await markPaiementPaye({
          stripeSessionId,
          paymentIntentId,
          commanditeId,
        });

        console.log(
          "Paiement commandite marqué PAYE pour session :",
          stripeSessionId
        );

        return res.status(200).json({ received: true });
      }

      await markPaiementEchec({
        stripeSessionId,
        paymentIntentId,
      });

      return res.status(200).json({
        received: true,
        warning: "type_paiement absent ou invalide dans les metadata Stripe.",
      });
    }

    if (event.type === "checkout.session.expired") {
      const session = event.data.object;

      await markPaiementEchec({
        stripeSessionId: session.id,
        paymentIntentId: null,
      });
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error("POST /payments/webhook processing:", err);
    return res.status(500).json({
      message: "Erreur serveur dans le webhook Stripe.",
      detail: err?.message || null,
    });
  }
});

router.get("/confirmation", async (req, res) => {
  try {
    const sessionId = safeTrim(req.query?.session_id);

    if (!sessionId) {
      return res.status(400).json({
        message: "session_id manquant.",
      });
    }

    const row = await findConfirmationBySessionId(sessionId);

    if (!row) {
      return res.status(404).json({
        message: "Confirmation introuvable pour cette session.",
      });
    }

    /**
     * On relit les metadata Stripe pour récupérer notamment
     * option_equipe ("creer" ou "rejoindre").
     *
     * Cette information n'est pas stockée dans la requête SQL
     * de confirmation actuelle, donc on la récupère directement
     * depuis la session Stripe.
     */
    let paymentIntentMetadata = {};
    let sessionMetadata = {};

    try {
      const stripeSession = await stripe.checkout.sessions.retrieve(sessionId);
      sessionMetadata = stripeSession?.metadata || {};

      if (stripeSession?.payment_intent) {
        try {
          const paymentIntent = await stripe.paymentIntents.retrieve(
            stripeSession.payment_intent
          );
          paymentIntentMetadata = paymentIntent?.metadata || {};
        } catch (err) {
          console.error(
            "GET /payments/confirmation - lecture payment_intent impossible :",
            err?.message || err
          );
        }
      }
    } catch (err) {
      console.error(
        "GET /payments/confirmation - lecture session Stripe impossible :",
        err?.message || err
      );
    }

    const metadata = normalizeMetadata(sessionMetadata, paymentIntentMetadata);
    const optionEquipe = safeTrim(metadata?.option_equipe).toLowerCase();

    return res.status(200).json({
      paiement: {
        id: row.paiement_id,
        stripe_session_id: row.stripe_session_id,
        statut: row.paiement_statut,
        montant_cents: row.montant_cents,
        date_creation: row.paiement_date,
      },
      participant: row.participant_id
        ? {
            id: row.participant_id,
            prenom: row.participant_prenom,
            nom: row.participant_nom,
            courriel: row.participant_courriel,
          }
        : null,
      equipe: row.equipe_id
        ? {
            id: row.equipe_id,
            nom_equipe: row.nom_equipe,
            /**
             * On n'expose le code_secret que si l'équipe
             * a été créée par ce paiement.
             */
            code_secret: optionEquipe === "creer" ? row.code_secret : null,
          }
        : null,
      commandite: row.commandite_id
        ? {
            id: row.commandite_id,
            statut: row.commandite_statut,
          }
        : null,
      option_equipe: optionEquipe || "",
    });
  } catch (err) {
    console.error("GET /payments/confirmation:", err);
    return res.status(500).json({
      message: "Erreur serveur lors de la récupération de la confirmation.",
      detail: err?.message || null,
    });
  }
});

export default router;