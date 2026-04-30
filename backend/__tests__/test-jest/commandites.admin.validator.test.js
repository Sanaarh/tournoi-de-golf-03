/**
 * Tests Jest du validateur admin des commandites.
 *
 * Ce fichier teste :
 * - la fonction parseId()
 * - la fonction validateUpdateCommanditePayload()
 *
 * Objectif :
 * vérifier que les données valides passent
 * et que les données invalides retournent bien les erreurs attendues.
 */

import {
  validateUpdateCommanditePayload,
  parseId,
} from "../../validators/commandites.admin.validator.js";

describe("commandites.admin.validator.js", () => {
  /**
   * --------------------------------------------------------------------------
   * Tests de parseId()
   * --------------------------------------------------------------------------
   */
  describe("parseId()", () => {
    test("retourne un entier positif valide", () => {
      expect(parseId(1)).toBe(1);
      expect(parseId("5")).toBe(5);
      expect(parseId(99)).toBe(99);
    });

    test("retourne null si la valeur est invalide", () => {
      expect(parseId(0)).toBeNull();
      expect(parseId(-1)).toBeNull();
      expect(parseId("abc")).toBeNull();
      expect(parseId(1.5)).toBeNull();
      expect(parseId(null)).toBeNull();
      expect(parseId(undefined)).toBeNull();
    });
  });

  /**
   * --------------------------------------------------------------------------
   * Tests de validateUpdateCommanditePayload()
   * --------------------------------------------------------------------------
   */
  describe("validateUpdateCommanditePayload()", () => {
    /**
     * Payload valide de base réutilisable dans plusieurs tests.
     * Cela évite de réécrire le même objet à chaque fois.
     */
    const validPayload = {
      nom_entreprise: "Entreprise ABC",
      nom_contact: "Ali Squalli",
      courriel_contact: "ali@email.com",
      telephone_contact: "613-123-4567",
      statut: "EN_ATTENTE",
      type_commandite_id: 1,
      joueurs: [
        { prenom: "Jean", nom: "Dupont" },
        { prenom: "Sara", nom: "Martin" },
      ],
    };

    test("retourne ok: true avec un payload valide", () => {
      const result = validateUpdateCommanditePayload(validPayload);

      expect(result.ok).toBe(true);

      /**
       * On vérifie aussi que les données nettoyées sont bien présentes.
       */
      expect(result.cleaned).toEqual({
        nom_entreprise: "Entreprise ABC",
        nom_contact: "Ali Squalli",
        courriel_contact: "ali@email.com",
        telephone_contact: "613-123-4567",
        statut: "EN_ATTENTE",
        type_commandite_id: 1,
        joueurs: [
          { prenom: "Jean", nom: "Dupont" },
          { prenom: "Sara", nom: "Martin" },
        ],
      });
    });

    test("convertit le courriel en minuscules", () => {
      const payload = {
        ...validPayload,
        courriel_contact: "ALI@EMAIL.COM",
      };

      const result = validateUpdateCommanditePayload(payload);

      expect(result.ok).toBe(true);
      expect(result.cleaned.courriel_contact).toBe("ali@email.com");
    });

    test("met telephone_contact à null si vide", () => {
      const payload = {
        ...validPayload,
        telephone_contact: "   ",
      };

      const result = validateUpdateCommanditePayload(payload);

      expect(result.ok).toBe(true);
      expect(result.cleaned.telephone_contact).toBeNull();
    });

    test("retourne une erreur si nom_entreprise est manquant", () => {
      const payload = {
        ...validPayload,
        nom_entreprise: "",
      };

      const result = validateUpdateCommanditePayload(payload);

      expect(result.ok).toBe(false);
      expect(result.errors.nom_entreprise).toBe(
        "Le nom de l'entreprise est obligatoire."
      );
    });

    test("retourne une erreur si nom_contact est manquant", () => {
      const payload = {
        ...validPayload,
        nom_contact: "",
      };

      const result = validateUpdateCommanditePayload(payload);

      expect(result.ok).toBe(false);
      expect(result.errors.nom_contact).toBe(
        "Le nom du contact est obligatoire."
      );
    });

    test("retourne une erreur si courriel_contact est manquant", () => {
      const payload = {
        ...validPayload,
        courriel_contact: "",
      };

      const result = validateUpdateCommanditePayload(payload);

      expect(result.ok).toBe(false);
      expect(result.errors.courriel_contact).toBe(
        "Le courriel est obligatoire."
      );
    });

    test("retourne une erreur si le format du courriel est invalide", () => {
      const payload = {
        ...validPayload,
        courriel_contact: "ali-email.com",
      };

      const result = validateUpdateCommanditePayload(payload);

      expect(result.ok).toBe(false);
      expect(result.errors.courriel_contact).toBe(
        "Format de courriel invalide."
      );
    });

    test("retourne une erreur si le téléphone dépasse la longueur maximale", () => {
      const payload = {
        ...validPayload,
        telephone_contact: "1".repeat(31),
      };

      const result = validateUpdateCommanditePayload(payload);

      expect(result.ok).toBe(false);
      expect(result.errors.telephone_contact).toBe("Maximum 30 caractères.");
    });

    test("retourne une erreur si le statut est invalide", () => {
      const payload = {
        ...validPayload,
        statut: "INVALIDE",
      };

      const result = validateUpdateCommanditePayload(payload);

      expect(result.ok).toBe(false);
      expect(result.errors.statut).toBe(
        "Statut invalide (EN_ATTENTE, PAYEE ou ECHEC)."
      );
    });

    test("accepte un statut en minuscule grâce au toUpperCase()", () => {
      const payload = {
        ...validPayload,
        statut: "payee",
      };

      const result = validateUpdateCommanditePayload(payload);

      expect(result.ok).toBe(true);
      expect(result.cleaned.statut).toBe("PAYEE");
    });

    test("retourne une erreur si type_commandite_id est invalide", () => {
      const payload = {
        ...validPayload,
        type_commandite_id: 0,
      };

      const result = validateUpdateCommanditePayload(payload);

      expect(result.ok).toBe(false);
      expect(result.errors.type_commandite_id).toBe(
        "type_commandite_id invalide."
      );
    });

    test("retourne une erreur si joueurs n'est pas un tableau", () => {
      const payload = {
        ...validPayload,
        joueurs: "pas-un-tableau",
      };

      const result = validateUpdateCommanditePayload(payload);

      expect(result.ok).toBe(false);
      expect(result.errors.joueurs).toBe("joueurs doit être un tableau.");
    });

    test("retourne une erreur si le nombre de joueurs dépasse la limite", () => {
      const payload = {
        ...validPayload,
        joueurs: Array.from({ length: 25 }, (_, i) => ({
          prenom: `Prenom${i}`,
          nom: `Nom${i}`,
        })),
      };

      const result = validateUpdateCommanditePayload(payload);

      expect(result.ok).toBe(false);
      expect(result.errors.joueurs).toBe("Au plus 24 entrées joueurs.");
    });

    test("retourne une erreur si le prénom d'un joueur dépasse la longueur maximale", () => {
      const payload = {
        ...validPayload,
        joueurs: [{ prenom: "A".repeat(81), nom: "Dupont" }],
      };

      const result = validateUpdateCommanditePayload(payload);

      expect(result.ok).toBe(false);
      expect(result.errors["joueurs.0.prenom"]).toBe("Maximum 80 caractères.");
    });

    test("retourne une erreur si le nom d'un joueur dépasse la longueur maximale", () => {
      const payload = {
        ...validPayload,
        joueurs: [{ prenom: "Jean", nom: "B".repeat(81) }],
      };

      const result = validateUpdateCommanditePayload(payload);

      expect(result.ok).toBe(false);
      expect(result.errors["joueurs.0.nom"]).toBe("Maximum 80 caractères.");
    });

    test("accepte un payload sans joueurs", () => {
      const payload = {
        ...validPayload,
        joueurs: [],
      };

      const result = validateUpdateCommanditePayload(payload);

      expect(result.ok).toBe(true);
      expect(result.cleaned.joueurs).toEqual([]);
    });

    test("accepte un payload avec joueurs absent", () => {
      const payload = { ...validPayload };
      delete payload.joueurs;

      const result = validateUpdateCommanditePayload(payload);

      expect(result.ok).toBe(true);
      expect(result.cleaned.joueurs).toEqual([]);
    });

    test("retourne plusieurs erreurs si plusieurs champs sont invalides", () => {
      const payload = {
        nom_entreprise: "",
        nom_contact: "",
        courriel_contact: "invalide",
        telephone_contact: "1".repeat(31),
        statut: "xxx",
        type_commandite_id: -5,
        joueurs: "abc",
      };

      const result = validateUpdateCommanditePayload(payload);

      expect(result.ok).toBe(false);

      expect(result.errors.nom_entreprise).toBe(
        "Le nom de l'entreprise est obligatoire."
      );
      expect(result.errors.nom_contact).toBe(
        "Le nom du contact est obligatoire."
      );
      expect(result.errors.courriel_contact).toBe(
        "Format de courriel invalide."
      );
      expect(result.errors.telephone_contact).toBe("Maximum 30 caractères.");
      expect(result.errors.statut).toBe(
        "Statut invalide (EN_ATTENTE, PAYEE ou ECHEC)."
      );
      expect(result.errors.type_commandite_id).toBe(
        "type_commandite_id invalide."
      );
      expect(result.errors.joueurs).toBe("joueurs doit être un tableau.");
    });
  });
});