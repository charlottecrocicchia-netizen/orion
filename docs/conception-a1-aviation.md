# A1-Conception — la lentille Aviation (étude + conception, AUCUNE règle chargée)

*2026-08-18 — cadre : deuxième vraie lentille d'Orion, famille
`aerospace_mobility`, même sérieux que les 23 règles spatiales sur un
terrain plus piégeux. Ce document est une ÉTUDE du corpus réel et une
conception ; il ne charge rien, ne tague rien, n'écrit aucun contenu
éditorial, aucun frontend, aucune Lens Room. Trois frontières sont des
décisions de positionnement fondatrice (§ 7) — présentées avec leurs
chiffres, pas tranchées. `status=draft` tant que les seuils du § 8 ne
sont pas atteints.*

---

## 1. L'étude du corpus réel — le noyau positif à haute confiance

Relevé sur la base de production (lecture seule, 2026-08-18). Les six
programmes visés sont TOUS présents dans notre CORDIS, identifiés par
leurs codes d'appel :

| Famille | Préfixes d'appel (exacts, relevés) | Projets | M€ | Années |
|---|---|---|---|---|
| Clean Sky 1 (FP7) | `SP1-JTI-CS-`, `JTI-CS-` (GAM) | 493 | 797 | 2008-2015 |
| Clean Sky 2 (H2020) | `H2020-CS2-` | 543 | 535 | 2015-2021 |
| Clean Aviation (Horizon) | `HORIZON-JU-Clean-Aviation-` | 40 | 1 177 | 2022-2026 |
| FP7-AAT (Aéronautique & transport aérien) | `FP7-AAT-` | 233 | 1 001 | 2007-2014 |
| SESAR 2020 (H2020) | `H2020-SESAR-` | 149 | 545 | 2016-2021 |
| SESAR 3 / Digital European Sky | `HORIZON-SESAR-` (…-DES-…) | 116 | 503 | 2023-2026 |
| **Total noyau appels** | | **1 574** | **4 558** | 2008-2026 |

**La trouvaille structurante : les JU aviation ne sont PAS des nœuds de
l'arbre des programmes.** Notre référentiel (325 nœuds) porte ces
projets sur des nœuds génériques — `H2020-EU.3.4.` (tout le transport,
rail et route compris), `FP7-JTI` (toutes les JTI, ENIAC et IMI
comprises), `FP7-TRANSPORT`, `HORIZON.2.5` (climat + énergie +
mobilité). Une règle `programme` ne peut donc PAS isoler l'aviation —
contrairement au spatial (FP7-SPACE, LEIT-Space). **L'identification
fiable vit dans les appels** (`calls.code`), aux préfixes propres et
stables relevés ci-dessus.

→ **Conséquence de mécanisme (décision M à soumettre, § 7)** : la
lentille a besoin d'une quatrième famille de règles, **`call`** (préfixe
de code d'appel), au même étage de confiance que `programme` — un fait
structurel donné par la source, pas une interprétation.

*Aspérité relevée en passant : une dizaine de projets portent des codes
programme corrompus (« false », « true », des ids nus). Préexistant,
hors chantier — consigné ici pour mémoire.*

## 2. Le chevauchement Space × Aviation — massif, et NOMINAL

Sur le noyau appels : **761 projets (2 295 M€) portent DÉJÀ la lentille
spatiale** — 34 core (103 M€) et 727 enabling (2 192 M€). Ce n'est pas
un accident : la règle thème spatiale couvre le sous-arbre euroSciVoc
« aerospace engineering » entier en enabling, et son évidence
l'annonçait (« l'aéronautique s'y mêle au spatial : adjacent »). S'y
ajoutent les projets SESAR à composante satellite (CNS/GNSS — MIAR,
Green-GEAR).

La doctrine D3 est déjà en place pour l'absorber : une lentille est une
LECTURE, le projet compte plein dans chacune, rien ne s'additionne, la
fiche projet montre les deux badges, le compteur de recouvrement de
l'À-propos s'allumera à la publication. **Le chevauchement est un cas
nominal, documenté d'avance** — pas un bug à corriger. Ordre de
grandeur attendu du compteur : ~700-1 600 selon les arbitrages du § 7.

## 3. Le sous-arbre euroSciVoc — les thèmes se partagent proprement

| Code | Libellé | Projets | Versant |
|---|---|---|---|
| `/25/75/461/1239/1737` | aircraft | 1 073 | **Aviation** |
| `/25/75/461/1239/1737/1829` | rotorcraft | 176 | **Aviation** (enfant de aircraft) |
| `/25/75/461/1239/1741` | aeronautical engineering | 269 | **Aviation** |
| `/25/75/461/1239/1739` | satellite technology | 959 | Spatial (règle core existante) |
| `/25/75/461/1239/51612216` | spacecraft | 165 | Spatial (règle core existante) |
| `/25/75/461/1239` (nu) | aerospace engineering | 17 | Ambigu — laissé hors règles Aviation |

Le partage est net : `aircraft` (avec son enfant rotorcraft) et
`aeronautical engineering` sont les thèmes cœur d'Aviation ; les thèmes
satellites restent au spatial. Les deux lentilles liront des projets
communs — nominal (§ 2).

## 4. Les motifs texte — comptés par source, et leurs pièges

| Motif candidat | CORDIS | NSF | NIH |
|---|---|---|---|
| aircraft | 1 365 | **1 925** | 28 |
| aviation | 686 | 562 | 39 |
| aeronautic | 553 | 316 | 15 |
| drone | 389 | 952 | 79 |
| airport | 343 | 345 | 103 |
| helicopter | 150 | 124 | 20 |
| unmanned aerial | 128 | 665 | 1 |
| rotorcraft | 73 | 29 | 0 |
| air traffic management | 71 | 29 | 0 |
| turbofan | 58 | 5 | 0 |
| eVTOL | 13 | 16 | 0 |

Les pièges, vérifiés sur pièces (ils forment le gold set, § 5) :
**NSF déborde d'avions-INSTRUMENTS** (l'avion de recherche
atmosphérique — 1 925 « aircraft » dont une large part d'avion-outil) ;
« engine » attrape « engin**eering** » (constaté dans l'étude
elle-même) ; « wing » est biologique chez NIH ; « flight » est spatial
(FALCon récupère un premier étage de lanceur) ; « navigation » est
maritime ou GNSS générique ; « drone » est un outil agricole ou de
mesure ; l'aéroélasticité travaille pour l'ÉOLIEN.

**Doctrine des motifs Aviation (proposée)** : cordis SEULEMENT en V1
(NSF différé après un échantillonnage dédié — l'avion-outil y domine ;
NIH jamais, comme au spatial) ; des motifs multi-mots ou techniques
univoques (« aircraft engine », « rotorcraft », « turbofan », jamais
« engine » nu, jamais « wing » nu, jamais « flight » nu) ; et le
rappel faible ASSUMÉ — mieux vaut manquer que salir.

## 5. Le gold set permanent — [gold/aviation.csv](../backend/curation/lenses/gold/aviation.csv)

**37 spécimens réels du corpus**, versionnés, qui entreront dans les
tests à A1-Exécution **et y resteront** — un échec du gold set bloque,
comme un test :

- **12 positifs certains (core)** : les cinq ITD Clean Sky 1 (SAGE,
  SFWA, SGO, GRA, GRC — moteurs, voilure, systèmes, régional,
  rotorcraft) et sept démonstrateurs Clean Aviation (OFELIA, TAKE OFF,
  HYDEA, PHARES, UNIFIED, SWITCH, SMR ACAP) — 1 048 M€ à eux seuls.
- **17 négatifs difficiles, construits exprès** : le flight spatial
  (FALCon, ASTROCIT), le wing biologique (2 projets NIH), l'engine
  automobile (GasOn, pressureNose), le piège « engineering »
  (SpeedAPP), l'hydrogène industriel (BioHydroCat, COHERENT), la
  navigation maritime et GNSS générique (SINANN, MAGNIFIC), le
  drone-outil (GIDROM) et le drone-service (DroneHopper), l'aéro-éolien
  (UNAELCO, ACTAGREEN), l'avion-instrument NSF (2 projets).
- **8 cas frontières** marqués `a_arbitrer`, un par décision du § 7 :
  SESAR/ATM (HAVEN, ARTEMISA), GNSS × spatial (MIAR, Green-GEAR),
  UAS/AAM (OPENSRUM, HAIKU), H₂-avion hors noyau (OVERLEAF, MYTHOS).
  Leur `expected` sera fixé par tes arbitrages.

*Pas encore de positifs `enabling` au gold set — voulu : l'habilitant
démarre quasi vide (§ 6) et ses spécimens s'ajouteront quand ses règles
existeront, après arbitrages.*

## 6. La conception — core, enabling, taxonomie, règles

**Aviation core** : l'avion (ou l'aéronef à voilure tournante) est
l'OBJET du projet — le concevoir, le propulser, l'équiper, le certifier,
l'opérer. **Aviation enabling** : la technologie est l'objet et
l'aviation son débouché déclaré (matériau qualifié vol, H₂ dont
l'application avion est dite, fabrication de pièces moteur). La règle
d'asymétrie est gravée : **l'habilitant est plus difficile à OBTENIR
que le cœur** — il démarre quasi vide et ne s'élargit qu'échantillonné.
HYDEA (l'avion est l'objet, l'hydrogène son moyen) est core ; OVERLEAF
(le réservoir H₂ est l'objet, l'avion son débouché) serait enabling —
si F3 l'admet.

**La taxonomie interne Aviation** (classement de curation, pas de
surface produit — elle ordonne les règles et l'échantillonnage) :

1. architecture & intégration avion ; 2. aérodynamique & structures ;
3. propulsion — turbomachines · hybride-électrique · H₂/SAF ;
4. systèmes & avionique ; 5. ATM / CNS *(si F1 la retient)* ;
6. voilure tournante ; 7. UAS / AAM *(si F2 la retient)* ;
8. essais, moyens d'essais & industrialisation.

**Les règles, par ordre de confiance** :

1. **`call`** (nouvelle famille, décision M) — les six préfixes du § 1
   → core. Structurel, donné par la source : la confiance d'une règle
   programme.
2. **`theme`** — `/25/75/461/1239/1737` (aircraft, rotorcraft inclus)
   et `/25/75/461/1239/1741` (aeronautical engineering) → core. Par
   CODE, jamais par libellé (loi spatiale).
3. **`text`** (cordis seulement, V1) — candidats core univoques :
   « aircraft engine », « aircraft design », « rotorcraft »,
   « turbofan », « aeronautic » (à échantillonner), « air traffic
   management » *(si F1)* ; candidats enabling : « for aviation »,
   « aeronautical application » — liste courte, chaque motif validé à
   la main comme les 14 spatiaux.
4. **Exclusions** — le chargeur n'a PAS de mécanisme d'exclusion
   aujourd'hui : décision M (un type `veto`, motif texte cadré par
   source, appliqué en dernier, qui retire le tag de CETTE lentille —
   « wind turbine », « combustion engine » automobile…). Sans veto, la
   parade est des motifs plus étroits ; avec, des motifs plus francs
   gardés par des vetos nets.

## 7. Les décisions — TRANCHÉES le 2026-08-18

**F1 — SESAR / ATM : Aviation CORE.** L'ATM est une composante du
système aéronautique, pas une technologie habilitante. Sous-catégorie
« Air transport system » à la taxonomie (§ 6, famille 5 confirmée).

**F2 — UAS / Drones / AAM : CORE** quand le projet développe l'aéronef,
ses systèmes, sa navigabilité, ses opérations, son intégration
ATM/U-space ou l'AAM. Le drone-instrument d'une recherche non
aéronautique est EXCLU. Loi générale qui en découle, gravée au registre
des lois : **Orion classe ce que le projet DÉVELOPPE, pas l'équipement
qu'il UTILISE** — elle vaut pour toutes les lentilles.

**F3 — hydrogène PRUDENT.** Les appels Clean Aviation H₂ → core par
preuve structurelle. Hors de ces appels : core seulement avec preuve
explicite d'intégration avion ; enabling seulement avec lien
aéronautique réel démontré ; aucun H₂ générique, jamais.

**M — la hiérarchie de preuve, gravée.** `call` ET `topic` sont des
preuves STRUCTURELLES de première classe, plus fortes que le thème et
le texte. Le `veto` existe, mais cadré par cette hiérarchie : un veto
textuel peut tuer un candidat issu du TEXTE ou du THÈME, **jamais une
classification obtenue par `call`/`topic`**.

**structurel (call, topic) > taxonomique (thème) > textuel (motif)** —
et le veto n'agit que sur les deux derniers étages.

## 7 bis. La matrice du chevauchement Space × Aviation — relevée avant tout chargement

*Périmètre Aviation provisoire = preuves structurelles seules (les six
familles d'appels ∪ les thèmes `aircraft`, `rotorcraft`,
`aeronautical engineering`), toutes core par les arbitrages ci-dessus :
**2 182 projets**. Aucune règle enabling Aviation n'existe encore — les
lignes « Aviation enabling » sont donc structurellement VIDES
aujourd'hui, et le resteront jusqu'à ce que ses règles soient écrites.*

| Aviation ↓ / Space → | Space **core** | Space **enabling** | Hors lentille spatiale |
|---|---|---|---|
| **Aviation core** — par appel seul | 14 · 67 M€ | 5 · 4 M€ | 813 · 2 262 M€ |
| **Aviation core** — par appel + thème | 20 · 37 M€ | **722 · 2 188 M€** | 0 |
| **Aviation core** — par thème seul | 67 · 130 M€ | **541 · 2 697 M€** | 0 |
| **Aviation enabling** (toutes causes) | — | — | — |
| **Total** | **101 · 234 M€** | **1 268 · 4 889 M€** | 813 · 2 262 M€ |

**La surprise, et elle concerne les règles SPACE.** La décomposition du
périmètre habilitant spatial par règle d'origine (5 814 projets) :

| Règle spatiale habilitante | Projets | M€ |
|---|---|---|
| `programme AGS` (NSF géospace) | 4 389 | 3 875 |
| `theme /25/75/461/1239` (aerospace engineering) | 1 277 | 4 914 |
| `text microgravity` | 148 | 56 |

Et **1 263 des 1 277** (4 886 M€ — **99 %**) portent un thème AVIATION
(aircraft, rotorcraft, aeronautical engineering) ; 14 seulement (28 M€)
sont d'autres enfants du nœud. La règle habilitante « aerospace
engineering » du spatial **ne récolte, en pratique, que de
l'aéronautique**. Ses thèmes dominants le disent : aircraft (1 011),
aeronautical engineering (253), energy and fuels (252), rotorcraft
(161), composites (131), air traffic management (90).

Conséquence chiffrée sur ce qu'Orion affiche aujourd'hui : le grand
chiffre spatial (23,7 Md€ « direct + habilitant ») contient **4,9 Md€
de projets aéronautiques** — 55 % de la part habilitante, 21 % du total.
Sous la loi que tu viens de graver (*on classe ce que le projet
développe*), un démonstrateur Clean Sky de voilure tournante développe
un aéronef, pas une technologie spatiale.

**Le quadrant core × core (101 projets · 234 M€) est, lui, sain** — il
tient debout à l'inspection : PJ14 EECNS (communication-navigation-
surveillance SESAR, 22 M€), SPESAR (surveillance par satellite du
trafic aérien, 10 M€), SaT5G (satellite + terrestre), EUNADICS-AV
(alerte aux nuages de cendres pour l'aviation), ACASIAS
(aéro-structures à antennes intégrées). Ce sont de vrais projets des
deux mondes : le chevauchement nominal que D3 prévoit.

**Ce que la matrice ouvre — une décision fondatrice, non tranchée
ici** : faut-il RÉVISER la règle habilitante spatiale
`theme /25/75/461/1239` maintenant que l'aéronautique a sa propre
lentille ? Trois options, avec leurs poids :

- *Option S-A — la restreindre aux enfants NON aviation* (exclure
  aircraft, rotorcraft, aeronautical engineering) : le spatial perd
  1 263 projets et 4,9 Md€ d'habilitant ; son grand chiffre passe de
  23,7 à ~18,8 Md€ ; le chevauchement Space × Aviation tombe à ~101
  projets, tous sains. Le plus honnête sous la loi gravée ; c'est un
  changement VISIBLE du hero, donc une recette fondatrice.
- *Option S-B — la garder telle quelle* : le spatial continue de
  compter l'aéronautique comme habilitante (choix documenté d'origine :
  « l'aéronautique s'y mêle au spatial : adjacent »), et le
  recouvrement affiché à l'À-propos dira ~1 369 projets. Cohérent avec
  l'histoire, moins avec la loi nouvelle.
- *Option S-C — la basculer en règle de la lentille Aviation* : le
  thème `/25/75/461/1239` sort du spatial et devient une preuve
  structurelle d'Aviation (elle l'est déjà, via ses enfants). Variante
  la plus nette : chaque thème sert la lentille dont il parle.

Je ne tranche pas : la modification toucherait les chiffres affichés du
spatial, déjà recettés. Elle attend ton arbitrage (**S**).

## 7 ter. Consigné au registre des évolutions

Les futures **intersections de lentilles** devront être sensibles au
NIVEAU : une intersection « Space × Aviation » n'a pas le même sens
selon qu'elle croise deux cœurs ou deux habilitants. Défaut probable :
**core × core** (les 101 projets sains ci-dessus), les autres
combinaisons restant accessibles explicitement. À instruire quand les
intersections entreront à la grammaire — jamais avant (amendement M0
n° 2 : rien de préimplémenté).

## 7 quater. Le gold set devient un actif cumulatif

Les 37 cas sont le **seed adversarial permanent** d'Orion : enrichi à
chaque faux positif ou faux négatif intéressant rencontré, sur toutes
les lentilles — jamais un test jetable, jamais purgé. Chaque entrée
garde son `cas` (la famille de piège) pour que le motif se relise.

## 8 bis. Les quatre portes de publication (rappel, gravé)

`aviation` reste **`draft` du premier au dernier jour** du chantier. La
publication n'est possible qu'aux quatre portes franchies : précision
≥ 95 % core et ≥ 90 % enabling par échantillonnage ; **100 %** des
projets ≥ 20 M€ revus ; top 50 des organisations contrôlé ;
chevauchements Space analysés. Pas de Lens Room, pas d'éditorial.

## 7 quinquies. Les décisions initialement soumises (archive)

**F1 — SESAR / ATM : 265 projets · 1 049 M€** (SESAR 2020 149/545 +
Digital European Sky 116/503).
- *Option A — cœur d'Aviation* : la lentille dit « le système aérien
  entier », avions ET ciel. Le noyau passe à 1 574 projets ; Indra,
  Thales AVS et les ANSP entrent au top des organisations Aviation ;
  les chevauchements GNSS × spatial (MIAR, Green-GEAR) deviennent des
  cas nominaux de plus.
- *Option B — hors lentille V1* : Aviation = l'aéronef ; l'ATM
  (plateformes logicielles, ops, espace aérien) attendrait une lentille
  ou une extension future. Noyau : 1 309 projets / 3 509 M€ ; Indra
  sort du top.
- *Option C — enabling* : l'ATM comme technologie habilitante du
  système. Défendable, mais brouille la définition de l'habilitant
  (l'ATM n'est pas une techno « dont l'aviation est le débouché »,
  c'est de l'aviation opérée) — signalé comme l'option la moins nette.

**F2 — drones / UAS / AAM : 63 projets · 175 M€ déjà dans le noyau
(U-space SESAR surtout) ; 449 projets · 1 128 M€ hors noyau** mentionnent
drone/UAS/eVTOL en CORDIS — mais une large part est le drone-OUTIL
(agriculture, inspection, mesure), le négatif difficile par excellence.
- *Option A — dans Aviation* : règles dédiées prudentes (eVTOL, UAM,
  U-space, « unmanned aircraft » — jamais « drone » nu) ; le tri
  outil/aéronef se paie en précision et en échantillonnage.
- *Option B — hors V1, lentille future* : seuls les projets du noyau
  entrent (via leurs appels), sans règle drone dédiée ; la verticale
  UAS/AAM reste une lentille possible de la famille aerospace_mobility.
- *Option C — enabling seulement* : les plateformes UAS comme
  habilitantes — même réserve conceptuelle que F1-C.

**F3 — l'hydrogène : où passe la ligne ?** H₂ total CORDIS :
1 733 projets · 4 936 M€ (le monde du deck hydrogène — générique,
industriel, énergétique). H₂ × mots avion : 94 projets · 867 M€, dont
**30 · 489 M€ déjà dans le noyau JU** (HYDEA, MYTHOS-like).
- *Option A — le noyau seul* : l'H₂-avion entre par les appels
  (30/489) ; rien par motif. Zéro risque, rappel minimal.
- *Option B — noyau + motif explicite* : « hydrogen aircraft »,
  « hydrogen-powered aircraft », « liquid hydrogen … aircraft » → la
  zone des ~64 projets/378 M€ hors noyau (OVERLEAF, MYTHOS), en
  enabling quand le H₂ est l'objet et l'avion le débouché, core si
  l'avion est l'objet. C'est la ligne « H₂ intégré à l'avion ».
- *Option C — large* : toute mention aviation dans un projet H₂ —
  écartée d'office par la règle de précision ; listée pour mémoire.

**M — deux décisions de MÉCANISME (même rang, révélées par l'étude)** :
① la famille de règles **`call`** (préfixe d'appel, confiance d'un
programme) — sans elle, le noyau du § 1 est inatteignable proprement ;
② le type **`veto`** (exclusion texte cadrée par source, appliquée en
dernier, portée à la lentille) — sans lui, les motifs devront rester
plus étroits. Les deux étendent le contrat du chargeur : à valider
avant A1-Exécution.

## 8. Les seuils de publication — gravés d'avance

**Précision ≥ 95 % sur core, ≥ 90 % sur enabling**, mesurées par
échantillonnage manuel : 200 cœur tirés au hasard (seedé, reproductible),
200 habilitants, 200 exclus proches (des candidats attrapés par un motif
puis rejetés, ou frôlant un seuil), **tous** les chevauchements
Space × Aviation (relevé du jour : 761 — le volume dépendra des
arbitrages F1-F3 ; à ce compte, la revue se fera par règle d'origine
puis par pièce, et c'est l'échantillon le plus coûteux du plan), **tous**
les gros montants (≥ 20 M€ : les 12 du § 1 en tête), et le **top 50 des
organisations** Aviation (relevé du top 15 : DLR, Airbus ×3, Indra*,
Safran Aircraft Engines, Leonardo, NLR, Thales ×2*, ONERA, Rolls-Royce
Deutschland, Liebherr Aerospace, MTU, GE Avio — *selon F1).

Le rappel peut être faible au début — **mieux vaut manquer que salir**.
`status=draft` au registre tant que les seuils ne sont pas atteints ;
la publication est un geste séparé, après recette fondatrice.

## 9. Ce que A1-Conception ne fait pas — et la suite

Aucun tag en production, aucune règle chargée, aucun CSV de règles
écrit (seul le gold set existe, et il ne charge rien), aucun contenu
éditorial, aucune Lens Room, aucun frontend. **La suite, après tes
arbitrages F1-F3 + M** : A1-Exécution — le mécanisme (`call`, `veto` si
retenus) testé sur le gold set, `aviation.csv` écrit règle à règle avec
évidences, chargé en `draft`, l'échantillonnage du § 8, tes recettes,
et SEULEMENT ALORS la publication — mots, decks et surfaces (A2).
