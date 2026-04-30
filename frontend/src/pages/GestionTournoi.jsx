/**
 * GestionTournoi.jsx
 * Page d'administration : gestion CRUD des tournois via 4 onglets :
 * - Création      : POST   /admin/tournois
 * - Modification  : GET    /admin/tournois + PUT    /admin/tournois/:id
 * - Affichage     : GET    /admin/tournois
 * - Suppression   : GET    /admin/tournois + DELETE /admin/tournois/:id
 *
 * Pré-requis backend :
 * - Routes montées sous /admin/tournois (server.js)
 * - Cookies httpOnly + middleware requireAdmin
 *
 * Contraintes :
 * - capacite_joueurs multiple de 4
 * - nombre_equipes_max <= capacite_joueurs / 4
 * - inscription_debut obligatoire
 * - inscription_fin obligatoire
 * - inscription_debut <= inscription_fin
 * - date_tournoi ne doit pas être avant la période d'inscription
 * - Quota commandites (limite_commandites) <= capacite_joueurs
 *
 * UX :
 * - Onglets type AdminUsers (btnPrimary actif + btnGhost)
 * - Messages (succès/erreur/info) fermables
 * - Bouton retour dashboard + rafraîchir
 */

import { useEffect, useMemo, useState } from "react";

const API_BASE_URL = "http://localhost:3000";

const TAB = {
  CREATE: "CREATE",
  EDIT: "EDIT",
  LIST: "LIST",
  DELETE: "DELETE",
};

// -------- utils validation --------

function toInt(value) {
  if (value === "" || value === null || value === undefined) return 0;
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.trunc(n);
}

function toNumber(value) {
  if (value === "" || value === null || value === undefined) return 0;
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

function safeTrim(v) {
  return String(v || "").trim();
}

/**
 * Compare deux dates "YYYY-MM-DD".
 * Retourne :
 *  -1 si a < b
 *   0 si a == b
 *   1 si a > b
 */
function cmpDate(a, b) {
  if (!a || !b) return 0;
  const da = new Date(a + "T00:00:00");
  const db = new Date(b + "T00:00:00");
  if (da < db) return -1;
  if (da > db) return 1;
  return 0;
}

/**
 * Validation métier côté UI (confort utilisateur).
 * Le serveur doit aussi valider.
 */
function validateTournoi(form) {
  const errors = [];

  const nom = safeTrim(form.nom);
  if (!nom) errors.push("Le nom du tournoi est obligatoire.");

  const dateTournoi = form.date_tournoi;
  if (!dateTournoi) errors.push("La date du tournoi est obligatoire.");

  const capacite = toInt(form.capacite_joueurs);
  const equipes = toInt(form.nombre_equipes_max);
  const quotaCmd = toInt(form.limite_commandites);
  const prixJoueur = toNumber(form.prix_joueur);

  if (capacite < 0) errors.push("La capacité de joueurs doit être ≥ 0.");
  if (capacite % 4 !== 0) errors.push("La capacité de joueurs doit être un multiple de 4.");

  if (equipes < 0) errors.push("Le nombre d'équipes maximum doit être ≥ 0.");
  if (equipes > 0 && capacite > 0) {
    const maxEquipesPossible = Math.floor(capacite / 4);
    if (equipes > maxEquipesPossible) {
      errors.push(
        `Le nombre d'équipes maximum ne peut pas dépasser ${maxEquipesPossible} (capacité/4).`
      );
    }
  }

  if (quotaCmd < 0) errors.push("Quota commandites doit être ≥ 0.");
  if (quotaCmd > 0 && capacite > 0 && quotaCmd > capacite) {
    errors.push("Quota commandites doit être inférieur ou égal au nombre total de joueurs.");
  }

  if (prixJoueur < 0) {
    errors.push("Le prix du joueur doit être supérieur ou égal à 0.");
  }

  const debut = form.inscription_debut || "";
  const fin = form.inscription_fin || "";

  if (!debut) {
    errors.push("La date de début des inscriptions est obligatoire.");
  }

  if (!fin) {
    errors.push("La date de fin des inscriptions est obligatoire.");
  }

  if (debut && fin && cmpDate(debut, fin) === 1) {
    errors.push("La date de fin d'inscription ne peut pas être avant la date de début.");
  }

  if (dateTournoi) {
    if (debut && cmpDate(dateTournoi, debut) === -1) {
      errors.push("La date du tournoi ne peut pas être avant le début des inscriptions.");
    }
    if (fin && cmpDate(dateTournoi, fin) === -1) {
      errors.push("La date du tournoi ne peut pas être avant la fin des inscriptions.");
    }
  }

  return errors;
}

function isOpenTournoiFlag(value) {
  const normalized = String(value ?? "").trim().toLowerCase();
  return value === true || value === 1 || normalized === "1" || normalized === "true";
}

// -------- component --------

export default function GestionTournoi() {
  const [activeTab, setActiveTab] = useState(TAB.CREATE);

  const [busy, setBusy] = useState(false);
  const [loadingTournois, setLoadingTournois] = useState(false);
  const [tournois, setTournois] = useState([]);

  /**
   * Message UI :
   * type: success | error | info
   */
  const [message, setMessage] = useState(null);
  const [toast, setToast] = useState(null);

  function clearMessage() {
    setMessage(null);
  }

  function clearToast() {
    setToast(null);
  }

  function showMessage(type, title, text) {
    const nextMessage = { type, title, text };
    setMessage(nextMessage);
    setToast(nextMessage);
  }

  useEffect(() => {
    if (!toast) return undefined;
    const timeoutId = window.setTimeout(() => {
      setToast(null);
    }, 4500);
    return () => window.clearTimeout(timeoutId);
  }, [toast]);

  // --- Form Création ---
  const [createForm, setCreateForm] = useState({
    nom: "",
    lieu: "",
    date_tournoi: "",
    inscription_debut: "",
    inscription_fin: "",
    inscriptions_ouvertes: false,
    capacite_joueurs: "",
    nombre_equipes_max: "",
    limite_commandites: "",
    prix_joueur: "",
  });

  // --- Form Modification ---
  const [selectedId, setSelectedId] = useState("");
  const selectedTournoi = useMemo(() => {
    const id = Number(selectedId);
    return tournois.find((t) => t.id === id) || null;
  }, [tournois, selectedId]);

  const [editForm, setEditForm] = useState({
    nom: "",
    lieu: "",
    date_tournoi: "",
    inscription_debut: "",
    inscription_fin: "",
    inscriptions_ouvertes: false,
    capacite_joueurs: "",
    nombre_equipes_max: "",
    limite_commandites: "",
    prix_joueur: "",
  });

  // --- Suppression ---
  const [deleteId, setDeleteId] = useState("");
  const deleteTournoi = useMemo(() => {
    const id = Number(deleteId);
    return tournois.find((t) => t.id === id) || null;
  }, [tournois, deleteId]);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

  function buildEditFormFromTournoi(tournoi) {
    if (!tournoi) {
      return {
        nom: "",
        lieu: "",
        date_tournoi: "",
        inscription_debut: "",
        inscription_fin: "",
        inscriptions_ouvertes: false,
        capacite_joueurs: "",
        nombre_equipes_max: "",
        limite_commandites: "",
        prix_joueur: "",
      };
    }

    return {
      nom: tournoi.nom ?? "",
      lieu: tournoi.lieu ?? "",
      date_tournoi: (tournoi.date_tournoi ?? "").slice(0, 10),
      inscription_debut: (tournoi.inscription_debut ?? "").slice(0, 10),
      inscription_fin: (tournoi.inscription_fin ?? "").slice(0, 10),
      inscriptions_ouvertes: Boolean(tournoi.inscriptions_ouvertes),
      capacite_joueurs: String(tournoi.capacite_joueurs ?? ""),
      nombre_equipes_max: String(tournoi.nombre_equipes_max ?? ""),
      limite_commandites: String(tournoi.limite_commandites ?? ""),
      prix_joueur: String(tournoi.prix_joueur ?? ""),
    };
  }

  function resetEditFormToCurrentTournoi() {
    setEditForm(buildEditFormFromTournoi(selectedTournoi));
  }

  // -------- API helpers --------

  async function loadTournois() {
    setLoadingTournois(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/tournois`, {
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setTournois([]);
        showMessage("error", "Chargement impossible", data?.message || "Accès refusé.");
        return;
      }

      setTournois(Array.isArray(data) ? data : []);
      if (Array.isArray(data) && data.length === 0) {
        showMessage("info", "Aucun tournoi", "Aucun tournoi n'est disponible pour le moment.");
      }
    } catch (e) {
      setTournois([]);
      showMessage("error", "Erreur réseau", "Backend non accessible.");
    } finally {
      setLoadingTournois(false);
    }
  }

  useEffect(() => {
    clearMessage();

    if (activeTab === TAB.CREATE) {
      return;
    }

    loadTournois();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  useEffect(() => {
    setEditForm(buildEditFormFromTournoi(selectedTournoi));
  }, [selectedTournoi]);

  function updateCreateCapacite(rawValue) {
    const cap = toInt(rawValue);
    const equipes = cap > 0 ? Math.floor(cap / 4) : 0;
    setCreateForm((p) => ({
      ...p,
      capacite_joueurs: rawValue,
      nombre_equipes_max: rawValue === "" ? "" : String(equipes),
    }));
  }

  function updateCreateEquipes(rawValue) {
    const equipes = toInt(rawValue);
    const cap = equipes > 0 ? equipes * 4 : 0;
    setCreateForm((p) => ({
      ...p,
      nombre_equipes_max: rawValue,
      capacite_joueurs: rawValue === "" ? "" : String(cap),
    }));
  }

  function updateEditCapacite(rawValue) {
    const cap = toInt(rawValue);
    const equipes = cap > 0 ? Math.floor(cap / 4) : 0;
    setEditForm((p) => ({
      ...p,
      capacite_joueurs: rawValue,
      nombre_equipes_max: rawValue === "" ? "" : String(equipes),
    }));
  }

  function updateEditEquipes(rawValue) {
    const equipes = toInt(rawValue);
    const cap = equipes > 0 ? equipes * 4 : 0;
    setEditForm((p) => ({
      ...p,
      nombre_equipes_max: rawValue,
      capacite_joueurs: rawValue === "" ? "" : String(cap),
    }));
  }

  // -------- submit handlers --------

  async function handleCreate(e) {
    e.preventDefault();
    clearMessage();

    const payload = {
      nom: safeTrim(createForm.nom),
      lieu: safeTrim(createForm.lieu) || null,
      date_tournoi: createForm.date_tournoi,

      inscription_debut: createForm.inscription_debut || null,
      inscription_fin: createForm.inscription_fin || null,
      inscriptions_ouvertes: Boolean(createForm.inscriptions_ouvertes),

      capacite_joueurs: toInt(createForm.capacite_joueurs),
      nombre_equipes_max: toInt(createForm.nombre_equipes_max),
      limite_commandites: toInt(createForm.limite_commandites),
      prix_joueur: toNumber(createForm.prix_joueur),
    };

    const errs = validateTournoi(payload);
    if (errs.length) {
      showMessage("error", "Validation", errs[0]);
      return;
    }

    if (payload.inscriptions_ouvertes) {
      const alreadyOpen = tournois.find((t) => isOpenTournoiFlag(t?.inscriptions_ouvertes));
      if (alreadyOpen) {
        showMessage(
          "error",
          "Ouverture refusée",
          `Impossible d'ouvrir ce tournoi: "${alreadyOpen.nom}" (#${alreadyOpen.id}) est deja ouvert. Fermez-le d'abord.`
        );
        return;
      }
    }

    setBusy(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/tournois`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
  const base = data?.message || "Erreur serveur";
  const details =
    data && data.errors && typeof data.errors === "object"
      ? Object.values(data.errors).filter(Boolean).join(" ")
      : "";

  const texteComplet = `${base} ${details}`.toLowerCase();

  const conflitTournoiOuvert =
    payload.inscriptions_ouvertes &&
    (
      texteComplet.includes("deja ouvert") ||
      texteComplet.includes("déjà ouvert") ||
      texteComplet.includes("tournoi actif") ||
      texteComplet.includes("tournoi ouvert") ||
      texteComplet.includes("inscriptions_ouvertes") ||
      texteComplet.includes("un seul tournoi") ||
      texteComplet.includes("already open") ||
      texteComplet.includes("already active")
    );

  if (conflitTournoiOuvert) {
    showMessage(
      "error",
      "Création refusée",
      "Impossible de créer un deuxième tournoi actif. Un seul tournoi peut avoir les inscriptions ouvertes à la fois. Fermez d'abord le tournoi actuellement actif ou créez ce nouveau tournoi avec « Inscriptions ouvertes = Non »."
    );
    return;
  }

  const fullMessage = details ? `${base} ${details}` : base;
  showMessage("error", "Création refusée", fullMessage);
  return;
}

      showMessage("success", "Création OK", `Tournoi "${data.nom}" créé (#${data.id}).`);

      setCreateForm({
        nom: "",
        lieu: "",
        date_tournoi: "",
        inscription_debut: "",
        inscription_fin: "",
        inscriptions_ouvertes: false,
        capacite_joueurs: "",
        nombre_equipes_max: "",
        limite_commandites: "",
        prix_joueur: "",
      });

      await loadTournois();
    } catch {
      showMessage("error", "Erreur réseau", "Backend non accessible.");
    } finally {
      setBusy(false);
    }
  }

  async function handleUpdate(e) {
    e.preventDefault();
    clearMessage();

    if (!selectedTournoi) {
      showMessage("error", "Sélection requise", "Veuillez sélectionner un tournoi.");
      return;
    }

    const payload = {
      nom: safeTrim(editForm.nom),
      lieu: safeTrim(editForm.lieu) || null,
      date_tournoi: editForm.date_tournoi,

      inscription_debut: editForm.inscription_debut || null,
      inscription_fin: editForm.inscription_fin || null,
      inscriptions_ouvertes: Boolean(editForm.inscriptions_ouvertes),

      capacite_joueurs: toInt(editForm.capacite_joueurs),
      nombre_equipes_max: toInt(editForm.nombre_equipes_max),
      limite_commandites: toInt(editForm.limite_commandites),
      prix_joueur: toNumber(editForm.prix_joueur),
    };

    const errs = validateTournoi(payload);
    if (errs.length) {
      showMessage("error", "Validation", errs[0]);
      resetEditFormToCurrentTournoi();
      return;
    }

    if (payload.inscriptions_ouvertes) {
      const anotherOpen = tournois.find(
        (t) =>
          Number(t?.id) !== Number(selectedTournoi.id) &&
          isOpenTournoiFlag(t?.inscriptions_ouvertes)
      );
      if (anotherOpen) {
        showMessage(
          "error",
          "Ouverture refusée",
          `Impossible d'ouvrir ce tournoi: "${anotherOpen.nom}" (#${anotherOpen.id}) est deja ouvert. Fermez-le d'abord.`
        );
        resetEditFormToCurrentTournoi();
        return;
      }
    }

    setBusy(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/tournois/${selectedTournoi.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const base = data?.message || "Erreur serveur";
        const details =
          data && data.errors && typeof data.errors === "object"
            ? Object.values(data.errors).filter(Boolean).join(" ")
            : "";
        const fullMessage = details ? `${base} ${details}` : base;

        showMessage("error", "Modification refusée", fullMessage);
        resetEditFormToCurrentTournoi();
        return;
      }

      showMessage("success", "Modification OK", `Tournoi "${data.nom}" mis à jour.`);
      await loadTournois();
    } catch {
      showMessage("error", "Erreur réseau", "Backend non accessible.");
      resetEditFormToCurrentTournoi();
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    clearMessage();

    if (!deleteTournoi) {
      showMessage("error", "Sélection requise", "Veuillez sélectionner un tournoi à supprimer.");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/tournois/${deleteTournoi.id}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        showMessage("error", "Suppression refusée", data?.message || "Erreur serveur");
        return;
      }

      showMessage("success", "Suppression OK", `Tournoi "${deleteTournoi.nom}" supprimé.`);
      setDeleteId("");
      setIsDeleteConfirmOpen(false);
      await loadTournois();
    } catch {
      showMessage("error", "Erreur réseau", "Backend non accessible.");
    } finally {
      setBusy(false);
    }
  }

  const hasTournois = tournois.length > 0;

  return (
    <div>
      <div className="pageHeader">
        <div className="adminUsersHeaderLeft">
          <h1 className="adminUsersTitle">Gestion des tournois</h1>
          <p className="adminUsersSubtitle">
            Création, affichage, modification et suppression des tournois.
          </p>
        </div>
      </div>

      <div className="adminTabs">
        <button
          type="button"
          className={`adminTab ${activeTab === TAB.CREATE ? "adminTab--active" : ""}`}
          onClick={() => setActiveTab(TAB.CREATE)}
          disabled={busy}
          aria-pressed={activeTab === TAB.CREATE}
        >
          Création
        </button>

        <button
          type="button"
          className={`adminTab ${activeTab === TAB.EDIT ? "adminTab--active" : ""}`}
          onClick={() => setActiveTab(TAB.EDIT)}
          disabled={busy}
          aria-pressed={activeTab === TAB.EDIT}
        >
          Modification
        </button>

        <button
          type="button"
          className={`adminTab ${activeTab === TAB.LIST ? "adminTab--active" : ""}`}
          onClick={() => setActiveTab(TAB.LIST)}
          disabled={busy}
          aria-pressed={activeTab === TAB.LIST}
        >
          Affichage
        </button>

        <button
          type="button"
          className={`adminTab ${activeTab === TAB.DELETE ? "adminTab--active" : ""}`}
          onClick={() => setActiveTab(TAB.DELETE)}
          disabled={busy}
          aria-pressed={activeTab === TAB.DELETE}
        >
          Suppression
        </button>

        <div className="adminTabsSpacer" />
        <button
          type="button"
          className="btnGhost"
          onClick={loadTournois}
          disabled={busy || loadingTournois}
          title="Recharger"
        >
          Rafraîchir
        </button>
      </div>

      {message && (
        <div className={`alertBox alertBox--${message.type}`}>
          <div className="alertBoxBody">
            <div className="alertBoxTitle">{message.title}</div>
            <div className="alertBoxText">{message.text}</div>
          </div>

          <button
            type="button"
            className="btnGhost alertBoxClose"
            onClick={clearMessage}
            disabled={busy}
          >
            Fermer
          </button>
        </div>
      )}

      {activeTab === TAB.CREATE && (
        <div className="panel">
          <h2 style={{ marginBottom: 18 }}>Informations générales</h2>

          <form className="adminForm" onSubmit={handleCreate} autoComplete="off">
            <div className="field">
              <label className="label">Nom du tournoi</label>
              <input
                className="input"
                value={createForm.nom}
                onChange={(e) => setCreateForm((p) => ({ ...p, nom: e.target.value }))}
                disabled={busy}
                placeholder="Ex: Tournoi annuel 2026"
              />
            </div>

            <div className="field">
              <label className="label">Lieu (optionnel)</label>
              <input
                className="input"
                value={createForm.lieu}
                onChange={(e) => setCreateForm((p) => ({ ...p, lieu: e.target.value }))}
                disabled={busy}
                placeholder="Ex: À confirmer"
              />
            </div>

            <div className="field">
              <label className="label">Date du tournoi</label>
              <input
                className="input"
                type="date"
                value={createForm.date_tournoi}
                onChange={(e) => setCreateForm((p) => ({ ...p, date_tournoi: e.target.value }))}
                disabled={busy}
              />
            </div>

            <div className="field">
              <label className="label">Prix du joueur ($)</label>
              <input
                className="input"
                type="number"
                value={createForm.prix_joueur}
                onChange={(e) => setCreateForm((p) => ({ ...p, prix_joueur: e.target.value }))}
                onWheel={(e) => e.target.blur()}
                disabled={busy}
                placeholder="Ex: 250"
                min="0"
                step="0.01"
              />
              <div className="hintText">
                Montant demandé pour l'inscription d'un joueur.
              </div>
            </div>

            <h2>Capacités / équipes</h2>

            <div className="field">
              <label className="label">Capacité de joueurs (multiple de 4)</label>
              <input
                className="input"
                type="number"
                value={createForm.capacite_joueurs}
                onChange={(e) => updateCreateCapacite(e.target.value)}
                disabled={busy}
                placeholder="Ex: 72"
                min="0"
                step="1"
              />
              <div className="hintText">
                Règle : 4 joueurs par équipe → capacité recommandée en multiple de 4.
              </div>
            </div>

            <div className="field">
              <label className="label">Nombre d'équipes maximum</label>
              <input
                className="input"
                type="number"
                value={createForm.nombre_equipes_max}
                onChange={(e) => updateCreateEquipes(e.target.value)}
                disabled={busy}
                placeholder="Ex: 18"
                min="0"
                step="1"
              />
              <div className="hintText">
                Synchronisation automatique : ce champ met a jour la capacite (x4), et inversement.
              </div>
            </div>

            <h2>Inscriptions</h2>

            <div className="field">
              <label className="label">Période d'inscription *</label>
              <input
                className="input"
                type="date"
                value={createForm.inscription_debut}
                onChange={(e) =>
                  setCreateForm((p) => ({ ...p, inscription_debut: e.target.value }))
                }
                disabled={busy}
              />
              <input
                className="input"
                type="date"
                value={createForm.inscription_fin}
                onChange={(e) => setCreateForm((p) => ({ ...p, inscription_fin: e.target.value }))}
                disabled={busy}
              />
              <div className="hintText">
                Les deux dates sont obligatoires. La date de début doit être antérieure ou égale à
                la date de fin.
              </div>
            </div>

            <div className="field">
              <label className="label">Inscriptions ouvertes</label>
              <select
                className="input"
                value={createForm.inscriptions_ouvertes ? "1" : "0"}
                onChange={(e) =>
                  setCreateForm((p) => ({ ...p, inscriptions_ouvertes: e.target.value === "1" }))
                }
                disabled={busy}
              >
                <option value="0">Non</option>
                <option value="1">Oui</option>
              </select>
              <div className="hintText">
                Sert à activer/désactiver l’ouverture des inscriptions côté site, indépendamment des dates.
              </div>
            </div>

            <h2>Commandites</h2>

            <div className="field">
              <label className="label">Quota commandites</label>
              <input
                className="input"
                type="number"
                value={createForm.limite_commandites}
                onChange={(e) =>
                  setCreateForm((p) => ({ ...p, limite_commandites: e.target.value }))
                }
                disabled={busy}
                placeholder="0"
                min="0"
                step="1"
              />
              <div className="hintText">
                0 = tournoi réservé au personnel et aux retraités. Sinon, indique le nombre de places réservées aux commandites (doit être inférieur au nombre total de joueurs).
              </div>
            </div>

            <button className="btnPrimary" type="submit" disabled={busy}>
              Valider / Préparer l'enregistrement
            </button>
          </form>
        </div>
      )}

      {activeTab === TAB.EDIT && (
        <>
          <div className="panel">
            <h2>Modifier un tournoi</h2>

            {loadingTournois ? (
              <p>Chargement...</p>
            ) : !hasTournois ? (
              <p style={{ color: "var(--muted)" }}>Aucun tournoi disponible.</p>
            ) : (
              <div className="field">
                <label className="label">Sélectionner un tournoi</label>
                <select
                  className="input"
                  value={selectedId}
                  onChange={(e) => setSelectedId(e.target.value)}
                  disabled={busy}
                >
                  <option value="">-- Choisir --</option>
                  {tournois.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nom} (#{t.id})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="panel">
            <h2>Détails</h2>

            {!selectedTournoi ? (
              <p style={{ color: "var(--muted)" }}>
                Sélectionnez un tournoi pour pré-remplir le formulaire.
              </p>
            ) : (
              <form className="adminForm" onSubmit={handleUpdate} autoComplete="off">
                <div className="field">
                  <label className="label">Nom du tournoi</label>
                  <input
                    className="input"
                    value={editForm.nom}
                    onChange={(e) => setEditForm((p) => ({ ...p, nom: e.target.value }))}
                    disabled={busy}
                  />
                </div>

                <div className="field">
                  <label className="label">Lieu (optionnel)</label>
                  <input
                    className="input"
                    value={editForm.lieu}
                    onChange={(e) => setEditForm((p) => ({ ...p, lieu: e.target.value }))}
                    disabled={busy}
                  />
                </div>

                <div className="field">
                  <label className="label">Date du tournoi</label>
                  <input
                    className="input"
                    type="date"
                    value={editForm.date_tournoi}
                    onChange={(e) => setEditForm((p) => ({ ...p, date_tournoi: e.target.value }))}
                    disabled={busy}
                  />
                </div>

                <div className="field">
                  <label className="label">Prix du joueur ($)</label>
                  <input
                    className="input"
                    type="number"
                    value={editForm.prix_joueur}
                    onChange={(e) => setEditForm((p) => ({ ...p, prix_joueur: e.target.value }))}
                    disabled={busy}
                    min="0"
                    step="0.01"
                  />
                </div>

                <h2>Capacités / équipes</h2>

                <div className="field">
                  <label className="label">Capacité de joueurs (multiple de 4)</label>
                  <input
                    className="input"
                    type="number"
                    value={editForm.capacite_joueurs}
                    onChange={(e) => updateEditCapacite(e.target.value)}
                    disabled={busy}
                    min="0"
                    step="1"
                  />
                </div>

                <div className="field">
                  <label className="label">Nombre d'équipes maximum</label>
                  <input
                    className="input"
                    type="number"
                    value={editForm.nombre_equipes_max}
                    onChange={(e) => updateEditEquipes(e.target.value)}
                    disabled={busy}
                    min="0"
                    step="1"
                  />
                </div>

                <h2>Inscriptions</h2>

                <div className="field">
                  <label className="label">Période d'inscription *</label>
                  <input
                    className="input"
                    type="date"
                    value={editForm.inscription_debut}
                    onChange={(e) =>
                      setEditForm((p) => ({ ...p, inscription_debut: e.target.value }))
                    }
                    disabled={busy}
                  />
                  <input
                    className="input"
                    type="date"
                    value={editForm.inscription_fin}
                    onChange={(e) => setEditForm((p) => ({ ...p, inscription_fin: e.target.value }))}
                    disabled={busy}
                  />
                  <div className="hintText">
                    Les deux dates sont obligatoires. La date de début doit être antérieure ou égale
                    à la date de fin.
                  </div>
                </div>

                <div className="field">
                  <label className="label">Inscriptions ouvertes</label>
                  <select
                    className="input"
                    value={editForm.inscriptions_ouvertes ? "1" : "0"}
                    onChange={(e) =>
                      setEditForm((p) => ({ ...p, inscriptions_ouvertes: e.target.value === "1" }))
                    }
                    disabled={busy}
                  >
                    <option value="0">Non</option>
                    <option value="1">Oui</option>
                  </select>
                </div>

                <h2>Commandites</h2>

                <div className="field">
                  <label className="label">Quota commandites</label>
                  <input
                    className="input"
                    type="number"
                    value={editForm.limite_commandites}
                    onChange={(e) =>
                      setEditForm((p) => ({ ...p, limite_commandites: e.target.value }))
                    }
                    disabled={busy}
                    min="0"
                    step="1"
                  />
                </div>

                <button className="btnPrimary" type="submit" disabled={busy}>
                  Enregistrer les modifications
                </button>
              </form>
            )}
          </div>
        </>
      )}

      {activeTab === TAB.LIST && (
        <div className="panel">
          <h2>Liste des tournois</h2>

          {loadingTournois ? (
            <p>Chargement...</p>
          ) : !hasTournois ? (
            <p style={{ color: "var(--muted)" }}>Aucun tournoi disponible.</p>
          ) : (
            <div className="tableWrap">
              <table className="dataTable">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Nom</th>
                    <th>Lieu</th>
                    <th>Date tournoi</th>
                    <th>Prix joueur</th>
                    <th>Capacité</th>
                    <th>Équipes max</th>
                    <th>Inscriptions</th>
                    <th>Quota commandites</th>
                  </tr>
                </thead>
                <tbody>
                  {tournois.map((t) => (
                    <tr key={t.id}>
                      <td>{t.id}</td>
                      <td>{t.nom}</td>
                      <td className="mutedCell">{t.lieu || "-"}</td>
                      <td>{String(t.date_tournoi || "").slice(0, 10)}</td>
                      <td>
                        {Number(t.prix_joueur || 0).toLocaleString("fr-CA", {
                          style: "currency",
                          currency: "CAD",
                        })}
                      </td>
                      <td>{t.capacite_joueurs}</td>
                      <td>{t.nombre_equipes_max}</td>
                      <td className="mutedCell">
                        {t.inscriptions_ouvertes ? "Ouvertes" : "Fermées"} <br />
                        <small>
                          {t.inscription_debut ? String(t.inscription_debut).slice(0, 10) : "—"} →{" "}
                          {t.inscription_fin ? String(t.inscription_fin).slice(0, 10) : "—"}
                        </small>
                      </td>
                      <td>{t.limite_commandites}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === TAB.DELETE && (
        <div className="panel">
          <h2>Supprimer un tournoi</h2>
          <p style={{ color: "var(--muted)", marginBottom: 16 }}>
            La suppression est définitive (participants/équipes liés peuvent être supprimés).
          </p>

          {loadingTournois ? (
            <p>Chargement...</p>
          ) : !hasTournois ? (
            <p style={{ color: "var(--muted)" }}>Aucun tournoi disponible.</p>
          ) : (
            <>
              <div className="field">
                <label className="label">Sélectionner un tournoi</label>
                <select
                  className="input"
                  value={deleteId}
                  onChange={(e) => setDeleteId(e.target.value)}
                  disabled={busy}
                >
                  <option value="">-- Choisir --</option>
                  {tournois.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nom} (#{t.id})
                    </option>
                  ))}
                </select>
              </div>

              <div className="deleteRow">
                <div className="deleteInfo">
                  {deleteTournoi ? (
                    <>
                      <div className="deleteName">{deleteTournoi.nom}</div>
                      <div style={{ color: "var(--muted)", fontSize: 13 }}>
                        Date tournoi : {String(deleteTournoi.date_tournoi || "").slice(0, 10)} — Capacité :{" "}
                        {deleteTournoi.capacite_joueurs}
                      </div>
                    </>
                  ) : (
                    <div style={{ color: "var(--muted)" }}>Sélectionnez un tournoi à supprimer.</div>
                  )}
                </div>

                <button
                  type="button"
                  className="btnDanger"
                  onClick={() => setIsDeleteConfirmOpen(true)}
                  disabled={busy || !deleteTournoi}
                >
                  Supprimer
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {isDeleteConfirmOpen && deleteTournoi && (
        <div className="modalBackdrop">
          <div className="modal">
            <div className="modalHead">
              <div className="modalTitle">Confirmer la suppression</div>
              <button
                type="button"
                className="modalClose"
                onClick={() => setIsDeleteConfirmOpen(false)}
                disabled={busy}
                aria-label="Fermer la confirmation"
              >
                ×
              </button>
            </div>

            <p className="modalSub">
              Vous allez supprimer le tournoi <strong>{deleteTournoi.nom}</strong>. Cette action est
              irreversible.
            </p>

            <div className="modalActions">
              <button
                type="button"
                className="btnGhost"
                onClick={() => setIsDeleteConfirmOpen(false)}
                disabled={busy}
              >
                Annuler
              </button>
              <button type="button" className="btnDanger" onClick={handleDelete} disabled={busy}>
                {busy ? "Suppression..." : "Confirmer la suppression"}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className={`floatingToast floatingToast--${toast.type}`} role="status" aria-live="polite">
          <div className="floatingToast__content">
            <div className="floatingToast__title">{toast.title}</div>
            <div className="floatingToast__text">{toast.text}</div>
          </div>
          <button type="button" className="floatingToast__close" onClick={clearToast} disabled={busy}>
            Fermer
          </button>
        </div>
      )}
    </div>
  );
}