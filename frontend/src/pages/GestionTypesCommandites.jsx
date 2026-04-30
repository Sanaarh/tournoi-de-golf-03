/**
 * GestionTypesCommandites.jsx
 * Page d'administration : gestion CRUD des types de commandites.
 *
 * Backend :
 * - GET    /admin/types-commandites
 * - GET    /admin/types-commandites/:id
 * - POST   /admin/types-commandites
 * - PUT    /admin/types-commandites/:id
 * - DELETE /admin/types-commandites/:id
 */

import { useCallback, useEffect, useMemo, useState } from "react";

const API_BASE_URL = "http://localhost:3000";

const TAB = {
  CREATE: "CREATE",
  EDIT: "EDIT",
  LIST: "LIST",
  DELETE: "DELETE",
};

const EMPTY_CREATE_FORM = {
  tournoi_id: "",
  nom: "",
  prix_dollars: "",
  quota: "",
  places_incluses: "",
  description: "",
};

function toInt(value) {
  if (value === "" || value === null || value === undefined) return 0;
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.trunc(n);
}

function safeTrim(v) {
  return String(v || "").trim();
}

/** Saisie en dollars → cents entiers pour l'API. */
function dollarsToPrixCents(value) {
  const raw = String(value ?? "").trim().replace(",", ".");
  if (raw === "") return 0;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return -1;
  return Math.round(n * 100);
}

function prixCentsToDollarsInput(cents) {
  if (cents === "" || cents === null || cents === undefined) return "";
  const n = Number(cents);
  if (!Number.isFinite(n)) return "";
  return (n / 100).toFixed(2);
}

function typeQuotaComplet(t) {
  const quota = Number(t?.quota ?? 0);
  const nb = Number(t?.nb_commandites ?? 0);
  return quota > 0 && nb >= quota;
}

/**
 * Validation légère côté UI (confort).
 * Le backend refait la validation complète.
 */
function validateTypeCommanditeForm(form) {
  const errors = [];

  if (!form.tournoi_id || form.tournoi_id <= 0) {
    errors.push("Le tournoi est obligatoire.");
  }

  const nom = safeTrim(form.nom);
  if (!nom) {
    errors.push("Le nom de la commandite est obligatoire.");
  } else if (nom.length > 120) {
    errors.push("Le nom de la commandite ne doit pas dépasser 120 caractères.");
  }

  const prix_cents = dollarsToPrixCents(form.prix_dollars);
  if (prix_cents < 0) {
    errors.push("Le prix en dollars doit être un nombre valide ≥ 0.");
  }

  if (form.quota < 1) {
    errors.push("Le quota doit être un entier ≥ 1.");
  }
  if (form.places_incluses < 0) {
    errors.push("Les places incluses doivent être ≥ 0.");
  }

  const desc = safeTrim(form.description);
  if (desc.length > 2000) {
    errors.push("La description ne doit pas dépasser 2000 caractères.");
  }

  return errors;
}

export default function GestionTypesCommandites() {
  const [activeTab, setActiveTab] = useState(TAB.CREATE);

  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [types, setTypes] = useState([]);
  const [tournois, setTournois] = useState([]);
  const [quotaHintTypes, setQuotaHintTypes] = useState([]);

  const tournoisOuverts = useMemo(
    () => tournois.filter((t) => Boolean(t.inscriptions_ouvertes)),
    [tournois],
  );

  const [message, setMessage] = useState(null);
  const [toast, setToast] = useState(null);

  function clearMessage() {
    setMessage(null);
  }
  function clearToast() {
    setToast(null);
  }
  function showMessage(type, title, text) {
    const next = { type, title, text };
    setMessage(next);
    setToast(next);
  }

  function resetCreateForm() {
    setCreateForm({ ...EMPTY_CREATE_FORM });
  }

  const syncEditFormFromType = useCallback((t) => {
    if (!t) {
      setEditForm({
        tournoi_id: "",
        nom: "",
        prix_dollars: "",
        quota: "",
        places_incluses: "",
        description: "",
      });
      return;
    }
    setEditForm({
      tournoi_id: String(t.tournoi_id ?? ""),
      nom: t.nom ?? "",
      prix_dollars: prixCentsToDollarsInput(t.prix_cents),
      quota: String(t.quota ?? ""),
      places_incluses: String(t.places_incluses ?? ""),
      description: t.description ?? "",
    });
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const id = window.setTimeout(() => setToast(null), 4500);
    return () => window.clearTimeout(id);
  }, [toast]);

  // ------- Forms -------

  const [createForm, setCreateForm] = useState(() => ({ ...EMPTY_CREATE_FORM }));

  const [selectedId, setSelectedId] = useState("");
  const selectedType = useMemo(() => {
    const id = Number(selectedId);
    return types.find((t) => t.id === id) || null;
  }, [types, selectedId]);

  const [editForm, setEditForm] = useState({
    tournoi_id: "",
    nom: "",
    prix_dollars: "",
    quota: "",
    places_incluses: "",
    description: "",
  });

  const createTournoiMeta = useMemo(() => {
    const tid = Number(createForm.tournoi_id);
    if (!Number.isInteger(tid) || tid <= 0) return null;
    return tournois.find((t) => t.id === tid) ?? null;
  }, [createForm.tournoi_id, tournois]);

  const placesCommanditeesAlloueesCreate = useMemo(
    () =>
      quotaHintTypes.reduce(
        (s, row) => s + Number(row.quota ?? 0) * Number(row.places_incluses ?? 0),
        0,
      ),
    [quotaHintTypes],
  );

  const [deleteId, setDeleteId] = useState("");
  const deleteType = useMemo(() => {
    const id = Number(deleteId);
    return types.find((t) => t.id === id) || null;
  }, [types, deleteId]);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

  // ------- API helpers -------

  async function loadTournois() {
    try {
      const res = await fetch(`${API_BASE_URL}/admin/tournois`, { credentials: "include" });
      const data = await res.json().catch(() => []);
      setTournois(Array.isArray(data) ? data : []);
    } catch {
      setTournois([]);
    }
  }

  useEffect(() => {
    loadTournois();
  }, []);

  useEffect(() => {
    let ignore = false;
    const tid = Number(createForm.tournoi_id);
    if (activeTab !== TAB.CREATE || !Number.isInteger(tid) || tid <= 0) {
      setQuotaHintTypes([]);
      return undefined;
    }

    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/admin/types-commandites?tournoi_id=${tid}`, {
          credentials: "include",
        });
        const data = await res.json().catch(() => []);
        if (ignore) return;
        if (res.ok && Array.isArray(data)) setQuotaHintTypes(data);
        else setQuotaHintTypes([]);
      } catch {
        if (!ignore) setQuotaHintTypes([]);
      }
    })();

    return () => {
      ignore = true;
    };
  }, [activeTab, createForm.tournoi_id]);

  async function loadTypes(tournoiIdFilter) {
    setLoading(true);
    try {
      const params =
        tournoiIdFilter && Number(tournoiIdFilter) > 0
          ? `?tournoi_id=${Number(tournoiIdFilter)}`
          : "";

      const res = await fetch(`${API_BASE_URL}/admin/types-commandites${params}`, {
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setTypes([]);
        showMessage("error", "Chargement impossible", data?.message || "Accès refusé.");
        return;
      }

      setTypes(Array.isArray(data) ? data : []);
      if (Array.isArray(data) && data.length === 0) {
        showMessage("info", "Aucun type", "Aucun type de commandite trouvé pour ce tournoi.");
      }
    } catch {
      setTypes([]);
      showMessage("error", "Erreur réseau", "Backend non accessible.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    clearMessage();
    if (activeTab === TAB.CREATE) return;
    loadTypes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  useEffect(() => {
    syncEditFormFromType(selectedType);
  }, [selectedType, syncEditFormFromType]);

  // ------- Submit handlers -------

  async function handleCreate(e) {
    e.preventDefault();
    clearMessage();

    const tournoi_id = toInt(createForm.tournoi_id);
    const quota = toInt(createForm.quota);
    const places_incluses = toInt(createForm.places_incluses);
    const errs = validateTypeCommanditeForm({
      tournoi_id,
      nom: createForm.nom,
      prix_dollars: createForm.prix_dollars,
      quota,
      places_incluses,
      description: createForm.description,
    });
    if (errs.length) {
      showMessage("error", "Validation", errs[0]);
      resetCreateForm();
      return;
    }

    const payload = {
      tournoi_id,
      nom: safeTrim(createForm.nom),
      prix_cents: dollarsToPrixCents(createForm.prix_dollars),
      quota,
      places_incluses,
      description: safeTrim(createForm.description),
    };

    setBusy(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/types-commandites`, {
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
            ? Object.values(data.errors)
                .filter(Boolean)
                .join(" ")
            : "";
        const fullMessage = details ? `${base} ${details}` : base;

        showMessage("error", "Création refusée", fullMessage);
        resetCreateForm();
        return;
      }

      showMessage(
        "success",
        "Création OK",
        `Type de commandite "${data.nom}" créé (tournoi #${data.tournoi_id}).`,
      );

      resetCreateForm();

      await loadTypes();
    } catch {
      showMessage("error", "Erreur réseau", "Backend non accessible.");
      resetCreateForm();
    } finally {
      setBusy(false);
    }
  }

  async function handleUpdate(e) {
    e.preventDefault();
    clearMessage();

    if (!selectedType) {
      showMessage("error", "Sélection requise", "Veuillez sélectionner un type de commandite.");
      return;
    }

    const tournoi_id = toInt(editForm.tournoi_id);
    const quota = toInt(editForm.quota);
    const places_incluses = toInt(editForm.places_incluses);
    const errs = validateTypeCommanditeForm({
      tournoi_id,
      nom: editForm.nom,
      prix_dollars: editForm.prix_dollars,
      quota,
      places_incluses,
      description: editForm.description,
    });
    if (errs.length) {
      showMessage("error", "Validation", errs[0]);
      syncEditFormFromType(selectedType);
      return;
    }

    const payload = {
      tournoi_id,
      nom: safeTrim(editForm.nom),
      prix_cents: dollarsToPrixCents(editForm.prix_dollars),
      quota,
      places_incluses,
      description: safeTrim(editForm.description),
    };

    setBusy(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/types-commandites/${selectedType.id}`, {
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
            ? Object.values(data.errors)
                .filter(Boolean)
                .join(" ")
            : "";
        const fullMessage = details ? `${base} ${details}` : base;

        showMessage("error", "Modification refusée", fullMessage);
        syncEditFormFromType(selectedType);
        return;
      }

      showMessage("success", "Modification OK", `Type de commandite "${data.nom}" mis à jour.`);
      await loadTypes();
    } catch {
      showMessage("error", "Erreur réseau", "Backend non accessible.");
      syncEditFormFromType(selectedType);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    clearMessage();

    if (!deleteType) {
      showMessage("error", "Sélection requise", "Veuillez sélectionner un type de commandite.");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/types-commandites/${deleteType.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        showMessage("error", "Suppression refusée", data?.message || "Erreur serveur");
        return;
      }

      showMessage(
        "success",
        "Suppression OK",
        `Type de commandite "${deleteType.nom}" supprimé.`,
      );
      setDeleteId("");
      setIsDeleteConfirmOpen(false);
      await loadTypes();
    } catch {
      showMessage("error", "Erreur réseau", "Backend non accessible.");
    } finally {
      setBusy(false);
    }
  }

  const hasTypes = types.length > 0;

  return (
    <div>
      <div className="pageHeader">
        <div className="adminUsersHeaderLeft">
          <h1 className="adminUsersTitle">Gestion des types de commandites</h1>
          <p className="adminUsersSubtitle">
            Création, affichage, modification et suppression des types de commandites pour les
            tournois.
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
          onClick={() => loadTypes()}
          disabled={busy || loading}
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

      {/* CREATE */}
      {activeTab === TAB.CREATE && (
        <div className="panel">
          <h2 style={{ marginBottom: 18 }}>Créer un type de commandite</h2>

          <form className="adminForm" onSubmit={handleCreate} autoComplete="off">
            <div className="field">
              <label className="label">Tournoi</label>
              <select
                className="input"
                value={createForm.tournoi_id}
                onChange={(e) =>
                  setCreateForm((p) => ({ ...p, tournoi_id: e.target.value }))
                }
                disabled={busy}
              >
                <option value="">-- Choisir un tournoi ouvert aux inscriptions --</option>
                {tournoisOuverts.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nom}
                  </option>
                ))}
              </select>
              {tournois.length > 0 && tournoisOuverts.length === 0 && (
                <p className="hintText" style={{ marginTop: 8 }}>
                  Aucun tournoi n’est ouvert aux inscriptions : ouvrez un tournoi pour pouvoir créer un type.
                </p>
              )}
              {createTournoiMeta && (
                <p className="hintText" style={{ marginTop: 8 }}>
                  Limite de joueurs commandités pour ce tournoi :{" "}
                  <strong>{Number(createTournoiMeta.limite_commandites ?? 0)}</strong>
                  {Number(createTournoiMeta.limite_commandites ?? 0) > 0 && (
                    <>
                      {" "}
                      — places déjà allouées via les types existants :{" "}
                      <strong>{placesCommanditeesAlloueesCreate}</strong> (reste{" "}
                      <strong>
                        {Math.max(
                          0,
                          Number(createTournoiMeta.limite_commandites ?? 0) -
                            placesCommanditeesAlloueesCreate,
                        )}
                      </strong>{" "}
                      à répartir). Calcul : <strong>quota × places incluses</strong>.
                    </>
                  )}
                </p>
              )}
            </div>

            <div className="field">
              <label className="label">Nom de la commandite</label>
              <input
                className="input"
                value={createForm.nom}
                onChange={(e) => setCreateForm((p) => ({ ...p, nom: e.target.value }))}
                disabled={busy}
                placeholder="Ex: Commandite Or"
              />
            </div>

            <div className="field">
              <label className="label">Prix (dollars CAD)</label>
              <input
                className="input"
                type="number"
                value={createForm.prix_dollars}
                onChange={(e) =>
                  setCreateForm((p) => ({ ...p, prix_dollars: e.target.value }))
                }
                disabled={busy}
                min="0"
                step="0.01"
              />
            </div>

            <div className="field">
              <label className="label">Quota</label>
              <input
                className="input"
                type="number"
                value={createForm.quota}
                onChange={(e) => setCreateForm((p) => ({ ...p, quota: e.target.value }))}
                disabled={busy}
                min="1"
                step="1"
              />
              <p className="hintText" style={{ marginTop: 6 }}>
                Le quota doit être au moins <strong>1</strong>. Le total{" "}
                <strong>quota × places incluses</strong> de tous les types ne doit pas dépasser la
                limite du tournoi.
              </p>
            </div>

            <div className="field">
              <label className="label">Places incluses</label>
              <input
                className="input"
                type="number"
                value={createForm.places_incluses}
                onChange={(e) =>
                  setCreateForm((p) => ({ ...p, places_incluses: e.target.value }))
                }
                disabled={busy}
                min="0"
                step="1"
              />
            </div>

            <div className="field">
              <label className="label">Description</label>
              <textarea
                className="input"
                rows={4}
                value={createForm.description}
                onChange={(e) =>
                  setCreateForm((p) => ({ ...p, description: e.target.value }))
                }
                disabled={busy}
                placeholder="Détails visibles côté inscription (avantages, visibilité, etc.)"
              />
            </div>

            <button className="btnPrimary" type="submit" disabled={busy}>
              Enregistrer le type de commandite
            </button>
          </form>
        </div>
      )}

      {/* EDIT */}
      {activeTab === TAB.EDIT && (
        <>
          <div className="panel">
            <h2>Modifier un type de commandite</h2>

            {loading ? (
              <p>Chargement...</p>
            ) : !hasTypes ? (
              <p style={{ color: "var(--muted)" }}>Aucun type de commandite disponible.</p>
            ) : (
              <div className="field">
                <label className="label">Sélectionner un type</label>
                <select
                  className="input"
                  value={selectedId}
                  onChange={(e) => setSelectedId(e.target.value)}
                  disabled={busy}
                >
                  <option value="">-- Choisir --</option>
                  {types.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nom} (#{t.id} — {tournois.find((tr) => tr.id === t.tournoi_id)?.nom ?? `tournoi #${t.tournoi_id}`})
                      {typeQuotaComplet(t) ? " — complet" : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="panel">
            <h2>Détails</h2>

            {!selectedType ? (
              <p style={{ color: "var(--muted)" }}>
                Sélectionnez un type de commandite pour pré-remplir le formulaire.
              </p>
            ) : (
              <form className="adminForm" onSubmit={handleUpdate} autoComplete="off">
                <div className="field">
                  <label className="label">Tournoi</label>
                  <select
                    className="input"
                    value={editForm.tournoi_id}
                    onChange={(e) =>
                      setEditForm((p) => ({ ...p, tournoi_id: e.target.value }))
                    }
                    disabled={busy}
                  >
                    <option value="">-- Choisir un tournoi --</option>
                    {tournois.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.nom}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <label className="label">Nom de la commandite</label>
                  <input
                    className="input"
                    value={editForm.nom}
                    onChange={(e) => setEditForm((p) => ({ ...p, nom: e.target.value }))}
                    disabled={busy}
                  />
                </div>

                <div className="field">
                  <label className="label">Prix (dollars CAD)</label>
                  <input
                    className="input"
                    type="number"
                    value={editForm.prix_dollars}
                    onChange={(e) =>
                      setEditForm((p) => ({ ...p, prix_dollars: e.target.value }))
                    }
                    disabled={busy}
                    min="0"
                    step="0.01"
                  />
                </div>

                <div className="field">
                  <label className="label">Quota</label>
                  <input
                    className="input"
                    type="number"
                    value={editForm.quota}
                    onChange={(e) => setEditForm((p) => ({ ...p, quota: e.target.value }))}
                    disabled={busy}
                    min="1"
                    step="1"
                  />
                  <p className="hintText" style={{ marginTop: 6 }}>
                    Quota minimum <strong>1</strong>. Le total{" "}
                    <strong>quota × places incluses</strong> des types du tournoi ne doit pas dépasser
                    la limite.
                  </p>
                </div>

                <div className="field">
                  <label className="label">Places incluses</label>
                  <input
                    className="input"
                    type="number"
                    value={editForm.places_incluses}
                    onChange={(e) =>
                      setEditForm((p) => ({ ...p, places_incluses: e.target.value }))
                    }
                    disabled={busy}
                    min="0"
                    step="1"
                  />
                </div>

                <div className="field">
                  <label className="label">Description</label>
                  <textarea
                    className="input"
                    rows={4}
                    value={editForm.description}
                    onChange={(e) =>
                      setEditForm((p) => ({ ...p, description: e.target.value }))
                    }
                    disabled={busy}
                    placeholder="Détails visibles côté inscription"
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

      {/* LIST */}
      {activeTab === TAB.LIST && (
        <div className="panel">
          <h2>Liste des types de commandites</h2>

          {loading ? (
            <p>Chargement...</p>
          ) : !hasTypes ? (
            <p style={{ color: "var(--muted)" }}>Aucun type de commandite disponible.</p>
          ) : (
            <div className="tableWrap">
              <table className="dataTable">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Tournoi</th>
                    <th>Nom</th>
                    <th>Prix ($)</th>
                    <th>Quota</th>
                    <th>Inscrits</th>
                    <th>Places incluses</th>
                    <th>Description</th>
                    <th>Date création</th>
                  </tr>
                </thead>
                <tbody>
                  {types.map((t) => (
                    <tr key={t.id}>
                      <td>{t.id}</td>
                      <td>{tournois.find((tr) => tr.id === t.tournoi_id)?.nom ?? `#${t.tournoi_id}`}</td>
                      <td>{t.nom}</td>
                      <td>
                        {(Number(t.prix_cents ?? 0) / 100).toLocaleString("fr-CA", {
                          style: "currency",
                          currency: "CAD",
                        })}
                      </td>
                      <td>{t.quota}</td>
                      <td>{t.nb_commandites ?? "—"}</td>
                      <td>{t.places_incluses}</td>
                      <td style={{ maxWidth: 220, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {t.description || "—"}
                      </td>
                      <td>{String(t.date_creation || "").slice(0, 10)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* DELETE */}
      {activeTab === TAB.DELETE && (
        <div className="panel">
          <h2>Supprimer un type de commandite</h2>
          <p style={{ color: "var(--muted)", marginBottom: 16 }}>
            La suppression est définitive. Si des commandites utilisent encore ce type, leurs
            inscriptions (et paiements liés) seront aussi retirées de la base.
          </p>

          {loading ? (
            <p>Chargement...</p>
          ) : !hasTypes ? (
            <p style={{ color: "var(--muted)" }}>Aucun type de commandite disponible.</p>
          ) : (
            <>
              <div className="field">
                <label className="label">Sélectionner un type</label>
                <select
                  className="input"
                  value={deleteId}
                  onChange={(e) => setDeleteId(e.target.value)}
                  disabled={busy}
                >
                  <option value="">-- Choisir --</option>
                  {types.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nom} (#{t.id} — {tournois.find((tr) => tr.id === t.tournoi_id)?.nom ?? `tournoi #${t.tournoi_id}`})
                      {typeQuotaComplet(t) ? " — complet" : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="deleteRow">
                <div className="deleteInfo">
                  {deleteType ? (
                    <>
                      <div className="deleteName">{deleteType.nom}</div>
                      <div style={{ color: "var(--muted)", fontSize: 13 }}>
                        {tournois.find((tr) => tr.id === deleteType.tournoi_id)?.nom ?? `Tournoi #${deleteType.tournoi_id}`} — quota {deleteType.quota}
                      </div>
                    </>
                  ) : (
                    <div style={{ color: "var(--muted)" }}>
                      Sélectionnez un type de commandite à supprimer.
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  className="btnDanger"
                  onClick={() => setIsDeleteConfirmOpen(true)}
                  disabled={busy || !deleteType}
                >
                  Supprimer
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {isDeleteConfirmOpen && deleteType && (
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
              Vous allez supprimer le type de commandite <strong>{deleteType.nom}</strong>.
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
              <button
                type="button"
                className="btnDanger"
                onClick={handleDelete}
                disabled={busy}
              >
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
          <button
            type="button"
            className="floatingToast__close"
            onClick={clearToast}
            disabled={busy}
          >
            Fermer
          </button>
        </div>
      )}
    </div>
  );
}

