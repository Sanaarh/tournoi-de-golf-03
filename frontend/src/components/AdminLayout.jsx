/**
 * AdminLayout.jsx
 * Layout des pages admin : sidebar vert forêt à gauche + contenu à droite.
 * Chaque page admin gère elle-même la vérification de session.
 */

import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { IconGolfFlag, IconCalendar, IconUser, IconUsers, IconTrophy, IconNetwork, IconMedal } from "./Icons.jsx";

const API = "http://localhost:3000";

const navItems = [
  { to: "/admin/dashboard",       Icon: IconTrophy,   label: "Tableau de bord" },
  { to: "/admin/tournois",        Icon: IconCalendar, label: "Tournois" },
  { to: "/admin/types-commandites", Icon: IconNetwork, label: "Types de commandites" },
  { to: "/admin/commandites",     Icon: IconMedal,    label: "Commandites inscrites" },
  { to: "/admin/equipes",         Icon: IconUsers,    label: "Équipes" },
  { to: "/admin/users",           Icon: IconUser,     label: "Administrateurs" },
];

export default function AdminLayout() {
  const navigate = useNavigate();

  async function handleLogout() {
    try {
      await fetch(`${API}/auth/logout`, { method: "POST", credentials: "include" });
    } catch {}
    navigate("/admin", { replace: true });
  }

  return (
    <div className="adminSideLayout">

      {/* ── Sidebar ── */}
      <aside className="adminSidebar">
        <div className="adminSidebar__brand">
          <div className="adminSidebar__logo" aria-hidden="true">
            <IconGolfFlag size={24} />
          </div>
          <div>
            <div className="adminSidebar__name">Collège La Cité</div>
            <div className="adminSidebar__sub">Administration</div>
          </div>
        </div>

        <nav className="adminSidebar__nav" aria-label="Navigation admin">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                "adminNavLink" + (isActive ? " active" : "")
              }
            >
              <span className="adminNavLink__icon" aria-hidden="true"><item.Icon size={17} /></span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="adminSidebar__bottom">
          <button
            type="button"
            className="adminNavLink"
            style={{ color: "rgba(255,255,255,.55)", width: "100%" }}
            onClick={() => navigate("/")}
          >
            <span className="adminNavLink__icon" aria-hidden="true">←</span>
            Retour au site
          </button>
          <button
            type="button"
            className="adminNavLink"
            style={{ color: "rgba(182,65,50,.85)", width: "100%" }}
            onClick={handleLogout}
          >
            <span className="adminNavLink__icon" aria-hidden="true">
              <svg xmlns="http://www.w3.org/2000/svg" width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            </span>
            Déconnexion
          </button>
        </div>
      </aside>

      {/* ── Contenu ── */}
      <main className="adminMain">
        <div className="adminMain__inner">
          <Outlet />
        </div>
      </main>

    </div>
  );
}
