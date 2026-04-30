import { Fragment, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { IconCalendar, IconLocation, IconUsers } from "../components/Icons.jsx";

const API_BASE_URL = "http://localhost:3000";

function isOpenFlag(value) {
  if (value === true || value === 1) return true;
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();
  return ["true", "1", "t", "yes", "oui"].includes(normalized);
}

function BadgeStatut({ ouvert }) {
  return (
    <span
      style={{
        background: ouvert ? "#2E8B57" : "#B64132",
        color: "#fff",
        display: "inline-block",
        padding: "5px 14px",
        borderRadius: 20,
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: ".4px",
      }}
    >
      {ouvert ? "Inscriptions ouvertes" : "Inscriptions fermées"}
    </span>
  );
}

export default function Tournoi() {
  const [tournois, setTournois] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("actuel");

  useEffect(() => {
    let cancelled = false;

    async function fetchTournois() {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`${API_BASE_URL}/public/tournois`);
        const data = await res.json().catch(() => []);
        if (!res.ok || !Array.isArray(data)) {
          throw new Error("Impossible de charger les tournois.");
        }
        if (!cancelled) setTournois(data);
      } catch (err) {
        if (!cancelled) {
          setTournois([]);
          setError(err?.message || "Impossible de contacter le serveur du tournoi.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchTournois();
    return () => {
      cancelled = true;
    };
  }, []);

  const tournoiActuel = useMemo(
    () => tournois.find((t) => isOpenFlag(t?.inscriptions_ouvertes)) || null,
    [tournois]
  );

  const now = useMemo(() => new Date(), []);

  const tournoisAVenir = useMemo(() => {
    return tournois.filter((t) => {
      if (!t?.date_tournoi) return false;
      if (isOpenFlag(t?.inscriptions_ouvertes)) return false;
      return new Date(t.date_tournoi) > now;
    });
  }, [tournois, now]);

  const tournoisPasses = useMemo(() => {
    return tournois.filter((t) => {
      if (!t?.date_tournoi) return false;
      return new Date(t.date_tournoi) < now;
    });
  }, [tournois, now]);

  const renderCard = (tournoi) => {
    const ouverts = isOpenFlag(tournoi?.inscriptions_ouvertes);
    const inscrits = Number(tournoi?.participants_inscrits ?? 0);
    const capacite = Number(tournoi?.capacite_joueurs ?? 0);
    const restantes = Number(tournoi?.places_restantes ?? Math.max(capacite - inscrits, 0));
    const progress = capacite > 0 ? Math.max(0, Math.min((inscrits / capacite) * 100, 100)) : 0;

    return (
      <div className="tournoiHCard">
        <div className="tournoiHCard__imgWrap">
          <div
            className="tournoiHCard__img"
            style={{ background: "linear-gradient(135deg,#1E5A43,#0F2E25)" }}
            aria-hidden="true"
          />
          <div className="tournoiHCard__badge">
            <BadgeStatut ouvert={ouverts} />
          </div>
        </div>

        <div className="tournoiHCard__body">
          <div>
            <h2 className="tournoiHCard__name">{tournoi.nom}</h2>

            <div className="tournoiHCard__meta">
              <div className="tournoiHCard__metaRow">
                <span className="tournoiHCard__metaIcon" aria-hidden="true">
                  <IconCalendar size={16} />
                </span>
                <span>{String(tournoi.date_tournoi || "").slice(0, 10)}</span>
              </div>

              <div className="tournoiHCard__metaRow">
                <span className="tournoiHCard__metaIcon" aria-hidden="true">
                  <IconLocation size={16} />
                </span>
                <span>{tournoi.lieu || "Lieu à confirmer"}</span>
              </div>

              <div className="tournoiHCard__metaRow">
                <span className="tournoiHCard__metaIcon" aria-hidden="true">
                  <IconUsers size={16} />
                </span>
                <span>Capacité maximale : {capacite} joueurs</span>
              </div>
            </div>

            <div className="tournoiHCard__capacity">
              <div className="tournoiHCard__capacityText">
                <span>{inscrits} inscrits</span>
                <span>{restantes} places restantes</span>
              </div>
              <div className="tournoiHCard__progressBar">
                <div className="tournoiHCard__progressFill" style={{ width: `${progress}%` }} />
              </div>
            </div>
          </div>

          <div className="tournoiHCard__footer">
            <Link to={`/tournoi/${tournoi.id}`} className="tournoiHCard__btn">
              Voir les détails →
            </Link>
          </div>
        </div>
      </div>
    );
  };

  const heroTitle =
    activeTab === "actuel"
      ? "Tournoi actuel"
      : activeTab === "avenir"
        ? "Tournois à venir"
        : "Tournois passés";

  const heroSub =
    activeTab === "actuel"
      ? "Consultez le tournoi actuellement ouvert aux inscriptions et réservez votre place."
      : activeTab === "avenir"
        ? "Parcourez les prochains tournois planifiés."
        : "Retrouvez l'historique des tournois déjà tenus.";

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
          <h1
            style={{
              fontFamily: "'Playfair Display', Georgia, serif",
              fontSize: "clamp(36px, 5vw, 58px)",
              fontWeight: 700,
              color: "#fff",
              marginBottom: 16,
              maxWidth: 600,
            }}
          >
            {heroTitle}
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
            {heroSub}
          </p>
        </div>
      </div>

      <section style={{ padding: "56px 0 64px", background: "var(--ivory)" }}>
        <div className="wrap">
          <div className="tournoiTabs">
            <button
              type="button"
              className={activeTab === "actuel" ? "active" : ""}
              onClick={() => setActiveTab("actuel")}
            >
              Tournoi actuel
            </button>
            <button
              type="button"
              className={activeTab === "avenir" ? "active" : ""}
              onClick={() => setActiveTab("avenir")}
            >
              À venir
            </button>
            <button
              type="button"
              className={activeTab === "passes" ? "active" : ""}
              onClick={() => setActiveTab("passes")}
            >
              Passés
            </button>
          </div>

          {loading && <p style={{ color: "var(--muted)" }}>Chargement des informations du tournoi…</p>}
          {!loading && error && <p style={{ color: "var(--muted)" }}>{error}</p>}

          {!loading && !error && activeTab === "actuel" && (
            tournoiActuel ? (
              <div className="tournoiList">{renderCard(tournoiActuel)}</div>
            ) : (
              <div className="emptyMessage">
                <strong>Aucun tournoi ouvert actuellement</strong>
                Les inscriptions ouvriront bientôt.
              </div>
            )
          )}

          {!loading && !error && activeTab === "avenir" && (
            tournoisAVenir.length === 0 ? (
              <div className="emptyMessage">
                <strong>Aucun tournoi à venir</strong>
                Les prochains tournois apparaîtront ici.
              </div>
            ) : (
              <div className="tournoiList">
                {tournoisAVenir.map((t) => (
                  <Fragment key={t.id}>{renderCard(t)}</Fragment>
                ))}
              </div>
            )
          )}

          {!loading && !error && activeTab === "passes" && (
            tournoisPasses.length === 0 ? (
              <div className="emptyMessage">
                <strong>Aucun tournoi passé pour le moment</strong>
                Les anciens tournois apparaîtront ici une fois terminés.
              </div>
            ) : (
              <div className="tournoiList">
                {tournoisPasses.map((t) => (
                  <Fragment key={t.id}>{renderCard(t)}</Fragment>
                ))}
              </div>
            )
          )}
        </div>
      </section>
    </>
  );
}