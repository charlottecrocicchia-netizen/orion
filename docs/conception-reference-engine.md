# Conception — Reference Engine (chantier R0)

> **Statut : validé — GO R1** (2026-08-23). Conception de référence du Reference Engine, arbitrée par Charlotte.
> **Amendement R3 (2026-08-24, accepté)** — le % PIB se calcule en **devise commune USD** : `financement_USD_courant(a) / PIB_USD_courant(juridiction, a)`, dénominateur `NY.GDP.MKTP.CD` publié par le WDI. La formule en monnaie locale du § D1 est remplacée : ~200 monnaies de bénéficiaires contre 9 taux BCE l'auraient trouée selon nos taux, et l'agrégat UE n'est PAS publié en LCU. Les deux côtés du ratio suivent des conversions **distinctes** (numérateur : convention FX Orion/BCE ; dénominateur : taux officiels de la Banque mondiale) — jamais présentées comme une identité de change (contrôle sur pièces 2026-08-24 : zone euro et US identiques à 0,000 %, hors euro ≤ 0,34 %). Agrégats pluriannuels figés : % PIB = `100 × Σ financement_USD / Σ PIB_USD` sur les mêmes années valides (intensité pondérée par le PIB) ; par-habitant = `Σ [réel(a)/pop(a)]` (cumul par habitant sur la période). Au point d'usage : « Funding awarded / Montants attribués » — des cohortes d'attribution, jamais une dépense publique annuelle.
> **Amendement R4A (2026-08-25, soumis à arbitrage)** — l'étude PPP est instruite dans `docs/conception-r4-ppp.md` et **remplace** ce qui est écrit ici du mode `ppp` : la formule du § D1 (facteur `PA.NUS.PPP` appliqué à un montant en monnaie locale) est abandonnée au profit du rapport de deux séries publiées, `NY.GDP.MKTP.PP.CD / NY.GDP.MKTP.CD` — la voie en monnaie locale est démontrée impraticable (Orion n'a aucun montant en LCU, le WDI ne publie aucun facteur PPP pour l'agrégat UE, et le couple facteur PPP × taux de change officiel est faux sur toute redénomination monétaire : 843 M€ du corpus faux d'un facteur 2 à 30). L'unité est le **dollar international courant** de l'année de rattachement, et le mode n'existe que sur une vue cadrée sur **une année d'attribution unique** (une somme pluriannuelle mélangerait des dollars internationaux de millésimes différents — effet de profil temporel mesuré jusqu'à 16 points entre pays) : le « constant international $ » est **refusé** (la chaîne reconstructible s'écarte de −11 % à +13 % de la série publiée sous ce nom), donc la grammaire `value=ppp&base=2025` du § D10 devient **`value=ppp`, sans `base` ni `cur`**, et le paramètre « Reference year » du § D6 disparaît pour ce mode. La perspective est **forcée à `recipient`** (le PPP financeur est interdit : 18,96 % du financement CORDIS est reçu hors UE-27), le grain est la **participation**, et la ligne `ppp` de la matrice § D4 se réduit à `by=country|region|organisation|orgtype` sur année unique, dans l'Explorateur seul — la page `/compare`, surface distincte à endpoint propre, reste hors périmètre — absente des séries temporelles, de `by=funder`, de `by=programme` et de `by=subdivision`. TREND continue de reposer sur `real`. Le dénominateur `GDP current US$` incorpore par ailleurs le **DEC alternative conversion factor** du WDI (`PA.NUS.ATLS`) et non un taux de marché — limite nommée au `ⓘ` ; `ATLS` sert à auditer cette convention, jamais à calculer le ratio, l'égalité `ratio = ATLS/PPP` étant fausse là où l'identité du numérateur casse (Inde, Nigeria). Les exclusions partielles sont **trois** — `no_country`, `no_jurisdiction_series`, `no_reference_year` (la juridiction a le couple sur d'autres années, pas sur celle cadrée : 16,9 M€ en 2025) — et les refus de vue **trois** aussi, dont `ppp_reference_unavailable_for_view` quand le périmètre filtré affiché porte de la valeur nominale mais rien de convertible. Verdict : GO R4B à périmètre réduit.
> **Amendement R5A (2026-08-26, corrigé en contre-relecture le même jour, soumis à arbitrage)** — la porte § D12 a été instruite dans `docs/conception-r5-budget-denominators.md`. **Verdict : `GO R5B avec périmètre réduit`** — une seule métrique survit, *Share of NSF award obligations* (obligations annuelles d'awards NSF ÷ série officielle « Award Obligation Amount », réconciliées dans un seuil ±5 % gravé avant calcul), et elle est arbitrée **métrique indépendante, hors Reference Engine** (étude § 19.3) : le sélecteur « View funding as » ne gagne **aucun** mode budgétaire, et le § D12 reste fermé pour ce moteur. Le mode budgétaire global, EC, NIH et GBARD restent NO-GO (conditions d'élargissement chiffrées au § 20.4 de l'étude). L'étude corrige en outre une hypothèse de ce document : Orion n'observe **pas** une seule grandeur mais **deux** — un engagement prévisionnel plafonné et complet à la signature (CORDIS), et un cumul d'obligations déjà constatées qui se remplit exercice après exercice (NIH, NSF : **76 % du corpus en valeur**). Le § D12 porte la formulation corrigée.
> Décision : R1 (Nominal + Real) s'implémente directement sous la grammaire finale `value`/`base`/`cur` — l'ancienne grammaire `money`/`moneyYear` n'est jamais publiée.
> Le moteur A (euros constants, `docs/conception-a-euros-constants.md`) est réutilisé tel que conçu : il devient la première brique (le mode `real`) du système décrit ici.
> Audit des sources et licences réalisé sur pièces officielles le 2026-08-23 (§ D11).

---

## 0. Principe fondateur et périmètre

Orion ne demande pas « dans quelle monnaie veux-tu voir les données ? » mais **« quelle question économique veux-tu poser aux mêmes données ? »**. Chaque mode du Reference Engine est la réponse à une question nommée ; un mode qui ne répond à aucune question sur la vue courante n'apparaît pas.

Orion est mondial. L'Europe est une juridiction très bien documentée parmi d'autres, jamais le socle implicite : rien dans le modèle, la grammaire URL ou l'UI ne suppose que l'UE (ou les États-Unis) est le référentiel naturel. L'objet central est la **juridiction de financement** (§ D2), et CORDIS→EU, NIH/NSF→US ne sont que les deux premières lignes d'une table qui accueillera UKRI→GB, JSPS→JP, NRF→KR, ANR→FR, DFG→DE, ARC→AU sans refonte.

Le motif technique fondateur existe déjà et a fait ses preuves dans le moteur A ; il est **généralisé, pas réinventé** :

1. table de référence versionnée par millésime (append-only, dernière vintage gagne, validation de contiguïté et de couverture avant écriture) ;
2. facteur joint à la requête (`LEFT JOIN (VALUES …)`), jamais de colonne matérialisée sur les tables de données ;
3. condition de validité nommée : si la référence manque, le mode est **refusé proprement** (422), jamais approximé ;
4. part exclue chiffrée depuis le périmètre affiché, dite à l'écran ;
5. le nominal par défaut reste identique octet pour octet — un mode de lecture est toujours une bascule explicite portée par l'URL.

### Décisions clés en une page

| # | Décision |
|---|---|
| D1 | Huit modes, cinq groupes : `nominal`, `real` (VALUE) ; `gdp`, `capita` (ECONOMIC SCALE) ; `ppp` (PURCHASING POWER) ; `index`, `growth` (TREND) ; `fx` (MARKET VALUE). |
| D2 | Table `jurisdictions` (code ISO, `EU` inclus) + table générique `macro_series` (concept × année × millésime), même discipline que `price_indices`. Aucun agrégat maison : l'agrégat UE est une série publiée par la source. |
| D3 | Deux perspectives obligatoirement distinctes : **Funding effort** (effort de financement, juridiction du financeur) et **Received funding intensity** (intensité de financement reçu, juridiction du bénéficiaire). Jamais de label nu « % GDP ». La perspective est forcée par la dimension dans presque tous les cas. |
| D4 | Matrice de pertinence par surface (§ D4) ; un mode sans sens pour la vue courante **n'apparaît pas** — pas d'option grisée. TREND exige un axe temporel ; % PIB exige un dénominateur unique et résolu pour toute la vue. |
| D5 | UI : **un sélecteur de lecture unique** (« View funding as … ▾ ») ouvrant un panneau groupé avec une phrase humaine par mode ; paramètres secondaires révélés après le choix. Livré dès R1 dans sa forme définitive. |
| D10 | Grammaire URL : famille `value=` + paramètres orthogonaux `base`, `cur`, `perspective`. Migration de `money`/`moneyYear` **avant toute publication** (aucune URL publique de A n'existe). |
| D11 | Sources retenues : Eurostat HICP, BLS CPI-U, BCE (déjà ingérées) ; **World Bank WDI en source unique** pour PIB, population, PPP annuels (CC BY 4.0), avec BEA/Eurostat/ONU en contrôle. Exclues : FMI (permission commerciale incertaine), UNESCO UIS (clause ShareAlike), ICP-cycles (label licence non confirmé). OCDE en réserve. |
| D12 | Aucun dénominateur « système de financement » (% GBARD, % budget Horizon/NIH…) avant l'étude de compatibilité cohorte d'engagement ↔ dépense annuelle (porte nommée § D12). |
| D16 | R1 = Nominal + Real + nouvelle grammaire + sélecteur, publication rapide. R2 = Index 100 + croissance (transformation côté client). R3 = juridictions + % PIB + par habitant. R4 = PPP après étude d'agrégation. R5 = dénominateurs système — **étude menée, `GO R5B à périmètre réduit` : une métrique NSF indépendante, hors Reference Engine** (amendement R5A corrigé). |

---

## D1 — Les questions économiques d'Orion

Taxonomie arrêtée : cinq groupes, huit modes. Les identifiants (`nominal`, `real`, …) sont les valeurs URL canoniques, non traduites (§ D10). Les libellés EN/FR sont des clés i18n (parité gardée par `i18n-parity.test.ts`).

Conventions communes à tous les modes :

- l'année d'un montant est l'**année civile de `start_date`** du projet (convention ③ du mémo produit) ;
- la déflation se fait **d'abord dans la devise d'origine**, la conversion ensuite (méthode OCDE/CAD, § 2.4 de la conception A) ;
- un montant sans date, sans devise couverte ou sans référence disponible est **exclu et compté**, jamais approximé (§ D13).

### VALUE — « Combien ? »

#### `nominal` — Nominal

| | |
|---|---|
| Question | Combien a été engagé, aux prix et aux taux de l'époque ? |
| Formule | Montant natif → EUR au taux moyen annuel BCE de l'année de début (convention monétaire ④ existante ; identité pour les montants nativement EUR). |
| Unité | EUR (« EUR · at award time »). |
| Limites | Additionner des euros de 2007 et de 2025 mélange des pouvoirs d'achat différents ; pour les montants USD, le taux de l'année d'origine injecte du bruit de change dans les séries. |
| Pertinent | Défaut universel ; montants contractuels, communication factuelle, rapprochement avec les sources. |
| Trompeur | Comparaisons de trajectoires longues ; comparaisons de croissance entre juridictions. |

#### `real` — Real value · Valeur réelle

| | |
|---|---|
| Question | Combien cela représente-t-il une fois l'évolution des prix retirée ? |
| Formule | `natif × [indice_devise(R) / indice_devise(a)] / taux_BCE_devise(R)` — chaîne C de la taxonomie A/B/C (§ 2.7 conception A), calculée par `constanteuro.factor_set()`. Trois paramètres **séparés** : référentiel économique (l'indice de prix de la devise d'origine : HICP zone euro, CPI-U…), année de référence `R`, devise d'affichage. |
| Devise d'affichage | Ré-expression finale au seul taux BCE de l'année `R` : `Real 2025 · USD = Real 2025 · EUR × taux_USD/EUR(2025)`. Un facteur constant unique → **même réalité économique dans deux unités**. |
| Unité | « Real EUR · 2025 prices » / « € constants 2025 » (l'année vient toujours de `meta`, jamais codée en dur). |
| Limites | Les indices de prix généraux (HICP, CPI-U) ne mesurent pas l'inflation propre à la R&D ; c'est une **analyse Orion**, jamais une donnée observée ; les années sans indice publié sont exclues (bande hachurée). |
| Pertinent | Toute série temporelle ; toute comparaison entre années ; comparaison entre financeurs dans une devise commune. |
| Trompeur | Présenté comme « valeur de marché » (c'est l'inverse : voir `fx`). |

### ECONOMIC SCALE — « Est-ce beaucoup, relativement à la taille de l'économie ? »

#### `gdp` — % of GDP · % du PIB

| | |
|---|---|
| Question | Quel poids ce financement représente-t-il par rapport à l'économie de la juridiction concernée ? |
| Formule | *(amendée R3)* `financement_USD_courant(a) / PIB_USD_courant(juridiction, a)` — numérateur : nominal × taux annuel BCE (convention ④ généralisée par le pivot USD) ; dénominateur : `NY.GDP.MKTP.CD` publié par le WDI, converti à ses propres taux officiels. **Tous deux à prix courants, même devise commune** : ratio pur, aucune déflation — mais deux conversions distinctes, proches en pratique, jamais une identité de change. Agrégat pluriannuel : `100 × Σ financement / Σ PIB` sur les mêmes années valides. |
| Unité | « % of GDP · {juridiction} » — le dénominateur est toujours nommé (§ D3, § D7). |
| Limites | Exige une juridiction de dénominateur **unique et résolue pour toute la vue** ; le PIB de l'année en cours n'est pas publié (la série s'arrête avant la série de financement — bande hachurée) ; les révisions du PIB déplacent le ratio (millésimes, § D2). |
| Pertinent | Effort d'un financeur (Horizon/PIB UE vs NSF/PIB US) ; intensité reçue par un pays. |
| Trompeur | Rapporté à un programme ou une organisation (ni l'un ni l'autre n'est une économie — **interdit**) ; toute vue mélangeant plusieurs juridictions de financement sans les séparer. |

#### `capita` — Per capita · Par habitant

| | |
|---|---|
| Question | Combien cela représente-t-il par habitant ? |
| Formule | `réel(R, cur) de l'année a / population de la juridiction pour a`. Numérateur en valeur réelle, pour que les années restent comparables entre elles. |
| Unité | « Real EUR · 2025 prices per capita » / « € constants 2025 / habitant ». |
| Limites | Même exigence de juridiction unique que `gdp` ; la population lisse mais ne dit rien de la structure de l'économie ; hérite des limites de `real`. |
| Pertinent | Comparer des pays de tailles très différentes (France vs Allemagne vs États-Unis) ; effort d'un financeur par habitant de sa juridiction. |
| Trompeur | Programmes, organisations (interdit). |

### PURCHASING POWER — « Quel pouvoir d'achat cela représente-t-il ? »

#### `ppp` — PPP-adjusted · En parité de pouvoir d'achat

| | |
|---|---|
| Question | Que peut acheter ce financement, localement, une fois les différences de niveaux de prix entre pays neutralisées ? |
| Formule | `natif_LCU(a) / facteur PPP(juridiction, a)` → dollars internationaux. La combinaison avec la déflation (« constant international $ ») est l'objet de l'étude R4. |
| Unité | « Intl $ (PPP) » — jamais présenté comme une devise de marché. |
| Limites | À dire explicitement en méthodologie produit, car ce sont les avertissements de l'ICP lui-même : les PPP sont des **estimations statistiques**, « approximations to true values » ; non conçues pour comparer des flux d'investissement ou d'aide ; pas de lecture infranationale ; les paniers PPP (consommation, PIB) ne reflètent pas les coûts propres de la R&D — l'OCDE convertit pourtant la DIRD en PPP : l'usage macro est reconnu, pas incontesté. Les facteurs annuels WDI sont des extrapolations entre cycles ICP, révisées. |
| Pertinent | Comparer ce que « finance réellement » un même montant en Corée, en Pologne, aux États-Unis (perspective bénéficiaire). |
| Trompeur | Présenté comme valeur de marché ; agrégats multi-pays sans méthode d'agrégation définie (d'où la porte R4) ; petits écarts entre pays proches (marges d'erreur non chiffrables). |

### TREND — « Qui progresse le plus vite ? »

#### `index` — Index 100 · Indice 100

| | |
|---|---|
| Question | Quelles trajectoires, indépendamment des niveaux absolus ? |
| Formule | `100 × réel(a) / réel(base)` **par série**. Calculé sur la valeur réelle — un indice du nominal mélangerait croissance et inflation. Année de base : paramètre `base`, défaut = première année pleine de la fenêtre affichée, résolue puis écrite dans l'URL (précédent `moneyYear`). |
| Unité | « Index · 2015 = 100 » — sans dimension. |
| Limites | Écrase les ordres de grandeur (c'est le but : le dire) ; hypersensible à l'année de base si elle est atypique ; exige que chaque série ait une valeur à l'année de base (sinon la série est signalée non indexable, pas re-basée en silence). |
| Pertinent | Séries temporelles multi-séries où une série écrase les autres (USA vs le reste) — complément de la légende, § D9. |
| Trompeur | Toute vue sans axe temporel (absent) ; parts du tout (jamais de donut en mode index). |

#### `growth` — Annual growth · Croissance annuelle

| | |
|---|---|
| Question | Quelle variation d'une année sur l'autre ? |
| Formule | `réel(a) / réel(a−1) − 1`, par série. |
| Unité | « % vs previous year » / « % vs année précédente ». |
| Limites | Très bruité sur les petites séries et les cohortes d'engagement (une grosse vague d'attributions fait un pic mécanique) ; la première année de la fenêtre n'a pas de valeur. |
| Pertinent | Détecter accélérations et coups d'arrêt ; complément d'`index`. |
| Trompeur | Sommes et parts (non sommable) ; vues non temporelles (absent). |

### MARKET VALUE — « Quelle était la valeur de marché dans une autre devise ? »

#### `fx` — Historical exchange value · Valeur de change historique

| | |
|---|---|
| Question | Combien ce montant valait-il, à l'époque, dans une autre devise de marché ? |
| Formule | `natif(a) → devise d'affichage au taux moyen annuel BCE de l'année a`. C'est la **généralisation de la convention ④ existante** : le nominal EUR d'Orion est déjà, pour les montants USD, une valeur de change historique vers l'EUR. |
| Unité | « USD · at historical exchange rates » — toujours étiqueté valeur de change, **jamais** correction d'inflation ni évolution réelle. |
| Limites | Une série `fx` mélange variation de financement et variation de change ; c'est une réponse sur la valeur de marché d'époque, pas sur l'évolution réelle — le mode vit dans son propre groupe MARKET VALUE, jamais dans TREND. |
| Pertinent | Lecture ponctuelle (« Horizon 2020 valait X Md$ au taux de l'époque ») ; audiences pensant dans une autre devise pour des montants contractuels. |
| Trompeur | Interprété comme trajectoire ou comme pouvoir d'achat ; note de méthode obligatoire sur les séries temporelles. |

---

## D2 — L'objet mondial Funding jurisdiction

### Modèle conceptuel

Deux objets, dans la continuité exacte du motif `price_indices` :

```
jurisdictions
  code          -- PK, stable, non traduit : ISO 3166-1 alpha-2 (« FR », « US », « GB », « JP », « KR », « AU »)
                --  + « EU » (code exceptionnellement réservé ISO pour l'Union européenne)
  kind          -- country | union
  name_key      -- clé i18n ; le libellé n'est jamais stocké traduit
  currency      -- devise de compte (EUR, USD, GBP, JPY…)
  price_index_currency  -- pointeur vers price_indices (moteur A) : l'indice qui déflate cette juridiction

macro_series
  jurisdiction_code  -- FK jurisdictions.code
  concept            -- gdp_current_usd (amendement R3) | population | ppp_lcu_per_intl_usd | … (vocabulaire fermé, extensible par migration)
  year
  value              -- Numeric, unité définie par le concept
  series_source      -- « wdi », « eurostat », « bea »…
  series_code        -- code officiel de la série (« NY.GDP.MKTP.CD », « SP.POP.TOTL »…)
  vintage_date       -- même discipline que price_indices : append-only, dernière vintage gagne
  imported_at
  -- unicité (jurisdiction_code, concept, year, vintage_date)
```

### Règles (vérifiables)

1. **Rattachements existants réutilisés.** `funders.jurisdiction` (String(10), déjà en base : `ec→EU`, `nih→US`, `nsf→US`, `ademe→FR`) devient une FK vers `jurisdictions.code`. Côté bénéficiaires, `participations.country_code` **est** le code de juridiction (kind `country`). Aucun nouveau champ sur les tables de données.
2. **Un financeur sans juridiction résolue est un défaut de seed**, refusé à `orion-ingest reference` — pas un cas d'exécution silencieux (§ D13).
3. **Aucun agrégat maison.** Le PIB et la population de l'UE sont des séries publiées par la source (agrégat WDI `EUU` / Eurostat), jamais une somme de membres calculée par Orion — la composition de l'Union varie dans le temps (Brexit) et l'agrégation est le métier de la source. Conséquence : pas de table de membres en R3 (elle n'aurait aucun consommateur).
4. **Une source par (juridiction, concept)**, choisie une fois et consignée dans `series_source`/`series_code` ; le mélange de sources dans une même série est interdit.
5. **Même condition de validité que le moteur A** : un mode qui a besoin d'un concept macro refuse proprement si la dernière vintage ne couvre pas la fenêtre requise ; la validation d'ingestion (`_validate` généralisée) exige valeurs strictement positives et années contiguës.
6. Rien n'est hardcodé Europe/USA : ajouter UKRI se résume à une ligne `FUNDERS` (`ukri`, jurisdiction `GB`), la juridiction `GB` (déjà présente comme pays), et ses séries macro — **zéro changement de moteur**.

### Ce qu'une juridiction peut porter (extension future, pas R3)

Sources et licences par série (déjà couvert par `series_source` + § D11), statistiques publiques R&D compatibles (DIRD/GBARD — bloquées par la porte D12), indices de prix propres à la juridiction si un jour la déflation devient par-juridiction plutôt que par-devise (hors périmètre : la convention par-devise du moteur A est documentée et reste la règle).

---

## D3 — Funder perspective vs recipient perspective

Décision structurante : **un ratio « % du PIB » ou « par habitant » n'existe jamais sans dire de quelle économie on parle.** Deux perspectives, jamais confondues :

| | EN | FR | Règle de calcul |
|---|---|---|---|
| Perspective financeur | **Funding effort** | **Effort de financement** | `Σ montants (grain projet) du financeur / macro de la juridiction du financeur`. Horizon → financement UE / PIB UE ; NSF → financement NSF / PIB US. |
| Perspective bénéficiaire | **Received funding intensity** | **Intensité de financement reçu** | `Σ montants (grain participation) reçus par les organisations du pays / macro du pays`. France → reçu par les organisations françaises / PIB France. |

Règles :

1. **Le grain suit la perspective** — c'est l'extension naturelle de la règle anti-double-compte existante (`PARTICIPATION_DIMS`) : financeur → grain projet (`p.funding_amount_eur`), bénéficiaire → grain participation (`pa.amount_eur`).
2. **La perspective est forcée par la dimension** dans presque tous les cas : `by=country|region|subdivision|organisation` → bénéficiaire ; `by=funder` → financeur. Le choix n'existe réellement que sur une série temporelle d'un financeur unique (l'effort UE dans le temps *ou* l'intensité reçue par un pays filtré) — seul cas où le paramètre `perspective` apparaît dans l'UI et dans l'URL (§ D6, § D10). Forcée = absente de l'URL canonique et du menu, présente dans la ligne d'unité.
3. **Jamais de label nu.** L'entrée de menu dit la perspective en toutes lettres (« % of GDP — funding relative to the funder's economy » / « …relative to each country's economy ») ; la ligne d'unité nomme le dénominateur : « % of GDP · European Union », « % of GDP · France ».
4. Surfaces : effort → financeurs, comparaisons entre financeurs, série temporelle d'un financeur ; intensité → pays, régions, série temporelle d'un pays. Organisations et programmes : **aucune des deux** (pas des économies).

---

## D4 — Carte de pertinence par surface

Légende : **●** pertinent · **◐** sous condition nommée · **—** absent (le mode n'apparaît pas ; pas d'option grisée).

| Surface | Nominal | Real | % GDP | Per capita | PPP | Index 100 | Growth | FX |
|---|---|---|---|---|---|---|---|---|
| Pays / régions (`by=country\|region`) | ● | ● | ● ᵇᵉ | ● ᵉ | ◐ ᶜᵉ | ◐ ᵃ | ◐ ᵃ | ◐ ᵈ |
| Programmes (`by=programme`) | ● | ● | — | — | — | ◐ ᵃ | ◐ ᵃ | ◐ ᵈ |
| Organisations (`by=organisation`, /compare) | ● | ● | — | — | — | ◐ ᵃ | ◐ ᵃ | ◐ ᵈ |
| Financeurs (`by=funder`) | ● | ● | ● ᶠ | ◐ ᶠ | ◐ ᶜᶠ | ◐ ᵃ | ◐ ᵃ | ● ᵈ |
| Séries temporelles (`by=year`, `split`) | ● | ● | ◐ ᵇ | ◐ ᵇ | ◐ ᵇᶜ | ● | ● | ◐ ᵈ |
| Comparaison entre juridictions de financement (EU/US…) | ● | ● | ● ᶠ | ◐ ᶠ | ◐ ᶜ | ● ᵃ | ● ᵃ | ● ᵈ |

Conditions :

- **a** — uniquement si la vue a un axe temporel (`by=year` ou `split` temporel) ; sinon le groupe TREND entier est absent.
- **b** — uniquement si la juridiction du dénominateur est **unique et résolue pour toute la vue** (ex. `by=year` sans filtre financeur mélange UE et US : le mode est absent ; avec un financeur ou un pays unique, il apparaît).
- **c** — R4 seulement, après l'étude d'agrégation PPP ; d'ici là le mode n'existe nulle part.
- **d** — jamais dans TREND ; étiquette « at historical exchange rates » obligatoire ; note de méthode obligatoire sur les séries temporelles.
- **e** — perspective bénéficiaire forcée. **f** — perspective financeur forcée.

Règles transverses (vérifiables) :

1. **Le contrôle n'offre que ce que la vue courante peut honorer** — la liste des modes est dérivée de l'état (`resolveView` a le précédent) : dimension, filtres, axe temporel, couverture des références. Un mode impossible pour toute la vue disparaît (§ D13).
2. Les vues **donut et carte** n'existent qu'en modes sommables (`nominal`, `real`, `fx`) — masquer une part d'un total ou cartographier un indice mentirait ; `gdp`, `capita`, `ppp`, `index`, `growth` sont non sommables (extension de `SUMMABLE`) : jamais de part-du-tout.
3. Les métriques non monétaires (`projects`, `organisations`, `coordination`) ignorent le Reference Engine, comme aujourd'hui (`MONETARY_METRICS`).
4. Les fiches (hubs pays/programme/organisation), la recherche et `/compare` restent nominales tant que la surface n'est pas explicitement raccordée (même doctrine que A : surfaces V1 = Explorateur uniquement).

---

## D5 — Architecture UI du parcours

Trois architectures réellement différentes ont été considérées ; la A est recommandée.

### Option A — le sélecteur de lecture (recommandée)

Un seul contrôle dans l'en-tête du board, à la place de l'actuel segmented control nominal/constant :

```
Metric                    View funding as
Funding            Real value · 2025 EUR ▾
```

Le bouton affiche toujours la lecture courante en toutes lettres. À l'ouverture, un panneau calme, groupé, une phrase humaine par mode :

```
How do you want to compare funding?

VALUE
  ○ Nominal            Amounts at award time
  ● Real value         Remove inflation effects
      Reference year   2025
      Display currency EUR ▾

ECONOMIC SCALE
  ○ % of GDP           Relative to the economy that funds
  ○ Per capita         Relative to population

TREND
  ○ Index 100          Compare growth trajectories
  ○ Annual growth      Compare year-to-year change
```

- Seuls les groupes ayant au moins un mode valide pour la vue courante apparaissent (§ D4).
- Choisir un mode révèle **ses** paramètres secondaires, indentés sous lui (§ D6) — progressive disclosure, pas de deuxième interface (§ D14).
- Fermeture par clic hors panneau ; l'application est immédiate (une interaction = une URL, précédent `patch()`).
- Doctrine design : hairlines, un seul accent outremer sur l'état actif, labels 12 px capitales pour les groupes, pas de poids 700, tabular figures sur les paramètres numériques.

**Pourquoi A** : la question fondatrice (« quelle question poser ? ») est portée par les intitulés de groupes et les phrases humaines — la pédagogie est dans le panneau lui-même, sans étape supplémentaire ; le contrôle est petit, extensible (un groupe de plus n'ajoute pas un contrôle de plus), et sa forme est définitive dès R1 (avec le seul groupe VALUE) : on ne re-livre pas un contrôle différent à chaque lot.

### Option B — la question d'abord (non retenue)

Deux temps : le panneau pose d'abord « How do you want to compare funding? » avec 3-4 cartes-questions (Combien ? / À l'échelle de l'économie ? / Les trajectoires ? / Le pouvoir d'achat ?), puis les modes du groupe choisi. Plus didactique en apparence, mais ajoute un clic à chaque bascule, cache l'espace complet des modes (l'utilisateur ne découvre pas ce qu'il ne cherche pas), et duplique ce que les intitulés de groupes de A disent déjà. Rejetée.

### Option C — les onglets d'axe (non retenue au-delà de R1)

Un segmented control directement dans l'en-tête (Nominal | Real | % GDP | Index). C'est l'actuel contrôle A généralisé : le plus rapide à deux modes, mais il plafonne à ~4 positions, pousse les paramètres secondaires ailleurs, et grossit l'en-tête à chaque lot — le chemin exact vers le « panneau Bloomberg » qu'on refuse. Rejetée comme cible ; l'actuel segmented control est remplacé par A dès R1.

---

## D6 — Options secondaires contextuelles

Seuls les paramètres du mode choisi existent — aucun utilisateur ne voit jamais un paramètre qui ne concerne pas sa lecture :

| Mode | Paramètres révélés | Valeurs |
|---|---|---|
| `nominal` | aucun | — |
| `real` | Reference year · Display currency | années publiées (serveur) ; devises couvertes par les taux BCE de l'année de référence, défaut EUR |
| `gdp` | Perspective — **seulement** quand la dimension ne la force pas (§ D3.2) | Funding effort / Received funding intensity |
| `capita` | Perspective (même règle) ; hérite Reference year · Display currency de `real` | — |
| `ppp` | (R4) Reference year | — |
| `index` | Base year | années de la fenêtre affichée ; défaut = première année pleine |
| `growth` | aucun | — |
| `fx` | Display currency | devises couvertes par les taux BCE ; obligatoire (sans elle, `fx` ≡ nominal et est normalisé en nominal) |

Les valeurs proposées sont **celles que le serveur peut honorer** (années de référence publiées, devises couvertes) — jamais une liste théorique qui mènerait à un refus.

---

## D7 — L'unité impossible à manquer

La ligne d'unité est **toujours** portée par le titre du graphique/KPI, jamais seulement par le menu. Mécanisme existant généralisé (l'étiquette « · € constants 2025 » du lot A) ; les valeurs (année, juridiction, devise) viennent de `meta`, jamais codées en dur.

```
Funding over time                    Funding intensity                Funding trajectory
Real EUR · 2025 prices               % of GDP · European Union        Index · 2015 = 100

Funding per capita                   Funding, market value            Funding over time
Real EUR · 2025 prices / capita ·    USD · at historical              Intl $ (PPP) · 2025   (R4)
France                               exchange rates
```

Règles : la ligne d'unité nomme le référentiel complet (mode + année + devise/juridiction selon le mode) ; l'axe Y reprend l'unité courte ; en `gdp`/`capita` la juridiction du dénominateur est dans la ligne d'unité (§ D3.3) ; on ne doit jamais rouvrir le menu pour comprendre l'axe. Le CSV exporté reprend la même ligne d'unité dans son en-tête de colonne.

---

## D8 — Méthodologie au point d'usage

Un contrôle léger `ⓘ Reference` à côté de la ligne d'unité (extension de l'actuelle `<MoneyNote>`), même contenu en cinq blocs pour tous les modes :

```
ⓘ Reference — Real value
Adjusts funding for price changes in the original currency,
then expresses it in 2025 EUR.
Sources: Eurostat HICP (2026-08-12) · BLS CPI-U (2026-08-12) · ECB.
98.3% of displayed funding adjusted.
Excluded: 5 478 projects · €12.21bn — details ▾
Methodology →
```

```
ⓘ Reference — % of GDP
Funding relative to the economic size of the selected jurisdiction
(European Union — funding effort).
Sources: World Bank WDI (GDP, current US$ · vintage 2026-07).
GDP not yet published for 2026: series ends 2025.
Methodology →
```

Règles : **définition · sources (avec millésimes) · couverture · exclusions · lien méthodologique** (`/about-data`), toujours dans cet ordre. L'API fournit les valeurs (`meta.reference = {mode, params, sources, vintages, coverage}` + bloc `excluded` généralisé) ; l'UI fournit les phrases EN/FR (clés i18n, parité testée). Les attributions exigées par les licences (§ D11) vivent ici et sur `/about-data` — la conformité est une fonctionnalité du produit, pas une note de bas de page.

---

## D9 — Interaction avec les graphiques (légende × référentiel)

Deux questions orthogonales, deux mécanismes orthogonaux, déjà séparés dans l'architecture :

- **« Qui veux-je comparer ? »** → la légende composable (`hidden`, tilde-séparé, présentation pure : n'atteint jamais l'API, données/KPI/CSV inchangés, recalage d'échelle automatique, « Show all »).
- **« Selon quel référentiel ? »** → le Reference Engine (`value` et ses paramètres : atteint l'API ou transforme les valeurs, change l'unité, le titre, l'axe).

Cohabitation dans l'expérience :

1. Les deux paramètres coexistent dans l'URL et se composent librement : `by=country&split=1&value=index&base=2015&hidden=US` est un état légal, partageable, rejouable (decks/dossier compris — `explore-view.tsx` rejoue déjà `hidden` en lecture seule).
2. Changer de mode **préserve** `hidden` (les clés de séries appartiennent à la dimension, pas au mode) ; changer de dimension le remet à zéro (règle existante).
3. L'indexation est indépendante du masquage : la base d'`index` est une année, pas un maximum visible — masquer une série ne re-base jamais les autres.
4. Le cas canonique « USA écrase les autres » a **deux réponses complémentaires**, et le produit les raconte comme telles : masquer USA (je compare les autres, en niveaux) ou passer en Index 100 (je garde USA, je compare les trajectoires). Aucune des deux n'est un pis-aller de l'autre : l'une change le *qui*, l'autre le *selon quoi*.
5. En modes non sommables, la légende reste disponible sur `lines/bump/delta/bars` (`LEGEND_VIEWS` inchangé) ; donut et carte n'existent pas dans ces modes (§ D4.2), le conflit ne se pose pas.

---

## D10 — Grammaire URL générique

Décision la plus importante de R0 : aucune URL publique de A n'existe, c'est maintenant que la grammaire se fige. Trois grammaires ont été posées avant recommandation :

- **(i) Collection de flags indépendants** (`money=constant&ppp=true&gdp=true…`) — rejetée : l'espace des combinaisons incohérentes explose, chaque flag nouveau invalide les anciens états, impossible d'interdire structurellement `ppp=true&gdp=true`.
- **(ii) Chaîne composée unique** (`view=real:2025:USD`) — rejetée : compacte mais opaque, parsing positionnel fragile, paramètres non adressables individuellement (analytics, canonicalisation partielle, diffs de dossier illisibles).
- **(iii) Famille `value=` + paramètres orthogonaux** — **recommandée** : le mode est un discriminant unique, chaque paramètre secondaire n'a qu'un sens par mode, l'incohérence est structurellement impossible (un paramètre étranger au mode est ignoré puis retiré).

### Grammaire recommandée

```
value=nominal                                  (défaut — omis de l'URL canonique)
value=real&base=2025&cur=EUR                   (cur=EUR défaut — omis ; base auto-écrite)
value=gdp&perspective=funder                   (perspective omise quand forcée par la dimension)
value=capita&base=2025&cur=EUR
value=ppp&base=2025                            (R4)
value=index&base=2015
value=growth
value=fx&cur=USD                               (cur obligatoire ; fx sans cur ≡ nominal, normalisé)
```

| Param | Rôle | Valeurs | Défaut (omis) |
|---|---|---|---|
| `value` | le mode — la question posée | `nominal real gdp capita ppp index growth fx` | `nominal` |
| `base` | l'année à laquelle tout est ramené (année de référence de `real`/`capita`/`ppp`, année de base d'`index`) | `\d{4}` parmi les années publiées/de la fenêtre | résolue par le serveur ou la fenêtre, puis **auto-écrite** (précédent `moneyYear`) |
| `cur` | devise d'affichage | ISO 4217 majuscules, couvertes par les taux BCE | `EUR` |
| `perspective` | juridiction du dénominateur | `funder` \| `recipient` | forcée par la dimension → omise |

### Règles de canonicalisation (vérifiables)

1. **Identifiants stables, non traduits**, en minuscules ; jamais de libellé dans l'URL.
2. **Défauts omis** ; `patch()` reconstruit l'URL entière à chaque interaction (mécanisme existant) et **supprime les paramètres étrangers au mode courant** — `value=nominal&base=2025` est lu comme nominal et la prochaine écriture efface `base`.
3. **Incohérence impossible en silence** : côté front, `readState` normalise (mode inconnu → `nominal`, `base` hors fenêtre pour `index` → ré-ancrée et réécrite) ; côté API, combinaison non supportée → `400 Unsupported value mode` et référence indisponible → `422 <mode>_unavailable` (précédents exacts du lot A). Jamais de repli silencieux vers le nominal.
4. **Stabilité dans le temps** : toute année `base` déjà publiée reste servie quand la référence courante avance (le moteur A accepte déjà `money_year` passés) ; le millésime des données (vintage) vit dans `meta` et la note ⓘ, pas dans l'URL — l'URL enregistre la *question*, `meta` enregistre l'*édition des données* qui y a répondu.
5. **Compatibilité dossiers/decks/recherches** : une planche d'histoire est une chaîne de params littérale, un dossier déduplique par égalité de chaîne — l'ordre d'écriture déterministe de `patch()` est conservé ; `hidden` reste orthogonal et présentationnel.
6. **API** : `money`/`money_year` sont remplacés par `value`/`base`/`cur`/`perspective` (mêmes noms en snake_case naturel). La clé de cache d'agrégat intègre le tuple complet + la clé de vintage (précédent `money_key`).

### Migration

`money=constant&moneyYear=2025` → `value=real&base=2025`. Aucune URL publique n'existe : **bascule sèche en R1, aucun support de l'ancienne forme** — c'est la fenêtre unique où c'est gratuit ; elle se ferme à la première publication.

---

## D11 — Sources macro mondiales et licences (audit sur pièces, 2026-08-23)

Audit mené sur les pages officielles des institutions uniquement. Doctrine : **pas sûr = pas ingéré.**

### Synthèse et décisions

| Source | Licence constatée | Commercial | Décision Orion |
|---|---|---|---|
| Eurostat (HICP, PIB, population, PPP) | CC BY 4.0 (décision 2011/833/UE) | Oui, attribution ; **exception : données de pays tiers (US/JP/UK, d'origine OCDE) non commerciales** | **Retenue** (HICP déjà ingéré). Lignes pays tiers de `prc_ppp_ind` exclues. Rôle R3 : source de contrôle UE. |
| BCE (taux de change EXR) | Réutilisation libre avec citation ; mention « disponible gratuitement à la BCE » si contenu vendu ; transformations signalées | Oui, conditions | **Retenue** (déjà ingérée). Conditions à refléter sur `/about-data`. |
| BLS (CPI-U `CUUR0000SA0`) | Domaine public (gouvernement fédéral US) | Oui | **Retenue** (déjà ingérée). CPI-U NSA final dès publication. |
| World Bank WDI | **CC BY 4.0** (défaut des datasets Banque mondiale ; ≠ des terms du *site*, non commerciaux) | Oui, attribution format prescrit | **Retenue — source unique R3/R4** : PIB courant US$ (`NY.GDP.MKTP.CD`, amendement R3), population (`SP.POP.TOTL`), PPP annuels (`PA.NUS.PPP`), agrégat UE (`EUU`). Vérifier à l'ingestion les métadonnées de licence des indicateurs retenus (certains indicateurs WDI sont d'origine tierce). |
| BEA (PIB US, NIPA) | Domaine public | Oui | Source de **contrôle** du PIB US (révisions annual/comprehensive fréquentes → discipline vintage indispensable). |
| ONU WPP (population) | CC BY 3.0 IGO | Oui, attribution | Source de **contrôle** population (révision ~biennale, WPP 2024 courante, archives disponibles). |
| OCDE (Data Explorer : PPP, MSTI, GBARD) | Terms « Data » propres (≠ CC BY) : commercial autorisé, citation avec date d'accès, **obligation d'attribution propagée à toute sous-licence** | Oui, conditions | **En réserve.** Non nécessaire en R1–R3. Candidate R4 (PPP de contrôle) / R5 (GBARD) — exige d'abord de refléter la clause de pass-through dans les CGU d'Orion. MSTI gelé jusqu'au 31/03/2027. Couverture non mondiale. |
| UNESCO UIS (GERD, SDG 9.5) | CC BY-**SA** 4.0 (données) / CC BY-SA 3.0 IGO (publications) | Oui mais **ShareAlike** | **Exclue** tant que la portée de la clause SA pour un SaaS propriétaire n'est pas tranchée par un avis juridique. De plus : GERD en valeur absolue discontinuée depuis mars 2021 (archive figée), seuls les indicateurs SDG 9.5 vivent. Relève de la porte D12 de toute façon. |
| World Bank ICP (données de cycle) | Label de licence non trouvé sur la fiche du dataset ICP 2021 → **incertain** | Incertain | **Exclue.** Les facteurs PPP annuels passent par le WDI (CC BY 4.0 sans ambiguïté). |
| FMI (WEO, IFS) | « Use of IMF Data » : droits larges **mais** « for any potential commercial reuse … request permission » + interdiction de bulk download automatisé sans permission | **Incertain** | **Exclue** sans réponse écrite de copyright@imf.org. Non bloquant : le WDI couvre le besoin. |

### Faits saillants à retenir pour l'ingénierie

- **Le WDI révise en place** (« Historical data have been revised as necessary »), publie trimestriellement (avril/juillet/octobre/décembre), et **un même code de série a changé de sens entre éditions** (année de base de `NY.GDP.MKTP.KD` : 1987→…→2015). La discipline vintage du moteur A n'est pas un luxe, c'est la condition de rejouabilité. Des archives officielles existent (WDI Database Archives, depuis 1989).
- **Les PPP annuels WDI sont des extrapolations** des benchmarks ICP (2017, 2021, prochain 2024) par les inflations relatives ; les benchmarks eux-mêmes sont révisés a posteriori. L'ICP publie ses propres avertissements d'usage (pas pour les flux d'investissement/aide ; pas d'infranational ; approximations) → repris tels quels dans la méthodologie produit (§ D1 `ppp`, § D8).
- **Attributions exactes** (à porter sur `/about-data` et dans ⓘ) : Banque mondiale : « The World Bank: World Development Indicators: [source] » + modifications signalées ; Eurostat : dataset + DOI + date d'accès ; BCE : « Source: European Central Bank » (+ mention de gratuité si contenu vendu) ; BLS/BEA : citation de courtoisie ; ONU : citation officielle WPP 2024 avec millésime nommé.
- L'Europe est servie par le même canal que tout le monde (WDI), avec Eurostat en contrôle : **une juridiction très bien documentée parmi d'autres, jamais le socle implicite.**

---

## D12 — Métriques à ne PAS construire encore

> **Amendement R5A (2026-08-26, corrigé en contre-relecture le même jour, soumis à arbitrage)** — l'étude de compatibilité exigée par cette porte a été menée (`docs/conception-r5-budget-denominators.md`). **Verdict : `GO R5B avec périmètre réduit`** — une métrique NSF indépendante, hors Reference Engine ; ce moteur ne gagne aucun mode budgétaire, et pour EC, NIH, GBARD et tout mode global le NO-GO demeure. L'étude corrige aussi une hypothèse de ce paragraphe : la phrase « Orion observe des cohortes d'engagement » est **vraie pour CORDIS et fausse pour NIH et NSF**, soit 76 % du corpus en valeur. Le texte corrigé est ci-dessous, et il remplace la formulation d'origine.

Étudiées, non validées : % GBARD, % du budget public de R&D, % du budget de l'UE, % du budget Horizon, % des budgets NIH/NSF, et tout autre dénominateur « système de financement ».

**Le problème méthodologique, explicitement (formulation corrigée par R5A) :** Orion additionne **deux grandeurs comptables distinctes** sous une même colonne `funding_amount` — un **engagement prévisionnel plafonné**, complet dès la signature (CORDIS `ecMaxContribution` ; mesuré : les cohortes 2024-2025 portent leur pleine valeur alors que 96 à 99,7 % des projets courent encore), et un **cumul d'obligations déjà constatées**, qui se remplit exercice après exercice (NIH : somme des `TOTAL_COST` par année fiscale ; NSF : 93,91 % des attributions valent exactement la somme de leurs obligations annuelles publiées). Les deux sont rattachés à l'année civile de début du projet (conventions ①②③). Un budget, lui, est soit une **autorisation annuelle** (appropriation, budget authority, crédits d'engagement ou de paiement), soit une **dépense**. Diviser l'un par l'autre produit un ratio dont le numérateur et le dénominateur ne comptent ni la même chose, ni sur le même axe du temps — et le numérateur lui-même n'est pas homogène d'une source à l'autre.

Cette colonne répond correctement à « combien a été attribué à ce projet » — la question du mode `nominal`, qui reste le défaut. Elle ne peut pas servir de numérateur à un ratio budgétaire, qui exige de savoir **quand** l'argent a été engagé.

**Porte de validation nommée** — aucune de ces métriques n'existe tant que l'étude de compatibilité n'a pas, pour chaque couple (numérateur Orion, dénominateur) :

1. défini le dénominateur exact (engagements vs paiements, périmètre, année budgétaire vs civile) ;
2. vérifié le rattachement temporel des deux côtés et la conversion éventuelle d'axe ;
3. mesuré l'écart sur un cas fermé et connu (ex. total Horizon 2020 publié vs somme des cohortes Orion 2014-2020) avec un seuil d'acceptation écrit à l'avance ;
4. vérifié la licence du dénominateur (GBARD : OCDE/Eurostat, § D11).

**Résultat de cette porte, R5A (corrigé en contre-relecture)** : l'exigence **1** échoue pour EC et NIH — GBARD est d'étape comptable variable et non documentée pays par pays (le § 12.43 du Frascati recommande les crédits finaux votés, la pratique nationale va des crédits votés aux dépenses) et **n'existe pas pour les institutions de l'Union** ; les enveloppes d'appel européennes ne recouvrent que **0,008 %** du corpus CORDIS ; le profil annuel NIH a été jeté à l'ingestion. Elle est en revanche **satisfaite pour NSF** : la série officielle « Award Obligation Amount » (*NSF by the Numbers*, FY2011-FY2025) a la définition exacte de ce qu'Orion calcule, et la réconciliation passe un seuil ±5 % gravé avant calcul (étude § 9.4.6). La métrique qui en découle est **indépendante du Reference Engine** (étude § 19.3) — ce moteur ne gagne aucun mode budgétaire, et un libellé vague « % of budget » reste interdit. Les conditions d'un élargissement EC/NIH sont écrites au § 20.4 de l'étude, avec leurs seuils.

S'y ajoutent deux blocages de source indépendants : la GERD absolue UIS est discontinuée (archive mars 2021) et sous clause ShareAlike ; le MSTI OCDE est gelé jusqu'au 31/03/2027.

---

## D13 — États vides, données manquantes, couverture

Doctrine inchangée, étendue : **jamais d'approximation silencieuse.** Trois niveaux, dans l'ordre :

1. **Mode impossible pour toute la vue** → le mode n'apparaît pas dans le sélecteur (juridiction non résolue, dénominateur multiple — § D4.b), ou s'il est forcé par l'URL → `422 <mode>_unavailable` + message et bouton de retour au nominal (précédent exact `constant_mode_unavailable`).
2. **Partie de la vue non calculable** → résultat calculé sur la partie valide, bloc `excluded` chiffré depuis le périmètre affiché, `<details>` ventilé par motif, bande hachurée sur l'axe pour les années sans référence (mécanisme `unavailableYears` existant), jamais de faux zéro (`keep_null`).
3. **Valeur absente dans un bucket** → `None`, jamais `0.0`.

Vocabulaire des motifs d'exclusion — les trois existants + quatre nouveaux, mêmes formes de bloc JSON :

| Motif | Condition | Modes concernés |
|---|---|---|
| `no_date` | projet sans `start_date` | tous sauf `nominal` |
| `no_index_year` | indice de prix non publié pour l'année (ex. 2026-2027) | `real`, `capita`, `index`, `growth` |
| `no_currency_index` | devise hors `COVERED` | idem |
| `no_gdp_year` | PIB non publié pour l'année (décalage t+1 structurel → la série `gdp` s'arrête avant la série de financement, bande hachurée) | `gdp` |
| `no_population_year` | population non publiée | `capita` |
| `no_ppp_year` | facteur PPP non publié | `ppp` (R4) |
| `no_jurisdiction` | financeur ou pays sans juridiction résolue — **ne doit pas exister à l'exécution** : refusé au seed (§ D2.2) ; le motif existe comme garde-fou compté, pas comme cas normal | `gdp`, `capita`, `ppp` |

Règles : les motifs sont calculés depuis le périmètre affiché (mêmes jointures, mêmes WHERE — mécanisme A) ; la couverture s'exprime au point d'usage (ⓘ, § D8) en % de la valeur affichée ; `index`/`growth` héritent des exclusions de `real` (ils n'existent pas là où le réel n'existe pas) ; une série sans valeur à l'année de base d'`index` est signalée non indexable, jamais re-basée en silence.

---

## D14 — Première visite vs utilisateur expert

Une seule interface, trois profondeurs — pas deux UI :

1. **Surface** (utilisateur normal) : le sélecteur (§ D5) — un choix, une phrase humaine par mode, les défauts font le reste (année de référence courante, EUR, perspective forcée). Aucune notion préalable requise : les groupes *sont* les questions.
2. **Paramètres** (utilisateur curieux) : révélés sous le mode choisi, seulement les siens (§ D6).
3. **Méthode** (utilisateur expert) : ⓘ Reference — définition, formule en une phrase, sources et millésimes, couverture, exclusions, lien `/about-data` (§ D8). L'URL, lisible et stable, est elle-même la couche experte ultime : tout état est adressable et rejouable.

Le passage d'un niveau au suivant est toujours un geste de plus au même endroit, jamais un autre écran.

---

## D15 — Maquettes de parcours (wireframes textuels)

Conventions : seuls les blocs qui changent sont re-dessinés ; l'URL est celle de l'état canonique (défauts omis).

### Cas 1 — Évolution des financements Space, 2010-2025 : Nominal → Real 2025 → Index 100

```
① Nominal (défaut)
URL /explore?by=year&sector=space&time=2010..2025
┌────────────────────────────────────────────────────────────┐
│ Funding                          [View funding as  Nominal ▾]│
│ 262,4 Md€                                                    │
│ Funding over time · Space                                    │
│ EUR · at award time                    ⓘ Reference           │
│ [lines]  axe Y : Md€                                         │
└────────────────────────────────────────────────────────────┘

② L'utilisateur ouvre le sélecteur, choisit Real value
   (Reference year 2025 et Display currency EUR apparaissent, pré-remplis)
URL /explore?by=year&sector=space&time=2010..2025&value=real&base=2025
┌────────────────────────────────────────────────────────────┐
│ Funding                       [View funding as  Real · 2025 ▾]│
│ 291,8 Md€                                                    │
│ Funding over time · Space                                    │
│ Real EUR · 2025 prices                 ⓘ Reference           │
│ [lines]  axe Y : Md€ (constants 2025)                        │
│ ⓘ : « Adjusts funding for price changes in the original      │
│   currency, then expresses it in 2025 EUR. Sources: Eurostat │
│   HICP · BLS CPI-U · ECB. 98.3% of displayed funding         │
│   adjusted. Excluded: … ▾  Methodology → »                   │
└────────────────────────────────────────────────────────────┘

③ TREND → Index 100 (Base year apparaît, défaut 2010 = première année
   de la fenêtre, auto-écrite)
URL /explore?by=year&sector=space&time=2010..2025&value=index&base=2010
┌────────────────────────────────────────────────────────────┐
│ Funding                  [View funding as  Index 100 · 2010 ▾]│
│ Funding trajectory · Space                                   │
│ Index · 2010 = 100                     ⓘ Reference           │
│ [lines]  axe Y : index (100 = 2010) — plus de KPI sommé,     │
│          plus de donut disponible                            │
└────────────────────────────────────────────────────────────┘
```

### Cas 2 — France vs Allemagne vs États-Unis : Real → Per capita → PPP

```
① URL /explore?by=country&compare=FR~DE~US&value=real&base=2025
│ Funding by country                                           │
│ Real EUR · 2025 prices                 ⓘ Reference           │
│ [bars] FR ▓▓▓▓  DE ▓▓▓▓▓  US ▓▓▓▓▓▓▓▓▓▓▓▓▓▓                 │

② ECONOMIC SCALE → Per capita — l'entrée du menu dit :
   « Per capita — relative to each country's population »
   (perspective bénéficiaire forcée : rien à choisir, rien dans l'URL)
URL /explore?by=country&compare=FR~DE~US&value=capita&base=2025
│ Funding per capita                                           │
│ Real EUR · 2025 prices / capita · recipient country          │
│ [bars] FR ▓▓▓▓▓▓  DE ▓▓▓▓▓  US ▓▓▓▓▓▓▓                      │
│ ⓘ : « Funding received by each country's organisations,      │
│   divided by its population. Population: World Bank WDI      │
│   (vintage 2026-07) · Amounts: real EUR, 2025 prices. »      │

③ PURCHASING POWER → PPP-adjusted (R4 — le groupe n'apparaît
   qu'une fois R4 livré)
URL /explore?by=country&compare=FR~DE~US&value=ppp&base=2025
│ Funding, purchasing power                                    │
│ Intl $ (PPP) · 2025                    ⓘ Reference           │
│ ⓘ reprend les avertissements ICP (approximation, pas de      │
│   lecture infranationale…)                                   │
```

### Cas 3 — Horizon vs NSF/NIH : Real devise commune → Index 100 → Funding effort / GDP

```
① URL /explore?by=funder&split=1&time=2014..2025&value=real&base=2025
│ Funding by funder                                            │
│ Real EUR · 2025 prices                 ⓘ Reference           │
│ [lines] ec / nih / nsf — devise commune, inflation retirée   │

② TREND → Index 100 (base 2014 auto-écrite)
URL /explore?by=funder&split=1&time=2014..2025&value=index&base=2014
│ Funding trajectory by funder                                 │
│ Index · 2014 = 100                                           │
│ [lines] les trajectoires se croisent — les niveaux absolus   │
│         ont disparu, la légende reste disponible (hidden)    │

③ ECONOMIC SCALE → % of GDP — entrée du menu :
   « % of GDP — funding relative to the funder's economy »
   (perspective financeur forcée par by=funder : absente de l'URL)
URL /explore?by=funder&split=1&time=2014..2025&value=gdp
│ Funding effort by funder                                     │
│ % of GDP · funding jurisdiction        ⓘ Reference           │
│ [lines] ec : ‰ du PIB UE · nih/nsf : ‰ du PIB US             │
│ bande hachurée sur 2026 : « GDP not yet published »          │
│ ⓘ : « Each funder's funding relative to its own economy.     │
│   GDP: World Bank WDI, current US$ (vintage 2026-07). »      │
└──────────────────────────────────────────────────────────────┘
```

### Cas 4 — Un utilisateur américain consulte Horizon Europe en Real 2025 · USD

```
① Depuis la fiche programme, il ouvre l'Explorateur (nominal)
URL /explore?by=year&programme=<id-horizon>

② Sélecteur → Real value → Display currency : USD
URL /explore?by=year&programme=<id-horizon>&value=real&base=2025&cur=USD
┌────────────────────────────────────────────────────────────┐
│ Funding                 [View funding as  Real · 2025 USD ▾] │
│ $103.2bn                                                     │
│ Funding over time · Horizon Europe                           │
│ Real USD · 2025 prices                 ⓘ Reference           │
│ [lines]  axe Y : $bn (2025 prices)                           │
│ ⓘ : « Adjusts funding for price changes in EUR (Eurostat     │
│   HICP), then converts to USD at the 2025 ECB average rate.  │
│   One fixed rate: this is a unit change, not a market        │
│   conversion — for value at historical exchange rates, see   │
│   Market value. »                                            │
└────────────────────────────────────────────────────────────┘
   `cur=USD` (non-défaut) est écrit dans l'URL ; l'état est
   partageable tel quel à des collègues américains.
```

---

## D16 — Plan de lots R1 → R5

### R1 — Nominal + Real, nouvelle grammaire, publication

*Capacité livrée* : la bascule Nominal / Real value dans sa forme définitive — sélecteur (§ D5.A) réduit au groupe VALUE, ligne d'unité, ⓘ Reference v1, paramètres Reference year / Display currency (EUR/USD).
*Données/sources* : aucune nouvelle — moteur A tel quel (HICP, CPI-U, BCE ; `constanteuro.py` intouché).
*Changements* : migration `money`/`moneyYear` → `value`/`base`/`cur` (front `readState`/`toApiParams`/`patch` + API + clé de cache) **avant toute publication** ; remplacement du segmented control ; `cur` ajouté (ré-expression au taux de l'année de référence — extension de `factor_set`, un scalaire).
*Tests* : adaptation des specs `explore-state` (nouvelle grammaire, suppression des paramètres étrangers), `test_explore_money` (nouveaux noms d'API, refus 400/422), e2e `explorer-money` renommé, parité i18n.
*Recette* : checklist design (10 pièges) sur le sélecteur ; recette sous Firefox ; vérification que la réponse nominale reste identique octet pour octet (invariant A conservé).
*Risques* : le surcoût perf consigné du mode constant (jusqu'à ~5,9× sur `by=funder`, budget 1,5× dépassé) devient visible en prod → le déclencheur d'optimisation nommé au lot A (sous-requête de comptes distincts ou vue matérialisée) est le premier candidat de suite ; la bascule sèche de grammaire est gratuite **uniquement** avant publication.

### R2 — Index 100 + croissance annuelle

*Capacité* : groupe TREND sur toute vue temporelle ; base d'index paramétrable ; croissance annuelle.
*Données* : aucune nouvelle. **Décision : transformation côté client** — `index` et `growth` sont des transformations déterministes de la série réelle déjà livrée (`toApiParams` traduit vers `value=real` ; le serveur ne connaît que nominal/real en R2). Conditions de validité : appliquées partout où l'Explorateur rend (decks, dossier, CSV transformé avant écriture, ligne d'unité dans l'en-tête CSV) ; testées unitairement ; documentées dans ⓘ. Bascule côté serveur seulement si une surface non-Explorateur en a un jour besoin.
*UI* : entrées TREND, désactivation donut/carte/KPI sommé, sélecteur d'année de base.
*Tests* : unités de transformation (ancrage, série sans valeur à la base, fenêtre décalée → ré-ancrage réécrit), e2e trajectoires.
*Risques* : faibles (aucune donnée, aucune migration) ; le piège est la cohérence CSV/decks — couverte par la règle « toute sortie passe par la transformation ».

### R3 — Per capita + % PIB, juridictions, perspectives

*Capacité* : ECONOMIC SCALE ; effort de financement et intensité reçue, perspectives forcées par la dimension.
*Données* : tables `jurisdictions` + `macro_series` ; chargeur WDI (`orion-ingest macro`) : `NY.GDP.MKTP.CD` (amendement R3), `SP.POP.TOTL` pour les juridictions actives (EU via `EUU`, US, FR, DE, … tous pays bénéficiaires) ; discipline vintage complète ; contrôles de cohérence Eurostat/BEA/ONU (écart relatif > 2 % → alerte d'ingestion, arbitrage humain).
*Sources/licences* : WDI CC BY 4.0 (vérification des métadonnées des indicateurs retenus à l'ingestion — certains indicateurs WDI sont d'origine tierce) ; attributions sur `/about-data`.
*UI* : entrées % of GDP / Per capita libellées par perspective, ligne d'unité avec juridiction, bande « GDP not yet published », ⓘ enrichi.
*Tests* : tests-or des ratios (cas fermés calculés à la main), grain projet vs participation par perspective, exclusions `no_gdp_year`/`no_population_year`, condition « dénominateur unique ».
*Recette* : rapprochement d'un point public connu (ex. effort Horizon/PIB UE d'une année donnée vs valeur publiée) avec écart expliqué par la différence cohorte/dépense — consigné, pas caché.
*Risques* : révisions WDI en place (couvert par vintages) ; tentation du « % PIB » sur des vues multi-financeurs (couverte par la règle b, testée) ; c'est le lot le plus lourd — il porte le modèle de juridictions.

### R4 — PPP

*Porte d'entrée* : étude d'agrégation géographique préalable — que signifie un agrégat PPP pour l'UE (PPS Eurostat vs dollar international WDI) ; combinaison PPP × année de référence (« constant intl $ ») ; choix du facteur (PIB vs consommation). Tant que l'étude n'est pas tranchée, le groupe PURCHASING POWER n'existe nulle part.
*Données* : `PA.NUS.PPP` (WDI, CC BY 4.0) dans `macro_series` ; OCDE en contrôle si les CGU intègrent la clause de pass-through.
*UI* : entrée PPP, avertissements ICP repris dans ⓘ.
*Risques* : méthodologiques essentiellement — c'est pour cela que le lot est derrière une étude, pas derrière du code.

### R5 — Dénominateurs « système de financement » — **instruit, GO à périmètre réduit (2026-08-26)**

L'étude comptable de la porte D12 a été menée, puis contre-relue : `docs/conception-r5-budget-denominators.md`. **Verdict `GO R5B avec périmètre réduit`** — une seule métrique survit, *Share of NSF award obligations*, sur le seul financeur NSF, en **métrique indépendante hors de ce moteur** (étude § 19) : le contrat R5B est **gelé** au § 20.1 de l'étude (amendement final et ultime verrou du 2026-08-26, **`R5B READY`** : numérateur et dénominateur issus du même artefact officiel per-award « @Award Details Sheet », éligibilité par présence dans le snapshot — jamais une règle Orion —, axe `fy=` propre à la surface, Top par obligations R5) et n'ouvre aucune ligne de code avant arbitrage fondatrice. Pour EC, NIH, GBARD et tout mode global, la première des quatre exigences (définir le dénominateur exact) échoue et le NO-GO demeure.

Les conditions d'un élargissement, vérifiables et chiffrées, sont écrites au § 20.4 de l'étude ; le geste conservatoire le plus urgent est nommé au § 20.3 (② vérifier que la moisson d'appels capte bien l'enveloppe — chaque appel qui quitte le portail sans son budget referme définitivement la seule route côté UE comptablement propre).

---

## Ce qu'on ne construit pas

- Aucune métrique dont numérateur et dénominateur ne sont pas méthodologiquement compatibles (porte D12).
- Aucun agrégat macro maison (somme de PIB de membres, PPP « moyen » inventé).
- Aucune colonne matérialisée sur `projects`/`participations` ; aucun étalement annuel inventé des cohortes.
- Aucune activation silencieuse d'un mode ; aucun repli silencieux vers le nominal ; aucun facteur artificiel 1,0.
- Aucune option grisée : un mode sans sens pour la vue n'apparaît pas.
- Aucune ingestion FMI, UIS ou ICP-cycles en l'état des licences ; aucune source dont la licence est « incertaine ».
- Pas de déflation par-juridiction (la convention par-devise du moteur A reste la règle) ; pas de méthode mensuelle ; pas d'inflation « R&D spécifique ».
- Pas de raccordement des fiches, de la recherche ni de `/compare` au Reference Engine avant décision dédiée (surfaces = Explorateur, comme au lot A).
- Deux interfaces séparées débutant/expert : refusé — progressive disclosure dans la même interface.

---

## Ce que je recommande à Charlotte de construire maintenant

**R1, et seulement R1** — en trois gestes, dans cet ordre :

1. **Figer la grammaire URL** (§ D10) : migration sèche `money`/`moneyYear` → `value`/`base`/`cur` dans le front, l'API et la clé de cache. C'est la décision la plus durable de tout le chantier et sa fenêtre de gratuité se ferme à la première publication — c'est pour cela qu'elle passe en premier.
2. **Livrer le sélecteur de lecture dans sa forme définitive** (§ D5.A), réduit au groupe VALUE (Nominal / Real value), avec la ligne d'unité (§ D7) et ⓘ Reference v1 (§ D8). Ajouter `cur` (EUR/USD au taux de l'année de référence) : c'est un scalaire de plus dans `factor_set`, et c'est ce qui rend le cas 4 (« Real 2025 · USD ») vrai dès la première publication.
3. **Publier A** ainsi habillé (push, déploiement, recette Firefox, checklist design), en gardant un œil sur le surcoût perf consigné — son déclencheur d'optimisation est déjà nommé.

Puis **R2** (Index 100 + croissance) : zéro donnée nouvelle, zéro migration, transformation testable côté client — le meilleur ratio valeur analytique/risque du plan, et il complète la légende composable pour le cas « USA écrase tout ».

Le modèle de juridictions (R3) est conçu, sourcé et licencié dans ce document ; il n'a **pas** besoin d'être construit pour publier R1-R2. Je recommande de ne l'ouvrir qu'une fois R1 en production et R2 recetté.

Arrêt ici pour arbitrage. A reste dormant en local jusqu'à ta décision.
