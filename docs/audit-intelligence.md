# Audit — la couche d'intelligence (lots A à K)

> Instruction fondatrice du 2026-08-22 : faire passer Orion de « je peux
> explorer les financements publics » à « Orion m'explique ce que ces
> financements signifient, ce qui change, où sont les opportunités et ce
> que je devrais regarder ensuite ».
>
> **Statut : soumis pour arbitrage. Aucun code écrit, aucune migration,
> aucune dépendance ajoutée.** Les décisions de périmètre restent à
> Charlotte, lot par lot. Audit mené sur pièces le 2026-08-22 (code,
> migrations, docs, prod figée au dump du 2026-08-21) + vérification des
> licences à la source le même jour.

---

## 1. État des lieux technique (les 15 points demandés)

### 1.1 Architecture frontend

React 19 + Vite 8 + TypeScript, react-router v8, TanStack Query v5,
Tailwind v4 (tokens dans [index.css](../frontend/src/index.css)),
i18next FR/EN (un seul fichier [i18n.ts](../frontend/src/i18n.ts),
ressources inline). Pas de store global : l'état vit dans l'URL
([explore-state.ts](../frontend/src/lib/explore-state.ts) — grammaire
`metric/by/split/compare/time/q/country/programme/organisation/sector/subdivision/limit/view`
+ decks `angles=/angle=`) et dans React Query. Dark/light par classe
`dark` posée avant le premier paint, reduced-motion respecté (bloc CSS
global + gardes JS), print stylé pour le dossier. Les visualisations de
l'Explorateur sont pilotées par props et réutilisées partout via
[explore-view.tsx](../frontend/src/components/explore-view.tsx) (une
query string → une vue + note de couverture + table jumelle).

### 1.2 Architecture backend/API

FastAPI + SQLAlchemy 2 + Alembic (30 migrations), Postgres 16. Onze
routeurs sous `/api` ; les agrégats sont du **SQL brut dans la couche
service** ([aggregates.py](../backend/src/orion/search/aggregates.py)
~1 270 l., [explore.py](../backend/src/orion/search/explore.py),
[service.py](../backend/src/orion/search/service.py)). L'endpoint
`GET /api/explore/aggregate` est **whitelisté** : couples
(métrique, dimension) validés, refus 400 hors liste. Chaque réponse est
auto-descriptive : `unit`, `basis` (participations vs projets), bloc
`meta` rejouant tous les cadrages, `meta.coverage`. Pas de
versionnement d'API, pagination `page/size` plafonnée à 50.

### 1.3 Schéma de données principal

Le socle date de la migration 0002 et n'a pas bougé dans ses grandes
lignes : `funders → programmes (arbre parent_id) → calls → projects →
participations → organisations → countries`, plus `topics` +
`project_topics` (euroSciVoc), `project_texts` (FTS bilingue),
la couche identité (`groups`, `entity_group_map` avec
`method/confidence/share/is_jv/status`, `lei_*`, `uei_links`), les
lentilles (`lenses`, `project_lens_tags`, `lens_changelog`) et le socle
comptes (0030 : `users`, `sessions`, `workspaces`, `memberships`,
`dossiers` — **aucune FK vers le corpus**, isolation voulue).

Points structurants pour la suite :

- **l'argent existe à deux niveaux** : `projects.funding_amount(_eur)`
  et `participations.amount(_eur)` — l'invariant « Σ participations =
  montant projet » est tenu par construction (NSF convertit les
  participations au taux du projet précisément pour ça) ;
- **provenance partout** : `source` + `source_id/uid` uniques,
  `raw` JSONB (payload source + taux de conversion), `first_imported_at`
  / `last_seen_at`, journal `ingestion_runs` ;
- `calls` existe déjà (2 051 appels historiques, code + année, alimentée
  par CORDIS seulement) et sa docstring anticipe la phase 5.

### 1.4 Sources ingérées

CORDIS Horizon/H2020/FP7 (EUR, CC BY 4.0), NIH RePORTER et NSF (USD,
domaine public), taux BCE annuels, GLEIF + Wikidata (identité, CC0),
nomenclature NUTS Eurostat (CC BY 4.0). Corpus : **699 798 projets,
110 117 organisations, 1 102 259 participations, 734,5 Md€** ; base
9,4 Go, dump 1,3 Go. ANR retirée définitivement (ODbL), ADEME non
ingérée (hors sujet), LIFE reporté. Registre faisant autorité :
[data-sources.md](data-sources.md).

### 1.5 ETL / ingestion

CLI `orion-ingest` par source, idempotente (upserts `ON CONFLICT`,
staging UNLOGGED, cache de téléchargement ETag/Last-Modified,
compteurs d'anomalies journalisés, gold sets pour les lentilles).
Chaîne de fin : dedup → refresh des 3 vues matérialisées → prewarm.
**Aucun snapshot de corpus** : la seule photo est le dump `pg_dump`
daté et `ingestion_runs`.

### 1.6 Explorateur

Sept vues (`lines`, `bars`, `donut`, `bump`, `delta`, `map`, `table`),
cinq métriques, neuf dimensions, drill programme→sous-programmes par
`?programme=`. Règle anti-double-comptage câblée dans
`_METRIC_COLS` : pays/région/organisation/type agrègent des
**participations**, année/programme/bailleur/thème des **projets**.
⚠️ **Écart de doctrine constaté : la vue `bars` de l'Explorateur est en
barres HORIZONTALES** ([charts.tsx:63-104](../frontend/src/components/charts.tsx)),
comme les totaux du benchmark, les thèmes des postes de veille, les
mailles sous le pays et les parts d'entités d'un groupe. La doctrine
maison bannit désormais les barres horizontales : c'est un **écart
existant à corriger, pas un précédent à imiter** — aucun nouveau lot ne
doit en produire.

### 1.7 Lentilles

Le système est déjà **exactement dans la philosophie visée par le Lens
Builder** : règles en CSV versionnés
([registry.csv](../backend/curation/lenses/registry.csv) +
`space.csv` 22 règles / `aviation.csv` 179 règles), **neuf types de
règles** (`programme`, `call`, `topic`, `theme`, `text`, `veto`,
`candidate`+`confirm`, `project`), hiérarchie de preuve
`review > structural > taxonomic > textual` stockée par tag
(`project_lens_tags.proof`), statuts `draft|published|retired`, version
+ `lens_changelog` (avant/après **agrégé** : compteurs et montants —
**le diff nominatif « projets ajoutés/retirés » n'existe pas encore**),
gold sets adversariaux vérifiés par `gold_check.py`. Moteur :
[lenses.py](../backend/src/orion/ingest/lenses.py) (770 l.).

### 1.8 Recherche

100 % PostgreSQL : FTS bilingue (`orion_en`/`orion_fr`, unaccent +
stemming, titre poids A / résumé poids B, index GIN) + `pg_trgm` pour
les organisations. Recherche composable = tags typés qui lisent et
écrivent **les paramètres d'URL existants**. **Aucune recherche
sémantique, aucun embedding, aucun appel LLM nulle part** (vérifié par
grep exhaustif : dépendances, lock, migrations, code).

### 1.9 Groupes et organisations

Dédoublonnage garde-fou (identifiants forts jamais contredits, aucune
fusion inter-pays), groupes GLEIF/Wikidata/curation avec part JV
pondérée et **double mesure** (consolidé pondéré vs fait juridique
brut), curation par CSV tout-ou-rien dont le journal d'audit est le
diff git.

### 1.10 Authentification et modèle utilisateur

Livré (migration 0030, [conception-acces-prive.md](conception-acces-prive.md)) :
lien magique (jeton en fragment, SHA-256, consommation à course
unique), allowlist fermée par défaut, rate limit en base, sessions
cookie `__Host-`, CSRF par Origin, middleware qui ferme tout `/api/*`
sauf `health`/`auth`/`public`. Un workspace personnel par utilisateur,
dossiers persistés en JSONB (`POST /api/workspaces/{id}/dossiers` —
toujours un nouvel objet). **N'existent pas** : invitations (conçues,
lot 2), rôles fins, partage, recherches sauvegardées, alertes.

### 1.11 Infrastructure et persistance

VPS OVH **4 vCore / 8 Go RAM / 75 Go NVMe**, compose prod : Postgres
(image **`pgvector/pgvector:pg16`** — l'extension `vector` est
**disponible mais jamais activée** ; choix délibéré de l'ADR 0002 :
« activable en phase 3 sans changement d'infra »), API, web, Caddy,
scheduler (profil, éteint). Sauvegarde `pg_dump` quotidienne (cron
04h00, rotation 7 j) + snapshot OVH. Extensions actives : `unaccent`,
`pg_trgm`, `pg_prewarm`. **La mémoire gouverne** : le budget 300 ms est
rompu sur la recherche plein-texte au corpus actuel avec cette RAM ; la
règle écrite au chantier performance (16 Go au doublement, 24-32 Go fin
de vague 1) est **atteinte, pas anticipée**. Toute proposition
ci-dessous est chiffrée contre cette enveloppe.

### 1.12 Jobs background / cron / workers

APScheduler (conteneur dédié, profil compose) **volontairement éteint
en prod** — les données servies sont la photographie du dump du
2026-08-21. Aucune file (ni Redis, ni Celery), aucun worker. Un calcul
long n'a aujourd'hui que trois voies : bloquer la requête, un
`BackgroundTasks` best-effort, ou la CLI à la main. **CI muette
jusqu'au 2026-09-01** (quota Actions) : validation locale par
`./scripts/e2e-local.sh`, exit code lu hors pipe, verdict sur journal
complet.

### 1.13 Capacités IA/embeddings

**Néant, et c'est vérifié** (pas de client OpenAI/Anthropic, pas de
sentence-transformers, pas de colonne vector). Le socle est prêt sans
geste d'infra : une migration `CREATE EXTENSION vector` + une
dépendance Python suffisent à ouvrir pgvector.

### 1.14 Réalisable sans migration structurante

- euros constants (une table d'indices + facteur appliqué à la
  requête — aucune colonne sur `projects`) ;
- chaîne de l'argent (toutes les données existent ; il manque
  `by=call` dans la grammaire et une surface de drill) ;
- dépendance/concentration par bailleur et programme (SQL pur sur
  `participations`) ;
- catalogue `/calls` (extension de la table `calls` par colonnes
  nullables, ou table sœur) ;
- « qui a gagné les appels similaires » (les 2 051 appels historiques
  et les préfixes de code sont déjà exploités par les lentilles).

### 1.15 Migrations structurantes nécessaires

- **embeddings** : extension `vector`, table dédiée, index HNSW —
  et une décision RAM (voir § 4.2) ;
- **lentilles utilisateur** : règles en base (aujourd'hui : CSV du
  dépôt), propriété workspace, diff nominatif de versions ;
- **moteur de changements** : tables snapshots + événements persistés ;
- **outputs** : nouvelles tables (publications, livrables) + chargeurs ;
- **scores de matching** : table de scores décomposés par
  (organisation, appel).

---

## 2. Registre des licences des données envisagées

Vérification à la source le 2026-08-22 (règle maison : domaine public,
CC0, CC-BY, Licence Ouverte, OGL seulement ; share-alike ou zone grise
= exclusion ; re-vérification obligatoire le jour du chargement).

| Donnée | Usage (lot) | Licence constatée | Verdict |
|---|---|---|---|
| Eurostat HICP (`prc_hicp_aind`, API SDMX) | A — déflateur euro | CC BY 4.0 (décision 2011/833/UE), réutilisation commerciale autorisée — `ec.europa.eu/eurostat/web/main/help/copyright-notice` | ✅ **PASSE** (source primaire) |
| BCE Data Portal (HICP) | A — miroir éventuel | conditions propres BCE : usage libre, attribution, modifications signalées — pas une licence standard | ⚠️ passe mais **Eurostat préféré** |
| BLS CPI-U (série CUUR0000SA0, API v2) | A — déflateur USD | domaine public (17 U.S.C. §105 ; `bls.gov/opub/copyright-information.htm`) | ✅ **PASSE** |
| Portail EU Funding & Tenders (appels/topics) | E | CC BY 4.0 par défaut Commission (décision 2011/833/UE) — déjà vérifié au [registre](data-sources.md) le 2026-08-17 | ✅ **PASSE** — réserve de procédure : relire la mention légale du portail **au navigateur le jour du chargement** ; l'endpoint `api.tech.ec.europa.eu/search-api` n'est pas documenté contractuellement → tolérance aux changements à prévoir |
| EuroSciVoc (RDF/SKOS, Office des publications) | C, D | CC BY 4.0 (fiche data.europa.eu concordante) | ✅ **PASSE** |
| CORDIS `projectDeliverables` / `projectPublications` (bulk) | G | CC BY 4.0, mêmes datasets que les projets | ✅ **PASSE** — première marche naturelle des outputs |
| OpenAIRE Graph (API, métadonnées) | G, K (LIFE) | CC BY 4.0 (`graph.openaire.eu/docs/license/`) ; PDF hors périmètre | ✅ **PASSE** (métadonnées seulement) |
| Crossref REST | G | métadonnées = faits, équivalent domaine public ; **abstracts exclus** (droit éditeur) | ✅ **PASSE hors abstracts** |
| OpenAlex | G | CC0 | ✅ **PASSE** |
| PATSTAT (OEB) | G — brevets | payant (~1 250 €/an) | ❌ **EXCLU** |
| EPO Open Patent Services | G — brevets | inscription + fair-use charter + quotas : conditions propriétaires | ❌ **EXCLU en l'état** (piste : produits bulk OEB gratuits depuis 2025, licence exacte à instruire si le besoin brevets se confirme) |
| UKRI Gateway to Research | K | OGL (`gtr.ukri.org/resources/about.html`) | ✅ **PASSE** (déjà admis, à re-vérifier au chargement) |
| SNSF (data.snf.ch) | K | « terms_by » opendata.swiss : usage commercial libre, attribution | ✅ **PASSE** (équivalent BY, pas une CC formelle — à consigner) |
| NWO (NWOpen-API) | K | CC0 | ✅ **PASSE** |
| Vinnova (API open data) | K | libre sans redevance (équivalent CC0) | ✅ **PASSE** |

**Aucune source examinée n'est en share-alike.** Obligation CC-BY à ne
pas oublier : **indiquer les modifications** — un montant déflaté ou
converti est une modification, la mention de méthode la couvre (déjà la
règle maison : « jamais un euro muet »).

---

## 3. Audit lot par lot

### Lot A — euros constants

**Existe déjà.** Conversion nominale USD→EUR au taux moyen annuel BCE
de l'année de début, appliquée à l'ingestion, jamais muette (bloc
`conversion{rate, year, source}` sur la fiche projet). Table
`exchange_rates` en place. Rien sur l'inflation.

**Réutilisable.** Le chargeur `rates.py` (même motif SDMX pour
Eurostat), le bloc `meta` auto-descriptif de l'Explorateur, la ligne
d'assiette sous les vues.

**Méthode recommandée** (à trancher en ADR) : la pratique OCDE/CAD —
**déflater dans la monnaie d'origine, puis convertir au taux de
l'année de référence** :

- montants EUR : `EUR_constant = EUR × HICP(réf)/HICP(année de début)` ;
- montants USD : `EUR_constant = USD × CPI-U(réf)/CPI-U(année) ÷ taux BCE(réf)`.

C'est l'option économiquement correcte (le pouvoir d'achat évolue dans
l'économie qui dépense) et elle **ne touche pas** la chaîne nominale
existante : `funding_amount_eur` reste ce qu'il est (« € courants »),
le facteur constant s'applique **à la requête** par jointure sur
l'année de début. Alternative écartée : déflater `funding_amount_eur`
par le seul HICP euro — plus simple mais économiquement fausse pour les
montants US (elle mélangerait l'inflation américaine dans un taux de
change historique). *Condition de validité : tout montant sans
`start_date` reste sans valeur constante (même règle d'honnêteté que la
conversion nominale — pas de facteur inventé).*

**Schéma.** Une table `price_indices(area, year, value, source)`
(`ea-hicp` / `us-cpiu`), chargeur `orion-ingest indices`, millésime de
référence en configuration serveur (pas en dur), rejoué dans
`meta` pour que l'URL partagée reste reproductible.

**UX.** Un segment Explorateur `€ courants | € constants 2026`
(paramètre d'URL, ex. `prices=constant`), mention de méthode visible,
et la ligne sources enrichie (« déflaté HICP Eurostat / CPI-U BLS »).

**À terme** (préparé, pas construit) : € / habitant, % PIB, % DIRD —
même motif « table d'indices + facteur à la requête », données Eurostat
CC-BY ; hors du premier lot.

| Difficulté | Dépendances | Risques méthodo | Migration | Coût calcul |
|---|---|---|---|---|
| **petite-moyenne** | aucune | choix de méthode à documenter/tester ; année civile vs FY déjà réglée (axe = date de début) | 1 table réversible | négligeable (jointure sur ~25 lignes/série) |

### Lot B — la chaîne de l'argent public

**Existe déjà.** Toute la chaîne est en base :
`funders → programmes (arbre) → calls → projects → participations
(montant par organisation) → pays`. Le drill programme→sous-programmes
existe (`?programme=` + donut). Les deux niveaux d'argent sont
distincts, donc **le double compte est déjà résolu par construction** :
au-dessus du projet on somme `funding_amount_eur`, au-dessous on somme
`participations.amount_eur`, et un projet multi-participants ne
multiplie jamais son financement.

**Manque.** La dimension `by=call` dans la grammaire de l'Explorateur ;
une surface de drill continue avec fil d'Ariane (les breadcrumbs
actuels sont inline, non partagés — à extraire en composant) ; le
niveau « appel » n'a ni titre ni montant agrégé exposé.

**Représentation** (doctrine : pas de barres horizontales, pas de
Sankey) : **liste hiérarchique dépliante avec montants recalculés à
chaque niveau + barres verticales pour les ordres de grandeur**, fil
d'Ariane persistant, contexte parent affiché, chaque niveau étant une
URL d'Explorateur (partageable, collectable au dossier). Le donut de
drill existant reste utilisable pour les parts.

| Difficulté | Dépendances | Risques méthodo | Migration | Coût calcul |
|---|---|---|---|---|
| **moyenne** | aucune (E enrichira le niveau « appel ») | bien nommer ce qu'on somme à chaque niveau (budget vs contribution vs participation) — glossaire à l'écran | aucune | requêtes agrégées classiques, cache existant |

### Lot C — projets similaires (priorité 3)

**Existe déjà.** Rien entre projets. Entre organisations : partenaires
récurrents, partenaires communs, flux pays. Matière exploitable pour
« pourquoi ce projet apparaît » : thèmes euroSciVoc (CORDIS),
programmes, appels, organisations communes, périodes, lentilles.

**Le trou de données à dire d'abord** : euroSciVoc ne couvre **que
CORDIS** (~84 k projets sur 700 k) ; NIH/NSF n'ont ni taxonomie ni
mots-clés ingérés (le champ `PROJECT_TERMS` de NIH n'est pas chargé).
Une similarité purement taxonomique serait donc borgne sur 88 % du
corpus. **C'est précisément l'argument des embeddings** : les résumés,
eux, existent pour ~592 k projets, dans les deux jambes du corpus.

**Options techniques comparées** :

1. **FTS « more-like-this »** (termes saillants du résumé →
   `websearch_to_tsquery`) — zéro infra, mais faible pour les
   transferts intersectoriels (vocabulaire de surface) ;
2. **Embeddings + pgvector** — l'image Docker est déjà prête,
   modèle **local** (sentence-transformers multilingue type
   `multilingual-e5-small` ou équivalent, dim 384), **calcul hors
   ligne sur le Mac pendant l'ingestion** (comme le reste du corpus),
   livré par le dump ; aucune donnée n'est envoyée à un service
   externe ; index HNSW ;
3. **Hybride (recommandé)** : embeddings pour **trouver** les
   candidats, données structurées pour **expliquer** — éléments
   communs affichés (thèmes euroSciVoc partagés, organisations
   communes, même programme/appel, proximité temporelle, lentilles),
   score continu **traduit en paliers nommés** (« Très proche », avec
   les termes saillants partagés), jamais un `0.8734` nu.

**Transferts intersectoriels** : c'est un simple filtre sur le même
index — « voisins **hors** de la lentille active » = les k plus
proches n'appartenant pas à `project_lens_tags` de la lentille
courante, groupés par leur secteur/lentille/programme d'appartenance.
Aucun mécanisme séparé à construire : c'est la récompense directe de
l'index sémantique.

**Chiffrage** : ~592 k vecteurs × 384 dim × 4 octets ≈ 0,9 Go +
index HNSW du même ordre → **~2-3 Go de disque** (75 Go NVMe : large),
mais l'index veut vivre en RAM pour répondre vite — **sur le VPS 8 Go
déjà saturé, c'est le point dur**. Voir § 4.2 : ce lot est
conditionné à la décision RAM. Calcul initial des embeddings : quelques
heures sur le Mac, incrémental ensuite (seuls les projets
nouveaux/modifiés).

*Condition de validité : la reproductibilité exige de versionner le
modèle et ses paramètres (`model`, `dim`, date de calcul) avec les
vecteurs, et de pouvoir recalculer l'index entier par une commande.
Fallback nommé : si les embeddings manquent (base restaurée sans eux),
la section « projets similaires » ne s'affiche pas — jamais un repli
silencieux vers du FTS qui changerait le sens des résultats.*

| Difficulté | Dépendances | Risques méthodo | Migration | Coût calcul |
|---|---|---|---|---|
| **moyenne-grosse** | décision RAM VPS ; socle sémantique (§ 5, lot S) | score opaque si l'explication n'est pas construite avec ; biais de longueur des résumés | `CREATE EXTENSION vector` + 1 table (réversibles) | initial : heures sur Mac ; requête : ms avec HNSW en RAM |

### Lot D — Lens Builder (priorité 2)

**Existe déjà — et c'est la meilleure surprise de l'audit** : le moteur
de lentilles est déjà rules-first, versionné, à preuve hiérarchisée,
avec gold sets et changelog. Le Lens Builder n'invente **pas** un
système : il ouvre l'existant aux utilisateurs.

**Manque** :

1. **règles en base** — aujourd'hui les règles vivent dans des CSV du
   dépôt, chargés par `orion-ingest lenses`. Une lentille utilisateur
   exige des règles stockées en base, possédées par un workspace, et un
   moteur qui accepte les deux origines (même sémantique, même
   validation, un seul module) ;
2. **diff nominatif de versions** (« projets ajoutés / retirés ») —
   n'existe même pas pour les lentilles éditoriales (le changelog est
   agrégé) ; à construire une fois, au bénéfice des deux ;
3. **preview** — compter et échantillonner les projets
   entrants/sortants avant matérialisation (les règles sont du SQL :
   un `COUNT` + `LIMIT` par règle est faisable en secondes) ;
4. **l'aide LLM** — première dépendance IA externe du produit
   (voir § 4.4) : le LLM **propose** des concepts inclus/exclus
   (codes euroSciVoc + motifs texte), l'utilisateur corrige, et seules
   les règles matérialisées classifient. Envoyé au service : le nom et
   la description de la lentille, la liste des concepts euroSciVoc —
   **jamais le corpus**. Fallback : le builder fonctionne sans LLM
   (saisie directe des concepts, autocomplete euroSciVoc).

**Permissions** : lentille privée par défaut, rattachée au workspace ;
`Private` seul au premier lot — `Shared`/`Public` sont préparés par le
modèle (statut) mais **pas construits** tant que les invitations
d'équipe (lot 2 des comptes) n'existent pas.

**Risque nommé — la matérialisation** : retagger 700 k projets pour une
lentille utilisateur prend des minutes, et il n'existe aucune file de
jobs. À instruire dans la conception du lot : matérialisation
synchrone bornée (nombre de règles plafonné + timeout honnête), ou
premier vrai job asynchrone du produit. Pas de décision ici.

| Difficulté | Dépendances | Risques méthodo | Migration | Coût calcul |
|---|---|---|---|---|
| **grosse** | comptes (✅ livré) ; euroSciVoc au-delà de CORDIS souhaitable (C/K) ; décision LLM | une lentille utilisateur mal réglée qui « fait dire » des chiffres → mêmes gardes que l'éditorial (preview, gold d'exemples, version) | tables lentilles utilisateur + règles (réversibles) | retag : minutes par lentille |

### Lot E — Calls + matching (priorité 1)

**Existe déjà.** Table `calls` (2 051 appels historiques CORDIS,
préfixes déjà exploités comme preuve structurelle par les lentilles),
page `/calls` en vitrine avec les quatre promesses affichées, règles
produit déjà actées ([roadmap](roadmap.md) phase 5 : score toujours
décomposé, un critère inconnu n'est jamais incompatible, exclusion dure
avant classement), source tranchée et licite (F&T, CC BY 4.0), couche
groupes opérationnelle (« on s'abonne à Thales, pas à 12 entités »).

**Manque.** Tout le reste : ingestion des appels à venir (modèle étendu
: dates d'ouverture/clôture **avec fuseaux**, budget, statut, type
d'action, description, lien source, destination/cluster), routeur API,
page catalogue, matching.

**Architecture d'ingestion — le point qui structure tout** : un appel a
des **deadlines** ; cette donnée ne peut pas vivre au rythme « dump du
21 août ». Il faut donc **deux régimes d'ingestion** (voir § 4.3) : le
corpus lourd reste « Mac + dump », les appels deviennent la première
ingestion **légère et fraîche sur le VPS** (quelques centaines
d'appels ouverts, API JSON, empreinte minuscule) — c'est l'occasion de
réveiller proprement le scheduler, avec un job dédié `calls` et non le
`ALL` hebdomadaire.

**Matching décomposé — composantes honnêtes calculables depuis les
données réelles** (pondérations à calibrer en conception, pas ici) :

- *proximité thématique* : thèmes euroSciVoc du portefeuille ×
  topic/description de l'appel (FTS d'abord, embeddings quand le socle
  S est là) ;
- *historique programme* : participations passées dans le programme
  parent de l'appel (l'arbre `programmes` le donne) ;
- *expérience de coordination* : part de rôles coordinateur ;
- *réseau* : partenaires récurrents déjà actifs sur le thème/programme ;
- *géographie/éligibilité* : pays vs conditions publiées — **un critère
  inconnu reste inconnu**, affiché tel quel.

Chaque composante avec sa formule et sa source, l'assemblage affiché
décomposé. Wording gravé : « pertinence historique », « compatibilité
observée » — jamais une garantie d'éligibilité ou de succès.

*Conditions de validité (tests obligatoires) : aucun appel clos
présenté comme ouvert (statut dérivé de la deadline en UTC, testé aux
bornes de fuseau) ; chaque appel porte son lien source officiel ; un
score sans ses composantes ne s'affiche pas.*

| Difficulté | Dépendances | Risques méthodo | Migration | Coût calcul |
|---|---|---|---|---|
| catalogue : **moyenne** · matching : **grosse** | réveil scheduler (léger) ; embeddings optionnels (V2) | dates/fuseaux ; endpoint non contractuel (échec bruyant, jamais silencieux) ; sur-promesse de « fit » | extension `calls` + table scores (réversibles) | ingestion : minutes/jour ; scores : batch post-ingestion |

### Lot F — dépendance et exposition

**Existe déjà.** Fiches organisation/groupe riches (trajectoires,
postes de veille, double mesure JV), toutes les données nécessaires
dans `participations` (bailleur, programme, année, montant).

**Manque.** Les indicateurs : parts par bailleur et par programme, HHI
(formule affichée, seuils nommés faible/moyen/élevé **avec la
convention choisie citée en méthode**), top 3, évolution de la
diversification entre périodes. Pur SQL, pas de nouvelle donnée. Le
scénario contrefactuel (« si Horizon Space −20 % ») est une simple
arithmétique d'exposition historique — le wording anti-prévision est la
seule vraie difficulté.

**Occasion à saisir** : ce lot est le bon véhicule pour créer le
**composant « méthode » réutilisable** (« d'où vient ce chiffre » :
source, date, formule, périmètre, limites) qui manque aujourd'hui — la
provenance est diffusée mais il n'existe aucun popover/panneau
générique. Tous les lots suivants en hériteront.

| Difficulté | Dépendances | Risques méthodo | Migration | Coût calcul |
|---|---|---|---|---|
| **petite-moyenne** | aucune | wording (exposition ≠ prévision) ; périmètre (le corpus ne voit que les financements chargés — à dire : « dépendance **au sein du corpus Orion** ») | aucune | SQL agrégé, cache existant |

### Lot G — outputs

**Existe déjà.** Rien (aucune table, aucun DOI).

**Chemin honnête par paliers de certitude** :

1. **CORDIS bulk `projectDeliverables` + `projectPublications`** —
   liens **explicites** projet→output, même licence, même canal
   d'ingestion que les projets : la première marche évidente ;
2. OpenAIRE Graph (CC-BY, métadonnées) : liens projet→publication
   agrégés, dont une partie **inférée** — à étiqueter comme telle
   (`link_type: declared|inferred`), jamais fondue avec le déclaré ;
3. brevets : **pas de source licite aujourd'hui** (PATSTAT payant, OPS
   sous fair-use) — on ne construit pas ce volet ; réexamen si les
   produits bulk OEB gratuits de 2025 passent la règle de licence.

Pas de métrique d'« efficacité » (`€/brevet`) : affichage des outputs
observables, comptés et sourcés, c'est tout.

| Difficulté | Dépendances | Risques méthodo | Migration | Coût calcul |
|---|---|---|---|---|
| palier 1 : **moyenne** | aucune | liens inférés vs déclarés (palier 2) | tables outputs (réversibles) | ingestion bulk classique |

### Lot H — réseau de collaboration intelligent

**Existe déjà.** Les arêtes (co-participations), `country_pair_stats`,
partenaires récurrents/communs, le graphe abstrait ayant déjà cédé sa
place à la carte une fois (leçon à respecter : le graphe ne revient que
s'il répond à une question).

**Manque.** Les métriques de réseau : degré pondéré, betweenness,
détection de communautés, évolution temporelle, constats textuels
(« organisation passerelle entre deux communautés »). **Périmètre à
cadrer d'emblée** : jamais le graphe des 110 k organisations —
l'ego-réseau d'une organisation/d'un groupe, filtré
période/programme/thème (centaines de nœuds), calculé à la demande
avec plafonds + cache. Dépendance nouvelle : `networkx` (léger, pur
Python). La betweenness sur un ego-réseau borné est abordable ; sur le
corpus entier elle ne l'est pas — on ne la propose pas.

| Difficulté | Dépendances | Risques méthodo | Migration | Coût calcul |
|---|---|---|---|---|
| **moyenne-grosse** | biais « une org par projet » des sources US à dire (le réseau américain est structurellement invisible hors fratries NSF) | sur-interprétation des métriques → chaque constat cite sa métrique et sa formule | aucune (calcul à la demande) | secondes par ego-réseau, borné |

### Lot I — moteur de changements

**Existe déjà.** Les « récits du corpus » (calculés côté client, seuils
d'honnêteté), les signaux org/groupe (2 types, fenêtres fixes, seuils),
`ingestion_runs` qui date les passages. **Aucun diff entre deux états
du corpus.**

**Architecture proposée** (rien à recalculer au chargement de page) :

- `corpus_snapshots` : à la fin de chaque run d'ingestion, une passe
  fige les agrégats clés (top N par thème/pays/organisation, totaux
  par programme, arrivées) ;
- `corpus_events` : la même passe diffe contre le snapshot précédent et
  persiste les événements franchissant les seuils (nouveau gros projet,
  entrée dans un top 10, thème qui accélère, nouveau partenariat…),
  avec type, entités, valeurs avant/après, seuil appliqué, run source,
  clé de déduplication ;
- surface « les mouvements du corpus » lisant `corpus_events` ;
- plus tard, avec les comptes : « depuis votre dernière visite » =
  simple filtre `occurred_at > last_seen_at` — et ce même flux
  alimentera alertes/digests/emails.

**Contrainte d'infra assumée** : tant que l'ingestion lourde tourne sur
le Mac, les événements corpus se calculent **sur le Mac, pendant
l'ingestion, et voyagent dans le dump** — cohérent, puisque le corpus
de prod ne change qu'au dump. Les événements « appels » (nouvel appel,
clôture proche) naîtront eux sur le VPS avec l'ingestion calls.

| Difficulté | Dépendances | Risques méthodo | Migration | Coût calcul |
|---|---|---|---|---|
| **moyenne** | régime d'ingestion clarifié (§ 4.3) | seuils = éditorial : les écrire, les versionner ; déduplication entre runs | 2 tables (réversibles) | une passe par run d'ingestion |

### Lot J — dossier → vrai livrable

**Existe déjà.** Dossier vivant (collecte, annotation, réordonnancement),
persistance serveur par workspace, export PDF via impression stylée,
CSV par vue dans l'Explorateur. Chaque bloc est une URL vivante — c'est
la bonne fondation : un export est un **rendu** du dossier, pas une
autre vérité.

**Manque.** Exports structurés (CSV/JSON du dossier entier, annexe
méthodologique auto-générée depuis les `meta` des vues — sources,
périmètres, dates, conversions), PPTX/XLSX éventuels (dépendances
lourdes côté serveur : à instruire), lien partageable (dépend des
invitations, lot 2 des comptes). **Note de synthèse IA** : le LLM ne
reçoit **que** le contenu du dossier (données structurées des vues,
titres, annotations, contexte méthodo) et chaque constat pointe la vue
qui le justifie — même cadre de dépendance IA que le Lens Builder
(§ 4.4). Fallback : le dossier reste complet sans la note.

| Difficulté | Dépendances | Risques méthodo | Migration | Coût calcul |
|---|---|---|---|---|
| **moyenne** (par tranches) | comptes lot 2 pour le partage ; décision LLM | citation inventée = interdite par construction (le prompt ne contient que le dossier ; sortie liée aux vues) | aucune | à la demande |

### Lot K — élargissement des sources

**Existe déjà.** Le modèle commun demandé **existe déjà et fonctionne**
(`Funder → Programme → Call → Project → Participant → Organisation`,
champs spécifiques en `raw`), trois familles de chargeurs le prouvent,
la convention transverse montants/devises/années fiscales est écrite,
UKRI/SNSF/NWO/Vinnova sont licites (§ 2).

**La vraie contrainte n'est pas le code, c'est la RAM** : chaque source
grossit un corpus qui sature déjà les 8 Go du VPS (règle du chantier
performance atteinte). L'ordre existant de la vague 1 tient ; **aucune
nouvelle source avant la décision de dimensionnement** — déjà actée
comme préalable dans la [roadmap](roadmap.md).

| Difficulté | Dépendances | Risques méthodo | Migration | Coût calcul |
|---|---|---|---|---|
| **moyenne-grosse par source** | décision RAM/hébergement ; licence re-vérifiée au chargement | normalisation excessive (le modèle actuel préserve déjà le spécifique en `raw` — continuer) | aucune structurante | chargements batch connus |

---

## 4. Architecture cible

Principe directeur : **rien de nouveau qui ne soit exigé par un lot
validé**. Pas de refonte, pas de monolithe analytique — des briques
ajoutées au système existant, chacune réversible.

### 4.1 Ce qu'on introduit (et pourquoi)

| Brique | Pour | Nature |
|---|---|---|
| `price_indices` | A | table + chargeur, motif `exchange_rates` |
| Extension `vector` + `project_embeddings` (project_id, model, dim, vecteur, computed_at) + index HNSW | C, puis E-matching V2, D-preview | migration + dépendance Python **côté ingestion seulement** (le VPS ne calcule jamais d'embedding : il lit l'index) |
| Extension de `calls` (colonnes nullables : dates tz-aware, budget, statut, type d'action, description, url, source) | E | l'existant CORDIS reste intact ; provenance `source='ft-portal'` pour le neuf |
| `call_match_scores` (organisation/groupe × appel, composantes décomposées, version de méthode, calculé_le) | E | batch post-ingestion calls, jamais à la volée sur la fiche |
| Tables lentilles utilisateur (lentille possédée par un workspace + règles en base + versions + diff nominatif) | D | le moteur actuel devient bi-source (CSV éditorial / base utilisateur), une seule sémantique |
| `corpus_snapshots` + `corpus_events` | I, puis alertes | passe de fin d'ingestion, événements persistés |
| Tables outputs (deliverables, publications, liens typés declared/inferred) | G | chargeur CORDIS bulk d'abord |
| Composant frontend « méthode » (source · date · formule · périmètre · limites) | tous | comble le seul trou transverse de provenance |

**Ce qu'on n'introduit PAS** : pas de Redis ni de file de jobs (aucun
lot n'en a besoin tant que la matérialisation des lentilles utilisateur
n'est pas tranchée — et elle a des options synchrones honnêtes) ; pas
de vector store externe (pgvector suffit, l'image est déjà là) ; pas de
service d'embeddings SaaS (modèle local sur le Mac) ; pas de nouvelles
vues matérialisées par précaution (on en ajoute si une mesure l'exige,
comme toujours) ; pas de chatbot flottant.

### 4.2 L'enveloppe VPS — la décision qui conditionne deux lots

4 vCore / 8 Go / 75 Go NVMe. Le disque est large (base 9,4 Go +
embeddings ~3 Go + calls négligeable). **La RAM ne l'est pas** : la
recherche plein-texte dépasse déjà son budget, et l'index HNSW veut
vivre en cache. Deux options honnêtes :

- **monter le VPS à 16 Go** (palier déjà prescrit par le chantier
  performance pour la recherche seule — les embeddings s'y logent) ;
- **rester à 8 Go** : alors le lot C (similarité) dégrade la recherche
  existante ou répond lentement — je ne le recommande pas.

C'est une décision budgétaire fondatrice, pas technique. Elle
conditionne le lot C et, à terme, la vague K. Les lots A, B, E
(catalogue + matching V1 structurel), F, I, J tiennent dans
l'enveloppe actuelle.

### 4.3 Deux régimes d'ingestion (où tourne quoi)

| Régime | Contenu | Où | Rythme |
|---|---|---|---|
| **Corpus lourd** | CORDIS, NIH, NSF, identité, lentilles, embeddings, snapshots/événements corpus | **Mac** (comme aujourd'hui), livré par dump | à chaque campagne de chargement |
| **Fraîcheur légère** | appels F&T (+ événements calls) | **VPS**, scheduler réveillé avec un job dédié `calls` (pas le `ALL` hebdomadaire) | quotidien |

Le scheduler existant (profil compose) porte le second régime sans
infra nouvelle : un cron dédié, timeout, échec bruyant au journal
`ingestion_runs`. Le jour où le corpus lourd migre sur serveur, c'est
la décision RAM/hébergement ci-dessus qui l'ouvre — pas ce chantier.

### 4.4 Cadre IA — une règle, trois usages

Usages prévus : propositions de règles du Lens Builder (D), note de
synthèse du dossier (J), éventuellement libellés d'explication de
similarité (C — optionnel, les explications structurées suffisent en
V1). Règle commune, dans la doctrine du produit :

- le LLM **propose, résume, aide à formuler** ; il ne classe pas, ne
  compte pas, ne devient jamais la source d'un chiffre affiché ;
- tout ce qui est montré comme fait est **reconstruisible depuis la
  base** (règles matérialisées, constats liés à leurs vues) ;
- données envoyées : le strict nécessaire (description de lentille,
  contenu du dossier) — **jamais le corpus**, jamais d'emails ;
- service : API Claude (Anthropic) — coût à l'usage marginal pour ces
  volumes (quelques appels par action utilisateur, pas de batch) ;
  dépendance créée : nommée et débranchable, chaque fonction ayant son
  fallback sans LLM ;
- alternative self-hosted (modèle local) : possible plus tard, non
  requise — aucun de ces usages n'est sur le chemin critique.

Les **embeddings ne sont pas concernés** par cette règle : modèle
local, aucune donnée ne sort.

---

## 5. Roadmap en lots indépendants

Chaque lot : implémentable seul, testable (`e2e-local.sh` + pytest,
cas connus calculés à la main, données manquantes, doublons,
multi-participants), réversible (migrations down), reviewable
séparément. Conception validée avant code, comme toujours. L'ordre
technique diffère de l'ordre produit sur un point, expliqué en § 6.

| # | Lot | Objectif utilisateur | Backend | Frontend | Schéma | Critères d'acceptation (extraits) |
|---|---|---|---|---|---|---|
| 1 | **E1 — appels ingérés + catalogue** | « Quels appels sont ouverts, quand ferment-ils ? » | chargeur F&T + routeur `/api/calls` + réveil scheduler (job dédié) | `/calls` fonctionnelle : ouverts/à venir/récemment clos, recherche, filtres (programme, budget, deadline, lentille), lien source | extension `calls` | aucun appel clos affiché ouvert (test aux bornes de fuseau) ; licence relue au navigateur le jour J ; échec d'API bruyant |
| 2 | **E2 — le pont vers le passé** | « Qui a gagné les appels similaires ? » | rapprochement appels historiques (préfixes, programme) | section sur la fiche appel | aucune | chaque rapprochement dit son critère |
| 3 | **S — socle sémantique** *(conditionné à la décision RAM)* | (invisible — socle de C, D, E-V2) | extension vector, pipeline embeddings sur Mac, index, commande de recalcul | aucune | `project_embeddings` | recalcul complet par une commande ; modèle versionné ; dump/restore vérifié |
| 4 | **C1 — projets similaires** | « Qu'est-ce que je n'aurais pas pensé à chercher ? » | endpoint voisins + explications structurées | section fiche projet : paliers nommés, pourquoi, « voisins hors lentille » | aucune | jamais de score nu ; fallback = section absente ; dataset de référence de paires attendues |
| 5 | **E3 — matching décomposé** | « Où puis-je aller chercher de l'argent demain ? » | composantes + batch scores | « Opportunités détectées » sur fiches org/groupe ; « organisations pertinentes » sur fiche appel | `call_match_scores` | score toujours décomposé ; critère inconnu ≠ incompatible ; wording non prédictif |
| 6 | **A1 — euros constants** | « 2008 et 2026 comparables » | table indices + facteur à la requête + ADR méthode | segment `€ courants | € constants`, méthode visible | `price_indices` | cas calculés à la main EUR et USD ; sans date ⇒ sans valeur constante |
| 7 | **F1 — dépendance/exposition** | « De quoi dépend cette organisation ? » | parts bailleur/programme, HHI, top 3, périodes | section fiches org/groupe + **composant méthode réutilisable** | aucune | formule HHI affichée ; « au sein du corpus Orion » dit |
| 8 | **B1 — chaîne de l'argent** | « Où est passé cet argent ? » | `by=call` + agrégats par niveau | drill hiérarchique, breadcrumb extrait en composant, montants recalculés | aucune | pas de double compte (test multi-participants) ; pas de barres horizontales |
| 9 | **D1 — Lens Builder** | « Ma lentille, mes règles, visibles » | moteur bi-source, preview, versions + diff nominatif, propositions LLM | builder (concepts → règles → preview → v1), Private seul | tables lentilles utilisateur | classification 100 % règles ; diff v1→v2 nominatif ; fallback sans LLM |
| 10 | **I1 — mouvements du corpus** | « Qu'est-ce qui a changé ? » | passe snapshots+diff en fin d'ingestion | surface « mouvements » | `corpus_snapshots`, `corpus_events` | seuils écrits et versionnés ; déduplication testée |
| 11 | **G1 — outputs CORDIS** | « Qu'a produit ce projet ? » | chargeur deliverables/publications | section outputs fiche projet | tables outputs | lien déclaré ≠ inféré ; pas de métrique d'efficacité |
| 12 | **H1 — réseau qui répond** | « Qui est le pivot de cet écosystème ? » | métriques ego-réseau bornées (networkx) | constats textuels sourcés + visuel conforme DA | aucune | chaque constat cite sa métrique ; biais US dit |
| 13 | **J1 — dossier livrable** | « J'emporte et je justifie » | export structuré + annexe méthodo ; note IA sur dossier seul | boutons d'export, note liée aux vues | aucune | annexe auto-générée depuis `meta` ; constat sans vue ⇒ refusé |
| — | **K — sources (UKRI→…)** | couverture | chargeurs sur le modèle commun | à-propos, couverture | aucune structurante | **après décision RAM**, licence au jour J |

**Diff de versions nominatif (lot 9)** : construit d'abord pour les
lentilles éditoriales (bénéfice immédiat, testable sur Space/Aviation
v2), hérité ensuite par les lentilles utilisateur.

**Écart barres horizontales** : chantier de mise en conformité DA à
part (vue `bars` de l'Explorateur + benchmark + postes de veille +
mailles pays), à arbitrer indépendamment — signalé ici pour qu'aucun
lot ne s'appuie sur l'existant comme précédent.

---

## 6. Premier chantier — options et recommandation

L'instruction demande le socle qui maximise la valeur et facilite
Calls / Lens Builder / Similarity. Deux candidats sérieux :

**Option 1 — E1, l'ingestion des appels + catalogue.**
Pour : c'est la priorité produit n°1, il est **indépendant de toute
décision d'infra** (empreinte minuscule, tient dans les 8 Go), il
réveille le scheduler proprement (architecture à deux régimes posée une
fois pour toutes — le lot I en héritera), il transforme la promesse
affichée « P5 · automne 2026 » en réalité, et le matching V1 (lot 5)
peut être **entièrement structurel** (programme, thèmes, historique)
sans attendre les embeddings. Contre : il ne « facilite » pas
directement D et C.

**Option 2 — S, le socle sémantique (pgvector + embeddings).**
Pour : c'est le seul socle **commun aux trois priorités** (voisins
pour C, proximité thématique pour E-matching V2, suggestions de
concepts pour D). Contre : il est **conditionné à la décision RAM du
VPS** (§ 4.2) — le lancer d'abord, c'est mettre une décision
budgétaire sur le chemin critique ; et seul, il ne livre rien de
visible.

**Recommandation : Option 1 (E1), puis S dès que la décision RAM est
prise** — en parallèle si elle l'est vite. C'est l'ordre qui minimise
la dette : E1 ne crée aucune dépendance provisoire (le matching
structurel V1 reste valable et explicable même quand les embeddings
arrivent — ils s'ajoutent comme une composante de plus du score
décomposé, ils ne remplacent rien), tandis que S lancé avant la
décision RAM risquerait un socle calculé qu'on ne peut pas servir.

**Décisions attendues de Charlotte avant d'ouvrir le chantier :**

1. valider (ou amender) l'ordre : E1 d'abord ;
2. trancher la RAM du VPS (8 → 16 Go) — conditionne S/C et la vague K ;
3. accord de principe sur le cadre IA du § 4.4 (aucun usage avant les
   lots 9 et 13, mais le cadre mérite d'être acté tôt) ;
4. méthode euros constants (OCDE/CAD proposée) — peut attendre le lot 6.

---

## 7. Ce qu'on ne construit pas (et pourquoi c'est dit ici)

- **Pas de chatbot « Ask Orion »** — usages IA contextuels seulement,
  chacun relié à des données précises et vérifiables ;
- **pas de score magique** — tout score affiché est décomposé ou ne
  s'affiche pas ;
- **pas de prévision** — les scénarios du lot F sont des expositions
  historiques, et le wording le dit ;
- **pas de brevets** tant qu'aucune source ne passe la règle de
  licence ;
- **pas de graphe global** des 110 k organisations — des ego-réseaux
  bornés qui répondent à des questions ;
- **pas de file de jobs, pas de Redis, pas de SaaS de vecteurs** tant
  qu'aucun lot validé ne les exige ;
- **pas de nouvelles sources** avant la décision de dimensionnement ;
- **pas de Shared/Public** sur les lentilles utilisateur avant les
  invitations d'équipe.
