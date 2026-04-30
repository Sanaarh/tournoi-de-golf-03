

-- Admin
CREATE TABLE IF NOT EXISTS administrateurs (
  id SERIAL PRIMARY KEY,
  nom_utilisateur VARCHAR(50) UNIQUE NOT NULL,
  mot_de_passe_hash TEXT NOT NULL,
  date_creation TIMESTAMP DEFAULT NOW()
);

-- Tournois
CREATE TABLE IF NOT EXISTS tournois (
  id SERIAL PRIMARY KEY,
  nom VARCHAR(120) NOT NULL,
  lieu VARCHAR(120),
  date_tournoi DATE NOT NULL,

  inscription_debut DATE,
  inscription_fin DATE,
  inscriptions_ouvertes BOOLEAN NOT NULL DEFAULT FALSE,

  capacite_joueurs INTEGER NOT NULL  DEFAULT 0 CHECK (capacite_joueurs >= 0 AND capacite_joueurs % 4 = 0),
  nombre_equipes_max INTEGER NOT NULL DEFAULT 0 CHECK (nombre_equipes_max >= 0),
 
  limite_commandites INTEGER NOT NULL DEFAULT 0 CHECK (limite_commandites >= 0),
  prix_joueur NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (prix_joueur >= 0),
  date_creation TIMESTAMP NOT NULL DEFAULT NOW(),


  CONSTRAINT chk_periode_inscription
    CHECK (
      inscription_debut IS NULL
      OR inscription_fin IS NULL
      OR inscription_debut <= inscription_fin
    ),

  CONSTRAINT chk_equipes_vs_capacite
    CHECK (
      capacite_joueurs = 0
      OR nombre_equipes_max = 0
      OR nombre_equipes_max <= (capacite_joueurs / 4)
    )
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_un_seul_tournoi_ouvert
ON tournois (inscriptions_ouvertes)
WHERE inscriptions_ouvertes = TRUE;

-- Participants 
CREATE TABLE IF NOT EXISTS participants (
  id SERIAL PRIMARY KEY,
  tournoi_id INTEGER NOT NULL REFERENCES tournois(id) ON DELETE CASCADE,
  prenom VARCHAR(80) NOT NULL,
  nom VARCHAR(80) NOT NULL,
  courriel VARCHAR(150) NOT NULL,
  telephone VARCHAR(30),
  type_participant VARCHAR(30) NOT NULL
    CHECK (type_participant IN ('EMPLOYE','RETRAITE','EMPLOYE_RETRAITE','JOUEUR_COMMANDITE')),
  date_creation TIMESTAMP DEFAULT NOW(),

  CONSTRAINT uq_participant_tournoi_courriel UNIQUE (tournoi_id, courriel)
);

-- Équipes
CREATE TABLE IF NOT EXISTS equipes (
  id SERIAL PRIMARY KEY,
  tournoi_id INTEGER NOT NULL REFERENCES tournois(id) ON DELETE CASCADE,
  nom_equipe VARCHAR(120),
  code_secret VARCHAR(20) UNIQUE NOT NULL,
  date_creation TIMESTAMP DEFAULT NOW()
);

-- Membres des équipes
CREATE TABLE IF NOT EXISTS membres_equipes (
  id SERIAL PRIMARY KEY,
  equipe_id INTEGER NOT NULL REFERENCES equipes(id) ON DELETE CASCADE,
  participant_id INTEGER NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  
  CONSTRAINT uq_membre_equipe UNIQUE (equipe_id, participant_id),
  CONSTRAINT uq_participant_une_seule_equipe UNIQUE (participant_id)
);

-- Types de commandites
CREATE TABLE IF NOT EXISTS types_commandites (
  id SERIAL PRIMARY KEY,
  tournoi_id INTEGER NOT NULL REFERENCES tournois(id) ON DELETE CASCADE,
  nom VARCHAR(120) NOT NULL,
  prix_cents INTEGER NOT NULL CHECK (prix_cents >= 0),
  quota INTEGER NOT NULL CHECK (quota >= 1),
  places_incluses INTEGER NOT NULL CHECK (places_incluses >= 0),
  description TEXT,
  date_creation TIMESTAMP DEFAULT NOW()
);

-- Commandites (inscriptions commanditaires)
-- Commandites (inscriptions commanditaires)
CREATE TABLE IF NOT EXISTS commandites (
  id SERIAL PRIMARY KEY,
  tournoi_id INTEGER NOT NULL REFERENCES tournois(id) ON DELETE CASCADE,
  type_commandite_id INTEGER NOT NULL REFERENCES types_commandites(id),
  nom_entreprise VARCHAR(160) NOT NULL,
  nom_contact VARCHAR(160) NOT NULL,
  courriel_contact VARCHAR(160) NOT NULL,
  telephone_contact VARCHAR(30),
  statut VARCHAR(20) NOT NULL DEFAULT 'EN_ATTENTE'
    CHECK (statut IN ('EN_ATTENTE','PAYEE','ECHEC')),
  date_creation TIMESTAMP DEFAULT NOW()
);

-- Joueurs inclus dans une commandite (noms saisis à l'inscription, liés au forfait / places_incluses)
CREATE TABLE IF NOT EXISTS joueurs_commandites (
  id SERIAL PRIMARY KEY,
  commandite_id INTEGER NOT NULL REFERENCES commandites(id) ON DELETE CASCADE,
  prenom VARCHAR(80) NOT NULL,
  nom VARCHAR(80) NOT NULL,
  ordre INTEGER NOT NULL DEFAULT 0,
  participant_id INTEGER REFERENCES participants(id) ON DELETE SET NULL
);

-- Paiements
-- Paiements (XOR: soit participant, soit commandite)
CREATE TABLE IF NOT EXISTS paiements (
  id SERIAL PRIMARY KEY,
  tournoi_id INTEGER NOT NULL REFERENCES tournois(id) ON DELETE CASCADE,

  participant_id INTEGER REFERENCES participants(id) ON DELETE CASCADE,
  commandite_id INTEGER REFERENCES commandites(id) ON DELETE CASCADE,

  montant_cents INTEGER NOT NULL CHECK (montant_cents >= 0),
  devise VARCHAR(10) NOT NULL DEFAULT 'cad',

  stripe_session_id VARCHAR(255),
  stripe_payment_intent_id VARCHAR(255),

  statut VARCHAR(20) NOT NULL DEFAULT 'EN_ATTENTE'
    CHECK (statut IN ('EN_ATTENTE','PAYE','ECHEC')),

  date_creation TIMESTAMP DEFAULT NOW(),

CONSTRAINT chk_paiement_xor
  CHECK (
    NOT (participant_id IS NOT NULL AND commandite_id IS NOT NULL)
  )
);

-- Administrateur par défaut
INSERT INTO administrateurs (nom_utilisateur, mot_de_passe_hash)
VALUES (
  'admin',
  '$2b$10$wJ7Q/ok4So/KB3nW6Dl4OeKHY45DwNeU370vISMN1dGxRolGibv.6'
)
ON CONFLICT (nom_utilisateur) DO NOTHING;

