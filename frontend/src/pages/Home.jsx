/**
 * Home.jsx
 * Photocopie fidèle de home.tsx — "Plateforme de gestion de tournoi".
 * 7 sections pleine largeur, en français, React JavaScript.
 *
 * Sections :
 *  1. Hero (via HomeHero)
 *  2. Stats avec icônes — fond blanc, bordure bas
 *  3. À propos — 2 colonnes (texte + photo), fond ivoire
 *  4. Pourquoi participer — fond blanc, icônes vert forêt foncé
 *  5. Nos commanditaires — fond émeraude #2F6B4F, tuiles semi-transparentes
 *  6. Questions fréquentes — cartes blanches, icône checkmark or
 *  7. CTA final — dégradé forest → émeraude, 2 boutons
 */

import { Link } from "react-router-dom";
import HomeHero from "../components/HomeHero.jsx";
import {
  IconUsers, IconTrophy, IconMedal, IconHeart, IconCheck, IconTrendUp,
} from "../components/Icons.jsx";

/* ── Données ── */

const points = [
  {
    Icon: IconTrophy,
    titre: "Excellence",
    desc: "Un parcours de golf de championnat dans un cadre exceptionnel.",
  },
  {
    Icon: IconUsers,
    titre: "Convivialité",
    desc: "Rassemblez vos collègues pour une journée mémorable.",
  },
  {
    Icon: IconMedal,
    titre: "Reconnaissance",
    desc: "Prix prestigieux et reconnaissance de nos commanditaires.",
  },
  {
    Icon: IconHeart,
    titre: "Communauté",
    desc: "Renforcez les liens au sein de notre belle communauté.",
  },
];

const faqs = [
  {
    q: "Qui peut participer au tournoi ?",
    r: "Le tournoi est ouvert aux employés actuels, retraités du Collège La Cité, ainsi qu'aux commanditaires et leurs invités.",
  },
  {
    q: "Combien de joueurs par équipe ?",
    r: "Chaque équipe est composée de 4 joueurs maximum. Vous pouvez créer votre propre équipe ou rejoindre une équipe existante avec un code.",
  },
  {
    q: "Qu'est-ce qui est inclus dans l'inscription ?",
    r: "L'inscription comprend : le parcours de golf complet, la voiturette, le cocktail de bienvenue, le repas gastronomique et la participation aux tirages de prix.",
  },
  {
    q: "Comment devenir commanditaire ?",
    r: "Consultez notre page Commandites pour découvrir nos différents niveaux de partenariat (Platine, Or, Argent, Bronze) avec des avantages exclusifs pour chacun.",
  },
  {
    q: "Quelle est la politique d'annulation ?",
    r: "Les annulations doivent être effectuées au moins 14 jours avant l'événement pour un remboursement complet. Des frais s'appliquent pour les annulations tardives.",
  },
  {
    q: "Le tournoi a-t-il lieu en cas de pluie ?",
    r: "Le tournoi aura lieu beau temps, mauvais temps. En cas de conditions météorologiques extrêmes, nous communiquerons toute modification par courriel.",
  },
];

/* ── Composant principal ── */
export default function Home() {
  return (
    <>
      {/* 1 ─ Hero */}
      <HomeHero />

      {/* 2 ─ À propos du tournoi */}
      <section className="homeAboutSection" aria-label="À propos du tournoi">
        <div className="wrap">
          <div className="homeAboutGrid">
            {/* Texte */}
            <div>
              <h2 className="homeAboutTitle">À propos du tournoi</h2>

              <p className="homeAboutText">
                Depuis plus de 15 ans, notre tournoi de golf annuel est devenu un
                événement incontournable qui célèbre l'excellence, la camaraderie
                et l'esprit de notre institution.
              </p>
              <p className="homeAboutText">
                Organisé avec soin par le Collège La Cité, ce tournoi offre une
                expérience premium qui allie sport, réseautage et moments
                mémorables dans un cadre professionnel et convivial.
              </p>

            </div>

            {/* Photo */}
            <div className="homeAboutImgWrap">
              <img
                src="https://images.unsplash.com/photo-1606443192517-919653213206?fit=max&fm=jpg&w=1080&q=80"
                alt="Tournoi de golf professionnel"
                loading="lazy"
                onError={(e) => { e.target.style.display = "none"; }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* 3 ─ Pourquoi participer */}
      <section className="homeFeatSection2" aria-label="Pourquoi participer">
        <div className="wrap">
          <div className="homeFeatSection2__head">
            <h2 className="homeFeatSection2__title">Pourquoi participer ?</h2>
            <p className="homeFeatSection2__sub">
              Une expérience unique qui combine passion du golf et esprit d'équipe.
            </p>
          </div>

          <div className="homeFeatGrid2">
            {points.map((p) => (
              <div key={p.titre} className="homeFeatCard2">
                <div className="homeFeatCard2__iconDark" aria-hidden="true">
                  <p.Icon size={30} />
                </div>
                <h3 className="homeFeatCard2__title">{p.titre}</h3>
                <p className="homeFeatCard2__desc">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4 ─ Nos commanditaires */}
      <section className="homeSponsorSection" aria-label="Nos commanditaires">
        <div className="wrap">
          <div className="homeSponsorSection__head">
            <h2 className="homeSponsorSection__title">Nos commanditaires</h2>
            <p className="homeSponsorSection__sub">
              Merci à nos partenaires qui rendent cet événement possible.
            </p>
          </div>

          <div className="homeSponsorSection__cta">
            <Link to="/sponsors" className="homeSponsorSection__btn">
              Devenir commanditaire
            </Link>
          </div>
        </div>
      </section>

      {/* 5 ─ FAQ */}
      <section className="homeFaqSection" aria-label="Questions fréquentes">
        <div className="wrap">
          <div className="homeFaqSection__head">
            <h2 className="homeFaqSection__title">Questions fréquentes</h2>
            <p className="homeFaqSection__sub">
              Tout ce que vous devez savoir sur le tournoi.
            </p>
          </div>

          <div className="homeFaqList">
            {faqs.map((item, idx) => (
              <div key={idx} className="homeFaqCard">
                <div className="homeFaqCard__row">
                  {/* Icône checkmark — couleur or/accent comme dans le modèle */}
                  <span
                    className="homeFaqCard__check"
                    style={{ color: "var(--gold)" }}
                    aria-hidden="true"
                  >
                    <IconCheck size={18} color="var(--gold)" />
                  </span>
                  <div>
                    <h3 className="homeFaqCard__q">{item.q}</h3>
                    <p className="homeFaqCard__a">{item.r}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 6 ─ CTA final gradient */}
      <section className="homeCtaGradient" aria-label="Inscription au tournoi">
        <div className="homeCtaGradient__inner">
          <h2 className="homeCtaGradient__title">Prêt à vous inscrire ?</h2>
          <p className="homeCtaGradient__sub">
            Ne manquez pas cette opportunité exceptionnelle.
            Les places sont limitées !
          </p>

          <div className="homeCtaGradient__actions">
            <Link to="/tournoi" className="homeCtaGradient__btnPrimary">
              <IconTrendUp size={17} aria-hidden="true" style={{ verticalAlign: "middle", marginRight: 6 }} />
              S'inscrire maintenant
            </Link>
            <a
              href="mailto:golf@lacitec.on.ca"
              className="homeCtaGradient__btnGhost"
            >
              Nous contacter
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
