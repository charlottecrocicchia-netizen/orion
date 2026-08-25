# Conception R4 — Purchasing power (PPP)

> **Statut : étude méthodologique R4A, soumise à arbitrage — aucun code,
> aucune migration, aucune ingestion, aucune dépendance, aucune surface
> touchée.** Instruite le 2026-08-25 sur pièces officielles (métadonnées
> par indicateur de l'API World Bank v2, ICP, OCDE/Frascati, Eurostat) et
> sur mesures rejouables : corpus complet local (699 798 projets,
> 1 102 270 participations — l'état de référence R1) en lecture seule, et
> séries WDI millésime **2026-07-13**. Toutes les commandes et requêtes
> sont en annexe.
>
> **Porte zéro-dette franchie avant ouverture** : `make lint` sort en 0
> (ruff check + ruff format + oxlint, aucun avertissement) et
> `infra/README.md` décrit la production réelle depuis 6ee173f. Aucune
> dette connue n'a été reportée dans ce lot.
>
> **Amendement du 2026-08-25 (porte § 5 de R4B, arbitré)** — la mesure
> préalable au codage des exclusions a infirmé la taxonomie à deux
> motifs : une juridiction peut posséder le couple sur d'autres années
> et pas sur l'année cadrée. Un **troisième motif partiel**
> `no_reference_year` est ajouté (§ 15.2), et un **troisième refus de
> vue** `ppp_reference_unavailable_for_view` couvre le périmètre filtré
> dont plus rien n'est convertible (§ 15.3). P14 bis, § 4.4, § 13.4,
> § 15 et le plan § 17 sont amendés en conséquence.
>
> Ce document **amende R0** (`docs/conception-reference-engine.md`) : la
> formule `ppp` de son § D1, la ligne `ppp` de la matrice § D4, le
> paramètre « Reference year » du § D6 et la grammaire `value=ppp&base=`
> du § D10 sont **remplacés** par les décisions ci-dessous.

---

## 0. Les décisions en une page

| # | Décision | § |
|---|---|---|
| P1 | La question posée est **spatiale** : quelle quantité relative de ressources locales ce financement pouvait-il commander dans le pays du bénéficiaire, compte tenu de son niveau général de prix. Jamais « la valeur du transfert ». | 1 |
| P2 | Le libellé est **general purchasing-power adjustment** / *ajustement au pouvoir d'achat général*. Orion n'affirme jamais mesurer le coût des chercheurs, des équipements, des semi-conducteurs, du calcul ou de l'immobilier de laboratoire. | 1 |
| P3 | **Route B retenue** : `ratio_PPP(pays, année) = NY.GDP.MKTP.PP.CD / NY.GDP.MKTP.CD`, deux séries WDI publiées, CC BY-4.0 vérifié par indicateur. Elle coïncide avec la reconstruction par facteurs là où les identités WDI sont alignées, et Orion **ne reconstruit rien** là où elles divergent — il consomme le couple publié. **Route A (facteur `PA.NUS.PPP` en monnaie locale) rejetée** — Orion n'a pas de montants en monnaie locale, le WDI ne publie aucun facteur PPP pour l'agrégat UE, et le couple `PA.NUS.FCRF` × `PA.NUS.PPP` est **faux sur toute redénomination monétaire** (démontré : 843 M€ du corpus faux d'un facteur 2 à 30). | 2, 3 |
| P3 bis | **Invariant de millésime.** `macro_series.vintage_date` est la date d'ingestion Orion, écrite par (juridiction, concept) et seulement si les valeurs changent : deux concepts cohérents portent donc légitimement des dates différentes, et « dernières vintages lues séparément » ne prouve rien. R4B fait du couple une **unité d'écriture** — une nouvelle vintage pour l'un en écrit une pour l'autre — de sorte que, par juridiction, les deux concepts partagent **la même dernière `vintage_date`**. La lecture refuse tout couple à vintages divergentes. Sans migration. | 17, étape 3 |
| P4 | **Dollars internationaux courants uniquement.** Le « constant international $ » est **refusé en V1** : la chaîne reconstructible par Orion s'écarte de la série publiée par la Banque mondiale de −11 % à +13 % selon le pays et l'année (mesuré). Pas de paramètre `base`. | 4 |
| P4 bis | **Année d'attribution unique.** Le mode n'existe que sur une vue cadrée sur une seule année : une somme pluriannuelle mélangerait des dollars internationaux de millésimes différents, avec un effet de profil temporel mesuré jusqu'à **16 points** entre pays. Bénéfice second : la couverture passe de 98,2 % à **plus de 99,9 %**. | 4.4 |
| P4 ter | **La convention de change du dénominateur est nommée.** `NY.GDP.MKTP.CD` incorpore le **DEC alternative conversion factor** du WDI (`PA.NUS.ATLS`), pas un taux de marché : le mode livre une estimation adossée aux conventions macroéconomiques du WDI, jamais le taux obtenu par un bénéficiaire. La formule de production reste **exclusivement** le rapport du couple publié — `ATLS` n'est **jamais** une voie de calcul alternative (l'égalité `ratio = ATLS/PPP` est fausse là où l'identité du numérateur casse : Inde 2,959 %, Nigeria 28,988 %). **Avertissement ajouté au `ⓘ`**. | 3.6 |
| P5 | **Perspective bénéficiaire exclusivement.** Le PPP financeur est **interdit** : 18,96 % du financement CORDIS (33,2 Md€) est reçu hors UE-27 — un « niveau de prix UE » appliqué à cet argent ne décrit aucune économie réelle. | 5 |
| P6 | **Grain participation, toujours.** `PPP(projet multinational) = Σ des participations converties au pays de chacune`. Interdits : PPP du coordinateur, PPP du financeur, moyenne des PPP des pays, PPP « maison ». | 6 |
| P7 | **Additionner entre pays, dans la même unité et pour la même année, est cohérent avec la pratique d'agrégation du WDI** — l'agrégat UE publié **est** la somme exacte de ses 27 membres (écart 0,000 % sur 2010-2025, mesuré). Ce n'est **pas** une affirmation générale d'additivité des PPP, qui serait fausse. Aucun agrégat PPP maison. | 7 |
| P8 | **Base PIB**, pas consommation — recommandation du Manuel de Frascati 2002 § 35, pratique constatée par la NSF/NCSES, séries en PPS chez Eurostat. L'écart avec la base consommation est matériel (−2,16 % global, jusqu'à −12,2 % pour le Danemark) : le choix est documenté, jamais implicite. | 8 |
| P9 | `ppp` est un **mode alternatif à `real`**, jamais une transformation de `real`. Il corrige l'espace, pas le temps. | 9 |
| P10 | **TREND reste sur `real`.** Ni Index 100 ni croissance annuelle en PPP tant qu'un dollar international constant n'est pas défini. | 10 |
| P11 | **Top stable** : le classement reste nominal (verrou R3, déjà en code). Le PPP change l'ordre — mesuré sur la vue pays 2023, onze rangs bougent dans le seul Top 20 (FR 3ᵉ → 4ᵉ, ES 4ᵉ → 3ᵉ, PT 14ᵉ → 9ᵉ) — donc il ne doit jamais reclasser en silence. | 11 |
| P12 | **Surfaces V1 : `by=country`, `by=region`, `by=organisation`, `by=orgtype`**, **sur une année unique**, dans l'**Explorateur** — paramètre `compare=` compris, qui est un filtre de la même vue. Absent de `by=year`, `by=funder`, `by=programme`, `by=subdivision`, de toute fenêtre pluriannuelle, et de la **page `/compare`**, surface distincte à endpoint propre jamais raccordée au Reference Engine. Règle vérifiable : `ppp` n'apparaît que là où le nominal est **déjà** au grain participation — aucun changement de population entre les deux modes. | 12 |
| P13 | Grammaire URL : **`value=ppp`**, sans `base`, sans `cur`. | 14 |
| P14 | Couverture mesurée sur une vue à année unique : **> 99,9 %** de la valeur affichée (99,997 % en 2019, 99,913 % en 2025). 2026 et 2027 n'ont pas encore leurs séries : ces années **refusent la vue entière** (`422`) au lieu d'exclure en silence. | 15 |
| P14 bis | **Deux natures séparées, jamais confondues.** *Exclusions partielles*, dans une vue qui existe : `no_country`, `no_jurisdiction_series`, `no_reference_year` (la juridiction a le couple sur d'autres années, pas sur celle cadrée). *Refus de vue*, pour une vue non définie : `422 ppp_requires_single_award_year`, `422 ppp_year_unavailable` (aucune juridiction ne publie l'année — 2026, 2027), `422 ppp_reference_unavailable_for_view` (le **périmètre filtré affiché** a de la valeur nominale mais rien de convertible). Une vue refusée n'est **jamais** présentée comme « 100 % exclu ». | 13.4, 15.2, 15.3 |
| P15 | Verdict : **GO R4B à périmètre réduit** — voir le dernier chapitre. | fin |

---

## 1. La question utilisateur — ce que « PPP-adjusted » veut dire dans Orion

### 1.1 La formulation candidate, corrigée

La formulation soumise était :

> « Quelle quantité relative de ressources le financement reçu permet-il
> théoriquement d'acheter dans le pays bénéficiaire, compte tenu de son
> niveau général de prix ? »

Elle est **méthodologiquement correcte**, à trois conditions de rédaction
qui ne sont pas cosmétiques :

1. **« ressources » au sens du panier du PIB**, pas des intrants de la
   recherche. Le facteur PPP du PIB compare le prix d'un panier
   représentatif de la production d'une économie, pas celui d'un
   spectromètre ou d'un post-doctorat.
2. **« théoriquement »** doit rester : c'est une conversion, pas une
   observation de dépense. Orion n'observe pas ce qui a été acheté.
3. **« dans le pays bénéficiaire »** engage une hypothèse nommée : que
   l'argent est dépensé là où il est reçu. Le § 16 attaque cette
   hypothèse ; elle tient pour l'essentiel du corpus, pas partout.

La question retenue, telle qu'elle sera écrite dans le produit :

> **Combien de ressources locales ce financement pouvait-il commander
> dans le pays du bénéficiaire, une fois neutralisées les différences de
> niveau général des prix entre pays ?**

### 1.2 Pouvoir d'achat général ≠ coût réel de la R&D — sur pièces

| Source | Ce qu'elle dit | Conséquence pour Orion |
|---|---|---|
| **Manuel de Frascati 2002** (OCDE), **§ 35** (section 1.7.2), renvoi à l'**annexe 10** — passage lu dans le texte intégral de cette édition | Le Manuel **recommande** les PPP générales et l'indice implicite de prix du PIB pour les statistiques de R&D, tout en reconnaissant qu'elles reflètent le **coût d'opportunité des ressources consacrées à la R&D**, et non les montants « réels » en jeu. L'annexe 10 ajoute que les PPP générales sont calculées sur un panier de biens et services entrant dans le PIB (une **production**), alors que les dépenses de R&D sont essentiellement des **intrants**. **Édition** : la formulation citée est celle de 2002 ; l'édition 2015 n'a **pas** été vérifiée passage en main et n'est donc pas invoquée ici. | C'est **l'argument central** : l'usage est légitime et standard, mais la grandeur obtenue est un coût d'opportunité, pas un coût de la recherche. Le libellé produit doit le dire. |
| **Métadonnées WDI de `PA.NUS.PPP`** (origine ICP) | Usages recommandés : comparaisons **spatiales** du PIB et de ses composantes de dépense, comparaisons spatiales de niveaux de prix. Usages recommandés **avec limites** : utiliser les PPP du PIB comme **déflateurs d'autres valeurs**. Usages **non recommandés** : établir des classements stricts entre pays, construire des taux de croissance nationaux, comparer productivité et production par industrie, juger de la sur/sous-évaluation d'une monnaie. | Orion relève de la deuxième ligne — « avec limites ». Et la troisième ligne interdit **structurellement** de reclasser le Top en PPP (§ 11). |
| **ICP — FAQ officielle (Banque mondiale)** | Les PPP sont conçues pour comparer le PIB ; elles **ne sont pas conçues** pour comparer les flux d'investissement, l'aide, le commerce international, les réserves de change ou les transferts de migrants — ces comparaisons doivent se faire **aux taux de change de marché**. | C'est **l'objection la plus sérieuse** contre R4. Elle est traitée frontalement au § 1.3. |
| **ICP — page Uses** | Les PPP sont des estimations statistiques sujettes à erreurs d'échantillonnage, de mesure et de classification : à traiter comme des **approximations**. Il ne faut pas conclure sur de **petits écarts** entre économies ; les marges d'erreur ne sont pas estimables directement. | Interdit de faire raconter au produit un écart de quelques points entre deux pays voisins. |
| **NSF / NCSES** (comparaisons internationales de R&D) | Des questions non résolues subsistent sur l'usage des PPP du PIB pour déflater les dépenses de R&D ; les PPP des grandes économies en développement sont des approximations grossières. | Confirme, côté américain, que la limite est reconnue par les producteurs eux-mêmes. |
| **Eurostat** | Les dépenses de R&D sont publiées en **PPS** — unité artificielle où 1 PPS vaut 1 euro **au niveau de prix moyen de l'UE-27**. | Le PPS n'est **pas** un dollar international (dont le référentiel est le niveau de prix des États-Unis). Les deux unités ne se mélangent jamais (§ 7.3). |

### 1.3 L'arbitrage de fond : Orion mesure-t-il un flux ?

L'ICP dit d'utiliser les taux de marché pour comparer des flux (aide,
investissement, commerce). Orion observe des **cohortes d'engagement** —
des attributions, pas des dépenses mesurées (R0 § D12 l'a déjà établi
pour bloquer les dénominateurs budgétaires). Un financement attribué
**est** un flux. La question est donc réelle et mérite une réponse
explicite, pas un contournement.

**Ce qui distingue les deux usages est la question posée, pas
l'arithmétique.**

- Comparer des flux *en tant que grandeurs monétaires* — « qui a reçu
  le plus d'argent » — appelle le taux de marché. C'est ce que fait
  déjà Orion : le mode `nominal` est cette réponse, et il reste le
  **défaut**.
- Demander *quel volume de ressources locales* un montant pouvait
  commander est une question de volume, pas de flux. C'est
  précisément l'usage listé par l'ICP comme recommandé **avec
  limites** : « utiliser les PPP du PIB comme déflateurs d'autres
  valeurs ».

**Règle gravée qui en découle** — et qui est la condition de validité de
tout le lot :

> Le mode `ppp` ne répond **jamais** à « combien d'argent ce pays
> a-t-il reçu ». Il répond à « quel volume de ressources locales cet
> argent pouvait commander ». Toute formulation d'interface, d'unité,
> d'export ou de méthodologie qui présente le PPP comme une comparaison
> de montants reçus est un défaut, pas une approximation.

Cette règle a des conséquences testables : le libellé d'unité ne dit
jamais « funding », mais « purchasing power » ; l'avertissement ICP sur
les flux est **affiché**, pas seulement documenté ; et le classement
reste nominal (§ 11).

---

## 2. Les séries — indicateur par indicateur, sur pièces

Audit mené le 2026-08-25 sur l'API World Bank v2 : définition longue,
unité, source, méthode, période de référence, périodicité, limites, et
**`License_Type` lu par indicateur** (la discipline posée par R0 § D11 et
appliquée en R3).

### 2.1 Retenues

| | `NY.GDP.MKTP.PP.CD` | `NY.GDP.MKTP.CD` |
|---|---|---|
| **Nom officiel** | GDP, PPP (current international $) | GDP (current US$) |
| **Unité** | dollar international courant | dollar US courant |
| **Source amont** | ICP (Banque mondiale), programme PPP Eurostat, programme PPP OCDE, estimations des services de la BM, comptes nationaux OCDE, WEO du FMI | statistiques officielles nationales, comptes nationaux OCDE, estimations des services de la BM |
| **Méthode** | PIB converti par les PPP ; séries **chaînées** pour lisser les ruptures de base et de méthode (le chaînage utilise les taux de croissance nominaux des archives WDI) | idem pour le chaînage ; conversion aux taux officiels retenus par la BM |
| **Période de référence** | 1990-2025 | 1990-2025 |
| **Périodicité / révisions** | annuelle ; le WDI **révise en place** et republie trimestriellement | idem |
| **Benchmark ICP sous-jacent** | cycles ICP **2011, 2017, 2021** ; l'ICP 2021 a couvert **176 économies** dont 49 du programme Eurostat-OCDE | — |
| **Extrapolation entre benchmarks** | hors 2011-2021, le WDI extrapole avec le **déflateur du PIB** du pays rapporté à celui des États-Unis ; les pays Eurostat-OCDE reçoivent des PPP annuelles mesurées par leurs programmes | — |
| **Couverture mesurée (2024)** | 242 économies | 247 économies |
| **`License_Type`** | **CC BY-4.0** | **CC BY-4.0** |
| **Restrictions tierces** | aucune constatée au niveau du WDI ; les intrants tiers (ICP, Eurostat, OCDE, WEO) sont redistribués sous la licence du WDI — c'est exactement le cas prévu par R0 § D11 et vérifié ici indicateur par indicateur | idem |

**Verdict : admises**, comme **couple indissociable**. Elles ne sont
jamais utilisées séparément : seul leur **rapport** entre dans le calcul
(§ 3).

### 2.2 Documentées et écartées

| Série | Ce qu'elle est | Pourquoi elle n'est pas retenue |
|---|---|---|
| **`PA.NUS.PPP`** — *PPP conversion factor, GDP (LCU per international $)*, CC BY-4.0, 1990-2025, 195 économies en 2024 | Le facteur PPP canonique, en **monnaie locale** par dollar international. | Orion n'a **aucun montant en monnaie locale** : le corpus est EUR et USD (R1 § 1.1). L'utiliser suppose une conversion préalable vers ~200 monnaies locales qu'Orion ne possède pas. De plus le WDI **ne publie pas** ce facteur pour l'agrégat Union européenne (vérifié : 0 valeur, ni `EU` ni `XC`), ce qui condamne la voie pour toute lecture UE. Écartée **comme canal de calcul** ; conservée comme **analyse documentaire** (§ 3.3), jamais comme contrôle de production. |
| **`PA.NUS.FCRF`** — *Official exchange rate (LCU per US$, period average)*, CC BY-4.0, source amont **FMI/IFS** | Le taux de change qui permettrait de passer de l'USD à la monnaie locale pour appliquer `PA.NUS.PPP`. | **Rejetée** : la série est exprimée dans la **monnaie de l'époque**, alors que `PA.NUS.PPP` est réexprimée dans la **monnaie actuelle** sur tout l'historique. Leur rapport est faux sur toute redénomination — démontré au § 3.3 sur 843 M€ du corpus. Deuxième motif, indépendant : la Banque mondiale utilise pour certains pays un **facteur de conversion alternatif** différent de ce taux officiel (Argentine, Égypte : écarts mesurés jusqu'à 21 %). |
| **`PA.NUS.PPPC.RF`** — *Price level ratio of PPP conversion factor (GDP) to market exchange rate* | L'indicateur qui donnerait directement l'inverse du ratio recherché. | **Inutilisable** : son `source` est **« WDI Database Archives »** — la série est archivée, et la base WDI vivante ne renvoie **aucune valeur** (vérifié sur 21 économies, 2000-2025 : 0 observation). Une série archivée n'est pas une source de production. |
| **`NY.GDP.MKTP.PP.KD`** — *GDP, PPP (constant 2021 international $)*, CC BY-4.0, `Aggregationmethod: Gap-filled total` | La seule série de dollars internationaux **constants** publiée. | Sa base est **2021** — l'année de benchmark ICP, pas une année choisie. Elle porte le PIB, pas un montant quelconque : elle ne fournit **aucun facteur** applicable à un financement. Documentée au § 4, non utilisée en V1. |
| **`PA.NUS.PRVT.PP`** et le couple **`NE.CON.PRVT.PP.CD` / `NE.CON.PRVT.CD`** — PPP et agrégats de **consommation finale des ménages** | La famille PPP « consommation », alternative à la famille PIB. | Techniquement disponible (195 économies en 2024 pour le couple, agrégat UE publié) : le choix n'est donc **pas** dicté par la disponibilité. Écartée pour motif méthodologique documenté au § 8 — et l'écart est chiffré, pas supposé. |
| **Données de cycle ICP** (ICP 2017, ICP 2021) | Les benchmarks eux-mêmes. | **Exclues**, décision R0 § D11 inchangée : label de licence non confirmé sur la fiche du dataset. Le canal licencié est le WDI. « Pas sûr = pas ingéré. » |
| **OCDE (Data Explorer, PPP)** | PPP annuelles des pays membres, source amont d'une partie du WDI. | **En réserve**, décision R0 inchangée : les conditions OCDE imposent la propagation de l'attribution à toute sous-licence, ce que les CGU d'Orion ne reflètent pas encore. Couverture non mondiale. Candidate au rôle de **contrôle**, jamais de source. |
| **Eurostat PPS** | Les PPP européennes, unité PPS (1 PPS = 1 EUR au niveau de prix moyen UE-27). | **Pas une alternative** : unité différente du dollar international. Utilisable un jour comme contrôle sur le périmètre UE, jamais mélangée (§ 7.3). |

### 2.3 Ce que le millésime implique

Le millésime lu le 2026-08-25 est **2026-07-13**. Trois faits à graver
dans l'ingestion R4B :

1. **Le prochain cycle ICP (2024) révisera tout l'historique**, pas
   seulement les années récentes : les PPP entre benchmarks sont des
   extrapolations ancrées au dernier benchmark. Un chiffre PPP d'Orion
   n'est reproductible **qu'avec son millésime** — la discipline
   `vintage_date` de `macro_series` (R3) n'est pas un confort, c'est la
   condition de rejouabilité, et le millésime doit être **affiché**.
2. **Le WDI ne signale pas les valeurs imputées.** L'ICP 2021 a couvert
   176 économies ; le WDI publie un facteur PPP pour **201** économies
   en 2021. L'écart — de l'ordre de 25 économies — est imputé par
   **modèle de régression**, et le champ `obs_status` de l'API est vide
   (vérifié sur les Bermudes 2021). Orion ne peut donc pas distinguer,
   série en main, une PPP mesurée d'une PPP estimée. Ce fait est
   **dit** en méthodologie ; il ne bloque pas le lot, il interdit d'en
   tirer des lectures fines sur les petites économies (§ 16).
3. **La dernière année est incomplète.** 195 économies ont une PPP en
   2024, 185 en 2025 : le bord haut de la série se remplit
   progressivement. Le traitement est celui, déjà en place, des
   références manquantes : exclusion comptée, jamais extrapolation
   maison.

---

## 3. Route A vs Route B — démonstration et contrôles empiriques

### 3.1 Les deux routes, écrites proprement

**Route A — par la monnaie locale.** Conceptuellement :

```
montant_LCU(pays, année) / PPP_LCU_par_$intl(pays, année) = $ internationaux courants
```

Orion ne dispose d'aucun montant en monnaie locale : le corpus est
**EUR et USD**. La route A ne s'applique donc qu'après un détour :

```
montant_EUR → USD (taux BCE de l'année) → LCU (taux de change du pays)
             → / PPP  =  montant_USD × [ FX_LCU/USD(pays, année) / PPP_LCU(pays, année) ]
```

Autrement dit, **pour Orion, la route A est le produit d'un taux de
change de marché par l'inverse d'un facteur PPP**. Elle exige une source
de change mondiale : les taux BCE en base couvrent **9 devises**, le WDI
en offre une (`PA.NUS.FCRF`, origine FMI/IFS).

**Route B — par le rapport de deux agrégats publiés.**

```
ratio_PPP(pays, année) = NY.GDP.MKTP.PP.CD(pays, année) / NY.GDP.MKTP.CD(pays, année)
montant_$intl = montant_USD_courant × ratio_PPP(pays, année)
```

### 3.2 L'identité attendue, et ses hypothèses

Les deux routes coïncident si et seulement si les deux identités de
construction du WDI tiennent simultanément :

```
(i)   NY.GDP.MKTP.PP.CD  =  NY.GDP.MKTP.CN / PA.NUS.PPP      (PIB en LCU divisé par la PPP)
(ii)  NY.GDP.MKTP.CD     =  NY.GDP.MKTP.CN / FX              (PIB en LCU divisé par le taux de conversion)
```

Alors `ratio_PPP = FX / PPP`, qui est exactement le facteur de la route A
— et l'inverse du *price level index* du pays par rapport aux États-Unis.

**Hypothèses de cette identité, à vérifier et non à supposer :**

1. `NY.GDP.MKTP.CN`, `PA.NUS.PPP` et le taux de change sont exprimés
   dans **la même unité monétaire** pour la même année ;
2. la Banque mondiale utilise bien le **taux officiel** comme facteur de
   conversion — elle recourt pour certains pays à un **facteur de
   conversion alternatif** ;
3. les trois séries reposent sur la **même série de PIB** (mêmes base,
   même chaînage, même calendrier fiscal/civil).

### 3.3 Contrôles empiriques — ce qui a été mesuré

Séries WDI millésime 2026-07-13, années 2010-2025. `id1` teste (i),
`id2` teste (ii), « route B vs A' » compare `GDP_PPP/GDP_USD` à
`FCRF/PPP`.

| Pays | max \|écart\| id1 | max \|écart\| id2 | max \|écart\| A' vs B | Lecture |
|---|---:|---:|---:|---|
| US | 0,000 % | 0,000 % | 0,000 % | identité exacte, ratio = 1 par construction |
| FR | 0,000 % | 0,000 % | 0,000 % | exact |
| DE | 0,000 % | 0,000 % | 0,000 % | exact |
| PL | 0,000 % | 0,000 % | 0,000 % | exact |
| SE | 0,000 % | 0,000 % | 0,000 % | exact |
| DK | 0,000 % | 0,000 % | 0,000 % | exact |
| JP | 0,000 % | 0,000 % | 0,000 % | exact |
| KR | 0,000 % | 0,000 % | 0,000 % | exact |
| CH | 0,000 % | 0,013 % | 0,013 % | exact aux arrondis |
| LU | 0,000 % | 0,000 % | 0,000 % | exact |
| BM | 0,000 % | 0,000 % | 0,000 % | exact (économie dollarisée) |
| TR | 0,000 % | 0,000 % | 0,000 % | exact **malgré une inflation très élevée** |
| **IN** | **2,959 %** | 3,249 % | **4,024 %** | écart **constant** de 2,959 % sur 2010-2021 : la série de PIB en roupies n'est pas celle qui sert au calcul de la PPP (année fiscale) |
| **AR** | 0,000 % | **11,103 %** | **9,993 %** | la BM utilise un **facteur de conversion alternatif** : le taux officiel ne décrit pas la conversion réellement employée |
| **EG** | 0,000 % | **21,116 %** | **26,768 %** | idem, aggravé par les dévaluations 2023-2024 |
| **NG** | **28,988 %** | 0,998 % | **29,211 %** | écart **constant** de 28,988 % sur 2010-2018, nul à partir de 2019 : rupture de série de PIB non répercutée sur le facteur PPP |
| **EU** | *non calculable* | *non calculable* | *non calculable* | **le WDI ne publie ni `PA.NUS.PPP` ni `NY.GDP.MKTP.CN` pour l'agrégat UE** — la route A n'existe pas ; la route B, oui (ratio 1,3910 en 2025) |
| **XC** (zone euro) | *non calculable* | *non calculable* | *non calculable* | idem |

**Le défaut décisif : les redénominations monétaires.** `PA.NUS.PPP` est
publiée dans la monnaie **actuelle** du pays sur **tout** l'historique ;
`PA.NUS.FCRF` conserve la monnaie **de l'époque**. Leur rapport est donc
faux avant tout changement de monnaie — d'un facteur exactement égal au
taux de conversion officiel :

| Pays | Changement de monnaie | `A'/B` avant | Taux de conversion officiel | Valeur Orion **des années touchées** |
|---|---|---:|---|---:|
| Bulgarie | euro 2026 | **×1,9558** *(toute la série)* | 1,95583 BGN/EUR | 442,7 M€ (2007-2025) |
| Croatie | euro 2023 | **×7,53** | 7,53450 HRK/EUR | 243,8 M€ (2007-2022) |
| Lituanie | euro 2015 | **×3,45** | 3,45280 LTL/EUR | 50,3 M€ (2007-2014) |
| Estonie | euro 2011 | **×15,65** | 15,6466 EEK/EUR | 39,5 M€ (2004-2010) |
| Zimbabwe | redénominations successives | **~×7 × 10¹³** | — | 27,8 M€ |
| Ghana | cedi 2007 | | | 16,2 M€ (2004-2005) |
| Slovaquie | euro 2009 | **×30,13** | 30,1260 SKK/EUR | 12,7 M€ (2007-2008) |
| Liban, Malte, Venezuela, Guyana, Iran, Liberia, Myanmar | divers | | | 9,9 M€ cumulés |
| | | | **Total** | **843,0 M€** |

Soit **0,117 %** du périmètre où les deux routes sont définies — une
part faible, mais concentrée sur cinq États membres de l'Union et
**fausse d'un facteur 2 à 30**, pas approximative. Le comptage retient
les cellules (pays, année) où `A'/B` s'écarte de plus de 50 % ; leurs
bornes hautes coïncident **exactement** avec l'année d'adoption de
l'euro de chaque pays, ce qui identifie le mécanisme sans ambiguïté.

**Vérification de contrôle** : dès l'année d'adoption de l'euro, `A'`
redevient **exactement** égal à `B` (Croatie 2023 : 2,1529 des deux
côtés ; Estonie 2011 : 1,4042 ; Slovaquie 2009 : 1,3913). L'identité est
donc bien réelle — c'est l'unité monétaire qui la brise, pas la théorie.

### 3.4 Écart global sur le corpus réel

Sur les 719,5 Md€ de participations où les deux routes sont définies :

- en écartant les 58 cellules touchées par une redénomination
  (400,3 M€), l'écart global pondéré entre les deux routes est de
  **−0,02 %** ;
- les écarts résiduels significatifs sont ceux des facteurs de
  conversion alternatifs et des ruptures de série : NG −24,7 %,
  VN −14,4 %, BD −11,3 %, UG −11,2 %, KE −8,3 %, GH −7,6 %, EG +7,0 %,
  ET +3,8 %, LV −3,3 %, IN +2,1 % ;
- la Bulgarie apparaît à +95,6 % : c'est le facteur 1,9558 ci-dessus,
  pas une divergence méthodologique.

### 3.5 Verdict — Route B

**Route B retenue**, pour cinq raisons cumulatives et vérifiables. Elle
n'est pas retenue parce qu'elle serait *équivalente* à la route
canonique — le § 3.3 montre qu'elle ne l'est pas partout — mais parce
qu'elle **évite la reconstruction** là où l'équivalence cesse :

1. **Elle est définie partout où Orion en a besoin**, y compris pour
   l'agrégat Union européenne, que la route A ne couvre pas.
2. **Elle coïncide avec la reconstruction là où les identités WDI sont
   alignées** (0,000 % sur douze pays de contrôle) et s'en écarte
   **exactement** là où l'une d'elles casse — ce qui désigne la
   reconstruction, et non le couple publié, comme la voie douteuse.
3. **Elle n'introduit aucune donnée que nous n'avons pas** : ni les
   ~200 monnaies locales, ni une source de change mondiale. Deux séries,
   un rapport.
4. **Elle est immune aux redénominations** : aucune monnaie locale
   n'apparaît dans le calcul. Les 843,0 M€ que la route A abîme sont
   exacts en route B.
5. **Elle est cohérente avec la source** : quand la Banque mondiale
   utilise un facteur de conversion alternatif pour un pays, la route B
   l'utilise aussi, puisqu'elle repart des deux agrégats publiés. La
   route A, elle, mélangerait le taux officiel du FMI avec une PPP
   calibrée sur un autre facteur.

**Condition de validité nommée** : la route B suppose que les deux
séries du couple portent sur **le même pays, la même année et le même
état de source**. Cette dernière clause n'est pas une formalité — le
§ 17, étape 3, établit ce que `vintage_date` signifie réellement dans
le modèle R3, pourquoi la propriété n'est aujourd'hui garantie que par
convention d'exploitation, et par quelle règle d'écriture R4B la rend
**portée par la donnée**, donc vérifiable et testable.

**Statut exact de la route A, désormais unique dans ce document** : elle
est une **analyse méthodologique historique et documentaire**, conservée
ici parce qu'elle explique *pourquoi* le couple publié est consommé
directement. Elle n'est **jamais** un chemin de calcul, et
`FCRF / PPP` n'est **jamais** un garde-fou de production : ni gate, ni
seuil, ni alerte. Le filet bloquant porte **uniquement** sur le couple
publié réellement consommé ; l'examen de `ATLS`, `PPP`, `FCRF` et
`GDP_LCU` reste un **audit diagnostique non bloquant**, hors chaîne
(§ 17, étape 2).

### 3.6 Ce que le ratio mesure exactement — la convention de change

Objection de contre-relecture, instruite le 2026-08-25 et **retenue**.

Le dénominateur `NY.GDP.MKTP.CD` n'est pas construit au taux de change
officiel. Le WDI le convertit avec le **DEC alternative conversion
factor** (`PA.NUS.ATLS`), dont la définition officielle énonce deux
clauses : il vaut en règle générale le taux officiel du FMI, mais un
facteur alternatif est employé ① quand le taux officiel diverge d'une
marge exceptionnellement grande de celui effectivement appliqué aux
transactions domestiques — cas des **taux multiples ou administrés** —
et ② quand la **période des comptes nationaux diffère de l'année
civile**, le facteur couvrant alors la même période.

**Vérifié, et seulement cela** : l'identité porte sur le
**dénominateur**, `NY.GDP.MKTP.CD = NY.GDP.MKTP.CN / PA.NUS.ATLS`. Elle
tient sur **5 428 cellules (pays, année) testables, soit 100,000 %**,
toutes économies confondues, 2000-2027 — y compris là où le taux officiel
s'écarte fortement (Argentine 11,10 %, Égypte 21,12 %, Éthiopie 17,58 %,
Ouganda 12,74 %, Australie 9,70 %, Haïti 9,07 %, Bangladesh 5,92 %) et y
compris pour les pays ayant changé d'unité monétaire, `PA.NUS.ATLS`
suivant la même unité que le PIB en monnaie locale. C'est la seule
identité de conversion établie sans exception dans ce document.

**Conséquence, à énoncer sans détour :**

> Le dénominateur `GDP current US$` **incorpore la convention de
> conversion `PA.NUS.ATLS`**. Le mode `ppp` ne mesure donc **pas** le
> taux de change effectivement obtenu par un bénéficiaire : il produit
> une estimation de pouvoir d'achat reposant sur les **conventions
> macroéconomiques du WDI pour la conversion des comptes nationaux**.
> Pour une économie à taux multiples ou administré, ou dont l'année
> comptable n'est pas l'année civile, l'écart entre cette convention et
> ce qu'un organisme obtient réellement au guichet peut être
> considérable.

**Ce qu'il ne faut surtout pas en déduire — verrou de cohérence.**

Il serait tentant d'écrire `ratio_PPP = PA.NUS.ATLS / PA.NUS.PPP`. **Ce
serait faux**, et le présent document en porte lui-même la
démonstration. L'égalité exigerait que le *numérateur* obéisse à son
identité symétrique, `NY.GDP.MKTP.PP.CD = NY.GDP.MKTP.CN / PA.NUS.PPP` —
or le § 3.3 établit qu'elle **ne tient pas universellement** : Inde
2,959 % (écart constant 2010-2021), Nigeria 28,988 % (écart constant
2010-2018). Mesure directe, qui le confirme au centième près :

| Pays | `ratio_B` vs `ATLS/PPP` | identité du numérateur (§ 3.3) |
|---|---:|---:|
| US, FR, DE, PL, JP, KR, CH, TR, AR, EG, UG, ET, AU, HR, BG | 0,000 % | 0,000 % |
| **Inde** | **2,959 %** | **2,959 %** |
| **Nigeria** | **28,988 %** | **28,988 %** |

L'écart de `ATLS/PPP` au ratio de production est **exactement** l'écart
de l'identité du numérateur : là où celle-ci casse, la formule
« ATLS / PPP » se trompe d'autant.

> **Règle gravée.** La formule de production est **exclusivement**
> `ratio_PPP = NY.GDP.MKTP.PP.CD / NY.GDP.MKTP.CD`, à **pays, année et
> millésime identiques**. `PA.NUS.ATLS` sert **uniquement** à expliquer
> et auditer la convention de conversion du dénominateur. Elle ne
> devient **jamais** une troisième manière de calculer le ratio PPP,
> pas plus que `PA.NUS.PPP` n'en était une deuxième.

Ces divergences documentées entre `GDP_PPP`, `GDP_LCU` et `PA.NUS.PPP`
sont d'ailleurs **une raison de plus** de consommer le couple d'agrégats
publié plutôt que de reconstruire une route intermédiaire : chaque
reconstruction ajoute une hypothèse d'identité que la source ne garantit
pas, et chacune casse quelque part.

**Exposition mesurée du corpus** — valeur en (pays, année) où le facteur
retenu par le WDI diffère du taux officiel de plus de 0,5 %, hors pays
ayant changé d'unité monétaire (dont l'écart est un artefact de
comparaison, § 3.3) :

| | Valeur | Part du périmètre calculable |
|---|---:|---:|
| Écart > 0,5 % | 2,889 Md€ | **0,402 %** |
| dont écart > 10 % | 1,464 Md€ | **0,203 %** |

Les premiers contributeurs : Ouganda 1 139,7 M€ (12,74 %), Nigeria
627,4 M€ (1,05 %), Haïti 348,8 M€ (9,07 %), Australie 278,1 M€ (9,70 %),
Éthiopie 238,8 M€ (17,58 %), Inde 119,4 M€ (5,72 %), Égypte 31,1 M€
(21,12 %), Argentine 23,4 M€ (11,10 %), Pakistan 18,3 M€ (13,21 %),
**Liban 9,2 M€ (1 711 %)**.

Lecture honnête de cette liste : la cause **dominante** est la clause ②
— année comptable non civile (Ouganda, Haïti, Australie, Éthiopie, Inde,
Égypte, Bangladesh, Pakistan). La clause ① — taux multiples ou
administrés — pèse beaucoup moins en valeur, mais frappe fort là où elle
s'applique : le Liban, dont la parité officielle est restée figée
pendant l'effondrement de la livre, en est l'illustration extrême.

**Cette objection ne révèle pas de contradiction plus profonde, et la
formule de production ne change pas** — pour trois raisons vérifiables :

1. Une conversion « au taux réellement obtenu » **n'existe pas** comme
   donnée : Orion ne sait pas à quel taux un bénéficiaire a converti, ni
   même s'il a converti.
2. Le facteur alternatif va dans le **bon sens** pour la question posée :
   il est choisi précisément parce que le taux officiel ne décrit pas
   l'économie réelle. Utiliser le taux officiel produirait un niveau de
   prix relatif faux.
3. Le motif est **le même** que celui du § 3.5 : la route B reste
   cohérente avec la source, là où mélanger un taux officiel avec une
   PPP calibrée sur un autre facteur ne le serait pas.

Ce qui change, c'est **ce qu'on affiche** : la note ⓘ nomme désormais la
convention et son cas dur (§ 13.3), et la méthodologie ne parle plus de
« taux de marché » pour le dénominateur.

**Conséquence pour R4B** : `PA.NUS.ATLS` (CC BY-4.0 vérifié) **n'est pas
ingérée** — aucun indicateur n'entre en base pour un contrôle. Elle vit
dans un **audit méthodologique diagnostique**, hors chaîne de production,
dont l'étape 2 du plan (§ 17) définit exactement ce qu'il prouve et ce
qu'il ne prouve pas.

---

## 4. Dollars internationaux courants vs constants — l'arbitrage central

### 4.1 Deux questions à ne jamais confondre

| | Comparaison **spatiale** | Comparaison **temporelle** |
|---|---|---|
| Question | À une même date, quel pouvoir d'achat relatif ces financements représentent-ils dans différents pays ? | Comment ce pouvoir d'achat évolue-t-il entre 2010 et 2025 ? |
| Unité | dollar international **courant** de l'année | dollar international **constant**, année de base nommée |
| Instrument | ratio PPP de l'année | PPP d'une année de base **plus** un déflateur national |
| État dans Orion | **disponible** | **indisponible** |

### 4.2 Ce qu'exigerait un « constant international $ 2025 »

Trois chaînes sont concevables. Aucune n'est disponible en V1.

**Chaîne 1 — déflater dans la monnaie nationale, puis convertir à la PPP
de l'année de base.** C'est la méthode canonique. Elle exige un
**déflateur par pays** (déflateur du PIB ou IPC national) pour ~200
juridictions. Orion possède exactement **deux** indices de prix : le
HICP zone euro et le CPI-U américain (R1 § 0). Le manque est une chaîne
de données entière, pas un paramètre.

**Chaîne 2 — déflater les dollars internationaux courants par
l'inflation américaine.** Séduisante : le dollar international a, par
définition, le pouvoir d'achat du dollar américain sur le PIB des
États-Unis. Elle a été **testée** contre la série publiée
`NY.GDP.MKTP.PP.KD` (constant 2021 international $), en appliquant le
déflateur du PIB américain (`NY.GDP.DEFL.ZS`) :

| Pays | 2010 | 2015 | 2019 | 2021 | 2023 | 2025 |
|---|---:|---:|---:|---:|---:|---:|
| US | 0,00 % | 0,00 % | 0,00 % | 0,00 % | 0,00 % | 0,00 % |
| FR | **−10,15 %** | −8,62 % | +1,37 % | 0,00 % | +1,02 % | −0,83 % |
| DE | **−10,95 %** | −7,84 % | −0,16 % | 0,00 % | +3,04 % | +2,57 % |
| PL | −4,82 % | −3,61 % | −0,41 % | 0,00 % | −0,08 % | −1,18 % |
| JP | +5,25 % | +5,94 % | +0,65 % | 0,00 % | +0,17 % | −1,91 % |
| IN | +2,21 % | −5,33 % | −4,44 % | 0,00 % | 0,00 % | 0,00 % |
| TR | +7,92 % | **+12,84 %** | +6,98 % | 0,00 % | +10,89 % | +3,75 % |

L'écart est nul pour les États-Unis (par construction), nul en 2021
(l'année de base), et atteint **−11 % à +13 %** ailleurs. La chaîne 2
**ne reconstruit pas** la série officielle : la série publiée part du
volume national (PIB en monnaie constante) converti à la PPP de 2021,
tandis que la chaîne 2 part des prix courants convertis à la PPP
extrapolée de l'année. Les deux ne coïncident que si la PPP suit
exactement les déflateurs relatifs — hypothèse de l'extrapolation, mais
pas ce qui se produit lorsqu'un benchmark ICP arrive ou qu'Eurostat-OCDE
mesure une PPP annuelle.

Une grandeur baptisée « constant international $ 2025 » qui s'écarte de
11 points de la grandeur officiellement publiée sous ce nom est
exactement la métrique plausible mais conceptuellement ambiguë que la
doctrine interdit.

**Chaîne 3 — PPP figée à l'année de référence appliquée aux montants
réels.** `real(R) × ratio_PPP(pays, R)`. Techniquement propre et
reproductible, mais elle répond à une **autre question** : « si cette
subvention était accordée aujourd'hui, que vaudrait-elle en Pologne
d'aujourd'hui ? » — un contrefactuel, pas une mesure de ce que l'argent
pouvait acheter à l'époque. Elle gèle par ailleurs le niveau de prix
relatif d'une seule année, alors qu'il bouge fortement (France : ratio
0,88 en 2010, 1,36 en 2024, 1,31 en 2025). Documentée, **non retenue** :
elle exigerait sa propre question utilisateur, son propre libellé, son
propre paramètre `base` — et entrerait en collision avec l'année de
référence de `real`.

### 4.3 Décision

> **R4 V1 ne produit que des dollars internationaux courants**, avec le
> ratio PPP de **l'année de rattachement du montant** (l'année civile de
> `start_date`, convention ③ inchangée). Aucun paramètre `base`. La
> comparaison temporelle du pouvoir d'achat reste **non offerte**.

**Conséquence directe, traitée au § 4.4** : si les dollars
internationaux d'années différentes ne sont pas la même unité, alors une
vue couvrant plusieurs années pose un problème que « le nominal fait
pareil » ne suffit pas à régler. C'est l'objet de la porte suivante.

**Condition de renversement nommée** : un « constant international $ »
deviendra étudiable le jour où Orion ingérera un déflateur par
juridiction sous licence admise (`NY.GDP.DEFL.ZS` est CC BY-4.0 et
couvre le besoin) **et** où un test-or reconstruira `NY.GDP.MKTP.PP.KD`
à partir de la chaîne retenue, à tolérance écrite d'avance. Tant que ce
test n'existe pas, la question temporelle appartient à `real`.

### 4.4 Périodes pluriannuelles — la porte, tranchée

La première version de ce document laissait une contradiction : elle
disait à la fois que les années ne sont pas comparables entre elles et
que `by=country` pourrait agréger plusieurs années. Deux V1 possibles
ont été instruites.

**Option A — `ppp` seulement sur une année unique.**

**Option B — périodes multiples autorisées**, définies comme
`Σ_a montant_USD(a) × ratio_PPP(pays, a)`, sous le nom
*cumulative current-year purchasing-power equivalents*.

#### À quelle question B répond exactement

Chaque terme `montant_USD(a) × ratio(c, a)` est un **volume** : le
panier de ressources, aux prix de l'économie c en année a, que
l'attribution de l'année a pouvait commander — exprimé dans l'unité
« biens américains de l'année a ». La somme est donc :

> la somme de volumes mesurés dans des unités **de millésimes
> différents**.

Ce qui est comparable, et ce qui ne l'est pas :

| Comparaison | Statut |
|---|---|
| Deux pays, **même année** | **valide** — même unité des deux côtés |
| Deux années, **même pays** | **invalide** — unités différentes (le dollar international de 2010 n'est pas celui de 2025) |
| Deux pays, **même période pluriannuelle** | **valide seulement si les deux pays ont le même profil temporel de financement** — sinon la comparaison mélange « ce que l'argent pouvait acheter » et « quand l'argent est arrivé » |

#### La contamination, mesurée

Le ratio d'un pays bouge énormément dans le temps, essentiellement au
gré du change et des niveaux de prix relatifs — pas du financement :

| Pays | min (année) | max (année) | amplitude |
|---|---:|---:|---:|
| États-Unis | 1,0000 | 1,0000 | 0,0 % |
| France | 0,7710 (2008) | 1,3909 (2022) | **+80,4 %** |
| Allemagne | 0,8288 (2008) | 1,3794 (2022) | +66,4 % |
| Pologne | 1,3078 (2008) | 2,4762 (2022) | **+89,3 %** |
| Grèce | 0,9604 (2008) | 1,8888 (2022) | **+96,7 %** |
| Japon | 0,7427 (2011) | 1,6024 (2024) | **+115,8 %** |

Conséquence : le ratio agrégé d'un pays sur une période dépend de la
répartition de **son** financement dans le temps. En comparant, pour les
seize premiers bénéficiaires, le ratio pondéré par le profil **propre**
du pays et le ratio qu'il obtiendrait sous le profil **moyen du
corpus** :

| Pays | effet de profil | | Pays | effet de profil |
|---|---:|---|---|---:|
| Norvège | **+12,64 %** | | Autriche | +5,89 % |
| Grèce | **+9,99 %** | | Suède | +4,17 % |
| Espagne | +8,34 % | | France | +4,65 % |
| Belgique | +8,13 % | | Allemagne | +4,03 % |
| Danemark | +7,63 % | | Royaume-Uni | −1,28 % |
| Finlande | +7,36 % | | Israël | −1,96 % |
| Italie | +6,26 % | | Suisse | **−3,46 %** |

**Seize points d'amplitude** entre la Norvège et la Suisse, dus
uniquement à la distribution temporelle de leur financement. Aucun de
ces points ne dit quoi que ce soit du pouvoir d'achat.

#### Le test qui tranche

Pologne contre France, la comparaison type du mode :

| Fenêtre | `ratio(PL) / ratio(FR)` |
|---|---:|
| **Pluriannuel (tout le corpus)** | **1,8131** |
| 2010 | 1,8929 |
| 2015 | 1,9161 |
| 2020 | 1,8178 |
| 2024 | 1,5057 |
| 2025 | **1,4620** |

Le chiffre pluriannuel (+81 %) est dominé par les conditions de
2005-2015 ; la réponse d'aujourd'hui est +46 %. Un utilisateur lisant
« la Pologne commande 81 % de ressources locales de plus que la France »
lirait une moyenne pondérée par la chronologie des attributions — que
personne ne demande et que personne n'interprétera ainsi. **B produit un
nombre juste au sens du calcul et faux au sens de la lecture.**

#### L'argument qui achève le débat : A est aussi plus couvrant

En vue à **année unique**, la part convertible de la valeur affichée
monte à :

| Année | Valeur | Convertible | `no_country` | `no_jurisdiction_series` | `no_reference_year` |
|---|---:|---:|---:|---:|---:|
| 2015 | 36 438,6 M€ | **99,955 %** | 15,010 M€ | 1,221 M€ | 0,134 M€ |
| 2019 | 46 845,2 M€ | **99,997 %** | 1,170 M€ | 0,352 M€ | 0,000 M€ |
| 2021 | 42 368,8 M€ | **99,992 %** | 2,475 M€ | 0,780 M€ | 0,000 M€ |
| 2023 | 40 331,3 M€ | **99,984 %** | 5,912 M€ | 0,656 M€ | 0,062 M€ |
| 2024 | 31 939,1 M€ | **99,993 %** | 0,812 M€ | 0,069 M€ | 1,275 M€ |
| 2025 | 20 790,0 M€ | **99,913 %** | 0,853 M€ | 0,366 M€ | **16,931 M€** |
| 2026 | 11 290,2 M€ | *vue non définie* | — | — | — |

La ligne 2026 n'est **pas** une couverture de 0 % : les séries de cette
année ne sont pas publiées, donc la vue n'existe pas et l'API la refuse
(`422 ppp_year_unavailable`). Une vue refusée n'a pas de taux de
couverture — la distinction est reprise au § 13.4 et au § 15.2.

Contre 98,236 % en pluriannuel. Le bloc d'exclusion `no_ppp_year`
(12,2 Md€) **disparaît** : il n'était que l'ombre portée des années
2026-2027 mélangées aux autres. Et `no_date` disparaît aussi — un projet
sans date de début n'appartient à aucune vue d'année unique. L'année
2026 devient un refus **de vue entière** (`422`), propre et lisible, au
lieu d'une exclusion partielle silencieuse.

**Le bord haut n'est pas uniforme, et c'est le troisième motif.** Le WDI
remplit l'année la plus récente progressivement : 244 juridictions ont
le couple en 2023, 242 en 2024, **232 en 2025**, 0 en 2026. Dix-huit
juridictions ont donc le couple sur d'autres années mais pas sur 2025 —
Bermudes (couple 2000-2024), Féroé (2008-2024), Groenland (2000-2023),
Liban (2000-2024)… Les appeler « territoire sans série publiée » serait
faux. D'où `no_reference_year`, motif distinct (§ 15.2), qui pèse
16,931 M€ des 18,150 M€ non convertibles de 2025 — soit 93,3 % de
l'exclusion de cette année, et 0,081 % de la valeur affichée. **Ce motif
réapparaîtra chaque année sur l'année la plus récente** : c'est un
calendrier de publication, pas une lacune.

#### Décision

> **Option A retenue. `ppp` n'existe que lorsque la vue est ancrée sur
> une année d'attribution unique.**

Règle vérifiable : le filtre temporel de la vue résout exactement une
année. Sur toute autre fenêtre, le groupe PURCHASING POWER **n'apparaît
pas** (R0 § D4.1) ; forcé par l'URL, l'API répond
`422 ppp_requires_single_award_year`.

**Le mode ne modifie jamais le filtre temporel lui-même** : ce serait
changer *qui* est regardé, pas *comment* — l'interdit du § 11. C'est
l'utilisateur qui cadre l'année ; le mode apparaît alors.

**Coût assumé** : sur une vue « toutes années », le mode est absent, donc
moins découvrable. C'est le prix d'un chiffre dont la lecture est exacte,
et il est cohérent avec la préférence énoncée : un périmètre plus petit
mais scientifiquement propre.

**Condition de renversement nommée** : l'option B redeviendra étudiable
si — et seulement si — un dollar international **constant** défendable
existe (§ 4.3). Alors la somme pluriannuelle porterait une unité unique
et l'effet de profil disparaîtrait. Pas avant.

---

## 5. Qui porte le pouvoir d'achat — perspective

### 5.1 PPP bénéficiaire — retenu

`montant reçu par le bénéficiaire × ratio PPP de son pays`, au grain
**participation**. C'est la seule construction où le pays du calcul est
celui où l'argent atterrit. Elle prolonge exactement la perspective
« Received funding intensity » de R3 (R0 § D3) : même grain, même champ
(`participations.country_code`), même règle anti-double-compte.

### 5.2 PPP financeur — interdit en V1

La question serait : « quel pouvoir d'achat le financeur a-t-il
mobilisé, au niveau de prix de sa propre juridiction ? »

Pour la NSF ou le NIH → juridiction US → le ratio vaut 1,0000 par
construction (le dollar international est ancré sur les États-Unis). Le
mode n'apporterait **rien**.

Pour la Commission européenne → juridiction UE → le ratio existe (1,3910
en 2025). Mais il décrirait le niveau de prix de l'UE appliqué à de
l'argent qui, pour une part majeure, n'y est pas dépensé. **Mesuré sur
le corpus** :

| Destination du financement CORDIS | Participations | Valeur | Part |
|---|---:|---:|---:|
| UE-27 | 342 221 | 141,779 Md€ | 80,88 % |
| **Hors UE-27** (RU, CH, NO, IL, TR…) | **79 985** | **33,231 Md€** | **18,96 %** |
| Sans pays | 516 | 0,275 Md€ | 0,16 % |

Presque **un cinquième** du financement européen serait converti au
niveau de prix d'une économie qui n'est pas celle où il est reçu — dont
la Suisse (ratio 0,89) et le Royaume-Uni, qui tirent en sens inverse de
l'agrégat UE (1,39).

> **Règle gravée** : `perspective=funder` n'existe pas pour `ppp`. La
> perspective est **forcée à `recipient`**, absente du menu et absente
> de l'URL. Une matrice symétrique n'est pas une raison de construire un
> mode auquel aucune question utilisateur ne correspond.

---

## 6. Grain et projets multinationaux

### 6.1 La règle

> `PPP(projet multinational) = Σ [ montant de chaque participation ×
> ratio_PPP(pays de la participation, année de début du projet) ]`

Elle est **défendable** parce qu'elle est la seule qui applique à chaque
euro le niveau de prix du lieu où il atterrit, et parce que l'addition
entre pays, à unité et année identiques, est cohérente avec la pratique
d'agrégation de la source (§ 7). Elle n'est pas une convention d'Orion :
elle **tombe** du grain participation, qui est déjà la règle
anti-double-compte du produit.

**La décision d'année unique (§ 4.4) renforce cette règle au lieu de la
compliquer** : un projet a **une** année de début, donc toutes ses
participations partagent la même année de rattachement. La condition
« même unité, même année » du § 7 est donc satisfaite *par construction*
à l'intérieur d'un projet multinational, sans clause supplémentaire.

**Interdits explicites**, chacun mesuré sur deux projets réels :

| Projet | Règle retenue | PPP du **coordinateur** appliqué à tout | PPP du **financeur (UE)** appliqué à tout | **Moyenne simple** des PPP des pays |
|---|---:|---:|---:|---:|
| *European Partnership on Innovative SMEs* — 2021, **34 pays**, 250,11 M€, coordinateur BE | **387,99 M $intl** | 347,42 → **−10,46 %** | 392,10 → +1,06 % | 448,26 → **+15,53 %** |
| *Implementation of activities described in the Roadmap…* — 2014, **28 pays**, 678,80 M€, coordinateur DE | **907,66 M $intl** | 882,78 → −2,74 % | 946,72 → +4,30 % | 1 198,46 → **+32,04 %** |

La moyenne simple des PPP est la plus fausse des trois — jusqu'à **+32 %**
— parce qu'elle donne le même poids à la Pologne et à la Suède qu'à
l'Allemagne. C'est exactement le « PPP moyen maison » que la doctrine
interdit.

**Contrôle de cohérence** : la moyenne **pondérée par les montants**
redonne, par construction, la règle retenue (écart 0,00 % sur les deux
projets). C'est le test-or de la règle d'agrégation.

### 6.2 Participations sans montant individuel

Mesuré sur le corpus :

| Cas | Projets | Valeur (grain projet) |
|---|---:|---:|
| Toutes les participations portent un montant | 610 425 | 692,346 Md€ |
| Partiellement montées | 12 919 | 40,215 Md€ |
| Participations sans aucun montant | 195 | 1,109 Md€ |
| Aucune participation | 698 | 0,781 Md€ |

Au grain participation, 103 421 lignes portent un pays sans montant.

> **Règle** : traitement **inchangé** par rapport au nominal. Une
> participation sans montant ne contribue à aucune somme monétaire —
> c'est déjà vrai aujourd'hui, dans tous les modes. Aucune répartition
> égale, aucune imputation, aucune reconstitution depuis le total du
> projet. Le PPP ne crée pas cet écart et ne le corrige pas ; il ne doit
> surtout pas l'inventer.

**Conséquence à dire** : la somme au grain participation (732,54 Md€)
diffère de la somme au grain projet (734,45 Md€). Cet écart préexiste au
lot ; il est la raison pour laquelle `ppp` n'apparaît **que** sur les
dimensions déjà au grain participation (§ 12) — ainsi le passage
nominal ⇄ PPP ne change jamais la population comptée.

---

## 7. Additionner entre pays — ce qui est établi, et ce qui ne l'est pas

### 7.1 La preuve empirique — la source le fait elle-même

Somme des 27 États membres contre agrégat `EU` publié par le WDI,
`NY.GDP.MKTP.PP.CD`, 2010-2025 :

| Année | Somme des 27 | Agrégat UE publié | Écart | Membres présents |
|---|---:|---:|---:|---:|
| 2010 | 14 586,9 Md $intl | 14 586,9 Md $intl | **0,000 %** | 27/27 |
| 2015 | 17 109,1 | 17 109,1 | **0,000 %** | 27/27 |
| 2020 | 21 256,1 | 21 256,1 | **0,000 %** | 27/27 |
| 2023 | 27 627,8 | 27 627,8 | **0,000 %** | 27/27 |
| 2025 | 29 550,2 | 29 550,2 | **0,000 %** | 27/27 |

Écart nul sur **les seize années**, avec les 27 membres présents chaque
année. Le contrôle a été rejoué sur `NY.GDP.MKTP.CD` : même résultat.

> **Énoncé retenu, dans sa portée exacte** : l'addition de montants
> exprimés dans **la même unité de dollar international courant**, pour
> **la même année**, est **cohérente avec la pratique d'agrégation du
> WDI** — c'est l'opération par laquelle la Banque mondiale construit
> ses propres agrégats régionaux dans cette unité. Ce n'est **pas** une
> affirmation générale d'additivité des PPP, qui serait fausse (§ 7.2).

### 7.2 Ce que cette preuve ne dit pas

La littérature ICP porte une non-additivité réelle : les méthodes de
type **GEKS**, retenues par l'ICP, sont **transitives mais non
additives** — la somme des dépenses réelles des postes élémentaires
**à l'intérieur** d'un pays ne redonne pas la dépense réelle de
l'agrégat. Cette limite concerne l'agrégation **des composantes d'une
même économie**, pas la somme d'agrégats de même nature entre pays. Elle
est néanmoins à connaître : elle interdit, par exemple, de convertir
séparément « salaires » et « équipements » et d'espérer retrouver le
total converti.

S'y ajoute l'avertissement ICP sur les **petits écarts** : une somme
régionale hérite des marges d'erreur, non estimables, de chacune de ses
composantes.

### 7.3 Règles gravées

1. **Somme cohérente avec la pratique de la source** entre pays, dans
   la même unité (dollar international courant) et pour la **même
   année de rattachement** — jamais présentée comme une propriété
   d'additivité des PPP en général. La décision § 4.4 (année unique)
   garantit structurellement la clause « même année ».
2. **Jamais de « PPP moyen »** — ni UE, ni régional, ni maison. Ce
   qu'Orion additionne, ce sont des **montants convertis**, jamais des
   facteurs.
3. **Jamais de PPP d'agrégat appliquée à des lignes.** Le ratio UE
   (1,3910 en 2025) existe et reste **utilisable pour un dénominateur**
   (R3), jamais comme facteur de conversion d'un financement.
4. **Jamais de mélange d'unités** : dollar international (référence
   États-Unis) et PPS Eurostat (référence UE-27, 1 PPS = 1 EUR au niveau
   de prix moyen de l'Union) ne se somment ni ne se comparent. Si
   Eurostat sert un jour de contrôle, ce sera dans son unité, dans une
   colonne séparée, et jamais dans le même graphique.

---

## 8. PPP PIB ou PPP consommation ?

### 8.1 Ce que fait la statistique de la R&D

| Producteur | Pratique constatée |
|---|---|
| **OCDE — Manuel de Frascati 2002, § 35** | Le Manuel recommande les **PPP** et l'**indice implicite de prix du PIB** pour les statistiques de R&D, en nommant leur limite (coût d'opportunité). Référence exacte, texte lu. L'édition 2015 n'est pas invoquée faute de passage vérifié. |
| **NSF / NCSES** (édition courante) | Constate que les PPP sont la **conversion privilégiée** des comparaisons internationales de R&D et qu'elles sont employées dans les **tabulations officielles de l'OCDE** ; porte explicitement la réserve « questions non résolues sur l'usage des PPP du PIB pour déflater la R&D ». C'est la source du **constat de pratique actuelle**. |
| **Eurostat** | La DIRD est publiée en **PPS**, unité dérivée des PPP du **PIB**. |
| **NSF / NCSES** | Les comparaisons internationales de R&D sont faites en PPP ; la limite « PPP conçues pour le PIB, pas pour la R&D » est explicitement portée. |
| **UNESCO / Banque mondiale** | Les indicateurs de dépense de R&D comparés internationalement passent par les PPP du PIB. |

L'argument n'est donc pas « `PA.NUS.PPP` existe ». Il se compose de
trois pièces distinctes, chacune attribuée à sa source propre : la
**recommandation** est celle du Manuel de Frascati 2002, § 35 ; le
**constat de pratique actuelle** (les PPP sont le standard privilégié des
comparaisons internationales de R&D et sont employées dans les
tabulations officielles de l'OCDE) vient de la NSF/NCSES ; et
l'**existence de séries de R&D en PPS** est établie par les métadonnées
Eurostat. Aucune de ces trois pièces n'est attribuée à une édition ou à
un producteur qui ne l'a pas écrite.

### 8.2 L'argument de contenu

Le panier du PIB inclut la **formation brute de capital fixe** et les
**services collectifs** — équipements, construction, administration,
enseignement supérieur : les postes qui composent une dépense de
recherche. Le panier de consommation finale des ménages est un panier de
biens de consommation : alimentation, logement, loisirs. Il est **plus
éloigné** des intrants de la recherche, pas plus proche.

### 8.3 L'écart, chiffré

Base consommation (`NE.CON.PRVT.PP.CD` / `NE.CON.PRVT.CD`) contre base
PIB, sur le corpus réel (707,88 Md€ calculables sur les deux bases ;
11,74 Md€ couverts par la base PIB et pas par la base consommation) :

| | Base PIB | Base consommation | Écart |
|---|---:|---:|---:|
| **Total corpus** | 906,14 Md $intl | 886,53 Md $intl | **−2,16 %** |
| États-Unis | 651,75 | 651,75 | 0,00 % |
| Allemagne | 34,32 | 32,79 | −4,44 % |
| France | 25,05 | 23,14 | −7,63 % |
| Royaume-Uni | 19,38 | 17,27 | **−10,90 %** |
| Espagne | 24,02 | 21,86 | −8,96 % |
| Grèce | 8,25 | 7,38 | −10,60 % |
| Suisse | 5,17 | 4,59 | **−11,20 %** |
| Danemark | 4,76 | 4,18 | **−12,21 %** |

Le choix déplace un pays de plus de douze points : il ne peut pas être
implicite.

### 8.4 Décision

> **Base PIB.** Le couple retenu est `NY.GDP.MKTP.PP.CD` /
> `NY.GDP.MKTP.CD`. Motif écrit : c'est la base qu'utilise la
> statistique internationale de la R&D, avec sa limite nommée par
> Frascati (coût d'opportunité des ressources, pas coût de la
> recherche). La base consommation est documentée comme **non
> retenue** ; sa condition de renversement serait une recommandation
> officielle inverse — elle n'existe pas.

---

## 9. Interaction avec `real`

### 9.1 La réponse

> `ppp` est un **mode alternatif** à `real`, jamais une transformation
> supplémentaire de `real`, et jamais les deux selon le cas.

`real` corrige **le temps** dans une zone monétaire : il retire
l'évolution des prix entre l'année du montant et l'année de référence,
avec l'indice de la devise d'origine. `ppp` corrige **l'espace** à une
date donnée : il retire les différences de niveau général des prix entre
pays. Les composer proprement produirait des dollars internationaux
constants — refusés au § 4. Les composer improprement produirait une
grandeur dont personne ne pourrait dire à quelle question elle répond.

**Conséquence de grammaire** : `value=ppp` et `value=real` sont deux
valeurs d'un même discriminant. Elles ne se cumulent pas. Le paramètre
`base` n'existe pas en `ppp` et est **supprimé de l'URL** au premier
`patch()` (règle de canonicalisation R0 § D10.2, déjà en place).

**Conséquence de périmètre** : `real` sert les vues pluriannuelles et
temporelles ; `ppp` sert une année unique (§ 4.4). Les deux modes ne se
disputent donc jamais la même vue — ils se relaient.

### 9.2 Les deux cas demandés

**Cas 1 — même année, deux pays.** 100 M€ nominal, 2025 :

| | nominal | $ courants | **$ internationaux 2025** | ratio |
|---|---:|---:|---:|---:|
| France | 100,0 M€ | 113,0 M$ | **147,6 M $intl** | 1,3060 |
| Pologne | 100,0 M€ | 113,0 M$ | **215,8 M $intl** | 1,9093 |
| Allemagne | 100,0 M€ | 113,0 M$ | 140,8 M $intl | 1,2465 |
| Grèce | 100,0 M€ | 113,0 M$ | 189,8 M $intl | 1,6797 |
| Suisse | 100,0 M€ | 113,0 M$ | 100,9 M $intl | 0,8932 |

Valeur nominale identique, pouvoir d'achat très différent : **c'est
exactement la question à laquelle `ppp` répond**, et `real` ne peut pas
y répondre — il donnerait 100 M€ constants des deux côtés.

**Cas 2 — même pays, deux années.** 100 M€ nominal en Pologne :

| | ratio PPP | résultat |
|---|---:|---|
| 2015 | 2,1356 | 236,9 M **$intl de 2015** |
| 2025 | 1,9093 | 215,8 M **$intl de 2025** |

Les deux nombres **ne sont pas comparables entre eux**. Le PPP annuel ne
suffit pas : la baisse de 236,9 à 215,8 ne dit rien du pouvoir d'achat
réel — elle mélange l'inflation américaine (le dollar international de
2015 n'est pas celui de 2025), la variation du change EUR/USD et
l'évolution du niveau de prix relatif polonais. **Démonstration
supplémentaire** : le ratio de la France a fait 0,8824 (2010) → 1,3562
(2024) → 1,3060 (2025), soit +54 % puis −4 % d'un mouvement qui ne doit
rien au financement.

> **Pour raconter la valeur dans le temps, l'outil est `real`, pas
> `ppp`.** C'est la raison directe des décisions des § 10 et § 12.

---

## 10. Index 100 et croissance annuelle

**Présomption confirmée : non.** Ni `index` ni `growth` ne se calculent
sur du PPP en V1.

Motifs, vérifiables :

1. Une série de dollars internationaux courants porte trois mouvements
   superposés — financement, inflation américaine, niveau de prix
   relatif du pays. Indexer ou dériver une telle série produirait un
   taux de croissance dont la cause n'est pas identifiable.
2. Les métadonnées de l'ICP nomment explicitement, parmi les usages
   **non recommandés** des PPP, la construction de **taux de croissance
   nationaux**. Un mode `growth` en PPP ferait littéralement l'usage
   déconseillé par la source.
3. Un changement de millésime WDI (révision en place, nouveau benchmark
   ICP) déplacerait toute la série — donc la pente — sans qu'aucune
   donnée de financement n'ait bougé.

> **TREND continue de reposer sur `real`.** Condition de renversement :
> l'existence d'un dollar international **constant** défendable (§ 4.3).

---

## 11. Top stable

Doctrine R3 inchangée, et **déjà en code** : `search/explore.py` maintient
une colonne `ranking` nominale quand un mode de lecture est actif —
« `View funding as` change comment on regarde, jamais qui on regarde ».

R4 ne touche pas cette règle, et la mesure montre pourquoi elle est
indispensable. Sur une **vue réelle** telle que le mode l'autorisera —
pays, année d'attribution 2023, 40,32 Md€ nominal → 51,28 Md $intl :

| Entité | Nominal | Rang nominal | $ internationaux | Rang PPP | Ratio |
|---|---:|---:|---:|---:|---:|
| États-Unis | 25 240,6 M€ | 1 | 27 291,9 M | 1 | 1,000 |
| Allemagne | 2 471,2 M€ | 2 | 3 525,0 M | 2 | 1,319 |
| **France** | 1 897,8 M€ | **3** | 2 796,9 M | **4** | 1,363 |
| **Espagne** | 1 683,8 M€ | **4** | 3 025,7 M | **3** | 1,662 |
| **Pays-Bas** | 1 382,4 M€ | **5** | 1 891,9 M | **6** | 1,266 |
| **Italie** | 1 251,9 M€ | **6** | 2 079,7 M | **5** | 1,536 |
| **Portugal** | 338,1 M€ | **14** | 658,8 M | **9** | 1,802 |
| **Israël** | 302,5 M€ | **15** | 347,0 M | **19** | 1,061 |

Onze rangs bougent dans le seul Top 20 : FR 3→4, ES 4→3, NL 5→6,
IT 6→5, SE 9→10, NO 10→12, DK 12→14, PT 14→9, IL 15→19, PL 17→15,
SI 19→21.

Si le PPP reclassait le Top, l'utilisateur qui bascule de mode verrait
**changer les entités regardées** — l'inverse de ce que promet un
sélecteur de lecture. Le Top affiché reste donc celui du nominal ; le
mode PPP change les **valeurs** de ces mêmes entités, et le
réordonnancement visuel des barres à l'intérieur du Top est un fait
lisible, pas une sélection différente.

Ceci rejoint l'usage **non recommandé** listé par l'ICP : « établir des
classements stricts entre pays ». Un futur contrôle `Rank by` explicite
serait un autre chantier — hors R4.

---

## 12. Surfaces autorisées

### 12.1 La règle qui décide

> `ppp` n'apparaît que **① sur une vue ancrée sur une année
> d'attribution unique** (§ 4.4) et **② sur les dimensions dont le
> nominal est déjà au grain participation** (`PARTICIPATION_DIMS`),
> moins celles que l'ICP interdit.

Deux conditions, deux propriétés garanties.

La condition ① garantit que **tous les montants d'une vue partagent la
même unité** — le dollar international de cette année-là. Aucune somme
d'unités de millésimes différents, donc aucun effet de profil temporel
(§ 4.4), et une couverture qui monte à plus de 99,9 %.

La condition ② garantit qu'**entre `nominal` et `ppp`, la population
comptée est identique** — mêmes lignes, mêmes filtres, même total de
référence. Aucun glissement silencieux de grain, donc aucun Top qui
bouge (§ 11), aucune part exclue qui apparaît sans raison.

Les deux sont vérifiables en une ligne de code, et testables.

### 12.2 La matrice

Légende : **●** pertinent · **—** absent (le mode n'apparaît pas ; jamais
d'option grisée). **Toutes les lignes ● sont conditionnées par l'année
unique** (§ 4.4).

| Surface | `ppp` | Motif |
|---|:--:|---|
| **Plage temporelle : une seule année d'attribution** | ● | La condition d'existence du mode. Le filtre est posé par l'utilisateur ; le mode ne le modifie jamais. |
| **Plage temporelle : plusieurs années, ou aucune borne** | **—** | § 4.4 : la somme mélangerait des dollars internationaux de millésimes différents, avec un effet de profil temporel mesuré jusqu'à 16 points entre pays. Forcé par l'URL → `422 ppp_requires_single_award_year`. |
| **Pays** (`by=country`) | ● | La surface canonique. Grain participation, perspective bénéficiaire forcée. |
| **Régions** (`by=region`) | ● | Agrégation **entre pays** de montants convertis — l'opération licite du § 7. Jamais une PPP de région. |
| **Organisations** (`by=organisation`, **dans l'Explorateur**) | ● | Chaque participation porte son pays ; l'organisation est convertie au niveau de prix de là où elle reçoit. Y compris avec le paramètre `compare=` de l'Explorateur, qui est un **filtre de la même vue**, pas une autre surface. |
| **La page `/compare`** | **—** | Surface **distincte** : route `/compare`, page `compare.tsx`, endpoint propre `GET /compare/organisations` → `aggregates.compare_entries`, qui n'est **pas** raccordé au Reference Engine (ni `real`, ni `gdp`, ni `capita` n'y existent). R4 V1 = Explorateur uniquement : la page reste hors périmètre, comme pour tous les modes précédents. |
| **Types d'organisation** (`by=orgtype`) | ● | Idem, agrégation entre pays. |
| **Subdivisions** (`by=subdivision`) | **—** | Les PPP sont **nationales**. Appliquer la PPP nationale à une région, c'est produire une lecture infranationale que l'ICP ne soutient pas (le prix de Paris n'est pas celui de la Creuse). **Interdit**, pas différé. |
| **Séries temporelles** (`by=year`, `split`) | **—** | § 4 et § 9 : une trajectoire en dollars internationaux courants mélangerait financement, inflation américaine et niveau de prix relatif. Rouvert le jour où le dollar international constant existe. |
| **Financeurs** (`by=funder`) | **—** | Perspective financeur interdite (§ 5.2) ; la perspective bénéficiaire y changerait le grain (projet → participation) et donc le Top. Rouvert le jour où une perspective bénéficiaire sur dimension financeur est une décision produit à part entière. |
| **Programmes** (`by=programme`) | **—** | Même motif de grain que `by=funder`. |
| **Vues sommables (barres, carte, donut)** | ● | La règle R0 § D4.2 réserve donut et carte aux modes **sommables** : le PPP en est un, et la preuve est au § 7. **Obligation de libellé** : la part affichée est une part **du pouvoir d'achat**, jamais « part du financement » — c'est exactement la confusion que le § 1.3 interdit, et la seule chose qui l'empêche est le mot. |
| **Fiches, recherche, decks, exports** | **—** | Surfaces = **Explorateur uniquement**, doctrine constante depuis le lot A. |

### 12.3 Où le mode est *produit*, et où il peut être *rejoué*

La contradiction relevée en contre-relecture venait d'une confusion de
vocabulaire entre deux choses homonymes. L'architecture les sépare
nettement :

| | Nature | PPP en V1 |
|---|---|---|
| `compare=FR~DE~US` | **paramètre de l'Explorateur** — un filtre d'entités sur `/explore/aggregate`, même pipeline, même grain, même réponse | **●** — c'est la vue Explorateur, rien d'autre |
| `/compare` | **page distincte** — sa propre route, son propre endpoint `GET /compare/organisations`, son propre agrégateur (`aggregates.compare_entries`), jamais passé par le Reference Engine | **—** |
| `ExploreView` | **composant de rejeu en lecture seule** — il ne porte aucun sélecteur : il rend la chaîne de paramètres qu'on lui donne, et sert aussi bien la page `/compare` que les dossiers et les planches | ni l'un ni l'autre : il **rejoue**, il ne produit pas |

D'où la règle, vérifiable en revue de diff :

> Le mode `ppp` est **produit** au seul endroit qui porte le sélecteur de
> lecture : l'Explorateur. `ExploreView` le **rejoue** partout où une
> chaîne de paramètres Explorateur est rejouée — dossier, planche — ce
> qui est le mécanisme général déjà en place pour `real` et `index`
> (R0 § D9.1), et non un raccordement de surface. La page `/compare`
> construit **ses propres** chaînes de paramètres : elles ne portent
> jamais `value=ppp`, et c'est un point de recette explicite.

**Conséquence de robustesse** : une vue sauvegardée en `ppp` puis
rejouée dans un dossier peut rencontrer un `422` (millésime avancé,
année devenue indisponible). Le rejeu doit alors afficher le message
d'indisponibilité et proposer le nominal — jamais une vue vide, jamais
un « 0 % ». C'est le comportement déjà spécifié pour `real` ; l'étape 11
l'ajoute aux tests.

### 12.4 Sélecteur

Le groupe **PURCHASING POWER** n'apparaît que sur les vues de la matrice
ci-dessus. Un seul mode, aucun paramètre secondaire :

```
PURCHASING POWER
  ○ PPP-adjusted      Compare purchasing power across countries
```

Conformément à R0 § D6, aucun paramètre n'est révélé sous le mode :
ni année de référence (§ 4), ni devise d'affichage (l'unité est le
dollar international, ce n'est pas une devise de marché et elle ne se
choisit pas).

---

## 13. `ⓘ Reference` — les textes proposés (EN / FR)

Structure imposée par R0 § D8 et déjà en place dans `reference-note.tsx` :
**sens humain · calcul · sources et millésimes · couverture · exclusions ·
méthodologie →**. Les phrases viennent de l'i18n ; l'API ne fournit que
des valeurs.

### 13.1 Niveau 1 — le sens, avant tout calcul

**EN** — clés `explorer.reference.meaningPpp` / `meaningPppBody` :

> **Purchasing-power adjusted**
> Expresses funding according to the general price level of the
> recipient country. The same market-value amount can therefore
> represent a different capacity to buy local resources in different
> countries.

Puis, **immédiatement**, la limite — clé `meaningPppLimit` :

> This uses economy-wide purchasing power parities. It does not measure
> the specific cost of researchers, laboratories, scientific equipment
> or computing.

Puis la nature de la comparaison — clé `meaningPppSpatial` :

> This compares countries **within a single award year** ({{year}}).
> Amounts are expressed in that year's international dollars: figures
> from different years are not made comparable in PPP mode, so Orion
> does not aggregate them across years — which is why this view exists
> for one year at a time. For change over time, use Real value.

**FR** :

> **En parité de pouvoir d'achat**
> Exprime le financement selon le niveau général des prix du pays
> bénéficiaire. Un même montant en valeur de marché peut donc
> représenter une capacité d'achat de ressources locales différente
> d'un pays à l'autre.

> Cette lecture repose sur des parités de pouvoir d'achat calculées
> pour l'ensemble de l'économie. Elle ne mesure pas le coût propre des
> chercheurs, des laboratoires, des équipements scientifiques ni du
> calcul.

> Cette vue compare des pays **au sein d'une même année
> d'attribution** ({{year}}). Les montants sont exprimés en dollars
> internationaux de cette année-là : les chiffres d'années différentes
> ne sont pas rendus comparables dans ce mode, et Orion ne les agrège
> donc pas entre années — c'est la raison pour laquelle cette vue
> n'existe que pour une année à la fois. Pour l'évolution dans le temps,
> utiliser la valeur réelle.

### 13.2 Niveau 2 — le calcul (clé `pppMethod`)

**EN** :

> Award amounts are converted to current US dollars at Orion's yearly
> ECB rate, then multiplied by the recipient country's ratio of GDP in
> current international dollars to GDP in current US dollars for the
> same year — the World Bank's published purchasing-power adjustment,
> built on its own national-accounts conversion factor rather than on a
> market rate.
> Multinational projects are converted participation by participation,
> each at its own country's ratio, then added: no coordinator's country,
> no funder's country, no average. An Orion analysis: the observed
> nominal amounts never change.

**FR** :

> Les montants attribués sont convertis en dollars US courants au taux
> BCE annuel d'Orion, puis multipliés par le rapport, pour le pays
> bénéficiaire et la même année, entre son PIB en dollars
> internationaux courants et son PIB en dollars US courants —
> l'ajustement de pouvoir d'achat publié par la Banque mondiale, construit
> sur son propre facteur de conversion des comptes nationaux et non sur
> un taux de marché. Les projets
> multinationaux sont convertis participation par participation, chacune
> au ratio de son pays, puis additionnés : jamais le pays du
> coordinateur, jamais celui du financeur, jamais une moyenne. Analyse
> Orion : les montants nominaux observés ne changent jamais.

### 13.3 Niveau 2 bis — l'avertissement de la source (clé `pppFlowNote`)

Non négociable : il vient de l'ICP lui-même et c'est la limite la plus
sérieuse du mode (§ 1.3).

**EN** :

> Purchasing power parities are designed to compare the size of
> economies, not financial flows. This view answers what resources an
> amount could command locally — not how much money changed hands. They
> are statistical estimates: small differences between countries should
> not be read as meaningful.

Et, nouvelle clé `pppRateNote` (objection de contre-relecture, § 3.6) :

> The adjustment relies on the World Bank's own conversion conventions
> for national accounts, not on the rate any recipient actually
> obtained. Where an economy has multiple or administered exchange
> rates, or where its accounting year is not the calendar year, that
> convention can differ substantially from the official rate.

**FR** :

> Les parités de pouvoir d'achat sont conçues pour comparer la taille
> des économies, pas des flux financiers. Cette vue répond à ce qu'un
> montant permettait de commander localement — pas au montant qui a
> changé de mains. Ce sont des estimations statistiques : de petits
> écarts entre pays ne doivent pas être interprétés.

> L'ajustement repose sur les conventions de conversion des comptes
> nationaux propres à la Banque mondiale, pas sur le taux qu'un
> bénéficiaire a réellement obtenu. Pour une économie à taux de change
> multiples ou administrés, ou dont l'année comptable n'est pas l'année
> civile, cette convention peut s'écarter sensiblement du taux officiel.

### 13.4 Niveau 3 — sources, couverture, exclusions

Sources (clé `sectionSources`, valeurs venant de `meta`) :

> **EN** — Sources: World Bank WDI — GDP, PPP (current international $)
> and GDP (current US$), vintage {{vintage}} · ECB annual rates.
> Purchasing power parities from the International Comparison Program;
> figures between benchmark rounds (2011, 2017, 2021) are extrapolated
> and revised when a new round is published.
>
> **FR** — Sources : Banque mondiale WDI — PIB en dollars internationaux
> courants et PIB en dollars US courants, millésime {{vintage}} · taux
> annuels BCE. Parités issues du Programme de comparaison
> internationale ; les valeurs situées entre les cycles de référence
> (2011, 2017, 2021) sont extrapolées et révisées à chaque nouveau
> cycle.

**Deux natures à ne jamais confondre dans les textes** (§ 15) : la note
ⓘ ne parle d'exclusions que lorsqu'une vue **existe**. Une vue refusée
n'a pas de note de couverture — elle a un message d'indisponibilité.

*Exclusions partielles* — les seules que la note PPP affiche, et il n'y
en a que deux :

| Clé | EN | FR |
|---|---|---|
| `noCountry` | participation without a country: {{count}}, {{amount}} | participation sans pays : {{count}}, {{amount}} |
| `noJurisdictionSeries` | no published series for this territory: {{count}} projects, {{amount}} | aucune série publiée pour ce territoire : {{count}} projets, {{amount}} |
| `noReferenceYear` | reference not yet published for {{year}} in this territory: {{count}} projects, {{amount}} | référence {{year}} non encore publiée pour ce territoire : {{count}} projets, {{amount}} |

`noPppYear` et `noDate` **n'existent pas** dans la note PPP : après la
décision d'année unique (§ 4.4), le premier est devenu un refus de vue
et le second est structurellement impossible.

Comme `no_reference_year` frappe surtout **l'année la plus récente**,
la note ajoute une phrase de contexte quand ce motif est non nul — clé
`pppTrailingYearNote` :

> **EN** — The World Bank publishes the most recent year progressively,
> so a few territories may still be missing from it.
>
> **FR** — La Banque mondiale publie l'année la plus récente
> progressivement : quelques territoires peuvent encore y manquer.

*Refus de vue entière* — messages, pas exclusions ; aucun chiffre de
couverture, aucun pourcentage :

| Clé | EN | FR |
|---|---|---|
| `pppYearUnavailable` | Purchasing-power figures are not available for {{year}}: the World Bank has not yet published the series for that year. | Le pouvoir d'achat n'est pas disponible pour {{year}} : la Banque mondiale n'a pas encore publié les séries de cette année. |
| `pppRequiresSingleYear` | This view compares purchasing power within one award year. Select a single year to use it. | Cette vue compare le pouvoir d'achat au sein d'une seule année d'attribution. Choisissez une année pour l'utiliser. |
| `pppReferenceUnavailableForView` | No purchasing-power reference is available for the territories in this view in {{year}}. | Aucune référence de pouvoir d'achat n'est disponible en {{year}} pour les territoires de cette vue. |

**Règle de rédaction gravée** : une vue refusée n'est **jamais** montrée
comme « 100 % exclu » ni comme une couverture nulle. Ce n'est pas une
couverture faible, c'est une vue **non définie**. Le mot « exclu » est
réservé aux lignes retirées d'un calcul qui, lui, a eu lieu.

**Unité** (ligne de titre, R0 § D7) :

```
Funding, purchasing power                 Financement, pouvoir d'achat
Intl $ (PPP) · recipient country          $ intl. (PPA) · pays bénéficiaire
```

Jamais « Funding · Intl $ » seul : l'unité nomme la perspective, comme
`% of GDP · European Union` le fait en R3.

---

## 14. Grammaire URL

```
value=ppp
```

**Rien d'autre.**

| Paramètre | En `ppp` | Motif |
|---|---|---|
| `base` | **absent** | Il n'existe pas d'année de référence : le ratio est celui de l'année de rattachement de chaque montant (§ 4). Écrire `base=2025` raconterait une méthode fausse — l'inverse de ce que doit faire une grammaire partageable. |
| `cur` | **absent** | L'unité est le dollar international. Ce n'est pas une devise de marché et elle ne se choisit pas. |
| `perspective` | **absent** | Forcée à `recipient` (§ 5.2) ; règle R0 § D10 : une perspective forcée est absente de l'URL et présente dans la ligne d'unité. |

**L'année ne devient pas un paramètre du mode.** Elle est portée par le
filtre temporel existant de la vue (`time=2023..2023`), qui appartient au
*périmètre*, pas au *référentiel*. Ajouter un `year=` propre à `ppp`
dupliquerait une information déjà dans l'URL et ouvrirait la porte à
deux années contradictoires dans le même état. Une URL `ppp` est donc
`…&time=2023..2023&value=ppp` — lisible, partageable, rejouable, et
autoportante : le lecteur voit l'année dans l'URL.

La grammaire `value=ppp&base=2025` proposée par R0 § D10 est donc
**abandonnée** : elle encoderait une notion méthodologique qui n'existe
pas. Le paramètre `base` reste réservé à `real`, `capita` et `index`.

**Canonicalisation** (mécanisme existant, aucun code nouveau) :
`value=ppp&base=2025&cur=USD` est lu comme `value=ppp`, et la prochaine
écriture d'URL efface `base` et `cur`. Une combinaison non supportée
répond `400` ; une vue non définie répond `422 ppp_requires_single_award_year` ou
`422 ppp_year_unavailable` selon le cas (§ 15.2) — jamais de repli
silencieux vers le nominal, et jamais un agrégat annoncé « 100 %
exclu ».

---

## 15. Données manquantes, exclusions, couverture

### 15.1 Mesuré, pas supposé

**La décision d'année unique (§ 4.4) change ces chiffres, et dans le bon
sens.** Sur une vue ancrée sur une année, la part convertible de la
valeur affichée dépasse **99,9 %** (tableau du § 4.4) : 99,997 % en 2019,
99,984 % en 2023, 99,913 % en 2025.

**Trois** motifs subsistent — la mesure de la porte § 5 de R4B, faite
sur le couple réellement retenu avant tout codage, a infirmé la
taxonomie à deux :

| Motif | Ordre de grandeur sur une année | Nature |
|---|---:|---|
| `no_country` — participation sans pays | 0,8 à 15 M€ | la participation n'a pas de pays de rattachement |
| `no_jurisdiction_series` — territoire jamais couvert | 0,07 à 1,2 M€ | Taïwan, Gibraltar, Nouvelle-Calédonie, Bonaire, Polynésie, Cuba… : **aucune** année du couple, jamais |
| **`no_reference_year`** — année cadrée non publiée pour ce territoire | 0 à **16,9 M€** | la juridiction **a** le couple sur d'autres années : Bermudes 2000-2024, Féroé 2008-2024, Groenland 2000-2023, Liban 2000-2024 |

**Pourquoi les fusionner serait faux** : en 2025, sur 18,150 M€ non
convertibles, **16,931 M€ (93,3 %)** relèvent du troisième motif — dont
12,645 M€ pour les seules Bermudes, qui possèdent vingt-cinq années du
couple. Les étiqueter « territoire sans série publiée » aurait été un
libellé mensonger. Le motif suit le calendrier de publication du WDI et
frappera **chaque année l'année la plus récente** (232 juridictions
couvertes en 2025 contre 244 en 2023).

Deux motifs de la première rédaction **disparaissent** par
construction :

- `no_ppp_year` — il ne peut plus s'agir d'une exclusion partielle : soit
  l'année a ses séries, soit **la vue entière** est refusée (`422`). Le
  cas se produit pour **2026 et 2027** (respectivement 11,290 Md€ et
  0,899 Md€ de la valeur du corpus, invisibles en PPP jusqu'à publication
  des séries de ces années) ;
- `no_date` — un projet sans date de début n'appartient à aucune vue
  d'année unique.

*Pour mémoire, la mesure pluriannuelle qui a servi à instruire la porte
du § 4.4* : sur les 985 849 participations portant un montant EUR
(732,54 Md€), 962 729 lignes / 719,619 Md€ = **98,236 %** auraient été
convertibles, l'écart étant à 1,667 % le seul fait des années 2026-2027.
Contrôle de robustesse : la même mesure avec le facteur `PA.NUS.PPP`
(route A) donne 98,236 % également — le choix de route ne coûte aucune
couverture.

### 15.2 Doctrine, inchangée et étendue

Trois niveaux (R0 § D13), avec une séparation stricte entre les deux
premiers :

1. **Vue non définie** → le mode n'apparaît pas dans le sélecteur ;
   forcé par l'URL → `422`, portant l'un des **deux codes** ci-dessous,
   avec message et retour au nominal proposé. Une vue non définie n'a
   **ni couverture, ni bloc `excluded`, ni pourcentage** : elle n'est pas
   « exclue à 100 % », elle n'existe pas.
2. **Vue définie, partie non convertible** → calcul sur la partie valide,
   bloc `excluded` chiffré **depuis le périmètre affiché**, ventilé sur
   les **deux** motifs partiels, dépliable. C'est le seul niveau où le
   mot « exclu » est employé.
3. **Valeur absente dans un bucket** → `None`, jamais `0.0`.

| Motif / code | Condition | Statut |
|---|---|---|
| `no_country` | participation sans `country_code` | **exclusion partielle** |
| `no_jurisdiction_series` | juridiction connue d'Orion dont le couple n'existe **sur aucune année** (Taïwan, Gibraltar, Nouvelle-Calédonie, Bonaire, Polynésie, Cuba…) | **exclusion partielle** |
| `no_reference_year` | juridiction dont le couple existe sur d'autres années mais **pas sur l'année cadrée** (Bermudes, Féroé, Groenland, Liban en 2025) | **exclusion partielle** — ajouté le 2026-08-25 |
| `ppp_requires_single_award_year` | la vue couvre plusieurs années ou n'a pas de borne | **refus de vue** (`422`), § 4.4 |
| `ppp_year_unavailable` | **aucune** juridiction ne publie l'année cadrée (2026, 2027) | **refus de vue** (`422`) — remplace l'entrée `no_ppp_year` de R0 § D13 |
| `ppp_reference_unavailable_for_view` | le périmètre filtré affiché porte de la valeur nominale, mais **rien n'y est convertible** | **refus de vue** (`422`), § 15.3 |

**Interdits absolus** : jamais de zéro inventé, jamais de moyenne
artificielle, jamais de facteur 1,0 par défaut, jamais de PPP d'un pays
voisin, jamais d'extrapolation maison au-delà de ce que le WDI publie.

### 15.3 La règle du périmètre filtré — une vue sans rien de convertible

Cas limite instruit le 2026-08-25, avant tout codage. `year=2025` +
`country=BM` : les Bermudes possèdent le couple jusqu'en 2024 mais pas
en 2025. L'année 2025 **existe** mondialement (232 juridictions), donc
`ppp_year_unavailable` serait un message **faux**. Et une réponse `200`
annonçant une couverture de 0 % avec tout en exclusions est refusée par
la doctrine (§ 15.2, niveau 1).

> **Règle unique, fondée sur le périmètre filtré réellement affiché — et
> non sur la disponibilité mondiale de l'année.**
>
> Soit `N` la valeur nominale monétaire du périmètre filtré (ce que le
> mode nominal totaliserait sur exactement la même vue), et `C` la part
> de `N` qui porte un ratio.
>
> | | Réponse |
> |---|---|
> | `N = 0` | **`200`, vue vide** — exactement comme en nominal. Ni couverture, ni exclusions, ni `422` : il n'y a pas d'argent, la référence n'est pas en cause. |
> | `N > 0` et `C > 0` | **`200`** — agrégat sur la part convertible, `coverage = C/N`, exclusions ventilées sur les trois motifs. |
> | `N > 0` et `C = 0` | **`422 ppp_reference_unavailable_for_view`** — vue non définie. Ni agrégat, ni couverture, ni bloc `excluded`. |

La troisième ligne est la seule addition ; la première est la
précision qui empêche le code de mentir sur une vue simplement vide.

**Les quatre cas de contrôle**, tous réalisables sur le corpus :

| Vue | `N` | `C` | Réponse |
|---|---:|---:|---|
| `2025` + `country=BM` | 12,6449 M€ | 0 | **`422 ppp_reference_unavailable_for_view`** |
| `2025` + `country=BM~FR` | 12,6449 M€ + FR | > 0 | **`200`** — BM dans `no_reference_year` |
| `2025` + `country=NC` (jamais couverte) | 0,2643 M€ | 0 | **`422 ppp_reference_unavailable_for_view`** |
| vue dont toutes les participations sont sans pays | > 0 | 0 | **`422 ppp_reference_unavailable_for_view`** |
| *(idem, mais sans aucun montant)* | 0 | 0 | **`200`, vue vide** |

**Un même code pour deux causes** — territoire jamais couvert, ou année
non encore publiée pour lui — parce que le message ne présume rien :
« aucune référence de pouvoir d'achat n'est disponible en {{année}} pour
les territoires de cette vue ». Distinguer les deux causes dans un refus
n'apporterait rien : la vue n'existe pas, il n'y a pas de ventilation à
montrer.

**Conséquence d'architecture, à assumer explicitement.** Les deux
premiers refus sont **prédictibles côté client** — le nombre d'années
cadrées et la dimension sont dans l'état de la vue, donc le sélecteur
n'offre pas le mode. Le troisième ne l'est **pas** : savoir si les
Bermudes ont une référence en 2025 demande la requête. Le sélecteur
proposera donc PPP sur une vue `BM` + `2025`, et l'API refusera. C'est
le comportement de repli déjà spécifié depuis le lot A
(`constant_mode_unavailable` → message explicite et retour au nominal
proposé), et il reste obligatoire : jamais d'écran vide, jamais un
« 0 % ». Le refus se décide **après** la requête, à partir de l'agrégat
— le précédent existe déjà dans `api/explore.py`, où une combinaison
métrique/dimension invalide est refusée sur le résultat. La décision
étant une fonction déterministe de l'agrégat, le cache d'agrégats reste
valide : c'est la décision qui est rejouée, pas un refus qui serait
mémorisé.

---

## 16. Contre-exemples — tentatives de casser la métrique

| # | Situation | Problème | Gravité | Traitement retenu |
|---|---|---|---|---|
| 1 | **Luxembourg** — 541,5 M€ dans le corpus, ratio 1,1328 (2024) | Le PIB luxembourgeois est gonflé par les travailleurs frontaliers et la valeur ajoutée financière : la structure de prix qu'il décrit n'est pas celle que paie un laboratoire luxembourgeois. | **Moyenne** — biais réel, pas d'inversion de lecture | Aucune correction possible sans inventer une PPP. La limite « PPP de l'ensemble de l'économie » du ⓘ couvre le cas. **Autorisé, avec l'avertissement générique.** |
| 2 | **Bermudes** — 126,2 M€, ratio 0,8346 (2024), un seul bénéficiaire (Bermuda Institute of Ocean Sciences) | Micro-économie insulaire, très dépendante des importations, **hors cycle ICP** : sa PPP est imputée par modèle de régression, et le WDI ne le signale pas dans la série. | **Élevée sur l'entité, faible sur les agrégats** | Le ⓘ dit que les valeurs entre cycles sont extrapolées et que les petits écarts ne s'interprètent pas. La règle « pas de classement strict » (§ 11) empêche le cas de produire un faux podium. **Autorisé.** |
| 3 | **Taïwan** — 13,6 M€ | Aucune série WDI. | Nulle | **Exclu et compté** (`no_jurisdiction_series`), jamais rattaché à un autre territoire. |
| 4 | **Pays à forte inflation** — Turquie (869,6 M€), Égypte (41,2 M€), Argentine | La PPP annuelle est extrapolée par les déflateurs relatifs ; l'écart entre PPP et change explose et bouge vite. | **Moyenne** | Le contrôle empirique montre que le couple PIB PPP / PIB USD reste cohérent pour la Turquie (0,000 %) : la route B absorbe le cas. **Autorisé.** |
| 5 | **Change administré ou multiple** — Liban, Argentine, Égypte, Nigeria | Deux problèmes distincts. ① En route A, mélanger taux officiel et PPP produit des écarts jusqu'à 21 %. ② En route B, le ratio **incorpore la convention de conversion du WDI** (`PA.NUS.ATLS`), qui n'est pas le taux qu'un bénéficiaire obtient : au Liban, l'écart entre parité officielle et facteur retenu atteint **1 711 %**. | ① **nulle en route B** · ② **élevée sur l'entité, faible sur les agrégats** (0,203 % du périmètre au-delà de 10 % d'écart) | ① **Motif décisif du choix de route** (§ 3.5). ② **Non corrigeable** — le taux réellement obtenu n'existe pas comme donnée. **Avertissement nommé** au ⓘ (clé `pppRateNote`, § 13.3) et section § 3.6 en méthodologie. |
| 5 bis | **Année comptable non civile** — Ouganda, Haïti, Australie, Éthiopie, Inde, Égypte, Bangladesh, Pakistan | Le facteur de conversion du WDI couvre l'année comptable du pays, pas l'année civile à laquelle Orion rattache le montant. | **Faible** — écarts de 5 à 18 %, sur 0,4 % du périmètre | Aucune correction possible sans reconstruire les comptes nationaux. **Dit** au ⓘ (`pppRateNote`), compté au § 3.6. |
| 6 | **Redénomination monétaire** — Croatie, Estonie, Lituanie, Slovaquie, Bulgarie, Zimbabwe | Le facteur PPP est réexprimé dans la monnaie actuelle, le taux de change ne l'est pas : 843,0 M€ du corpus seraient faux d'un facteur 2 à 30, dont 442,7 M€ pour la seule Bulgarie. | **Critique en route A, nulle en route B** | **Interdiction de la route A** (§ 3.3-3.5). |
| 7 | **Gros équipement scientifique importé** — télescope, accélérateur, semi-conducteurs, temps de calcul | L'équipement s'achète au **prix mondial**, pas au prix local : convertir en PPP surestime le pouvoir d'achat d'un pays à bas niveau de prix qui importe l'essentiel de son matériel. | **Élevée conceptuellement** | Aucune correction possible : Orion n'a pas la ventilation salaires/équipements. **Avertissement obligatoire** au ⓘ (« ne mesure pas le coût des équipements scientifiques »). C'est la limite que Frascati nomme lui-même. |
| 8 | **Projet multinational** | Le pays du coordinateur ou du financeur appliqué au projet entier fausse de −10 % à +32 % (mesuré § 6.1). | **Critique si mal fait** | **Règle Σ participations**, imposée par le grain (§ 6.1). Interdits nommés et testés. |
| 9 | **Financeur supranational** (Commission européenne) | 18,96 % du financement CORDIS est reçu hors UE-27 : un niveau de prix « UE » ne décrit pas cet argent. | **Critique** | **PPP financeur interdit** (§ 5.2). |
| 10 | **Argent dépensé hors du pays du bénéficiaire** — organisations intergouvernementales | EMBL est rattaché à l'Allemagne (549,9 M€, 526 participations) mais opère au Royaume-Uni, en France, en Italie et en Espagne ; l'ESA est rattachée à la France (71,9 M€) et dépense dans toute l'Europe ; sous-traitance et achats transfrontaliers partout ailleurs. | **Moyenne à élevée sur ces entités** | Orion ne connaît que le pays de la participation. **Aucune correction inventée** ; l'hypothèse « dépensé là où reçu » est **nommée** au ⓘ. Une lecture par organisation reste autorisée parce qu'elle affiche la même hypothèse que la lecture par pays. |
| 11 | **Petits écarts entre pays voisins** — France 1,3060 vs Allemagne 1,2465 (2025) | Un écart de 5 % entre deux économies proches est dans le bruit des PPP, dont l'ICP dit que les marges d'erreur ne sont pas estimables. | **Moyenne** | **Avertissement explicite** au ⓘ ; **classement nominal conservé** (§ 11) ; aucun affichage n'invite à comparer deux barres voisines. |
| 12 | **Lecture infranationale** — régions, NUTS | Le niveau de prix d'une capitale n'est pas celui d'une zone rurale. | **Élevée** | **`by=subdivision` interdit** (§ 12.2). |
| 13 | **Révision de benchmark** — cycle ICP 2024 à venir | Tous les chiffres PPP d'Orion changeront, y compris l'historique, sans qu'aucune donnée de financement n'ait bougé. | **Structurelle** | Millésime **affiché** au ⓘ, discipline `vintage_date` (R3), et interdiction de TREND (§ 10) — sans quoi une révision déplacerait des pentes. |

---

## 17. Plan d'implémentation R4B (soumis — aucune ligne de code avant GO)

Trois lots livrables séparément. Le lot est **léger en données** : la
moitié du couple, `NY.GDP.MKTP.CD`, est **déjà en base** depuis R3.

### Lot 1 — données

**Étape 1 — un concept de plus dans `macro_series`.**
`backend/src/orion/ingest/macro.py` : `INDICATORS` gagne
`gdp_ppp_current_intl` ← `NY.GDP.MKTP.PP.CD` ;
`backend/src/orion/macro.py` : `CONCEPTS` gagne la même entrée.
**Aucune migration** — la table, la contrainte d'unicité, l'index et la
discipline de millésime existent depuis R3. **Aucune table de données
touchée.** Validation d'ingestion inchangée (valeurs strictement
positives, trous d'années admis et dits à l'écran).
**Règle d'écriture du couple** (détaillée à l'étape 3) :
`gdp_ppp_current_intl` et `gdp_current_usd` forment une **unité
d'écriture** — une nouvelle vintage pour l'un en écrit une pour l'autre.
`population` et les autres concepts gardent le comportement R3.
*Recette* : premier run → les juridictions du référentiel connues du WDI
peuplées (242 économies publient la série en 2024, sur 251 juridictions
seedées), les deux concepts du couple à la **même** `vintage_date` ;
second run immédiat → aucune nouvelle vintage, ni pour l'un ni pour
l'autre.

**Étape 2 — le filet, refondu.** La première version proposait un
watchdog `FCRF / PPP` avec seuil d'alerte. **Abandonné** : il aurait
alerté sur des comportements parfaitement légitimes de la source —
`FCRF` diffère à bon droit d'`ATLS` (clauses ① et ② du § 3.6), les
redénominations le cassent mécaniquement, et l'identité du numérateur
`GDP_PPP ↔ GDP_LCU / PPP` diverge elle-même de façon documentée (Inde,
Nigeria). Un gate fondé sur une identité qui n'est pas universelle
produit du bruit, pas de la sécurité.

Le filet est donc réparti en deux niveaux, de nature différente.

**Niveau 1 — garde-fous bloquants, sur le couple réellement utilisé en
production.** Ils ne supposent **aucune** identité externe :

| Contrôle | Ce qu'il attrape |
|---|---|
| Les deux séries présentes pour (pays, année), **à `vintage_date` identique** (invariant de l'étape 3), la date consignée | un couple dépareillé, une série arrivée sans l'autre, deux instantanés de source incompatibles |
| `NY.GDP.MKTP.CD > 0` et `NY.GDP.MKTP.PP.CD > 0` | une valeur nulle ou négative qui produirait une division absurde |
| `ratio_PPP` dans une **bande de plausibilité large** (0,1 – 20), refus hors bande avec la valeur au journal | une inversion de numérateur/dénominateur, un concept mal câblé, une unité qui change chez la source |
| **`ratio_PPP(US, année) = 1,000000` exactement** | le contrôle le plus puissant du lot : il n'est vrai que si les deux séries sont le bon couple, au bon millésime, sur le bon pays |
| Recouvrement des années entre les deux séries au moins égal à celui de la vintage précédente | une régression de couverture passée inaperçue |

**Niveau 2 — audit méthodologique diagnostique, non bloquant, hors
chaîne de production.** Une commande d'analyse, lancée à la main lors
d'une bascule de millésime, qui lit `PA.NUS.ATLS`, `PA.NUS.PPP`,
`PA.NUS.FCRF` et `NY.GDP.MKTP.CN` **en mémoire** — **aucun de ces
indicateurs n'entre en base**. Elle produit un rapport, jamais un échec.

Un seul contrôle y a valeur de preuve, et son périmètre est écrit :

> **Contrôle de convention du dénominateur.** Vérifier
> `NY.GDP.MKTP.CD × PA.NUS.ATLS = NY.GDP.MKTP.CN`.
> **Ce qu'il prouve** : que le WDI convertit toujours le PIB en dollars
> courants avec son DEC alternative conversion factor — donc que la
> phrase du `ⓘ` sur la convention reste vraie.
> **Où l'identité est censée tenir** : sur **toute** cellule (pays,
> année) où les trois séries sont publiées. Mesuré le 2026-08-25 :
> **5 428 cellules sur 5 428, soit 100,000 %**, redénominations
> comprises. Une cellule qui s'en écarte est donc un signal réel, pas du
> bruit.
> **Ce qu'il ne prouve pas** : rien sur le numérateur, rien sur
> `PA.NUS.PPP`, rien sur la justesse du ratio de production.

Les autres relations — `GDP_PPP ↔ GDP_LCU / PPP`, `FCRF ↔ ATLS`,
`ratio_B ↔ ATLS/PPP` — sont calculées et **affichées** dans le même
rapport à titre documentaire, avec la mention explicite qu'elles
**divergent légitimement** et ne constituent ni un seuil, ni une alerte,
ni un chemin de calcul.

### Lot 2 — calcul et API

**Étape 3 — la source unique, et le verrou de millésime.**

*Audit préalable du modèle R3, fait sur le code et non supposé.*
`macro_series.vintage_date` vaut `date.today()` au moment de
l'écriture : c'est la **date d'ingestion Orion**, pas le `lastupdated`
de la série WDI, pas un identifiant de lot commun. Sa granularité est
**(juridiction, concept)**, et une nouvelle vintage n'est écrite que si
les valeurs **diffèrent** de la vintage courante
(`macro.py::_store`). Une exécution d'`orion-ingest macro` est
**atomique** — un seul `commit` après la boucle sur tous les concepts,
donc une panne en cours de route n'écrit rien.

*Ce que cela garantit, et ce que cela ne garantit pas.* Après une
exécution **complète et réussie**, les dernières vintages de tous les
concepts reflètent bien le même état de source. Mais **cette propriété
n'est portée par aucune donnée** : deux concepts parfaitement cohérents
portent légitimement des `vintage_date` **différentes** — celui qui n'a
pas bougé conserve sa date de première observation. « Même millésime »
n'est donc pas un test valide, et « dernières vintages des deux
concepts, lues séparément » n'est **pas** une garantie de couple
cohérent. Le geste même qu'introduit R4B — ajouter un concept et
recharger — est précisément celui qui casserait la propriété en silence
si l'on rechargeait le nouveau sans l'autre : on servirait alors un
numérateur d'une édition WDI et un dénominateur d'une autre, sur une
source qui **révise en place**.

*La règle retenue — sans migration, sans nouveau système.* Les deux
concepts du couple deviennent une **unité d'écriture** : lorsqu'une
exécution écrit une nouvelle vintage pour l'un, elle l'écrit **pour les
deux**, même si les valeurs de l'autre sont inchangées. Le schéma, la
contrainte d'unicité `(juridiction, concept, année, vintage)` et l'index
existent déjà ; le surcoût est de **≈ 7 400 lignes dupliquées par
bascule de millésime**, annuelle, sur une table qui en compte **15 224
aujourd'hui** (`gdp_current_usd` 7 412 sur 214 juridictions, `population`
7 812 sur 217 — une seule vintage chacune, 2026-08-24) et ≈ 22 600 après
R4B. `population` et les autres concepts gardent leur comportement R3,
inchangé.

> **Invariant de production, gravé et vérifiable :** pour toute
> juridiction, les deux concepts du couple portent **la même
> `vintage_date` la plus récente**. Le ratio ne peut être construit que
> de deux observations partageant cette date.

*Lecture.* `backend/src/orion/macro.py` :
`ppp_ratio_set(session) -> MacroSet | None` construit
`{(pays, année): ratio}` en `Decimal`, en lisant les deux concepts
**par juridiction à vintage égale**. Deux refus, aucun silence :
une paire incomplète (une année sans son homologue) sort du
dictionnaire ; une juridiction dont les deux dernières vintages
**diffèrent** fait **échouer** la construction — c'est un défaut de
chargement, jamais un cas d'exécution normal, et le mode devient
indisponible (`422`) avec les juridictions fautives au journal ;
aucun état incohérent n'est jamais servi. La clé de cache porte la
vintage commune. Une seule définition du ratio, en Python comme en SQL.

*Aucun rattrapage nécessaire.* `gdp_ppp_current_intl` n'existe pas
encore et `gdp_current_usd` ne porte aujourd'hui qu'**une seule
vintage** (2026-08-24, vérifié en base) : la première exécution R4B écrit
donc les deux concepts le même jour, et l'invariant tient dès l'origine —
sans migration ni reprise de données.

*Test qui doit pouvoir échouer.* Un corpus semé où
`gdp_ppp_current_intl` porte la vintage `2026-11-01` et
`gdp_current_usd` la vintage `2026-08-24` pour la **même** juridiction :
`ppp_ratio_set` doit **refuser**, et l'API répondre `422`. Le test
échoue si le code calcule un ratio à partir de ces deux instantanés
incompatibles. C'est le seul test du lot dont l'objet est de prouver
qu'un mélange est **impossible**, pas qu'un calcul est juste.

**Étape 4 — la colonne.** `backend/src/orion/search/explore.py` : mode
`ppp` ⇒ grain participation forcé, perspective `recipient` forcée,
`funding = sum(pa.amount_eur × usdr.rate × mdp.value / mdu.value)` avec
deux `LEFT JOIN macro_series` (même mécanique de dernière vintage que
`md_join` en R3) et la table de taux USD **déjà** jointe par R3. La
colonne `ranking` reste **nominale** (verrou du § 11, déjà en place).
Le chemin nominal n'ajoute rien : aucun octet de SQL ne change quand
`value` est absent.

**Étape 5 — exclusions partielles.** `sum(...) FILTER (WHERE ratio IS
NULL)` dans la même passe, ventilé sur les **trois** motifs partiels du
§ 15.2 — `no_country`, `no_jurisdiction_series`, `no_reference_year`.
Le troisième se distingue du deuxième par une question posée au jeu de
ratios, pas à la ligne : *cette juridiction a-t-elle le couple sur au
moins une année ?* `ppp_ratio_set` expose donc, à côté du dictionnaire
`(pays, année) → ratio`, l'ensemble des juridictions **couvertes au
moins une fois** — une projection du même jeu, aucune requête de plus.
Calculé depuis le périmètre affiché, par construction. Les trois refus
de vue ne passent **pas** par ce bloc : étape 6.

**Étape 6 — API, et la séparation des deux natures.**
`GET /explore/aggregate` accepte `value=ppp` ;
`base`/`cur`/`perspective` refusés (`400`).

*Trois refus de vue*, chacun avec son code. La réponse ne contient
alors ni agrégat, ni `excluded`, ni couverture.

**Avant tout calcul** — décidables depuis l'état de la vue :

- `422 ppp_requires_single_award_year` — la fenêtre temporelle ne résout
  pas exactement une année ;
- `422 ppp_year_unavailable` — **aucune** juridiction ne publie l'année
  cadrée (2026, 2027 aujourd'hui) ; la réponse nomme l'année. Test :
  le jeu de ratios ne contient aucune entrée pour cette année — une
  lecture de dictionnaire, pas une requête.

**Après la requête** — indécidable autrement (§ 15.3) :

- `422 ppp_reference_unavailable_for_view` — le périmètre filtré porte
  de la valeur nominale mais rien de convertible. Le précédent
  architectural existe : `api/explore.py` refuse déjà sur le résultat
  (`if result is None → 400`). La décision est une fonction
  déterministe de l'agrégat, donc le cache reste valide.

*Trois exclusions partielles*, dans une réponse qui, elle, contient un
agrégat : `excluded = {no_country: {...}, no_jurisdiction_series: {...},
no_reference_year: {...}}` et `meta.reference.coverage` en part de la
valeur affichée. `meta.reference` porte aussi le mode, la perspective
forcée, l'année résolue et **les deux séries avec leur snapshot**.

**Invariants vérifiables** : `coverage` et `excluded` n'existent que
dans une réponse `200` ; aucun chemin de code ne produit une couverture
de 0 % ; une vue **vide** (aucune valeur nominale) répond `200` comme en
nominal, sans couverture ni exclusions — la référence n'y est pas en
cause. Aucun autre endpoint modifié. OpenAPI à jour.

**Étape 7 — performance.** Deux jointures `macro_series` de plus que
`gdp` (deux concepts au lieu d'un). **Risque nommé** : le surcoût
consigné du mode `real` (jusqu'à ~5,9× sur `by=funder`) montre que la
passe d'exclusion est le poste coûteux. Budget : ≤ 2× le nominal sur
`by=country`. **Déclencheur d'optimisation nommé** : si la recette
ressent le premier appel, matérialiser une vue `ppp_ratios` (pays ×
année × ratio × millésimes) — quelques milliers de lignes — jamais une
colonne sur `projects` ou `participations`.

### Lot 3 — surface et filets

**Étape 8 — sélecteur.** `frontend/src/components/reference-selector.tsx` :
groupe `PURCHASING POWER`, un mode, aucun paramètre secondaire, affiché
seulement quand **① la vue est cadrée sur une année unique** et **② la
dimension est l'une du § 12.2** (nouveau drapeau `pppAvailable`, même
mécanique que `scaleAvailable`). Le drapeau est calculé depuis l'état
résolu de la vue, jamais depuis une supposition côté client ; le mode ne
touche **jamais** au filtre temporel.

**Étape 9 — unité et ⓘ.** `reference-note.tsx` : les blocs du § 13,
dans l'ordre imposé. `frontend/src/i18n.ts` : nouvelles clés
`explorer.reference.ppp*`, EN 100 % EN, FR 100 % FR, parité gardée par
`i18n-parity.test.ts`.

**Étape 10 — canonicalisation.** `explore-state` : `value=ppp` ;
`base`, `cur`, `perspective` supprimés à l'écriture ; mode inconnu →
nominal.

**Étape 11 — tests.**
*Test-or 1* : ratio des **États-Unis = 1,000000** exactement, toutes
années — attrape un couple inversé, un mauvais concept, un millésime
croisé.
*Test-or 2* : sur un corpus semé reproduisant l'agrégat UE, `Σ des 27
membres = agrégat publié` (le contrôle du § 7.1).
*Test-or 3* : projet multinational semé — `Σ participations` =
moyenne pondérée par les montants, et ≠ PPP du coordinateur.
*Test-or 4* : un pays, une année, un chiffre recalculé **à la main**
depuis les deux séries publiées.
*Invariance* : réponse nominale **identique octet pour octet**.
*Test-or 5* : **année unique** — une vue cadrée sur deux années ou sans
borne temporelle n'expose pas le mode, et le force par l'URL répond
`422 ppp_requires_single_award_year` ; une vue cadrée sur 2026 répond
`422 ppp_year_unavailable`. Un test de non-régression vérifie que
basculer en `ppp` **ne modifie pas** le filtre temporel de l'état.
*Test-or 8 — la règle du périmètre filtré* (§ 15.3), les cinq états :
`2025`+`BM` → `422 ppp_reference_unavailable_for_view` ;
`2025`+`BM~FR` → `200`, BM dans `no_reference_year` ;
`2025`+`NC` → `422` même code ; vue entièrement `no_country` avec
montants → `422` même code ; vue sans aucune valeur nominale → `200`
vide, sans couverture ni exclusions. Aucun de ces cas ne doit produire
`ppp_year_unavailable`, dont le message serait faux.
*Refus* : territoire jamais couvert → exclu et compté
(`no_jurisdiction_series`) ; territoire couvert ailleurs mais pas cette
année → exclu et compté (`no_reference_year`), **jamais confondu avec le
précédent** ; participation sans pays → exclue et comptée ; `by=year`, `by=funder`, `by=programme`,
`by=subdivision` → mode absent, et `422` s'il est forcé par l'URL.
*Test-or 7 — millésimes incompatibles* : couple semé à vintages
divergentes pour une même juridiction → `ppp_ratio_set` refuse, API
`422`. Le test échoue si un ratio est calculé (étape 3).
*Garde-fous d'ingestion* (étape 2, niveau 1) : couple incomplet →
refus ; ratio hors bande → refus ; `ratio_PPP(US) ≠ 1,000000` → refus.
Aucun test ne suppose une identité impliquant `PA.NUS.PPP`,
`PA.NUS.FCRF` ou `NY.GDP.MKTP.CN` : ces relations divergent
légitimement (§ 3.3, § 3.6) et vivent dans l'audit diagnostique non
bloquant.
*Test-or 6* : **frontière de surface** — les chaînes de paramètres
construites par la page `/compare` ne portent jamais `value=ppp` (test
sur les chaînes produites, pas sur le rendu) ; `GET /compare/organisations`
reste inchangé octet pour octet.
*Test de rejeu* : `ExploreView` recevant une chaîne `value=ppp` que
l'API refuse (`422`) affiche le message d'indisponibilité et propose le
nominal — jamais une vue vide, jamais un « 0 % ».
*e2e* : bascule → `value=ppp` dans l'URL, unité changée, ligne
d'exclusion chiffrée sur ses trois motifs, rechargement fidèle, EN et FR.

**Étape 12 — recette locale** (corpus complet, Firefox) : ① nominal
inchangé au chiffre près ; ② vue pays **cadrée sur 2023** en PPP →
couverture affichée **99,984 %**, exclusion 6,630 M€ ventilée
`no_country` 5,912 · `no_jurisdiction_series` 0,656 ·
`no_reference_year` 0,062 ; ② bis vue **cadrée sur 2025** → couverture
**99,913 %**, exclusion 18,150 M€ dont **16,931 M€ en
`no_reference_year`** (Bermudes 12,645 · Féroé 2,433 · Groenland 1,255 ·
Liban 0,599) et 0,366 M€ en `no_jurisdiction_series` ; ② ter
`2025`+`country=BM` → refus `ppp_reference_unavailable_for_view` ; ③ vue cadrée sur **2026** → refus propre
`ppp_year_unavailable`, retour au nominal proposé ; ④ vue **sans borne
temporelle** → le groupe PURCHASING POWER n'apparaît pas, et le forcer
par l'URL donne `ppp_requires_single_award_year` ; ⑤ Top identique au
nominal, valeurs réordonnées visuellement ; ⑥ un chiffre vérifié à la
main depuis les deux séries publiées ; ⑦ page `/compare` inchangée, et
un dossier contenant une vue `ppp` se rejoue ou se refuse proprement ;
⑧ FR/EN, sombre/clair, mobile, reduced-motion ; ⑨ checklist design
(10 pièges).

---

## Ce qu'on ne construit pas (R4)

- Aucun dollar international **constant**, aucune année de base, aucun
  paramètre `base` en `ppp`.
- Aucun **PPP financeur**, aucune matrice symétrique pour la symétrie.
- Aucune **PPP maison** : ni moyenne de pays, ni PPP de région, ni PPP
  d'agrégat appliquée à des lignes, ni PPP d'un pays voisin en
  remplacement d'une valeur manquante.
- Aucun **PPP du coordinateur** ni du financeur appliqué à un projet
  multinational ; aucune **répartition égale** d'un montant projet entre
  participations sans montant.
- Aucun **PPP dans TREND** (ni Index 100, ni croissance annuelle).
- Aucun **reclassement** du Top par le PPP.
- Aucune **lecture infranationale** (`by=subdivision` interdit).
- Aucune **série temporelle** en PPP tant que le constant n'existe pas.
- Aucune **somme pluriannuelle** de dollars internationaux — le mode
  n'existe pas hors d'une année d'attribution unique (§ 4.4).
- Aucun **paramètre d'année propre au mode** : l'année vient du filtre
  temporel de la vue, jamais d'un second endroit.
- Aucune **modification du filtre temporel** par le sélecteur de lecture.
- Aucune affirmation d'**additivité générale des PPP** : ce qui est
  établi, c'est la cohérence avec la pratique d'agrégation du WDI, à
  unité et année identiques.
- Aucune présentation du ratio comme un **taux de change de marché** ni
  comme le taux obtenu par un bénéficiaire (§ 3.6).
- Aucune ingestion **ICP-cycles, FMI, UIS** ; aucune série dont la
  licence n'est pas lue **par indicateur**.
- Aucun mélange **dollar international / PPS Eurostat**.
- Aucune **route A** en production ; aucun taux de change mondial ingéré.
- Aucun raccordement des fiches, de la recherche, de `/compare`, des
  decks ni des exports — surfaces = Explorateur, doctrine constante.

---

## Verdict R4

### **GO R4B avec périmètre réduit.**

**Ce qui est validé, et pourquoi.**

La question « quel volume de ressources locales ce financement pouvait-il
commander » est une vraie question, sans autre instrument que les PPP, et
son calcul est **entièrement reconstructible** à partir de deux séries
publiées sous CC BY-4.0 vérifiée par indicateur, avec **plus de 99,9 %**
de la valeur affichée couverte sur les vues où le mode existe.
La route retenue **coïncide avec la reconstruction par facteurs dans les
cas où les identités sous-jacentes du WDI sont alignées** — écart
0,000 % sur douze pays de contrôle, −0,02 % en pondéré sur le corpus.
**Là où ces identités intermédiaires divergent ou deviennent ambiguës,
Orion ne tente aucune reconstruction : il consomme directement le couple
d'agrégats publié par le WDI.** Les cas sont nommés et mesurés :
redénominations monétaires (843,0 M€ du corpus, faux d'un facteur 2 à
30), facteurs de conversion alternatifs (jusqu'à 27 % d'écart), et
ruptures de l'identité du numérateur (Inde 2,959 %, Nigeria 28,988 %).
Aucune équivalence universelle n'est revendiquée — c'est précisément
parce qu'elle n'existe pas que la reconstruction est écartée.
La règle d'agrégation entre pays n'est pas une invention d'Orion : à
unité et année identiques, elle est cohérente avec la pratique
d'agrégation du WDI, dont l'agrégat UE **est** la somme exacte de ses 27
membres (écart 0,000 % sur seize années). La règle des projets
multinationaux tombe du grain participation, et les trois alternatives
fausses sont chiffrées (−10 %, +4 %, +32 %).

**Ce qui est refusé, et pourquoi — la partie non défendable de R4.**

1. **Le dollar international constant.** La chaîne qu'Orion pourrait
   construire s'écarte de −11 % à +13 % de la série publiée sous ce nom.
   Non défendable. Refusé jusqu'à ingestion d'un déflateur par
   juridiction **et** test-or de reconstruction.
1 bis. **Toute vue pluriannuelle** (option B de la contre-relecture).
   La somme `Σ montant_USD(a) × ratio(pays, a)` additionne des volumes
   mesurés dans des unités de millésimes différents ; l'effet de profil
   temporel atteint **16 points** entre la Norvège et la Suisse, et le
   chiffre pluriannuel Pologne/France (+81 %) est dominé par les
   conditions de 2005-2015 alors que la réponse de 2025 est +46 %. Juste
   au sens du calcul, faux au sens de la lecture. **Non défendable.**
2. **Toute lecture temporelle** — série `by=year`, Index 100, croissance
   annuelle. Conséquence directe du point 1, et l'ICP déconseille
   explicitement de tirer des taux de croissance des PPP. Non défendable.
3. **Le PPP financeur.** Aucune question utilisateur claire : ratio
   trivial pour les financeurs nationaux, et 18,96 % de l'argent
   européen reçu hors UE-27. Non défendable.
4. **`by=funder` et `by=programme`**, même en perspective bénéficiaire :
   le changement de grain déplacerait la population comptée entre
   nominal et PPP. Refusé jusqu'à décision produit séparée.
5. **`by=subdivision`.** Lecture infranationale d'une parité nationale.
   Non défendable.
6. **La route A** et, avec elle, toute ingestion de taux de change
   mondiaux. Démontrée fausse sur redénomination. **Et toute autre voie
   de calcul** : `PA.NUS.ATLS / PA.NUS.PPP` n'en est pas une non plus —
   l'égalité avec le ratio de production est fausse partout où
   l'identité du numérateur casse (Inde 2,959 %, Nigeria 28,988 %).
   Une seule formule en production, le rapport du couple publié.
7. **Le reclassement du Top.** L'ICP place les classements stricts entre
   pays parmi les usages non recommandés. Non défendable.
8. **La page `/compare`** — surface distincte, endpoint propre, jamais
   raccordée au Reference Engine. R4 V1 = Explorateur uniquement, sans
   élargissement implicite.

**Ce qui reste vrai mais fragile, et doit être affiché, pas corrigé.**

Le ratio n'est pas un taux de marché : il incorpore le facteur de
conversion des comptes nationaux du WDI, qui s'écarte du taux officiel
pour les économies à taux multiples ou administrés et pour celles dont
l'année comptable n'est pas l'année civile — 0,402 % du périmètre au-delà
de 0,5 % d'écart, jusqu'à 1 711 % au Liban. Non corrigeable : le taux
réellement obtenu par un bénéficiaire n'existe pas comme donnée.
Le PPP du PIB ne mesure pas le coût de la recherche — le Manuel de
Frascati 2002 § 35 le dit, la NSF le rappelle : c'est un **coût
d'opportunité**. Les PPP annuelles
sont des extrapolations entre cycles, révisées, et le WDI ne signale pas
les ~25 économies dont le facteur est imputé par régression. Les petits
écarts entre pays voisins ne s'interprètent pas. Enfin l'ICP dit que les
PPP ne sont pas conçues pour comparer des flux financiers : Orion ne
franchit cette limite qu'en changeant la question — jamais « combien
d'argent », toujours « quelles ressources locales ». **Si le produit
laisse s'installer la première lecture, le mode devient faux.** C'est la
condition de validité de tout le lot, et elle vit dans le libellé, pas
dans le calcul.

**Périmètre exact du GO** : `value=ppp`, dollars internationaux courants,
ratio du couple PIB PPP / PIB USD, **sur une année d'attribution
unique**, perspective bénéficiaire forcée, grain participation, sur
`by=country`, `by=region`, `by=organisation`, `by=orgtype` et leurs
comparaisons, dans l'Explorateur uniquement, avec les textes ⓘ du § 13 —
y compris l'avertissement `pppRateNote` sur la convention de change.

**Arrêt ici. Aucune ligne de code avant GO explicite sur ce périmètre.**

---

## Annexe A — Contrôles rejouables

### A.1 Séries et licences (API World Bank v2)

```bash
# Définition, unité, source amont
curl -s "https://api.worldbank.org/v2/indicator/NY.GDP.MKTP.PP.CD?format=json" | jq '.[1][0]'

# Licence LUE PAR INDICATEUR + méthode + période de référence
curl -s "https://api.worldbank.org/v2/sources/2/series/PA.NUS.PPP/metadata?format=json" \
  | jq -r '..|objects|select(.id!=null and .value!=null)|"### \(.id)\n\(.value)"'

# Millésime de la série (champ lastupdated)
curl -s "https://api.worldbank.org/v2/country/FR/indicator/PA.NUS.PPP?format=json&date=2024:2024" | jq '.[0]'
```

### A.2 Identités et routes

```bash
# Le couple, pour un pays et une plage d'années
curl -s "https://api.worldbank.org/v2/country/HR/indicator/NY.GDP.MKTP.PP.CD?format=json&date=2008:2025&per_page=200"
curl -s "https://api.worldbank.org/v2/country/HR/indicator/NY.GDP.MKTP.CD?format=json&date=2008:2025&per_page=200"
# La route A, à titre documentaire, sur le même pays
curl -s "https://api.worldbank.org/v2/country/HR/indicator/PA.NUS.PPP?format=json&date=2008:2025&per_page=200"
curl -s "https://api.worldbank.org/v2/country/HR/indicator/PA.NUS.FCRF?format=json&date=2008:2025&per_page=200"
```

Attendu : `PPP` en euro sur tout l'historique, `FCRF` en kuna jusqu'en
2022 puis en euro — d'où le facteur 7,5345 du § 3.3.

### A.3 Additivité de l'agrégat UE

Somme des 27 valeurs nationales de `NY.GDP.MKTP.PP.CD` contre la valeur
publiée pour le code pays `EU`, année par année : écart attendu 0,000 %.

### A.4 Mesures corpus (lecture seule, base locale de recette)

```sql
-- Couverture pays / montant au grain participation
SELECT count(*) AS lignes,
       count(*) FILTER (WHERE pa.country_code IS NULL) AS sans_pays,
       count(*) FILTER (WHERE pa.amount_eur IS NULL)   AS sans_montant,
       round(sum(pa.amount_eur)/1e9,2) AS mds_eur
FROM participations pa;

-- Matrice (pays, année) qui sert au calcul de couverture PPP
SELECT coalesce(pa.country_code,'??'),
       coalesce(extract(year FROM p.start_date)::int, -1),
       count(*), round(sum(pa.amount_eur)/1e6,4)
FROM participations pa JOIN projects p ON p.id = pa.project_id
WHERE pa.amount_eur IS NOT NULL GROUP BY 1,2;

-- Étalement multinational
WITH c AS (SELECT pa.project_id, count(DISTINCT pa.country_code) AS n
           FROM participations pa WHERE pa.country_code IS NOT NULL GROUP BY 1)
SELECT CASE WHEN n = 1 THEN '1 pays' WHEN n BETWEEN 2 AND 5 THEN '2-5'
            WHEN n BETWEEN 6 AND 20 THEN '6-20' ELSE '>20' END, count(*)
FROM c GROUP BY 1 ORDER BY 1;

-- Part du financement CORDIS reçue hors UE-27
WITH eu27 AS (SELECT unnest(ARRAY['AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE',
                                  'GR','HU','IE','IT','LV','LT','LU','MT','NL','PL','PT',
                                  'RO','SK','SI','ES','SE']) AS c)
SELECT CASE WHEN pa.country_code IS NULL THEN 'sans pays'
            WHEN pa.country_code IN (SELECT c FROM eu27) THEN 'UE-27'
            ELSE 'hors UE-27' END,
       count(*), round(sum(pa.amount_eur)/1e9,3)
FROM participations pa JOIN projects p ON p.id = pa.project_id
WHERE p.source LIKE 'cordis%' AND pa.amount_eur IS NOT NULL GROUP BY 1;

-- Participations sans montant individuel
WITH pp AS (SELECT project_id, count(*) FILTER (WHERE amount_eur IS NOT NULL) AS avec,
                   count(*) AS tot FROM participations GROUP BY 1)
SELECT CASE WHEN pp.project_id IS NULL THEN 'aucune participation'
            WHEN pp.avec = 0 THEN 'aucune montée'
            WHEN pp.avec < pp.tot THEN 'partiellement montées'
            ELSE 'toutes montées' END,
       count(*), round(sum(p.funding_amount_eur)/1e9,3)
FROM projects p LEFT JOIN pp ON pp.project_id = p.id
WHERE p.funding_amount_eur IS NOT NULL GROUP BY 1;
```

### A.5 Sources consultées

- Banque mondiale — WDI, métadonnées par indicateur (API v2,
  `sources/2/series/<code>/metadata`), millésime 2026-07-13.
- Banque mondiale — ICP : pages *Uses*, *FAQ*, *Methodology* ; méthode
  d'extrapolation des facteurs PPP (Data Help Desk).
- OCDE — *Frascati Manual 2002*, **§ 35** (section 1.7.2) et **annexe
  10** (déflateurs et convertisseurs de R&D), texte intégral lu.
  L'édition 2015 n'a pas été citée : le PDF public accessible n'en
  contient que la table des matières, et aucun passage n'a pu être
  vérifié.
- Eurostat — métadonnées *Purchasing power parities* (`prc_ppp`) et
  *Research and development* (`rd`) ; glossaire *Purchasing power
  standard*.
- NSF / NCSES — *Cross-National Comparisons of R&D Performance*.
