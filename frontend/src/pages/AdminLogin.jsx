/**
 * AdminLogin.jsx
 * Page de connexion administrateur — design plein écran vert forêt.
 *
 * Responsabilités :
 * - Vérifier si une session admin existe déjà (GET /auth/me).
 * - Soumettre les identifiants (POST /auth/login).
 * - Afficher les messages d'erreur.
 */

import { useEffect, useRef, useState } from "react";
import { useNavigate, Link } from "react-router-dom";

const API_BASE_URL = "http://localhost:3000";

async function hasActiveSession() {
  const res = await fetch(`${API_BASE_URL}/auth/me`, { credentials: "include" });
  return res.ok;
}

async function login(payload) {
  const res = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, message: data?.message || "Connexion impossible." };
  return { ok: true };
}

export default function AdminLogin() {
  const navigate  = useNavigate();
  const formRef   = useRef(null);

  const [checking,   setChecking]   = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState("");

  useEffect(() => {
    let isMounted = true;
    async function checkSession() {
      try {
        const ok = await hasActiveSession();
        if (!isMounted) return;
        if (ok) { navigate("/admin/dashboard", { replace: true }); return; }
      } catch {}
      finally { if (isMounted) setChecking(false); }
    }
    checkSession();
    return () => { isMounted = false; };
  }, [navigate]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (submitting) return;
    setError("");
    setSubmitting(true);

    const fd = new FormData(e.currentTarget);
    const nom_utilisateur = String(fd.get("nom_utilisateur") || "").trim();
    const mot_de_passe    = String(fd.get("mot_de_passe")    || "");

    if (!nom_utilisateur || !mot_de_passe) {
      setError("Veuillez saisir un identifiant et un mot de passe.");
      setSubmitting(false);
      return;
    }

    try {
      const result = await login({ nom_utilisateur, mot_de_passe });
      if (!result.ok) {
        setError(result.message || "Connexion impossible.");
        formRef.current?.reset();
        setSubmitting(false);
        return;
      }
      navigate("/admin/dashboard", { replace: true });
    } catch {
      setError("Erreur réseau : backend non accessible.");
      setSubmitting(false);
    }
  }

  if (checking) {
    return (
      <div className="adminPage">
        <div className="adminCard">
          <div className="adminBody">
            <h1 className="adminTitle">Connexion administrateur</h1>
            <p style={{ color: "var(--muted)", fontSize: "14px" }}>Vérification de la session…</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="adminPage">
      <div className="adminCard">
        <div className="adminBody">
          <div style={{ textAlign: "center", marginBottom: "24px" }}>
            <div
              style={{
                width: 56,
                height: 56,
                background: "var(--beige)",
                borderRadius: 12,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 28,
                margin: "0 auto 14px",
              }}
              aria-hidden="true"
            >
              ⛳
            </div>
            <h1 className="adminTitle" style={{ textAlign: "center" }}>
              Connexion Admin
            </h1>
            <p className="adminSubtitle">
              Accès réservé aux administrateurs du tournoi
            </p>
          </div>

          {error && <p className="formError">{error}</p>}

          <form ref={formRef} className="adminForm" onSubmit={handleSubmit}>
            <div className="field">
              <label className="label" htmlFor="nom_utilisateur">
                Identifiant
              </label>
              <input
                id="nom_utilisateur"
                name="nom_utilisateur"
                className="input"
                autoComplete="username"
                placeholder="Votre identifiant"
                required
                disabled={submitting}
              />
            </div>

            <div className="field">
              <label className="label" htmlFor="mot_de_passe">
                Mot de passe
              </label>
              <input
                id="mot_de_passe"
                name="mot_de_passe"
                className="input"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                required
                disabled={submitting}
              />
            </div>

            <button className="btnPrimary" type="submit" disabled={submitting}>
              {submitting ? "Connexion…" : "Se connecter"}
            </button>
          </form>

          <p style={{ textAlign: "center", marginTop: "18px", fontSize: "13px", color: "var(--muted)" }}>
            <Link to="/" style={{ color: "var(--forest)", fontWeight: 600 }}>
              ← Retour au site
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
