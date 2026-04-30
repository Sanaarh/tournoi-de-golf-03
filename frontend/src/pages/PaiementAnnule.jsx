/**
 * PaiementAnnule.jsx
 * --------------------------------------------------------------------
 * Page affichée lorsque l'utilisateur annule ou abandonne le paiement
 * Stripe avant sa confirmation finale.
 *
 * Objectif :
 * - informer clairement l'utilisateur que le paiement n'a pas été finalisé
 * - éviter une page blanche après retour depuis Stripe Checkout
 * - proposer des actions simples :
 *   - revenir à l'inscription
 *   - consulter la page des tournois
 *
 * Remarques :
 * - cette page ne modifie pas l'état du paiement côté backend
 * - elle sert uniquement d'écran de retour côté frontend
 * - la gestion réelle d'un paiement annulé/expiré doit être traitée
 *   côté serveur via Stripe webhook
 */

import { Link } from "react-router-dom";

export default function PaiementAnnule() {
  return (
    <div className="registrationPage">
      <div className="registrationHero">
        <div className="registrationHero__content">
          <p className="eyebrow">Tournoi de golf</p>
          <h1 className="registrationHero__title">Paiement annulé</h1>
          <p className="registrationHero__text">
            Votre paiement n’a pas été complété. Vous pouvez reprendre
            l’inscription ou revenir à la liste des tournois.
          </p>
        </div>
      </div>

      <div className="registrationShell">
        <div className="regCard">
          <div style={{ textAlign: "center", padding: "20px 0 10px" }}>
            <div
              style={{
                width: 90,
                height: 90,
                borderRadius: "50%",
                background: "#dc2626",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 20px",
                color: "#fff",
                fontSize: 40,
                fontWeight: 700,
              }}
            >
              !
            </div>

            <h2
              className="regCard__h2"
              style={{ textAlign: "center", marginBottom: 10 }}
            >
              Transaction non finalisée
            </h2>

            <p
              className="regCard__sub"
              style={{ textAlign: "center", maxWidth: 700, margin: "0 auto" }}
            >
              Aucun paiement confirmé n’a été reçu sur cette tentative. Si vous
              souhaitez participer au tournoi, vous pouvez reprendre la
              procédure de paiement.
            </p>
          </div>

          <div
            style={{
              maxWidth: 760,
              margin: "24px auto 0",
              background: "#fff7f7",
              border: "1px solid rgba(220, 38, 38, 0.22)",
              borderRadius: 16,
              padding: 22,
            }}
          >
            <h3
              style={{
                marginTop: 0,
                marginBottom: 10,
                color: "#7f1d1d",
                fontSize: 22,
                fontFamily: "'Playfair Display', serif",
              }}
            >
              Que s’est-il passé ?
            </h3>

            <p style={{ margin: 0, color: "#667085", lineHeight: 1.7 }}>
              Vous avez quitté ou interrompu la page de paiement Stripe avant la
              confirmation finale. Vous pouvez retourner au formulaire
              d’inscription et recommencer lorsque vous êtes prêt.
            </p>
          </div>

          <div
            className="regNav"
            style={{
              marginTop: 28,
              borderTop: "1px solid var(--border, #e5e7eb)",
              paddingTop: 24,
            }}
          >
            <Link
              to="/tournoi"
              className="btnGhost"
              style={{ textDecoration: "none", display: "inline-flex" }}
            >
              Retour aux tournois
            </Link>

            <Link
              to="/inscription"
              className="btnPrimary"
              style={{ textDecoration: "none", display: "inline-flex", minWidth: 220, justifyContent: "center" }}
            >
              Reprendre l’inscription
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}