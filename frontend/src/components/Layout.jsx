/**
 * Layout.jsx
 * Gabarit pour les pages publiques : Navbar + contenu + Footer.
 * Chaque page contrôle son propre hero/header.
 */

import { Outlet } from "react-router-dom";
import Navbar from "./Navbar.jsx";
import Footer from "./Footer.jsx";

export default function Layout() {
  return (
    <>
      <Navbar />
      <Outlet />
      <Footer />
    </>
  );
}
