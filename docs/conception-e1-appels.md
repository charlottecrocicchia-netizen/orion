# Conception E1 — les appels entrent dans Orion

> Chantier ouvert le 2026-08-22 sur validation fondatrice de
> l'[audit intelligence](audit-intelligence.md). Périmètre E1 strict :
> source officielle → ingestion → base → API → `/calls` → fiche appel →
> provenance. Ni matching, ni score — la fiche est structurée pour que
> le matching vienne dessus sans refonte (E2/E3).

## 0. Porte de licence — franchie sur pièce le 2026-08-22

Lecture au navigateur, règle sans exception :

- **Terms & Conditions du portail** (PDF officiel v7.0, 01.02.2024, 16
  pages, lues intégralement) : elles régissent **l'usage du portail et
  de son système d'échange** (comptes EU Login, rôles LEAR/LSIGN,
  soumissions) — pas la réutilisation des données. § 2.1.1 : « Access
  to the public parts of the Portal is open to all users. » Les
  restrictions de PI (§ 3.4) portent sur **le logiciel du portail**
  (interdiction de copier/décompiler le portail), pas sur les données
  d'appels.
- **Mention légale de la Commission** (`commission.europa.eu/legal-notice_en`,
  relue ce jour) : « Unless otherwise indicated… content owned by the
  EU on this website is licensed under the Creative Commons Attribution
  4.0 International (CC BY 4.0) licence » — décision 2011/833/UE,
  réutilisation commerciale comprise, **attribution + indication des
  modifications**.
- **Page « APIs » du portail** (SPA, lue au navigateur) : documentation
  **officielle** des API publiques — « EU F&T Portal provides a rich
  public REST APIs where any external system can call », « available
  for companies and organisations… for further integration with their
  internal systems ». L'incertitude de l'audit sur le statut de
  l'endpoint est **levée** : l'usage par des systèmes externes est
  l'usage documenté. Aucune authentification pour les données
  publiques, **aucun quota publié** (politesse de rigueur : requêtes
  espacées, User-Agent identifiable, échec bruyant — jamais de retry
  agressif).

**Verdict : PASSE.** Attribution portée au produit : « Source : portail
EU Funding & Tenders, © Union européenne, CC BY 4.0 » (pied de `/calls`,
fiche appel, À-propos). Registre des sources mis à jour dans ce lot.

## 1. Source et API retenues

- **SEARCH API** : `POST https://api.tech.ec.europa.eu/search-api/prod/rest/search?apiKey=SEDIA&text=***`
  — multipart : pièce `query` (JSON, syntaxe bool/terms/range vérifiée),
  pièce `languages` (`["en"]` — sans elle, un enregistrement **par
  langue**), pagination `pageSize/pageNumber`.
- **FACET API** : même forme sur `…/rest/facet` — traduit les codes de
  référence (statuts, programmes-cadres).
- Codes vérifiés sur le vif (2026-08-22) : statuts `31094501`
  Forthcoming / `31094502` Open / `31094503` Closed ; types `1` Grant,
  `2` Calls for proposals, `8` Cascade funding ; `frameworkProgramme`
  `43108390` = Horizon Europe, + DIGITAL, EDF, LIFE, SMP, EURATOM…
- Volumétrie constatée (EN) : **1 219 topics Grant + 27 Calls for
  proposals** ouverts/à venir ; 17 796 clos au total ; requête `range`
  sur `deadlineDate` opérationnelle (95 clos mai-août 2026).

**Champs disponibles par topic** (constatés sur enregistrements réels) :
`identifier`, `title`, `callIdentifier`, `status`, `deadlineDate`
(liste — cut-offs multiples), `deadlineModel`, `startDate` (ouverture),
`frameworkProgramme`, `programmePeriod`, `typesOfAction`, `keywords`,
`tags`, `crossCuttingPriorities`, `destination`/`mission` (quand
applicable), `budgetOverview` (JSON : par action, contributions
min/max, subventions attendues, budget par année, dates), `descriptionByte`
(HTML), `topicConditions` (HTML), `url` (fiche portail), `reference`
(id document).

**Périmètre V1** : types **1 + 2** (subventions), statuts **Open +
Forthcoming**, langue **EN** (le contenu source n'existe qu'en
traductions machine par ailleurs — l'interface reste FR/EN, le contenu
source est dit anglais, comme le corpus). Amorçage des « récemment
clos » : une passe `range` sur les 6 derniers mois. **Hors périmètre
V1, dit au registre** : cascade funding (type 8 — grain différent,
métadonnées pauvres), appels d'offres (type 0 — marchés publics, pas
des subventions), langues autres que EN.

## 2. Correspondance schéma — le fait, la classification, l'analyse

Doctrine gravée : **donnée officielle ≠ classification Orion ≠ analyse
Orion**, visible dans le modèle.

- **`call_topics` (nouvelle table — le fait source)** : `id`, `source`
  (`ft-portal`), `source_id` (= identifier, unique avec source),
  `reference`, `identifier`, `title`, `call_code` (= callIdentifier),
  `call_id` FK nullable → `calls` (le pont vers l'historique : CORDIS
  remplit `calls.code` avec les mêmes identifiants d'appel — c'est la
  charnière d'E2), `framework_programme_code`, `framework_programme_label`
  (résolu par FACET), `status_code`, `status_label`, `opening_date`,
  `deadline_dates` (JSONB, liste datée — cut-offs multiples),
  `deadline_model`, `types_of_action` (JSONB), `keywords` (JSONB),
  `tags` (JSONB), `cross_cutting` (JSONB), `budget_overview` (JSONB
  verbatim), `description_html`, `conditions_html`, `url`, `raw`
  (JSONB, payload complet), `first_imported_at`, `last_seen_at`,
  `last_synced_at`. Migration réversible unique.
- **`calls` (existante — intouchée dans sa sémantique)** : les
  `callIdentifier` F&T sont upsertés (`funder=ec`, `code`), ce qui
  relie mécaniquement appels à venir et projets passés du même code.
- **Classification Orion** : `call_topic_lens_tags(call_topic_id, lens,
  tag, proof, rule)` — **V1 structurelle uniquement** : les règles
  `call` (préfixes) et `programme` des lentilles publiées, appliquées à
  `identifier`/`call_code`. Pas de règle texte en V1 (ce serait un
  nouveau chemin du moteur — plus tard, avec ses gardes). Aucune
  correspondance honnête → aucun tag. Affichée à part, jamais mêlée aux
  champs source.
- **Analyse Orion (futur E3)** : table de scores séparée, hors E1.

**Statut affiché = dérivé des dates, jamais du seul code source** : un
topic `Open` dont toutes les deadlines sont passées s'affiche clos
(règle « aucun appel clos présenté comme ouvert »), le code source
reste visible en provenance. Deadlines stockées en UTC (l'API fournit
`+0000`), affichées en heure de Bruxelles (le fuseau officiel de
soumission), testées aux bornes.

## 3. Ingestion — données vivantes

- **Chargeur** `orion-ingest calls` (`ingest/ftcalls/`), motif maison :
  `record_run` → journal `ingestion_runs` source `calls` (compteurs :
  lus, upsertés, invalides, pages), upsert `ON CONFLICT (source,
  source_id)`, `last_seen_at` touché, **jamais de suppression** (un
  topic disparu du flux garde sa dernière photographie ; le compteur
  `missing` le dit). Idempotent : rejouer sans changement = 0 doublon.
- **Snapshot brut** : pages JSON de la moisson écrites dans
  `backend/data/cache/ft-calls/` (volume `ingest_data`, présent sur le
  VPS) + `raw` JSONB par topic — auditabilité comme les autres sources.
- **Robustesse** : timeout httpx, une erreur HTTP = run `failed`
  bruyant, la base reste sur la dernière moisson saine ;
  le multipart et la pagination sont encapsulés dans un client testé
  sur fixtures enregistrées.
- **Scheduler (réveil ciblé)** : `ORION_SCHEDULER_JOBS` (défaut `all`,
  le VPS mettra `calls`) + `ORION_CALLS_CRON` (défaut quotidien 05h00
  UTC). Le job `calls` est le seul allumé en prod : léger (≈ 1 300
  topics EN), indépendant du corpus lourd qui reste au régime
  « Mac + dump ». Relance manuelle : `make prod-ingest SOURCES=calls`.

## 4. API Orion

Derrière le middleware privé, conventions maison (pagination
`page/size`, refus `INVALID_LENS` partagé) :

- `GET /api/calls` — filtres : `status` (`open|upcoming|closed`,
  dérivé), `programme` (code cadre), `action` (type d'action), `q`
  (ILIKE unaccent sur identifier/titre/mots-clés — volumétrie faible,
  pas de FTS en V1), `deadline_before/after`, `sector` (lentille
  publiée, via tags structurels), tri deadline par défaut ; réponse
  avec `total`, `results`, `meta` (filtres rejoués, `last_synced_at`,
  attribution).
- `GET /api/calls/{id}` — fiche complète : champs source, budget par
  action, HTML **sanitizé côté serveur** (description/conditions),
  bloc classification Orion séparé, provenance (url portail, statut
  source, dernière synchro, attribution).

## 5. UX `/calls`

Remplace le `PhasePlaceholder` (le patron de page existe). DA
existante, FR/EN, dark/light, responsive, reduced-motion, **aucune
barre horizontale**.

- **Liste** : trois groupes — Ouverts (tri deadline croissante, jours
  restants), À venir (date d'ouverture), Récemment clos (repliés) ;
  recherche ; filtres programme-cadre / type d'action / lentille ;
  chaque rangée : identifiant, titre, cadre, deadline (+ modèle
  cut-offs multiples), fourchette de contribution quand `budgetOverview`
  la donne, lien source. État dans l'URL (philosophie URL = vue).
  Bandeau de fraîcheur : « Synchronisé le … depuis le portail EU
  Funding & Tenders » + attribution.
- **Fiche `/calls/:id`** : titre, appel parent, statut dérivé + dates
  officielles, tableau budget par type d'action (vertical), description
  puis conditions (repliées), mots-clés/tags, classification Orion
  dans un bloc distinct étiqueté, lien « Voir sur le portail officiel »,
  attribution. Structure prête pour E2 (« qui a gagné les appels
  similaires » s'insérera par `call_code`) et E3 (bloc analyse).
- `/calls` sort de `LENS_BLIND` (le filtre lentille devient réel).

## 6. Tests

- **Backend** : parsing/mapping sur fixtures JSON enregistrées (vraies
  réponses anonymes de l'API) ; idempotence (double run = 0 doublon) ;
  dérivation de statut aux bornes (deadline passée + statut source
  `Open` → affiché clos ; fuseaux testés) ; cut-offs multiples ;
  topic sans budget ; upsert `calls` pont ; tags structurels (préfixe
  `call` d'aviation.csv attrape un topic Clean Aviation, aucun tag
  sans règle) ; API filtres + refus lentille invalide + sanitization
  HTML.
- **e2e** : seed de topics synthétiques dans `seed_e2e.py` (ouvert /
  à venir / clos, un taggé `test-lens`) ; specs `/calls` (groupes,
  recherche, filtre, lien source, fraîcheur) et fiche.
- **Recette** : `./scripts/e2e-local.sh` (exit 0 hors pipe), pytest,
  vitest — la CI étant muette jusqu'au 2026-09-01.

## Recette production — E1 déployé le 2026-08-22

Snapshot **S4** pris par la fondatrice avant le geste ; mention légale
**relue au navigateur le jour du déploiement** (CC BY 4.0 inchangé,
décision 2011/833/UE) ; images construites **sur le VPS** (D1, CI
muette) ; migration `0031` appliquée à l'entrée de l'API.

- **Boucle complète vérifiée sur lensorion.com** : 1 653 topics en
  base (407 ouverts à l'écran), recherche/filtres/état d'URL, fiche
  appel complète, classification aviation démontrée (18 Clean
  Aviation, la règle affichée), lien portail, attribution, fraîcheur
  datée du run scheduler, FR/EN, dark/light, mobile, avec/sans
  lentille (refus compris).
- **Invariants au chiffre près** : 699 798 / 110 116 / 1 102 270 ;
  Space 10 278/4 537 ; Aviation 1 752/2. Non-régression : auth (401
  anonyme partout, landing et overview publics servis), Explorer,
  recherche projets/organisations, fiche organisation, dossier.
- **Régime vivant éprouvé en prod** : run scheduler réel observé
  (cron temporaire `*/2`, restauré à `0 5 * * *`) — 1 653 topics
  stables, **0 doublon** (1 653 identifiants distincts), journal
  `ingestion_runs` complet (y compris l'échec contrôlé « source
  injoignable » : run `failed` bruyant, base intacte, **reprise
  propre au run suivant**), 18 pages brutes en cache. Le scheduler ne
  porte QUE `calls` (« jobs 'calls' » au journal).
- **Incident corrigé au déploiement** : le volume `ingest_data`
  (créé root avant le chown de l'image) refusait l'écriture du cache —
  échec journalisé (run 105), corrigé par chown one-off ; un volume
  neuf hérite désormais de la propriété `appuser` de l'image.
- **Dossier « 16 Go », pièce 1 (RAM VPS 7 746 Mio)** : avant
  déploiement — utilisé 3 123 Mio (postgres 2,30 Gio, api 177 Mio) ;
  après ingestion calls — postgres 2,16 Gio, api 83 Mio (la moisson
  est un poids plume) ; après scheduler + recette à chaud — utilisé
  3 610 Mio (postgres 2,23 Gio, **api 617 Mio à caches chauds**,
  scheduler 32 Mio), ~4,1 Gio « available » (page cache compris). Le
  poste qui gouverne reste le couple postgres + page cache du corpus ;
  E1 n'y ajoute rien de mesurable. À re-mesurer après le passage à
  16 Go, même protocole.

## Ce qu'E1 ne fait pas

Pas de matching ni de score (E3) ; pas de règle texte sur les appels ;
pas de type 8 ni d'appels d'offres ; pas d'alertes ; pas d'ingestion
multilingue ; pas d'événements calls (lot I) — le modèle n'interdit
rien de tout cela.
