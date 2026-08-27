# Lot B — Chaîne de l'argent public. B0 : audit méthodologique et contrat de drill-down

Date : 2026-08-27. Statut : **contrat B0 validé (arbitrages D1-D7
tranchés) ; chantier B0.1 d'assainissement CORDIS exécuté — voir § 13 ;
B1 non ouvert.** Aucune UI, aucune migration de schéma. Base auditée :
corpus complet en base dev locale (699 798 projets, 1 102 270
participations, 110 116 organisations, snapshot du 2026-08-27) ; code
d'ingestion et de lecture lus sur pièces (fichier:ligne cités). Les
chiffres marqués « avant B0.1 » décrivent l'état constaté par l'audit ;
les valeurs courantes sont au § 13.

La question du lot : **« Où est passé cet argent ? »** Le modèle cible
soumis à l'audit :

```text
Financeur → Programme → Call/Topic → Projet/Award → Participation → Organisation → Pays
```

Verdict d'ensemble : **le modèle cible n'est pas le modèle supporté.**
La chaîne complète à sept niveaux n'existe que pour CORDIS. Pour NIH et
NSF, l'étage Call/Topic est absent des données ingérées — il se saute,
il ne se simule pas. Et aucune transition monétaire de la chaîne n'est
une décomposition exacte dans les trois sources à la fois : chaque
étage porte **sa** mesure, avec sa sémantique comptable propre, et le
contrat B0 est précisément la carte de ce qui se somme, ce qui se
descend, et ce qui ment si on le somme quand même.

---

## 1. Le modèle réellement supporté par les données

### 1.1 Par source

```text
CORDIS   ec  → Programme (framework → legalBasis) → Call (subCall) → Projet → Participation → Organisation → Pays
                                                     [Topic : dans raw uniquement, non normalisé]
NIH      nih → Programme (= institut IC)          → ∅              → Projet (core project)  → Participation (unique, copie) → Organisation → Pays
NSF      nsf → Programme (= division)             → ∅              → Projet (award/fratrie) → Participation (= award)      → Organisation → Pays
                                                                      ↕ axe parallèle R5B : obligations annuelles par award (USD, vintage, FY2011–2025)
```

### 1.2 Ce que « supporté » veut dire ici

- **CORDIS** est la seule source où la chaîne descend sur les sept
  niveaux avec des clés normalisées. Le niveau *topic* (plus fin que
  l'appel : `HORIZON-EIC-2021-PATHFINDEROPEN-01-01`) existe pour 100 %
  des 84 452 projets CORDIS mais **uniquement dans `raw->>'topics'`** —
  exploitable en lecture, non normalisé. Il rejoint `call_topics`
  (corpus E1) par l'identifiant pour les appels récents : 5 370 projets
  CORDIS sont aujourd'hui sur un appel couvert par E1.
- **NIH** : pas d'appel ingéré (le FOA RePORTER n'est pas parsé), pas
  de coût total, une seule participation par projet qui **recopie** le
  montant du projet (`nih/load.py:259`) — ce n'est pas une part.
- **NSF** : pas d'appel ingéré. La participation est en revanche une
  vraie part : un award constituant par institution, y compris dans les
  fratries collaboratives repliées (`source_id = c-<fy>-<md5:16>`).
  L'axe annuel R5B (`nsf_award_obligations`) est un **second système de
  mesure**, indépendant, en USD, versionné par vintage — jamais un
  raffinement du premier.

### 1.3 L'existant suffit-il ? (règle : pas de nouvelle abstraction sans preuve)

**Oui pour l'ossature.** Toutes les tables des sept niveaux existent,
avec FK, index et contrainte d'unicité par source. Aucune table
nouvelle n'est nécessaire pour naviguer la chaîne telle que les données
la permettent. Trois manques réels, aucun ne justifiant une abstraction
en B1 :

1. **Programme → Call n'est pas normalisé** (`calls` n'a pas de
   `programme_id`) — reconstruction par co-occurrence via `projects`,
   § 7. C'est une requête, pas une table. Après B0.1, l'ambiguïté
   résiduelle (103 appels multi-programmes) est **réelle** : appels
   transversaux (Adhoc, SME Instrument) dont les lauréats relèvent de
   lignes budgétaires différentes.
2. **Le topic CORDIS n'est pas normalisé** — il vit dans `raw`. Le
   normaliser serait une décision d'ingestion, pas un préalable B1.
3. **La nature comptable du montant n'existe nulle part dans le
   schéma** : `projects.funding_amount` agrège un engagement
   prévisionnel (CORDIS) et deux cumuls d'obligations (NIH, NSF) sous
   une même colonne — constat déjà gravé
   (`conception-reference-engine.md:451`, R5A § 2.4) mais porté par
   les docs seulement, par rien dans le code ni les écrans. Le contrat
   B0 la porte (§ 5-6) ; sa matérialisation éventuelle est un
   arbitrage (§ 11, D3 — tranché : contrat d'affichage, pas de colonne).

---

## 2. Cartographie des tables et objets existants

| Niveau cible | Table(s) | Volume | Clés réellement utilisées |
|---|---|---|---|
| Financeur | `funders` | 4 (`ec`, `nih`, `nsf` ; `ademe` vide, 0 projet) | `projects.funder_id`, `programmes.funder_id`, `calls.funder_id` |
| Programme | `programmes` | 229 (EC 80 — 176 dont 96 parasites avant B0.1 ; NIH 77 ; NSF 72) | `projects.programme_id` (100 % des projets), `parent_id` (EC seul, 2 niveaux) |
| Call | `calls` | 2 481, **EC uniquement** ; `year` et `title` jamais renseignés | `projects.call_id` (CORDIS seul), unicité `(funder_id, code)` |
| Topic (prospectif) | `call_topics` (+ `call_topic_lens_tags`) | 1 654 (`ft-portal`), 100 % pontés vers `calls` (535 appels distincts) | `call_topics.call_id` ; `identifier` ↔ `projects.raw->>'topics'` (non matérialisé) |
| Projet/Award | `projects` (+ `project_texts`, `project_topics`) | 699 798 | unicité `(source, source_id)` ; FK funder/programme/call |
| Participation | `participations` | 1 102 270 | `project_id`, `organisation_id`, unicité `(source, source_uid)` |
| Organisation | `organisations` (+ `organisation_aliases`, `organisation_identifiers` : pic 79 785, ipf 16 313, lei 11 392, uei 7 495, rnsr 151) | 110 116 | dédup cross-source (trigram + identifiants) ; `uei_links` (hiérarchies UEI) |
| Pays | `countries` (+ `subdivisions`, `nuts_nomenclature`) | — | `participations.country_code` (≈ aligné sur `organisations.country_code`, 18 divergences) |
| Obligations NSF | `nsf_award_obligations` (+ `_artifacts`, `_totals`) | 326 313 lignes, vintage 2026-08-26, FY2011–2025 | `award_id` ↔ `participations.source_uid` (source `nsf`) |
| Référentiels monnaie | `exchange_rates` (BCE annuel, **2004–2025**), `price_indices` (vintage) | — | division par `rate_to_eur` à l'ingestion ; indices lus à la lecture (euros constants) |

Lecture existante : tout l'agrégat vit dans `backend/src/orion/search/`
(`analytics/` est vide). L'Explorateur porte déjà la règle
anti-double-compte grain-par-dimension (`explore.py:7-10`) et un
drill-down **programme → enfants directs** (`explore.py:559-565`) —
c'est le seul drill hiérarchique monétaire existant. Il n'existe ni
chaîne financeur→…→organisation, ni paramètre de cadrage `funder=`.

---

## 3. Différences CORDIS / NIH / NSF — la sémantique comptable

Un même mot, trois comptabilités. Le tableau qui interdit de croire les
colonnes sur parole :

| Terme | CORDIS | NIH | NSF (awards) | NSF (obligations R5B) |
|---|---|---|---|---|
| **« funding » projet** (`funding_amount`) | `ecMaxContribution` : **engagement prévisionnel plafonné**, complet à la signature, projet entier (`cordis/load.py:171`) | **Σ des obligations annuelles publiées** (`TOTAL_COST` par FY, hors sous-projets), fenêtre FY2005+ (`nih/load.py:135`) | **obligation cumulée à date d'ingestion** (`awd_amount` — l'intention `tot_intn_awd_amt` est délibérément non lue, `nsf/parse.py:89-92`) | sans objet |
| **« budget »** (`total_cost`) | coût total cofinancements inclus — **> contribution UE** ; 12 377 projets Horizon publient **0** source | jamais écrit (NULL) | jamais écrit (NULL) | sans objet |
| **montant participant** | `ecContribution` : **vraie part** de l'organisation | **copie du montant projet** — pas une part (`nih/load.py:259`) | `awd_amount` **de l'award membre** : vraie part | sans objet |
| **montant annuel** | **n'existe pas** (aucune annualité CORDIS) | détruit à l'ingestion (seule la liste des années survit dans `raw`) | conservé dans `raw.fiscal_years` (JSONB, non normalisé) | **la** mesure : obligation d'un FY, telle que publiée, USD, vintage |
| **montant programme/appel** | n'existe pas en base (les enveloppes d'appel couvrent 0,008 % du corpus — R5A) | n'existe pas | n'existe pas | dénominateur officiel par FY (`nsf_obligation_totals.official_total`) |
| devise | EUR natif (copie directe vers `_eur`) | USD ; EUR = ÷ taux BCE de **l'année de `start_date`** | idem NIH ; taux **du projet** appliqué aux membres (`nsf/load.py:401`) | USD, **jamais converti** |
| période rattachée | `startDate` | `min(project_start)` — peut précéder de décennies les tranches sommées | `min(awd_eff_date)` | FY fédéral |
| zéro source | conservé (`total_cost = 0` stocké 0) | **≤ 0 → NULL** (`nih/parse.py:32-40`) | **≤ 0 → NULL** (`nsf/parse.py:43-50`) | conservé (1 472 lignes à 0, 4 négatives = désobligations) |
| grain projet | 1 projet CORDIS | 1 `CORE_PROJECT_NUM` (convention ①) | 1 `awd_id` **ou** 1 fratrie collaborative (analyse Orion, 4 gardes + filet de dates) | grain crosstab = combinaison de toutes les dimensions |

Leçon R5 appliquée : `funding_amount` est légitime pour « combien a été
attribué à ce projet », **illégitime** dès qu'on le fait passer pour un
budget, une dépense, ou qu'on le compare entre financeurs sans dire sa
nature. Il n'existe aucune ligne comptable commune aux trois sources
(R5A § 3.3) — le lot B hérite de ce verdict, il ne le rejoue pas.

---

## 4. Matrice des grains et mesures (niveau × grain × mesure × nature × sommabilité)

Notation nature : **F** = fait source, **D** = dérivé (calcul
déterministe de faits source), **A** = analyse Orion. Une cellule
« sommable » ne l'est jamais qu'**au sein d'un même financeur et d'une
même mesure** — la sommabilité inter-financeurs se joue en EUR dérivé,
avec exclusions affichées (§ 6).

| Niveau | Objet / grain | Identifiant | Mesure monétaire disponible | Définition exacte | Nature | Devise | Période | Sommable ? | Agrégation valide jusqu'à | Couverture / manques |
|---|---|---|---|---|---|---|---|---|---|---|
| Financeur | `funders` / le bailleur | `code` | **aucune en propre** — tout montant à cet étage est un roll-up | Σ de mesures d'étages inférieurs, « observé dans le corpus Orion » | D | selon roll-up | fenêtre du corpus | — | libellé obligatoire (§ 9) | `ademe` vide |
| Programme | `programmes` / ligne budgétaire (EC), institut (NIH), division (NSF) | `(funder_id, code)` | aucune en propre — roll-up | idem | D | — | — | — | idem ; **jamais** comparable entre financeurs (trois sémantiques de « programme ») | EC : assaini en B0.1 (avant : 96/176 parasites, 275 projets, ~537 M€ mal rangés) |
| Call | `calls` / appel à propositions (EC) | `(funder_id, code)` | aucune en propre — roll-up des projets de l'appel | Σ `ecMaxContribution` des projets lauréats — **pas** l'enveloppe de l'appel | D | EUR | par appel | oui (mesure homogène, EUR natif) | l'appel, et remontée restreinte (§ 7) | CORDIS seul ; `year`/`title` vides |
| Topic (E1) | `call_topics` / topic prospectif | `identifier` | `budget_min_eur`/`budget_max_eur` | fourchette de contribution UE **par subvention** ; `expected_grants` | F (extrait) → D (min/max filtrés) | EUR supposé (aucune colonne devise) | par topic | **NON** — jamais une enveloppe (piège R5A : ×34,8 / 5 100 %) | affichage unitaire uniquement | 1 654 topics, prospectifs seulement |
| Projet | `projects` / cf. § 3 grain par source | `(source, source_id)` | `funding_amount` (+ `_eur`) ; `total_cost` (CORDIS) | § 3, ligne 1 — trois natures comptables sous une colonne | F (CORDIS) ; D (NIH, NSF : Σ de faits annuels/awards) | native + EUR dérivé | projet entier, rattaché à `start_date` | oui, par source ; inter-sources en EUR avec exclusions | tout étage supérieur, en « Σ observée » | NIH : 14 931 sans montant, 71 149 sans EUR (dont 32 852 pré-2004 sans taux BCE) ; NSF : 4 412 sans EUR ; Horizon : 12 377 `total_cost=0` source |
| Participation | `participations` / un rôle d'une organisation dans un projet | `(source, source_uid)` | `amount` (+ `_eur`) | CORDIS : part `ecContribution` ; NSF : award membre ; **NIH : copie du total projet** | F (CORDIS, NSF) ; D-copie (NIH) | native + EUR dérivé | projet entier | oui par source **à cet étage seul** — jamais additionné à l'étage projet | organisation, pays, programme (grain participation) | `associatedPartner` Horizon : 24 423 sans montant (la source n'en publie pas) ; FP7 : 8 202 sans montant ; NIH : 940 projets sans participation (781 M€ d'écart d'étage) |
| Organisation | `organisations` / entité dédupliquée | `id` (+ identifiants) | aucune en propre — roll-up de participations | Σ des parts observées | D (sur dédup **A**) | EUR dérivé | fenêtre corpus | oui, en DISTINCT projets | pays, financeur (restrictions § 9) | 720 sans pays |
| Pays | `countries` / pays de l'organisation participante | `code` | roll-up de participations | destination **institutionnelle** — pas lieu d'exécution, pas « effort national » (R5A § 13) | D | EUR dérivé | fenêtre corpus | oui, mêmes règles | — | NIH : 12 811 participations sans pays |
| Obligation NSF | `nsf_award_obligations` / ligne de crosstab officiel | `(vintage, award_id, FY, dims)` | `amount` | obligation d'un exercice fiscal, snapshot officiel | F | USD, jamais converti | FY, par vintage | oui **après pré-agrégation par award** ; réconciliée à `official_total` | division, état, pays, organisation (dimension par jointure) | FY2011–2025 ; couverture ≥ 98,98 % partout ; `available` gelé à 0,95 |

---

## 5. Doctrine des trois natures, appliquée à chaque étage

La doctrine E1 (« donnée officielle ≠ classification Orion ≠ analyse
Orion », `conception-e1-appels.md` § 2) s'étend à toute la chaîne. Le
contrat : **aucune valeur d'étage n'est affichée sans que sa nature
soit connue du code qui la sert** — et une analyse Orion n'est jamais
présentée dans la même colonne visuelle qu'un fait source.

**Faits source** : `ecMaxContribution`, `ecContribution`, `totalCost`
(y compris ses zéros publiés), `awd_amount` par award, les tranches
`fund_oblg_amt` (dans `raw`), chaque ligne du snapshot d'obligations
(zéros et négatifs compris), `budgetOverview` verbatim, les rôles
CORDIS, les pays sources.

**Dérivés** (déterministes, recalculables) : toute contre-valeur
`*_eur` (convention ④ — taux de l'année de début : une **hypothèse de
taux**, pas une observation) ; `funding_amount` NIH (Σ fenêtrée
FY2005+) et NSF-fratrie (Σ des awards membres) ; `budget_min/max_eur`
(min/max filtrés) ; tout roll-up d'étage (Σ appel, Σ programme,
Σ financeur, Σ organisation, Σ pays) ; `joinable_total`, `coverage`,
les écarts de décomposition (§ 8, R2).

**Analyses Orion** — trois analyses structurelles conditionnent la
chaîne elle-même et doivent être assumées comme telles :
1. **la déduplication d'organisations** (toute remontée org/pays
   repose dessus) ;
2. **le repli des fratries collaboratives NSF** (le grain projet NSF
   est une décision Orion, gardes documentées) ;
3. **le rattachement au programme** quand la source est ambiguë
   (CORDIS : un `legalBasis` retenu parmi plusieurs).
S'y ajoutent les classements/tops, les tags de lentilles, les groupes
consolidés (pondération JV). Un tri est un **tri déclaré**, jamais un
jugement (doctrine E2).

---

## 6. Règles anti-double-compte — les invariants du contrat

Quatre invariants, et les règles qui les rendent vérifiables :

**I1 — Aucun financement inventé.**
- Un montant absent reste NULL de bout en bout ; aucun repli, aucun
  taux inventé (ADR 0002 D3), aucune valeur par défaut.
- Interdit de rétro-ventiler : le montant d'un projet ne se répartit
  jamais sur ses participants sans part source (les 24 423
  `associatedPartner` et les 8 202 participations FP7 sans montant
  restent « part inconnue »).
- Interdit de présenter `budget_max_eur` (par subvention) comme une
  enveloppe, ou Σ `budgetTopicActionMap` sans déduplication (pièges
  R5A § 17.5 : 5 100 %, ×34,8).

**I2 — Aucun double compte silencieux.**
- **R1 (le piège cardinal)** : jamais `JOIN projects × participations`
  puis Σ `funding_amount` — chaque participant répète le total (gold
  G8 : ×8). Règle existante à généraliser : le grain est **dérivé de
  l'étage affiché**, jamais d'un choix client (`explore.py:37`).
  Dimensions pays/organisation/type ⇒ grain participation ; dimensions
  année/programme/financeur/appel ⇒ grain projet.
- **R2 (un seul grain monétaire par écran)** : les étages projet et
  participation ne s'additionnent jamais entre eux. Pour NIH c'est le
  même chiffre copié (1:1) ; pour CORDIS les deux étages divergent
  dans les deux sens (§ 7) — l'écart s'affiche comme ligne « non
  ventilé » chiffrée, jamais fondu.
- **R3 (NSF, deux systèmes de mesure)** : `awd_amount` (cumul) et les
  obligations FY (annuel fenêtré) ne se somment jamais entre eux, ne
  se comparent jamais sans borne de fenêtre (gold G9 : l'écart, c'est
  FY2010 hors snapshot). Toute ventilation d'obligations par dimension
  jointe **pré-agrège par award** avant jointure (piège +17 % R5A ;
  contre-poison déjà en place, `nsfobligations.py:119-127`).
- **R4 (organisation)** : comptes de projets toujours en DISTINCT
  (4 451 projets ont la même organisation sur plusieurs
  participations) ; les montants de participations distinctes
  s'additionnent (parts distinctes), les comptes non.
- **R5 (fratries NSF)** : un projet replié compte une fois ; ses
  awards membres portent les parts. Jamais projet + membres dans une
  même somme.

**I3 — Aucune agrégation entre mesures comptablement incompatibles.**
- Par financeur, en devise du financeur : sommable au sein d'un étage.
- Inter-financeurs : uniquement en EUR dérivé, uniquement étiqueté
  « Σ des engagements (EC) et obligations (NIH, NSF) observés dans le
  corpus Orion » — le libellé dit ce que la somme **est** (règle de
  nommage R5A § 19.1). Jamais « budget », jamais « dépense ».
- Un ratio n'existe que si les deux côtés sont dans la même famille
  comptable, même périmètre, même axe de temps (R5A § 3.2) — hors
  périmètre B1 de toute façon.

**I4 — Une valeur inconnue reste inconnue.**
- NULL ≠ 0, à l'écran comme dans les sommes : toute somme d'étage
  publie son périmètre (« sur N projets dont M sans contre-valeur
  EUR, exclus et comptés »), régime `excluded` du Reference Engine
  (`explore.py:1020-1188`) étendu à la chaîne. Les 75 561 projets US
  sans EUR (dont 32 852 NIH pré-2004, faute de taux BCE avant 2004)
  sortent **comptés**, jamais absorbés.
- Dette nommée : les surfaces nominales actuelles (hero, hubs,
  `country_stats`) font `coalesce(…, 0)` — le lot B ne doit **pas**
  hériter de ce régime (arbitrage § 11, D4 — validé).
- Le zéro **source** (obligations NSF à 0, désobligations négatives,
  `total_cost=0` Horizon) est un fait, pas une absence — il se somme
  et s'affiche comme tel (mais voir l'ambiguïté Horizon, § 11).

---

## 7. Matrice des transitions et cardinalités

| Transition | Clé(s) | Cardinalité constatée | Descente | Remontée | Risque de duplication / double compte | Règle qui l'évite |
|---|---|---|---|---|---|---|
| Financeur → Programme | `programmes.funder_id` | 1:N propre | ✔ | ✔ | aucun (partition) | — (parasites EC assainis en B0.1) |
| Programme → Programme | `parent_id` (EC seul, 2 niveaux) | 1:N | ✔ | ✔ | projets rattachés au parent lui-même | régime `_fold_to_children` existant : tranche « directement sur le programme » |
| Programme → Call | **aucune FK** — co-occurrence via `projects` | **N:M de fait** : 103/2 050 appels servent ≥ 2 programmes (après B0.1 ; avant : 291, aux deux tiers un artefact des parasites) — les 103 restants sont des appels transversaux réels (Adhoc, SME Instrument) | ⚠ restriction | ⚠ restriction | un appel affiché sous deux programmes avec le même total = double compte | sous un programme, un appel n'affiche que **ses** projets de ce programme ; jamais de « total appel » global sous un programme |
| Call → Projet | `projects.call_id` | 1:N (CORDIS seul, 100 %) | ✔ CORDIS ; ∅ NIH/NSF | ✔ CORDIS | aucun | étage absent = étage sauté, jamais simulé |
| Call ↔ Topic E1 | `call_topics.call_id` ; `raw->>'topics'` ↔ `identifier` | 1:N ; pont projet↔topic non matérialisé | ⚠ (enrichissement) | ⚠ | budgets topic ≠ enveloppe | I1 ; topics = fourchettes par subvention, prospectives |
| Projet → Participation | `participations.project_id` | CORDIS 1:5,2 méd. 1-2 max 208 ; NIH 1:1 (940 orphelins) ; NSF 1:1,11 max 21 | ✔ | ✔ | **le** piège : total projet répété par participant ; décomposition CORDIS non conservative (deux sens) ; NIH = copie | R1, R2 ; écart affiché en « non ventilé » |
| Participation → Organisation | `organisation_id` | N:1 (dédup A) | ✔ | ✔ | même org plusieurs fois par projet (4 451 cas) | R4 : comptes DISTINCT |
| Organisation → Pays | `country_code` (participation, alignée org à 18 lignes près) | N:1 | ✔ | ✔ | néant | pays = pays de l'organisation participante, libellé « destination » |
| Participation NSF → Obligations FY | `source_uid` ↔ `award_id` | 1:N (FY × dims de crosstab, plusieurs lignes par FY) | ⚠ | ⚠ | +17 % si jointure sans pré-agrégation ; mélange cumul/annuel | R3 ; couverture par `nsf_obligation_totals`, FY hors seuil = indisponible |

---

## 8. Navigation — verdicts par transition

### Descente (« où est passé cet argent ? »)

| Étape | Verdict | Pourquoi |
|---|---|---|
| Financeur → Programme | **autorisée** | partition propre ; mais les « programmes » des trois financeurs sont trois objets différents (ligne budgétaire / institut / division) — la descente est **par financeur**, jamais un tableau comparatif inter-financeurs des programmes |
| Programme → Call | **autorisée avec restriction** (CORDIS) ; **impossible** (NIH, NSF) | pas de FK ; reconstruction par les projets, avec la règle N:M du § 7 |
| Call → Projet | **autorisée** (CORDIS) ; **impossible** (NIH, NSF) | FK directe ; NIH/NSF descendent Programme → Projet |
| Projet → Participation | **autorisée**, sémantique par source affichée | CORDIS/NSF : parts réelles ; NIH : étage dégénéré (une ligne, même montant) — l'afficher comme « bénéficiaire », pas comme « ventilation » |
| Participation → Organisation → Pays | **autorisée** | grain participation, DISTINCT, exclusions comptées |

### Remontée (« d'où vient l'argent de cette organisation ? »)

| Étape | Verdict | Pourquoi |
|---|---|---|
| Organisation → Participations/Projets | **autorisée** | liste + parts observées ; parts inconnues dites inconnues |
| Organisation → Call | **autorisée** (CORDIS seul) | via projet, FK propre |
| Organisation → Programme | **autorisée** | via projet ; montants = parts de l'organisation (grain participation), jamais les totaux projets |
| Organisation → Financeur | **autorisée avec restriction majeure** | la somme n'est **pas** « l'argent reçu » : mesures hétérogènes par financeur (engagement vs obligations), EUR dérivé multi-années (une hypothèse de taux par projet), parts inconnues exclues et comptées, fenêtres d'ingestion différentes. Chiffres par financeur, chacun avec son libellé de nature — le total transverse unique n'existe qu'étiqueté « Σ observée corpus Orion » |
| Pays → Financeur | **ambiguë** | même restriction, plus la sémantique « destination institutionnelle » ≠ effort national — le libellé la porte (précédent R5A § 13) |

La règle générale : **descente et remontée ne sont pas symétriques.**
Descendre distribue une mesure d'étage vers ses composantes ; remonter
recompose des parts — et les deux ne se rejoignent pas (écarts § 10,
G10-G11). Le contrat impose que chaque écran affiche la réconciliation
(« Σ parts + non ventilé + inconnu = total étage ») plutôt que de
prétendre à l'égalité.

---

## 9. Gold set manuel

Calculé à la main sur la base auditée (snapshot dev 2026-08-27),
**avant toute implémentation** — c'est le jeu de recette de B1. Chaque
gold : identifiants, valeurs sources, calcul, attendu, règle testée.

**G1 — Descente CORDIS complète, décomposition exacte.**
`ec` → `HORIZON` → `HORIZON.3.1` → call `HORIZON-EIC-2021-PATHFINDEROPEN-01`
→ projet **101046217 VerSiLiB** (id 26403) → 8 participations.
Parts EUR : 878 463,81 + 77 031,63 + 450 000,00 + 495 410,00
+ 196 691,81 + 449 498,75 + 422 002,11 + 25 146,88
= **2 994 244,99 = `funding_amount_eur`** du projet. Écart : 0.
*Règle testée : décomposition projet→participations quand la source la
donne ; réconciliation exacte possible et alors affichée.*

**G2 — Un programme, plusieurs appels.** `HORIZON.1.2` (MSCA) :
**39 appels** distincts (reconstruits via projets — aucune FK),
8 606 projets, Σ contributions = **5 100 845 404,20 €** (dérivé ;
8 513 projets et 5 065,5 M€ avant B0.1 — 93 projets MSCA revenus des
programmes parasites et de la racine).
*Règle : reconstruction Programme→Call ; le total programme est une
Σ observée, pas un budget MSCA.*

**G3 — Un appel, plusieurs projets.** `HORIZON-MSCA-2024-PF-01` :
**1 720 projets**, Σ = **422 354 213,94 €**. Topic E1 lié :
`HORIZON-MSCA-2024-PF-01-01` (budgets NULL côté topic — l'absence
reste dite). *Règle : sommabilité au sein d'un étage homogène ;
call_topics = enrichissement, jamais une enveloppe.*

**G4 — Parcours NIH.** `R21AI101276` (Rabies, NIAID) : 2 tranches
annuelles FY2012-2013 sommées à l'ingestion → `funding_amount`
= **441 743 USD** (détail annuel détruit) ; EUR au taux 2012 (1,284789)
→ **343 825,33 €** ; 1 participation unique (PROSETTA CORPORATION,
US) portant **le même montant**. Chaîne : `nih` → institut `AI` →
projet → bénéficiaire. Pas d'appel.
*Règles : grain core-project ; étage participation dégénéré (copie,
pas une part) ; hypothèse de taux mono-année sur une somme
pluriannuelle = dérivé.*

**G5 — Parcours NSF (fratrie collaborative).** `c-2005-037a7366ff4a1296`
(Arecibo ALFA) : 3 awards membres = 3 participations : 0507376
Columbia 335 297 + 0507747 Cornell 372 647 + 0507807 Berkeley 390 244
= **1 098 188 USD = funding projet**. *Règles : grain fratrie = analyse
Orion assumée ; participations = vraies parts ; Σ conservée par
construction (`nsf/load.py:401`).*

**G6 — Organisation présente dans plusieurs projets.** VTT (id 9701) :
**958 projets, 3 sources**. Toute somme : grain participation,
projets DISTINCT. *Règle R4.*

**G7 — Montant absent.** Participation ITACONIX dans FP7 `613941`
BIO-QED : `amount` NULL (la source ne publie pas sa part) sur un
projet à 5 335 158,39 € — l'écran dit « part inconnue », la somme
l'exclut **et le compte**. Jamais 0, jamais une quote-part inventée.
Volumes : 24 423 `associatedPartner` Horizon, 8 202 participations
FP7, 940 projets NIH sans participation du tout. *Invariants I1, I4.*

**G8 — Double comptage naïf (le piège cardinal).** VerSiLiB :
`JOIN projects×participations` puis Σ `funding_amount_eur` donne
8 × 2 994 244,99 = **23 953 959,92 €** pour un projet qui en vaut
2 994 244,99. À l'échelle du corpus : Σ naïve = Σ(funding × nb
participants) ≈ facteur 5 sur CORDIS. *Règle R1 — le test de recette
le plus important du lot.*

**G9 — Deux étages, deux mesures comptables (NSF).** Award `0939454`
BEACON (Michigan State, division DBI) : étage projet `funding_amount`
= **48 035 209 USD** (cumul API) ; étage annuel R5B Σ FY2011-2020
= **45 535 633 USD** (10 FY, certains sur 2 lignes de crosstab à
pré-agréger). Écart **2 499 576 USD** = FY2010, antérieur à la fenêtre
du snapshot. Attendu : les deux chiffres coexistent, chacun libellé
(« cumul obligé à date » / « obligations FY2011-2025, vintage
2026-08-26 ») — jamais sommés, jamais l'un présenté comme le détail
exact de l'autre. *Règle R3.*

**G10 — Décomposition non conservative, dans les deux sens (CORDIS).**
`871072` EURIZON : projet 24 767 360,43 € vs Σ 27 parts
= 20 417 631,73 € (**−4 349 728,70 € non ventilés**).
`101052200` EUROfusion : projet 549 442 000 € vs Σ parts
= **664 587 862,11 €** (les parts **dépassent** le plafond projet).
262 projets CORDIS divergent (>1 € ; 65 FP7 + 150 H2020 + 47 Horizon),
bilan agrégé par source : FP7 −1,13 Md€, H2020 −132 M€, Horizon
**+128 M€**. Attendu : ligne de réconciliation chiffrée à chaque écran
de descente. *Règle R2.*

**G11 — Remontée ≠ somme simple.** ITACONIX CORPORATION (id 26640),
4 participations : NSF 150 000 + 150 000 + 765 989 = 1 065 989 USD
(mesure homogène, sommable en USD) → en EUR : 107 762,10 + 116 750,69
+ 576 581,43 = 801 094,22 € — trois taux d'années différentes (2011,
2012, 2014) : le « total EUR » n'existe à aucun taux réel. FP7 : part
inconnue (G7). « Total reçu par ITACONIX » : **n'existe pas comme un
nombre** ; existe comme 1 065 989 USD obligés (NSF) + une part FP7
inconnue, ou comme 801 094,22 € « Σ observée, convention ④ ».
*Règles I3, I4 ; navigation § 8, remontée Org→Financeur.*

---

## 10. Zones impossibles, ambiguës, NO-GO

**NO-GO (en l'état des données — démontrer qu'un chiffre serait faux
est un résultat, précédent R5A) :**

1. **Étage Call/Topic pour NIH et NSF** : rien d'ingéré (FOA RePORTER
   et program element NSF existent à la source mais pas dans Orion).
   La chaîne saute l'étage. Le combler = chantier d'ingestion
   distinct, pas un proxy B1.
2. **« Budget » d'un programme, d'un appel ou d'un financeur** : la
   Σ des projets n'est pas un budget (R5A : enveloppes d'appel
   = 0,008 % du corpus ; budget d'agence = dénominateur interdit).
   Seul libellé licite : « Σ observée dans le corpus Orion ».
3. **Un chiffre unique inter-financeurs sans étiquette de nature** :
   engagement (EC) + obligations (NIH/NSF) ne fusionnent pas en
   silence. Le hero actuel le fait (dette héritée, réserve portée par
   les docs seulement) — le lot B ne reproduit pas ce régime.
4. **« Où est passé l'argent, année par année »** : impossible CORDIS
   (aucune annualité source) ; impossible NIH (détail annuel détruit à
   l'ingestion — réouvrir = décision d'ingestion) ; possible NSF
   uniquement, en USD, via l'axe R5B (et `raw.fiscal_years`).
5. **Pays = lieu d'exécution ou effort national** : le pays d'Orion
   est celui de l'organisation bénéficiaire. Tout libellé
   géographique dit « destination institutionnelle ».

**Ambiguës (constats à trancher, § 11) :**

- `total_cost = 0` sur 12 377 projets Horizon : zéro source conservé
  (doctrine CORDIS) mais sémantiquement « non renseigné » — et NIH/NSF
  font l'inverse (≤ 0 → NULL). Incohérence inter-sources réelle.
  Arbitrage D7 : requalifié à la lecture (à implémenter en B1).
- Programme→Call multi-programmes : mesuré après B0.1 à 103 appels
  sur 2 050 — des appels transversaux réels (§ 7), l'ambiguïté n'était
  un artefact des parasites qu'aux deux tiers.
- La participation NIH : « bénéficiaire » (une ligne informative) ou
  « étage de ventilation » (faux) — le contrat retient bénéficiaire.

**Dette annexe inventoriée pendant l'audit** (doctrine zéro dette
connue — inventaire, pas correction en B0) : ~~programmes EC parasites~~
et ~~participation FP7 au rôle décalé~~ **corrigés en B0.1 (§ 13)** ;
restent : `calls.year`/`title` jamais alimentés ; `netEcContribution`
CORDIS non lu ; `TOTAL_COST_SUB_PROJECT` NIH parsé puis perdu ;
`coalesce(…,0)` des surfaces nominales ; `search/` porte les agrégats
alors qu'`analytics/` est vide ; les projets CORDIS disparus d'un
export ultérieur ne sont pas élagués (les participations le sont
désormais, sous garde de couverture ≥ 95 %).

---

## 11. Décisions arbitrées avant B1

| # | Décision | Options | Recommandation B0 | Arbitrage (2026-08-27) |
|---|---|---|---|---|
| D1 | Étage Call absent (NIH, NSF) | (a) chaîne à profondeur variable — l'étage se saute ; (b) chantier d'ingestion FOA/program element avant B1 | **(a)** ; (b) reste un chantier optionnel indépendant | **Validé (a)** — aucun étage synthétique |
| D2 | Programmes EC parasites | assainir avant B1 vs tolérer avec bucket « non classé » | **assainir avant B1** — 537 M€ mal rangés pollueraient le premier écran du drill | **Validé, bloquant — exécuté en B0.1 (§ 13)** |
| D3 | Nature comptable du montant | (a) portée par le contrat d'API/affichage (libellés par financeur) ; (b) matérialisée en colonne (`funding_kind`) | **(a) pour B1** ; (b) seulement si un besoin de requête le prouve — pas de nouvelle abstraction sans démonstration | **Validé (a)** |
| D4 | Devise de la chaîne | descente mono-financeur en **devise du financeur** ; EUR dérivé réservé aux vues transverses avec bloc `excluded` (rupture assumée avec les surfaces nominales actuelles) | **oui** — c'est l'application de R5A § 12 au drill | **Validé** — conversion transverse seulement si méthodologiquement défendable, couverture et exclusions explicites |
| D5 | Réconciliation d'étage | afficher systématiquement « Σ parts + non ventilé + inconnu = total » (G10) | **oui** — c'est la forme visible d'I2/I4 | **Validé** — obligatoire à chaque changement de grain |
| D6 | Annualité NIH détruite | accepter (chaîne sans axe temps NIH) vs rouvrir l'ingestion pour conserver les tranches | à l'arbitrage de Charlotte | **Reporté** — pas un prérequis de B1 |
| D7 | `total_cost = 0` Horizon | conserver le 0 source affiché tel quel vs requalifier à la lecture en « non renseigné » (avec provenance du 0 source) | **requalifier à la lecture**, provenance visible — cohérent avec « le statut affiché est dérivé, le code source reste visible » (E1) | **Validé** — jamais interprété comme coût réellement nul |

---

## 12. Porte d'arrêt

Contrat B0 validé le 2026-08-27 (arbitrages D1-D7, § 11). B1 n'est pas
ouvert : pas d'API, pas d'UI, pas de migration, pas de déploiement.
Toute correction issue de B0.1 suivra séparément le rituel production
complet, porte snapshot comprise.

## 13. Post-scriptum — chantier B0.1, assainissement CORDIS (2026-08-27)

Deux anomalies découvertes par l'audit, corrigées à la racine (parseur
+ données dev + tests). Détail complet : CHANGELOG « CORDIS ingestion
no longer mints parasite programmes », tests
`backend/tests/test_cordis_ingest.py` (fixtures `shifted/`).

**Cause racine commune** : les exports CSV CORDIS contiennent des
lignes fendues par des guillemets mal échappés (dans `objective`,
`title` ou `organizationURL`) ; toutes les colonnes suivant la cassure
portent la valeur de leur voisine. `legalBasis` étant la dernière
colonne des exports H2020/Horizon, elle récoltait booléens
`Human-validated`, DOI, listes de mots-clés — que la garde d'origine
(« ≤ 100 caractères, sans espace ») laissait devenir des programmes.

**Corrections** (`backend/src/orion/ingest/cordis/`) :
1. `legalBasis` n'est accepté que s'il appartient à l'univers officiel
   des codes de `legalBasis.csv` (dérivé des données à chaque run,
   aucune allowlist codée en dur) ; sinon le rattachement est récupéré
   des lignes par-projet de ce même fichier (drapeau
   `uniqueProgrammePart` ; plusieurs parts → l'ancêtre commun s'il est
   l'une d'elles) ; irrécupérable → racine du cadre, compté, jamais
   inventé.
2. Ligne projet décalée (signature : `frameworkProgramme` ≠ code cadre,
   ou date/montant illisible) → **NULL pour tout scalaire après la
   cassure** — dates, montants, appel — jamais une valeur déplacée.
3. Participation au rôle monétaire : réalignement uniquement sur
   signature complète (`rcn` numérique, `order` textuel, `role`
   décimal) ; sinon rôle et montant restent inconnus.
4. Élagage des programmes, appels et participations que plus rien ne
   référence (participations : garde de couverture ≥ 95 % du corpus).

**Avant / après (base dev, corpus inchangé — mêmes CSV)** :

| Mesure | Avant | Après |
|---|---|---|
| Programmes EC | 176 dont 96 sans nom (parasites) | **80, zéro sans nom** |
| Projets sur programmes parasites | 275 (~537 M€) | **0** — 479 rattachements récupérés de `legalBasis.csv` (100 % de récupération, `legal_basis_recovered` 1+286+192) |
| Projets CORDIS à la racine du cadre | 204 (118 H2020 + 86 Horizon) | **0** |
| Appels | 2 482 (dont l'appel fantôme `FP7`) | **2 481** |
| Appels multi-programmes | 291/2 051 | **103/2 050** (transversaux réels) |
| Σ contributions projets FP7 | 46 036 946 939,13 € | 46 036 696 833,13 € (**−250 106,00 €** : le montant corrompu du projet 300401 redevient inconnu — il provenait du décalage de colonnes, sa justesse était une coïncidence) |
| Σ contributions projets H2020 / Horizon | inchangées au centime | idem |
| Σ participations FP7 | 44 909 528 246,49 € | 44 909 552 140,34 € (**+23 893,85 €** : contribution AIRBUS DS réalignée depuis la colonne rôle, ancienne ligne parasite élaguée) |
| Participation `332933:974056444` | role=`23893.85`, amount NULL | role=`participant`, amount=23 893,85 €, order 6 |
| Projet 654408 (3 parts à drapeau) | programme parasite `H2020-EU.3.3.;…` | `H2020-EU.3.3.` (ancêtre commun) |

Aucune somme n'a bougé sans explication : les deux seuls écarts
monétaires sont les deux corrections nommées ci-dessus. Golds rejoués :
G1 (décomposition exacte, inchangé), G3, G10 (inchangés), G2 mis à
jour (§ 9 — 93 projets MSCA revenus dans `HORIZON.1.2`). Les règles
anti-double-compte et la réconciliation d'étage restent vraies.

**Non corrigé, assumé** : `projects.raw` des lignes décalées conserve
le verbatim décalé (c'est le payload tel que parsé) ; le projet FP7
300401 garde montants et dates **inconnus** tant que l'export CORDIS
n'est pas corrigé en amont — au prochain rafraîchissement du dump, si
la ligne est réparée à la source, les vraies valeurs entreront seules.
