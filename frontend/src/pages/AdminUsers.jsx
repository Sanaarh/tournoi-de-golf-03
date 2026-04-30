/**
 * AdminUsers.jsx
 * Gestion des comptes administrateurs via quatre onglets :
 * - Ajout        : POST   /admin/users
 * - Modification : GET    /admin/users + PUT    /admin/users/:id
 * - Suppression  : GET    /admin/users + DELETE /admin/users/:id
 * - Affichage    : GET    /admin/users
 *
 * Contraintes fonctionnelles :
 * - Les opérations s'appuient sur la table "administrateurs".
 * - Les routes /admin/* sont protégées côté backend (cookie httpOnly + requireAdmin).
 *
 * UI / UX :
 * - Onglets côte à côte : l'onglet actif est mis en avant, les autres sont atténués.
 * - Messages d'état (succès / erreur / info) visibles et fermables.
 * - Désactivation des contrôles pendant les appels réseau pour éviter les doublons.
 *
 * Remarques :
 * - La validation de mot de passe côté UI reste un confort utilisateur ;
 *   la validation finale est assurée côté serveur.
 */

import { useEffect, useMemo, useState } from "react";

const API_BASE_URL = "http://localhost:3000";

const TAB = {
  ADD: "ADD",
  EDIT: "EDIT",
  DELETE: "DELETE",
  VIEW: "VIEW",
};

/**
 * Politique mot de passe (UI) :
 * - min 8 caractères
 * - 1 majuscule
 * - 1 chiffre
 * - 1 caractère spécial
 */
function isValidPassword(password) {
  return /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/.test(password);
}

function passwordPolicyText() {
  return "Mot de passe invalide (min 8 caractères, 1 majuscule, 1 chiffre, 1 caractère spécial).";
}

/**
 * Nettoie une chaîne.
 *
 * @param {string} value
 * @returns {string}
 */
function safeTrim(value) {
  return String(value || "").trim();
}

/**
 * Formate une date en texte lisible.
 *
 * @param {string} dateString
 * @returns {string}
 */
function formatDate(dateString) {
  if (!dateString) return "-";

  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleString();
}

/**
 * Retourne une ancienneté lisible à partir de la date de création.
 *
 * @param {string} dateString
 * @returns {string}
 */
function getAccountAge(dateString) {
  if (!dateString) return "-";

  const createdAt = new Date(dateString);

  if (Number.isNaN(createdAt.getTime())) return "-";

  const now = new Date();
  const diffMs = now - createdAt;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) return "Aujourd'hui";
  if (diffDays === 1) return "1 jour";
  if (diffDays < 30) return `${diffDays} jours`;

  const diffMonths = Math.floor(diffDays / 30);

  if (diffMonths === 1) return "1 mois";
  if (diffMonths < 12) return `${diffMonths} mois`;

  const diffYears = Math.floor(diffMonths / 12);

  if (diffYears === 1) return "1 an";

  return `${diffYears} ans`;
}

/**
 * Composant principal de gestion des administrateurs.
 *
 * @returns {JSX.Element}
 */
export default function AdminUsers() {
  const [activeTab, setActiveTab] = useState(TAB.ADD);

  const [admins, setAdmins] = useState([]);
  const [loadingAdmins, setLoadingAdmins] = useState(false);

  const [busy, setBusy] = useState(false);

  /**
   * Message principal à afficher dans la page.
   * type : success | error | info
   */
  const [message, setMessage] = useState(null);

  /**
   * Petit message flottant.
   */
  const [toast, setToast] = useState(null);

  // Ajout
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");

  // Modification
  const [selectedAdminId, setSelectedAdminId] = useState("");
  const [editUsername, setEditUsername] = useState("");
  const [editPassword, setEditPassword] = useState("");

  // Suppression
  const [deleteAdminId, setDeleteAdminId] = useState("");
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

  // Affichage
  const [searchTerm, setSearchTerm] = useState("");

  /**
   * Admin sélectionné pour la modification.
   */
  const selectedAdmin = useMemo(() => {
    const id = Number(selectedAdminId);
    return admins.find((a) => a.id === id) || null;
  }, [admins, selectedAdminId]);

  /**
   * Admin sélectionné pour la suppression.
   */
  const deleteAdmin = useMemo(() => {
    const id = Number(deleteAdminId);
    return admins.find((a) => a.id === id) || null;
  }, [admins, deleteAdminId]);

  /**
   * Liste filtrée pour l'onglet Affichage.
   */
  const filteredAdmins = useMemo(() => {
    const keyword = safeTrim(searchTerm).toLowerCase();

    if (!keyword) return admins;

    return admins.filter((admin) =>
      String(admin.nom_utilisateur || "").toLowerCase().includes(keyword)
    );
  }, [admins, searchTerm]);

  /**
   * Efface le message principal.
   */
  function clearMessage() {
    setMessage(null);
  }

  /**
   * Efface le toast.
   */
  function clearToast() {
    setToast(null);
  }

  /**
   * Affiche un message et un toast en même temps.
   *
   * @param {"success"|"error"|"info"} type
   * @param {string} title
   * @param {string} text
   */
  function showMessage(type, title, text) {
    const nextMessage = { type, title, text };
    setMessage(nextMessage);
    setToast(nextMessage);
  }

  /**
   * Ferme automatiquement le toast après quelques secondes.
   */
  useEffect(() => {
    if (!toast) return undefined;

    const timeoutId = window.setTimeout(() => {
      setToast(null);
    }, 4500);

    return () => window.clearTimeout(timeoutId);
  }, [toast]);

  /**
   * Charge la liste des administrateurs.
   */
  async function loadAdmins() {
    setLoadingAdmins(true);

    try {
      const res = await fetch(`${API_BASE_URL}/admin/users`, {
        credentials: "include",
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setAdmins([]);
        showMessage("error", "Chargement impossible", data?.message || "Accès refusé.");
        return;
      }

      setAdmins(Array.isArray(data) ? data : []);
    } catch (err) {
      setAdmins([]);
      showMessage("error", "Erreur réseau", "Backend non accessible.");
    } finally {
      setLoadingAdmins(false);
    }
  }

  /**
   * Gestion des changements d'onglet :
   * - nettoyage des champs
   * - chargement des admins si nécessaire
   */
  useEffect(() => {
    clearMessage();

    if (activeTab !== TAB.ADD) {
      setNewUsername("");
      setNewPassword("");
    }

    if (activeTab !== TAB.EDIT) {
      setSelectedAdminId("");
      setEditUsername("");
      setEditPassword("");
    }

    if (activeTab !== TAB.DELETE) {
      setDeleteAdminId("");
      setIsDeleteConfirmOpen(false);
    }

    if (activeTab !== TAB.VIEW) {
      setSearchTerm("");
    }

    if (
      activeTab === TAB.EDIT ||
      activeTab === TAB.DELETE ||
      activeTab === TAB.VIEW
    ) {
      loadAdmins();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  /**
   * Pré-remplit le champ username quand on choisit un admin à modifier.
   */
  useEffect(() => {
    if (!selectedAdmin) {
      setEditUsername("");
      setEditPassword("");
      return;
    }

    setEditUsername(selectedAdmin.nom_utilisateur);
    setEditPassword("");
  }, [selectedAdmin]);

  /**
   * Ajoute un administrateur.
   *
   * @param {React.FormEvent<HTMLFormElement>} e
   */
  async function handleAddAdmin(e) {
    e.preventDefault();
    clearMessage();

    const nom_utilisateur = safeTrim(newUsername);
    const mot_de_passe = String(newPassword || "");

    if (!nom_utilisateur || !mot_de_passe) {
      showMessage(
        "error",
        "Champs manquants",
        "Veuillez remplir le nom d'utilisateur et le mot de passe."
      );
      return;
    }

    if (!isValidPassword(mot_de_passe)) {
      showMessage("error", "Mot de passe", passwordPolicyText());
      return;
    }

    setBusy(true);

    try {
      const res = await fetch(`${API_BASE_URL}/admin/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ nom_utilisateur, mot_de_passe }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        showMessage("error", "Ajout refusé", data?.message || "Ajout impossible.");
        return;
      }

      showMessage(
        "success",
        "Ajout effectué",
        `Le compte "${data.nom_utilisateur}" a été créé.`
      );

      setNewUsername("");
      setNewPassword("");

      await loadAdmins();
    } catch (err) {
      showMessage("error", "Erreur réseau", "Backend non accessible.");
    } finally {
      setBusy(false);
    }
  }

  /**
   * Met à jour un administrateur.
   *
   * @param {React.FormEvent<HTMLFormElement>} e
   */
  async function handleUpdateAdmin(e) {
    e.preventDefault();
    clearMessage();

    if (!selectedAdmin) {
      showMessage("error", "Sélection requise", "Veuillez sélectionner un administrateur.");
      return;
    }

    const nom_utilisateur = safeTrim(editUsername);
    const mot_de_passe = String(editPassword || "");

    if (!nom_utilisateur && !mot_de_passe) {
      showMessage("error", "Aucune modification", "Veuillez modifier au moins un champ.");
      return;
    }

    if (mot_de_passe && !isValidPassword(mot_de_passe)) {
      showMessage("error", "Mot de passe", passwordPolicyText());
      return;
    }

    const payload = {};
    if (nom_utilisateur) payload.nom_utilisateur = nom_utilisateur;
    if (mot_de_passe) payload.mot_de_passe = mot_de_passe;

    setBusy(true);

    try {
      const res = await fetch(`${API_BASE_URL}/admin/users/${selectedAdmin.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        showMessage(
          "error",
          "Modification refusée",
          data?.message || "Modification impossible."
        );
        return;
      }

      showMessage(
        "success",
        "Modification effectuée",
        `Le compte "${data.nom_utilisateur}" a été mis à jour.`
      );

      setEditPassword("");
      await loadAdmins();
    } catch (err) {
      showMessage("error", "Erreur réseau", "Backend non accessible.");
    } finally {
      setBusy(false);
    }
  }

  /**
   * Supprime l'administrateur sélectionné.
   */
  async function handleDeleteSelected() {
    clearMessage();

    if (!deleteAdmin) {
      showMessage(
        "error",
        "Sélection requise",
        "Veuillez sélectionner un administrateur à supprimer."
      );
      return;
    }

    setBusy(true);

    try {
      const res = await fetch(`${API_BASE_URL}/admin/users/${deleteAdmin.id}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        showMessage("error", "Suppression refusée", data?.message || "Suppression impossible.");
        return;
      }

      showMessage(
        "success",
        "Suppression effectuée",
        `Le compte "${deleteAdmin.nom_utilisateur}" a été supprimé.`
      );

      setDeleteAdminId("");
      setIsDeleteConfirmOpen(false);
      await loadAdmins();
    } catch (err) {
      showMessage("error", "Erreur réseau", "Backend non accessible.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="pageHeader">
        <div className="adminUsersHeaderLeft">
          <h1 className="adminUsersTitle">Gérer les comptes admin</h1>
          <p className="adminUsersSubtitle">
            Ajout, modification, suppression et affichage des administrateurs.
          </p>
        </div>
      </div>

      <div className="adminTabs">
        <button
          type="button"
          className={`adminTab ${activeTab === TAB.ADD ? "adminTab--active" : ""}`}
          onClick={() => setActiveTab(TAB.ADD)}
          disabled={busy}
          aria-pressed={activeTab === TAB.ADD}
        >
          Ajout
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
          className={`adminTab ${activeTab === TAB.DELETE ? "adminTab--active" : ""}`}
          onClick={() => setActiveTab(TAB.DELETE)}
          disabled={busy}
          aria-pressed={activeTab === TAB.DELETE}
        >
          Suppression
        </button>

        <button
          type="button"
          className={`adminTab ${activeTab === TAB.VIEW ? "adminTab--active" : ""}`}
          onClick={() => setActiveTab(TAB.VIEW)}
          disabled={busy}
          aria-pressed={activeTab === TAB.VIEW}
        >
          Affichage
        </button>

        <div className="adminTabsSpacer" />

        <button
          type="button"
          className="btnGhost"
          onClick={loadAdmins}
          disabled={busy || loadingAdmins}
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

      {activeTab === TAB.ADD && (
        <div className="panel">
          <h2 style={{ marginBottom: 18 }}>Ajouter un administrateur</h2>

          <form className="adminForm" onSubmit={handleAddAdmin} autoComplete="off">
            <div className="field">
              <label className="label">Nom d'utilisateur</label>
              <input
                className="input"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                autoComplete="off"
                disabled={busy}
              />
            </div>

            <div className="field">
              <label className="label">Mot de passe</label>
              <input
                className="input"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                disabled={busy}
              />
              <div className="hintText">
                Règle : 8 caractères minimum, 1 majuscule, 1 chiffre, 1 caractère spécial.
              </div>
            </div>

            <button className="btnPrimary" type="submit" disabled={busy}>
              Enregistrer
            </button>
          </form>
        </div>
      )}

      {activeTab === TAB.EDIT && (
        <>
          <div className="panel">
            <h2>Modifier un administrateur</h2>

            {loadingAdmins ? (
              <p>Chargement...</p>
            ) : admins.length === 0 ? (
              <p className="muted" style={{ color: "var(--muted)" }}>
                Aucun administrateur disponible.
              </p>
            ) : (
              <div className="field">
                <label className="label">Sélectionner un administrateur</label>
                <select
                  className="input"
                  value={selectedAdminId}
                  onChange={(e) => setSelectedAdminId(e.target.value)}
                  disabled={busy}
                >
                  <option value="">-- Choisir --</option>
                  {admins.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.nom_utilisateur} (#{a.id})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="panel">
            <h2>Détails</h2>

            {!selectedAdmin ? (
              <p style={{ color: "var(--muted)" }}>
                Sélectionnez un administrateur pour afficher les champs.
              </p>
            ) : (
              <form className="adminForm" onSubmit={handleUpdateAdmin} autoComplete="off">
                <div className="field">
                  <label className="label">Nom d'utilisateur</label>
                  <input
                    className="input"
                    value={editUsername}
                    onChange={(e) => setEditUsername(e.target.value)}
                    autoComplete="off"
                    disabled={busy}
                  />
                </div>

                <div className="field">
                  <label className="label">Nouveau mot de passe (optionnel)</label>
                  <input
                    className="input"
                    type="password"
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                    autoComplete="new-password"
                    disabled={busy}
                  />
                  <div className="hintText">
                    Règle : 8 caractères minimum, 1 majuscule, 1 chiffre, 1 caractère spécial.
                  </div>
                </div>

                <button className="btnPrimary" type="submit" disabled={busy}>
                  Enregistrer les modifications
                </button>
              </form>
            )}
          </div>
        </>
      )}

      {activeTab === TAB.DELETE && (
        <div className="panel">
          <h2>Supprimer un administrateur</h2>
          <p style={{ color: "var(--muted)", marginBottom: 16 }}>
            La suppression est définitive.
          </p>

          {loadingAdmins ? (
            <p>Chargement...</p>
          ) : admins.length === 0 ? (
            <p className="muted">Aucun administrateur disponible.</p>
          ) : (
            <>
              <div className="field">
                <label className="label">Sélectionner un administrateur</label>
                <select
                  className="input"
                  value={deleteAdminId}
                  onChange={(e) => setDeleteAdminId(e.target.value)}
                  disabled={busy}
                >
                  <option value="">-- Choisir --</option>
                  {admins.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.nom_utilisateur} (#{a.id})
                    </option>
                  ))}
                </select>
              </div>

              <div className="deleteRow">
                <div className="deleteInfo">
                  {deleteAdmin ? (
                    <>
                      <div className="deleteName">{deleteAdmin.nom_utilisateur}</div>
                      <div style={{ color: "var(--muted)", fontSize: 13 }}>
                        Créé le {formatDate(deleteAdmin.date_creation)}
                      </div>
                    </>
                  ) : (
                    <div style={{ color: "var(--muted)" }}>
                      Sélectionnez un compte à supprimer.
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  className="btnDanger"
                  onClick={() => setIsDeleteConfirmOpen(true)}
                  disabled={busy || !deleteAdmin}
                >
                  Supprimer
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {activeTab === TAB.VIEW && (
        <div className="panel">
          <div className="adminViewTop">
            <div>
              <h2>Liste des administrateurs</h2>
              <p className="adminViewSubtitle">
                Visualisez les comptes administrateurs enregistrés dans le système.
              </p>
            </div>

            <div className="adminStatsCard">
              <div className="adminStatsValue">{admins.length}</div>
              <div className="adminStatsLabel">Administrateur(s)</div>
            </div>
          </div>

          <div className="adminViewToolbar">
            <div className="field adminSearchField">
              <label className="label">Rechercher</label>
              <input
                className="input"
                type="text"
                placeholder="Rechercher par nom d'utilisateur..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                disabled={busy}
              />
            </div>

            <button
              type="button"
              className="btnGhost"
              onClick={loadAdmins}
              disabled={busy || loadingAdmins}
            >
              {loadingAdmins ? "Chargement..." : "Actualiser la liste"}
            </button>
          </div>

          {loadingAdmins ? (
            <p>Chargement...</p>
          ) : filteredAdmins.length === 0 ? (
            <div className="emptyStateBox">
              <div className="emptyStateTitle">Aucun résultat</div>
              <div className="emptyStateText">
                Aucun administrateur ne correspond à votre recherche.
              </div>
            </div>
          ) : (
            <div className="adminTableWrapper">
              <table className="adminTable">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Administrateur</th>
                    <th>Date de création</th>
                    <th>Ancienneté</th>
                    <th>Statut</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredAdmins.map((admin) => (
                    <tr key={admin.id}>
                      <td>
                        <span className="adminIdBadge">#{admin.id}</span>
                      </td>

                      <td>
                        <div className="adminUserCell">
                          <div className="adminAvatar">
                            {String(admin.nom_utilisateur || "?").charAt(0).toUpperCase()}
                          </div>

                          <div>
                            <div className="adminUserName">{admin.nom_utilisateur}</div>
                            <div className="adminUserSubtext">Compte administrateur</div>
                          </div>
                        </div>
                      </td>

                      <td>{formatDate(admin.date_creation)}</td>
                      <td>{getAccountAge(admin.date_creation)}</td>

                      <td>
                        <span className="statusBadge statusBadge--active">Actif</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {isDeleteConfirmOpen && deleteAdmin && (
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
              Vous allez supprimer le compte <strong>{deleteAdmin.nom_utilisateur}</strong>. Cette
              action est irreversible.
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
                onClick={handleDeleteSelected}
                disabled={busy}
              >
                {busy ? "Suppression..." : "Confirmer la suppression"}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div
          className={`floatingToast floatingToast--${toast.type}`}
          role="status"
          aria-live="polite"
        >
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