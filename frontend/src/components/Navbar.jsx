/**
 * Navbar.jsx
 * Barre de navigation principale — design premium.
 */

import { NavLink, Link } from "react-router-dom";
import { IconGolfFlag } from "./Icons.jsx";

function navClass({ isActive }) {
  return "navLink" + (isActive ? " isActive" : "");
}

export default function Navbar() {
  return (
    <nav className="navbar" aria-label="Navigation principale">
      <div className="wrap navbar__inner">

        {/* Logo + marque */}
        <Link to="/" className="navBrand">
          <div className="navLogo" aria-hidden="true">
            <IconGolfFlag size={28} />
          </div>
          <div className="navBrandText">
            <span className="navBrandMain">Collège La Cité</span>
            <span className="navBrandSub">Tournoi de Golf</span>
          </div>
        </Link>

        {/* Liens centraux */}
        <div className="navLinks">
          <NavLink to="/" className={navClass} end>
            Accueil
          </NavLink>
          <NavLink to="/tournoi" className={navClass}>
            Tournoi
          </NavLink>
          <NavLink to="/sponsors" className={navClass}>
            Sponsors
          </NavLink>
        </div>

        {/* Boutons d'action */}
        <div className="navRight">
          <Link to="/inscription" className="btnOutline">
            S'inscrire
          </Link>
          <Link to="/admin" className="adminBtn">
            Admin
          </Link>
        </div>

      </div>
    </nav>
  );
}
