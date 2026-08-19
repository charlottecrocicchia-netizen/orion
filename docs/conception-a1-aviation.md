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
4. systèmes & avionique ; 5. ATM / CNS — « Air transport system »
*(F1 : cœur)* ; 6. voilure tournante ; 7. UAS / AAM *(F2 : cœur)* ;
8. essais, moyens d'essais & industrialisation ; **9. écosystème R&I &
coordination** *(ajoutée le 2026-08-18)* — feuilles de route,
coordination de programme, science ouverte, réseaux internationaux et
jumelages dont l'objet explicite est la R&I aéronautique.

**La définition unifiée du core** (2026-08-18) : **l'OBJET du projet
est l'aviation — technique ou sectoriel.** Technique, c'est l'aéronef,
ses systèmes, sa navigabilité, ses opérations, son intégration
ATM/U-space, l'AAM. Sectoriel, c'est la R&I aéronautique elle-même :
PARE, RADIAN, OSCAR, SUNJET II, Future Sky Safety, BAANG, CARE et
analogues sont `core` **parce que leur objet est le secteur**, jamais
parce qu'ils seraient des actions de coordination. **Il n'existera
jamais de règle « CSA → core »** : le schéma de financement ne
classe rien, l'objet sectoriel classe.

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


---

# A1-Exécution — le premier noyau (2026-08-18, `aviation` en `draft`)

## Les mécanismes (étape 1)

`call` (préfixe de code d'appel) et `topic` (concept euroSciVoc EXACT,
sans sous-arbre) rejoignent `programme` au niveau **structurel** ;
`theme` reste taxonomique, `text` textuel ; le `veto` retire un tag mais
**ne mord jamais sur le structurel** (I6). Chaque tag garde son
**origine** (`project_lens_tags.proof`, migration 0028) : l'audit sait
quelle famille corriger. I4 est exécutable : `orion-ingest lenses
--lens aviation` ne touche aucune autre lentille, et chaque run
journalise lentille, version, durée, comptes, statut. Le changelog est
**dérivé** : mesuré par le run après succès, jamais saisi — seule la
justification éditoriale reste curée (S1 ①).

## Le noyau (étapes 2 et 3)

10 règles, toutes `core`, toutes structurelles : **7 appels** (Clean Sky
1 en deux formes, Clean Sky 2, Clean Aviation, FP7-AAT, SESAR 2020,
Digital European Sky) et **3 concepts exacts** (`aircraft`,
`rotorcraft`, `aeronautical engineering` — nommés un à un, jamais leur
parent : I7).

**2 182 projets · 7 386 M€**, 100 % `core`, 100 % preuve structurelle.
Chargement : **0,8 s** (contre ~500 s pour le spatial, qui balaie des
motifs texte sur 700 000 projets).

| Famille de preuve | Projets | M€ |
|---|---|---|
| appel SEUL | 832 | 2 333 |
| appel + concept | 742 | 2 225 |
| concept SEUL | 608 | 2 828 |

## La matrice, avec Space v2 — elle a fondu vers les vrais ponts

| Space ↓ / Aviation → | core |
|---|---|
| **core** | **101 · 234 M€** |
| **enabling** | **0** |
| hors lentille spatiale | 2 081 · 7 152 M€ |

Le quadrant core × enabling (1 268 projets, 4 889 M€ avant S1) a
**disparu** : c'était l'aéronautique que la règle parent spatiale
ramassait. Il ne reste que les vrais ponts — CNS satellitaire, alertes
cendres, connectivité.

## Le seed adversarial — 5 faux positifs, tous par le CONCEPT

| Verdict | Nombre |
|---|---|
| OK | 24 (dont **12/12 positifs certains** et 12/17 négatifs) |
| **FAUX POSITIF** | **5** |
| Manqué | 0 |
| À arbitrer | 8 (les frontières, par construction) |

**Aucun faux positif n'est entré par un appel.** Les cinq sont entrés
par un concept, et leur appel réel dit l'inverse :

| Cas | Concept qui l'a fait entrer | Appel réel |
|---|---|---|
| FALCon (récupération d'étage de lanceur) | `aircraft` | H2020-**SPACE**-2018 |
| GasOn (moteurs gaz pour véhicules) | `aeronautical engineering` | H2020-**GV** (Green Vehicles) |
| MAGNIFIC (GNSS en Afrique) | `aircraft` | H2020-**Galileo**-2014 |
| UNAELCO (aéroélasticité d'éoliennes) | `aeronautical engineering` | FP7-**PEOPLE** |
| DroneHopper (drone de lutte incendie) | `rotorcraft` | H2020-**SMEINST** |

**Constat** : le concept euroSciVoc est un fait de la source, mais la
source le pose largement — l'appel, lui, ne se trompe pas. Et le veto
ne peut PAS réparer cela : `topic` étant structurel, un veto textuel
n'a pas le droit d'y toucher (I6, et c'est bien la règle qui protège).

**Nuance déclarée sur DroneHopper** : son étiquette `excluded` du gold
set est ANTÉRIEURE à l'arbitrage F2, qui dit « core quand le projet
développe l'aéronef ». DroneHopper développe le drone lui-même : F2 le
rendrait `core`. L'étiquette n'a pas été changée — un score ne se
corrige pas en déplaçant sa cible ; la relabellisation est une décision
de curation à soumettre. Sur les quatre autres, aucun doute.

**Trois options, chiffrées, à trancher (décision T)** :

- *T-A — les appels seuls* : on retire les 3 règles de concept. Noyau
  **1 574 projets · 4 558 M€**, **zéro faux positif** au gold set,
  rappel plus faible (−608 projets). « Mieux vaut manquer que salir ».
- *T-B — le concept redevient taxonomique* : `topic` descend d'un
  étage, et des vetos textuels peuvent alors mordre (wind turbine,
  passenger car, launcher…). Garde le rappel, coûte une campagne de
  vetos et une baisse de la garantie de preuve.
- *T-C — un veto STRUCTUREL par l'appel* : un appel d'un autre domaine
  (SPACE, Green Vehicles, Galileo, PEOPLE…) annule une classification
  obtenue par le seul concept. Même niveau de preuve, et le fait le
  plus fort gagne : l'appel dit qui a financé. C'est un mécanisme
  nouveau — à valider avant écriture.

Rien d'autre n'a bougé : `aviation` est en `draft`, aucune règle
textuelle, aucun `enabling`, aucune publication, aucune Lens Room. La
lentille spatiale est intacte (14 815 tags — 10 278 + 4 537), preuve en
production que le recalcul par lentille ne déborde pas.


---

# T-B+ appliquée, et l'échantillon de revue (2026-08-18)

**Le seed corrigé** (application de F2 déjà rendue, pas un déplacement
de cible) : DroneHopper → `core` (il développe l'aéronef) ; FALCon →
`a_arbitrer`, candidat Space core × Aviation core ; MAGNIFIC hors core,
conservé candidat enabling futur ; GasOn et UNAELCO restent exclus.
**Résultat après T-B+ : 0 faux positif, 1 manqué** (DroneHopper, que
les appels n'atteignent pas — c'est exactement ce que la confirmation
devra récupérer), 27 OK, 9 à arbitrer.

**Les concepts sont redescendus** : les 3 règles `topic` quittent
`aviation.csv`. Le noyau publié en base est donc **les 7 appels seuls —
1 574 projets, 4 558 M€, zéro faux positif**. Les concepts deviennent le
**pool candidat** de 608 projets, en attente du mécanisme de
confirmation.

## Une trouvaille de rappel : 18 projets Clean Sky 2 manquants

L'échantillon a fait apparaître `H2020-IBA-CS2-GAMS-2017` et
`-2019` — les **conventions aux membres** (GAM) de Clean Sky 2, qui
portent les ITD : Airframe, Engines, Systems, Fast Rotorcraft,
Eco-design. Mon préfixe `H2020-CS2-` ne les atteint pas.
**18 projets · 1 265 M€** — plus du quart du noyau actuel — manquent
donc, alors qu'ils sont indiscutablement Clean Sky 2. Le correctif est
structurel (un préfixe d'appel de plus) et n'appelle aucune règle
textuelle ; il n'a PAS été appliqué : c'est une décision à rendre.

## L'échantillon de revue — [a1-echantillon-taxonomique.csv](curation/a1-echantillon-taxonomique.csv)

**200 projets du pool taxonomique** (concept sans appel aviation),
tirés de façon déterministe et reproductible (`md5(source_id ||
'a1-echantillon')`), stratifiés : **100 aircraft · 70 aeronautical
engineering · 30 rotorcraft**. Le mélange demandé est là : MSCA/ERC 59,
PME/innovation 57, transport/mobilité 28, autres 52, Space 3, énergie 1 ;
montants de 0,05 à 173,87 M€ (médiane 1,99 ; 34 projets ≥ 5 M€).

Chaque ligne porte : concept d'origine, appel, montant, titre, résumé
court, **ma proposition de label et sa raison en une phrase**.

| Proposition | aircraft | aeronautical eng. | rotorcraft | Total |
|---|---|---|---|---|
| `core` | 45 | 26 | 20 | **91** |
| `enabling` | 10 | 3 | 1 | **14** |
| `excluded` | 34 | 33 | 6 | **73** |
| `borderline` | 11 | 8 | 3 | **22** |

**Ce que ces propositions suggèrent, à confirmer par TA revue** : le
pool taxonomique est à peu près **moitié bon, moitié bruit** (105
core+enabling contre 73 exclus et 22 douteux). Il se comporte très
différemment selon le concept — `rotorcraft` semble le plus propre (20
core sur 30), `aeronautical engineering` le plus bruyant (33 exclus sur
70, l'éolien et les procédés multi-secteurs y dominent). C'est
exactement I8 : la confiance s'attache à une règle, pas à une famille.

Deux motifs récurrents relevés pour la suite : les **actions de
coordination dédiées à l'aéronautique** (PARE, OSCAR, RADIAN, Future
Sky, SUNJET II, BAANG) que j'ai proposées `core` — leur objet EST la
recherche aéronautique ; et les **projets de développement régional**
(CARE, AD-ASTRA) que j'ai laissés en `borderline` — leur objet est la
politique régionale. Ces deux familles méritent une règle de ta part.

La revue est ton travail : tes labels rendus, je mesurerai la précision
**par concept** (et par règle, I8), et de là seulement je proposerai les
règles de confirmation et les vetos.


---

# Arbitrages du 2026-08-18 (soir) — exécutés

**① Les Clean Sky 2 manquants sont core.** Le préfixe contrôlé
`H2020-IBA-CS2-GAMS-` entre comme huitième preuve structurelle, avec
son **audit de pureté** ([call_prefix_audit.py](../backend/scripts/call_prefix_audit.py),
rejouable) : il atteint **2 codes (2017, 2019), 18 projets, tous Clean
Sky 2** — les ITD Airframe, Engines, Systems, Fast Rotorcraft, Large
Passenger Aircraft et éco-conception. Le niveau est le plus étroit
possible (I7) : le voisinage `H2020-IBA-` porte ARF, CHAIR, GEOSS et
NCP, sans rapport.

**Le noyau draft recalculé** (`--lens aviation`, 0,5 s) :

| | Avant | Après |
|---|---|---|
| Projets | 1 574 | **1 592** |
| Montant | 4 558 M€ | **5 823 M€** |
| Preuve structurelle | 100 % | **100 %** |
| Seed adversarial | 0 faux positif | **0 faux positif** (1 manqué, 9 à arbitrer, 27 OK) |

**② et ③ — l'écosystème R&I.** Branche 9 ajoutée à la taxonomie,
définition unifiée du core écrite ci-dessus. CARE est `core` (catégorie
écosystème R&I) ; **AD-ASTRA reste `borderline`, non tagué en V1** —
c'est I9 : « Aerospace Districts » ne dit pas laquelle des deux
lentilles.

**Le corpus de référence des ponts, mis à jour.** Avec le noyau
d'appels seuls, le chevauchement Space core × Aviation core est de
**34 projets · 103 M€** — et non plus 101. Les 67 autres venaient des
concepts, aujourd'hui dans le **pool candidat en attente de revue** :
ils rejoindront le corpus de référence si la revue les confirme.

**Aucune règle de confirmation, aucun veto, aucun enabling** n'a été
écrit : ils attendent les labels de la revue. Et **aucune précision
n'a été calculée sur les 200 propositions** — ce sont des candidats, pas
une vérité ; l'échantillon reste inchangé,
[docs/curation/a1-echantillon-taxonomique.csv](curation/a1-echantillon-taxonomique.csv).


---

# A1 GELÉ à l'état `a9024fc` (2026-08-18)

**Ce qui est figé, et ne bouge plus sans décision fondatrice :**

- le **noyau structurel** — 1 592 projets · 5 823 M€, 8 règles d'appel,
  100 % de preuve structurelle, 0 faux positif au seed adversarial ;
- `aviation` en **`draft`** : chargée en base, invisible du produit
  (`?sector=aviation` → 400, comme un slug inconnu) ;
- **aucune** règle de confirmation, **aucun** veto, **aucun** enabling ;
- les **200 labels candidats** de l'échantillon : inchangés, tels quels.

**L'échantillon figé de revue** :
[docs/curation/a1-echantillon-taxonomique.csv](curation/a1-echantillon-taxonomique.csv)
— 200 lignes, tirage déterministe reproductible, stratifié
100 aircraft / 70 aeronautical engineering / 30 rotorcraft.

## Le protocole de mesure — à exécuter quand les labels seront rendus

La revue est le travail de la fondatrice, informée d'une seconde
opinion externe. Les labels rendus, la mesure produira, **et rien
d'autre** :

1. la **matrice d'accord** propositions × revue (4 × 4 labels) ;
2. la **précision brute par concept** — `aircraft`,
   `aeronautical engineering`, `rotorcraft` ;
3. la **répartition des quatre labels** dans la revue ;
4. les **résultats par famille d'appel** (MSCA/ERC, PME/innovation,
   transport, Space, énergie, autres) **et par tranche de montant** ;
5. les **erreurs les plus fréquentes** — les motifs qui reviennent.

**Aucun apprentissage des règles avant cette mesure.** Les règles de
confirmation, les vetos et l'enabling ne se conçoivent qu'après — et
par règle, jamais par famille (I8).


---

# La définition conceptuelle DÉFINITIVE (gravée le 2026-08-18, après revue)

Elle remplace toutes les formulations antérieures de ce document.

- **CORE** — ce que le projet développe est **intrinsèquement un
  élément, une fonction, une opération ou une infrastructure du système
  aérien**, ou **l'écosystème de R&I aéronautique**.
- **ENABLING** — une technologie **intrinsèquement multisectorielle**,
  avec une **application aéronautique explicite ET substantielle**.
- **EXCLUDED** — l'aviation n'est qu'un **exemple**, un **marché
  possible**, un **instrument**, ou une **classification trop large**.
- **BORDERLINE** — les pièces **ne permettent pas de trancher
  honnêtement**.

Conséquence directe, mesurée : la barre de l'`enabling` est **beaucoup
plus haute** qu'on ne l'imaginait — une technologie dont l'objet déclaré
est aéronautique (bruit d'avion, collage de structures d'avion,
composants aérospatiaux) est **core**, pas enabling. L'enabling ne reste
que pour le vraiment multisectoriel (5 cas sur 200).

**Sous-branche ajoutée à la taxonomie interne : 10. Ground operations &
airport systems** — équipements sol, assistance en escale, sûreté et
exploitation aéroportuaire. Ils sont `core` : ce sont des opérations et
des infrastructures du système aérien.

# La mesure de la revue (protocole gelé, exécuté le 2026-08-18)

## 1. Matrice d'accord — proposition (ligne) × revue (colonne)

| proposé \ revue | core | enabling | excluded | borderline | total |
|---|---|---|---|---|---|
| **core** | **91** | 0 | 0 | 0 | 91 |
| **enabling** | 11 | 1 | 2 | 0 | 14 |
| **excluded** | 1 | 0 | **72** | 0 | 73 |
| **borderline** | 9 | 4 | 8 | 1 | 22 |
| total | 112 | 5 | 82 | 1 | 200 |

**Accord exact : 165/200 = 82,5 %.** Accord sur la seule question qui
engage le produit — taguer ou non — : **184/200 = 92 %**.

**Le résultat qui compte : mes 91 propositions `core` sont confirmées
`core` à 91 sur 91.** Aucune sur-classification. Symétriquement, 72 de
mes 73 `excluded` sont confirmés.

## 2. Précision brute par concept (vérité = revue)

| concept | n | core | enabling | excluded | borderline | **précision core** | core+enabling |
|---|---|---|---|---|---|---|---|
| `rotorcraft` | 30 | 21 | 1 | 8 | 0 | **70,0 %** | 73,3 % |
| `aircraft` | 100 | 59 | 3 | 38 | 0 | **59,0 %** | 62,0 % |
| `aeronautical engineering` | 70 | 32 | 1 | 36 | 1 | **45,7 %** | 47,1 % |
| **total** | 200 | 112 | 5 | 82 | 1 | **56,0 %** | 58,5 % |

Les trois concepts sont **très différents** — c'est I8 démontré : la
confiance s'attache à une règle, jamais à une famille.

## 3. Répartition de la revue

`core` 112 (56,0 %) · `enabling` 5 (2,5 %) · `excluded` 82 (41,0 %) ·
`borderline` 1 (0,5 %).

## 4. Par famille d'appel, et par montant

| famille d'appel | n | taux core+enabling |
|---|---|---|
| Clean Sky 2 GAM | 7 | **100 %** |
| transport / mobilité | 29 | **93,1 %** |
| Space / GNSS | 5 | 60,0 % |
| PME / innovation | 57 | 59,6 % |
| autres | 42 | 45,2 % |
| MSCA / ERC | 59 | **44,1 %** |

| tranche | n | taux core+enabling | M€ retenus |
|---|---|---|---|
| ≥ 20 M€ | 6 | **100 %** | 610 |
| 2 – 5 M€ | 64 | 65,6 % | 133 |
| 0,5 – 2 M€ | 33 | 60,6 % | 29 |
| 5 – 20 M€ | 28 | 57,1 % | 121 |
| < 0,5 M€ | 69 | **47,8 %** | 3 |

**En nombre le pool est bon à 58,5 % ; en VALEUR il l'est à 81,2 %**
(896 M€ retenus sur 1 103 M€). Le bruit se concentre dans les petits
montants et les appels de mobilité de chercheurs.

*Note de cohérence : les 7 projets « Clean Sky 2 GAM » de l'échantillon
étaient dans le pool parce que le préfixe `H2020-IBA-CS2-GAMS-` n'était
pas encore une règle au moment du tirage. La revue les confirme core à
100 % — l'arbitrage ① est validé par la mesure, indépendamment.*

## 5. Les erreurs les plus fréquentes — 35 désaccords

| Motif | Cas | Ce qu'il révèle |
|---|---|---|
| `enabling` → **core** | **11** | J'ai placé la barre de l'enabling BEAUCOUP trop bas. Deux familles : les **équipements sol** (Aerowash II, Runway-Star, ACES) — d'où la sous-branche 10 — et les **technos à objet aéronautique déclaré** (ThermoTON, HiBONTE, CompSTLar, ICARUS, MORPHO, EMUSIC, AIRPOXY, ComBoNDT) |
| `borderline` → **core** | **9** | J'ai hésité là où les pièces suffisaient (AMOS, AIRSCAN, CARE, TMC Brake, LINING, AiRT, NEEDED, SPRINT, NI HTS) |
| `borderline` → **excluded** | **8** | J'ai hésité là où les pièces manquaient franchement : mécanique des fluides et physique génériques (HAPI, ConFlex, VIPER, FLOCON, VORTSHEET, SPANDRELS, Rotary Wing CLFC) et PSR94 (I9) |
| `borderline` → **enabling** | 4 | Le vrai multisectoriel : SPE, WakeOpColl, FrictionHarmonic, FLOVISP |
| `enabling` → **excluded** | 2 | J'ai lu un débouché là où l'aviation n'est qu'un exemple (FULLCOMP, Aeropaft) |
| `excluded` → **core** | **1** | DUF — j'ai appliqué I5 (le drone-outil) alors que le projet DÉVELOPPE le réseau de drones : F2 tranche core. Mon seul manqué |

**Le motif dominant est unique et systématique : j'ai sous-classé.**
21 de mes 22 `borderline` étaient tranchables, et 11 de mes 14
`enabling` étaient des core. Dans l'autre sens — sur-classer — je n'ai
qu'**un seul cas** sur 200.

## 6. Ce que la revue implique pour le pool (estimation, pas une règle)

En repondérant les taux mesurés sur la population réelle du pool
(400 aircraft, 128 aeronautical engineering, 80 rotorcraft) :
**≈ 367 des 608 projets** seraient à retenir (60,4 %) — 248 par
`aircraft`, 60 par `aeronautical engineering`, 59 par `rotorcraft`.
C'est une estimation d'échantillon, pas une décision : **aucune règle
n'est écrite.**


---

# Les règles de confirmation et les vetos — PROPOSITIONS (2026-08-18)

*Rien n'est chargé. Chaque règle est mesurée sur les 200 vérités de
revue et testée contre le seed adversarial. La confiance s'attache à
une règle, jamais à une famille (I8).*

## La découverte qui commande tout : titre ≠ résumé

Le mot « aircraft » dans le **résumé** ne vaut que **74,4 %** de
précision : tout le monde cite l'avion en exemple. Les trois faux
positifs qui survivaient à la confirmation simple le disent en une
ligne — IN-NOVA entre par « EASA » (réglementation du bruit citée),
ADeHEx par « aviation » (« one example being engine cooling in the
aviation industry »), ORGGROWTH par « airline » (exemple
d'entrepreneuriat). C'est exactement la définition d'`excluded` : *l'aviation
n'est qu'un exemple*.

Le même mot dans le **titre** dit le SUJET du projet. D'où la
**double confirmation** : un motif d'aviation dans le titre **ET** un
motif fort dans le texte. Elle atteint **100 % sur les trois concepts**.

**Les motifs mesurés** (précision sur les 200) — les FORTS : `landing`
100 %, `airframe` 100 %, `air traffic` 100 %, `aviation` 96,6 %,
`airline` 94,4 %, `air transport` 91,7 %, `uav` 90,9 %. Les faibles,
écartés : `aircraft` 74,4 %, `aeronautic` 66,0 %, `wing` 63,4 %,
`helicopter` 63,2 %, `airborne` 44,4 %.

## Les propositions, une par concept

| Concept | Règle proposée | Mécanisme (I6) | Entrent | Restent dehors | M€ | Précision mesurée | IC 95 % |
|---|---|---|---|---|---|---|---|
| **aircraft** | double confirmation | candidat `topic` (taxonomique) + motif titre **et** motif fort → tag `taxonomic` | **121** | 268 | 390 | **100 %** (40/40) | 91-100 |
| **aeronautical engineering** | double confirmation | idem | **20** | 107 | 60 | **100 %** (11/11) | 74-100 |
| — *variante plus large* | motif titre + veto | idem, veto textuel actif | 36 | 91 | 119 | 95,8 % (23/24) | 80-99 |
| **rotorcraft** | confirmation **légère** : motif fort seul | candidat + motif fort → tag `taxonomic` | **46** | 30 | 73 | 95,2 % (20/21) | 77-99 |
| — *variante stricte* | double confirmation | idem | 29 | 47 | 46 | **100 %** (15/15) | 80-100 |

**Place dans la hiérarchie (I6)** : le concept reste **taxonomique** ;
la confirmation est **textuelle**. Un candidat confirmé produit donc un
tag de niveau **taxonomique** — jamais structurel : il n'est pas un fait
de la source, c'est une lecture corroborée. Conséquence directe et
voulue : **un veto textuel peut le retirer**, alors qu'il ne peut rien
contre les 8 règles d'appel.

## Les vetos — mesurés, et concept-dépendants

Aucun veto n'est un filet universel. Leur pureté sur les 200 : `vessel`
100 % (5 cas), `automotive` 89,5 %, `maritime` 85,7 %, `wind turbine`
83,3 %, `wind farm` 83,3 %. Un veto « wind turbine » brut tuerait donc
**2 projets utiles sur 12** — inacceptable seul.

Leur effet réel dépend du concept, et c'est I8 en action :

| Concept | Sans veto | Avec veto | Verdict |
|---|---|---|---|
| aircraft (double conf.) | 100 % | 100 % | **inutile** — la double confirmation a déjà tout filtré |
| aeronautical eng. (titre) | 85,2 % | **95,8 %** | **indispensable** — il fait passer le seuil |
| rotorcraft (fort seul) | **95,2 %** | 94,7 % | **nuisible** — il retire 2 utiles pour 1 faux |

→ Le veto n'est proposé **que** sur la variante large d'aeronautical
engineering. Ailleurs, il n'apporte rien ou il coûte.

## Le test contre le seed adversarial : zéro faute

Les 37 cas passés aux règles proposées, dans les deux scénarios :
**aucun faux positif introduit**. GasOn (moteurs gaz automobiles),
MAGNIFIC (GNSS générique), UNAELCO (éoliennes) et FALCon (étage de
lanceur) **restent dehors** — aucun ne réunit titre + motif fort.

**Le manqué demeure** : DroneHopper reste hors du noyau. Son résumé dit
« remote-controlled aircraft » sans aucun motif fort de la liste. C'est
le prix assumé de « mieux vaut manquer que salir » — et le cas est au
gold set, il rappellera cette dette à chaque mesure.

## L'honnêteté statistique — à lire avant de trancher

Les précisions reposent sur de **petits échantillons**. « 100 % » sur
11 observations (aeronautical engineering en double confirmation) a une
borne basse d'intervalle à **74 %** : ce n'est pas une garantie de
95 %. Trois lectures possibles, par ordre de prudence :

1. **le plus sûr** — double confirmation partout : +170 projets,
   +496 M€, borne basse la plus haute sur aircraft (91 %) ; le noyau
   passerait à **1 762 projets · 6 319 M€** ;
2. **l'équilibré** — double sur aircraft, légère sur rotorcraft, double
   sur aeronautical engineering : +187 projets ;
3. **le plus large** — variantes larges partout : +250 projets, mais
   deux règles sous 95 % et des bornes basses à 75-80 %.

**Le signal du montant**, mesuré : ≥ 20 M€ vaut 100 % sur `aircraft` et
`rotorcraft` — mais sur `aeronautical engineering`, ≥ 10 M€ tombe à
**20 %**. Il n'est donc **pas** proposé comme règle : ce n'est pas un
signal de la lentille, c'est un signal de deux de ses concepts, sur
trois à six cas. I8 interdit d'en faire une famille.

## Ce que ces règles exigent du mécanisme

La grammaire actuelle ne sait pas exprimer « candidat confirmé ». Il
faudra, à valider séparément : un type de règle **`candidate`** (un
concept qui ouvre un pool sans taguer) et un type **`confirm`** (un
motif qui promeut, avec sa portée `titre` ou `texte`) — soit une
septième colonne au CSV des règles, validée tout ou rien comme le
reste. **Rien de cela n'est écrit** : les propositions attendent les
arbitrages.

---

## A1 · Les groupes liés chargés — projection sur le holdout (2026-08-18)

Arbitrages fondatrice appliqués : **double confirmation pour les trois
concepts**, rotorcraft-light conservé en **challenger analytique**,
mesuré ici et **jamais chargé**.

### Ce qui est chargé

`backend/curation/lenses/aviation.csv` — **140 règles**, aviation reste
**`draft`** :

| Type | Nombre | Classe |
|---|---|---|
| `call` | 8 | structurelle |
| `candidate` | 3 | taxonomique (ouvre un pool, ne tague jamais seul) |
| `confirm` `title` | 78 | corroboration sur le titre |
| `confirm` `text` | 51 | corroboration sur titre + résumé |

Trois groupes : `av-aircraft`, `av-aeronautical-engineering`,
`av-rotorcraft`. **Aucun veto nouveau**, conformément à l'arbitrage.

### Les chiffres, mesurés

| | avant | après |
|---|---|---|
| Aviation core | 1 592 | **1 741** (+149) |
| dont preuve structurelle | 1 592 | 1 592 (inchangé) |
| dont preuve taxonomique confirmée | 0 | **149** |
| Financement Aviation | 5 822 834 792 € | **6 283 697 101,46 €** |
| **Space core / enabling** | 10 278 / 4 537 | **10 278 / 4 537 — inchangé** |
| **Space financement** | 18 816 721 695 € | **18 816 721 695 € — inchangé** |

I4 vérifié sur pièce : `--lens aviation` n'a pas touché un seul tag Space.
Aviation étant en `draft`, **aucune ligne de journal** n'a été écrite —
le seul enregistrement de `lens_changelog` reste celui de Space v2.

Les groupes ont retenu 389 projets : **240 étaient déjà dans le noyau
structurel** (les appels Clean Sky / SESAR les avaient déjà) et **149
sont nouveaux**. Ce recouvrement de 62 % est en soi une corroboration :
les concepts visent bien la même zone que les appels.

### Le seed adversarial — tenu

`uv run python scripts/gold_check.py aviation` sur les 37 spécimens :
**0 faux positif**, 1 manqué (DroneHopper, connu). Les pièges tiennent
tous, y compris ceux que les motifs lexicaux menaçaient le plus :
`drone_outil` (GIDROM), `nsf_avion_outil`, `aero_eolien`,
`wing_biologique`, `flight_spatial` (ASTROCIT), `piege_engineering`.

### Écart déclaré : la garde des motifs courts

La proposition arbitrée s'appuyait sur des motifs mesurés dont sept
sont **refusés par la garde maison** du chargeur (« motif trop court et
sans espace — trop ambigu ») : `vtol`, `uav`, `uas`, `drone`, `aero`,
`easa`, `icao`. J'ai choisi de **respecter la garde** plutôt que de
l'affaiblir — `uas` capture « quasi », `aero` capture « aerosol » — et
d'y substituer des équivalents multi-mots conformes (`unmanned
aerial`, `unmanned aircraft`, `vertical take-off`, `drones`,
`multicopter`, `quadcopter`).

Coût mesuré sur l'échantillon : **56 entrants au lieu de 66**. La
justesse reste de **100 %** sur les trois concepts ; c'est du rappel
qui est perdu, pas de la précision.

### Le holdout — à relire

`docs/curation/a1-holdout-groupes-lies.csv` — **97 projets, 349,3 M€**,
les entrants taxonomiques **hors des 200 déjà labellisés** (83
aircraft, 12 rotorcraft, 2 aeronautical engineering ; les 52 autres
nouveaux entrants sont dans l'échantillon déjà revu).

Format de l'échantillon, plus une colonne `doute` : **16 projets** y
portent une réserve doctrinale de ma part, en quatre familles —

1. **I5 — le projet UTILISE un aéronef** au lieu d'en développer un
   (archéologie au drone Lidar, turbulence atmosphérique in situ,
   prestataire de services de drones) ;
2. **l'aviation est UNE application parmi plusieurs** (batteries pour
   véhicules électriques *et* avions, carburants routier/aérien/maritime) ;
3. **objet non-R&I aéronautique** (mouvements sociaux contre le
   transport aérien, projet ERC théorique) ;
4. **le sol et l'aéroport plutôt que l'aéronef** — extension de F1
   (ATM core) qui demande ton arbitrage explicite.

**Aucun taux de précision n'est calculé sur ce holdout** : sa vérité
n'existe pas encore. C'est précisément son rôle (I10).

### Rotorcraft-light — mesuré, non chargé

Variante à confirmation **titre seule** sur le groupe rotorcraft :

- pool rotorcraft avec confirmation titre : **82**
- dont double confirmation, chargée : **69**
- **que light aurait ajoutés : 13**, dont 8 hors du noyau structurel.

Sur les 5 de ces 13 qui portent déjà une vérité de revue : **3 core**
(dont **DroneHopper**, le manqué du seed) et **2 excluded**. Soit une
justesse de 60 % là où la double confirmation tient 100 %.

Le cas qui tranche est dans le holdout : **« A Helicopter View on
Electrocatalysis »** — une métaphore. Le titre dit « helicopter », le
texte ne parle jamais d'aéronautique ; la corroboration texte l'écarte,
la variante légère l'aurait fait entrer. **Le challenger reste un
challenger.**

### Ce qui n'est pas fait

Aviation n'est **pas publiée**, pas activable, absente de la Lens Room.
Prochaine porte : ta relecture du holdout.

---

## A1 · Correction de la double confirmation (amendement fondatrice, 2026-08-18)

**Le défaut.** La première version croisait `title` et `text`, où `text`
signifiait titre + résumé. Ce n'était **pas** une double confirmation :
un motif présent dans le titre satisfaisait mécaniquement les deux
lectures. La preuve est dans les raisons produites — « corroboré par le
titre (« aviation ») et par le texte (« aviation ») » : le même mot,
compté deux fois.

**La correction.** Trois champs désormais : `title` (le titre seul),
**`body_text`** (l'objectif/résumé SEUL, hors titre) et `all_text`
(titre + résumé, conservé dans la grammaire, **jamais suffisant**). La
politique Aviation v1 devient **candidat ET `title` ET `body_text`**.
Un test le prouve à l'envers : le même motif posé sur `title` et
`body_text` ne tague rien.

### Reprojection

| | avant correction | après |
|---|---|---|
| Aviation core | 1 741 | **1 737** |
| dont taxonomique confirmée | 149 | **145** (−4) |
| Financement taxonomique | 460 862 310 € | **444 849 175,46 €** |
| Structurel | 1 592 | 1 592 — inchangé |
| **Space** | — | **10 278 / 4 537 · 18 816 721 695 € — inchangé** |

Seed adversarial : **0 faux positif**, 1 manqué (DroneHopper) — inchangé.

### Les quatre disparus, nommés

| Projet | Sort |
|---|---|
| 814801 — *Assessing aViation emission Impact on local Air quality at airports* | perdu à tort : `core` sous I12 |
| 101192936 — *Boosting the digital transformation of aviation supply chains* | perdu à tort : **`core` par ta propre revue** |
| 641627 — *Capacity building for aviation stakeholders* | perdu à tort : **`core` par ta propre revue** |
| 101192913 — *LOW-Carbon fuels for heavy-duty, aviation, and maritime* | **bien écarté** de core : `enabling` sous I13 |

**La cause, mesurée.** Aucun de ces quatre résumés ne contient un motif
de la liste de corps. Cette liste a été construite pour un rôle
différent — celle des motifs à ≥ 90 % de justesse en signal AUTONOME —
et `aircraft` en est exclu (74,4 % seul). Or AVIATOR écrit « Emissions
from **aircraft** … around **airports** » : deux motifs qui ne sont
présents que dans la liste de TITRE.

Autrement dit : maintenant que `title` porte la spécificité, un motif
de corps n'a plus besoin d'être spécifique à lui seul — il n'a qu'à
corroborer. Élargir la liste de corps (`aircraft`, `airport`,
`aeronautic`) est le geste qui rattraperait ces trois pertes. **Je ne
l'ai pas fait** : c'est une refonte de règle, elle t'appartient.

### Le holdout v2 — [a1-holdout-groupes-lies.csv](curation/a1-holdout-groupes-lies.csv)

**95 projets, 340,1 M€** (82 aircraft, 11 rotorcraft, 2 aeronautical
engineering). Les doctrines gravées ont résolu **13 des 16 réserves** :

| Ma proposition | Nombre |
|---|---|
| `core` | 83 |
| `enabling` (I13) | 4 |
| `excluded` (I5, I12) | 8 |
| **réserves conservées** | **3** |

**12 projets divergent de ce que la règle chargée tague** (elle les
met tous en `core`). Ce sont les candidats naturels d'un futur travail
de veto ou de règle `enabling` — aucun n'a été écrit ici.

Les trois réserves restantes sont celles où deux doctrines tirent en
sens contraire : 5D-AeroSafe (drones pour la sécurité des aéroports
**et** des voies navigables), l'UAS autonome de surveillance côtière
(l'autonomie développée est une capacité d'aéronef, l'objectif ne parle
que de la mer) et la détection d'aéronefs à basse altitude (surveiller
l'espace aérien, ou protéger une frontière ?).

---

## A1 · Recalibration conditionnelle des motifs de corps (2026-08-18)

**Le constat qui change tout.** Sur les 200 revus, conditionné à
*candidat + titre fort*, le pool est **70 core / 0 enabling / 7
excluded** : le titre fait déjà 91 % du travail. Un motif de corps
n'est donc plus un classifieur — il n'a plus qu'à ne pas laisser entrer
ces 7. La bonne métrique n'est pas P(core | motif), c'est
**P(core | candidat + titre fort + motif)**.

Et la liste de corps d'origine, calibrée en signal autonome, admet
**0 excluded** sur ce pool. Le socle est propre ; c'est le rappel qui
manquait.

### Les 7 excluded à ne pas laisser entrer

| Projet | Pourquoi il est exclu | Motifs qui l'ouvriraient |
|---|---|---|
| AIRFORS | aéronef-instrument (science forestière) | `aircraft`, `airborne` |
| ICARE-2010 | conférence, recherche aéroportée environnementale | `aircraft`, `airport`, `wing`, `flight` |
| ASICA | aéronef-instrument (bilan carbone amazonien) | `aircraft` |
| FORTAPE | fabrication composite, aéronautique en application | `aeronautic` |
| NUMIWING | éolien aéroporté | `wing`, `flight`, `aerodynamic`, `rotor` |
| YawSTOP (×2) | dispositif de stabilisation de charge | `helicopter`, `pilot` |

### Règle d'admission appliquée

**Un motif entre s'il apporte ≥ 1 nouveau vrai `core` ET 0 nouvel
`excluded` sur les 200.** Douze règles par groupe :

| Motif | Mode | Admis | P(core) | Entrants neufs |
|---|---|---|---|---|
| `maintenance` | phrase | 10 | 100 % | 4 core, 0 excluded |
| `certification` | phrase | 12 | 100 % | 3 core, 0 excluded |
| `drone` + `drones` | **token** | 11 | 100 % | 3 core, 0 excluded |
| `air vehicle` | phrase | 1 | 100 % | 1 core |
| `icao` | **token** | 2 | 100 % | 1 core (CaBilAvi revient) |
| `sesar` | **token** | 4 | 100 % | 1 core |
| `mro` | **token** | 1 | 100 % | 1 core |
| `rpas` | **token** | 1 | 100 % | 1 core |
| `uav` / `vtol` / `easa` | **token** | 3 / 1 / 2 | 100 % | **0** — propres, gain nul en échantillon |

### Ce qui est REFUSÉ, et pourquoi

- **`aircraft`** — 14 entrants neufs dont **11 core et 3 excluded**
  (AIRFORS, ICARE-2010, ASICA : les trois sont des aéronefs-instruments).
  Précision conditionnelle 95 %, exactement au seuil. **Le prix est
  3 faux positifs ; le gain, 11 core. Arbitrage à rendre.**
- **`airport`** — 2 entrants neufs, 1 core et 1 excluded (ICARE-2010).
- **`wing`** (10 neufs, 2 excluded), **`aeronautic`** (7 neufs,
  1 excluded), **`airborne`** (3 neufs, 0 core) : refusés sur mesure.
- **`token:uas`** — 1 admis, **0 core, 1 excluded**. L'acronyme le plus
  attendu est celui que la donnée refuse.
- **`token:atm`** — non chargé : le sigle entre en collision avec
  l'unité de pression « atm », et les 200 ne contiennent pas assez
  d'occurrences pour mesurer la collision. `air traffic` couvre déjà
  le besoin.
- **`token:utm`, `token:gse`, `token:ata`** — absents du corpus revu.
- **`propulsion`** (13 admis, 100 %) et **`passenger`** (8 admis,
  100 %) : propres, mais **0 entrant neuf mesuré**. Non chargés.

### Le mode token

Nouvelle syntaxe `token:xxx` : le moteur cherche le **mot entier**
(`\m…\M` en Postgres) au lieu d'une sous-chaîne. La garde des motifs
courts reste **intacte** pour le mode phrase — elle devient inutile en
mode token, puisqu'un sigle ne peut plus se cacher dans un mot plus
long. Deux tests le prouvent : `token:act` ne mord pas sur
« abstract », `token:abstract` mord.

### Reprojection

| | avant | après |
|---|---|---|
| Aviation core | 1 737 | **1 754** (+17) |
| dont taxonomique confirmée | 145 | **162** |
| Financement | 6 267 683 967 € | **6 307 772 443,38 €** |
| **Seed adversarial** | 0 faux positif, 1 manqué | **0 faux positif, 0 manqué** |
| **Space** | — | **inchangé** |

**Le seed est parfait pour la première fois** : DroneHopper revient par
`token:drone`. Les 37 spécimens passent tous.

### Critère de réussite : 2 sur 3

- **CompSTLar** revient (par `maintenance`) ✔
- **CaBilAvi** revient (par `token:icao`) ✔
- **AVIATOR** ne revient pas ✘ — son résumé ne dit que « aircraft » et
  « airports », les deux motifs dont le prix est un faux positif. Il
  est **inatteignable sans admettre ICARE-2010**. C'est la mesure, pas
  un choix.

### Une entrée à tort, déclarée

La recalibration fait entrer **Ampyx Power** (éolien aéroporté) dans le
holdout, par `airborne` au titre et `maintenance` au corps. Le maillon
faible est le motif de TITRE `airborne`, jamais mesuré séparément —
il n'a pas été touché ici. C'est le seul faux positif doctrinal ajouté,
et il est classé `excluded` dans le holdout.

### Holdout final — [a1-holdout-groupes-lies.csv](curation/a1-holdout-groupes-lies.csv)

**102 projets, 357,6 M€** (84 aircraft, 11 rotorcraft, 7 aeronautical
engineering) : **91 `core`, 3 `enabling`, 8 `excluded`, 0 réserve**.
Les trois réserves de la v2 sont tranchées (5D-AeroSafe → core,
MarineUAS → core, ALFA → excluded par I14).

**11 projets divergent du tag de la règle**, qui les met tous en `core`.
Conformément à l'arbitrage ④, **aucun veto ni aucune règle `enabling`
n'a été écrit** — I10 continue de s'appliquer.

---

## A1 · Ablation et GEL de la candidate V1 (2026-08-18)

### Ablation — mesure seule, aucune règle modifiée

Sur les **162 projets taxonomiques** actuellement tagués, de quels
motifs l'admission dépend-elle *exclusivement* ?

**Motif de TITRE `airborne` — 1 seul projet en dépend :**

| Projet | Montant | Label |
|---|---|---|
| 666793 — *Commercial introduction of the first Airborne Wind Energy system* | 2,50 M€ | **core** (arbitrage fondatrice) |

**Motif de CORPS `maintenance` — 4 projets en dépendent :**

| Projet | Montant | Label | Autre côté |
|---|---|---|---|
| 101192936 — *Boosting the digital transformation of aviation supply chains* | 4,93 M€ | **core** (revue des 200) | `aviation` |
| 666793 — *Airborne Wind Energy system* | 2,50 M€ | **core** (arbitrage) | `airborne` |
| 712667 — *Hybrid multi copter with 6 times more flight time* | 0,05 M€ | **core** (revue des 200) | `flight` |
| 779576 — *Fuel CelL HYdrogen System for AircraFt Emergency operation* | 5,06 M€ | **core** (holdout) | `aircraft` |

**Ce que la mesure dit, et rien de plus** : `airborne` et
`maintenance` **ne présentent aucun faux positif observé parmi leurs
dépendants exclusifs connus au moment du gel**. `airborne` porte
exactement un projet, `maintenance` en porte quatre. **n = 1 et n = 4
ne généralisent rien** — ces chiffres écartent une inquiétude précise,
ils ne fondent aucune confiance sur le corpus entier.

Et par conséquent : après l'arbitrage sur Ampyx, la recalibration
n'a introduit **aucun** faux positif doctrinal. Ce que j'avais déclaré
comme une entrée à tort n'en était pas une.

### GEL — candidate Aviation V1

| | |
|---|---|
| Statut | **`draft`**, invisible de l'API |
| Aviation core | **1 754** |
| dont preuve structurelle | 1 592 |
| dont **taxonomique confirmée** | **162** |
| Financement | **6 307 772 443,38 €** |
| Règles | 176 — 8 `call`, 3 `candidate`, 78 `confirm` titre, 87 `confirm` corps |
| Space | **10 278 / 4 537 · 18 816 721 695 € — inchangé** |
| Holdout | **102 projets — 92 `core`, 3 `enabling`, 7 `excluded`, 0 réserve** |

**Le seed adversarial change de statut.** Ses 37 spécimens ont servi à
la CONCEPTION des règles ; ils ne sont donc plus une validation (I10).
Ils deviennent une **suite de régression permanente** : leur rôle est
désormais de détecter qu'un changement futur casse quelque chose qui
marchait, jamais de prouver qu'une règle est juste. Son état au gel —
0 faux positif, 0 manqué — est une ligne de base, pas un résultat.

**Rien ne bouge avant la revue des 102 :** aucun veto, aucune règle
`enabling`, aucun élargissement de motif.

Le holdout à relire : **`docs/curation/a1-holdout-groupes-lies.csv`**

---

## A1 · Mesure du holdout et instruction du cycle V2 (2026-08-19)

Vérité de revue : `docs/curation/a1-holdout-groupes-lies-revue-chatgpt.csv`,
colonne `mon_label` — **94 core / 3 enabling / 5 excluded**, après
adjudication d'ARCTIC et THRUST en `core`.

### Précision — la porte ne passe pas

| Périmètre | Précision `core` | Verdict |
|---|---|---|
| **Holdout entier** | **94/102 = 92,2 %** | **sous le seuil de 95 %** |
| `av-aeronautical-engineering` | 7/7 = 100 % | n = 7, ne conclut rien |
| `av-aircraft` | 77/84 = 91,7 % | 3 enabling, 4 excluded |
| `av-rotorcraft` | 10/11 = 90,9 % | 1 excluded |

La porte ne passe pas, et **c'est le système qui fonctionne** : une
règle conçue sur un échantillon a été mise à l'épreuve sur des cas
qu'elle n'avait jamais vus, et elle a été recalée (I10).

Les 8 erreurs avaient toutes été signalées comme divergences dans le
holdout livré : ma proposition coïncide avec la vérité sur les 8. Ce
sont les deux cas où j'avais proposé `excluded` à tort — ARCTIC et
THRUST — qui font la différence, et ils vont dans le sens de
l'inclusion.

### Les 8 erreurs, instruites

**Trois `enabling` — le multisectoriel (I13) :**

| Projet | Titre | Corps | Nature |
|---|---|---|---|
| HELENA — *batteries solides pour véhicules électriques et aéronefs* | `aircraft` | `aviation` | deux secteurs nommés au titre |
| SAFEMODE — *facteurs humains aviation et maritime* | `aviation` | `aviation`, `drones` | deux secteurs nommés au titre |
| SmartAnswer — *réduction acoustique multi-secteurs* | `aircraft` | `airframe` | quatre secteurs visés |

Ce **n'est pas un défaut de motif** : les mots sont légitimement là, le
projet touche vraiment l'aviation. C'est un **trou de grammaire** — un
groupe lié ne sait dire que `core`, il n'a aucun moyen d'exprimer
« substantiel mais partagé ».

**Cinq `excluded` — la discrimination doctrinale :**

| Projet | Titre | Corps | Doctrine |
|---|---|---|---|
| ESTABLIS-UAS — turbulence atmosphérique | `unmanned aerial` | `unmanned aerial` | I5, aéronef-instrument |
| PHOENIX-UASL — archéologie au Lidar | `unmanned aerial` | `unmanned aerial`, `drone(s)` | I5, aéronef-instrument |
| INAS — prestataire de services de drones | `drones` | `aviation`, `drone(s)` | I5, exploite sans développer |
| ALFA — détection d'aéronefs à basse altitude | `aircraft` | `landing`, `drone(s)`, … | I14, aéronef-cible |
| PROTEST-AIRT — mouvements d'opposition | `air transport` | `aviation`, `airline` | I5 raffiné, objet d'étude |

### Diagnostic : motifs récurrents pour le repérage, cas isolés pour la correction

La famille **drone/UAS concentre 4 erreurs sur 5**. Au corps, `drones`
compte **4 erreurs pour 7 justes** et `drone` 3 pour 7 ; au titre,
`unmanned aerial` compte **2 erreurs pour 2 justes**. Le repérage est
donc bien récurrent.

Mais la correction ne l'est pas, et c'est le cœur du problème :
**MarineUAS (mission maritime) est `core`, ESTABLIS-UAS (mission
atmosphérique) est `excluded`, et leurs mots sont les mêmes.** Le
discriminant — développe / utilise / vise — n'a **aucune ombre
lexicale**.

### Corrections candidates, toutes chiffrées, toutes refusées

| Correction | Corrige | Casse | Verdict |
|---|---|---|---|
| `veto archaeolog` | 1 | 0 | **refusée** — touche 1 document ; un motif taillé sur un cas n'a pas de précision mesurable (I10, I15) |
| `veto atmospheric boundary layer` | 1 | 0 | **refusée**, même raison |
| `veto social movement\|protesting` | 1 | 0 | **refusée**, même raison |
| `veto detection and tracking` | 1 | 0 | **refusée**, même raison |
| `veto service provider` | 1 | **4 core** | refusée sur mesure |
| Exiger un signal de CAPACITÉ au corps | 6 | **41 core** | refusée sur mesure |
| Veto FAMILLE surveillance (I14 lexicalisé) | 1 | **4 core** | refusée — CERTIFLIGHT, TRACKANT, MoNIfly et AIRSCAN surveillent le ciel *au service* du système aérien |
| `demote` multisectoriel au titre | 3 | **2 core** (MarineUAS, OSCAR) | refusée — précision marginale 60 % (I15) |

**Aucune correction lexicale ne survit à la mesure.** Les quatre vetos
« propres » ne le sont qu'en apparence : leur zéro dégât est une
tautologie, un motif choisi pour matcher un document matche un
document.

### Le constat qui commande le cycle V2

| Preuve | Projets | Revus | Jamais revus |
|---|---|---|---|
| **structurelle** | 1 592 | 7 | **1 585** |
| **taxonomique** | 162 | 162 | **0** |

**La mesure de 92,2 % porte sur 9 % du noyau.** Les neuf dixièmes
restants — la preuve structurelle, celle des appels Clean Sky et SESAR —
n'ont **jamais été mesurés**. Le seuil de 95 % s'applique à `core`,
c'est-à-dire aux 1 754, pas aux 162.

Et 430 candidats du pool ont été **rejetés** par la double
confirmation, sans revue : c'est le gisement de faux négatifs, où
vivent AVIATOR et ses semblables. Le rappel n'a jamais été mesuré non
plus.

### Le cycle V2 proposé — trois voies, à arbitrer

**V2-A — mesurer là où c'est aveugle (recommandée).** Avant toute
correction de règle, échantillonner les **1 585 structurels jamais
revus**. C'est un holdout *naturellement* indépendant : il existe, il
est intact, et il porte 91 % du noyau. Protocole : tirage stratifié
par règle d'appel (les 8), n = 150–200, mêmes colonnes que les
précédents, revue en aveugle, seuils appliqués au noyau ENTIER.
Effet sur les tags : **aucun**. Ce qu'il produit : la première mesure
du chiffre qui décide vraiment.

**V2-B — restreindre plutôt que corriger.** Si la précision taxonomique
ne peut pas monter, la sortir du périmètre publié : publier Aviation
sur la seule **preuve structurelle** (1 592, un fait de source) et
garder les 162 en interne jusqu'à mieux. Rappel −9 %, précision fondée
sur la source et non sur un mot. À n'arbitrer qu'après V2-A.

**V2-C — chercher une preuve, pas un mot.** Pour la famille drone/UAS,
exiger un co-signal **structurel** (appel ou programme aéronautique)
plutôt qu'un motif — I6 appliqué là où le lexique échoue. Réserve
honnête : ces projets sont taxonomy-only *par construction*, donc ce
co-signal les fera probablement tous tomber. **À chiffrer avant d'y
croire.**

**Le second holdout, pour le rappel.** Un échantillon des 430 rejetés,
revu en aveugle, mesurerait ce que la double confirmation coûte. Nous
n'avons aujourd'hui aucun chiffre de rappel — seulement un faux négatif
nommé.

### Ce qui ne se fait pas

Aucun veto, aucune règle `enabling`, aucun élargissement de motif,
aucune publication. **Les 102 rejoignent les 200 dans le jeu
consommé** (I10) : plus jamais ils ne valideront quoi que ce soit.

---

## A1 · V2-A — mesurer la preuve structurelle (2026-08-19)

**Gel total des règles.** Rien n'a été modifié, ni ne le sera à partir
des erreurs observées. V2-B est en attente, **V2-C est écartée
définitivement** : exiger un co-signal structurel contredirait
DroneHopper, MarineUAS, THRUST et Ampyx — *le financement n'est pas la
taxonomie de la technologie*.

### Métrique descriptive des 162 taxonomic-confirmed

Tous sont désormais revus au moins une fois (102 par le holdout,
60 par l'échantillon des 200) :

| | | |
|---|---|---|
| `core` | 154 | 95,1 % |
| `enabling` | 3 | 1,9 % |
| `excluded` | 5 | 3,1 % |

**Ce n'est pas une validation indépendante.** 60 de ces 162 ont servi à
concevoir les règles ; leur justesse est un artefact de conception.
**Le chiffre hors échantillon reste 94/102 = 92,2 %.** Ces 95,1 % ne
décrivent que la population taguée, ils ne prédisent rien.

### Le tirage — 200 parmi les 1 585 structurels jamais revus

Stratification par les huit règles d'appel. Allocation
proportionnelle au volume réel, plancher de 15 pour les petites
strates, **revue exhaustive** quand la strate est minuscule.

| Strate | Population | n | Taux | Mode |
|---|---|---|---|---|
| `H2020-CS2-` | 543 | 59 | 10,9 % | proportionnelle |
| `SP1-JTI-CS-` | 486 | 53 | 10,9 % | proportionnelle |
| `FP7-AAT-` | 233 | 26 | 11,2 % | proportionnelle |
| `H2020-SESAR-` | 149 | 16 | 10,7 % | proportionnelle |
| `HORIZON-SESAR-` | 116 | 13 | 11,2 % | proportionnelle |
| `HORIZON-JU-Clean-Aviation-` | 40 | 15 | 37,5 % | **plancher** |
| `H2020-IBA-CS2-GAMS-` | 11 | 11 | 100 % | **exhaustive** |
| `JTI-CS-` | 7 | 7 | 100 % | **exhaustive** |
| **Total** | **1 585** | **200** | 12,6 % | |

Tirage **reproductible** — `random.Random(20260819)` sur les
identifiants triés. Aucun chevauchement de préfixe (résolution par le
préfixe le plus long, 0 cas).

### La revue est en aveugle

`docs/curation/a1-v2a-echantillon-structurel.csv` — colonnes
`n, source_id, acronym, meur, titre, resume_court, label_propose,
raison`. **Ni l'appel, ni la strate.** L'ordre des lignes est mélangé
de façon reproductible pour que la provenance ne transparaisse pas non
plus dans la succession.

La correspondance vit dans un fichier séparé,
`a1-v2a-cle-strates-a-ne-pas-ouvrir-avant-revue.csv`, qui porte la
strate, la population et le poids de chaque projet. Il est versionné
pour survivre aux sessions — **le nom est l'avertissement**.

### Comment les propositions ont été produites

- **196 `core`, 4 `a_arbitrer`.** La proposition par défaut est celle
  de la règle chargée.
- Les **21 projets sans aucun vocabulaire aéronautique** dans leur
  texte ont été lus un par un et leur raison est écrite à la main :
  presque tous sont indiscutables à la lecture (aubes de turbomachine,
  buffet transsonique, protection givre d'aile laminaire, impact
  d'oiseau, régulation carburant, lubrification CROR).
- Les **4 `a_arbitrer`** sont ceux dont le texte seul n'établit pas
  l'objet aéronautique : MultiModX (air + rail), HITECA (automobile,
  aérospatial et énergie), ISINTHER (thermoplastiques sans objet
  explicite), COMPOSLEEVE (manchon de moteur électrique).
- Les **26 projets ≥ 20 M€** ont été lus : tous sont des démonstrateurs
  aéronautiques indiscutables — ITD Clean Sky, GAM, démonstrateurs
  Clean Aviation, ATM SESAR. Le plus gros pèse 185 M€.
- Pour les autres, la raison est une **signature de contenu** — les
  termes aéronautiques effectivement présents dans le texte. Elle dit
  ce que le texte porte, elle ne prétend pas à une lecture approfondie.

L'échantillon pèse **1 973 M€**.

### Ce que la mesure fournira, une fois la revue rendue

n et erreurs par strate · précision par strate · **précision
structurelle pondérée par la population réelle** · intervalle de
confiance · **précision globale pondérée de la lentille** (structurel
+ taxonomique combinés) · le sort des projets ≥ 20 M€ et l'impact des
erreurs éventuelles sur les KPI.

### Ce qui ne se fera pas

Aucune règle ne sera modifiée à partir des erreurs observées.
L'échantillon des 430 rejetés, s'il vient, sera une mesure séparée de
**candidate-pool recall** — jamais présentée comme un rappel global.
Aviation reste `draft`.

### Correction du paquet de revue — l'aveugle était incomplet

Le premier fichier livré portait `label_propose` et `raison` : il
**orientait le second lecteur**. Une copie strictement aveugle des
**mêmes 200 lignes** est livrée —
`docs/curation/a1-v2a-revue-aveugle.csv` :

| Colonne | |
|---|---|
| `review_id` | 1 à 200, dans l'ordre mélangé reproductible |
| `source_id`, `acronym`, `titre` | l'identité |
| `resume_complet` | **le résumé ENTIER** — médiane 1 821 caractères, max 2 797 |
| `mon_label`, `note` | vides, à remplir |

Rien d'autre. Ni proposition, ni raison, ni appel, ni strate, ni
population, ni montant, ni indicateur de doute ou d'absence de
vocabulaire — **aucune trace de la première lecture**.

Mes propositions restent dans
`a1-v2a-echantillon-structurel.csv` : elles serviront à la
confrontation à trois, après les deux revues aveugles. La clé des
strates reste versionnée pour la reproductibilité, hors du paquet de
revue.

**Le tirage est gelé** : les 200 restent exactement ceux-là, ni ajout
ni retrait.

### Le protocole de mesure, arrêté d'avance

1. **Réassociation** par la clé des strates.
2. **Précision par strate** : n, erreurs, taux.
3. **Précision structurelle pondérée** par les populations réelles,
   `w = N/n` par strate.
4. **Variance et intervalle stratifiés**, avec **correction de
   population finie**. Les deux strates exhaustives —
   `H2020-IBA-CS2-GAMS-` 11/11 et `JTI-CS-` 7/7 — ont une **incertitude
   d'échantillonnage nulle** : leur `1 − n/N` vaut zéro, elles ne
   contribuent pas à la variance.
5. **Précision globale pondérée de la lentille**, structurel et
   taxonomique combinés.
6. **Croisement labels × montants**, avec **contrôle de tous les
   ≥ 20 M€ hors échantillonnage**.

### Le recensement des ≥ 20 M€, dimensionné

| | Projets | |
|---|---|---|
| ≥ 20 M€ dans la lentille | **63** | dont 62 structurels, 1 taxonomique |
| déjà dans les 200 tirés | 26 | |
| **à contrôler hors échantillonnage** | **37** | 36 structurels + 1 taxonomique |

**Ces 63 projets portent 3,423 Md€ — 54,3 % du financement de la
lentille.** C'est la raison même du recensement : l'échantillonnage
mesure la précision *par projet*, il ne protège pas le KPI en euros,
que la moitié de la masse concentre sur soixante lignes.

Aucune règle ne bouge pendant la revue.
