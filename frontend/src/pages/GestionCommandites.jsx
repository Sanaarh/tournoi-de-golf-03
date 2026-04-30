/**
 * Administration : commandites inscrites (liste par tournoi, détail, modification, suppression).
 * Les joueurs nominatifs suivent le forfait (places_incluses) ; le placement dans les équipes viendra plus tard.
 */

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";

const API_BASE_URL = "http://localhost:3000";

function safeTrim(v) {
  return String(v || "").trim();
}

function formatDate(value) {
  if (!value) return "—";
  return String(value).slice(0, 10);
}

function statutLabel(raw) {
  const s = String(raw || "").toUpperCase();
  if (s === "PAYEE") return "Payée";
  if (s === "ECHEC") return "Échec";
  if (s === "EN_ATTENTE") return "En attente";
  return raw || "—";
}

function statutClassName(raw) {
  const s = String(raw || "").toUpperCase();
  if (s === "PAYEE") return "cmdStatusBadge cmdStatusBadge--payee";
  if (s === "ECHEC") return "cmdStatusBadge cmdStatusBadge--echec";
  if (s === "EN_ATTENTE") return "cmdStatusBadge cmdStatusBadge--attente";
  return "cmdStatusBadge";
}

function initialsFromName(name) {
  const parts = safeTrim(name)
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "??";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
}

function firstLastName(name) {
  const parts = safeTrim(name)
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return { first: "Contact", last: "" };
  if (parts.length === 1) return { first: parts[0], last: "" };
  return {
    first: parts[0],
    last: parts.slice(1).join(" "),
  };
}

/** Quota > 0 : empêche de choisir un forfait déjà complet (sauf le type déjà assigné à cette commandite). */
function isTypeQuotaBlockedForEdit(typeRow, detailRow) {
  const q = Number(typeRow?.quota ?? 0);
  if (!Number.isFinite(q) || q <= 0) return false;
  const used = Number(typeRow?.nb_commandites ?? 0);
  const cur =
    detailRow?.type_commandite_id != null && detailRow?.type_commandite_id !== ""
      ? String(detailRow.type_commandite_id)
      : "";
  if (cur && String(typeRow.id) === cur) return false;
  return used >= q;
}

/** Même règle que la page Équipes : seulement les tournois ouverts aux inscriptions. */
function isTournoiOuvertAuxInscriptions(value) {
  const normalized = String(value ?? "").trim().toLowerCase();
  return value === true || value === 1 || normalized === "1" || normalized === "true";
}

const emptyEditForm = () => ({
  nom_entreprise: "",
  nom_contact: "",
  courriel_contact: "",
  telephone_contact: "",
  statut: "EN_ATTENTE",
  type_commandite_id: "",
});

/** Aligne le nombre de lignes joueur sur `places_incluses` du détail API. */
function buildJoueursStateFromDetail(data) {
  const need = Number(data?.type_places_incluses ?? 0);
  const fromDb = [...(data?.joueurs || [])].sort(
    (a, b) => (Number(a.ordre) || 0) - (Number(b.ordre) || 0)
  );
  const rows = fromDb.map((j) => ({
    prenom: safeTrim(j.prenom),
    nom: safeTrim(j.nom),
  }));
  while (rows.length < need) rows.push({ prenom: "", nom: "" });
  rows.length = need;
  return rows;
}

function IconPen({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconTrash({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M3 6h18M8 6V4h8v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M10 11v6M14 11v6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function IconMail({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3.5" y="5.5" width="17" height="13" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M4.5 7l7.5 5.5L19.5 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function IconPhone({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M21 16.9v2.4a2 2 0 0 1-2.2 2A18.6 18.6 0 0 1 11 18.7a18.2 18.2 0 0 1-5.7-5.7A18.6 18.6 0 0 1 2.7 5.2 2 2 0 0 1 4.7 3h2.4a2 2 0 0 1 2 1.7c.1.9.3 1.8.7 2.6a2 2 0 0 1-.5 2.1L8.2 10.5a15.8 15.8 0 0 0 5.3 5.3l1.1-1.1a2 2 0 0 1 2.1-.5c.8.4 1.7.6 2.6.7A2 2 0 0 1 21 16.9z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function GestionCommandites() {
  const navigate = useNavigate();

  const [authLoading, setAuthLoading] = useState(true);
  const [tournois, setTournois] = useState([]);
  const [tournoiId, setTournoiId] = useState("");

  const [liste, setListe] = useState([]);
  const [loadingListe, setLoadingListe] = useState(false);

  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const [types, setTypes] = useState([]);
  const [editForm, setEditForm] = useState(emptyEditForm());
  /** Lignes joueur pour le forfait sélectionné (édition) */
  const [joueursEdit, setJoueursEdit] = useState([]);

  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState(null);
  const [editModalOpen, setEditModalOpen] = useState(false);

  function showToast(type, title, text) {
    setToast({ type, title, text });
  }

  useEffect(() => {
    if (!toast) return undefined;
    const id = window.setTimeout(() => setToast(null), 4200);
    return () => window.clearTimeout(id);
  }, [toast]);

  useEffect(() => {
    let mounted = true;
    async function check() {
      try {
        const res = await fetch(`${API_BASE_URL}/auth/me`, { credentials: "include" });
        if (!res.ok) {
          navigate("/admin", { replace: true });
          return;
        }
        const tRes = await fetch(`${API_BASE_URL}/admin/tournois`, { credentials: "include" });
        const data = await tRes.json().catch(() => []);
        if (!mounted) return;
        const rows = Array.isArray(data) ? data : [];
        const ouverts = rows.filter((t) => isTournoiOuvertAuxInscriptions(t?.inscriptions_ouvertes));
        setTournois(ouverts);
        setTournoiId((prev) => {
          if (ouverts.length === 0) return "";
          const encoreValide = prev && ouverts.some((t) => String(t.id) === String(prev));
          if (encoreValide) return String(prev);
          return String(ouverts[0].id);
        });
      } catch {
        if (mounted) navigate("/admin", { replace: true });
      } finally {
        if (mounted) setAuthLoading(false);
      }
    }
    check();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  async function fetchTypesList(tid) {
    const res = await fetch(`${API_BASE_URL}/admin/types-commandites?tournoi_id=${tid}`, {
      credentials: "include",
    });
    const data = await res.json().catch(() => []);
    return Array.isArray(data) ? data : [];
  }

  async function refreshTypes() {
    const tid = Number(tournoiId);
    if (!Number.isInteger(tid) || tid <= 0) {
      setTypes([]);
      return;
    }
    try {
      setTypes(await fetchTypesList(tid));
    } catch {
      setTypes([]);
    }
  }

  useEffect(() => {
    let ignore = false;
    (async () => {
      const tid = Number(tournoiId);
      if (!Number.isInteger(tid) || tid <= 0) {
        if (!ignore) setTypes([]);
        return;
      }
      try {
        const rows = await fetchTypesList(tid);
        if (!ignore) setTypes(rows);
      } catch {
        if (!ignore) setTypes([]);
      }
    })();
    return () => {
      ignore = true;
    };
  }, [tournoiId]);

  async function loadListe(resetSelection = true) {
    const tid = Number(tournoiId);
    if (!Number.isInteger(tid) || tid <= 0) {
      setListe([]);
      return;
    }
    setLoadingListe(true);
    try {
      const res = await fetch(
        `${API_BASE_URL}/admin/commandites?tournoi_id=${tid}`,
        { credentials: "include" }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast("error", "Liste", data?.message || "Chargement impossible.");
        setListe([]);
        return;
      }
      setListe(Array.isArray(data) ? data : []);
      if (resetSelection) {
        setSelectedId(null);
        setDetail(null);
        setEditForm(emptyEditForm());
        setEditModalOpen(false);
        setDeleteOpen(false);
        setDeleteTargetId(null);
        setJoueursEdit([]);
      }
    } finally {
      setLoadingListe(false);
    }
  }

  useEffect(() => {
    if (authLoading) return;
    loadListe(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournoiId, authLoading]);

  async function loadDetail(id) {
    setLoadingDetail(true);
    setDetail(null);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/commandites/${id}`, {
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast("error", "Détail", data?.message || "Impossible de charger la commandite.");
        closeEditModal();
        return;
      }
      setDetail(data);
      setEditForm({
        nom_entreprise: safeTrim(data.nom_entreprise),
        nom_contact: safeTrim(data.nom_contact),
        courriel_contact: safeTrim(data.courriel_contact),
        telephone_contact: safeTrim(data.telephone_contact),
        statut: String(data.statut || "EN_ATTENTE").toUpperCase(),
        type_commandite_id: String(data.type_commandite_id ?? ""),
      });
      setJoueursEdit(buildJoueursStateFromDetail(data));
    } finally {
      setLoadingDetail(false);
    }
  }

  function closeEditModal() {
    setEditModalOpen(false);
    setSelectedId(null);
    setDetail(null);
    setEditForm(emptyEditForm());
    setJoueursEdit([]);
  }

  function openEditModal(id) {
    setSelectedId(id);
    setEditModalOpen(true);
    void refreshTypes();
    loadDetail(id);
  }

  const selectedSummary = useMemo(() => {
    if (!selectedId) return null;
    return liste.find((r) => Number(r.id) === Number(selectedId)) || null;
  }, [liste, selectedId]);

  const deleteRowSummary = useMemo(() => {
    const id = deleteTargetId ?? selectedId;
    if (!id) return null;
    return liste.find((r) => Number(r.id) === Number(id)) || null;
  }, [liste, deleteTargetId, selectedId]);

  const placesForfaitChoisi = useMemo(() => {
    const tid = Number(editForm.type_commandite_id);
    if (!Number.isInteger(tid) || tid <= 0) return 0;
    const t = types.find((x) => Number(x.id) === tid);
    return Number(t?.places_incluses ?? 0);
  }, [editForm.type_commandite_id, types]);

  const typeSelectionQuotaMessage = useMemo(() => {
    const tid = Number(editForm.type_commandite_id);
    if (!detail || !Number.isInteger(tid) || tid <= 0) return null;
    const t = types.find((x) => Number(x.id) === tid);
    if (!t) return null;
    if (!isTypeQuotaBlockedForEdit(t, detail)) return null;
    return "Ce forfait est complet : aucune inscription supplémentaire n’est possible sur ce palier. Enregistrez un autre forfait ou libérez / augmentez le quota.";
  }, [editForm.type_commandite_id, types, detail]);

  async function handleSave(ev) {
    ev.preventDefault();
    if (!selectedId) return;

    const tid = Number(editForm.type_commandite_id);
    if (!Number.isInteger(tid) || tid <= 0) {
      showToast("error", "Validation", "Choisissez un type de commandite.");
      return;
    }

    const typeRow = types.find((x) => Number(x.id) === tid);
    const need = Number(typeRow?.places_incluses ?? 0);
    const jPayload = joueursEdit.map((j) => ({
      prenom: safeTrim(j.prenom),
      nom: safeTrim(j.nom),
    }));
    while (jPayload.length < need) jPayload.push({ prenom: "", nom: "" });
    jPayload.length = need;

    if (jPayload.length !== need) {
      showToast("error", "Joueurs", "Nombre de lignes joueur incohérent avec le forfait.");
      return;
    }
    if (need > 0) {
      for (let i = 0; i < jPayload.length; i++) {
        if (!jPayload[i].prenom || !jPayload[i].nom) {
          showToast(
            "error",
            "Joueurs",
            `Renseignez le prénom et le nom pour chaque joueur (place ${i + 1}).`
          );
          return;
        }
      }
      const vu = new Set();
      for (const j of jPayload) {
        const k = `${j.prenom.toLowerCase()}|${j.nom.toLowerCase()}`;
        if (vu.has(k)) {
          showToast("error", "Joueurs", "Deux joueurs ne peuvent pas avoir le même prénom et le même nom.");
          return;
        }
        vu.add(k);
      }
    }

    setBusy(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/commandites/${selectedId}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nom_entreprise: safeTrim(editForm.nom_entreprise),
          nom_contact: safeTrim(editForm.nom_contact),
          courriel_contact: safeTrim(editForm.courriel_contact),
          telephone_contact: safeTrim(editForm.telephone_contact) || null,
          statut: safeTrim(editForm.statut).toUpperCase(),
          type_commandite_id: tid,
          joueurs: need === 0 ? [] : jPayload,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg =
          data?.errors && typeof data.errors === "object"
            ? Object.values(data.errors).join(" ")
            : data?.message || "Erreur lors de la mise à jour.";
        showToast("error", "Enregistrement", msg);
        return;
      }
      showToast("success", "Enregistré", "La commandite a été mise à jour.");
      await loadListe(false);
      await refreshTypes();
      await loadDetail(selectedId);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    const id = deleteTargetId ?? selectedId;
    if (!id) return;
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/commandites/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast("error", "Suppression", data?.message || "Impossible de supprimer.");
        return;
      }
      showToast("success", "Supprimé", "La commandite a été supprimée.");
      setDeleteOpen(false);
      setDeleteTargetId(null);
      setEditModalOpen(false);
      setSelectedId(null);
      setDetail(null);
      setEditForm(emptyEditForm());
      setJoueursEdit([]);
      await loadListe(false);
    } finally {
      setBusy(false);
    }
  }

  if (authLoading) {
    return (
      <div className="adminUsersPage">
        <p className="adminMuted">Vérification de la session…</p>
      </div>
    );
  }

  return (
    <div className="adminUsersPage">
      <h1 className="adminUsersTitle">Commandites inscrites</h1>

      <div className="adminCard" style={{ marginTop: 20, padding: 20 }}>
        <label className="label" htmlFor="cmd-tournoi">
          Tournoi
        </label>
        <select
          id="cmd-tournoi"
          className="input"
          style={{ maxWidth: 420 }}
          value={tournoiId}
          onChange={(e) => setTournoiId(e.target.value)}
        >
          {tournois.length === 0 ? (
            <option value="">Aucun tournoi ouvert aux inscriptions</option>
          ) : (
            tournois.map((t) => (
              <option key={t.id} value={String(t.id)}>
                {t.nom} (#{t.id})
              </option>
            ))
          )}
        </select>
      </div>

      <div
        style={{
          marginTop: 16,
          padding: 0,
          overflow: "hidden",
          background: "#fff",
          borderRadius: 16,
          border: "1px solid var(--border)",
        }}
      >
        {loadingListe ? (
          <p style={{ padding: 20, color: "var(--muted)" }}>Chargement…</p>
        ) : liste.length === 0 ? (
          <p style={{ padding: 20, color: "var(--muted)" }}>
            Aucune commandite pour ce tournoi.
          </p>
        ) : (
          <div className="joueursCmdTableWrap" style={{ margin: 0 }}>
            <table className="joueursCmdTable" style={{ margin: 0 }}>
              <thead>
                <tr>
                  <th>Entreprise</th>
                  <th>Courriel</th>
                  <th>Forfait</th>
                  <th>Joueurs</th>
                  <th>Statut</th>
                  <th>Inscription</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {liste.map((row) => {
                  const entrepriseName = firstLastName(row.nom_entreprise);
                  return (
                  <tr key={row.id}>
                    <td>
                      <div className="cmdContactCell">
                        <div className="cmdContactAvatar">{initialsFromName(row.nom_entreprise)}</div>
                        <div className="cmdContactName">
                          <span className="cmdContactNameFirst">{entrepriseName.first}</span>
                          {entrepriseName.last ? (
                            <span className="cmdContactNameLast">{entrepriseName.last}</span>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="joueursCmdContactLine">
                        <IconMail size={13} />
                        <span>{row.courriel_contact || "—"}</span>
                      </div>
                      <div className="joueursCmdContactLine">
                        <IconPhone size={13} />
                        <span>{safeTrim(row.telephone_contact) || "—"}</span>
                      </div>
                    </td>
                    <td>{row.type_commandite_nom || "—"}</td>
                    <td>{row.nb_joueurs ?? 0}</td>
                    <td>
                      <span className={statutClassName(row.statut)}>{statutLabel(row.statut)}</span>
                    </td>
                    <td>{formatDate(row.date_creation)}</td>
                    <td>
                      <div className="cmdRowActions">
                        <button
                          type="button"
                          className="cmdIconBtn cmdIconBtn--edit"
                          onClick={() => openEditModal(row.id)}
                          aria-label={`Modifier la commandite ${row.nom_entreprise || row.id}`}
                          title="Modifier"
                        >
                          <IconPen />
                        </button>
                        <button
                          type="button"
                          className="cmdIconBtn cmdIconBtn--delete"
                          onClick={() => {
                            setDeleteTargetId(row.id);
                            setDeleteOpen(true);
                          }}
                          aria-label={`Supprimer la commandite ${row.nom_entreprise || row.id}`}
                          title="Supprimer"
                        >
                          <IconTrash />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editModalOpen &&
        selectedId &&
        createPortal(
          <div
            className="modalBackdrop"
            role="presentation"
            onClick={() => !busy && closeEditModal()}
          >
            <div
              className="modal modal--commanditeEdit"
              role="dialog"
              aria-modal="true"
              aria-labelledby="cmd-edit-title"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modalHead">
                <div className="modalTitle" id="cmd-edit-title">
                  Détail et modification
                </div>
                <button
                  type="button"
                  className="modalClose"
                  onClick={() => !busy && closeEditModal()}
                  disabled={busy}
                  aria-label="Fermer"
                >
                  ×
                </button>
              </div>

              {loadingDetail ? (
                <p className="modalSub">Chargement du détail…</p>
              ) : (
                <>
                  <div className="modalCommanditeBody">
                    <p className="modalSub">
                      Commandite #{selectedId}
                      {selectedSummary?.date_creation
                        ? ` · inscrite le ${formatDate(selectedSummary.date_creation)}`
                        : ""}
                      {detail?.tournoi_nom ? ` · ${detail.tournoi_nom}` : ""}
                    </p>

                    <form id="form-edit-commandite" onSubmit={handleSave} className="regForm">
                  <div className="regForm__row2">
                    <div className="field">
                      <label className="label" htmlFor="cmd-ne">
                        Nom de l&apos;entreprise *
                      </label>
                      <input
                        id="cmd-ne"
                        className="input"
                        value={editForm.nom_entreprise}
                        onChange={(e) => setEditForm((p) => ({ ...p, nom_entreprise: e.target.value }))}
                      />
                    </div>
                    <div className="field">
                      <label className="label" htmlFor="cmd-nc">
                        Nom du contact *
                      </label>
                      <input
                        id="cmd-nc"
                        className="input"
                        value={editForm.nom_contact}
                        onChange={(e) => setEditForm((p) => ({ ...p, nom_contact: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="regForm__row2">
                    <div className="field">
                      <label className="label" htmlFor="cmd-mail">
                        Courriel *
                      </label>
                      <input
                        id="cmd-mail"
                        className="input"
                        type="email"
                        value={editForm.courriel_contact}
                        onChange={(e) => setEditForm((p) => ({ ...p, courriel_contact: e.target.value }))}
                      />
                    </div>
                    <div className="field">
                      <label className="label" htmlFor="cmd-tel">
                        Téléphone
                      </label>
                      <input
                        id="cmd-tel"
                        className="input"
                        value={editForm.telephone_contact}
                        onChange={(e) => setEditForm((p) => ({ ...p, telephone_contact: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="regForm__row2">
                    <div className="field">
                      <label className="label" htmlFor="cmd-statut">
                        Statut
                      </label>
                      <select
                        id="cmd-statut"
                        className="input"
                        value={editForm.statut}
                        onChange={(e) => setEditForm((p) => ({ ...p, statut: e.target.value }))}
                      >
                        <option value="EN_ATTENTE">En attente</option>
                        <option value="PAYEE">Payée</option>
                        <option value="ECHEC">Échec</option>
                      </select>
                    </div>
                    <div className="field">
                      <label className="label" htmlFor="cmd-type">
                        Type / forfait *
                      </label>
                      <select
                        id="cmd-type"
                        className="input"
                        value={editForm.type_commandite_id}
                        onChange={(e) => {
                          const newId = e.target.value;
                          setEditForm((p) => ({ ...p, type_commandite_id: newId }));
                          const t = types.find((x) => String(x.id) === String(newId));
                          const need = Number(t?.places_incluses ?? 0);
                          setJoueursEdit((prev) => {
                            const next = prev.map((r) => ({
                              prenom: r.prenom,
                              nom: r.nom,
                            }));
                            while (next.length < need) next.push({ prenom: "", nom: "" });
                            if (next.length > need) next.length = need;
                            return next;
                          });
                        }}
                      >
                        <option value="">—</option>
                        {types.map((t) => {
                          const q = Number(t.quota ?? 0);
                          const used = Number(t.nb_commandites ?? 0);
                          const blocked = isTypeQuotaBlockedForEdit(t, detail);
                          let label = t.nom;
                          if (Number(t.places_incluses) > 0) {
                            label += ` (${t.places_incluses} place${Number(t.places_incluses) > 1 ? "s" : ""})`;
                          }
                          if (q > 0) {
                            label += ` — ${used}/${q} commandite${q > 1 ? "s" : ""}`;
                            if (blocked) label += " (complet)";
                          }
                          return (
                            <option
                              key={t.id}
                              value={String(t.id)}
                              disabled={blocked}
                              title={
                                blocked
                                  ? "Quota atteint pour ce forfait — impossible d’y déplacer une autre inscription."
                                  : undefined
                              }
                            >
                              {label}
                            </option>
                          );
                        })}
                      </select>
                      {typeSelectionQuotaMessage ? (
                        <p
                          style={{
                            margin: "10px 0 0",
                            fontSize: 13,
                            color: "#b45309",
                            lineHeight: 1.45,
                          }}
                        >
                          {typeSelectionQuotaMessage}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  {placesForfaitChoisi === 0 ? (
                    <p
                      style={{
                        margin: "16px 0 0",
                        padding: 14,
                        background: "rgba(15, 23, 42, .04)",
                        borderRadius: 12,
                        border: "1px solid var(--border)",
                        color: "var(--muted)",
                        fontSize: 14,
                      }}
                    >
                      Ce forfait n&apos;inclut aucune place joueur nominative. Aucun nom à saisir.
                    </p>
                  ) : (
                    <div style={{ marginTop: 16 }}>
                      <div style={{ fontWeight: 700, marginBottom: 10, color: "var(--forest)" }}>
                        Joueurs du forfait ({placesForfaitChoisi} place
                        {placesForfaitChoisi > 1 ? "s" : ""})
                      </div>
                      <p style={{ margin: "0 0 12px", fontSize: 13, color: "var(--muted)" }}>
                        Le nombre de champs correspond au forfait sélectionné. Changez le type ci-dessus pour ajouter ou
                        retirer des lignes.
                      </p>
                      {joueursEdit.map((row, idx) => (
                        <div key={`je-${idx}`} className="regForm__row2" style={{ marginBottom: 10 }}>
                          <div className="field">
                            <label className="label" htmlFor={`cmd-jp-${idx}`}>
                              Prénom joueur {idx + 1} *
                            </label>
                            <input
                              id={`cmd-jp-${idx}`}
                              className="input"
                              value={row.prenom}
                              onChange={(e) =>
                                setJoueursEdit((prev) => {
                                  const n = [...prev];
                                  n[idx] = { ...n[idx], prenom: e.target.value };
                                  return n;
                                })
                              }
                            />
                          </div>
                          <div className="field">
                            <label className="label" htmlFor={`cmd-jn-${idx}`}>
                              Nom joueur {idx + 1} *
                            </label>
                            <input
                              id={`cmd-jn-${idx}`}
                              className="input"
                              value={row.nom}
                              onChange={(e) =>
                                setJoueursEdit((prev) => {
                                  const n = [...prev];
                                  n[idx] = { ...n[idx], nom: e.target.value };
                                  return n;
                                })
                              }
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                    </form>
                  </div>

                  <div className="modalActions">
                    <button
                      type="button"
                      className="btnGhost"
                      style={{ borderColor: "var(--danger)", color: "var(--danger)" }}
                      disabled={busy}
                      onClick={() => {
                        setDeleteTargetId(selectedId);
                        setDeleteOpen(true);
                      }}
                    >
                      Supprimer
                    </button>
                    <button type="submit" className="btnPrimary" disabled={busy} form="form-edit-commandite">
                      Enregistrer les modifications
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>,
          document.body
        )}

      {deleteOpen &&
        (deleteTargetId ?? selectedId) &&
        createPortal(
          <div className="modalBackdrop modalBackdrop--onTop" role="presentation">
            <div className="modal" role="dialog" aria-modal="true" aria-labelledby="cmd-del-title">
              <div className="modalHead">
                <div className="modalTitle" id="cmd-del-title">
                  Supprimer la commandite ?
                </div>
                <button
                  type="button"
                  className="modalClose"
                  onClick={() => {
                    setDeleteOpen(false);
                    setDeleteTargetId(null);
                  }}
                  disabled={busy}
                  aria-label="Fermer"
                >
                  ×
                </button>
              </div>
              <p className="modalSub">
                {deleteRowSummary?.nom_entreprise ? (
                  <>
                    Supprimer la commandite de <strong>{deleteRowSummary.nom_entreprise}</strong> ? Cette action est
                    définitive : la fiche, les joueurs nominatifs et les paiements liés en base seront supprimés.
                  </>
                ) : (
                  <>
                    Voulez-vous vraiment supprimer cette commandite ? Cette action supprime la fiche, les joueurs
                    nominatifs associés et les enregistrements de paiement liés si la base les rattache à cette
                    commandite.
                  </>
                )}
              </p>
              <div className="modalActions">
                <button
                  type="button"
                  className="btnGhost"
                  disabled={busy}
                  onClick={() => {
                    setDeleteOpen(false);
                    setDeleteTargetId(null);
                  }}
                >
                  Annuler
                </button>
                <button type="button" className="btnDanger" disabled={busy} onClick={handleDelete}>
                  {busy ? "Suppression…" : "Supprimer"}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {toast && (
        <div className={`floatingToast floatingToast--${toast.type}`} role="status" aria-live="polite">
          <div className="floatingToast__content">
            <div className="floatingToast__title">{toast.title}</div>
            <div className="floatingToast__text">{toast.text}</div>
          </div>
          <button type="button" className="floatingToast__close" onClick={() => setToast(null)}>
            Fermer
          </button>
        </div>
      )}
    </div>
  );
}
