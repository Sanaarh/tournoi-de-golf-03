/**
 * Page d'inscription au tournoi de golf
 * --------------------------------------------------------------------
 * Cette page gère le parcours complet d'inscription au tournoi.
 *
 * Fonctionnement général :
 * 1) Chargement du tournoi actif
 * 2) Chargement de la disponibilité du tournoi
 * 3) Chargement des types de commandites disponibles
 * 4) Affichage d'un parcours en 3 étapes :
 *    - Étape 1 : informations personnelles
 *    - Étape 2 : type de participation
 *    - Étape 3 : confirmation et redirection vers Stripe
 *
 * Cas pris en charge :
 * - Employé :
 *   - peut créer une équipe
 *   - ou rejoindre une équipe existante
 *
 * - Retraité :
 *   - peut créer une équipe
 *   - ou rejoindre une équipe existante
 *
 * - Commanditaire :
 *   - choisit une formule commanditaire
 *   - saisit les joueurs inclus
 *   - paie ensuite via Stripe
 *
 * Règles importantes :
 * - si le tournoi est complet, le formulaire d'inscription n'est pas affiché
 * - un message remplace alors le formulaire pour informer l'utilisateur
 * - le courriel est vérifié dès l'étape 1
 * - le nom d'équipe est vérifié lors de la création d'une équipe
 * - le code d'équipe est vérifié lors de la jonction à une équipe
 * - les joueurs commandités sont validés avant paiement
 *
 * Paiement :
 * - employés / retraités :
 *   - création directe de la session Stripe
 *
 * - commanditaires :
 *   - enregistrement préalable de la commandite en attente
 *   - puis création de la session Stripe
 *
 * Après paiement :
 * - Stripe redirige vers une page de succès ou d'annulation
 * - le webhook backend confirme le paiement
 * - le backend met à jour les statuts en base de données
 */

import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { IconUsers, IconCheck, IconWarning } from "../components/Icons.jsx";

const API_BASE_URL = "http://localhost:3000";

const ETAPES = [
  { num: 1, titre: "Informations", desc: "Vos coordonnées" },
  { num: 2, titre: "Participation", desc: "Type & équipe" },
  { num: 3, titre: "Confirmation", desc: "Validation finale" },
];

const TIER_COLORS = {
  platinum: { accent: "#64748b" },
  or: { accent: "#d4a017" },
  argent: { accent: "#94a3b8" },
  bronze: { accent: "#cd7f32" },
};

const MSG_SPONSOR_JOUEUR_DEJA_INSCRIT =
  "Un ou plusieurs joueurs nommés sont déjà inscrits à ce tournoi (employé, retraité ou commanditaire). Vérifiez les prénoms et noms.";

/**
 * Nettoie une valeur texte.
 *
 * Rôle :
 * - transforme null/undefined en chaîne vide
 * - supprime les espaces en trop au début et à la fin
 *
 * @param {any} value Valeur à nettoyer
 * @returns {string} Texte nettoyé
 */
function safeTrim(value) {
  return String(value || "").trim();
}

/**
 * Vérifie si une adresse courriel respecte un format simple valide.
 *
 * @param {string} email Adresse courriel
 * @returns {boolean} true si le format semble valide
 */
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Détermine le niveau visuel d'une formule commanditaire
 * à partir de son nom.
 *
 * @param {string} nom Nom de la formule
 * @returns {"platinum" | "or" | "argent" | "bronze"} Niveau visuel
 */
function getFormuleTier(nom = "") {
  const lower = String(nom).toLowerCase();
  if (lower.includes("platine")) return "platinum";
  if (lower.includes("bronze")) return "bronze";
  if (lower.includes("or")) return "or";
  if (lower.includes("argent")) return "argent";
  return "argent";
}

/**
 * Retourne le libellé lisible du niveau visuel.
 *
 * @param {string} tier Niveau visuel
 * @returns {string} Libellé affichable
 */
function tierLabel(tier) {
  if (tier === "platinum") return "Platine";
  if (tier === "or") return "Or";
  if (tier === "bronze") return "Bronze";
  return "Argent";
}

/**
 * Transforme une description libre en liste de points.
 *
 * Séparateurs acceptés :
 * - point médian "•"
 * - point-virgule ";"
 * - retour à la ligne
 *
 * @param {string} description Description brute
 * @returns {string[]} Liste de points exploitables à l'écran
 */
function descriptionToPoints(description = "") {
  const raw = safeTrim(description);
  if (!raw) return [];

  const points = raw
    .split(/[•;\n]+/)
    .map((s) => safeTrim(s))
    .filter(Boolean);

  const placeholders = new Set(["tournoi", "golf", "poster"]);
  const allArePlaceholders =
    points.length > 0 &&
    points.every((p) => placeholders.has(String(p).toLowerCase()));

  if (allArePlaceholders) return [];

  return points;
}

/**
 * Retourne l'état initial du formulaire d'inscription.
 *
 * @returns {object} Structure de départ du formulaire
 */
function initialFormData() {
  return {
    prenom: "",
    nom: "",
    email: "",
    telephone: "",
    type: "",
    optionEquipe: "",
    nomEquipe: "",
    codeEquipe: "",
    formulesChoisies: [],
    joueursParType: {},
  };
}

/**
 * Synchronise la structure des joueurs commandités avec les
 * formules sélectionnées.
 *
 * Exemple :
 * - si une formule inclut 2 places, on garantit 2 lignes joueur
 * - si la formule est retirée, ses joueurs sont retirés aussi
 *
 * @param {string[]} selectedIds Identifiants des formules sélectionnées
 * @param {Array} formulesList Liste des formules disponibles
 * @param {object} prev Ancienne structure joueursParType
 * @returns {object} Nouvelle structure synchronisée
 */
function syncJoueursParType(selectedIds, formulesList, prev) {
  const next = { ...prev };
  const sel = new Set(selectedIds.map(String));

  for (const key of Object.keys(next)) {
    if (!sel.has(key)) delete next[key];
  }

  for (const rawId of selectedIds) {
    const id = String(rawId);
    const f = formulesList.find((x) => String(x.id) === id);
    const n = f?.placesIncluses ?? 0;
    const cur = next[id] ? [...next[id]] : [];

    if (n === 0) {
      next[id] = [];
      continue;
    }

    while (cur.length < n) cur.push({ prenom: "", nom: "" });
    cur.length = n;
    next[id] = cur;
  }

  return next;
}

/**
 * Vérifie que tous les joueurs commandités obligatoires
 * sont correctement remplis.
 *
 * @param {object} data Données du formulaire
 * @param {Array} formules Formules disponibles
 * @returns {boolean} true si tous les joueurs requis sont complets
 */
function sponsorJoueursComplets(data, formules) {
  for (const fid of data.formulesChoisies) {
    const f = formules.find((x) => String(x.id) === String(fid));
    const need = f?.placesIncluses ?? 0;
    if (need <= 0) continue;

    const rows = data.joueursParType[String(fid)] || [];
    if (rows.length !== need) return false;

    for (const row of rows) {
      if (!safeTrim(row.prenom) || !safeTrim(row.nom)) return false;
    }
  }

  return true;
}

/**
 * Vérifie la présence de doublons prénom + nom
 * parmi les joueurs commandités saisis.
 *
 * @param {object} data Données du formulaire
 * @param {Array} formules Formules disponibles
 * @returns {boolean} true si un doublon est détecté
 */
function sponsorJoueursOntDesDoublons(data, formules) {
  const seen = new Set();

  for (const fid of data.formulesChoisies) {
    const f = formules.find((x) => String(x.id) === String(fid));
    const need = f?.placesIncluses ?? 0;
    if (need <= 0) continue;

    const rows = data.joueursParType[String(fid)] || [];
    for (const row of rows) {
      const p = safeTrim(row.prenom).toLowerCase();
      const n = safeTrim(row.nom).toLowerCase();
      if (!p || !n) continue;

      const k = `${p}|${n}`;
      if (seen.has(k)) return true;
      seen.add(k);
    }
  }

  return false;
}

/**
 * Prépare la liste des joueurs commandités à envoyer au backend
 * afin de vérifier si certains sont déjà inscrits au tournoi.
 *
 * @param {object} data Données du formulaire
 * @returns {Array<{prenom: string, nom: string}>} Liste des candidats à vérifier
 */
function sponsorJoueursCandidatsPourVerif(data) {
  const candidats = [];

  for (const fid of data.formulesChoisies) {
    const rows = data.joueursParType[String(fid)] || [];
    for (const row of rows) {
      const p = safeTrim(row.prenom);
      const n = safeTrim(row.nom);
      if (p && n) {
        candidats.push({ prenom: p, nom: n });
      }
    }
  }

  return candidats;
}

/**
 * Hook personnalisé qui vérifie si des joueurs commandités
 * sont déjà inscrits au tournoi.
 *
 * @param {string|number} tournoiId Identifiant du tournoi
 * @param {boolean} estSponsor true si le mode commanditaire est actif
 * @param {object} data Données du formulaire
 * @returns {boolean} true si un conflit est détecté
 */
function useSponsorNomsDejaPris(tournoiId, estSponsor, data) {
  const [conflit, setConflit] = useState(false);

  const candidats = useMemo(() => {
    if (!estSponsor) return [];
    return sponsorJoueursCandidatsPourVerif(data);
  }, [estSponsor, data.formulesChoisies, data.joueursParType]);

  useEffect(() => {
    if (!estSponsor || !tournoiId || candidats.length === 0) {
      setConflit(false);
      return;
    }

    const numeric = Number(tournoiId);
    if (!Number.isInteger(numeric) || numeric <= 0) {
      setConflit(false);
      return;
    }

    const ac = new AbortController();

    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(
          `${API_BASE_URL}/public/inscription/verifier-noms-joueurs`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              tournoi_id: numeric,
              joueurs: candidats,
            }),
            signal: ac.signal,
          }
        );

        const body = await res.json().catch(() => ({}));
        if (ac.signal.aborted) return;

        if (!res.ok) {
          setConflit(false);
          return;
        }

        setConflit(Boolean(body.conflit));
      } catch (err) {
        if (err?.name === "AbortError") return;
        setConflit(false);
      }
    }, 450);

    return () => {
      ac.abort();
      window.clearTimeout(timer);
    };
  }, [tournoiId, estSponsor, candidats]);

  return conflit;
}

/**
 * Composant visuel représentant l'avancement des 3 étapes.
 *
 * @param {{ etape: number }} props Propriétés du composant
 * @returns {JSX.Element}
 */
function Stepper({ etape }) {
  return (
    <div className="regStepper">
      {ETAPES.map((item) => {
        const active = etape === item.num;
        const done = etape > item.num;

        return (
          <div
            key={item.num}
            className={`regStepper__item${active ? " regStepper__item--active" : ""}${
              done ? " regStepper__item--done" : ""
            }`}
          >
            <div className="regStepper__badge">{item.num}</div>
            <div>
              <div className="regStepper__title">{item.titre}</div>
              <div className="regStepper__desc">{item.desc}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Étape 1 : informations personnelles.
 *
 * Rôle :
 * - valider les champs obligatoires
 * - vérifier que le courriel n'est pas déjà inscrit
 *
 * @param {object} props Propriétés du composant
 * @returns {JSX.Element}
 */
function Etape1({ data, tournoiId, onChange, onNext }) {
  const [erreurs, setErreurs] = useState({});
  const [verificationCourrielEnCours, setVerificationCourrielEnCours] = useState(false);

  /**
   * Valide les champs visibles de l'étape 1.
   *
   * @returns {boolean} true si le formulaire local est valide
   */
  function valider() {
    const e = {};

    if (!safeTrim(data.prenom)) e.prenom = "Le prénom est requis.";
    if (!safeTrim(data.nom)) e.nom = "Le nom est requis.";

    if (!safeTrim(data.email)) {
      e.email = "Le courriel est requis.";
    } else if (!isValidEmail(safeTrim(data.email))) {
      e.email = "Le format du courriel est invalide.";
    }

    if (!safeTrim(data.telephone)) e.telephone = "Le téléphone est requis.";

    setErreurs(e);
    return Object.keys(e).length === 0;
  }

  /**
   * Vérifie côté backend si le courriel est déjà utilisé
   * pour une inscription à ce tournoi.
   *
   * @returns {Promise<boolean>} true si le courriel existe déjà ou si une erreur survient
   */
  async function verifierCourrielDejaInscrit() {
    const numericId = Number(tournoiId);

    if (!Number.isInteger(numericId) || numericId <= 0) {
      setErreurs((prev) => ({
        ...prev,
        email: "Identifiant de tournoi invalide.",
      }));
      return true;
    }

    try {
      setVerificationCourrielEnCours(true);

      const res = await fetch(`${API_BASE_URL}/public/inscription/verifier-courriel`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tournoi_id: numericId,
          courriel: safeTrim(data.email),
        }),
      });

      const body = await res.json().catch(() => ({}));

      if (!res.ok) {
        setErreurs((prev) => ({
          ...prev,
          email: body?.message || "Impossible de vérifier le courriel pour le moment.",
        }));
        return true;
      }

      if (body?.existe) {
        setErreurs((prev) => ({
          ...prev,
          email: "Ce courriel est déjà inscrit à ce tournoi.",
        }));
        return true;
      }

      setErreurs((prev) => {
        const next = { ...prev };

        if (
          next.email === "Ce courriel est déjà inscrit à ce tournoi." ||
          next.email === "Impossible de vérifier le courriel pour le moment." ||
          next.email === "Erreur réseau : impossible de vérifier le courriel." ||
          next.email === "Identifiant de tournoi invalide."
        ) {
          delete next.email;
        }

        return next;
      });

      return false;
    } catch {
      setErreurs((prev) => ({
        ...prev,
        email: "Erreur réseau : impossible de vérifier le courriel.",
      }));
      return true;
    } finally {
      setVerificationCourrielEnCours(false);
    }
  }

  /**
   * Soumet l'étape 1.
   *
   * @param {React.FormEvent<HTMLFormElement>} ev Événement de soumission
   */
  async function handleSubmit(ev) {
    ev.preventDefault();

    const formulaireValide = valider();
    if (!formulaireValide) return;

    const courrielExisteOuErreur = await verifierCourrielDejaInscrit();
    if (courrielExisteOuErreur) return;

    onNext();
  }

  return (
    <div>
      <h2 className="regCard__h2">Informations personnelles</h2>
      <p className="regCard__sub">
        Veuillez fournir vos coordonnées pour l'inscription.
      </p>

      <form className="regForm" onSubmit={handleSubmit} noValidate>
        <div className="regForm__row2">
          <div className="field">
            <label className="label" htmlFor="prenom">
              Prénom *
            </label>
            <input
              id="prenom"
              className={`input${erreurs.prenom ? " input--error" : ""}`}
              value={data.prenom}
              onChange={(e) => onChange("prenom", e.target.value)}
              placeholder="Jean"
            />
            {erreurs.prenom && <span className="fieldError">{erreurs.prenom}</span>}
          </div>

          <div className="field">
            <label className="label" htmlFor="nom">
              Nom de famille *
            </label>
            <input
              id="nom"
              className={`input${erreurs.nom ? " input--error" : ""}`}
              value={data.nom}
              onChange={(e) => onChange("nom", e.target.value)}
              placeholder="Dupont"
            />
            {erreurs.nom && <span className="fieldError">{erreurs.nom}</span>}
          </div>
        </div>

        <div className="field">
          <label className="label" htmlFor="email">
            Adresse courriel *
          </label>
          <input
            id="email"
            type="email"
            className={`input${erreurs.email ? " input--error" : ""}`}
            value={data.email}
            onChange={(e) => onChange("email", e.target.value)}
            placeholder="jean.dupont@lacitec.on.ca"
          />
          {erreurs.email && <span className="fieldError">{erreurs.email}</span>}
        </div>

        <div className="field">
          <label className="label" htmlFor="telephone">
            Téléphone *
          </label>
          <input
            id="telephone"
            type="tel"
            className={`input${erreurs.telephone ? " input--error" : ""}`}
            value={data.telephone}
            onChange={(e) => onChange("telephone", e.target.value)}
            placeholder="613-555-0100"
          />
          {erreurs.telephone && <span className="fieldError">{erreurs.telephone}</span>}
        </div>

        <div className="regSecurityNote">
          <p>
            Vos informations sont utilisées uniquement pour la gestion de
            l'inscription au tournoi.
          </p>
        </div>

        <div className="regNav">
          <div />
          <button
            type="submit"
            className="btnPrimary"
            style={{ minWidth: 160 }}
            disabled={verificationCourrielEnCours}
          >
            {verificationCourrielEnCours ? "Vérification..." : "Continuer →"}
          </button>
        </div>
      </form>
    </div>
  );
}

/**
 * Étape 2 : choix du type de participation et des options associées.
 *
 * Rôle :
 * - permettre de choisir employé, retraité ou commanditaire
 * - gérer la création / jonction d'équipe
 * - gérer la sélection de formule commanditaire
 * - valider les joueurs inclus pour les commandites
 *
 * @param {object} props Propriétés du composant
 * @returns {JSX.Element}
 */
function Etape2({
  data,
  formules,
  tournoiId,
  disponibilite,
  onChange,
  onNext,
  onBack,
  onToggleFormule,
  onJoueurChange,
}) {
  const [erreurNomEquipe, setErreurNomEquipe] = useState("");
  const [verificationNomEquipeEnCours, setVerificationNomEquipeEnCours] = useState(false);
  const [erreurCodeEquipe, setErreurCodeEquipe] = useState("");
  const [verificationCodeEquipeEnCours, setVerificationCodeEquipeEnCours] = useState(false);

  const types = [
    {
      val: "employe",
      label: "Employé",
      desc: "Personnel actuel du Collège La Cité",
    },
    {
      val: "retraite",
      label: "Retraité",
      desc: "Ancien membre du personnel",
    },
    {
      val: "commanditaire",
      label: "Commanditaire",
      desc: "Entreprise ou partenaire",
    },
  ];

  const estEquipe = data.type === "employe" || data.type === "retraite";
  const estSponsor = data.type === "commanditaire";

  const sponsorDoublonsJoueurs = useMemo(
    () => estSponsor && sponsorJoueursOntDesDoublons(data, formules),
    [estSponsor, data, formules]
  );

  const sponsorNomsDejaPris = useSponsorNomsDejaPris(tournoiId, estSponsor, data);

  /**
   * Ajuste automatiquement l'option d'équipe si la disponibilité
   * ne permet plus le choix actuellement sélectionné.
   */
  useEffect(() => {
    if (!estEquipe || !disponibilite) return;

    if (data.optionEquipe === "creer" && !disponibilite.peutCreerEquipe) {
      if (disponibilite.peutRejoindreEquipe) {
        onChange("optionEquipe", "rejoindre");
        onChange("nomEquipe", "");
      } else {
        onChange("optionEquipe", "");
        onChange("nomEquipe", "");
      }
    }

    if (data.optionEquipe === "rejoindre" && !disponibilite.peutRejoindreEquipe) {
      onChange("optionEquipe", "");
      onChange("codeEquipe", "");
    }
  }, [estEquipe, disponibilite, data.optionEquipe, onChange]);

  /**
   * Vérifie côté backend si un nom d'équipe existe déjà
   * pour ce tournoi.
   *
   * @returns {Promise<boolean>} true si le nom existe déjà ou si une erreur survient
   */
  async function verifierNomEquipeDejaExistant() {
    const numericId = Number(tournoiId);
    const nomEquipe = safeTrim(data.nomEquipe);

    if (!Number.isInteger(numericId) || numericId <= 0 || !nomEquipe) {
      return true;
    }

    try {
      setVerificationNomEquipeEnCours(true);
      setErreurNomEquipe("");

      const res = await fetch(`${API_BASE_URL}/public/inscription/verifier-nom-equipe`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tournoi_id: numericId,
          nom_equipe: nomEquipe,
        }),
      });

      const body = await res.json().catch(() => ({}));

      if (!res.ok) {
        setErreurNomEquipe(body?.message || "Impossible de vérifier le nom d’équipe.");
        return true;
      }

      if (body?.existe) {
        setErreurNomEquipe("Ce nom d’équipe est déjà utilisé pour ce tournoi.");
        return true;
      }

      setErreurNomEquipe("");
      return false;
    } catch {
      setErreurNomEquipe("Erreur réseau : impossible de vérifier le nom d’équipe.");
      return true;
    } finally {
      setVerificationNomEquipeEnCours(false);
    }
  }

  /**
   * Vérifie côté backend si le code d'équipe est valide
   * et si l'équipe peut encore être rejointe.
   *
   * @returns {Promise<boolean>} true si le code est invalide ou si une erreur survient
   */
  async function verifierCodeEquipeValide() {
    const numericId = Number(tournoiId);
    const codeEquipe = safeTrim(data.codeEquipe).toUpperCase();

    if (!Number.isInteger(numericId) || numericId <= 0 || !codeEquipe) {
      return true;
    }

    try {
      setVerificationCodeEquipeEnCours(true);
      setErreurCodeEquipe("");

      const res = await fetch(`${API_BASE_URL}/public/inscription/verifier-code-equipe`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tournoi_id: numericId,
          code_equipe: codeEquipe,
        }),
      });

      const body = await res.json().catch(() => ({}));

      if (!res.ok) {
        setErreurCodeEquipe(body?.message || "Impossible de vérifier le code d’équipe.");
        return true;
      }

      if (!body?.existe) {
        setErreurCodeEquipe(
          "Ce code d’équipe est invalide, ne correspond pas à ce tournoi ou l’équipe est déjà complète."
        );
        return true;
      }

      setErreurCodeEquipe("");
      return false;
    } catch {
      setErreurCodeEquipe("Erreur réseau : impossible de vérifier le code d’équipe.");
      return true;
    } finally {
      setVerificationCodeEquipeEnCours(false);
    }
  }

  /**
   * Soumet l'étape 2 après validation des règles métier.
   *
   * @param {React.FormEvent<HTMLFormElement>} ev Événement de soumission
   */
  async function handleSubmit(ev) {
    ev.preventDefault();

    setErreurNomEquipe("");
    setErreurCodeEquipe("");

    if (!data.type) return;
    if (estEquipe && !data.optionEquipe) return;
    if (estEquipe && data.optionEquipe === "creer" && !safeTrim(data.nomEquipe)) return;
    if (estEquipe && data.optionEquipe === "rejoindre" && !safeTrim(data.codeEquipe)) return;
    if (estSponsor && data.formulesChoisies.length === 0) return;
    if (estSponsor && !sponsorJoueursComplets(data, formules)) return;
    if (estSponsor && sponsorJoueursOntDesDoublons(data, formules)) return;
    if (estSponsor && sponsorNomsDejaPris) return;

    if (estEquipe && data.optionEquipe === "creer") {
      const nomExisteDeja = await verifierNomEquipeDejaExistant();
      if (nomExisteDeja) return;
    }

    if (estEquipe && data.optionEquipe === "rejoindre") {
      const codeInvalide = await verifierCodeEquipeValide();
      if (codeInvalide) return;
    }

    onNext();
  }

  return (
    <div>
      <h2 className="regCard__h2">Type de participation</h2>
      <p className="regCard__sub">
        Sélectionnez comment vous souhaitez participer au tournoi.
      </p>

      <form className="regForm" onSubmit={handleSubmit} noValidate>
        <div className="regTypeGrid">
          {types.map((t) => {
            const sel = data.type === t.val;

            return (
              <button
                key={t.val}
                type="button"
                className={`regTypeCard${sel ? " regTypeCard--active" : ""}`}
                onClick={() => {
                  onChange("type", t.val);
                  onChange("optionEquipe", "");
                  onChange("nomEquipe", "");
                  onChange("codeEquipe", "");
                  onChange("formulesChoisies", []);
                  onChange("joueursParType", {});
                  setErreurNomEquipe("");
                  setErreurCodeEquipe("");
                }}
              >
                <div className="regTypeCard__label">{t.label}</div>
                <div className="regTypeCard__desc">{t.desc}</div>
              </button>
            );
          })}
        </div>

        {estEquipe && (
          <div className="regSection">
            <h3 className="regSection__title">Options d'équipe</h3>

            <div className="regTeamGrid">
              {[
                {
                  val: "creer",
                  label: "Créer une équipe",
                  desc: "Créer une nouvelle équipe. Un code sera généré à la validation.",
                },
                {
                  val: "rejoindre",
                  label: "Rejoindre une équipe",
                  desc: "Utiliser un code d'équipe déjà généré.",
                },
              ].map((opt) => {
                const sel = data.optionEquipe === opt.val;

                return (
                  <button
                    key={opt.val}
                    type="button"
                    disabled={
                      (opt.val === "creer" &&
                        disponibilite &&
                        !disponibilite.peutCreerEquipe) ||
                      (opt.val === "rejoindre" &&
                        disponibilite &&
                        !disponibilite.peutRejoindreEquipe)
                    }
                    className={`regTeamCard${sel ? " regTeamCard--active" : ""}`}
                    onClick={() => {
                      if (
                        opt.val === "creer" &&
                        disponibilite &&
                        !disponibilite.peutCreerEquipe
                      ) {
                        return;
                      }

                      if (
                        opt.val === "rejoindre" &&
                        disponibilite &&
                        !disponibilite.peutRejoindreEquipe
                      ) {
                        return;
                      }

                      onChange("optionEquipe", opt.val);
                      onChange("nomEquipe", "");
                      onChange("codeEquipe", "");
                      setErreurNomEquipe("");
                      setErreurCodeEquipe("");
                    }}
                  >
                    <div className="regTeamCard__label">{opt.label}</div>
                    <div className="regTeamCard__desc">{opt.desc}</div>
                  </button>
                );
              })}
            </div>

            {disponibilite &&
              !disponibilite.peutCreerEquipe &&
              disponibilite.peutRejoindreEquipe && (
                <p
                  className="hintText"
                  style={{ marginTop: 12, color: "#9f1239", fontWeight: 600 }}
                >
                  La création d’une nouvelle équipe n’est plus possible pour ce tournoi.
                  Veuillez rejoindre une équipe existante.
                </p>
              )}

            {disponibilite &&
              !disponibilite.peutCreerEquipe &&
              !disponibilite.peutRejoindreEquipe && (
                <p
                  className="hintText"
                  style={{ marginTop: 12, color: "#9f1239", fontWeight: 600 }}
                >
                  Aucune place n’est encore disponible pour les participants.
                </p>
              )}

            {data.optionEquipe === "creer" && (
              <div className="field" style={{ marginTop: 16 }}>
                <label className="label" htmlFor="nomEquipe">
                  Nom de l'équipe *
                </label>
                <input
                  id="nomEquipe"
                  className={`input${erreurNomEquipe ? " input--error" : ""}`}
                  value={data.nomEquipe}
                  onChange={(e) => {
                    onChange("nomEquipe", e.target.value);
                    if (erreurNomEquipe) {
                      setErreurNomEquipe("");
                    }
                  }}
                  placeholder="Executive Eagles"
                />
                {erreurNomEquipe && (
                  <span className="fieldError">{erreurNomEquipe}</span>
                )}
                <p className="hintText">
                  Un code unique sera généré automatiquement lorsque vous validerez
                  l'inscription.
                </p>
              </div>
            )}

            {data.optionEquipe === "rejoindre" && (
              <div className="field" style={{ marginTop: 16 }}>
                <label className="label" htmlFor="codeEquipe">
                  Code d'équipe *
                </label>
                <input
                  id="codeEquipe"
                  className={`input${erreurCodeEquipe ? " input--error" : ""}`}
                  value={data.codeEquipe}
                  onChange={(e) => {
                    onChange("codeEquipe", e.target.value.toUpperCase());
                    if (erreurCodeEquipe) {
                      setErreurCodeEquipe("");
                    }
                  }}
                  placeholder="ABC123"
                  style={{ fontFamily: "monospace", letterSpacing: 2 }}
                />
                {erreurCodeEquipe && (
                  <span className="fieldError">{erreurCodeEquipe}</span>
                )}
                <p className="hintText">
                  Entrez le code fourni par le capitaine de l'équipe.
                </p>
              </div>
            )}
          </div>
        )}

        {estSponsor && (
          <div className="regSection">
            <h3 className="regSection__title">Choisissez votre formule</h3>
            <p className="hintText" style={{ marginBottom: 10 }}>
              Une seule formule commanditaire peut etre selectionnee a la fois.
            </p>

            <div className="regPkgGrid">
              {formules.map((f) => {
                const sel = data.formulesChoisies.includes(f.id);
                const tc = TIER_COLORS[f.tier] || TIER_COLORS.argent;
                const places = f.placesIncluses ?? 0;
                const complet = Boolean(f.complet);
                const descPoints = descriptionToPoints(f.description);
                const dispo = Math.max(0, Number(f.quota || 0) - Number(f.vendus || 0));
                const estLimite = !complet && Number(f.quota || 0) > 0 && dispo <= 2;

                return (
                  <button
                    key={f.id}
                    type="button"
                    disabled={complet}
                    className={`sponsorCard sponsorCard--${f.tier} regSponsorCardChoice${
                      sel ? " regSponsorCardChoice--active" : ""
                    }`}
                    style={{ "--pkg-accent": tc.accent }}
                    onClick={() => onToggleFormule(f.id)}
                  >
                    <div className={`sponsorCard__badge sponsorCard__badge--${f.tier}`}>
                      {tierLabel(f.tier)}
                    </div>

                    <div className="sponsorCard__name">{f.nom}</div>

                    <div className={`sponsorCard__price sponsorCard__price--${f.tier}`}>
                      {Number(f.prix || 0).toLocaleString("fr-CA", {
                        style: "currency",
                        currency: "CAD",
                        maximumFractionDigits: 0,
                      })}
                    </div>

                    <div className="sponsorCard__priceNote">par tournoi</div>

                    <div className="sponsorCard__slots">
                      <span className="sponsorCard__slotsIcon" aria-hidden="true">
                        <IconUsers size={16} />
                      </span>
                      <span>
                        {places} place{places > 1 ? "s" : ""} de joueur incluse
                        {places > 1 ? "s" : ""}
                      </span>
                    </div>

                    {descPoints.length > 0 ? (
                      <ul className="sponsorCard__benefits">
                        {descPoints.map((point, idx) => (
                          <li key={`${f.id}-desc-${idx}`} className="sponsorCard__benefitRow">
                            <span
                              className={`sponsorCard__checkCircle sponsorCard__checkCircle--${f.tier}`}
                              aria-hidden="true"
                            >
                              <IconCheck size={12} strokeWidth={2.5} />
                            </span>
                            <span>{point}</span>
                          </li>
                        ))}
                      </ul>
                    ) : null}

                    {complet ? (
                      <div className="sponsorCard__avail--limited">
                        <span aria-hidden="true">
                          <IconWarning size={14} />
                        </span>
                        <span>Complet — plus de place pour ce forfait</span>
                      </div>
                    ) : estLimite ? (
                      <div className="sponsorCard__avail--limited">
                        <span aria-hidden="true">
                          <IconWarning size={14} />
                        </span>
                        <span>Seulement {dispo} sur {f.quota} restants</span>
                      </div>
                    ) : Number(f.quota || 0) > 0 ? (
                      <div className="sponsorCard__avail">
                        {dispo} sur {f.quota} disponibles
                      </div>
                    ) : null}
                  </button>
                );
              })}
            </div>

            {formules.length === 0 && (
              <p className="hintText">Aucune formule commanditaire disponible pour ce tournoi.</p>
            )}

            {data.formulesChoisies.length > 0 && (
              <div className="regSection" style={{ marginTop: 8 }}>
                <h3 className="regSection__title">Joueurs par forfait</h3>

                {sponsorDoublonsJoueurs && (
                  <p className="regJoueursErrorAlert" role="alert">
                    Deux joueurs ne peuvent pas avoir le même prénom et le même nom.
                    Modifiez les champs en double.
                  </p>
                )}

                {sponsorNomsDejaPris && (
                  <p className="regJoueursErrorAlert" role="alert">
                    {MSG_SPONSOR_JOUEUR_DEJA_INSCRIT}
                  </p>
                )}

                {data.formulesChoisies.map((fid) => {
                  const f = formules.find((x) => String(x.id) === String(fid));
                  const need = f?.placesIncluses ?? 0;
                  if (!f || need <= 0) return null;

                  const rows = data.joueursParType[String(fid)] || [];

                  return (
                    <div
                      key={fid}
                      className="regSection"
                      style={{
                        marginTop: 16,
                        padding: 16,
                        border: "1px solid var(--border)",
                        borderRadius: 12,
                      }}
                    >
                      <div
                        style={{
                          fontWeight: 700,
                          marginBottom: 12,
                          color: "var(--forest)",
                        }}
                      >
                        {f.nom} — {need} joueur{need > 1 ? "s" : ""}
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                        {rows.map((row, idx) => (
                          <div key={`${fid}-${idx}`} className="regForm__row2">
                            <div className="field">
                              <label className="label" htmlFor={`j-p-${fid}-${idx}`}>
                                Prénom joueur {idx + 1} *
                              </label>
                              <input
                                id={`j-p-${fid}-${idx}`}
                                className="input"
                                value={row.prenom}
                                onChange={(e) =>
                                  onJoueurChange(fid, idx, "prenom", e.target.value)
                                }
                              />
                            </div>

                            <div className="field">
                              <label className="label" htmlFor={`j-n-${fid}-${idx}`}>
                                Nom joueur {idx + 1} *
                              </label>
                              <input
                                id={`j-n-${fid}-${idx}`}
                                className="input"
                                value={row.nom}
                                onChange={(e) =>
                                  onJoueurChange(fid, idx, "nom", e.target.value)
                                }
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <div className="regNav">
          <button type="button" className="btnGhost" onClick={onBack}>
            ← Retour
          </button>

          <button
            type="submit"
            className="btnPrimary"
            style={{ minWidth: 160 }}
            disabled={
              verificationNomEquipeEnCours ||
              verificationCodeEquipeEnCours ||
              !data.type ||
              (estEquipe && !data.optionEquipe) ||
              (estEquipe &&
                data.optionEquipe === "creer" &&
                !safeTrim(data.nomEquipe)) ||
              (estEquipe &&
                data.optionEquipe === "rejoindre" &&
                !safeTrim(data.codeEquipe)) ||
              (estSponsor && data.formulesChoisies.length === 0) ||
              (estSponsor && !sponsorJoueursComplets(data, formules)) ||
              (estSponsor && sponsorDoublonsJoueurs) ||
              (estSponsor && sponsorNomsDejaPris)
            }
          >
            {verificationNomEquipeEnCours || verificationCodeEquipeEnCours
              ? "Vérification..."
              : "Continuer →"}
          </button>
        </div>
      </form>
    </div>
  );
}

/**
 * Étape 3 : confirmation finale avant redirection vers Stripe.
 *
 * Rôle :
 * - récapituler les informations saisies
 * - calculer le montant à payer
 * - déclencher le flux de paiement adapté
 *
 * @param {object} props Propriétés du composant
 * @returns {JSX.Element}
 */
function Etape3({ data, tournoi, tournoiId, formules, onBack }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const estSponsor = data.type === "commanditaire";
  const sponsorNomsDejaPris = useSponsorNomsDejaPris(tournoiId, estSponsor, data);

  const montantTotal = estSponsor
    ? data.formulesChoisies.reduce((s, id) => {
        const f = formules.find((x) => String(x.id) === String(id));
        return s + Number(f?.prix || 0);
      }, 0)
    : Number(tournoi?.prix_joueur || 0);

  /**
   * Lance la confirmation finale et démarre le flux Stripe.
   *
   * Cas commanditaire :
   * - crée d'abord la commandite en base
   * - puis demande une session Stripe
   *
   * Cas employé / retraité :
   * - demande directement une session Stripe
   */
  async function handleConfirm() {
    setError("");

    const numericId = Number(tournoiId);
    if (!Number.isInteger(numericId) || numericId <= 0) {
      setError("Tournoi invalide pour l'inscription.");
      return;
    }

    if (estSponsor) {
      const selectedTypeIds = data.formulesChoisies
        .map((id) => Number(id))
        .filter((id) => Number.isInteger(id) && id > 0);

      if (selectedTypeIds.length === 0) {
        setError("Veuillez sélectionner au moins une formule commanditaire.");
        return;
      }

      if (!sponsorJoueursComplets(data, formules)) {
        setError(
          "Veuillez compléter le prénom et le nom de chaque joueur pour vos forfaits commanditaires."
        );
        return;
      }

      if (sponsorJoueursOntDesDoublons(data, formules)) {
        setError(
          "Chaque joueur doit avoir une combinaison prénom et nom unique (pas deux fois la même personne)."
        );
        return;
      }

      if (sponsorNomsDejaPris) {
        setError(MSG_SPONSOR_JOUEUR_DEJA_INSCRIT);
        return;
      }

      setBusy(true);

      try {
        const joueurs_par_type = {};

        for (const tid of selectedTypeIds) {
          const rows = data.joueursParType[String(tid)] || [];
          joueurs_par_type[String(tid)] = rows.map((r) => ({
            prenom: safeTrim(r.prenom),
            nom: safeTrim(r.nom),
          }));
        }

        const resCommandite = await fetch(`${API_BASE_URL}/public/inscription/commanditaire`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tournoi_id: numericId,
            prenom: safeTrim(data.prenom),
            nom: safeTrim(data.nom),
            courriel: safeTrim(data.email),
            telephone: safeTrim(data.telephone),
            type_commandite_ids: selectedTypeIds,
            joueurs_par_type,
          }),
        });

        const bodyCommandite = await resCommandite.json().catch(() => ({}));

        if (!resCommandite.ok) {
          setError(bodyCommandite?.message || "Erreur lors de l'enregistrement de la commandite.");
          return;
        }

        const commanditeId =
          bodyCommandite?.commandite_id ??
          bodyCommandite?.commandite?.id ??
          bodyCommandite?.id ??
          null;

        if (!commanditeId) {
          setError(
            "La commandite a été créée, mais son identifiant est introuvable pour lancer le paiement."
          );
          return;
        }

        const resPaiement = await fetch(`${API_BASE_URL}/payments/create-checkout-session`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            typePaiement: "commandite",
            tournoi_id: numericId,
            commandite_id: Number(commanditeId),
            courriel: safeTrim(data.email),
            montant: montantTotal,
          }),
        });

        const bodyPaiement = await resPaiement.json().catch(() => ({}));

        if (!resPaiement.ok) {
          setError(bodyPaiement?.message || "Erreur lors de la préparation du paiement Stripe.");
          return;
        }

        if (!bodyPaiement?.url) {
          setError("URL Stripe introuvable pour la commandite.");
          return;
        }

        window.location.href = bodyPaiement.url;
        return;
      } catch {
        setError("Erreur réseau : impossible de contacter le serveur de paiement.");
      } finally {
        setBusy(false);
      }

      return;
    }

    const isEquipe = data.type === "employe" || data.type === "retraite";

    if (!isEquipe) {
      setError("Type de participation non pris en charge.");
      return;
    }

    if (data.optionEquipe === "creer" && !safeTrim(data.nomEquipe)) {
      setError("Le nom d'équipe est requis pour créer une équipe.");
      return;
    }

    if (data.optionEquipe === "rejoindre" && !safeTrim(data.codeEquipe)) {
      setError("Le code d'équipe est requis pour rejoindre une équipe.");
      return;
    }

    const payload = {
      tournoi_id: numericId,
      prenom: safeTrim(data.prenom),
      nom: safeTrim(data.nom),
      courriel: safeTrim(data.email),
      telephone: safeTrim(data.telephone),
      optionEquipe: data.optionEquipe,
      nom_equipe: safeTrim(data.nomEquipe),
      code_equipe: safeTrim(data.codeEquipe).toUpperCase(),
      categorie_participant: data.type === "retraite" ? "retraite" : "employe",
    };

    setBusy(true);

    try {
      const res = await fetch(`${API_BASE_URL}/payments/create-checkout-session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const dataRes = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(dataRes?.message || "Erreur lors de la préparation du paiement.");
        return;
      }

      if (!dataRes?.url) {
        setError("URL Stripe introuvable.");
        return;
      }

      window.location.href = dataRes.url;
    } catch {
      setError("Erreur réseau : impossible de contacter le serveur de paiement.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h2 className="regCard__h2">Confirmation</h2>
      <p className="regCard__sub">
        Vérifiez les informations ci-dessous avant de continuer.
      </p>

      <div className="regSummary">
        <div className="regSummary__section">
          <h3 className="regSection__title">Coordonnées</h3>

          <div className="regSummary__line">
            <span>Prénom</span>
            <strong>{safeTrim(data.prenom) || "—"}</strong>
          </div>

          <div className="regSummary__line">
            <span>Nom</span>
            <strong>{safeTrim(data.nom) || "—"}</strong>
          </div>

          <div className="regSummary__line">
            <span>Courriel</span>
            <strong>{safeTrim(data.email) || "—"}</strong>
          </div>

          <div className="regSummary__line">
            <span>Téléphone</span>
            <strong>{safeTrim(data.telephone) || "—"}</strong>
          </div>

          <div className="regSummary__line">
            <span>Type</span>
            <strong>{safeTrim(data.type) || "—"}</strong>
          </div>
        </div>

        <div className="regSummary__section">
          <h3 className="regSection__title">Participation</h3>

          {!estSponsor ? (
            <>
              <div className="regSummary__line">
                <span>Option d'équipe</span>
                <strong>{safeTrim(data.optionEquipe) || "—"}</strong>
              </div>

              {data.optionEquipe === "creer" && (
                <div className="regSummary__line">
                  <span>Nom de l'équipe</span>
                  <strong>{safeTrim(data.nomEquipe) || "—"}</strong>
                </div>
              )}

              {data.optionEquipe === "rejoindre" && (
                <div className="regSummary__line">
                  <span>Code d'équipe</span>
                  <strong>{safeTrim(data.codeEquipe) || "—"}</strong>
                </div>
              )}
            </>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {data.formulesChoisies.map((fid) => {
                const f = formules.find((x) => String(x.id) === String(fid));
                const rows = data.joueursParType[String(fid)] || [];
                if (!f) return null;

                return (
                  <div
                    key={fid}
                    style={{
                      border: "1px solid var(--border, #e5e7eb)",
                      borderRadius: 12,
                      padding: 14,
                    }}
                  >
                    <div style={{ fontWeight: 700, marginBottom: 8 }}>
                      {f.nom} —{" "}
                      {Number(f.prix || 0).toLocaleString("fr-CA", {
                        style: "currency",
                        currency: "CAD",
                        maximumFractionDigits: 0,
                      })}
                    </div>

                    {rows.length > 0 && (
                      <ul style={{ margin: 0, paddingLeft: 18 }}>
                        {rows.map((r, i) => (
                          <li key={i}>
                            {safeTrim(r.prenom)} {safeTrim(r.nom)}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className="regSummary__total">
            <span>Total</span>
            <span className="regSummary__totalAmt">
              {Number(montantTotal || 0).toLocaleString("fr-CA", {
                style: "currency",
                currency: "CAD",
                maximumFractionDigits: 2,
              })}
            </span>
          </div>
        </div>

        <div>
          <h3 className="regSection__title">Paiement</h3>

          <div
            className="regSecurityNote"
            style={{
              background: "rgba(46,139,87,.06)",
              borderColor: "rgba(46,139,87,.25)",
              marginTop: 0,
            }}
          >
            <div>
              <div
                style={{
                  fontWeight: 700,
                  marginBottom: 4,
                  color: "var(--graphite, #1f2937)",
                }}
              >
                Paiement sécurisé avec Stripe
              </div>

              <p style={{ margin: 0 }}>
                En cliquant sur le bouton ci-dessous, vous serez redirigé vers
                Stripe pour compléter votre paiement en toute sécurité.
              </p>
            </div>
          </div>
        </div>
      </div>

      {estSponsor && sponsorNomsDejaPris && (
        <p className="regJoueursErrorAlert" role="alert" style={{ marginTop: 20 }}>
          {MSG_SPONSOR_JOUEUR_DEJA_INSCRIT}
        </p>
      )}

      {error && (
        <div
          style={{
            marginTop: 20,
            padding: "10px 14px",
            borderRadius: 8,
            border: "1px solid var(--danger, #dc2626)",
            color: "var(--danger, #dc2626)",
            fontSize: 14,
          }}
        >
          {error}
        </div>
      )}

      <div
        className="regNav"
        style={{
          borderTop: "1px solid var(--border, #e5e7eb)",
          paddingTop: 24,
          marginTop: 24,
        }}
      >
        <button type="button" className="btnGhost" onClick={onBack}>
          ← Retour
        </button>

        <button
          type="button"
          className="btnPrimary"
          style={{ minWidth: 240, background: "var(--emerald, #2e8b57)" }}
          onClick={handleConfirm}
          disabled={busy || (estSponsor && sponsorNomsDejaPris)}
        >
          {busy ? "Traitement..." : "Payer avec Stripe"}
        </button>
      </div>
    </div>
  );
}

/**
 * Composant principal de la page d'inscription.
 *
 * Rôle :
 * - charger les données nécessaires à l'inscription
 * - déterminer si le tournoi est complet
 * - afficher soit :
 *   - le formulaire en 3 étapes
 *   - soit un message de fermeture si le tournoi est complet
 *
 * @returns {JSX.Element}
 */
export default function InscriptionTournoi() {
  const { tournoiId } = useParams();

  const [etape, setEtape] = useState(1);
  const [data, setData] = useState(initialFormData());
  const [tournoi, setTournoi] = useState(null);
  const [formules, setFormules] = useState([]);
  const [loadingTournoi, setLoadingTournoi] = useState(true);
  const [tournoiError, setTournoiError] = useState("");
  const [disponibilite, setDisponibilite] = useState(null);

  /**
   * Charge le tournoi actif depuis le backend.
   */
  useEffect(() => {
    let ignore = false;

    async function chargerTournoi() {
      setLoadingTournoi(true);
      setTournoiError("");

      try {
        const res = await fetch(`${API_BASE_URL}/public/tournoi-actif`);
        const body = await res.json().catch(() => ({}));

        if (!res.ok) {
          if (!ignore) {
            setTournoi(null);
            setTournoiError(body?.message || "Impossible de charger le tournoi actif.");
          }
          return;
        }

        if (!ignore) {
          setTournoi(body);
        }
      } catch {
        if (!ignore) {
          setTournoi(null);
          setTournoiError("Impossible de joindre le serveur.");
        }
      } finally {
        if (!ignore) {
          setLoadingTournoi(false);
        }
      }
    }

    chargerTournoi();

    return () => {
      ignore = true;
    };
  }, []);

  /**
   * Détermine l'identifiant du tournoi réellement utilisé.
   *
   * Priorité :
   * 1) paramètre d'URL
   * 2) identifiant du tournoi actif chargé depuis le backend
   */
  const effectiveTournoiId = useMemo(() => {
    if (tournoiId) return tournoiId;
    if (tournoi?.id) return String(tournoi.id);
    return "";
  }, [tournoiId, tournoi]);

  /**
   * Charge la disponibilité du tournoi :
   * - possibilité de créer une équipe
   * - possibilité de rejoindre une équipe
   * - éventuelle information de complétion
   */
  useEffect(() => {
    let ignore = false;

    async function chargerDisponibilite() {
      const numericId = Number(effectiveTournoiId);

      if (!Number.isInteger(numericId) || numericId <= 0) {
        if (!ignore) setDisponibilite(null);
        return;
      }

      try {
        const res = await fetch(
          `${API_BASE_URL}/public/disponibilite-tournoi?tournoi_id=${numericId}`
        );

        const body = await res.json().catch(() => ({}));

        if (!res.ok) {
          if (!ignore) setDisponibilite(null);
          return;
        }

        if (!ignore) {
          setDisponibilite(body);
        }
      } catch {
        if (!ignore) {
          setDisponibilite(null);
        }
      }
    }

    chargerDisponibilite();

    return () => {
      ignore = true;
    };
  }, [effectiveTournoiId]);

  /**
   * Charge les types de commandites disponibles pour le tournoi.
   */
  useEffect(() => {
    let ignore = false;

    async function chargerTypesCommandites() {
      const numericId = Number(effectiveTournoiId);
      if (!Number.isInteger(numericId) || numericId <= 0) return;

      try {
        const res = await fetch(
          `${API_BASE_URL}/public/types-commandites?tournoi_id=${numericId}`
        );
        const body = await res.json().catch(() => []);

        if (!res.ok || !Array.isArray(body) || body.length === 0) {
          if (!ignore) {
            setFormules([]);
            setData((prev) => ({
              ...prev,
              formulesChoisies: [],
              joueursParType: {},
            }));
          }
          return;
        }

        const mapped = body.map((item) => {
          const id = String(item.id);
          const nom = item.nom || `Formule ${item.id}`;

          const prix =
            item.prix_cents != null
              ? Number(item.prix_cents) / 100
              : item.prix != null
              ? Number(item.prix)
              : 0;

          const placesIncluses = Number(item.places_incluses ?? 0);
          const quota = Number(item.quota ?? 0);
          const nb = Number(item.nb_commandites ?? 0);
          const complet = quota > 0 && nb >= quota;
          const description =
            typeof item.description === "string" ? item.description.trim() : "";

          return {
            id,
            nom,
            prix,
            tier: getFormuleTier(nom),
            placesIncluses,
            quota,
            vendus: nb,
            complet,
            description,
          };
        });

        if (!ignore) {
          setFormules(mapped);

          setData((prev) => {
            const blocked = new Set(
              mapped.filter((f) => f.complet).map((f) => String(f.id))
            );

            const nextIds = prev.formulesChoisies.filter(
              (fid) => !blocked.has(String(fid))
            );

            return {
              ...prev,
              formulesChoisies: nextIds,
              joueursParType: syncJoueursParType(
                nextIds,
                mapped,
                prev.joueursParType
              ),
            };
          });
        }
      } catch {
        if (!ignore) {
          setFormules([]);
          setData((prev) => ({
            ...prev,
            formulesChoisies: [],
            joueursParType: {},
          }));
        }
      }
    }

    chargerTypesCommandites();

    return () => {
      ignore = true;
    };
  }, [effectiveTournoiId]);

  /**
   * Détermine si le tournoi doit être considéré comme complet.
   *
   * Sources possibles :
   * - drapeau explicite du tournoi
   * - drapeau explicite de disponibilité
   * - impossibilité de créer ou rejoindre une équipe
   *
   * Si ce booléen vaut true, la page remplace le formulaire
   * par un message indiquant que les inscriptions sont fermées.
   */
  const tournoiComplet = useMemo(() => {
    const completDepuisTournoi =
      Boolean(tournoi?.complet) ||
      Boolean(tournoi?.tournoi_complet) ||
      Boolean(tournoi?.inscription_complete);

    const completDepuisDisponibilite =
      Boolean(disponibilite?.complet) ||
      Boolean(disponibilite?.tournoiComplet) ||
      Boolean(disponibilite?.tournoi_complet) ||
      (disponibilite &&
        disponibilite.peutCreerEquipe === false &&
        disponibilite.peutRejoindreEquipe === false);

    return completDepuisTournoi || completDepuisDisponibilite;
  }, [tournoi, disponibilite]);

  /**
   * Met à jour un champ simple du formulaire.
   *
   * @param {string} field Nom du champ
   * @param {any} value Nouvelle valeur
   */
  function onChange(field, value) {
    setData((prev) => ({ ...prev, [field]: value }));
  }

  /**
   * Gère la sélection d'une formule commanditaire.
   *
   * Règle :
   * - une seule formule à la fois
   * - si la formule est complète, rien ne se passe
   *
   * @param {string|number} rawId Identifiant brut de formule
   */
  function onToggleFormule(rawId) {
    const id = String(rawId);
    const f = formules.find((x) => String(x.id) === id);
    if (f?.complet) return;

    setData((prev) => {
      const exists = prev.formulesChoisies.includes(id);
      const nextIds = exists ? [] : [id];

      return {
        ...prev,
        formulesChoisies: nextIds,
        joueursParType: syncJoueursParType(nextIds, formules, prev.joueursParType),
      };
    });
  }

  /**
   * Met à jour le prénom ou le nom d'un joueur commandité.
   *
   * @param {string|number} rawTypeId Identifiant de la formule
   * @param {number} index Position du joueur
   * @param {"prenom"|"nom"} champ Champ à modifier
   * @param {string} valeur Nouvelle valeur
   */
  function onJoueurChange(rawTypeId, index, champ, valeur) {
    const typeId = String(rawTypeId);

    setData((prev) => {
      const next = { ...prev.joueursParType };
      const rows = next[typeId] ? [...next[typeId]] : [];
      rows[index] = { ...(rows[index] || { prenom: "", nom: "" }), [champ]: valeur };
      next[typeId] = rows;
      return { ...prev, joueursParType: next };
    });
  }

  if (loadingTournoi) {
    return (
      <div className="registrationPage">
        <div className="registrationShell">
          <div className="regCard">
            <p>Chargement du tournoi…</p>
          </div>
        </div>
      </div>
    );
  }

  if (tournoiError) {
    return (
      <div className="registrationPage">
        <div className="registrationShell">
          <div className="regCard">
            <div
              style={{
                padding: "14px 16px",
                borderRadius: 10,
                border: "1px solid #dc2626",
                color: "#dc2626",
                background: "#fff7f7",
              }}
            >
              {tournoiError}
            </div>

            <div style={{ marginTop: 20 }}>
              <Link to="/tournoi" className="btnPrimary" style={{ textDecoration: "none" }}>
                Retour aux tournois
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (tournoiComplet) {
    return (
      <div className="registrationPage">
        <div className="registrationHero">
          <div className="registrationHero__content">
            <p className="eyebrow">Tournoi de golf</p>
            <h1 className="registrationHero__title">Inscriptions fermées</h1>
            <p className="registrationHero__text">
              Le tournoi est actuellement complet.
            </p>
          </div>
        </div>

        <div className="registrationShell">
          <div className="regCard">
            <div
              style={{
                padding: "22px 20px",
                borderRadius: 14,
                border: "1px solid #d4a017",
                background: "#fffaf0",
                color: "#1f2937",
              }}
            >
              <h2
                style={{
                  marginTop: 0,
                  marginBottom: 10,
                  color: "var(--forest, #16352b)",
                }}
              >
                Tournoi complet
              </h2>

              <p style={{ margin: 0, lineHeight: 1.7 }}>
                Merci pour votre intérêt. Le tournoi a atteint sa capacité maximale
                et les inscriptions sont temporairement indisponibles. Veuillez
                revenir plus tard ou communiquer avec l’administration du tournoi
                pour toute question.
              </p>
            </div>

            <div style={{ marginTop: 20 }}>
              <Link
                to="/tournoi"
                className="btnPrimary"
                style={{ textDecoration: "none" }}
              >
                Retour aux tournois
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="registrationPage">
      <div className="registrationHero">
        <div className="registrationHero__content">
          <p className="eyebrow">Tournoi de golf</p>
          <h1 className="registrationHero__title">Inscription au tournoi</h1>
          <p className="registrationHero__text">
            Complétez les étapes ci-dessous pour confirmer votre participation.
          </p>
        </div>
      </div>

      <div className="registrationShell">
        <Stepper etape={etape} />

        <div className="regCard">
          {etape === 1 && (
            <Etape1
              data={data}
              tournoiId={effectiveTournoiId}
              onChange={onChange}
              onNext={() => setEtape(2)}
            />
          )}

          {etape === 2 && (
            <Etape2
              data={data}
              formules={formules}
              tournoiId={effectiveTournoiId}
              disponibilite={disponibilite}
              onChange={onChange}
              onNext={() => setEtape(3)}
              onBack={() => setEtape(1)}
              onToggleFormule={onToggleFormule}
              onJoueurChange={onJoueurChange}
            />
          )}

          {etape === 3 && (
            <Etape3
              data={data}
              tournoi={tournoi}
              tournoiId={effectiveTournoiId}
              formules={formules}
              onBack={() => setEtape(2)}
            />
          )}
        </div>
      </div>
    </div>
  );
}