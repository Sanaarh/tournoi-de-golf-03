/**
 * PaiementSucces.jsx
 * --------------------------------------------------------------------
 * Page affichée après un paiement Stripe réussi.
 */

import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

const API_BASE_URL = "http://localhost:3000";

export default function PaiementSucces() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session_id") || "";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState(null);

  function imprimerTicket() {
    window.print();
  }

  useEffect(() => {
    let cancelled = false;

    async function chargerConfirmationAvecAttente() {
      if (!sessionId) {
        setError("Référence de session Stripe introuvable.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");

      const maxTentatives = 12;
      const delaiMs = 1500;

      for (let i = 0; i < maxTentatives; i += 1) {
        try {
          const res = await fetch(
            `${API_BASE_URL}/payments/confirmation?session_id=${encodeURIComponent(sessionId)}`
          );

          const body = await res.json().catch(() => ({}));

          if (res.ok) {
            const statutPaiement = String(body?.paiement?.statut || "").trim().toUpperCase();

            if (statutPaiement === "EN_ATTENTE") {
              await new Promise((resolve) => setTimeout(resolve, delaiMs));
              continue;
            }

            if (!cancelled) {
              setConfirmation(body);
              setLoading(false);
            }
            return;
          }

          if (res.status === 404) {
            await new Promise((resolve) => setTimeout(resolve, delaiMs));
            continue;
          }

          if (!cancelled) {
            setError(body?.message || "Impossible de charger la confirmation.");
            setLoading(false);
          }
          return;
        } catch {
          await new Promise((resolve) => setTimeout(resolve, delaiMs));
        }
      }

      if (!cancelled) {
        setError(
          "Le paiement a été reçu, mais la confirmation complète n'est pas encore disponible. Rechargez la page dans quelques secondes."
        );
        setLoading(false);
      }
    }

    chargerConfirmationAvecAttente();

    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  const paiement = confirmation?.paiement || null;
  const participant = confirmation?.participant || null;
  const equipe = confirmation?.equipe || null;
  const commandite = confirmation?.commandite || null;

  const statutPaiement = String(paiement?.statut || "").trim().toUpperCase();
  const inscriptionEchoueeApresPaiement = statutPaiement === "ECHEC";
  const inscriptionConfirmee = statutPaiement === "PAYE";

  const dateAffichee = paiement?.date_creation
    ? new Date(paiement.date_creation).toLocaleDateString("fr-CA")
    : new Date().toLocaleDateString("fr-CA");

  const heureAffichee = paiement?.date_creation
    ? new Date(paiement.date_creation).toLocaleTimeString("fr-CA")
    : new Date().toLocaleTimeString("fr-CA");

  const montantAffiche = paiement
    ? (Number(paiement.montant_cents || 0) / 100).toLocaleString("fr-CA", {
        style: "currency",
        currency: "CAD",
        maximumFractionDigits: 2,
      })
    : "Non disponible";

  const estCommandite = Boolean(commandite?.id && !participant);

/**
 * Le backend renvoie maintenant option_equipe :
 * - "creer"
 * - "rejoindre"
 */
const optionEquipe = String(confirmation?.option_equipe || "").trim().toLowerCase();
const equipeCreee = optionEquipe === "creer";
const equipeRejointe = optionEquipe === "rejoindre";

const afficherCodeEquipe = Boolean(
  !estCommandite &&
  equipeCreee &&
  equipe?.code_secret
);

  const statutHero = String(confirmation?.paiement?.statut || "")
    .trim()
    .toUpperCase();
  const heroEchec = !loading && statutHero === "ECHEC";

  return (
    <div className="registrationPage">
      <div className="registrationHero">
        <div className="registrationHero__content">
          <p className="eyebrow">Tournoi de golf</p>
          <h1 className="registrationHero__title">
            {loading
              ? "Confirmation de paiement"
              : heroEchec
                ? "Paiement enregistré — à vérifier"
                : "Paiement réussi"}
          </h1>
          <p className="registrationHero__text">
            {loading
              ? "Récupération de votre reçu…"
              : heroEchec
                ? "Consultez le détail ci-dessous : le statut d’inscription peut différer du paiement Stripe."
                : "Votre paiement a été transmis avec succès. Vous pouvez imprimer votre ticket de confirmation ci-dessous."}
          </p>
        </div>
      </div>

      <div className="registrationShell">
        <div className="regCard">
          {loading ? (
            <p>Chargement de la confirmation…</p>
          ) : error ? (
            <div
              style={{
                padding: "14px 16px",
                borderRadius: 10,
                border: "1px solid #dc2626",
                color: "#dc2626",
                background: "#fff7f7",
              }}
            >
              {error}
            </div>
          ) : (
            <>
              <div style={{ textAlign: "center", paddingBottom: 24 }}>
                {inscriptionEchoueeApresPaiement ? (
                  <>
                    <div
                      style={{
                        width: 90,
                        height: 90,
                        borderRadius: "50%",
                        background: "#d97706",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        margin: "0 auto 20px",
                        color: "#fff",
                        fontSize: 36,
                        fontWeight: 700,
                      }}
                    >
                      !
                    </div>
                    <h2
                      className="regCard__h2"
                      style={{ marginBottom: 8, textAlign: "center" }}
                    >
                      Paiement reçu — inscription non finalisée
                    </h2>
                    <p
                      className="regCard__sub"
                      style={{ textAlign: "center", maxWidth: 700, margin: "0 auto" }}
                    >
                      Stripe a bien enregistré votre paiement, mais l&apos;inscription (équipe ou
                      tournoi) n&apos;a pas pu être complétée côté serveur (par exemple : tournoi ou
                      équipe complet, limite atteinte). Contactez l&apos;administration du tournoi
                      en indiquant la référence Stripe ci-dessous. Un remboursement peut être
                      nécessaire selon les règles en vigueur.
                    </p>
                  </>
                ) : (
                  <>
                    <div
                      style={{
                        width: 90,
                        height: 90,
                        borderRadius: "50%",
                        background: "var(--emerald, #2e8b57)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        margin: "0 auto 20px",
                        color: "#fff",
                        fontSize: 40,
                        fontWeight: 700,
                      }}
                    >
                      ✓
                    </div>
                    <h2
                      className="regCard__h2"
                      style={{ marginBottom: 8, textAlign: "center" }}
                    >
                      Paiement complété avec succès
                    </h2>
                    <p
                      className="regCard__sub"
                      style={{ textAlign: "center", maxWidth: 700, margin: "0 auto" }}
                    >
                      Merci. Votre transaction a bien été complétée via Stripe.
                    </p>
                  </>
                )}
              </div>

              {afficherCodeEquipe && (
                <div
                  style={{
                    maxWidth: 760,
                    margin: "0 auto 22px",
                    background: "#effaf3",
                    border: "1px solid rgba(46,139,87,.28)",
                    borderRadius: 16,
                    padding: 22,
                    textAlign: "center",
                  }}
                >
                  <div
                    style={{
                      fontWeight: 700,
                      fontSize: 18,
                      marginBottom: 10,
                      color: "#16351f",
                    }}
                  >
                    Code de votre équipe
                  </div>

                  <div
                    style={{
                      fontFamily: "monospace",
                      fontSize: 30,
                      fontWeight: 700,
                      letterSpacing: 3,
                      background: "#ffffff",
                      borderRadius: 12,
                      padding: "12px 18px",
                      display: "inline-block",
                      border: "1px solid #d0e8d8",
                    }}
                  >
                    {equipe.code_secret}
                  </div>

                  <p style={{ marginTop: 12, color: "#667085" }}>
                    Conservez ce code et partagez-le avec vos coéquipiers pour
                    qu’ils puissent rejoindre votre équipe.
                  </p>
                </div>
              )}

              <div
                id="ticket-paiement"
                style={{
                  maxWidth: 760,
                  margin: "0 auto",
                  background: "#fffdf8",
                  border: "1px dashed #c9b37e",
                  borderRadius: 16,
                  padding: 24,
                  boxShadow: "0 10px 25px rgba(0,0,0,0.05)",
                }}
              >
                <div
                  style={{
                    borderBottom: "1px solid #e8dfcf",
                    paddingBottom: 16,
                    marginBottom: 16,
                  }}
                >
                  <h3
                    style={{
                      margin: 0,
                      fontSize: 28,
                      color: "#16351f",
                      fontFamily: "'Playfair Display', serif",
                    }}
                  >
                    Ticket de confirmation
                  </h3>
                  <p style={{ margin: "8px 0 0 0", color: "#667085" }}>
                    Tournoi de golf — Collège La Cité
                  </p>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "220px 1fr",
                    gap: 12,
                    rowGap: 14,
                    fontSize: 16,
                  }}
                >
                  <div style={{ fontWeight: 700, color: "#344054" }}>Statut</div>
                  <div
                    style={{
                      color: inscriptionEchoueeApresPaiement ? "#b91c1c" : "#2e8b57",
                      fontWeight: 700,
                    }}
                  >
                    {inscriptionConfirmee
                      ? "PAYE"
                      : inscriptionEchoueeApresPaiement
                        ? "ECHEC (inscription)"
                        : paiement?.statut || "—"}
                  </div>

                  <div style={{ fontWeight: 700, color: "#344054" }}>Date</div>
                  <div>{dateAffichee}</div>

                  <div style={{ fontWeight: 700, color: "#344054" }}>Heure</div>
                  <div>{heureAffichee}</div>

                  <div style={{ fontWeight: 700, color: "#344054" }}>
                    {estCommandite ? "Commandite" : "Participant"}
                  </div>
                  <div>
                    {participant
                      ? `${participant.prenom} ${participant.nom}`
                      : commandite?.id
                        ? `Commandite #${commandite.id}`
                        : "Non disponible"}
                  </div>

                  <div style={{ fontWeight: 700, color: "#344054" }}>Courriel</div>
                  <div>{participant?.courriel || "Non disponible"}</div>

                  <div style={{ fontWeight: 700, color: "#344054" }}>Montant payé</div>
                  <div>{montantAffiche}</div>

                  <div style={{ fontWeight: 700, color: "#344054" }}>
                    Référence Stripe
                  </div>
                  <div
                    style={{
                      wordBreak: "break-all",
                      fontFamily: "monospace",
                      background: "#f8fafc",
                      padding: "6px 10px",
                      borderRadius: 8,
                    }}
                  >
                    {sessionId}
                  </div>

                  <div style={{ fontWeight: 700, color: "#344054" }}>Nom de l’équipe</div>
                  <div>{equipe?.nom_equipe || "Non disponible"}</div>

                  {afficherCodeEquipe && (
                    <>
                      <div style={{ fontWeight: 700, color: "#344054" }}>Code de l’équipe</div>
                      <div
                        style={{
                          fontFamily: "monospace",
                          fontWeight: 700,
                          fontSize: 18,
                          background: "#f8fafc",
                          padding: "8px 12px",
                          borderRadius: 8,
                          display: "inline-block",
                        }}
                      >
                        {equipe?.code_secret || "Non disponible"}
                      </div>
                    </>
                  )}
                </div>

                <div
                  style={{
                    marginTop: 24,
                    paddingTop: 16,
                    borderTop: "1px solid #e8dfcf",
                    color: "#667085",
                    lineHeight: 1.6,
                  }}
                >
                  {inscriptionEchoueeApresPaiement
                    ? "Le montant apparaît sur ce ticket pour trace, mais aucune inscription n’a été créée. Conservez cette page pour vos échanges avec l’organisation."
                    : afficherCodeEquipe
                      ? "Si vous avez créé une équipe, partagez ce code avec les autres joueurs pour qu’ils puissent la rejoindre au moment de leur inscription."
                      : equipeRejointe
                        ? "Votre inscription à l’équipe a bien été enregistrée."
                        : estCommandite
                          ? "Votre paiement de commandite a bien été enregistré."
                          : "Confirmation enregistrée avec succès."}
                </div>
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

                <button
                  type="button"
                  className="btnPrimary"
                  onClick={imprimerTicket}
                  style={{ minWidth: 220 }}
                >
                  Imprimer le ticket
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}