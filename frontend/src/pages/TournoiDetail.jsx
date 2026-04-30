import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { IconCalendar, IconLocation, IconUsers } from "../components/Icons.jsx";

const API_BASE_URL = "http://localhost:3000";

function isOpenFlag(value) {
  if (value === true || value === 1) return true;
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();
  return ["true", "1", "t", "yes", "oui"].includes(normalized);
}

function formatDate(rawDate, withWeekday = false) {
  if (!rawDate) return "Non definie";
  const date = new Date(`${String(rawDate).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return String(rawDate).slice(0, 10);
  return date.toLocaleDateString("fr-CA", {
    weekday: withWeekday ? "long" : undefined,
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function getTodayStart() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

export default function TournoiDetail() {
  const { id } = useParams();
  const [tournoi, setTournoi] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function fetchTournoi() {
      try {
        setLoading(true);
        setError("");
        const res = await fetch(`${API_BASE_URL}/public/tournois/${id}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.message || "Tournoi introuvable");
        if (!cancelled) setTournoi(data);
      } catch (err) {
        if (!cancelled) {
          setError(err?.message || "Erreur lors du chargement du tournoi.");
          setTournoi(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchTournoi();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const inscrits = Number(tournoi?.participants_inscrits ?? 0);
  const capacite = Number(tournoi?.capacite_joueurs ?? 0);
  const placesRestantes = Number(tournoi?.places_restantes ?? Math.max(capacite - inscrits, 0));

  const statut = useMemo(() => {
    if (!tournoi) return "ferme";
    if (placesRestantes <= 0) return "complet";
    return isOpenFlag(tournoi.inscriptions_ouvertes) ? "ouvert" : "ferme";
  }, [tournoi, placesRestantes]);

  const joursRestantsAvantFermeture = useMemo(() => {
    if (!tournoi?.inscription_fin) return null;
    const today = getTodayStart();
    const fin = new Date(`${String(tournoi.inscription_fin).slice(0, 10)}T00:00:00`);
    if (Number.isNaN(fin.getTime())) return null;
    return Math.ceil((fin.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  }, [tournoi]);

  const progressPct = useMemo(() => {
    if (capacite <= 0) return 0;
    return Math.max(0, Math.min((inscrits / capacite) * 100, 100));
  }, [inscrits, capacite]);

  if (loading) {
    return (
      <div className="pageHero">
        <div className="wrap">
          <h1 className="pageHero__title">Chargement du tournoi…</h1>
        </div>
      </div>
    );
  }

  if (error || !tournoi) {
    return (
      <>
        <div className="pageHero">
          <div className="wrap">
            <h1 className="pageHero__title">Tournoi introuvable</h1>
          </div>
        </div>
        <div className="wrap page">
          <p>{error || "Ce tournoi n'existe pas."}</p>
          <Link to="/tournoi" className="btn btn--green">
            ← Retour a la liste
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      <div
        style={{
          background: "linear-gradient(135deg, var(--forest) 0%, var(--emerald) 100%)",
          padding: "80px 0 56px",
          color: "#fff",
        }}
      >
        <div className="wrap">
          <p
            style={{
              color: "var(--gold)",
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: ".14em",
              textTransform: "uppercase",
              marginBottom: 12,
              fontFamily: "'Inter', 'Segoe UI', sans-serif",
            }}
          >
            <Link to="/tournoi" style={{ color: "var(--gold)" }}>
              ← Tous les tournois
            </Link>
          </p>
          <h1
            style={{
              fontFamily: "'Playfair Display', Georgia, serif",
              fontSize: "clamp(36px, 5vw, 58px)",
              fontWeight: 700,
              color: "#fff",
              marginBottom: 14,
              maxWidth: 600,
            }}
          >
            {tournoi.nom}
          </h1>
          <p
            style={{
              fontSize: 18,
              color: "var(--beige)",
              lineHeight: 1.65,
              maxWidth: 520,
              margin: 0,
            }}
          >
            Decouvrez les informations detaillees du tournoi.
          </p>
        </div>
      </div>

      <div className="wrap page">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 28, alignItems: "start" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div className="panel">
              <h2>Informations du tournoi</h2>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                  gap: 10,
                  marginBottom: 14,
                }}
              >
                <div
                  style={{
                    background: "rgba(46,139,87,.06)",
                    border: "1px solid rgba(46,139,87,.18)",
                    borderRadius: 10,
                    padding: "9px 12px",
                  }}
                >
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 800,
                      color: "var(--emerald)",
                      letterSpacing: ".05em",
                      textTransform: "uppercase",
                      fontFamily: "'Inter', 'Segoe UI', sans-serif",
                    }}
                  >
                    Places restantes
                  </div>
                  <div
                    style={{
                      fontSize: "clamp(24px, 3vw, 30px)",
                      fontWeight: 700,
                      color: "var(--forest)",
                      lineHeight: 1.15,
                      marginTop: 2,
                      fontFamily: "'Playfair Display', Georgia, serif",
                    }}
                  >
                    {placesRestantes}
                  </div>
                </div>
                <div
                  style={{
                    background: "rgba(199,168,108,.12)",
                    border: "1px solid rgba(199,168,108,.3)",
                    borderRadius: 10,
                    padding: "9px 12px",
                  }}
                >
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 800,
                      color: "var(--gold)",
                      letterSpacing: ".05em",
                      textTransform: "uppercase",
                      fontFamily: "'Inter', 'Segoe UI', sans-serif",
                    }}
                  >
                    Fermeture
                  </div>
                  <div
                    style={{
                      fontSize: "clamp(24px, 2.6vw, 34px)",
                      fontWeight: 700,
                      color: "var(--forest)",
                      lineHeight: 1.15,
                      marginTop: 2,
                      fontFamily: "'Playfair Display', Georgia, serif",
                    }}
                  >
                    {joursRestantsAvantFermeture !== null && joursRestantsAvantFermeture >= 0
                      ? `Dans ${joursRestantsAvantFermeture} jour${joursRestantsAvantFermeture > 1 ? "s" : ""}`
                      : "Terminee"}
                  </div>
                </div>
              </div>

              <div className="detailMeta">
                <div className="detailMeta__row">
                  <IconCalendar size={16} />
                  <span>{formatDate(tournoi.date_tournoi, true)}</span>
                </div>
                <div className="detailMeta__row">
                  <IconLocation size={16} />
                  <span>{tournoi.lieu || "Lieu a confirmer"}</span>
                </div>
                <div className="detailMeta__row">
                  <IconUsers size={16} />
                  <span>Capacite : {capacite} joueurs</span>
                </div>
                <div className="detailMeta__row">
                  <span>Ouverture inscriptions : {formatDate(tournoi.inscription_debut)}</span>
                </div>
                <div className="detailMeta__row">
                  <span>Fermeture inscriptions : {formatDate(tournoi.inscription_fin)}</span>
                </div>
              </div>

              <div className="capacityBlock">
                <div className="capacityText">
                  <span>{inscrits} inscrits</span>
                  <span>{placesRestantes} places restantes</span>
                </div>
                <div className="progressBar">
                  <div className={`progressFill${statut === "complet" ? " progressFill--full" : ""}`} style={{ width: `${progressPct}%` }} />
                </div>
              </div>
            </div>
          </div>

          <div
            style={{
              background: "#fff",
              border: "1.5px solid var(--border)",
              borderRadius: 14,
              padding: "24px",
              boxShadow: "var(--shadow2)",
              position: "sticky",
              top: 90,
            }}
          >
            <h3 style={{ color: "var(--forest)", fontSize: 18, fontFamily: "'Playfair Display',serif", marginBottom: 12 }}>
              Inscription
            </h3>
            <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 32, fontWeight: 700, color: "var(--forest)", marginBottom: 4 }}>
              {Number(tournoi.prix_joueur ?? 0).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
            </div>
            <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 16 }}>par joueur</div>

            <div style={{ marginBottom: 18 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--muted)", marginBottom: 6 }}>
                <span>Inscriptions</span>
                <strong style={{ color: statut === "ouvert" ? "var(--emerald)" : "var(--danger)" }}>
                  {statut === "ouvert" ? "Ouvertes" : statut === "complet" ? "Complet" : "Fermees"}
                </strong>
              </div>
              <div className="progressBar">
                <div className={`progressFill${statut === "complet" ? " progressFill--full" : ""}`} style={{ width: `${progressPct}%` }} />
              </div>
            </div>

            {statut === "ouvert" ? (
              <Link
                to={`/inscription/${tournoi.id}`}
                className="btnPrimary"
                style={{ display: "flex", justifyContent: "center", textDecoration: "none", marginTop: 0 }}
              >
                S'inscrire maintenant
              </Link>
            ) : (
              <div className="closedMessage">
                {statut === "ferme" && "Les inscriptions sont fermees."}
                {statut === "complet" && "Le tournoi est complet."}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
