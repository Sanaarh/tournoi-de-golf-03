/**
 * HomeHero.jsx
 * Hero pleine largeur 620px+, gradient to-transparent (côté droit visible),
 * pill "✨ Édition 2026", titre Playfair, sous-titre serif "Collège La Cité",
 * 2 boutons. Photocopie fidèle du modèle "Plateforme de gestion de tournoi".
 */

import { Link } from "react-router-dom";
import { IconSparkle, IconCalendar, IconTrophy } from "./Icons.jsx";

export default function HomeHero() {
  return (
    <section className="hero" aria-label="Présentation du tournoi">
      {/* Image de fond */}
      <img
        className="hero__img"
        src="https://images.unsplash.com/photo-1771599370349-02923621ddaf?fit=max&fm=jpg&w=1200&q=80"
        alt="Parcours de golf luxueux"
        loading="eager"
      />
      <div className="hero__overlay" aria-hidden="true" />

      <div className="hero__content wrap">
        {/* Pill "Édition 2026" */}
        <div className="hero__pill">
          <IconSparkle size={15} aria-hidden="true" />
          <span>Édition 2026</span>
        </div>

        <h1 className="hero__title">Tournoi de Golf Annuel</h1>

        {/* Sous-titre institution — identique au modèle */}
        <p className="hero__institution">Collège La Cité</p>

        <p className="hero__subtitle">
          Joignez-vous à nous pour une journée exceptionnelle de golf, de
          réseautage et de célébration. Un événement prestigieux qui rassemble
          notre communauté dans un cadre enchanteur.
        </p>

        <div className="hero__actions">
          <Link to="/tournoi" className="hero__btnPrimary">
            <IconCalendar size={17} aria-hidden="true" style={{ verticalAlign: "middle", marginRight: 6 }} />
            Voir les tournois
          </Link>
          <Link to="/sponsors" className="hero__btnSecondary">
            <IconTrophy size={17} aria-hidden="true" style={{ verticalAlign: "middle", marginRight: 6 }} />
            Devenir commanditaire
          </Link>
        </div>
      </div>
    </section>
  );
}
