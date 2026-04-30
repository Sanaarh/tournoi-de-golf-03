/**
 * App.jsx
 * Définition des routes React Router.
 *
 * 3 layouts distincts :
 *  - Layout       : pages publiques (Navbar + Footer)
 *  - AdminLayout  : pages admin    (sidebar vert forêt)
 *  - standalone   : AdminLogin     (plein écran)
 */

import { Routes, Route } from "react-router-dom";

import Layout      from "./components/Layout.jsx";
import AdminLayout from "./components/AdminLayout.jsx";

// Pages publiques
import Home        from "./pages/Home.jsx";
import Sponsors    from "./pages/Sponsors.jsx";
import Tournoi     from "./pages/Tournoi.jsx";
import TournoiDetail from "./pages/TournoiDetail.jsx";
import InscriptionTournoi from "./pages/InscriptionTournoi.jsx";
import PaiementSucces from "./pages/PaiementSucces.jsx";
import PaiementAnnule from "./pages/PaiementAnnule.jsx";

// Pages admin
import AdminLogin     from "./pages/AdminLogin.jsx";
import AdminDashboard from "./pages/AdminDashboard.jsx";
import AdminUsers     from "./pages/AdminUsers.jsx";
import GestionTournoi         from "./pages/GestionTournoi";
import GestionTypesCommandites from "./pages/GestionTypesCommandites.jsx";
import GestionCommandites      from "./pages/GestionCommandites.jsx";
import AdminEquipes            from "./pages/AdminEquipes.jsx";

export default function App() {
  return (
    <Routes>
      {/* ── Pages publiques (Navbar + Footer) ── */}
      <Route element={<Layout />}>
        <Route path="/"            element={<Home />} />
        <Route path="/tournoi"     element={<Tournoi />} />
        <Route path="/tournoi/:id" element={<TournoiDetail />} />
        <Route path="/inscription"     element={<InscriptionTournoi />} />
        <Route path="/inscription/:tournoiId" element={<InscriptionTournoi />} />
        <Route path="/sponsors"    element={<Sponsors />} />
        <Route path="/paiement/succes" element={<PaiementSucces />} />
        <Route path="/paiement/annule" element={<PaiementAnnule />} />
      </Route>

      {/* ── Admin login (plein écran standalone) ── */}
      <Route path="/admin" element={<AdminLogin />} />

      {/* ── Pages admin (sidebar vert forêt) ── */}
      <Route element={<AdminLayout />}>
        <Route path="/admin/dashboard" element={<AdminDashboard />} />
        <Route path="/admin/users"     element={<AdminUsers />} />
        <Route path="/admin/equipes"   element={<AdminEquipes />} />
        <Route path="/admin/tournois"  element={<GestionTournoi />} />
        <Route path="/admin/types-commandites" element={<GestionTypesCommandites />} />
        <Route path="/admin/commandites" element={<GestionCommandites />} />
      </Route>
    </Routes>
  );
}
