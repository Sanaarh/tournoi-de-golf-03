/**
 * =============================================================================
 * TESTS — admin.equipes.repository.js
 * =============================================================================
 */

import { describe, test, expect, beforeEach, jest } from "@jest/globals";

const mockPoolQuery = jest.fn();
const mockClientQuery = jest.fn();
const mockRelease = jest.fn();
const mockPoolConnect = jest.fn();

jest.unstable_mockModule("../../db/db.js", () => ({
  pool: {
    query: mockPoolQuery,
    connect: mockPoolConnect,
  },
}));

const {
  getAllEquipes,
  getEquipeById,
  getMembresByEquipeId,
  updateEquipe,
  createEquipe,
  deleteEquipeById,
  getParticipantById,
  countMembresEquipe,
  addMembreToEquipe,
  removeMembreFromEquipe,
  createParticipantAndAddToEquipe,
  searchParticipants,
  existsEquipeNameInTournoi,
  isTournoiOpenById,
  isTournoiOpenByEquipeId,
  isTournoiOpenByParticipantId,
  updateParticipantAdmin,
  moveMembreToEquipe,
  listJoueursCommanditesAdmin,
  updateJoueurCommanditeAdmin,
  deleteJoueurCommanditeAdmin,
  assignJoueurCommanditeToEquipe,
} = await import("../../dal/admin.equipes.repository.js");

beforeEach(() => {
  mockPoolQuery.mockReset();
  mockClientQuery.mockReset();
  mockRelease.mockReset();

  mockPoolConnect.mockReset().mockImplementation(() => ({
    query: mockClientQuery,
    release: mockRelease,
  }));
});

/* ============================================================================
   getAllEquipes()
============================================================================ */

describe("getAllEquipes()", () => {
  test("retourne les équipes des tournois ouverts aux inscriptions", async () => {
    const rows = [{ id: 1, nom_equipe: "Equipe A" }];
    mockPoolQuery.mockResolvedValueOnce({ rows });

    const result = await getAllEquipes();

    expect(result).toEqual(rows);
    expect(mockPoolQuery).toHaveBeenCalledTimes(1);
    expect(String(mockPoolQuery.mock.calls[0]?.[0] ?? "")).toMatch(
      /inscriptions_ouvertes\s*=\s*TRUE/i
    );
  });
});

/* ============================================================================
   getEquipeById()
============================================================================ */

describe("getEquipeById()", () => {
  test("retourne une équipe", async () => {
    mockPoolQuery.mockResolvedValueOnce({
      rows: [{ id: 5, nom_equipe: "Equipe X" }],
    });

    const result = await getEquipeById(5);

    expect(result).toEqual({ id: 5, nom_equipe: "Equipe X" });
  });

  test("retourne null si introuvable", async () => {
    mockPoolQuery.mockResolvedValueOnce({ rows: [] });

    const result = await getEquipeById(99);

    expect(result).toBeNull();
  });
});

/* ============================================================================
   getMembresByEquipeId()
============================================================================ */

describe("getMembresByEquipeId()", () => {
  test("retourne les membres", async () => {
    const rows = [{ id: 1, prenom: "Ali", nom: "Test" }];
    mockPoolQuery.mockResolvedValueOnce({ rows });

    const result = await getMembresByEquipeId(1);

    expect(result).toEqual(rows);
  });
});

/* ============================================================================
   updateEquipe()
============================================================================ */

describe("updateEquipe()", () => {
  test("retourne l'équipe mise à jour", async () => {
    mockPoolQuery.mockResolvedValueOnce({
      rows: [{ id: 1, nom_equipe: "Nouveau nom" }],
    });

    const result = await updateEquipe(1, "Nouveau nom");

    expect(result).toEqual({ id: 1, nom_equipe: "Nouveau nom" });
  });

  test("retourne null si aucune ligne modifiée", async () => {
    mockPoolQuery.mockResolvedValueOnce({ rows: [] });

    const result = await updateEquipe(99, "Nom");

    expect(result).toBeNull();
  });
});

/* ============================================================================
   createEquipe()
   IMPORTANT : createEquipe fait maintenant 2 requêtes avant l'INSERT :
   1. COUNT(*) equipes pour le tournoi
   2. SELECT nombre_equipes_max du tournoi
   Puis l'INSERT lui-même.
============================================================================ */

describe("createEquipe()", () => {
  test("crée une équipe avec succès", async () => {
    // 1. COUNT équipes existantes
    mockPoolQuery.mockResolvedValueOnce({
      rows: [{ total: 2 }],
    });
    // 2. SELECT nombre_equipes_max
    mockPoolQuery.mockResolvedValueOnce({
      rows: [{ nombre_equipes_max: 10 }],
    });
    // 3. INSERT équipe
    mockPoolQuery.mockResolvedValueOnce({
      rows: [{ id: 1, tournoi_id: 2, nom_equipe: "Equipe A", code_secret: "ABC123" }],
    });

    const result = await createEquipe(2, "Equipe A");

    expect(result).toBeDefined();
    expect(result.id).toBe(1);
  });

  test("réessaie en cas de collision 23505 puis réussit", async () => {
    // 1. COUNT équipes
    mockPoolQuery.mockResolvedValueOnce({ rows: [{ total: 2 }] });
    // 2. SELECT nombre_equipes_max
    mockPoolQuery.mockResolvedValueOnce({ rows: [{ nombre_equipes_max: 10 }] });
    // 3. INSERT — collision
    mockPoolQuery.mockRejectedValueOnce({ code: "23505" });
    // 4. INSERT — succès
    mockPoolQuery.mockResolvedValueOnce({
      rows: [{ id: 2, tournoi_id: 2, nom_equipe: "Equipe B", code_secret: "XYZ789" }],
    });

    const result = await createEquipe(2, "Equipe B");

    expect(result.id).toBe(2);
    // 2 requêtes de vérif + 2 tentatives INSERT
    expect(mockPoolQuery).toHaveBeenCalledTimes(4);
  });

  test("lance une erreur après trop de collisions", async () => {
    // 1. COUNT équipes
    mockPoolQuery.mockResolvedValueOnce({ rows: [{ total: 2 }] });
    // 2. SELECT nombre_equipes_max
    mockPoolQuery.mockResolvedValueOnce({ rows: [{ nombre_equipes_max: 10 }] });
    // 3..14. 12 collisions INSERT
    for (let i = 0; i < 12; i++) {
      mockPoolQuery.mockRejectedValueOnce({ code: "23505" });
    }

    await expect(createEquipe(2, "Equipe C")).rejects.toThrow(
      "Impossible de générer un code d'équipe unique."
    );
  });

  test("lance MAX_EQUIPES_ATTEINT si tournoi plein", async () => {
    // COUNT = max
    mockPoolQuery.mockResolvedValueOnce({ rows: [{ total: 10 }] });
    mockPoolQuery.mockResolvedValueOnce({ rows: [{ nombre_equipes_max: 10 }] });

    await expect(createEquipe(2, "Equipe D")).rejects.toThrow("MAX_EQUIPES_ATTEINT");
  });
});

/* ============================================================================
   deleteEquipeById()
============================================================================ */

describe("deleteEquipeById()", () => {
  test("retourne la ligne supprimée", async () => {
    mockPoolQuery.mockResolvedValueOnce({
      rows: [{ id: 1, nom_equipe: "Equipe A" }],
    });

    const result = await deleteEquipeById(1);

    expect(result).toEqual({ id: 1, nom_equipe: "Equipe A" });
  });

  test("retourne null si rien supprimé", async () => {
    mockPoolQuery.mockResolvedValueOnce({ rows: [] });

    const result = await deleteEquipeById(99);

    expect(result).toBeNull();
  });
});

/* ============================================================================
   getParticipantById()
============================================================================ */

describe("getParticipantById()", () => {
  test("retourne le participant", async () => {
    mockPoolQuery.mockResolvedValueOnce({
      rows: [{ id: 1, prenom: "Ali" }],
    });

    const result = await getParticipantById(1);

    expect(result).toEqual({ id: 1, prenom: "Ali" });
  });

  test("retourne null si absent", async () => {
    mockPoolQuery.mockResolvedValueOnce({ rows: [] });

    const result = await getParticipantById(77);

    expect(result).toBeNull();
  });
});

/* ============================================================================
   countMembresEquipe()
============================================================================ */

describe("countMembresEquipe()", () => {
  test("retourne le total", async () => {
    mockPoolQuery.mockResolvedValueOnce({ rows: [{ total: 3 }] });

    const result = await countMembresEquipe(1);

    expect(result).toBe(3);
  });

  test("retourne 0 si résultat vide", async () => {
    mockPoolQuery.mockResolvedValueOnce({ rows: [] });

    const result = await countMembresEquipe(1);

    expect(result).toBe(0);
  });
});

/* ============================================================================
   addMembreToEquipe() et removeMembreFromEquipe()
============================================================================ */

describe("addMembreToEquipe()", () => {
  test("ajoute un membre", async () => {
    mockPoolQuery.mockResolvedValueOnce({
      rows: [{ id: 1, equipe_id: 2, participant_id: 3 }],
    });

    const result = await addMembreToEquipe(2, 3);

    expect(result).toEqual({ id: 1, equipe_id: 2, participant_id: 3 });
  });
});

describe("removeMembreFromEquipe()", () => {
  test("supprime un membre", async () => {
    mockPoolQuery.mockResolvedValueOnce({
      rows: [{ id: 1, equipe_id: 2, participant_id: 3 }],
    });

    const result = await removeMembreFromEquipe(2, 3);

    expect(result).toEqual({ id: 1, equipe_id: 2, participant_id: 3 });
  });

  test("retourne null si rien supprimé", async () => {
    mockPoolQuery.mockResolvedValueOnce({ rows: [] });

    const result = await removeMembreFromEquipe(2, 3);

    expect(result).toBeNull();
  });
});

/* ============================================================================
   createParticipantAndAddToEquipe()
   IMPORTANT : la fonction fait maintenant des étapes supplémentaires
   après la création du participant :
   1. SELECT capacite_joueurs du tournoi
   2. COUNT participants du tournoi
   3. INSERT membres_equipes
============================================================================ */

describe("createParticipantAndAddToEquipe()", () => {
  const payload = {
    prenom: "Ali",
    nom: "Test",
    courriel: "ali@test.com",
    telephone: "12345",
  };

  test("crée un participant et l'ajoute à l'équipe", async () => {
    mockClientQuery
      .mockResolvedValueOnce(undefined) // BEGIN
      .mockResolvedValueOnce({ rows: [{ id: 1, tournoi_id: 99 }] }) // SELECT equipe
      .mockResolvedValueOnce({
        rows: [{ id: 10, tournoi_id: 99, prenom: "Ali", nom: "Test" }],
      }) // INSERT participant
      .mockResolvedValueOnce({ rows: [{ capacite_joueurs: 100 }] }) // SELECT capacite_joueurs
      .mockResolvedValueOnce({ rows: [{ total: 5 }] }) // COUNT participants
      .mockResolvedValueOnce({ rows: [{ id: 20, equipe_id: 1, participant_id: 10 }] }) // INSERT membre
      .mockResolvedValueOnce(undefined); // COMMIT

    const result = await createParticipantAndAddToEquipe(1, payload);

    expect(result.participant.id).toBe(10);
    expect(result.membre.id).toBe(20);
    expect(mockRelease).toHaveBeenCalled();
  });

  test("fait rollback si équipe introuvable", async () => {
    mockClientQuery
      .mockResolvedValueOnce(undefined) // BEGIN
      .mockResolvedValueOnce({ rows: [] }) // SELECT equipe — vide
      .mockResolvedValueOnce(undefined); // ROLLBACK

    await expect(createParticipantAndAddToEquipe(999, payload)).rejects.toThrow(
      "Équipe introuvable"
    );

    expect(mockRelease).toHaveBeenCalled();
  });

  test("fait rollback si tournoi complet", async () => {
    mockClientQuery
      .mockResolvedValueOnce(undefined) // BEGIN
      .mockResolvedValueOnce({ rows: [{ id: 1, tournoi_id: 99 }] }) // SELECT equipe
      .mockResolvedValueOnce({
        rows: [{ id: 10, tournoi_id: 99, prenom: "Ali", nom: "Test" }],
      }) // INSERT participant
      .mockResolvedValueOnce({ rows: [{ capacite_joueurs: 10 }] }) // SELECT capacite_joueurs
      .mockResolvedValueOnce({ rows: [{ total: 10 }] }) // COUNT = capacite → complet
      .mockResolvedValueOnce(undefined); // ROLLBACK

    await expect(createParticipantAndAddToEquipe(1, payload)).rejects.toThrow(
      "Tournoi complet"
    );

    expect(mockRelease).toHaveBeenCalled();
  });
});

/* ============================================================================
   searchParticipants()
============================================================================ */

describe("searchParticipants()", () => {
  test("retourne les derniers participants si query vide", async () => {
    const rows = [{ id: 1, nom: "Test" }];
    mockPoolQuery.mockResolvedValueOnce({ rows });

    const result = await searchParticipants("", 20);

    expect(result).toEqual(rows);
  });

  test("recherche avec query", async () => {
    const rows = [{ id: 2, nom: "Ali" }];
    mockPoolQuery.mockResolvedValueOnce({ rows });

    const result = await searchParticipants("Ali", 10);

    expect(result).toEqual(rows);
  });
});

/* ============================================================================
   existsEquipeNameInTournoi()
============================================================================ */

describe("existsEquipeNameInTournoi()", () => {
  test("retourne false si nom vide", async () => {
    const result = await existsEquipeNameInTournoi(1, "   ");

    expect(result).toBe(false);
    expect(mockPoolQuery).not.toHaveBeenCalled();
  });

  test("retourne true si le nom existe", async () => {
    mockPoolQuery.mockResolvedValueOnce({ rowCount: 1 });

    const result = await existsEquipeNameInTournoi(1, "Equipe A");

    expect(result).toBe(true);
  });

  test("retourne false si le nom n'existe pas", async () => {
    mockPoolQuery.mockResolvedValueOnce({ rowCount: 0 });

    const result = await existsEquipeNameInTournoi(1, "Equipe B");

    expect(result).toBe(false);
  });
});

/* ============================================================================
   isTournoiOpenBy...
============================================================================ */

describe("isTournoiOpenById()", () => {
  test("retourne null si tournoi absent", async () => {
    mockPoolQuery.mockResolvedValueOnce({ rowCount: 0, rows: [] });

    const result = await isTournoiOpenById(1);

    expect(result).toBeNull();
  });

  test("retourne true si ouvert", async () => {
    mockPoolQuery.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ inscriptions_ouvertes: true }],
    });

    const result = await isTournoiOpenById(1);

    expect(result).toBe(true);
  });
});

describe("isTournoiOpenByEquipeId()", () => {
  test("retourne false si fermé", async () => {
    mockPoolQuery.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ inscriptions_ouvertes: false }],
    });

    const result = await isTournoiOpenByEquipeId(1);

    expect(result).toBe(false);
  });
});

describe("isTournoiOpenByParticipantId()", () => {
  test("retourne null si absent", async () => {
    mockPoolQuery.mockResolvedValueOnce({ rowCount: 0, rows: [] });

    const result = await isTournoiOpenByParticipantId(1);

    expect(result).toBeNull();
  });
});

/* ============================================================================
   updateParticipantAdmin()
============================================================================ */

describe("updateParticipantAdmin()", () => {
  const payload = {
    prenom: "Ali",
    nom: "Test",
    courriel: "ali@test.com",
    telephone: "12345",
  };

  test("retourne NOT_FOUND si id invalide", async () => {
    const result = await updateParticipantAdmin("abc", payload);

    expect(result).toEqual({ ok: false, code: "NOT_FOUND" });
  });

  test("retourne NOT_FOUND si aucun participant mis à jour", async () => {
    mockPoolQuery.mockResolvedValueOnce({ rowCount: 0, rows: [] });

    const result = await updateParticipantAdmin(1, payload);

    expect(result).toEqual({ ok: false, code: "NOT_FOUND" });
  });

  test("retourne ok=true si mise à jour réussie", async () => {
    mockPoolQuery.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ id: 1, prenom: "Ali" }],
    });

    const result = await updateParticipantAdmin(1, payload);

    expect(result.ok).toBe(true);
    expect(result.row.id).toBe(1);
  });
});

/* ============================================================================
   moveMembreToEquipe()
============================================================================ */

describe("moveMembreToEquipe()", () => {
  test("retourne BAD_INPUT si ids invalides", async () => {
    const result = await moveMembreToEquipe("a", 2, 3);

    expect(result).toEqual({ ok: false, code: "BAD_INPUT" });
  });

  test("retourne NOOP si source = cible", async () => {
    const result = await moveMembreToEquipe(1, 1, 9);

    expect(result).toEqual({ ok: true, code: "NOOP", equipe_id: 1, participant_id: 9 });
  });

  test("retourne SOURCE_NOT_FOUND si équipe source absente", async () => {
    mockClientQuery
      .mockResolvedValueOnce(undefined) // BEGIN
      .mockResolvedValueOnce({ rowCount: 0, rows: [] }) // source
      .mockResolvedValueOnce(undefined); // ROLLBACK

    const result = await moveMembreToEquipe(1, 2, 3);

    expect(result).toEqual({ ok: false, code: "SOURCE_NOT_FOUND" });
  });

  test("retourne MOVED si déplacement réussi", async () => {
    mockClientQuery
      .mockResolvedValueOnce(undefined) // BEGIN
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 1, tournoi_id: 10 }] }) // source
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 2, tournoi_id: 10 }] }) // target
      .mockResolvedValueOnce({ rows: [{ equipe_id: 1 }] }) // membre actuel
      .mockResolvedValueOnce({ rows: [{ total: 2 }] }) // count cible
      .mockResolvedValueOnce(undefined) // UPDATE
      .mockResolvedValueOnce(undefined); // COMMIT

    const result = await moveMembreToEquipe(1, 2, 5);

    expect(result).toEqual({ ok: true, code: "MOVED", equipe_id: 2, participant_id: 5 });
    expect(mockRelease).toHaveBeenCalled();
  });
});

/* ============================================================================
   listJoueursCommanditesAdmin()
============================================================================ */

describe("listJoueursCommanditesAdmin()", () => {
  test("retourne les lignes", async () => {
    const rows = [{ joueur_commandite_id: 1, joueur_prenom: "Ali" }];
    mockPoolQuery.mockResolvedValueOnce({ rows });

    const result = await listJoueursCommanditesAdmin();

    expect(result).toEqual(rows);
  });
});

/* ============================================================================
   updateJoueurCommanditeAdmin()
============================================================================ */

describe("updateJoueurCommanditeAdmin()", () => {
  test("retourne NOT_FOUND si id invalide", async () => {
    const result = await updateJoueurCommanditeAdmin("abc", { prenom: "A", nom: "B" });

    expect(result).toEqual({ ok: false, code: "NOT_FOUND" });
  });

  test("retourne VALIDATION si prénom ou nom vide", async () => {
    const result = await updateJoueurCommanditeAdmin(1, { prenom: "", nom: "B" });

    expect(result).toEqual({ ok: false, code: "VALIDATION" });
  });

  test("retourne ok=true si mise à jour réussie", async () => {
    mockClientQuery
      .mockResolvedValueOnce(undefined) // BEGIN
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ id: 1, participant_id: null, tournoi_id: 10 }],
      }) // select joueur
      .mockResolvedValueOnce(undefined) // update joueur
      .mockResolvedValueOnce(undefined); // COMMIT

    mockPoolQuery.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ inscriptions_ouvertes: true }],
    }); // isTournoiOpenById

    const result = await updateJoueurCommanditeAdmin(1, { prenom: "Ali", nom: "Test" });

    expect(result).toEqual({ ok: true });
  });
});

/* ============================================================================
   deleteJoueurCommanditeAdmin()
============================================================================ */

describe("deleteJoueurCommanditeAdmin()", () => {
  test("retourne NOT_FOUND si id invalide", async () => {
    const result = await deleteJoueurCommanditeAdmin("abc");

    expect(result).toEqual({ ok: false, code: "NOT_FOUND" });
  });
});

/* ============================================================================
   assignJoueurCommanditeToEquipe()
============================================================================ */

describe("assignJoueurCommanditeToEquipe()", () => {
  test("retourne BAD_INPUT si ids invalides", async () => {
    const result = await assignJoueurCommanditeToEquipe("abc", 2);

    expect(result).toEqual({ ok: false, code: "BAD_INPUT" });
  });

  test("retourne NOT_FOUND si joueur commandité absent", async () => {
    mockClientQuery
      .mockResolvedValueOnce(undefined) // BEGIN
      .mockResolvedValueOnce({ rowCount: 0, rows: [] }) // select joueur commandité
      .mockResolvedValueOnce(undefined); // ROLLBACK

    const result = await assignJoueurCommanditeToEquipe(1, 2);

    expect(result).toEqual({ ok: false, code: "NOT_FOUND" });
    expect(mockRelease).toHaveBeenCalled();
  });

  test("retourne CREATED si participant créé et assigné", async () => {
    mockPoolQuery.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ inscriptions_ouvertes: true }],
    }); // isTournoiOpenById

    mockClientQuery
      .mockResolvedValueOnce(undefined) // BEGIN
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{
          id: 1,
          commandite_id: 10,
          prenom: "Ali",
          nom: "Test",
          participant_id: null,
          tournoi_id: 99,
          courriel_contact: "ali@test.com",
          telephone_contact: "12345",
        }],
      }) // select joueur commandité
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 2, tournoi_id: 99 }] }) // select équipe
      .mockResolvedValueOnce({ rows: [{ total: 0 }] }) // countMembresEquipeClient
      .mockResolvedValueOnce({ rowCount: 0, rows: [] }) // courrielParticipantSiLibre
      .mockResolvedValueOnce({ rows: [{ id: 50 }] }) // insert participant
      .mockResolvedValueOnce(undefined) // insert membre_equipe
      .mockResolvedValueOnce(undefined) // update joueurs_commandites
      .mockResolvedValueOnce(undefined); // COMMIT

    const result = await assignJoueurCommanditeToEquipe(1, 2);

    expect(result).toEqual({ ok: true, code: "CREATED", participant_id: 50, equipe_id: 2 });
    expect(mockRelease).toHaveBeenCalled();
  });
});