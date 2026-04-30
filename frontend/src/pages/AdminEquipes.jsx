

import { useEffect, useMemo, useState } from "react";

const API_BASE_URL = "http://localhost:3000";
const TEAM_SIZE = 4;

function safeTrim(value) {
  return String(value || "").trim();
}

function formatDate(value) {
  if (!value) return "Date inconnue";
  return String(value).slice(0, 10);
}

function isOpen(value) {
  const normalized = String(value ?? "").trim().toLowerCase();
  return value === true || value === 1 || normalized === "1" || normalized === "true";
}

function participantTypeLabel(member) {
  const raw = String(member?.type_participant || member?.type || "").toUpperCase();
  if (raw === "JOUEUR_COMMANDITE") return "Commandite";
  if (raw === "RETRAITE") return "Retraite";
  return "Employe";
}

function SearchIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
      <circle cx="12" cy="8" r="3.2" />
      <path d="M4 20a8 8 0 0 1 16 0" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M4 7l8 6 8-6" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
      <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.6 19.6 0 0 1-8.6-3.1 19.2 19.2 0 0 1-6-6A19.6 19.6 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .8 2.9a2 2 0 0 1-.5 2L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2-.5c1 .4 1.9.7 2.9.8A2 2 0 0 1 22 16.9z" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function commanditeStatutLabel(raw) {
  const s = String(raw || "").toUpperCase();
  if (s === "PAYEE" || s === "PAYE") return "Payée";
  if (s === "ECHEC") return "Échec";
  if (s === "EN_ATTENTE") return "En attente";
  return raw || "—";
}

function GripIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <circle cx="9" cy="6" r="1.5" />
      <circle cx="15" cy="6" r="1.5" />
      <circle cx="9" cy="12" r="1.5" />
      <circle cx="15" cy="12" r="1.5" />
      <circle cx="9" cy="18" r="1.5" />
      <circle cx="15" cy="18" r="1.5" />
    </svg>
  );
}

export default function AdminEquipes() {
  const [equipes, setEquipes] = useState([]);
  const [tournois, setTournois] = useState([]);
  const [joueursCommandites, setJoueursCommandites] = useState([]);
  const [loadingJoueursCmd, setLoadingJoueursCmd] = useState(false);
  const [joueursCmdTournoiFilter, setJoueursCmdTournoiFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [nameDraft, setNameDraft] = useState("");
  const [newTeamName, setNewTeamName] = useState("");
  const [newTeamTournoiId, setNewTeamTournoiId] = useState("");
  const [memberForms, setMemberForms] = useState({});
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [openAddFormEquipeId, setOpenAddFormEquipeId] = useState(null);
  const [removeMemberTarget, setRemoveMemberTarget] = useState(null);
  const [toast, setToast] = useState(null);
  const [dragJoueurCmd, setDragJoueurCmd] = useState(null);
  const [dragParticipant, setDragParticipant] = useState(null);
  const [dropHighlightEquipeId, setDropHighlightEquipeId] = useState(null);
  const [editJoueurCmd, setEditJoueurCmd] = useState(null);
  const [deleteJoueurCmd, setDeleteJoueurCmd] = useState(null);
  const [editParticipant, setEditParticipant] = useState(null);

  function showToast(type, title, text) {
    setToast({ type, title, text });
  }

  useEffect(() => {
    if (!toast) return undefined;
    const id = window.setTimeout(() => setToast(null), 4200);
    return () => window.clearTimeout(id);
  }, [toast]);

  async function loadEquipes() {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/equipes`, { credentials: "include" });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        showToast("error", "Chargement impossible", data?.message || "Impossible de charger les equipes.");
        setEquipes([]);
        return;
      }

      const rows = Array.isArray(data) ? data : [];
      const enriched = await Promise.all(
        rows.map(async (row) => {
          try {
            const mRes = await fetch(`${API_BASE_URL}/admin/equipes/${row.id}/membres`, {
              credentials: "include",
            });
            const membres = await mRes.json().catch(() => []);
            return {
              ...row,
              date_creation: row.date_creation || new Date().toISOString(),
              membres: Array.isArray(membres) ? membres : [],
            };
          } catch {
            return {
              ...row,
              date_creation: row.date_creation || new Date().toISOString(),
              membres: [],
            };
          }
        })
      );

      setEquipes(enriched);

      setMemberForms((prev) => {
        const next = { ...prev };
        enriched.forEach((equipe) => {
          if (!next[equipe.id]) {
            next[equipe.id] = {
              query: "",
              results: [],
              participantId: "",
              newPrenom: "",
              newNom: "",
              newCourriel: "",
              newTelephone: "",
            };
          }
        });
        return next;
      });
    } finally {
      setLoading(false);
    }
  }

  async function loadTournois() {
    try {
      const res = await fetch(`${API_BASE_URL}/admin/tournois`, { credentials: "include" });
      const data = await res.json().catch(() => []);
      if (!res.ok) return;
      const rows = Array.isArray(data) ? data : [];
      const openRows = rows.filter((t) => isOpen(t?.inscriptions_ouvertes));
      setTournois(openRows);
      if (!newTeamTournoiId && openRows[0]?.id) setNewTeamTournoiId(String(openRows[0].id));
    } catch {
      // noop
    }
  }

  async function loadJoueursCommandites() {
    const q = safeTrim(joueursCmdTournoiFilter);

    if (q === "") {
      setJoueursCommandites([]);
      return;
    }

    setLoadingJoueursCmd(true);
    try {
      const url = `${API_BASE_URL}/admin/joueurs-commandites?tournoi_id=${encodeURIComponent(q)}`;
      const res = await fetch(url, { credentials: "include" });
      const data = await res.json().catch(() => []);

      if (!res.ok) {
        showToast("error", "Liste commanditaires", data?.message || "Impossible de charger les joueurs.");
        setJoueursCommandites([]);
        return;
      }

      setJoueursCommandites(Array.isArray(data) ? data : []);
    } catch {
      showToast("error", "Liste commanditaires", "Erreur reseau.");
      setJoueursCommandites([]);
    } finally {
      setLoadingJoueursCmd(false);
    }
  }

  /**
   * Recharge toutes les données utiles de la page.
   * Cette fonction corrige le bug du compteur qui restait ancien après suppression.
   */
  async function reloadPageData() {
    await Promise.all([loadEquipes(), loadJoueursCommandites()]);
  }

  useEffect(() => {
    loadEquipes();
    loadTournois();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadJoueursCommandites();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [joueursCmdTournoiFilter]);

  useEffect(() => {
    if (tournois.length === 0) {
      setNewTeamTournoiId("");
      return;
    }
    const exists = tournois.some((t) => String(t.id) === String(newTeamTournoiId));
    if (!exists) {
      setNewTeamTournoiId(String(tournois[0].id));
    }
  }, [tournois, newTeamTournoiId]);

  useEffect(() => {
    if (tournois.length === 0) {
      setJoueursCmdTournoiFilter("");
      return;
    }
    const exists = tournois.some((t) => String(t.id) === String(joueursCmdTournoiFilter));
    if (!exists) {
      setJoueursCmdTournoiFilter(String(tournois[0].id));
    }
  }, [tournois, joueursCmdTournoiFilter]);

  const filteredEquipes = useMemo(() => {
    const q = safeTrim(search).toLowerCase();
    if (!q) return equipes;

    return equipes.filter((equipe) => {
      const teamText = `${equipe.nom_equipe || ""} ${equipe.code_secret || ""}`.toLowerCase();
      return teamText.includes(q);
    });
  }, [equipes, search]);

  function startEdit(equipe) {
    setEditingId(equipe.id);
    setNameDraft(equipe.nom_equipe || "");
  }

  async function saveEdit(equipeId) {
    const nextName = safeTrim(nameDraft);

    if (!nextName) {
      showToast("error", "Validation", "Le nom de l'equipe est obligatoire.");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/equipes/${equipeId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ nom_equipe: nextName }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        showToast("error", "Modification refusee", data?.message || "Impossible de modifier l'equipe.");
        return;
      }

      setEditingId(null);
      setNameDraft("");
      showToast("success", "Nom mis a jour", "Equipe modifiee avec succes.");
      await loadEquipes();
    } finally {
      setBusy(false);
    }
  }

  function updateMemberForm(equipeId, field, value) {
    setMemberForms((prev) => ({
      ...prev,
      [equipeId]: {
        ...(prev[equipeId] || {
          query: "",
          results: [],
          participantId: "",
          newPrenom: "",
          newNom: "",
          newCourriel: "",
          newTelephone: "",
        }),
        [field]: value,
      },
    }));
  }

  async function searchParticipantsForEquipe(equipeId) {
    const form = memberForms[equipeId] || {};
    const query = safeTrim(form.query);

    if (!query) {
      showToast("error", "Validation", "Entrez un texte pour rechercher un candidat.");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch(
        `${API_BASE_URL}/admin/participants?q=${encodeURIComponent(query)}&limit=10`,
        { credentials: "include" }
      );

      const data = await res.json().catch(() => []);

      if (!res.ok) {
        showToast("error", "Recherche impossible", data?.message || "Impossible de rechercher les candidats.");
        return;
      }

      const results = Array.isArray(data) ? data : [];

      setMemberForms((prev) => ({
        ...prev,
        [equipeId]: {
          ...(prev[equipeId] || {}),
          results,
          participantId: results[0] ? String(results[0].id) : "",
        },
      }));

      if (results.length === 0) {
        showToast("info", "Aucun resultat", "Aucun participant trouve avec cette recherche.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function addMember(equipeId) {
    const participantId = Number(memberForms[equipeId]?.participantId);

    if (!Number.isInteger(participantId) || participantId <= 0) {
      showToast("error", "Validation", "Selectionnez un candidat valide.");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/equipes/${equipeId}/membres`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ participant_id: participantId }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        showToast("error", "Ajout refuse", data?.message || "Impossible d'ajouter ce candidat.");
        return;
      }

      showToast("success", "Joueur ajoute", "Participant ajoute a l'equipe.");
      setOpenAddFormEquipeId(null);

      setMemberForms((prev) => ({
        ...prev,
        [equipeId]: {
          ...(prev[equipeId] || {}),
          query: "",
          results: [],
          participantId: "",
        },
      }));

      await loadEquipes();
    } finally {
      setBusy(false);
    }
  }

  async function addNewMember(equipeId) {
    const form = memberForms[equipeId] || {};
    const prenom = safeTrim(form.newPrenom);
    const nom = safeTrim(form.newNom);
    const courriel = safeTrim(form.newCourriel);
    const telephone = safeTrim(form.newTelephone);

    if (!prenom || !nom || !courriel) {
      showToast("error", "Validation", "Prenom, nom et courriel sont requis.");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/equipes/${equipeId}/membres/nouveau`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ prenom, nom, courriel, telephone }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        showToast("error", "Ajout refuse", data?.message || "Impossible d'ajouter ce nouveau candidat.");
        return;
      }

      showToast("success", "Joueur ajoute", "Nouveau participant cree et ajoute a l'equipe.");
      setOpenAddFormEquipeId(null);

      setMemberForms((prev) => ({
        ...prev,
        [equipeId]: {
          ...(prev[equipeId] || {}),
          newPrenom: "",
          newNom: "",
          newCourriel: "",
          newTelephone: "",
        },
      }));

      await loadEquipes();
    } finally {
      setBusy(false);
    }
  }

  async function removeMember(equipeId, memberId) {
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/equipes/${equipeId}/membres/${memberId}`, {
        method: "DELETE",
        credentials: "include",
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        showToast("error", "Suppression refusee", data?.message || "Impossible de retirer ce joueur.");
        return false;
      }

      showToast("success", "Joueur retire", "Participant retire de l'equipe.");

      /**
       * Important :
       * on recharge toutes les donnees apres suppression
       * pour forcer la mise a jour du compteur frontend.
       */
      await reloadPageData();
      return true;
    } finally {
      setBusy(false);
    }
  }

  async function confirmRemoveMember() {
    if (!removeMemberTarget) return;

    const success = await removeMember(removeMemberTarget.equipeId, removeMemberTarget.memberId);

    if (success) {
      setRemoveMemberTarget(null);
    }
  }

  function canDropJoueurOnEquipe(equipe) {
    if (!dragJoueurCmd) return false;
    if (Number(equipe.tournoi_id) !== Number(dragJoueurCmd.tournoi_id)) return false;

    const members = equipe.membres || [];

    if (members.length < TEAM_SIZE) return true;

    const pid = dragJoueurCmd.participantId;
    if (pid != null && members.some((m) => Number(m.id) === Number(pid))) return true;

    return false;
  }

  function canDropParticipantOnEquipe(equipe) {
    if (!dragParticipant) return false;
    if (Number(equipe.tournoi_id) !== Number(dragParticipant.tournoi_id)) return false;
    if (Number(equipe.id) === Number(dragParticipant.equipe_source_id)) return true;

    const members = equipe.membres || [];
    return members.length < TEAM_SIZE;
  }

  function handleDragStartJoueur(e, row) {
    const payload = {
      id: row.joueur_commandite_id,
      tournoi_id: row.tournoi_id,
      participantId: row.joueur_participant_id ?? null,
      label: `${row.joueur_prenom || ""} ${row.joueur_nom || ""}`.trim(),
    };

    setDragJoueurCmd(payload);

    try {
      e.dataTransfer.setData("application/x-joueur-commandite-id", String(row.joueur_commandite_id));
      e.dataTransfer.setData("text/plain", String(row.joueur_commandite_id));
      e.dataTransfer.effectAllowed = "move";
    } catch {
      // noop
    }
  }

  function handleDragEndJoueur() {
    setDragJoueurCmd(null);
    setDropHighlightEquipeId(null);
  }

  function handleDragStartParticipant(e, equipe, member) {
    const payload = {
      participant_id: member.id,
      equipe_source_id: equipe.id,
      tournoi_id: equipe.tournoi_id,
      label: `${member.prenom || ""} ${member.nom || ""}`.trim() || `#${member.id}`,
    };

    setDragParticipant(payload);

    try {
      e.dataTransfer.setData("application/x-participant-id", String(member.id));
      e.dataTransfer.effectAllowed = "move";
    } catch {
      // noop
    }
  }

  function handleDragEndParticipant() {
    setDragParticipant(null);
    setDropHighlightEquipeId(null);
  }

  function handleDragOverEquipe(e, equipe) {
    const canDropCmd = canDropJoueurOnEquipe(equipe);
    const canDropMember = canDropParticipantOnEquipe(equipe);

    if (!canDropCmd && !canDropMember) {
      e.dataTransfer.dropEffect = "none";
      return;
    }

    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDropHighlightEquipeId(equipe.id);
  }

  function handleDragLeaveEquipe(equipe, e) {
    if (dropHighlightEquipeId === equipe.id) {
      const next = e.relatedTarget;
      if (next && e.currentTarget.contains(next)) return;
      setDropHighlightEquipeId(null);
    }
  }

  function handleDragPageAutoScroll(e) {
    if (!dragParticipant && !dragJoueurCmd) return;

    const y = e.clientY;
    const zone = 110;
    let delta = 0;

    if (y < zone) delta = -16;
    else if (y > window.innerHeight - zone) delta = 16;

    if (delta !== 0) window.scrollBy(0, delta);
  }

  async function handleDropOnEquipe(e, equipeId) {
    e.preventDefault();
    setDropHighlightEquipeId(null);

    const jcId = dragJoueurCmd?.id;
    if (!jcId) return;

    setBusy(true);
    try {
      const res = await fetch(
        `${API_BASE_URL}/admin/joueurs-commandites/${jcId}/assigner-equipe`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ equipe_id: equipeId }),
        }
      );

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        showToast("error", "Affectation", data?.message || "Impossible d'affecter ce joueur a l'equipe.");
        return;
      }

      showToast("success", "Affectation", data?.message || "Joueur place dans l'equipe.");
      setDragJoueurCmd(null);

      await reloadPageData();
    } finally {
      setBusy(false);
    }
  }

  async function handleDropParticipantOnEquipe(e, equipeId) {
    e.preventDefault();
    setDropHighlightEquipeId(null);

    if (!dragParticipant?.participant_id || !dragParticipant?.equipe_source_id) return;

    if (Number(equipeId) === Number(dragParticipant.equipe_source_id)) {
      setDragParticipant(null);
      return;
    }

    setBusy(true);
    try {
      const res = await fetch(
        `${API_BASE_URL}/admin/equipes/${dragParticipant.equipe_source_id}/membres/${dragParticipant.participant_id}/deplacer`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ equipe_cible_id: equipeId }),
        }
      );

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        showToast("error", "Déplacement", data?.message || "Impossible de déplacer ce participant.");
        return;
      }

      showToast("success", "Déplacement", data?.message || "Participant déplacé vers la nouvelle équipe.");
      setDragParticipant(null);
      await loadEquipes();
    } finally {
      setBusy(false);
    }
  }

  async function saveEditParticipant(ev) {
    ev.preventDefault();

    if (!editParticipant?.id) return;

    const prenom = safeTrim(editParticipant.prenom);
    const nom = safeTrim(editParticipant.nom);
    const courriel = safeTrim(editParticipant.courriel);
    const telephone = safeTrim(editParticipant.telephone);

    if (!prenom || !nom || !courriel) {
      showToast("error", "Validation", "Prénom, nom et courriel sont requis.");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/participants/${editParticipant.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prenom, nom, courriel, telephone }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        showToast("error", "Modification", data?.message || "Impossible de modifier ce participant.");
        return;
      }

      showToast("success", "Participant", "Informations mises à jour.");
      setEditParticipant(null);
      await loadEquipes();
    } finally {
      setBusy(false);
    }
  }

  async function saveEditJoueurCmd(ev) {
    ev.preventDefault();

    if (!editJoueurCmd?.id) return;

    const prenom = safeTrim(editJoueurCmd.prenom);
    const nom = safeTrim(editJoueurCmd.nom);

    if (!prenom || !nom) {
      showToast("error", "Validation", "Prenom et nom sont requis.");
      return;
    }

    setBusy(true);

























    
























    try {
      const res = await fetch(`${API_BASE_URL}/admin/joueurs-commandites/${editJoueurCmd.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prenom, nom }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast("error", "Modification", data?.message || "Impossible de modifier ce joueur.");
        return;
      }
      showToast("success", "Joueur", "Informations mises a jour.");
      setEditJoueurCmd(null);
      await loadJoueursCommandites();
      await loadEquipes();
    } finally {
      setBusy(false);
    }
  }

  async function confirmDeleteJoueurCmd() {
    if (!deleteJoueurCmd?.id) return;
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/joueurs-commandites/${deleteJoueurCmd.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast("error", "Suppression", data?.message || "Impossible de supprimer ce joueur.");
        return;
      }
      showToast("success", "Suppression", "Joueur commandite retire de la liste.");
      setDeleteJoueurCmd(null);
      await loadJoueursCommandites();
      await loadEquipes();
    } finally {
      setBusy(false);
    }
  }

  async function addEquipe(e) {
    e.preventDefault();
    const name = safeTrim(newTeamName);
    const tournoiId = Number(newTeamTournoiId);
    if (!name) {
      showToast("error", "Validation", "Entrez un nom d'equipe.");
      return;
    }
    if (!Number.isInteger(tournoiId) || tournoiId <= 0) {
      showToast("error", "Validation", "Selectionnez un tournoi valide.");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/equipes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ nom_equipe: name, tournoi_id: tournoiId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast("error", "Creation refusee", data?.message || "Impossible de creer l'equipe.");
        return;
      }
      setNewTeamName("");
      setCreateOpen(false);
      showToast("success", "Equipe ajoutee", "Equipe creee avec succes.");
      await loadEquipes();
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget?.id) return;
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/equipes/${deleteTarget.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast("error", "Suppression refusee", data?.message || "Impossible de supprimer l'equipe.");
        return;
      }
      showToast("success", "Equipe supprimee", "Equipe supprimee avec succes.");
      setDeleteTarget(null);
      await loadEquipes();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="equipesPage equipesPage--split" onDragOverCapture={handleDragPageAutoScroll}>
      <header className="equipesHeader">
        <div>
          <h1 className="equipesTitle">Gestion des equipes</h1>
          <p className="equipesSub">Equipes des tournois ouverts aux inscriptions</p>
        </div>
        <button type="button" className="equipesCreateBtn" onClick={() => setCreateOpen(true)} disabled={busy || loading}>
          <PlusIcon /> Creer une equipe
        </button>
      </header>

      <div className="equipesPageLayout">
        <div className="equipesMain">
          <div className="equipesSearchWrap">
            <SearchIcon />
            <input
              className="equipesSearchInput"
              placeholder="Rechercher par nom ou code d'equipe..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              disabled={busy || loading}
            />
          </div>

          {loading ? (
            <div className="panel"><p>Chargement...</p></div>
          ) : filteredEquipes.length === 0 ? (
            <div className="panel"><p style={{ color: "var(--muted)" }}>Aucune equipe trouvee.</p></div>
          ) : (
            <div className="equipesCards">
          {filteredEquipes.map((equipe) => {
            const members = equipe.membres || [];
            const slotsLeft = Math.max(0, TEAM_SIZE - members.length);
            const isEditing = editingId === equipe.id;
            const form = memberForms[equipe.id] || {
              query: "",
              results: [],
              participantId: "",
              newPrenom: "",
              newNom: "",
              newCourriel: "",
              newTelephone: "",
            };

            const dropActive =
              dropHighlightEquipeId === equipe.id &&
              (canDropJoueurOnEquipe(equipe) || canDropParticipantOnEquipe(equipe));

            return (
              <article
                key={equipe.id}
                className={`equipeCard${dropActive ? " equipeCard--dropTarget" : ""}`}
                onDragOver={(e) => handleDragOverEquipe(e, equipe)}
                onDragLeave={(e) => handleDragLeaveEquipe(equipe)}
                onDrop={(e) => {
                  if (dragParticipant && canDropParticipantOnEquipe(equipe)) {
                    handleDropParticipantOnEquipe(e, equipe.id);
                    return;
                  }
                  if (dragJoueurCmd && canDropJoueurOnEquipe(equipe)) {
                    handleDropOnEquipe(e, equipe.id);
                  }
                }}
              >
                <div className="equipeCardHead">
                  <div className="equipeCardHeadLeft">
                    {isEditing ? (
                      <div className="equipeEditRow">
                        <input className="input" value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} />
                        <button type="button" className="btnGhost" onClick={() => saveEdit(equipe.id)} disabled={busy}>
                          OK
                        </button>
                        <button type="button" className="btnGhost" onClick={() => setEditingId(null)} disabled={busy}>
                          Annuler
                        </button>
                      </div>
                    ) : (
                      <h2 className="equipeName">{equipe.nom_equipe}</h2>
                    )}
                    <div className="equipeMeta">
                      <span>Code: <strong>{equipe.code_secret || `EQ${equipe.id}`}</strong></span>
                      <span>Creee le {formatDate(equipe.date_creation)}</span>
                    </div>
                  </div>
                  <div className="equipeCardHeadRight">
                    <span className="equipeBadge">{members.length} / {TEAM_SIZE} joueurs</span>
                    {!isEditing && (
                      <button type="button" className="equipeIconBtn" onClick={() => startEdit(equipe)} disabled={busy} aria-label="Modifier l'equipe">
                        <EditIcon />
                      </button>
                    )}
                    <button
                      type="button"
                      className="equipeIconBtn equipeIconBtn--danger"
                      onClick={() => setDeleteTarget({ id: equipe.id, nom_equipe: equipe.nom_equipe })}
                      disabled={busy}
                      aria-label="Supprimer l'equipe"
                    >
                      <TrashIcon />
                    </button>
                  </div>
                </div>

                <div className="equipeMembersGrid">
                  {members.map((m) => (
                    <div
                      key={m.id}
                      className="memberCard"
                      draggable={!busy}
                      onDragStart={(e) => handleDragStartParticipant(e, equipe, m)}
                      onDragEnd={handleDragEndParticipant}
                    >
                      <div className="memberTop">
                        <span className="memberAvatar"><UserIcon /></span>
                        <div>
                          <div className="memberName">{m.prenom} {m.nom}</div>
                          <div className="memberType">{participantTypeLabel(m)}</div>
                        </div>
                      </div>
                      <div className="memberInfoLine"><MailIcon /> {m.courriel || "N/A"}</div>
                      <div className="memberInfoLine"><PhoneIcon /> {m.telephone || "N/A"}</div>
                      <div className="memberActions">
                        <button
                          type="button"
                          className="memberActionBtn memberActionBtn--edit"
                          onClick={() =>
                            setEditParticipant({
                              id: m.id,
                              prenom: m.prenom || "",
                              nom: m.nom || "",
                              courriel: m.courriel || "",
                              telephone: m.telephone || "",
                            })
                          }
                          disabled={busy}
                          aria-label="Modifier le participant"
                          title="Modifier le participant"
                        >
                          <EditIcon />
                        </button>
                        <button
                          type="button"
                          className="memberActionBtn memberActionBtn--delete"
                          onClick={() =>
                            setRemoveMemberTarget({
                              equipeId: equipe.id,
                              memberId: m.id,
                              memberLabel: `${m.prenom || ""} ${m.nom || ""}`.trim() || `#${m.id}`,
                            })
                          }
                          disabled={busy}
                          aria-label="Retirer le participant"
                          title="Retirer le participant"
                        >
                          <TrashIcon />
                        </button>
                      </div>
                    </div>
                  ))}

                  {Array.from({ length: slotsLeft }).map((_, i) => (
                    <div key={`slot-${equipe.id}-${i}`} className="slotCard">
                      <button
                        type="button"
                        className="slotCircle"
                        onClick={() => setOpenAddFormEquipeId(equipe.id)}
                        disabled={busy}
                        aria-label="Ajouter un participant"
                      >
                        <PlusIcon />
                      </button>
                      <span>Place disponible</span>
                    </div>
                  ))}
                </div>

                {slotsLeft > 0 && (
                  <>
                    <div className="equipeNote">
                      <strong>Note:</strong> Cette equipe peut encore accueillir {slotsLeft} joueur{slotsLeft > 1 ? "s" : ""}.
                      Partagez le code <strong>{equipe.code_secret || `EQ${equipe.id}`}</strong> pour permettre a d'autres de rejoindre.
                    </div>
                  </>
                )}
              </article>
            );
          })}
            </div>
          )}
        </div>

        <aside className="joueursCmdAside" aria-label="Joueurs commanditaires en attente">
          <section className="joueursCmdSection equipeCard" aria-labelledby="joueurs-cmd-title">
            <div className="joueursCmdHead joueursCmdHead--aside">
              <h2 id="joueurs-cmd-title" className="joueursCmdTitle">
                Joueurs commanditaires
              </h2>
              <div className="joueursCmdToolbar">
                <label className="joueursCmdFilterLabel" htmlFor="filtre-tournoi-cmd">
                  Tournoi
                </label>
                <select
                  id="filtre-tournoi-cmd"
                  className="input joueursCmdSelect"
                  value={joueursCmdTournoiFilter}
                  onChange={(e) => setJoueursCmdTournoiFilter(e.target.value)}
                  disabled={busy || loadingJoueursCmd || tournois.length === 0}
                >
                  {tournois.length === 0 ? (
                    <option value="">Aucun tournoi ouvert</option>
                  ) : (
                    tournois.map((t) => (
                      <option key={t.id} value={String(t.id)}>
                        {t.nom} (#{t.id})
                      </option>
                    ))
                  )}
                </select>
                <button
                  type="button"
                  className="btnGhost joueursCmdRefresh"
                  onClick={() => loadJoueursCommandites()}
                  disabled={busy || loadingJoueursCmd}
                >
                  Rafraichir
                </button>
              </div>
            </div>

            {loadingJoueursCmd ? (
              <p className="joueursCmdEmpty">Chargement...</p>
            ) : joueursCommandites.length === 0 ? (
              <p className="joueursCmdEmpty">Aucun joueur commanditaire en attente d'affectation pour ce tournoi.</p>
            ) : (
              <div className="joueursCmdTableWrap">
                <table className="joueursCmdTable">
                  <thead>
                    <tr>
                      <th style={{ width: 36 }} aria-label="Glisser" />
                      <th>Tournoi</th>
                      <th>Joueur</th>
                      <th>Equipe</th>
                      <th>Forfait</th>
                      <th>Entreprise</th>
                      <th>Contact</th>
                      <th>Statut commandite</th>
                      <th style={{ textAlign: "right" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {joueursCommandites.map((row) => {
                      const dragging =
                        dragJoueurCmd && Number(dragJoueurCmd.id) === Number(row.joueur_commandite_id);
                      return (
                        <tr
                          key={row.joueur_commandite_id}
                          className={dragging ? "joueursCmdRow--dragging" : undefined}
                          draggable={!busy}
                          onDragStart={(e) => handleDragStartJoueur(e, row)}
                          onDragEnd={handleDragEndJoueur}
                        >
                          <td>
                            <span
                              className="joueursCmdDragHandle"
                              title="Glisser vers une equipe du meme tournoi"
                              aria-hidden
                            >
                              <GripIcon />
                            </span>
                          </td>
                          <td>
                            <span className="joueursCmdCellStrong">{row.tournoi_nom || "—"}</span>
                            <span className="joueursCmdMuted"> #{row.tournoi_id}</span>
                          </td>
                          <td>
                            <span className="joueursCmdCellStrong">
                              {row.joueur_prenom} {row.joueur_nom}
                            </span>
                            {row.ordre != null ? (
                              <span className="joueursCmdMuted"> (place {Number(row.ordre)})</span>
                            ) : null}
                          </td>
                          <td>
                            {row.equipe_id ? (
                              <>
                                <span className="joueursCmdCellStrong">{row.equipe_nom || "Equipe"}</span>
                                <div className="joueursCmdMuted">
                                  #{row.equipe_id}
                                  {row.equipe_code_secret ? ` · code ${row.equipe_code_secret}` : ""}
                                </div>
                              </>
                            ) : (
                              <span className="joueursCmdMuted">Non affecte</span>
                            )}
                          </td>
                          <td>{row.type_commandite_nom || "—"}</td>
                          <td>
                            <div className="joueursCmdCellStrong">{row.nom_entreprise || "—"}</div>
                            <div className="joueursCmdMuted">Cmd. #{row.commandite_id}</div>
                          </td>
                          <td>
                            <div className="joueursCmdContactLine">
                              <MailIcon /> {row.courriel_contact || "—"}
                            </div>
                            <div className="joueursCmdContactLine">
                              <UserIcon /> {row.nom_contact || "—"}
                            </div>
                            {row.telephone_contact ? (
                              <div className="joueursCmdContactLine">
                                <PhoneIcon /> {row.telephone_contact}
                              </div>
                            ) : null}
                          </td>
                          <td>
                            <span className="joueursCmdStatut">{commanditeStatutLabel(row.commandite_statut)}</span>
                          </td>
                          <td>
                            <div className="cmdRowActions">
                              <button
                                type="button"
                                className="cmdIconBtn cmdIconBtn--edit"
                                disabled={busy}
                                title="Modifier le joueur"
                                aria-label="Modifier le joueur commandite"
                                onClick={() =>
                                  setEditJoueurCmd({
                                    id: row.joueur_commandite_id,
                                    prenom: row.joueur_prenom || "",
                                    nom: row.joueur_nom || "",
                                  })
                                }
                              >
                                <EditIcon />
                              </button>
                              <button
                                type="button"
                                className="cmdIconBtn cmdIconBtn--delete"
                                disabled={busy}
                                title="Supprimer ce joueur de la liste"
                                aria-label="Supprimer le joueur commandite"
                                onClick={() =>
                                  setDeleteJoueurCmd({
                                    id: row.joueur_commandite_id,
                                    label: `${row.joueur_prenom || ""} ${row.joueur_nom || ""}`.trim(),
                                  })
                                }
                              >
                                <TrashIcon />
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
          </section>
        </aside>
      </div>

      {createOpen && (
        <div className="modalBackdrop">
          <div className="modal">
            <div className="modalHead">
              <div className="modalTitle">Creer une equipe</div>
              <button type="button" className="modalClose" onClick={() => setCreateOpen(false)} disabled={busy}>x</button>
            </div>
            <form className="adminForm" onSubmit={addEquipe}>
              <div className="field">
                <label className="label">Tournoi</label>
                <select
                  className="input"
                  value={newTeamTournoiId}
                  onChange={(e) => setNewTeamTournoiId(e.target.value)}
                  disabled={busy || tournois.length === 0}
                >
                  <option value="">-- Choisir un tournoi --</option>
                  {tournois.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nom} (#{t.id})
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label className="label">Nom de l'equipe</label>
                <input
                  className="input"
                  placeholder="Ex: Les Birdies"
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  disabled={busy}
                />
              </div>
              <div className="modalActions">
                <button type="button" className="btnGhost" onClick={() => setCreateOpen(false)} disabled={busy}>Annuler</button>
                <button type="submit" className="btnPrimary" style={{ width: "auto" }} disabled={busy}>
                  {busy ? "Creation..." : "Creer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {openAddFormEquipeId && (
        <div className="modalBackdrop">
          <div className="modal">
            <div className="modalHead">
              <div className="modalTitle">Ajouter un participant</div>
              <button type="button" className="modalClose" onClick={() => setOpenAddFormEquipeId(null)} disabled={busy}>x</button>
            </div>

            <div className="adminForm">
              <div className="field">
                <label className="label">Ajouter un candidat existant</label>
                <div style={{ display: "grid", gridTemplateColumns: "1.1fr auto", gap: 8 }}>
                  <input
                    className="input"
                    placeholder="Rechercher (nom, prenom, courriel...)"
                    value={memberForms[openAddFormEquipeId]?.query || ""}
                    onChange={(e) => updateMemberForm(openAddFormEquipeId, "query", e.target.value)}
                    disabled={busy}
                  />
                  <button type="button" className="btnGhost" onClick={() => searchParticipantsForEquipe(openAddFormEquipeId)} disabled={busy}>
                    Rechercher
                  </button>
                </div>
              </div>

              {(memberForms[openAddFormEquipeId]?.results || []).length > 0 && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
                  <select
                    className="input"
                    value={memberForms[openAddFormEquipeId]?.participantId || ""}
                    onChange={(e) => updateMemberForm(openAddFormEquipeId, "participantId", e.target.value)}
                    disabled={busy}
                  >
                    <option value="">-- Choisir un candidat --</option>
                    {(memberForms[openAddFormEquipeId]?.results || []).map((p) => (
                      <option key={p.id} value={p.id}>
                        #{p.id} - {p.prenom} {p.nom} ({p.courriel})
                      </option>
                    ))}
                  </select>
                  <button type="button" className="btnPrimary" style={{ width: "auto" }} onClick={() => addMember(openAddFormEquipeId)} disabled={busy}>
                    Ajouter
                  </button>
                </div>
              )}

              <div className="field">
                <label className="label">Ajouter un nouveau candidat</label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1.2fr 1fr auto", gap: 8 }}>
                  <input className="input" placeholder="Prenom" value={memberForms[openAddFormEquipeId]?.newPrenom || ""} onChange={(e) => updateMemberForm(openAddFormEquipeId, "newPrenom", e.target.value)} disabled={busy} />
                  <input className="input" placeholder="Nom" value={memberForms[openAddFormEquipeId]?.newNom || ""} onChange={(e) => updateMemberForm(openAddFormEquipeId, "newNom", e.target.value)} disabled={busy} />
                  <input className="input" placeholder="Courriel" value={memberForms[openAddFormEquipeId]?.newCourriel || ""} onChange={(e) => updateMemberForm(openAddFormEquipeId, "newCourriel", e.target.value)} disabled={busy} />
                  <input className="input" placeholder="Telephone (optionnel)" value={memberForms[openAddFormEquipeId]?.newTelephone || ""} onChange={(e) => updateMemberForm(openAddFormEquipeId, "newTelephone", e.target.value)} disabled={busy} />
                  <button type="button" className="btnPrimary" style={{ width: "auto" }} onClick={() => addNewMember(openAddFormEquipeId)} disabled={busy}>
                    Ajouter
                  </button>
                </div>
              </div>

              <div className="modalActions">
                <button type="button" className="btnGhost" onClick={() => setOpenAddFormEquipeId(null)} disabled={busy}>Fermer</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="modalBackdrop">
          <div className="modal">
            <div className="modalHead">
              <div className="modalTitle">Confirmer la suppression</div>
              <button type="button" className="modalClose" onClick={() => setDeleteTarget(null)} disabled={busy}>x</button>
            </div>
            <p className="modalSub">
              Vous allez supprimer l'equipe <strong>{deleteTarget.nom_equipe}</strong>. Cette action est irreversible.
            </p>
            <div className="modalActions">
              <button type="button" className="btnGhost" onClick={() => setDeleteTarget(null)} disabled={busy}>Annuler</button>
              <button type="button" className="btnDanger" onClick={confirmDelete} disabled={busy}>
                {busy ? "Suppression..." : "Supprimer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {removeMemberTarget && (
        <div className="modalBackdrop">
          <div className="modal">
            <div className="modalHead">
              <div className="modalTitle">Confirmer le retrait</div>
              <button
                type="button"
                className="modalClose"
                onClick={() => setRemoveMemberTarget(null)}
                disabled={busy}
              >
                x
              </button>
            </div>
            <p className="modalSub">
              Vous allez retirer le participant <strong>{removeMemberTarget.memberLabel}</strong> de
              l&apos;equipe. Cette action est irreversible.
            </p>
            <div className="modalActions">
              <button type="button" className="btnGhost" onClick={() => setRemoveMemberTarget(null)} disabled={busy}>
                Annuler
              </button>
              <button type="button" className="btnDanger" onClick={confirmRemoveMember} disabled={busy}>
                {busy ? "Retrait..." : "Confirmer le retrait"}
              </button>
            </div>
          </div>
        </div>
      )}

      {editParticipant && (
        <div className="modalBackdrop">
          <div className="modal">
            <div className="modalHead">
              <div className="modalTitle">Modifier le participant</div>
              <button type="button" className="modalClose" onClick={() => setEditParticipant(null)} disabled={busy}>
                x
              </button>
            </div>
            <form className="adminForm" onSubmit={saveEditParticipant}>
              <div className="field">
                <label className="label" htmlFor="participant-edit-prenom">
                  Prénom
                </label>
                <input
                  id="participant-edit-prenom"
                  className="input"
                  value={editParticipant.prenom}
                  onChange={(e) => setEditParticipant((p) => ({ ...p, prenom: e.target.value }))}
                  disabled={busy}
                />
              </div>
              <div className="field">
                <label className="label" htmlFor="participant-edit-nom">
                  Nom
                </label>
                <input
                  id="participant-edit-nom"
                  className="input"
                  value={editParticipant.nom}
                  onChange={(e) => setEditParticipant((p) => ({ ...p, nom: e.target.value }))}
                  disabled={busy}
                />
              </div>
              <div className="field">
                <label className="label" htmlFor="participant-edit-courriel">
                  Courriel
                </label>
                <input
                  id="participant-edit-courriel"
                  className="input"
                  value={editParticipant.courriel}
                  onChange={(e) => setEditParticipant((p) => ({ ...p, courriel: e.target.value }))}
                  disabled={busy}
                />
              </div>
              <div className="field">
                <label className="label" htmlFor="participant-edit-telephone">
                  Téléphone
                </label>
                <input
                  id="participant-edit-telephone"
                  className="input"
                  value={editParticipant.telephone}
                  onChange={(e) => setEditParticipant((p) => ({ ...p, telephone: e.target.value }))}
                  disabled={busy}
                />
              </div>
              <div className="modalActions">
                <button type="button" className="btnGhost" onClick={() => setEditParticipant(null)} disabled={busy}>
                  Annuler
                </button>
                <button type="submit" className="btnPrimary" style={{ width: "auto" }} disabled={busy}>
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editJoueurCmd && (
        <div className="modalBackdrop">
          <div className="modal">
            <div className="modalHead">
              <div className="modalTitle">Modifier le joueur commandite</div>
              <button type="button" className="modalClose" onClick={() => setEditJoueurCmd(null)} disabled={busy}>
                x
              </button>
            </div>
            <form className="adminForm" onSubmit={saveEditJoueurCmd}>
              <div className="field">
                <label className="label" htmlFor="jc-edit-prenom">
                  Prenom
                </label>
                <input
                  id="jc-edit-prenom"
                  className="input"
                  value={editJoueurCmd.prenom}
                  onChange={(e) => setEditJoueurCmd((p) => ({ ...p, prenom: e.target.value }))}
                  disabled={busy}
                />
              </div>
              <div className="field">
                <label className="label" htmlFor="jc-edit-nom">
                  Nom
                </label>
                <input
                  id="jc-edit-nom"
                  className="input"
                  value={editJoueurCmd.nom}
                  onChange={(e) => setEditJoueurCmd((p) => ({ ...p, nom: e.target.value }))}
                  disabled={busy}
                />
              </div>
              <div className="modalActions">
                <button type="button" className="btnGhost" onClick={() => setEditJoueurCmd(null)} disabled={busy}>
                  Annuler
                </button>
                <button type="submit" className="btnPrimary" style={{ width: "auto" }} disabled={busy}>
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteJoueurCmd && (
        <div className="modalBackdrop">
          <div className="modal">
            <div className="modalHead">
              <div className="modalTitle">Supprimer le joueur commandite ?</div>
              <button type="button" className="modalClose" onClick={() => setDeleteJoueurCmd(null)} disabled={busy}>
                x
              </button>
            </div>
            <p className="modalSub">
              Supprimer <strong>{deleteJoueurCmd.label || "ce joueur"}</strong> de la liste des joueurs commanditaires
              ? S&apos;il etait affecte a une equipe, il sera retire de l&apos;equipe et le participant technique associe
              sera supprime.
            </p>
            <div className="modalActions">
              <button type="button" className="btnGhost" onClick={() => setDeleteJoueurCmd(null)} disabled={busy}>
                Annuler
              </button>
              <button type="button" className="btnDanger" onClick={confirmDeleteJoueurCmd} disabled={busy}>
                {busy ? "Suppression..." : "Supprimer"}
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
          <button type="button" className="floatingToast__close" onClick={() => setToast(null)}>
            Fermer
          </button>
        </div>
      )}
    </div>
  );
}
