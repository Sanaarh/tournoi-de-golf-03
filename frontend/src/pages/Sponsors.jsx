/**
 * Sponsors.jsx
 * Page "Commandites" — photocopie fidèle de SponsorsPage.tsx + SponsorCard.tsx.
 * Design : hero image + gradient, section avantages, grille SponsorCards, CTA vert forêt.
 */

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  IconTrendUp,
  IconNetwork,
  IconTrophy,
  IconBolt,
  IconUsers,
  IconCheck,
  IconWarning,
} from "../components/Icons.jsx";

const API_BASE_URL = "http://localhost:3000";

/* ── Avantages de la section "Pourquoi" ── */
const pourquoi = [
  {
    Icon: IconTrendUp,
    titre: "Visibilité de la marque",
    desc: "Présentez votre organisation à un public exclusif de dirigeants et de décideurs.",
  },
  {
    Icon: IconNetwork,
    titre: "Réseautage premium",
    desc: "Connectez-vous avec des leaders de l'industrie et des clients potentiels dans un cadre sophistiqué.",
  },
  {
    Icon: IconTrophy,
    titre: "Impact communautaire",
    desc: "Soutenez l'excellence éducative tout en renforçant votre responsabilité sociale d'entreprise.",
  },
  {
    Icon: IconBolt,
    titre: "ROI marketing",
    desc: "Générez des pistes de qualité et renforcez la perception de votre marque grâce à un partenariat stratégique.",
  },
];

function normalizeText(value) {
  return String(value || "").trim();
}

function inferTierFromName(nom, idx = 0) {
  const n = normalizeText(nom).toLowerCase();

  if (n.includes("plat")) return "platinum";
  if (n.includes("or") || n.includes("gold")) return "or";
  if (n.includes("argent") || n.includes("silver")) return "argent";
  if (n.includes("bronze")) return "bronze";

  const cycle = ["or", "argent", "bronze", "platinum"];
  return cycle[idx % cycle.length];
}

function buildAvantages(description) {
  const raw = normalizeText(description);

  if (!raw) return [];

  return raw
    .split(/[•;\n]+/)
    .map((s) => normalizeText(s))
    .filter(Boolean);
}

/* ── Composant SponsorCard ── */
function SponsorCard({ formule, onChoisir }) {
  const dispo = formule.quota - formule.vendus;
  const estLimite = dispo <= 2;
  const estEpuise = dispo === 0;
  const tier = formule.tier;

  return (
    <div className={`sponsorCard sponsorCard--${tier}`}>
      <div>
        <span className={`sponsorCard__badge sponsorCard__badge--${tier}`}>
          {tier === "or"
            ? "Or"
            : tier === "argent"
            ? "Argent"
            : tier === "bronze"
            ? "Bronze"
            : "Platine"}
        </span>

        <h3 className="sponsorCard__name">{formule.nom}</h3>

        {normalizeText(formule.description) ? (
          <p className="sponsorCard__desc">{formule.description}</p>
        ) : null}
      </div>

      <div className="sponsorCard__priceBlock">
        <div className={`sponsorCard__price sponsorCard__price--${tier}`}>
          {formule.prix.toLocaleString("fr-CA", {
            style: "currency",
            currency: "CAD",
            maximumFractionDigits: 0,
          })}
        </div>
        <div className="sponsorCard__priceNote">par tournoi</div>
      </div>

      <div className="sponsorCard__slots">
        <span className="sponsorCard__slotsIcon" aria-hidden="true">
          <IconUsers size={16} />
        </span>
        <span>{formule.placesIncluses} places de joueur incluses</span>
      </div>

      {formule.avantages.length > 0 ? (
        <ul className="sponsorCard__benefits">
          {formule.avantages.map((av, i) => (
            <li key={i} className="sponsorCard__benefitRow">
              <span
                className={`sponsorCard__checkCircle sponsorCard__checkCircle--${tier}`}
                aria-hidden="true"
              >
                <IconCheck size={13} strokeWidth={2.5} />
              </span>
              <span>{av}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {estLimite && !estEpuise ? (
        <div className="sponsorCard__avail--limited">
          <span aria-hidden="true">
            <IconWarning size={15} />
          </span>
          <span>
            Seulement {dispo} sur {formule.quota} restants
          </span>
        </div>
      ) : (
        <div className="sponsorCard__avail">
          {dispo} sur {formule.quota} disponibles
        </div>
      )}

      <button
        type="button"
        className={`sponsorCard__btn sponsorCard__btn--${tier}`}
        onClick={onChoisir}
        disabled={estEpuise}
      >
        {estEpuise ? "Épuisé" : "Choisir cette formule"}
      </button>
    </div>
  );
}

/* ── Page principale ── */
export default function Sponsors() {
  const [formules, setFormules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tournoiOuvert, setTournoiOuvert] = useState(false);

  useEffect(() => {
    let ignore = false;

    async function loadFormules() {
      try {
        setLoading(true);

        const tournoiRes = await fetch(`${API_BASE_URL}/public/tournoi-actif`);
        const tournoi = await tournoiRes.json().catch(() => ({}));

        // Aucun tournoi ouvert : on n'affiche aucune offre.
        if (!tournoiRes.ok || !tournoi?.id) {
          if (!ignore) {
            setTournoiOuvert(false);
            setFormules([]);
          }
          return;
        }

        if (!ignore) {
          setTournoiOuvert(true);
        }

        const typesRes = await fetch(
          `${API_BASE_URL}/public/types-commandites?tournoi_id=${encodeURIComponent(
            tournoi.id
          )}`
        );

        const types = await typesRes.json().catch(() => []);

        // Tournoi ouvert, mais aucune commandite créée par l'admin.
        if (!typesRes.ok || !Array.isArray(types) || types.length === 0) {
          if (!ignore) {
            setFormules([]);
          }
          return;
        }

        const mapped = types.map((t, idx) => ({
          id: String(t.id),
          tier: inferTierFromName(t.nom, idx),
          nom: t.nom,
          prix: Math.round(Number(t.prix_cents || 0) / 100),
          description: t.description || "",
          avantages: buildAvantages(t.description),
          placesIncluses: Number(t.places_incluses || 0),
          quota: Number(t.quota || 0),
          vendus: Number(t.nb_commandites || 0),
        }));

        if (!ignore) {
          setFormules(mapped);
        }
      } catch {
        // En cas d'erreur API, on évite d'afficher des offres fictives.
        if (!ignore) {
          setTournoiOuvert(false);
          setFormules([]);
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    loadFormules();

    return () => {
      ignore = true;
    };
  }, []);

  const formulesAffichees = useMemo(() => formules, [formules]);

  function scrollVersFormules() {
    document.getElementById("formules")?.scrollIntoView({ behavior: "smooth" });
  }

  function choisirFormule(formule) {
    window.location.href = "/tournoi";
  }

  return (
    <>
      {/* ── Hero avec image réelle ── */}
      <section className="sponsorHero">
        <img
          className="sponsorHero__bg"
          src="https://images.unsplash.com/photo-1716464968470-c2162dd998e4?fit=max&fm=jpg&w=1200&q=80"
          alt="Club de golf élégant au coucher de soleil"
          loading="eager"
          onError={(e) => {
            e.target.style.display = "none";
          }}
        />

        <div className="sponsorHero__overlay" aria-hidden="true" />

        <div className="wrap sponsorHero__content">
          <div className="sponsorHero__pill">PARTENARIATS CORPORATIFS</div>

          <h1 className="sponsorHero__title">
            Propulsez votre marque grâce à la commandite premium
          </h1>

          <p className="sponsorHero__sub">
            Devenez partenaire du prestigieux tournoi de golf du Collège La Cité
            et accédez à un public exclusif de dirigeants, leaders de
            l'industrie et décideurs.
          </p>

          <button
            type="button"
            className="sponsorHero__btn"
            onClick={scrollVersFormules}
          >
            Explorer les formules →
          </button>
        </div>
      </section>

      {/* ── Section "Pourquoi devenir commanditaire ?" ── */}
      <section className="sponsorWhySection">
        <div className="wrap">
          <div className="sponsorWhySection__head">
            <h2 className="sponsorWhySection__title">
              Pourquoi devenir commanditaire ?
            </h2>
            <p className="sponsorWhySection__sub">
              Des opportunités de commandite stratégiques conçues pour maximiser
              l'impact de votre marque et vos objectifs commerciaux.
            </p>
          </div>

          <div className="sponsorWhyGrid">
            {pourquoi.map((item) => (
              <div key={item.titre} style={{ textAlign: "center" }}>
                <div className="sponsorWhyItem__icon" aria-hidden="true">
                  <item.Icon size={32} />
                </div>
                <h3 className="sponsorWhyItem__title">{item.titre}</h3>
                <p className="sponsorWhyItem__desc">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Section formules de commandite ── */}
      <section id="formules" className="sponsorPkgSection">
        <div className="wrap">
          <div className="sponsorPkgSection__head">
            <h2 className="sponsorPkgSection__title">
              Formules de commandite
            </h2>
            <p className="sponsorPkgSection__sub">
              Choisissez le niveau de partenariat qui correspond à vos objectifs
              commerciaux et à votre budget.
            </p>
          </div>

          {loading ? (
            <p className="sponsorPkgSection__empty">Chargement des offres...</p>
          ) : !tournoiOuvert ? (
            <p className="sponsorPkgSection__empty">
              Aucun tournoi ouvert pour le moment. Les offres de commandite ne
              sont pas disponibles.
            </p>
          ) : formulesAffichees.length === 0 ? (
            <p className="sponsorPkgSection__empty">
              Aucune offre de commandite n’a encore été créée pour ce tournoi.
            </p>
          ) : (
            <div className="sponsorPkgGrid">
              {formulesAffichees.map((f) => (
                <SponsorCard
                  key={f.id}
                  formule={f}
                  onChoisir={() => choisirFormule(f)}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── CTA final ── */}
      <section className="sponsorCtaFinal">
        <img
          className="sponsorCtaFinal__bg"
          src="https://images.unsplash.com/photo-1629673120178-53a664eec9e8?fit=max&fm=jpg&w=1200&q=80"
          alt=""
          aria-hidden="true"
          loading="lazy"
          onError={(e) => {
            e.target.style.display = "none";
          }}
        />

        <div className="sponsorCtaFinal__content">
          <h2 className="sponsorCtaFinal__title">
            Prêt à nous rejoindre comme partenaire ?
          </h2>

          <p className="sponsorCtaFinal__sub">
            Rejoignez les organisations leaders qui soutiennent l'excellence
            tout en atteignant leurs objectifs marketing. Places de commandite
            limitées par tournoi.
          </p>

          <div className="sponsorCtaFinal__actions">
            <Link to="/tournoi" className="sponsorCtaFinal__btnPrimary">
              Sélectionner un tournoi →
            </Link>

            <a
              href="mailto:tournoi@lacitec.on.ca?subject=Demande de commandite"
              className="sponsorCtaFinal__btnOutline"
            >
              Contacter notre équipe
            </a>
          </div>
        </div>
      </section>
    </>
  );
}