# Conception du socle Workspace — comptes, auth, équipes

Lot 0 du chantier Workspace (2026-08-20). Aucun code : un document de
décisions, à valider point par point. Le workspace est le socle du
P6 — quatre capacités en dépendent (dossier durable, rapports
partagés, recherches sauvegardées, alertes). Ce document conçoit le
minimum qui les porte toutes.

## Les trois contraintes, énoncées d'abord

**La doctrine URL ne bouge pas.** L'URL reste la seule vérité de
l'état produit. L'authentification est une couche d'IDENTITÉ qui
gouverne des droits d'accès à des objets du workspace — jamais le
contenu d'une vue. Deux membres d'un même workspace ouvrant la même
URL voient la même chose ; un anonyme ouvrant cette URL voit la même
chose aussi. Aucun chiffre, aucun périmètre, aucun classement ne
dépend de qui regarde. Ce que le compte ajoute : des POINTEURS nommés
vers des URLs (une recherche sauvegardée), des COLLECTIONS d'URLs (un
dossier), des DROITS sur ces pointeurs (qui les voit) et un TRANSPORT
(l'email d'une alerte). Chaque conception ci-dessous est vérifiée
contre cette règle en fin de section.

**Coût zéro ou presque.** Aucun service payant. Bilan en fin de
document : le socle proposé tient avec **zéro dépendance Python
nouvelle** (stdlib seule) et un envoi d'email configurable, gratuit
(SMTP existant ou palier gratuit interchangeable).

**Aucune promesse vide.** Chaque lot livre une capacité complète de
bout en bout. Le lot 1 ne livre pas « un écran de login » : il livre
le dossier durable — le login n'existe que parce qu'une capacité
l'exige ce jour-là.

---

## D1 — Méthode d'authentification

### Le fait qui précède le choix

L'infrastructure d'email est **inévitable** quel que soit le choix :
le lot 2 envoie des invitations d'équipe, le chantier alertes enverra
des emails, et un compte à mot de passe sans réinitialisation par
email est un compte mort à la première perte. La question n'est donc
pas « faut-il l'email », mais « que porte-t-il ».

### Les options

**(a) Email + mot de passe.** Universel (aucune dépendance à un
compte tiers). Surface : hachage (argon2 → une dépendance), flux de
réinitialisation (l'email quand même), politique de robustesse,
stockage d'un secret par utilisateur — la classe de données la plus
attaquée du web. L'email ne bloque que le reset, pas le login : bonne
résilience si l'envoi tombe.

**(b) Email + lien magique (magic link).** Un seul flux : saisir son
email, cliquer le lien reçu, session longue. Supprime un étage entier
de surface (aucun secret stocké, aucun hachage, aucun reset, aucune
politique, rien à fuiter). Tout tient en stdlib. Contrepartie : chaque
NOUVELLE session dépend de la délivrabilité de l'email — si l'envoi
tombe, on ne peut plus SE CONNECTER (les sessions en cours tiennent).

**(c) OAuth (Google, GitHub).** Zéro email à envoyer pour l'auth,
friction minimale pour qui a le compte tiers. Mais le public d'Orion
(chargés d'affaires, analystes financements, institutionnels
européens) vit largement sur des emails corporate Outlook/Exchange —
GitHub est improbable, Google non universel. OAuth seul exclut ;
OAuth en plus s'ajoute plus tard sans toucher au modèle.

### Recommandation : **le lien magique, seul** (b)

- Le public d'Orion est un public de VEILLE : on revient chaque
  semaine sur le même poste. Avec une session de 90 jours glissants,
  le lien magique se clique quelques fois par an et par appareil — la
  friction réelle est marginale.
- La surface de sécurité est la plus petite des trois : pas de mot de
  passe, c'est pas de fuite de mots de passe, pas de politique, pas de
  formulaire de reset à protéger. Pour une fondatrice seule au
  clavier, chaque étage non construit est un étage non exploité.
- Zéro dépendance : `secrets.token_urlsafe` + SHA-256 + `smtplib`
  (stdlib). Le mot de passe exigerait argon2.
- Réversible sans casse : ajouter plus tard un mot de passe (option a)
  ou un OAuth (option c) est additif — une colonne, une route ; le
  modèle utilisateur ne change pas.
- Le risque assumé (panne du fournisseur d'envoi = plus de NOUVELLES
  connexions) est borné par des sessions longues et un fournisseur
  interchangeable (D-coût), et il est réversible par (a) si l'usage le
  dément.

**En dev et en e2e** : pas d'email — le lien s'écrit dans la réponse
du serveur en mode `ORION_AUTH_DEV=1` (et dans les logs). La recette
locale ne dépend jamais d'une boîte mail.

**Doctrine URL** : l'auth n'ajoute que `/login` et une session. Aucune
vue existante ne change. ✓

---

## D2 — Modèle de données

### Le principe : le workspace est le seul contenant

Chaque utilisateur reçoit à l'inscription un **workspace personnel**
(nommé de son email, renommable). Il n'y a AUCUNE dualité
personnel/équipe dans le code : tout objet P6 appartient à un
workspace, point. Inviter quelqu'un dans son workspace personnel le
transforme de fait en espace d'équipe — c'est le même objet. Un
utilisateur peut appartenir à plusieurs workspaces (le consultant
multi-clients) : l'appartenance est une table, pas une colonne.

### Le schéma (cinq tables, deux migrations)

```
users
  id            PK
  email         TEXT UNIQUE NOT NULL   -- normalisé lower() à l'écriture
  display_name  TEXT
  created_at    TIMESTAMPTZ
  last_seen_at  TIMESTAMPTZ

login_tokens                    -- les liens magiques, à usage unique
  token_hash    TEXT PK         -- SHA-256 du token ; jamais le clair
  email         TEXT NOT NULL   -- l'email visé (compte existant ou non)
  expires_at    TIMESTAMPTZ     -- 15 minutes
  used_at       TIMESTAMPTZ     -- nullable ; non-null = mort

sessions
  token_hash    TEXT PK         -- SHA-256 du cookie ; le clair ne vit
  user_id       FK users        --   que dans le navigateur
  created_at    TIMESTAMPTZ
  last_used_at  TIMESTAMPTZ     -- glissement des 90 jours
  expires_at    TIMESTAMPTZ

workspaces
  id            PK
  name          TEXT NOT NULL
  created_by    FK users
  created_at    TIMESTAMPTZ

memberships
  workspace_id  FK workspaces   } PK composite
  user_id       FK users        }
  role          TEXT CHECK IN ('owner', 'member')
  joined_at     TIMESTAMPTZ
  invited_by    FK users NULL

invitations
  token_hash    TEXT PK         -- même hygiène que les liens magiques
  workspace_id  FK workspaces
  email         TEXT NOT NULL
  role          TEXT CHECK IN ('owner', 'member')
  invited_by    FK users
  expires_at    TIMESTAMPTZ     -- 7 jours
  accepted_at   TIMESTAMPTZ     -- nullable
```

- **Rôles : owner/member suffisent.** Le P6 n'exige que « gérer
  l'espace » (renommer, inviter, retirer) et « en être » (voir,
  contribuer). Un rôle de plus serait une promesse d'usine. La
  contrainte d'intégrité qui compte : un workspace a TOUJOURS au
  moins un owner (le dernier owner ne se retire pas).
- **Suppression de compte prévue au modèle** (l'email est une donnée
  personnelle) : `ON DELETE CASCADE` sur sessions et memberships ;
  un workspace dont le dernier membre part est supprimé avec ses
  objets. Une route de suppression au lot 1 — pas une promesse, une
  ligne de conformité.
- **Migrations** : `0030_users_sessions` (lot 1),
  `0031_workspaces_memberships_invitations` (lot 2). Le lot 1 crée
  quand même `workspaces`+`memberships` ? NON — voir D5 : le dossier
  durable du lot 1 s'accroche au workspace personnel, donc **0030
  porte les cinq tables sauf `invitations`**, et 0031 n'ajoute que
  `invitations`. Deux migrations, découpées par capacité livrée.

### La frontière avec le corpus

**Aucune FK du socle vers les tables du corpus, jamais.** Les objets
P6 référenceront le produit par ses identifiants PUBLICS (des URLs et
leurs paramètres, des slugs) — pas par des clés internes. Le corpus
se retague, se recharge, se reconstruit sans qu'un workspace le
retienne. C'est la doctrine URL appliquée au schéma.

**Doctrine URL** : le modèle ne stocke aucun état de vue — des
identités, des appartenances, des jetons. ✓

---

## D3 — Sessions et sécurité

Le strict nécessaire, bien fait :

- **Cookie httpOnly, token opaque** — pas de JWT. Un token aléatoire
  256 bits (`secrets.token_urlsafe(32)`), stocké HACHÉ (SHA-256) en
  base : un dump de la table ne donne aucune session utilisable, et
  la révocation est un DELETE. Le JWT n'apporte ici que des pièges
  (pas de révocation, algorithmes, bibliothèques) : Orion est un
  monolithe même-origine, le token opaque est exactement suffisant.
- **Attributs** : `HttpOnly; SameSite=Lax; Secure` (prod) ; `Path=/`.
  Front et API vivent derrière le MÊME Caddy (vérifié :
  `handle /api/*` → api, `handle` → web, une seule adresse) — pas de
  CORS, pas de domaine tiers.
- **Durée** : 90 jours glissants — `last_used_at` repousse
  l'échéance ; l'inactivité de 90 jours éteint la session. Le lien
  magique vit 15 minutes, usage unique.
- **CSRF** : `SameSite=Lax` couvre les navigateurs modernes ; en
  plus, les mutations (POST/PUT/DELETE) vérifient l'en-tête `Origin`
  contre l'origine du site — trois lignes, zéro bibliothèque, et le
  duo suffit pour un site même-origine sans formulaires cross-site.
- **Rate limiting** : sur la SEULE route sensible — la demande de
  lien magique : 5 demandes/heure par email ET par IP, comptées dans
  une table Postgres à fenêtre glissante (un INSERT + un COUNT ;
  zéro dépendance, la charge d'Orion n'exige pas Redis). Un dépassement
  répond 200 (même réponse que le succès : ne pas dire qui a un compte)
  et n'envoie rien.
- **Énumération d'emails** : la demande de lien répond toujours
  « si ce compte existe, un email part » — le même corps, le même
  temps de réponse approché.
- **Ce qu'on ne construit PAS, dit franchement** : 2FA, rotation de
  refresh tokens, politique de mots de passe (pas de mots de passe),
  captcha, détection d'anomalies, audit log. Un produit pré-clients
  au risque essentiellement nul de ciblage n'exploite aucun de ces
  étages ; chacun pourra s'ajouter sans refonte (le modèle sessions
  les permet tous).

**Doctrine URL** : la session est un cookie, invisible dans l'URL ;
aucun token n'apparaît jamais dans une URL de vue (le lien magique vit
sur `/login/verify?...`, une route d'identité, pas une vue produit,
consommée puis redirigée). ✓

---

## D4 — La frontière anonyme/connecté

**Le produit public ne recule pas.** Tout Orion actuel — corpus,
lentilles, explorateur, hubs, analyses, dossier de session — reste
accessible sans compte, à l'identique. Aucune vue existante ne passe
derrière l'authentification, jamais.

**Ce qui exige un compte** — exactement trois verbes, ceux du P6 :

| Verbe | Capacité |
|---|---|
| **Garder** (au-delà du navigateur) | dossier durable, recherches sauvegardées |
| **Partager** (à des personnes) | workspace, rapports partagés |
| **Être prévenu** | alertes |

Rien d'autre. Consulter, explorer, composer, exporter, copier une URL :
jamais.

**Comment l'écran le dit, sans harceler :**

- Au point d'usage, une seule fois : le bandeau du dossier session dit
  déjà « conservé dans ce navigateur » — il gagnera « … — se connecter
  pour le garder », un lien dans la phrase existante, pas un modal.
- Le header gagne UNE entrée sobre à droite (« Se connecter » ;
  connecté : l'initiale + un menu de trois lignes : mon espace,
  langue de compte plus tard, se déconnecter).
- **Jamais** : de bannière d'accueil, de modal à l'arrivée, de
  compteur de vues, de fonctionnalité grisée-cliquable qui mène à un
  mur de login. Une capacité non disponible sans compte s'ANNONCE au
  point d'usage, elle ne se fait pas désirer.

**Doctrine URL** : un anonyme et un connecté sur la même URL de vue
voient le même contenu, au chiffre près. Les objets de workspace ont
leurs PROPRES URLs (`/workspace/...`), soumises aux droits — ce sont
des pages d'objets privés, pas des vues du produit ; une URL de vue
produit n'est jamais soumise à un droit. ✓

---

## D5 — Le rattachement des quatre capacités P6

Le principe unique : **une capacité P6 est un objet nommé, appartenant
à un workspace, dont le contenu est une URL du produit (ou une liste
d'URLs)**. La doctrine URL devient le mécanisme même de la sauvegarde.

| Capacité | L'objet | Ce que le socle prévoit dès maintenant |
|---|---|---|
| **Recherche sauvegardée** | une URL nommée : `{workspace_id, name, url_params TEXT, created_by}` | rien de plus que `workspaces` — la table arrive avec sa capacité |
| **Dossier durable** | le dossier session actuel + `workspace_id` : une liste ordonnée d'items `{params, title, note}` | le FORMAT des items localStorage ([dossier.ts](../frontend/src/lib/dossier.ts)) est déjà le schéma serveur — « garder » = POST des items tels quels |
| **Rapport partagé** | un dossier (ou une vue) rendu visible aux membres du workspace ; digest plus tard | owner/member suffisent ; la visibilité est une colonne de l'objet, pas un système |
| **Alerte** | un abonnement : `{workspace_id, cible (slug/id public), canal}` | l'infra email (déjà là pour les liens magiques et invitations) ; les événements d'ingestion sont le chantier alertes, pas le socle |

Ce que le socle GARANTIT et rien de plus : une identité (`users`), un
contenant (`workspaces`), une appartenance avec droits
(`memberships`), un transport (l'email), et la convention du pointeur
(du TEXT d'URL params, jamais une FK vers le corpus). Chaque capacité
arrive ensuite avec sa table, son lot, sa recette — sans refonte.

**Doctrine URL** : la « sauvegarde » d'une recherche EST une URL ;
l'ouvrir, c'est naviguer vers cette URL — le contenu vu est celui que
tout le monde verrait sur la même URL. ✓

---

## D6 — Découpage en lots

Chaque lot livre une capacité complète ; l'écran ne promet jamais en
avance (les badges P6 restent tant que leur capacité n'est pas là, et
tombent avec elle).

**Lot 1 — comptes + le dossier durable** (la première capacité de
bout en bout).
Contenu : migration 0030 (users, login_tokens, sessions, workspaces,
memberships), routes login/verify/logout/delete-account, envoi SMTP
configurable (mode dev sans email), workspace personnel à
l'inscription, entrée « Se connecter » au header, et LA capacité : le
bandeau du dossier session propose « garder », le dossier vit au
workspace, la page dossier liste session ET gardés.
Recette : sur `:8080`, créer un compte (lien magique reçu — ou lu au
log en dev), session qui tient au rechargement et au lendemain,
déconnexion ; garder un dossier de 3 vues, le retrouver après purge du
localStorage ; en anonyme, RIEN n'a changé (vues identiques, aucun
harcèlement) ; rate limit vérifié (6ᵉ demande dans l'heure : rien ne
part) ; suppression de compte : tout disparaît. Suites vertes, exit 0
hors pipe. Le bandeau du dossier cesse de dire « P6 » pour la partie
livrée.

**Lot 2 — équipes : invitations + partage du dossier.**
Contenu : migration 0031 (invitations), renommer son workspace,
inviter par email (rôle member), accepter/refuser, retirer un membre,
le dernier owner ne part pas ; le dossier gardé devient visible aux
membres (lecture) — le premier « rapport partagé » honnête.
Recette : deux comptes réels, une invitation traverse, le membre voit
le dossier de l'équipe en lecture, l'anonyme ne voit rien, l'URL d'un
objet d'équipe refuse proprement l'étranger (403 sobre), le badge P6
de « Rapports partagés » au menu tombe ou se reformule sur ce qui
reste.

**Lot 3 — recherches sauvegardées.**
Contenu : « Sauvegarder cette vue » dans l'explorateur (connecté),
liste nommée au workspace, ouvrir = naviguer vers l'URL ; renommer,
supprimer.
Recette : sauvegarder trois vues, les rouvrir à l'identique (l'URL est
le contenu), un membre de l'équipe les voit, l'entrée workspace du
menu s'assume.

**Lot 4 — alertes** (chantier propre, hors socle).
Les événements d'ingestion (le diff « quoi de neuf ») + l'abonnement +
l'envoi. Conçu dans son propre lot 0 le moment venu — le badge P5–P6
des alertes ne bouge pas d'ici là.

---

## Récapitulatif des coûts et licences

| Poste | Choix | Coût | Licence |
|---|---|---|---|
| Auth (tokens, hachage, cookies) | stdlib Python (`secrets`, `hashlib`, `smtplib`) | 0 € | PSF — aucune dépendance nouvelle |
| Hachage de mots de passe | AUCUN (pas de mots de passe) | 0 € | — |
| Envoi d'email | SMTP configurable : le SMTP d'un domaine existant, ou un palier gratuit interchangeable (Brevo ~300/j, Resend ~100/j au cutoff de ma connaissance — à re-vérifier au lot 1) ; volume du socle : quelques dizaines/mois | 0 € | service externe, pas une bibliothèque — rien n'entre dans le code |
| Rate limiting | table Postgres à fenêtre glissante | 0 € | — |
| Front | rien de nouveau (fetch + cookie même-origine) | 0 € | — |

Le socle complet tient sans une seule dépendance nouvelle — la règle
du corpus appliquée au code n'a même pas à arbitrer : rien n'entre.

## Ce que ce document ne décide pas

Les écrans (aucune maquette demandée) ; le détail du chantier alertes
(son propre lot 0) ; l'ajout éventuel d'OAuth ou d'un mot de passe
(réversible, instruit si l'usage le réclame) ; la langue de compte et
les préférences (plus tard, avec une capacité qui les exige).
