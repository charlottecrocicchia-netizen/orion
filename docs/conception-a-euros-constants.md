# Conception A — Euros constants

> Document de conception instruit le 2026-08-22. Mandat : **méthode et
> audit chiffré uniquement, aucun code, aucune modification du
> corpus**. Les mesures ont été prises sur la base locale de recette
> (corpus complet restauré du dump prod du 21 août 2026 — l'état de
> référence, prod figée), en lecture seule, requêtes rejouables en
> annexe. **Statut : méthode validée le 2026-08-22, arbitrages A1-A3
> rendus (§ 4), taxonomie des grandeurs corrigée (§ 2.7) ; plan
> d'implémentation V1 (§ 5) amendé le 2026-08-22 — millésime dans
> l'URL (`moneyYear`), horizon temporel nominal conservé sur les
> séries — et **GO code accordé** ; arrêt pour recette locale avant
> tout push.**
>
> **Amendement R1 (2026-08-23)** — le chantier R0
> (`docs/conception-reference-engine.md`, validé GO R1) supersède la
> grammaire de ce plan **avant toute publication** : le mode s'écrit
> `value=real&base=<année>&cur=<devise>` (§ D10 de R0), côté URL comme
> côté API, avec devise d'affichage EUR/USD. `money`/`moneyYear`
> n'a jamais été public et n'existe pas sur `main` : les mentions de
> cette grammaire ci-dessous (§ 5 notamment) décrivent le plan
> historique du 2026-08-22, pas le produit. La méthode (§ 2), les
> arbitrages A1-A3 (§ 4) et l'audit (§ 1) restent la référence du
> mode `real`.

## 0. Licences des sources (porte d'entrée)

| Source | Série | Licence | Verdict |
|---|---|---|---|
| Eurostat | HICP annuel `prc_hicp_aind` (zone euro, tous articles) | CC-BY 4.0 (politique de réutilisation Eurostat) | **admise** — attribution affichée dans la méthodologie |
| BLS (É.-U.) | CPI-U `CUUR0000SA0` (all items, US city average, moyennes annuelles) | domaine public (production fédérale américaine) | **admise** |
| BCE | taux de change annuels — **déjà en base** (`exchange_rates` : 9 devises, 2004-2025) | politique de réutilisation BCE, attribution | **admise** (déjà utilisée par la convention ④) |

Aucune source share-alike, aucune zone grise : conforme à la règle de
licence de l'audit. Le taux BCE de l'année de référence (2025) est
déjà présent en base.

## 1. Audit chiffré du corpus (mesuré le 2026-08-22)

Corpus : **699 798 projets**, **1 102 270 participations**.

### 1.1 Monnaies présentes — exactement deux

| Devise | Projets | Montant natif | Converti EUR (④) | Sans EUR nominal |
|---|---:|---:|---:|---:|
| USD | 615 346 | 882,02 Md$ | 558,03 Md€ | 60 191 |
| EUR | 84 452 | 176,42 Md€ | 176,42 Md€ | 0 |

Valeur nominale EUR totale du corpus : **734,45 Md€**. Aucune
troisième devise : le traitement « autres devises » est une règle
gravée (§ 2.3), pas un cas réel aujourd'hui.

### 1.2 Couverture temporelle et bords

- Fenêtre des dates de début : **1965 → 2027**.
- **Sans `start_date`** : 25 346 projets — mais seulement
  **0,02 Md€** de valeur EUR nominale (essentiellement de vieux
  dossiers NIH sans montant converti).
- **Avant 2004** : 33 011 projets, dont **zéro** avec un montant EUR
  nominal (la conversion ④ commence avec les taux BCE de 2004 ;
  32 860 portent un montant natif USD). Le bord bas du périmètre
  monétaire EUR existant est donc déjà 2004.
- **2026-2027** (années postérieures à la dernière année d'indice
  complète) : 8 561 projets en 2026 (11,29 Md€) + 859 en 2027
  (0,90 Md€) = **9 420 projets, 12,19 Md€** (1,7 % de la valeur).
- Premier projet libellé en EUR : **2007** (FP7). Le HICP annuel
  existe depuis 1996 → **couverture 100 % du périmètre EUR**. Le
  CPI-U couvre toutes les années du corpus (série publiée depuis
  1913) → **couverture 100 % du périmètre USD**.

### 1.3 Part ajustable par source (date présente ET montant EUR nominal)

| Source | Projets | Ajustables | % projets | Valeur ajustable | Valeur totale |
|---|---:|---:|---:|---:|---:|
| nih | 380 275 | 309 126 | 81,3 % | 439,26 Md€ | 439,26 Md€ |
| nsf | 235 071 | 230 659 | 98,1 % | 118,77 Md€ | 118,77 Md€ |
| cordis-h2020 | 35 389 | 35 377 | 100,0 % | 68,33 Md€ | 68,33 Md€ |
| cordis-horizon | 23 278 | 23 278 | 100,0 % | 62,05 Md€ | 62,05 Md€ |
| cordis-fp7 | 25 785 | 25 666 | 99,5 % | 46,02 Md€ | 46,04 Md€ |

Lecture honnête : les 18,7 % de projets NIH « non ajustables » sont
les dossiers anciens ou sans date **qui n'ont déjà pas de montant EUR
nominal** — en **valeur**, la quasi-totalité (99,997 %) de la valeur
EUR du corpus porte une date et est donc déflatable. En retirant les
9 420 projets 2026-2027 (si l'arbitrage A1 les exclut), le périmètre
pleinement ajustable avec un indice publié représente
**≈ 722 Md€, soit 98,3 % de la valeur EUR nominale**.

### 1.4 Participations et coût total

- **Participations** : 1 102 270 lignes, 985 849 avec montant EUR
  (`amount_eur`, 732,54 Md€) ; **89,4 %** des lignes sont ajustables
  (montant EUR + projet daté). La même mécanique de facteur
  (devise × année de début du projet) s'applique sans cas spécial.
- **`total_cost`** : 84 451 projets (CORDIS uniquement), 211,77 Md€,
  **exclusivement en EUR** ; 130 sans date. Constat de schéma : il
  n'existe **pas** de colonne `total_cost_eur` — la grandeur est
  native EUR, elle se déflate directement par le HICP.

### 1.5 Cas impossibles ou approximatifs (synthèse)

| Cas | Volume | Valeur EUR | Nature |
|---|---:|---:|---|
| Sans date de début | 25 346 projets | 0,02 Md€ | **impossible** — pas d'année de rattachement |
| Avant 2004 | 33 011 projets | 0 (aucun EUR nominal) | **hors périmètre** — arbitrage A2 rendu : pas d'extension V1 |
| 2026-2027 | 9 420 projets | 12,19 Md€ | **exclus du constant** — arbitrage A1 rendu : indice non publié, entrée automatique dès publication |
| Devise sans indice admis | 0 projet | 0 | règle gravée § 2.3, ensemble vide aujourd'hui |
| Pluriannuels à montant unique | structurel (durées 3-5 ans) | — | **approximation assumée** du rattachement à l'année de début, § 2.6 |

## 2. La méthode — les douze points

### 2.1 Année de référence

**2025** — la **dernière année civile complète publiée dans la
vintage courante** des indices annuels (HICP, CPI-U), avec le taux
BCE annuel en base. *Déjà arbitré.* Les indices officiels restent
révisables — aucune valeur n'est « définitive » ; le versionnement
par vintage (§ 2.11) est la doctrine.

- Une **constante de configuration unique** (pas une valeur dispersée
  dans le code ou les données).
- **Bascule vers 2026** (début 2027) : changement de la constante,
  zéro migration, zéro recalcul stocké — rien n'est matérialisé
  (§ 2.10), les facteurs se recalculent à la lecture.
- **Condition de validité nommée** : la bascule est refusée si l'année
  candidate n'a pas ses trois données (HICP annuel, CPI-U annuel, taux
  BCE annuel) présentes et complètes en base.

### 2.2 Source d'inflation officielle

*Déjà arbitré* : **HICP Eurostat** pour les montants EUR, **CPI-U
BLS** pour les montants USD (licences § 0).

- Indices **annuels moyens**, « tous articles » : l'objectif est la
  comparabilité temporelle du pouvoir d'achat général, pas une
  économétrie sectorielle. Il n'existe pas de déflateur R&D officiel
  homogène UE/US sous licence admissible — on ne l'invente pas.
- **Méthode mensuelle — documentée, non choisie** : rattacher chaque
  montant au mois de `start_date` et utiliser les indices mensuels
  (`prc_hicp_midx`, CPI-U mensuel) donnerait une **précision
  artificielle** tant que le corpus ne contient pas les tranches
  réelles de versement (§ 2.6). La méthode annuelle est retenue en
  V1. Condition de renversement : si un jour le rattachement devient
  infra-annuel par nature (des tranches de versement réelles).

### 2.3 Traitement des devises

Règle gravée, vérifiable : **une grandeur monétaire n'est ajustable
que si** ① sa devise dispose d'un indice de prix officiel sous licence
admise, ② l'année de rattachement dispose d'une valeur d'indice
publiée, ③ le taux BCE de l'année de référence existe pour cette
devise. À défaut d'une seule des trois conditions : la grandeur reste
**nominale, affichée comme telle, comptée dans la part « non
ajustée »** — jamais approximée en silence.

Corpus mesuré : exactement **EUR et USD** (§ 1.1), toutes deux
pleinement couvertes. La règle existe pour que l'arrivée d'une
troisième devise soit un cas prévu, pas un incident.

### 2.4 Ordre exact des transformations

*Méthode OCDE/CAD, déjà arbitrée.* Pour un montant natif `M` en devise
`d`, rattaché à l'année `a`, avec `R = 2025` l'année de référence :

```
M_constant_EUR(R) = M × [ Indice_d(R) / Indice_d(a) ] × Taux_BCE_d→EUR(R)
```

① **Déflater d'abord, dans la monnaie d'origine**, avec l'indice de
sa zone (CPI-U pour un montant USD, HICP pour un montant EUR) ;
② **convertir ensuite** en euros, au taux BCE **de la seule année de
référence** (pour l'EUR, le taux vaut 1).

**Justification** : l'inflation est un phénomène propre à chaque zone
monétaire — un dollar de 2010 se compare à un dollar de 2025 par
l'indice des prix *américain*. Convertir d'abord puis déflater par le
HICP appliquerait l'inflation de la zone euro à des dépenses
américaines, et surtout incorporerait les fluctuations historiques du
change EUR/USD dans ce qui prétend être une correction d'inflation.
Dans l'ordre retenu, le change n'intervient qu'une fois, à un taux
unique : tous les montants s'expriment dans la même unité — « euros
de 2025 » — et les évolutions d'une série n'ont plus qu'une seule
cause possible, la variation réelle.

**Conséquence structurante** : pour les projets USD, l'entrée du
calcul constant est le montant **natif** (`funding_amount`), pas la
colonne convertie `funding_amount_eur`. Les deux chaînes coexistent
sans se toucher :

| Chaîne | Entrée | Taux de change | Statut |
|---|---|---|---|
| **B** — nominal EUR dérivé (existante, convention ④) | montant natif (**A**) | taux BCE de **l'année de début** | dérivée figée, **intouchée par ce chantier** |
| **C** — EUR constant 2025 (nouvelle, analyse Orion) | montant natif (**A**) | taux BCE de **l'année de référence** | calcul à la lecture, étiqueté |

(les lettres renvoient à la taxonomie des grandeurs, § 2.7)

### 2.5 Date de rattachement à l'indice

**L'année civile de `start_date`.**

- C'est la seule date de rattachement disponible sur la quasi-totalité
  du périmètre monétaire (§ 1.2) ;
- c'est **déjà la convention monétaire d'Orion** : la conversion
  nominale ④ utilise le taux de l'année de début. Un seul « quand »
  pour tout le monétaire — deux conventions temporelles divergentes
  (une pour convertir, une pour déflater) seraient inexplicables.

Écartés, avec motifs : la **date de signature** (absente du corpus) ;
l'**année de l'appel** (absente hors CORDIS récent, pont partiel —
E2 l'a mesuré) ; le **point médian du projet** (précision illusoire :
il suppose un profil de dépense qu'on ne connaît pas, § 2.6).

### 2.6 Pluriannuels à montant total unique

**V1 : le montant total est rattaché en bloc à l'année de début** —
cohérent avec ④, honnête tant qu'on l'affiche : la méthodologie dit
*« montants exprimés en euros constants de 2025, rattachés à l'année
de démarrage du projet »*.

L'**étalement annuel** (répartir le montant sur la durée puis déflater
année par année) est documenté comme raffinement possible et **non
choisi** : le corpus ne porte aucun profil réel de versement, et une
répartition uniforme serait une invention présentée comme une
précision. Condition de renversement nommée : une source fournissant
les tranches annuelles réelles.

### 2.7 Taxonomie des grandeurs monétaires — trois natures distinctes

| Niveau | Colonnes | Nature | Règle |
|---|---|---|---|
| **A — Nominal natif observé** | `funding_amount`, `amount`, `total_cost` | donnée observée à la source | jamais modifiée, jamais réécrite |
| **B — Nominal EUR dérivé** (convention ④) | `funding_amount_eur`, `amount_eur` | **dérivée** du natif au taux BCE de l'année de début | figée, intouchée par ce chantier — mais ce n'est **pas** une donnée observée |
| **C — EUR constant** (analyse Orion) | aucune colonne | natif × indice(réf)/indice(année de début) × taux BCE devise→EUR(réf) | calculée à la lecture, **toujours étiquetée** (« EUR constants 2025 »), jamais stockée dans les tables de données |

Les trois natures restent distinguées **dans le code, l'API, la
méthodologie et l'UI** — aucun libellé, champ ou variable ne
présente B comme une donnée observée ni C comme un nominal.
Doctrine E1 étendue : donnée officielle ≠ classification Orion ≠
analyse Orion — les euros constants sont une **analyse Orion**
(méthode publiée, indices cités et versionnés, chiffre
reconstruisible) et se présentent comme telle sur chaque surface.

### 2.8 Données manquantes et bords

Conventions par cas (mesures § 1.5) :

- **Sans date** : non ajustable — nominal affiché, ligne comptée dans
  la part « non ajustée ». Tout agrégat en euros constants expose sa
  part non ajustée ; **jamais de silence**.
- **Avant 2004** : déjà hors du périmètre EUR nominal (0 montant
  converti). *Arbitrage A2 rendu* : **pas d'extension en V1**, même
  si la chaîne constante pourrait techniquement les couvrir. Règle
  gravée : **EUR constant ⊂ périmètre disposant déjà d'un nominal
  EUR Orion** — aucun montant constant n'apparaît là où Orion ne
  possède aucun nominal EUR. L'extension pré-2004 reste un chantier
  séparé si un besoin produit apparaît.
- **2026-2027** : l'indice de leur année n'est pas publié. *Arbitrage
  A1 rendu* : **exclusion du calcul constant** — pas de facteur
  artificiel 1,0 ; un montant 2027 ne peut pas être présenté comme
  « EUR constants 2025 » tant que l'indice 2027 n'existe pas. Ces
  projets restent pleinement disponibles en nominal et **entrent
  automatiquement** dans le périmètre ajustable dès la publication de
  l'indice de leur année (une nouvelle vintage suffit, aucun code à
  changer). **Obligation d'affichage** : en mode constant, tout KPI
  ou agrégat dont le périmètre diffère du nominal à cause de cette
  exclusion le DIT au point d'affichage — les 12,19 Md€ ne
  « disparaissent » jamais en silence ; l'information est **calculée
  depuis le périmètre affiché** (filtres compris), jamais codée en
  dur (§ 5, étape 10).
- **Devise sans indice** : règle § 2.3, ensemble vide aujourd'hui.
- **Révision d'un indice** : les indices officiels sont révisables ;
  chaque valeur est stockée avec sa **vintage** (date de publication),
  le calcul suit la dernière vintage, l'historique est conservé
  (§ 2.11).

### 2.9 Impact par surface

- **KPI et totaux (Explorateur)** : bascule nominal ⇄ constant ;
  l'unité affichée change explicitement (« M€ » → « M€ constants
  2025 »). Le mode est un **paramètre d'URL** (URL = vue, un
  Explorateur cadré en constant se partage et se rejoue).
- **Séries temporelles — le gain principal** : les évolutions
  annuelles deviennent des évolutions réelles ; c'est la raison
  d'être du chantier.
- **Fiches organisations / programmes** : les agrégats matérialisés
  existants (`organisation_stats`…) restent **nominaux** ; les
  surfaces qui offrent le constant le calculent depuis les lignes
  datées, par la même jointure de facteurs.
- **Exports** : une colonne **supplémentaire** clairement nommée
  (`funding_eur_constant_2025`), jamais en remplacement du nominal.
- **Decks** : toute planche affichant du constant porte la mention
  méthodologique (année de référence, sources d'indices).
- *Arbitrage A3 rendu* : **surfaces V1 = Explorateur uniquement**
  (KPI + séries temporelles). **Nominal par défaut partout** ; la
  bascule constante est explicite, persistée dans l'URL, partageable
  et rejouable, **jamais activée silencieusement**. Fiches
  organisations, programmes, decks et exports : **hors V1** (aucune
  nécessité technique identifiée au plan § 5 — les points exports et
  decks ci-dessus décrivent la doctrine pour les lots suivants).
- **Obligation d'affichage de l'exclusion** (A1, § 2.8) : quand le
  mode constant est actif, la part exclue du périmètre affiché est
  annoncée au point d'affichage, chiffres dynamiques (§ 5, étape 10).

### 2.10 Stockage : à la volée, pas de colonnes matérialisées

- **Nouvelle table `price_indices`** (source, code de série, zone
  monétaire, année, valeur, vintage) — quelques centaines de lignes.
- **Calcul à la volée** : le facteur par (devise, année) est une
  table dérivée minuscule (2 devises × ~60 ans) ; la jointure est de
  coût négligeable à l'échelle du corpus.
- **Aucune colonne matérialisée** sur `projects` ni `participations` :
  1,8 million de lignes à réécrire à chaque changement d'année de
  référence ou révision d'indice, c'est installer une écriture massive
  récurrente juste à côté des colonnes dont l'invariant est « les
  nominaux ne bougent jamais » — le contraire de la prudence.
- Si la performance l'exige un jour : une **vue matérialisée dédiée**
  (le modèle `organisation_stats` existe), jamais des colonnes dans
  les tables de données observées.

### 2.11 Versionnement et recalcul

- L'année de référence est une constante de configuration : en
  changer est un déploiement de configuration, **zéro migration, zéro
  recalcul stocké** — rien n'étant matérialisé, il n'y a rien à
  recalculer ni à versionner côté corpus.
- Les **indices sont versionnés par vintage** : une révision ajoute
  une ligne, ne détruit rien ; la méthodologie affiche la vintage
  utilisée.
- **Rejouabilité totale** : méthode publiée + indices en vintage +
  taux BCE en base ⇒ tout chiffre constant est reconstruisible à la
  main, conformément au principe « chiffre explicable ».

### 2.12 Tests et invariants

- **Invariant sacré — les nominaux ne bougent jamais** : un test fige
  les invariants au chiffre près avant/après le chantier (699 798
  projets ; 882,02 Md$ natifs USD ; 176,42 Md€ EUR ; 1 102 270
  participations) et vérifie que les colonnes observées sont
  identiques octet pour octet dans l'API.
- **Facteur(année de référence) = 1,000 exactement** : un montant EUR
  de 2025 vaut son nominal, au centime.
- **Test-or EUR 2025** : pour un montant EUR rattaché à 2025,
  `constant EUR 2025 = nominal EUR` **exactement**, facteur `1.000…`.
- **Test-or USD 2025** : pour un montant USD rattaché à 2025,
  `constant EUR 2025 = nominal EUR convention ④` dès lors que les
  deux chaînes lisent le même taux BCE annuel 2025 — ce test attrape
  notamment un taux de change inversé, un mauvais millésime BCE, un
  mauvais indice CPI et un mauvais ordre de transformation.
- **Étalonnage historique** : quelques conversions calculées à la
  main depuis les indices publiés (p. ex. 100 USD de 2010 → X € de
  2025), écrites en dur dans les tests.
- **Santé des indices** : facteurs strictement positifs, années
  continues sur le périmètre, refus de bascule d'année de référence
  si la condition de validité (§ 2.1) échoue.
- **Cas limites** : sans date → constant absent + part non ajustée
  incrémentée ; 2026-2027 → exclus (A1), part exclue exposée avec ses
  chiffres ; devise inconnue → refus propre.
- **Parité i18n** des libellés méthodologiques EN/FR (filet
  `i18n-parity` existant).

## 3. Ce qu'on ne construit pas (V1)

- Pas de déflateur sectoriel R&D (inexistant sous licence admise) ;
- pas d'étalement annuel inventé (§ 2.6) ;
- pas de méthode mensuelle (§ 2.2) ;
- pas de colonnes matérialisées ni de réécriture de la chaîne ④ ;
- pas d'extension pré-2004 (A2 rendu — chantier séparé si un besoin
  produit apparaît) ;
- pas de gestion spéculative de devises absentes du corpus ;
- pas d'euros constants sur des montants sans date — jamais ;
- pas de facteur artificiel 1,0 pour une année sans indice publié —
  jamais (A1).

## 4. Arbitrages rendus (2026-08-22)

- **A1 — Projets 2026-2027 (9 420 projets, 12,19 Md€)** :
  **exclusion** du calcul constant tant que l'indice de leur année
  n'est pas publié. Pas de facteur artificiel 1,0. Nominal toujours
  disponible ; entrée **automatique** dans le périmètre ajustable dès
  publication de l'indice (nouvelle vintage). **Obligation
  d'affichage** de l'exclusion au point d'affichage, chiffres
  calculés depuis le périmètre affiché, jamais codés en dur
  (§ 2.8, § 5 étape 10).
- **A2 — Pré-2004 USD** : **pas d'extension en V1**. Règle gravée :
  EUR constant ⊂ périmètre disposant déjà d'un nominal EUR Orion —
  aucun nouveau montant constant là où Orion ne possède aucun
  nominal EUR. Chantier séparé si un besoin produit apparaît.
- **A3 — Comportement produit V1** : **nominal par défaut partout** ;
  bascule explicite, persistée dans l'URL, partageable et rejouable,
  jamais activée silencieusement. **Surfaces V1 : Explorateur
  uniquement** (KPI + séries temporelles) ; fiches organisations,
  programmes, decks et exports hors V1.
- **Méthode d'ensemble (§ 2) : validée.** Prochaine porte : **GO
  explicite sur le plan § 5** avant toute ligne de code.

## 5. Plan d'implémentation V1 (soumis — aucun code avant GO)

Découpage en quatre lots livrables séparément (commits distincts) :
**lot 1** données (étapes 1-3), **lot 2** calcul et API (4-7, 12-13),
**lot 3** surface Explorateur (8-11), **lot 4** filets et recette
(14-16). Chaque étape : fichiers, nouveau, hors V1, risques,
critères de recette.

### Étape 1 — Schéma `price_indices` (migration 0032)

- **Fichiers** : `backend/src/orion/models/reference.py` (nouveau
  modèle `PriceIndex`, à côté d'`ExchangeRate`),
  `backend/alembic/versions/0032_price_indices.py`.
- **Schéma exact** : `id` PK ; `currency` varchar(3) (`EUR` → HICP,
  `USD` → CPI-U) ; `year` int ; `value` numeric(10,4) (moyenne
  annuelle dans la base officielle de la série — 2015=100 pour HICP,
  1982-84=100 pour CPI-U ; la base n'importe pas, seuls les ratios
  comptent) ; `series_source` varchar(20) (`eurostat` | `bls`) ;
  `series_code` varchar(40) (`prc_hicp_aind` | `CUUR0000SA0`) ;
  `vintage_date` date (identifiant du jeu chargé) ; `imported_at`
  timestamptz. Contrainte UNIQUE `(currency, year, vintage_date)` ;
  index `(currency, vintage_date)`. Lecture applicative : **dernière
  vintage complète par devise**.
- **Nouveau** : une table. **Aucune table existante modifiée** —
  la migration ne touche ni `projects` ni `participations`.
- **Hors V1** : indices mensuels, autres devises, purge de vintages.
- **Risques** : néant (table neuve).
- **Recette** : `alembic upgrade head` puis `downgrade -1` propres en
  local ; les invariants nominaux (§ 5, étape 16) inchangés.

### Étape 2 — Chargement et versionnement des indices

- **Fichiers** : nouveau paquet
  `backend/src/orion/ingest/prices/{__init__,eurostat,bls,load}.py` ;
  commande `orion-ingest price-indices` (même mécanique CLI
  qu'`orion-ingest calls`).
- **Sources** : Eurostat API de dissémination JSON-stat, dataset
  `prc_hicp_aind` (annual average index, `coicop=CP00`, `geo=EA`) ;
  BLS Public Data API v2, série `CUUR0000SA0` avec
  `annualaverage=true` (la moyenne annuelle publiée, période M13).
  Attribution des deux sources affichée dans la méthodologie (§ 0).
- **Versionnement** : chaque exécution récupère le jeu complet et ne
  crée une **nouvelle vintage** que si les valeurs diffèrent de la
  vintage courante — idempotent, **jamais d'UPDATE** d'une vintage
  existante. Validation au chargement : valeurs > 0, années
  contiguës, couverture minimale du périmètre (EUR ≥ 2007,
  USD ≥ 2004) — sinon refus, la vintage courante reste en service.
- **Nouveau** : le paquet, la commande, le runbook (geste annuel
  manuel documenté dans `docs/hebergement.md`).
- **Hors V1** : job scheduler (cadence annuelle = geste manuel),
  indices mensuels.
- **Risques** : formats d'API (parsing strict + refus propre) ;
  indisponibilité réseau (échec sans effet, vintage courante
  conservée).
- **Recette** : premier run → table peuplée (EUR 1996-2025,
  USD ≥ 1965) ; second run immédiat → **aucune** nouvelle vintage.

### Étape 3 — Configuration de l'année de référence

- **Fichiers** : `backend/src/orion/core/config.py` —
  `constant_euro_reference_year: int = 2025`
  (env `ORION_CONSTANT_EURO_REFERENCE_YEAR`).
- **Condition de validité (§ 2.1), appliquée à l'usage** : l'app
  démarre toujours (le nominal ne dépend pas des indices) ; si
  HICP(réf), CPI-U(réf) ou taux BCE USD(réf) manquent, le **mode
  constant est indisponible** et l'API le dit explicitement
  (étape 12). Bascule 2026 = changement d'env, zéro migration.
- La condition de validité s'applique à **l'année demandée par la
  vue** (`moneyYear`, étape 8), pas seulement à l'année courante :
  une URL 2025 reste calculable après la bascule 2026 tant que les
  indices et le taux 2025 sont en base — ils y restent (vintages).
- **Risques** : néant.
- **Recette** : env à 2026 sans indices 2026 → mode constant refusé
  proprement, nominal intact ; retour à 2025 → mode constant revient.

### Étape 4 — Fonction unique du facteur

- **Fichiers** : nouveau `backend/src/orion/constanteuro.py` — la
  **source unique** (précédent : `callstatus.py` pour les statuts).
- **Contenu** : `factors(session) -> dict[(devise, année), Decimal]`
  construit la table complète des facteurs depuis la dernière vintage
  et le taux BCE de l'année de référence :
  `facteur = indice(réf)/indice(année) × taux_BCE devise→EUR(réf)`.
  Absence du dictionnaire = non ajustable (année sans indice — dont
  2026-2027 —, devise non couverte). Mémoïsation par (vintage, année
  de référence), invalidée comme les caches existants. Le SQL reçoit
  ce dictionnaire en table `VALUES` jointe : **Python et SQL
  partagent la même source**, aucune formule dupliquée. Tout le
  calcul en `NUMERIC`/`Decimal` — **l'agrégation précède l'arrondi**,
  l'arrondi n'existe qu'à la présentation.
- **Hors V1** : facteur exposé par un endpoint public dédié.
- **Risques** : néant isolément — tout se joue aux tests-or.
- **Recette** : tests unitaires de l'étape 14 verts.

### Étape 5 — Traitement des non ajustables

- **Règle en un seul endroit** : une ligne sans facteur (pas de
  `start_date`, année hors indice, devise non couverte) est exclue de
  la somme constante et comptée dans `excluded` avec sa valeur
  **nominale EUR** et son motif : `no_index_year` | `no_date` |
  `no_currency_index`. Jamais de valeur approchée, jamais de silence.
- **Fichiers** : `constanteuro.py` (classification),
  `search/explore.py` (calcul dans la même requête, étape 6).
- **Recette** : corpus de test semé couvrant les trois motifs,
  ventilation exacte dans la réponse API.

### Étapes 6-7 — KPI constants et séries temporelles

- **Fichiers** : `backend/src/orion/search/explore.py` — aujourd'hui
  `_METRIC_COLS` définit `funding = sum(p.funding_amount_eur)` (grain
  projet) et `sum(pa.amount_eur)` (grain participation, y compris les
  variantes pondérées `* cmp.weight` et poids de subdivision).
- **Mode constant** : seule la définition de la colonne `funding`
  change — `sum(<natif> * f.factor)` avec un JOIN sur la table de
  facteurs en `VALUES` (étape 4) : grain projet →
  `(p.funding_currency, extract(year FROM p.start_date))` ; grain
  participation → `(pa.currency, année de début du projet)`. Les
  pondérations existantes se composent inchangées ; les métriques non
  monétaires (`projects`, `organisations`, `coordination`) sont
  identiques dans les deux modes. La **composition des vues n'est pas
  touchée**.
- **Part exclue dans la même requête** : `sum(nominal EUR) FILTER
  (WHERE f.factor IS NULL)` + comptes + ventilation par motif — mêmes
  filtres, même grain : « calculée depuis le périmètre affiché »
  par construction.
- **Séries** : `by=year` sort déjà groupé par année — le facteur
  s'applique par groupe ; une année sans indice n'émet **aucun point
  constant** (pas de zéro mensonger), mais **l'axe conserve
  l'horizon temporel nominal complet** — les années exclues restent
  visibles comme indisponibles (étape 10).
- **Hors V1** : `search/aggregates.py` (stats globales, hubs pays /
  programme / organisation), `search/service.py` (recherche),
  `analytics` — restent nominaux.
- **Risques** : la matrice de vues composées (by × metric × grain ×
  poids) — mitigé : un seul point de définition de la colonne
  `funding` + un JOIN ; le mode nominal passe par le chemin actuel
  **inchangé** (aucun JOIN ajouté quand `money=nominal`).
- **Recette** : nominal strictement identique octet pour octet
  (étape 16) ; un agrégat constant simple reconstruit à la main.

### Étape 8 — Paramètre URL de la bascule

- **Grammaire canonique** : `money=constant&moneyYear=2025` —
  l'URL porte le mode **et son millésime**. Absence de `money` =
  nominal. Frontend : `frontend/src/pages/explorer.tsx`, même
  mécanique d'état d'URL que les filtres existants.
- **L'année de référence est dans l'URL — non négociable.** L'UI V1
  n'expose que l'année de référence courante et l'écrit
  **automatiquement** dans l'URL : toute URL produite par Orion en
  mode constant porte explicitement son millésime. En **lecture**,
  un `moneyYear` absent est toléré avec défaut = année de référence
  courante.
- **Doctrine URL = vue** : un lien, un dossier gardé ou une vue
  sauvegardée en 2025 continuent de représenter des **EUR constants
  2025** après le passage d'Orion à 2026 — les indices et le taux
  2025 restent en base (vintages), le calcul reste rejouable
  (étape 3).
- **`meta.money`** porte les vintages HICP/CPI-U et les métadonnées
  méthodologiques ; **l'unité monétaire de la vue appartient à
  l'URL**.
- **Recette** : e2e — bascule → URL avec `moneyYear`, rechargement →
  mode et millésime restaurés.

### Étape 9 — Comportement de l'Explorateur

- **Fichiers** : `frontend/src/pages/explorer.tsx`,
  `frontend/src/lib/api.ts` (types `meta.money`/`excluded`),
  `frontend/src/i18n.ts`.
- **Bascule** dans la barre d'outils de l'Explorateur, à côté des
  contrôles de vue : « € nominaux » / « € constants 2025 » — l'année
  vient de `meta.reference_year`, jamais codée en dur.
- **Mode actif** : unités des KPI et de l'axe des séries deviennent
  « M€ constants 2025 » ; ligne d'exclusion (étape 10) ; popover
  méthodologie depuis l'étiquette d'unité (sources, vintage, formule
  en une phrase). Si l'API répond « mode indisponible » (étape 3),
  retour au nominal avec message explicite — jamais un échec muet.
- **Hors V1** : bascule sur les autres pages ; export du constant.
- **Recette** : captures 2 thèmes × 2 langues, desktop/mobile,
  Firefox ; reduced-motion sans effet ajouté.

### Étape 10 — Affichage de la part exclue

- **Placement exact** : une ligne courte **sous le bloc KPI** (le
  point d'affichage des totaux), reprise dans la zone de légende de
  la série temporelle quand des années exclues sont dans la fenêtre
  affichée. Détail dépliable au clic. La ligne n'apparaît pas si
  l'exclusion du périmètre courant est nulle.
- **Comportement** : KPI — les montants constants excluent les
  lignes sans facteur, la ligne annonce combien et pour quel montant
  nominal ; séries — aucune barre/point constant pour les années
  sans indice, mais **l'axe conserve l'horizon nominal complet** :
  2026-2027 restent visibles comme **indisponibles en constant**
  (zone atténuée, hachures ou annotation — traitement sobre proposé
  à la recette). Règle : **absence de chiffre constant ≠ absence de
  l'année ni absence de projets**.
- **Calcul** : chiffres servis par l'API depuis la requête du
  périmètre affiché (étapes 6-7), ventilés par motif — jamais codés
  en dur, réactifs à tous les filtres.
- **Formulation** (clés i18n, étape 11) :
  - FR : « Hors calcul constant : {n} projets ({montant} nominal) » —
    détail : « Indice {année} non publié : {n}, {montant} » ·
    « Date de début manquante : {n}, {montant} ».
  - EN : "Excluded from constant €: {n} projects ({amount} nominal)"
    — detail: "Index for {year} not yet published: {n}, {amount}" ·
    "Missing start date: {n}, {amount}".
- **Recette** : vue non filtrée → ≈ 9 420 projets / 12,2 Md€ ; vue
  filtrée (lentille, pays) → chiffres recalculés dynamiquement.

### Étape 11 — Wording EN/FR

- **Fichiers** : `frontend/src/i18n.ts` — nouveau bloc
  `explorer.money.*` : `toggleNominal`, `toggleConstant` (avec
  `{{year}}`), `unitConstant`, `excludedLine` (pluriels),
  `excludedDetail.noIndex`, `excludedDetail.noDate`, `methodTitle`,
  `methodBody` (sources, `{{vintage}}`), `unavailable` (mode refusé).
- EN 100 % EN, FR 100 % FR — filet `i18n-parity.test.ts` existant ;
  les phrases viennent de l'i18n, l'API ne fournit que des valeurs
  (précédent E3 `min_projects`).
- **Recette** : parité verte ; recette visuelle dans les deux langues.

### Étape 12 — API

- **Fichiers** : `backend/src/orion/api/explore.py`,
  `search/explore.py`, `frontend/src/lib/api.ts`,
  `backend/tests/test_openapi.py`.
- **Contrat** : `GET /explore/aggregate` accepte
  `money=nominal|constant` (défaut `nominal`) et `money_year`
  (défaut : année de référence courante) — la condition de validité
  (étape 3) s'applique à **l'année demandée**. En mode constant, la
  réponse ajoute `meta.money = {mode, reference_year (celle
  réellement utilisée), vintage_date, sources}` et `excluded =
  {projects, amount_eur_nominal, reasons: {no_index_year: {...},
  no_date: {...}}}`. Mode ou année indisponible → erreur explicite
  `422 constant_mode_unavailable` (réservée à l'indisponibilité
  globale du mode pour l'année demandée), jamais un repli silencieux
  vers le nominal côté serveur. **Aucun autre endpoint modifié.**
- **Hors V1** : champs constants sur `/projects/{id}`, exports.
- **Recette** : tests API (étape 14) ; OpenAPI à jour.

### Étape 13 — Performance et requêtes SQL

- Le JOIN de facteurs est une table `VALUES` de ~50-120 lignes ; les
  agrégats parcourent les mêmes lignes avec les mêmes index
  (`ix_projects_start_date`…). La part exclue est un `FILTER` dans la
  même passe — pas de seconde requête.
- Les caches d'agrégats existants prennent `money` + vintage dans
  leur clé (pas de collision nominal/constant).
- **Budget** : zéro régression mesurable en nominal (chemin
  inchangé) ; cible constant ≤ ~1,5× le nominal sur les vues lourdes.
- **Mesuré sur corpus complet (2026-08-22, à froid, hors cache)** :
  `by=year` 2,5 s constant vs 1,3 s nominal (1,9×) ; `by=funder`
  5,1 s vs 0,9 s (~5,9×) — la passe d'exclusion paie ses comptes de
  projets **distincts**. Après le premier appel, le cache d'agrégats
  (clé stamp + vintage) sert les suivants. **Budget dépassé à froid,
  consigné** — déclencheur d'optimisation nommé : si la recette
  produit ressent la latence du premier appel constant d'une vue,
  optimiser la passe d'exclusion (comptes distincts en une
  sous-requête, ou vue matérialisée façon `organisation_stats`) —
  jamais de colonne sur les tables de données.

### Étape 14 — Tests

- **Unitaires** (`backend/tests/test_constant_euro.py`) : test-or
  EUR 2025 (identité exacte, facteur 1.000…) ; test-or USD 2025
  (≡ convention ④ à taux BCE identique — attrape taux inversé,
  mauvais millésime, mauvais indice, mauvais ordre) ; étalonnage
  historique à la main (100 USD de 2010) ; année sans indice →
  absent ; devise inconnue → absent ; condition de validité de la
  bascule ; sélection de la dernière vintage ; motifs d'exclusion.
- **API** (`backend/tests/test_explore_money.py`) : corpus semé
  (EUR/USD × 2010/2025/2026/sans date) → agrégats constants au
  centime, `excluded` exact par motif ; `money` absent → réponse
  **strictement identique** à aujourd'hui (snapshot) ; indices
  absents → `constant_mode_unavailable`.
- **e2e** (`frontend/e2e/explorer-money.spec.ts`) : bascule → URL
  `money=constant`, unités changées, ligne d'exclusion visible et
  chiffrée, rechargement restaure le mode, EN et FR.
- **Recette** : pytest complet + `./scripts/e2e-local.sh`, **journal
  complet et exit code réel** (discipline verdicts).

### Étape 15 — Recette locale

Sur le corpus complet (Orion.app, Firefox), après les suites vertes :
① nominal inchangé au chiffre près (699 798 / 734,45 Md€ / séries
identiques) ; ② bascule constante vue non filtrée → exclusion
**5 478 projets / 12,21 Md€** (5 347 « indice 2026-2027 non publié »
pour 12,19 Md€ + 131 « date manquante » pour 19,3 M€ — l'exclusion ne
compte que les lignes PORTEUSES d'un nominal EUR : parmi les 9 420
démarrages 2026-2027, 5 347 portent un montant ; sur la vue par
année, seuls les motifs d'années apparaissent, les sans-date étant
déjà hors de cette vue en nominal) ; ③ vue filtrée → exclusion
recalculée ; ④ un chiffre constant vérifié à la main contre les
indices publiés ; ⑤ FR/EN, dark/light, mobile, reduced-motion ;
⑥ RAM stable (dossier « 16 Go »). Arrêt avant push pour ta recette.

### Étape 16 — Invariants : les nominaux strictement inchangés

- **Test d'invariance figé** : les quatre comptes sacrés (699 798
  projets ; 882,02 Md$ natifs USD ; 176,42 Md€ EUR ; 1 102 270
  participations) vérifiés avant/après sur la base de recette, plus
  un **snapshot octet pour octet** d'une réponse nominale
  `/explore/aggregate` par vue représentative.
- **Revue de diff** : aucune migration ne touche `projects` /
  `participations` ; aucun UPDATE hors `price_indices` dans le
  nouveau code d'ingestion ; la chaîne ④ (`funding_amount_eur`,
  `amount_eur`) n'est ni recalculée ni resemée.
- Rappel des invariants gravés : calcul à la volée depuis le natif ;
  `price_indices` versionnée par vintage ; année de référence unique
  en configuration ; bascule refusée si HICP, CPI-U ou taux BCE
  manquent ; sans date = non ajustable ; devise non couverte = non
  ajustable ; aucune approximation silencieuse ; EN = 100 % EN,
  FR = 100 % FR.

**Arrêt ici. Aucun code avant GO explicite sur ce plan.**

## Annexe — Requêtes de l'audit (rejouables, lecture seule)

```sql
-- 1. Monnaies
SELECT coalesce(funding_currency,'NULL') AS devise, count(*),
       round(sum(funding_amount)/1e9,2)      AS natif_mds,
       round(sum(funding_amount_eur)/1e9,2)  AS eur_mds,
       count(*) FILTER (WHERE funding_amount IS NOT NULL
                          AND funding_amount_eur IS NULL) AS sans_eur
FROM projects GROUP BY 1;

-- 2. Couverture temporelle et bords
SELECT min(extract(year FROM start_date))::int,
       max(extract(year FROM start_date))::int,
       count(*) FILTER (WHERE start_date IS NULL),
       round(sum(funding_amount_eur) FILTER (WHERE start_date IS NULL)/1e9,2),
       count(*) FILTER (WHERE extract(year FROM start_date) < 2004)
FROM projects;

-- 3. Part ajustable par source
SELECT source, count(*),
       count(*) FILTER (WHERE start_date IS NOT NULL
                          AND funding_amount_eur IS NOT NULL) AS ajustables,
       round(sum(funding_amount_eur) FILTER (WHERE start_date IS NOT NULL)/1e9,2),
       round(sum(funding_amount_eur)/1e9,2)
FROM projects GROUP BY source;

-- 4. Bord haut (>= 2026)
SELECT extract(year FROM start_date)::int, count(*),
       round(sum(funding_amount_eur)/1e9,2)
FROM projects WHERE extract(year FROM start_date) >= 2026 GROUP BY 1;

-- 5. Participations
SELECT count(*),
       count(*) FILTER (WHERE p.amount_eur IS NOT NULL),
       round(100.0*count(*) FILTER (WHERE p.amount_eur IS NOT NULL
                                      AND pr.start_date IS NOT NULL)/count(*),1),
       round(sum(p.amount_eur)/1e9,2)
FROM participations p JOIN projects pr ON pr.id = p.project_id;

-- 6. total_cost (constat : pas de colonne total_cost_eur — natif EUR)
SELECT coalesce(total_cost_currency,'NULL'), count(*),
       round(sum(total_cost)/1e9,2),
       count(*) FILTER (WHERE start_date IS NULL)
FROM projects WHERE total_cost IS NOT NULL GROUP BY 1;
```
