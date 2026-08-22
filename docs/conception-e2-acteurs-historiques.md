# Conception E2 — « Acteurs historiquement proches » d'un appel

> Plan court, instruit le 2026-08-22 sur la prod fraîchement déployée
> (E1 recetté le même jour). Périmètre : une V1 **sans embeddings,
> sans score global de fit** — une réponse factuelle, explicable et
> reconstruisible depuis les données, à la question : « pour cet
> appel, quels acteurs ont historiquement gagné ou participé à des
> appels/projets comparables, et pourquoi Orion les considère-t-il
> pertinents ? » **Statut : soumis pour arbitrage, aucun code écrit.**

## 1. Les jointures réellement disponibles (mesurées en prod)

| Chemin | Grain | État |
|---|---|---|
| `call_topics.call_id → calls → projects` | le MÊME code d'appel | vivant — E1 ponte les codes F&T vers la table `calls` que CORDIS remplit |
| `calls.code` normalisé (années → `Y`) | la famille d'appel entre générations | calculable en SQL pur, index possible |
| `identifier` de topic normalisé (années → `Y`, numéros de queue retirés) | la **destination** (`HORIZON-CL4-Y-SPACE`) | calculable en SQL pur — nécessaire quand l'appel est transversal au cluster (constat § 3) |
| `projects → participations → organisations → groups` | acteurs, rôles, montants, pays, groupes consolidés | tout existe (couche identité comprise) |
| `call_topic_lens_tags` ↔ `project_lens_tags` | lecture Orion des deux côtés | vivant (V1 structurelle) |
| `organisation_partners` (co-participations) | partenaires récurrents des acteurs trouvés | endpoint existant réutilisable |
| euroSciVoc | thèmes projets | **CORDIS seulement, et RIEN côté appels** (les `keywords/tags` F&T sont du texte libre) — pas de jointure taxonomique propre |

## 2. Couverture du pont (prod du 2026-08-22, 1 653 topics)

- **Pont exact** (même code d'appel déjà porteur de projets) :
  **456 topics** — surtout les appels récurrents à cut-offs multiples
  (MSCA-PF : 1 322 projets déjà financés sous le même code, ERC-POC :
  240, EIC Accelerator : 162).
- **Famille d'appel normalisée** : **936/1 653 topics (57 %)**,
  atteignant **24 285 projets historiques**. Par programme-cadre :
  **Horizon Europe 924/1 173 (79 %)**, Euratom 12/23, **et zéro
  partout ailleurs** (EDF 0/71, LIFE 0/64, DIGITAL 0/61, Erasmus,
  CEF…) — le corpus ne porte pas leur historique. La surface devra le
  DIRE (« pas d'historique comparable dans le corpus Orion »), jamais
  l'habiller.

## 3. Exemples réels (requêtes rejouables, prod)

**A — Clean Aviation** (`HORIZON-JU-CLEAN-AVIATION-2026-04-FTA-05`,
famille par code d'appel) : DLR 21 projets (2 coordinations), Airbus
Operations SAS 19 (111,8 M€, 2 coord.), NLR 18, Airbus GmbH 14
(5 coord.), ONERA 14, Fraunhofer 14, Leonardo 12 — période 2022-2026.
Le « pourquoi » est une phrase vraie : *présent N fois dans la famille
d'appels HORIZON-JU-Clean-Aviation-\**.

**B — SPACE, le piège qui a réglé la méthode**
(`HORIZON-CL4-2027-SPACE-03-12`) : son `call_code`
(`HORIZON-CL4-2027-03`) est **transversal au cluster** — la famille
par code d'appel remonte du CL4 générique (DFKI, BSC, Eclipse
Foundation : vrais lauréats CL4, faux voisins spatiaux). La famille
par **identifiant de topic** (`HORIZON-CL4-Y-SPACE`, 4 appels, 93
projets) remonte les bons : DLR 19, **Thales Alenia Space 18
(4 coord.)**, **Airbus Defence and Space 17 (3 coord.)**, ONERA 15,
CNRS 15, GMV 8. → **L'échelle de dérivation est une hiérarchie
nommée** : ① pont exact ; ② famille par identifiant (destination) ;
③ famille par code d'appel — chaque résultat affiche l'échelle qui l'a
produit, et l'échelle la plus fine disponible gagne.

## 4. Ce qu'on peut affirmer honnêtement (le contrat de la V1)

Pour chaque acteur : *« a participé à N projets (dont C en
coordination) financés sous [pont exact : cet appel · famille : les
appels HORIZON-CL4-\*-SPACE], entre AAAA et AAAA, pour M € observés
au sein du corpus Orion »* — avec les liens vers la fiche
organisation/groupe et vers l'Explorateur cadré (URL = vue, ajoutable
au dossier). Wording gravé d'E1 conservé : pertinence **historique**,
jamais une garantie d'éligibilité ni un pronostic. Pas de score
global ; l'ordre d'affichage est un tri déclaré (projets, puis
montants), pas un jugement.

## 5. Ce qui attendra la couche sémantique (socle S)

- les topics **sans famille dans le corpus** (les 43 % : EDF, LIFE,
  DIGITAL… et les destinations Horizon neuves) — seul le texte du
  topic peut les rapprocher de projets comparables ;
- « même problème traité » à travers programmes et secteurs
  (transferts intersectoriels du lot C) ;
- le rapprochement `keywords/tags` F&T ↔ euroSciVoc projets (texte
  libre d'un côté, taxonomie de l'autre).

## 6. Esquisse d'implémentation (à valider avant tout code)

- **Backend** : un module de familles (normalisation testée sur cas
  connus — les regex de § 3 versionnées et documentées) ; endpoint
  `GET /api/calls/{id}/historical-actors` — échelle choisie + acteurs
  (organisation/groupe consolidé, N projets DISTINCT, C coordinations,
  période, Σ `participations.amount_eur`, pays) + `meta` disant
  l'échelle, la famille, le périmètre corpus ; calcul à la requête
  avec le cache applicatif existant (les familles pontées touchent au
  plus ~1 300 projets — mesuré).
- **Frontend** : une section « Acteurs historiquement proches » sur la
  fiche appel (bloc DISTINCT de la donnée officielle, comme la
  classification), rangée par l'échelle ; état vide honnête pour les
  topics sans pont ; « partenaires récurrents » de l'acteur en second
  niveau via l'endpoint partenaires existant.
- **Tests** : normalisation (cas SPACE du § 3 en gold), invariants de
  comptes DISTINCT (multi-participations), topics sans pont, e2e sur
  graine (famille synthétique TEST-CALL déjà semée).

**Hors périmètre E2** : score de fit (E3), embeddings (socle S), toute
suggestion de partenaires au-delà des partenaires récurrents observés.
