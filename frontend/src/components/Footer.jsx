/**
 * Footer.jsx
 * Pied de page premium — fond vert forêt, 3 colonnes.
 */

import { Link } from "react-router-dom";
import { IconGolfFlag } from "./Icons.jsx";

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="footer" role="contentinfo">
      <div className="wrap footer__inner">

        {/* Colonne marque */}
        <div className="footer__brand">
          <div className="footer__logoWrap">
            <div className="footer__logoBox" aria-hidden="true">
              <IconGolfFlag size={26} />
            </div>
            <span className="footer__brandName">Collège La Cité</span>
          </div>
          <p className="footer__desc">
            Le tournoi de golf annuel rassemble employés, retraités et
            partenaires dans un esprit de communauté et d'excellence.
          </p>
        </div>

        {/* Colonne liens rapides */}
        <div>
          <h4 className="footer__colTitle">Liens rapides</h4>
          <div className="footer__links">
            <Link to="/">Accueil</Link>
            <Link to="/tournoi">Tournoi</Link>
            <Link to="/sponsors">Sponsors</Link>
            <Link to="/inscription">Inscription</Link>
          </div>
        </div>

        {/* Colonne contact */}
        <div>
          <h4 className="footer__colTitle">Contact</h4>
          <div className="footer__links">
            <a href="mailto:tournoi@lacitec.on.ca">tournoi@lacitec.on.ca</a>
            <p>Ottawa, Ontario</p>
          </div>
        </div>

      </div>

      <div className="footer__bottom">
        <div className="wrap">
          © {year} Collège La Cité — Tous droits réservés
          <br />
          Équipe projet: Sanaa Kaouthar Rahem, Ali Squali, Meriem Ouachour
        </div>
      </div>
    </footer>
  );
}
