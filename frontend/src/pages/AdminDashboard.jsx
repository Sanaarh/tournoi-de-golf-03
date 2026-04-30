/**
 * pages/AdminDashboard.jsx
 * --------------------------------------------------------------------
 * Tableau de bord administrateur.
 *
 * Responsabilités :
 * - Vérifier la session via GET /auth/me ; rediriger vers /admin si invalide.
 * - Charger les KPI via GET /admin/dashboard/stats (totaux globaux en base).
 * - Charger le nombre d’administrateurs via GET /admin/users.
 * - Afficher les cartes d’accès rapide vers tournois, équipes, types/commandites, admins.
 *
 * Réseau :
 * - Tous les appels authentifiés utilisent credentials: "include" (cookie session).
 */

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { IconGolfFlag, IconUsers, IconNetwork, IconUser, IconCalendar, IconMedal } from "../components/Icons.jsx";

const API = "http://localhost:3000";

export default function AdminDashboard() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [admin,   setAdmin]   = useState(null);
  const [error,   setError]   = useState("");
  const [counts,  setCounts]  = useState({
    tournois: null,
    equipes: null,
    participants: null,
    commandites: null,
    admins: null,
  });

  useEffect(() => {
    let mounted = true;
    async function loadMe() {
      try {
        const res  = await fetch(`${API}/auth/me`, { credentials: "include" });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          if (!mounted) return;
          navigate("/admin", { replace: true });
          return;
        }
        if (!mounted) return;
        setAdmin(data?.admin || null);
        try {
          const [statsRes, adminsRes] = await Promise.all([
            fetch(`${API}/admin/dashboard/stats`, { credentials: "include" }),
            fetch(`${API}/admin/users`, { credentials: "include" }),
          ]);

          const statsData = await statsRes.json().catch(() => ({}));
          const adminsData = await adminsRes.json().catch(() => []);

          setCounts((prev) => ({
            ...prev,
            tournois: Number.isInteger(statsData?.tournois) ? statsData.tournois : 0,
            equipes: Number.isInteger(statsData?.equipes) ? statsData.equipes : 0,
            participants: Number.isInteger(statsData?.joueurs) ? statsData.joueurs : 0,
            commandites: Number.isInteger(statsData?.commandites) ? statsData.commandites : 0,
            admins: Array.isArray(adminsData) ? adminsData.length : 0,
          }));
        } catch {
          // En cas d'erreur réseau, on laisse les compteurs à null
        }
      } catch {
        if (!mounted) return;
        setError("Backend non accessible.");
        navigate("/admin", { replace: true });
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    }
    loadMe();
    return () => { mounted = false; };
  }, [navigate]);

  const cards = [
    {
      title: "Gestion des tournois",
      desc: "Créer, modifier ou supprimer les tournois (capacité, équipes, inscriptions…).",
      Icon: IconCalendar,
      onClick: () => navigate("/admin/tournois"),
    },
    {
      title: "Gestion des équipes",
      desc: "Voir les équipes inscrites et corriger leur nom en cas d'erreur.",
      Icon: IconUsers,
      onClick: () => navigate("/admin/equipes"),
    },
    {
      title: "Types de commandites",
      desc: "Définir et gérer les paliers de commandite (prix, quantités, avantages) par tournoi.",
      Icon: IconNetwork,
      onClick: () => navigate("/admin/types-commandites"),
    },
    {
      title: "Commandites inscrites",
      desc: "Consulter les demandes, modifier les fiches, statut de paiement et supprimer si besoin.",
      Icon: IconMedal,
      onClick: () => navigate("/admin/commandites"),
    },
    {
      title: "Comptes administrateurs",
      desc: "Ajouter, modifier ou supprimer les comptes d'administration du site.",
      Icon: IconUser,
      onClick: () => navigate("/admin/users"),
    },
  ];

  const kpi = useMemo(
    () => [
      { Icon: IconGolfFlag, val: counts.tournois ?? "—", label: "Tournois" },
      { Icon: IconUsers,    val: counts.equipes ?? "—", label: "Equipes" },
      { Icon: IconUsers,    val: counts.participants ?? "—", label: "Participants" },
      { Icon: IconNetwork,  val: counts.commandites ?? "—", label: "Commandites" },
      { Icon: IconUser,     val: counts.admins ?? "—", label: "Administrateurs" },
    ],
    [counts]
  );

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "50vh" }}>
        <p style={{ color: "var(--muted)" }}>Chargement…</p>
      </div>
    );
  }

  if (!admin) {
    return (
      <div>
        <div className="adminDashAlert">{error || "Non connecté"}</div>
        <div className="adminDashActions">
          <button className="btnPrimary" type="button"
            onClick={() => navigate("/admin")} style={{ width: "auto", padding: "10px 22px" }}>
            Aller à la connexion
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* En-tête */}
      <div className="adminDashTop">
        <div className="adminDashIdentity">
          <h1 className="adminDashH1">Tableau de bord</h1>
          <p className="adminDashSub">
            Connecté en tant que{" "}
            <span className="adminDashUser">{admin.nom_utilisateur}</span>
          </p>
        </div>
      </div>

      {/* KPI */}
      <div className="kpiGrid">
        {kpi.map((k) => (
          <div key={k.label} className="kpiCard">
            <div className="kpiCard__icon" aria-hidden="true"><k.Icon size={26} /></div>
            <div className="kpiCard__val">{k.val}</div>
            <div className="kpiCard__label">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Navigation rapide */}
      <h2 style={{ color: "var(--forest)", marginBottom: 16 }}>Actions rapides</h2>
      <div className="adminDashGrid">
        {cards.map((c) => (
          <button key={c.title} type="button" className="adminDashCard" onClick={c.onClick}>
            <div className="adminDashCardHead">
              <span aria-hidden="true"><c.Icon size={28} /></span>
              <span className="adminDashChevron" aria-hidden="true">›</span>
            </div>
            <h3 className="adminDashCardTitle">{c.title}</h3>
            <p className="adminDashCardDesc">{c.desc}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
