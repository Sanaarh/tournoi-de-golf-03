// frontend/src/main.jsx
// Point d’entrée du frontend (Vite + React).
//
// Responsabilités :
// - Monter l’application React dans #root.
// - Activer le routage côté client (BrowserRouter).
// - Charger la feuille de style globale.
//
// Note : React.StrictMode est utile en développement (détecte certains effets
// secondaires). Il peut déclencher des doubles exécutions de useEffect en DEV,
// ce qui est normal et n’arrive pas en production.

import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import App from "./App.jsx";
import "./App.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
