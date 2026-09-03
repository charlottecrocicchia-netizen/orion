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

**Aucun coût logiciel obligatoire.** Aucun service payant, aucune
dépendance nouvelle : le socle tient en stdlib. La réserve honnête :
le COÛT et la DÉLIVRABILITÉ de l'email transactionnel restent à
confirmer en prod — SPF/DKIM/DMARC et un expéditeur fiable ne sont pas
une question de code. Cette vérification est LA porte d'entrée du
lot 1 : pas de code avant qu'elle soit tranchée.

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
  semaine sur le même poste. Avec une session de 30 jours glissants
  (90 absolus, D3), le lien magique se clique quelques fois par an et
  par appareil — la
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

**Les garanties du lien magique** (arbitrage du 2026-08-20) — la
liste est le contrat, chaque ligne se vérifie en recette :

- token aléatoire FORT (256 bits, `secrets.token_urlsafe(32)`) ;
- stocké HACHÉ en base (SHA-256) — le clair ne vit que dans l'email ;
- usage UNIQUE : la consommation marque `used_at`, atomiquement — un
  lien consommé ou expiré ne crée jamais de session, un même lien ne
  peut jamais créer PLUSIEURS sessions (la course est perdante :
  l'UPDATE conditionnel `WHERE used_at IS NULL` ne gagne qu'une fois) ;
- expiration COURTE : 15 minutes ;
- la demande de lien répond STRICTEMENT PAREIL qu'un compte existe ou
  non — même corps, même statut (anti-énumération) ;
- rate limit par email ET par IP (D3) — le dépassement répond comme le
  succès et n'envoie rien.

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
  last_used_at  TIMESTAMPTZ     -- glissement des 30 jours (plafond : 90)
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
- **Durée : 30 jours glissants, 90 jours absolus.** `last_used_at`
  repousse l'échéance d'inactivité (30 j) ; `created_at + 90 j` est un
  plafond que RIEN ne repousse — une session volée ne survit pas
  indéfiniment à l'usage. Le lien magique vit 15 minutes, usage
  unique.
- **Doctrine CSRF et mutations** (arbitrage du 2026-08-20 — une
  doctrine explicite vieillit mieux qu'un raccourci) :
  - AUCUNE mutation via GET, jamais — y compris la consommation du
    lien magique : le lien email ouvre une page qui POSTe le token ;
  - `Origin` (à défaut `Referer`) contrôlé sur TOUTE requête
    mutante ; origine étrangère → refus, sans exception « pratique » ;
  - cookie `Secure + HttpOnly + SameSite=Lax`, toujours les trois ;
  - ROTATION du token de session à chaque connexion (jamais de
    réutilisation d'un identifiant de session antérieur) ;
  - RÉVOCATION effective au logout (DELETE du hash en base — le
    cookie effacé ne suffit pas) ;
  - un token CSRF dédié (double-submit ou synchronizer) POURRA
    s'ajouter sans refonte si l'architecture cesse un jour d'être
    même-origine — cette condition est la ligne rouge à relire avant
    tout déplacement de l'API sur un autre domaine.
- **Réauthentification future** : les actions sensibles à venir
  (suppression d'un workspace d'équipe, transfert de propriété)
  exigeront un lien magique frais, pas la session courante. Principe
  consigné dès maintenant ; construit avec la première action qui
  l'exige.
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

> **⚠️ RENVERSÉE le 2026-08-22.** Au lendemain de la mise en ligne, la
> fondatrice tranche l'inverse : Orion devient une application PRIVÉE
> derrière une landing publique — voir
> [conception-acces-prive.md](conception-acces-prive.md), qui fait foi.
> Le texte ci-dessous est conservé comme trace de la décision d'origine.

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

## D5 bis — Deux doctrines futures, consignées sans être construites

**Changement d'adresse email, perte d'accès à l'adresse.**
Explicitement NON SUPPORTÉ au lot 1 : l'email est l'identité, la
perdre c'est perdre le compte (dit sobrement sur la page de login).
Mécanisme futur, esquissé pour mémoire : un changement d'adresse se
fera par DOUBLE lien magique — un lien de confirmation sur l'ancienne
adresse ET un sur la nouvelle, les deux consommés dans une fenêtre
courte ; la perte d'accès sans ancienne adresse restera un cas manuel
(il n'existe aucun mécanisme automatique honnête sans second facteur).

**Suppression de compte et sort de la propriété.** Le modèle tranche
dès maintenant, même sans interface :

- supprimer son COMPTE supprime ses sessions et ses appartenances
  (CASCADE) ; l'email disparaît (RGPD) ;
- un workspace dont le SEUL membre part est supprimé avec ses objets ;
- un workspace d'ÉQUIPE dont un owner part : s'il reste un autre
  owner, rien à faire ; si le partant est le DERNIER owner et qu'il
  reste des membres, le départ est REFUSÉ tant qu'il n'a pas transféré
  la propriété (promu un member en owner) ou supprimé le workspace —
  la propriété ne devient jamais vacante, et rien n'est promu
  automatiquement à l'insu de qui que ce soit ;
- les objets P6 appartiennent au WORKSPACE, pas à leur créateur : le
  départ d'un membre n'emporte aucun objet (`created_by` devient une
  simple trace, `ON DELETE SET NULL`).

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
| Envoi d'email | SMTP configurable : domaine existant ou palier gratuit interchangeable (Brevo ~300/j, Resend ~100/j au cutoff de ma connaissance) ; volume du socle : quelques dizaines/mois | **à confirmer en prod** — délivrabilité (SPF/DKIM/DMARC, expéditeur fiable) = porte d'entrée du lot 1 | service externe, pas une bibliothèque — rien n'entre dans le code |
| Rate limiting | table Postgres à fenêtre glissante | 0 € | — |
| Front | rien de nouveau (fetch + cookie même-origine) | 0 € | — |

Le socle complet tient sans une seule dépendance nouvelle — la règle
du corpus appliquée au code n'a même pas à arbitrer : rien n'entre.
La seule inconnue de coût est l'email transactionnel : vérifiée AVANT
la première ligne de code du lot 1.

## Plan d'implémentation du lot 1 — validé (GO du 2026-08-20)

Comptes (lien magique) + dossier durable. L'architecture D1–D6 ne se
rouvre pas. Les cinq verrous ci-dessous s'ajoutent au contrat
d'implémentation — ils s'intègrent au plan arrêté, sans nouvelle
phase de conception.

### Les cinq verrous du contrat (arbitrage final, 2026-08-20)

**Verrou 1 — le secret du lien ne traîne nulle part.** Le token
voyage en FRAGMENT (`/login/verify#token=…`) : jamais envoyé au
serveur par le GET, lu côté navigateur, transmis par POST, puis
`history.replaceState()` nettoie l'adresse. En défense en profondeur
sur la page de vérification : `Referrer-Policy: no-referrer`,
`Cache-Control: no-store`, et l'interdiction de journaliser la query
côté serveur.

**Verrou 2 — protection login-CSRF.** Le scénario à tuer : un token
demandé par un attaquant pour SA propre adresse, consommé par le
navigateur d'une victime — qui se retrouve connectée au compte de
l'attaquant et « garde » son travail chez lui. Contrat :

- JAMAIS de consommation invisible : `/login/verify` affiche une
  confirmation explicite portant l'adresse partiellement masquée
  (`c••••@company.com`) AVANT le POST de consommation ;
- `frame-ancestors 'none'` (la page ne s'embarque pas) ;
- `Origin`/`Sec-Fetch-Site` contrôlés sur le POST de consommation
  comme sur toute mutation ;
- un NONCE DE CONTINUITÉ navigateur, déposé en cookie à la demande du
  lien : même navigateur → vérification silencieusement renforcée
  (le nonce doit correspondre) ; navigateur différent → la
  confirmation explicite s'affiche, JAMAIS un blocage — le
  cross-device (demander sur mobile, ouvrir au bureau) reste un
  scénario légitime.

**Verrou 3 — le premier login est une transaction atomique.**
`consume token → create/find user → create personal workspace (si
premier) → membership owner → session → commit` : un échec en route
ne laisse RIEN à moitié créé. Contraintes en base, pas en code :
`UNIQUE(email normalisé)`, `UNIQUE(workspace_id, user_id)`. Le cookie
de session est `__Host-` (`Secure; HttpOnly; SameSite=Lax; Path=/`) —
les navigateurs traitent localhost en contexte sécurisé, la prod
publique passera par HTTPS Caddy ; seul le HASH du secret de session
vit en base.

**Verrou 4 — l'interface dit la vérité sur la copie.** « Reprendre »
puis « Sauvegarder » laisserait croire qu'on modifie l'original. Les
libellés disent la sémantique réelle : « Reprendre comme nouvelle
version » et « Enregistrer une copie » — dans les deux langues.
« Mettre à jour le dossier » n'existera que le jour de l'édition
serveur.

**Verrou 5 — le rate limit ne verrouille pas une victime.** Cinq
saisies de `victime@entreprise.com` par un inconnu ne doivent pas
priver la vraie personne de connexion pendant une heure. Combinaison :
limite FORTE par IP, limite par paire IP×email, limite globale par
email PLUS GÉNÉREUSE, cooldown court entre deux envois — et toujours
exactement la même réponse publique, quel que soit le compteur qui a
mordu.

### Porte d'entrée (avant tout code)

Trancher la solution d'envoi en prod : quel expéditeur (SMTP du
domaine ou palier gratuit), SPF/DKIM/DMARC posés sur le domaine
d'envoi, un email de test qui atterrit en boîte de réception (pas en
spam) chez un destinataire Outlook ET un Gmail, preuves à l'appui.
Qualification honnête : c'est une RECETTE MINIMALE de délivrabilité,
pas une preuve de délivrabilité future. Tant que ce test ne passe
pas, le lot ne commence pas. Si un accès DNS est nécessaire, demander
à Charlotte avant.

#### Porte ⓪ — instruction du 2026-08-20 : ARRÊT sur décisions

**État des lieux, vérifié sur pièce** : `SITE_ADDRESS=:80` — la prod
d'Orion est locale (`localhost:8080`), il n'existe ni domaine public,
ni configuration SMTP, ni DNS accessible. Aucune option ne peut être
exécutée sans une décision et un geste de Charlotte (création de
compte, génération de secret ou pose de DNS — rien de tout cela ne se
délègue). La porte s'arrête donc ici, avec le rapport d'options.

**Les options** (limites et chiffres à l'état de mes connaissances,
janvier 2026 — à re-vérifier au moment du choix) :

| | Option | Prérequis (gestes de Charlotte) | Limites | Délivrabilité | Image |
|---|---|---|---|---|---|
| **A** | SMTP Gmail + mot de passe d'application | 2FA activée sur le compte Google ; générer un app password ; le déposer en `ORION_SMTP_*` | ~500 destinataires/jour (largement au-delà du besoin : dizaines/mois) | excellente — SPF/DKIM/DMARC de Google, alignés par construction, RIEN à poser | expéditeur personnel (`…@gmail.com`) — assumable pré-clients, pas une adresse produit |
| **B** | domaine + routeur transactionnel gratuit (Brevo ~300/j, Resend ~100/j) | posséder un domaine ; créer le compte chez le fournisseur ; poser SPF/DKIM/DMARC fournis, chez le registrar | palier gratuit, révocable par le fournisseur | bonne, dépend de la pose DNS correcte | `no-reply@domaine` — le chemin produit |
| **C** | SMTP du registrar (si domaine avec boîte incluse, OVH/Gandi…) | posséder ce domaine ; récupérer les identifiants SMTP | selon l'offre | bonne (SPF souvent pré-posé) | adresse du domaine |
| **D** | auto-hébergé (postfix sur IP locale/VPS) | — | — | ALÉATOIRE (réputation d'IP) — disqualifiée comme porte | — |

**Recommandation** : **A pour ouvrir la porte maintenant** — c'est la
seule option exécutable sans domaine, l'épreuve (un email en boîte de
réception Gmail ET Outlook, preuves à l'appui) peut tourner dès que
l'app password existe ; **B comme cible d'image** le jour où un
domaine existe — la bascule est une variable d'environnement, rien
d'autre (l'envoi est configurable par construction).

**Les décisions attendues** : ① possèdes-tu un domaine (et son DNS)
à dédier à l'expéditeur — lequel ? ② sinon, valides-tu l'option A au
lancement (expéditeur = ton adresse Gmail ; TU génères l'app password
et le déposes en variables d'env — il ne transite jamais par moi) ?
③ pour l'épreuve, quelle boîte OUTLOOK réelle recevra le test ?

Le code du lot 1 n'attend que le verdict de cette porte.

### Amendement du 2026-08-21 — la porte d'accès par liste d'emails approuvés

Décision fondatrice (2026-08-21, au lendemain de la mise en ligne de
`lensorion.com`) : **l'accès aux comptes est fermé par une liste
d'emails approuvés**. Au démarrage, un seul :
`owner@example.com`.

État de la liste au 2026-09-03 : trois adresses — celle de la
fondatrice, `approved-user-1@example.com` (approuvée le 2026-08-24) et
`approved-user-2@example.com` (approuvée le 2026-09-03). Trois comptes
Orion ordinaires, sans privilège : chacun est owner de SON workspace
personnel et de rien d'autre. Ce paragraphe est le REGISTRE des
adresses approuvées ; la liste elle-même ne vit dans aucun fichier
versionné — sa valeur effective est celle du `.env` du serveur, posée
par le geste du runbook (`infra/README.md`, « Approved emails »).

Le contrat, vérifiable en recette :

- la liste vit dans `ORION_LOGIN_ALLOWLIST` (emails séparés par des
  virgules, normalisés lower() à la comparaison) — pas de table ni
  d'écran d'administration tant que la liste se compte sur les doigts
  d'une main : l'ajout d'un email = éditer le `.env` du serveur et
  relancer, geste documenté au runbook ;
- **liste vide = porte fermée pour tous** (défaut sûr) ; le mode dev
  la renseigne explicitement ;
- un email HORS liste qui demande un lien reçoit STRICTEMENT la même
  réponse qu'un email approuvé — même corps, même statut, même temps
  approché — et rien ne part, aucun token n'est créé (c'est la
  garantie anti-énumération D1 étendue : l'existence de la liste
  elle-même n'est pas observable de l'extérieur) ;
- la levée future de la liste (ouverture publique) est UNE variable
  vidée + la présente ligne amendée — aucun code à changer.

Condition de validité : tant qu'Orion est pré-clients et que la liste
est courte. Une liste qui grandit au-delà de la main fera l'objet d'un
vrai arbitrage (table + gestion), pas d'un bricolage d'env.

Le choix lien magique (D1) est CONFIRMÉ par la fondatrice le
2026-08-21 (« pour l'instant le lien magique me va ») — l'ajout d'un
mot de passe reste l'option additive documentée en fin de document.

### Porte ⓪ bis — les faits du 2026-08-21 (mise à jour de l'instruction)

L'état des lieux de la porte ⓪ est périmé sur trois points :
`lensorion.com` est en production publique (HTTPS, déploiement lot 1
clos), la fondatrice possède le domaine ET son DNS (zone OVH), et la
zone porte déjà `MX mx1/mx2/mx3.mail.ovh.net` + `SPF
v=spf1 include:mx.ovh.com -all` — le service Emails inclus d'OVH est
actif côté zone. **L'option C (SMTP du registrar, adresse du domaine)
est donc devenue exécutable et prend la tête de la recommandation** :
expéditeur `no-reply@lensorion.com` (image produit, SPF déjà posé,
DKIM à activer côté OVH), l'option A (Gmail) restant le repli
immédiat. L'épreuve de délivrabilité reste inchangée : un email reçu
en boîte de réception Gmail ET Outlook, preuves à l'appui, avant la
première ligne de code.

### Porte email — FRANCHIE le 2026-08-21 (épreuve sur pièce)

Option retenue et exécutée : **B'** — Brevo palier gratuit (300/j,
sans carte), expéditeur `no-reply@lensorion.com`, domaine authentifié
(4 enregistrements posés dans la zone OVH : code de vérification TXT,
DKIM brevo1/brevo2 en CNAME, DMARC `p=none`). Le SPF existant
(`include:mx.ovh.com`) n'a pas été touché : Brevo enveloppe ses envois
de son propre domaine de rebond, l'alignement passe par DKIM.

**L'épreuve** : email envoyé DEPUIS le serveur de production (le vrai
chemin : `smtplib` → `smtp-relay.brevo.com:587`, identifiants dans le
`.env` du serveur, déposés par la fondatrice sans transiter par la
conversation) vers `owner@example.com`. Verdict, en-têtes
Gmail à l'appui : **boîte de réception ; SPF PASS ; DKIM PASS
(`d=lensorion.com`, `s=brevo2`) ; DMARC PASS.**

**Limite consignée honnêtement** : la fondatrice n'a aucune boîte
Outlook — la moitié Outlook de l'épreuve est EN ATTENTE. À faire
avant d'approuver le premier email Outlook/Exchange sur la liste
d'accès ; d'ici là, la seule utilisatrice est sur Gmail, l'épreuve
couvre le besoin réel.

**Deux faits d'exploitation à retenir** (relevés à l'épreuve) :

- Brevo réécrit le texte en HTML et y ajoute un pixel de suivi et un
  lien de désinscription. Pour les emails de CONNEXION, le suivi des
  clics devra être désactivé — un lien magique réécrit via le domaine
  de tracking serait un lien de connexion qui passe par un tiers. La
  recette du lot vérifie que le lien du mail pointe DIRECTEMENT vers
  `lensorion.com`.
- Les clés SMTP Brevo expirent après **90 jours d'inactivité** (et le
  21 août 2027 quoi qu'il arrive). Si un lien de connexion ne part
  plus : premier réflexe, régénérer la clé (`SMTP et API`) et refaire
  le dépôt dans le `.env`.

### Découpage (ordre de construction)

1. **Migration 0030** : `users`, `login_tokens`, `sessions`,
   `workspaces`, `memberships`, `login_requests` (rate limit à
   fenêtre glissante). Les six tables du socle, `invitations` attendra
   le lot 2.
2. **Le module auth backend** (`orion/auth/`) : création/consommation
   de liens (garanties D1 verbatim), sessions (D3 : 30/90, rotation,
   révocation), la dépendance FastAPI `current_user`, l'envoi SMTP
   configurable (`ORION_SMTP_*`, mode `ORION_AUTH_DEV=1` qui écrit le
   lien dans la réponse), le garde-fou Origin sur les mutations.
3. **Endpoints** (tous sous `/api/auth` et `/api/me`) :
   - `POST /api/auth/login` `{email}` → 200 constant (anti-énumération,
     rate limité) ; crée le compte ET le workspace personnel au
     premier lien CONSOMMÉ, pas à la demande ;
   - `POST /api/auth/verify` `{token}` → session + cookie (la page
     `/login/verify?token=…` POSTe — aucune mutation via GET) ;
   - `POST /api/auth/logout` → révocation en base + cookie effacé ;
   - `GET /api/me` → identité + workspaces (lecture, 401 sinon) ;
   - `DELETE /api/me` → suppression de compte (doctrine D5 bis).
4. **Le dossier durable** :
   - `POST /api/workspaces/{id}/dossiers` — « garder » : le dossier de
     session part tel quel (items `{params, title, note}` du format
     localStorage, qui EST le schéma) ;
   - `GET /api/workspaces/{id}/dossiers` + `GET …/dossiers/{did}` —
     lister, ouvrir ;
   - `DELETE …/dossiers/{did}` ;
   - pas d'éditeur serveur au lot 1 : un dossier gardé s'ouvre en
     lecture, « reprendre dans la session » recharge ses items dans le
     navigateur pour l'éditer puis re-garder (un NOUVEL objet — pas
     d'écrasement silencieux).
5. **Écrans touchés** (i18n FR/EN, aucun écran nouveau au-delà) :
   - header : entrée « Se connecter » ; connecté : initiale + menu
     (mon espace, se déconnecter) ;
   - `/login` : un champ email, une confirmation sobre « si ce compte
     existe, un lien est parti » ;
   - `/login/verify` : consommation puis redirection vers la page
     d'origine ;
   - page dossier : le bandeau session gagne « … — se connecter pour
     le garder » puis « Garder dans mon espace » ; une section « Les
     dossiers gardés » liste ceux du workspace ;
   - une page d'espace minimale (`/workspace/settings` ou le menu) :
     nom du workspace, suppression de compte. Le badge P6 du bandeau
     dossier tombe pour la partie livrée.
6. **Tests** : unitaires backend (garanties D1 une à une : usage
   unique sous course, expiration, anti-énumération, rate limit,
   rotation, révocation, plafond absolu) ; e2e (parcours complet en
   mode dev : login → garder → purge localStorage → retrouver ;
   anonyme inchangé ; Origin étranger refusé).

### Recette du lot 1 (prod `:8080`, rechargement forcé)

- créer un compte : le lien ARRIVE en boîte de réception (le vrai
  test de la porte d'entrée), la session tient au rechargement et au
  lendemain ; se déconnecter la révoque vraiment (le cookie rejoué à
  la main est mort) ;
- un lien magique re-cliqué ne rouvre PAS de session ; un lien de
  16 minutes est mort ; la 6ᵉ demande dans l'heure ne part pas mais
  répond pareil ;
- garder un dossier de 3 vues, purger le localStorage, le retrouver ;
  « reprendre dans la session » réédite puis re-garde un nouvel
  objet ;
- en anonyme : AUCUNE vue ne change, aucun harcèlement — la seule
  trace est « Se connecter » au header et la phrase du bandeau
  dossier ;
- suppression de compte : sessions, appartenances, workspace personnel
  et dossiers gardés disparaissent ;
- suites unitaires, backend et e2e vertes, exit 0 lu hors pipe. CI au
  reset du quota si avant le 1er septembre.

## Ce que ce document ne décide pas

Les écrans (aucune maquette demandée) ; le détail du chantier alertes
(son propre lot 0) ; l'ajout éventuel d'OAuth ou d'un mot de passe
(réversible, instruit si l'usage le réclame) ; la langue de compte et
les préférences (plus tard, avec une capacité qui les exige).
