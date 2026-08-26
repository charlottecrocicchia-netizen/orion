# Conception — R5A : dénominateurs budgétaires de R&D publique (étude méthodologique)

> **Statut : étude close, corrigée en contre-relecture, soumise à
> arbitrage** (2026-08-26).
> **Verdict en tête, démontré au § 21** : **`GO R5B avec périmètre
> réduit`** — une seule métrique (*Share of NSF award obligations*,
> § 19.2), un seul financeur, en métrique indépendante hors Reference
> Engine. **Le mode budgétaire global reste NO-GO**, comme EC, NIH et
> GBARD.
> Aucune ligne de code, aucune migration, aucune ingestion, aucune
> dépendance, aucune modification d'UI n'a été produite par ce chantier.
> Il instruit la porte D12 de `docs/conception-reference-engine.md`,
> dont la première des quatre exigences est « définir le dénominateur
> exact ». Nous avons commencé par définir le **numérateur** — et c'est
> ce qui a décidé de l'issue.
>
> **En une phrase** : le numérateur est bon partout (exact côté UE,
> excellent côté NSF) ; le **dénominateur manque partout sauf un** — la
> série officielle « Award Obligation Amount » de la NSF, extraite
> FY2011-FY2025, contre laquelle la série Orion se réconcilie dans le
> seuil ±5 % gravé avant calcul (écarts −1,17 % à −4,26 % sur les
> quatre exercices testés, quinze années au même signe, § 9.4.6).
>
> **Amendement final et ultime verrou (2026-08-26)** : le contrat R5B
> est **gelé** au § 20.1 et le verrou du prédicat est levé au § 9.4.9 —
> **`R5B READY`**. Numérateur **et** dénominateur proviennent du même
> artefact officiel (« @Award Details Sheet », table award × FY ×
> obligation-du-FY dont l'existence, le grain et les colonnes sont
> démontrés) ; l'éligibilité d'une ligne est sa **présence dans le
> snapshot**, jamais une règle Orion — la règle d'instruments un temps
> proposée a été **invalidée sur preuve** (§ 9.4.9) et reste au rapport
> comme pièce d'anatomie. Pipeline d'artefact (jamais de transcription
> manuelle), axe `fy=` étanche à `time=` (§ 19.4), Top par obligations
> R5 (§ 19.5), cinq conditions de disponibilité (§ 19.6),
> réconciliation stockée par millésime avec couverture affichée
> (§ 20.1 C3). Le ±5 % reste le seuil de survie de la route, jamais une
> précision revendiquée.
>
> **Corrections de contre-relecture consignées** : Frascati § 12.43 est
> une recommandation d'étape, pas une exclusion (§ 7.1) ; le domaine
> public NSF est déclaré explicitement, pas extrapolé (§ 6.4) ; la
> licence des bulk datasets CORDIS est précisée fiche par fiche
> (§ 4.1) ; les pourcentages du profil de paiement sont attribués à leur
> programme et millésime exacts (§ 4.5) ; et la lecture « trois
> dénominateurs = ambiguïté » est requalifiée en artefact de libellé
> (§ 9.1).
>
> **Amendement R0 que cette étude rend nécessaire** (§ 20.2) : la phrase
> du § D12 « Orion observe des cohortes d'engagement » est **vraie pour
> CORDIS et fausse pour NIH/NSF**. Mesuré ici : 93,91 % des attributions
> NSF valent exactement la somme de leurs obligations annuelles déjà
> constatées, et le montant NIH est la somme des tranches d'exercices
> déjà publiées. Orion n'additionne donc pas une grandeur, il en
> additionne **deux**, et c'est la découverte centrale de R5A.

---

## 0. Porte zéro-dette — franchie avant d'ouvrir la recherche

Vérifié le 2026-08-26, dans cet ordre, avant toute recherche :

| Contrôle | Résultat |
|---|---|
| `main` = `origin/main` | ✅ `e08cfb5` des deux côtés, `git fetch` à l'appui |
| Arbre de travail propre | ✅ `git status --porcelain` muet |
| `make lint` (ruff check + format + oxlint) | ✅ sortie 0 |
| Suite backend | ✅ **312 tests**, 17,99 s, zéro warning |
| Suite frontend | ✅ **144 tests**, 19 fichiers |
| TODO / FIXME / HACK dans le code | ✅ aucun (les seuls `XXX` sont des identifiants UEI factices de `test_nsf.py`) |
| Dettes R4 | ✅ les trois relevées au lot sont soldées et consignées (`conception-r4-ppp.md` § 18.1) ; les deux défauts de recette § 18.2 sont corrigés et verrouillés |
| Documentation incorrecte du Reference Engine | ✅ aucune trouvée — au contraire, R0 § D12 avait **correctement** nommé la porte que cette étude franchit |

**Un reste, qui n'est pas une dette de code** : la recette visuelle
fondatrice de R4 (thèmes sombre/clair, mobile, `reduced-motion`, passe
Firefox) attend Charlotte — noté au § 18.2 de R4, inchangé ici.

**Une dette produit antérieure que R5A rend plus urgente, sans la
créer** : les deux réserves NIH du 2026-08-03 (`docs/data-sources.md`)
attendent toujours une décision fondatrice — les projets « parapluie »
et les 25 215 projets sans date. R5A les mesure au § 17.2 et au § 15,
parce qu'elles pèsent directement sur tout numérateur budgétaire. Elles
étaient documentées avec recommandation avant R4 ; elles ne sont pas
issues de R4.

---

## 1. La question utilisateur, avant toute formule

La consigne est de ne pas partir du libellé `% of R&D budget` pour lui
chercher ensuite un dénominateur. Trois questions ont donc été
instruites séparément, chacune avec son financeur, sa base comptable,
son axe de temps, et surtout **ce qu'elle ne permet pas de dire**.

### 1.A — « Effort du financeur »

> *Quelle part des ressources publiques de R&D du financeur les
> attributions observées par Orion représentent-elles ?*

| | |
|---|---|
| Perspective | **Financeur** (juridiction qui paie) |
| Base attendue au numérateur | Ce que le financeur a engagé/obligé |
| Base attendue au dénominateur | Ce dont le financeur disposait pour la R&D |
| Axe de temps | Année budgétaire du financeur |
| Périmètre institutionnel | L'agence, ou le programme, ou l'État entier — trois périmètres, trois réponses différentes |
| Ce que le ratio dirait | La couverture d'Orion sur ce financeur : « nous voyons X % de ce que cette agence consacre à la recherche » |
| Ce qu'il ne dirait **pas** | Ni l'intensité de l'effort national, ni une part de marché, ni une comparaison entre financeurs de tailles différentes |

**Constat** : c'est une question de **couverture de corpus**, pas une
question économique. Elle intéresse Orion (« que voyons-nous ? ») plus
que l'utilisateur (« que se passe-t-il ? »). Elle est déjà servie, en
mieux et sans ratio, par la page `/about-data` et le registre des
sources. Retenue comme question **de méthode**, pas comme mode de
lecture.

### 1.B — « Importance d'un programme »

> *Quelle part du budget R&D public pertinent est attribuée à ce
> programme / domaine / ensemble de projets ?*

| | |
|---|---|
| Perspective | **Financeur**, forcée |
| Base attendue | Engagements des deux côtés, sur le même périmètre |
| Axe de temps | La **cohorte** (appel, work programme, exercice d'attribution), pas l'année civile |
| Périmètre | Le programme et son enveloppe — le couple doit être publié par la même source |
| Ce que le ratio dirait | Le poids relatif d'un domaine dans une enveloppe nommée : « le cluster Santé pèse X % du work programme 2023-2024 » |
| Ce qu'il ne dirait **pas** | Rien sur l'exécution (un engagement n'est pas une dépense), rien de comparable entre programmes dont les enveloppes ne sont pas construites pareil |

**Constat** : c'est la seule des trois questions dont le dénominateur
soit **naturellement de même nature que le numérateur** — une enveloppe
d'appel et les subventions issues de cet appel sont toutes deux des
engagements, sur le même périmètre, décidés par le même acte. C'est la
question la plus défendable. Son problème n'est pas comptable, il est
d'approvisionnement (§ 8, Route B).

### 1.C — « Intensité par rapport au budget disponible »

> *Quelle part de l'enveloppe effectivement mobilisable au cours d'une
> période correspond aux projets observés ?*

| | |
|---|---|
| Perspective | Financeur |
| Base attendue | Crédits **de paiement** ou dépenses, au dénominateur |
| Axe de temps | Année budgétaire, avec profil annuel au numérateur |
| Ce que le ratio dirait | Un taux de mobilisation, proche d'un taux d'exécution budgétaire |
| Ce qu'il ne dirait **pas** | Rien tant que le numérateur n'a pas de profil annuel réel — et Orion n'en a un que pour une source sur trois (§ 2) |

**Constat** : exige la Route D (§ 8). Praticable pour NSF seul, à un
coût d'ingestion et de conception qui n'est pas celui d'un « mode de
lecture ».

### La question retenue pour la suite de l'étude

**1.B**, et elle seule, passe le filtre « le dénominateur est de même
nature que le numérateur ». 1.A est une question de couverture qui a
déjà une meilleure réponse ; 1.C exige un numérateur qu'Orion n'a pas.
Tout le reste du document teste si 1.B survit aux données.

---

## 2. Le numérateur Orion — audit exact, source par source

C'est la section qui décide de tout, et c'est celle qui a produit la
surprise. Toutes les mesures qui suivent sont rejouables : les requêtes
sont en annexe (§ 22), jouées le 2026-08-26 sur le corpus local
(699 798 projets, dump du 2026-08-21).

### 2.0 Le corpus, tel qu'il est

| Financeur | Source | Projets | Avec date | Montant natif | Devise | Première/dernière année de début |
|---|---|---:|---:|---:|---|---|
| Commission européenne | `cordis-fp7` | 25 785 | 25 666 | 46,04 Md€ | EUR | 2007 → 2018 |
| Commission européenne | `cordis-h2020` | 35 389 | 35 377 | 68,33 Md€ | EUR | 2014 → 2023 |
| Commission européenne | `cordis-horizon` | 23 278 | 23 278 | 62,05 Md€ | EUR | 2021 → 2027 |
| NIH | `nih` | 380 275 | 355 060 | 735,90 Md$ | USD | 1965 → 2026 |
| NSF | `nsf` | 235 071 | 235 071 | 146,12 Md$ | USD | 1995 → 2027 |

**ADEME n'est pas dans le corpus** et la question ne se pose donc pas :
décision fondatrice du 2026-07-31 (`docs/data-sources.md`), source hors
sujet, France 2030 visée plus tard. La consigne « ADEME si suffisamment
représentée » se résout par « pas représentée du tout ».

### 2.1 CORDIS — un engagement prévisionnel complet

| Question | Réponse constatée dans le code et les données |
|---|---|
| Nature exacte du montant | `projects.funding_amount = ecMaxContribution` — la **contribution UE maximale** inscrite à la convention de subvention (`ingest/cordis/load.py:171`) |
| Est-ce le coût total ? | Non. `total_cost` existe à côté et vaut **plus** : taux de financement 70,0 % (FP7), 82,1 % (H2020), 98,7 % (Horizon Europe, mais sur un sous-ensemble — 12 377 projets Horizon n'ont pas de coût total) |
| Date utilisée | `start_date = startDate`, date de **démarrage contractuelle** du projet |
| Autre date disponible | **Oui — `ecSignatureDate`** est présente dans `raw` et n'est pas utilisée. C'est la date de l'engagement juridique |
| Profil annuel réel | **Non.** Le payload CORDIS ne contient aucune tranche annuelle : `startDate`, `endDate`, `ecSignatureDate`, `contentUpdateDate`, et c'est tout |
| Amendements | Non distingués — le montant est celui de la dernière photographie, les avenants sont invisibles |
| Cofinancements | Présents et mesurables par `total_cost − ecMaxContribution`, jamais additionnés au numérateur |
| Double compte | Non détecté : grain projet et grain participation concordent à −2,45 % (FP7) / −0,19 % (H2020) / +0,21 % (Horizon) |
| Engagement / obligation / paiement / dépense | **Engagement**, au sens du plafond contractuel signé. Ni obligation annuelle, ni paiement, ni dépense justifiée |

**La preuve que le montant CORDIS est complet dès la signature** : les
cohortes récentes ne s'effondrent pas alors que presque tous leurs
projets sont en cours.

| Année de début | Valeur Horizon Europe | Part encore en cours au 2026-08-26 |
|---:|---:|---:|
| 2023 | 14,99 Md€ | 71,9 % |
| 2024 | 13,32 Md€ | 96,5 % |
| 2025 | 10,39 Md€ | 99,7 % |

Une cohorte dont 99,7 % des projets courent encore porte déjà sa pleine
valeur : le montant n'attend pas l'exécution.

### 2.2 NIH — un cumul d'exercices déjà publiés

| Question | Réponse constatée |
|---|---|
| Nature exacte du montant | `sum(TOTAL_COST) FILTER (WHERE NOT is_subproject)` **sur toutes les années fiscales publiées** du `CORE_PROJECT_NUM` (`ingest/nih/load.py:135`) |
| Date utilisée | `min(project_start)` — la date de début de la **première** tranche, qui peut précéder la fenêtre d'ingestion de plusieurs décennies |
| Fenêtre réelle des tranches | FY2005 → FY2025 (`docs/data-sources.md`) |
| Profil annuel réel | **Partiellement perdu.** La table de préparation `nih_awards` porte `(fy, total_cost)` ligne à ligne, mais elle est détruite en fin d'ingestion ; le projet ne garde dans `raw` que la **liste des années** (`fiscal_years`) et leur nombre, sans les montants |
| Récupérable ? | **Oui, et à faible coût** : RePORTER publie le montant par exercice, et les **961 Mo d'archives annuelles sont déjà dans le cache local** (`backend/data/cache/nih-projects-*.zip`). Ce n'est pas une limite de la source, c'est un choix de repli d'Orion — réversible sans re-téléchargement |
| Amendements / renouvellements | C'est le mécanisme même : 64,8 % de la valeur porte **5 exercices ou plus**, 19,9 % en porte 10 ou plus, le maximum observé est 21 |
| Double compte | Écarté au repli (`NOT is_subproject`) ; grain projet/participation concordant à −0,18 % |
| Engagement / obligation / paiement / dépense | **Somme d'obligations annuelles constatées**, tronquée aux deux bouts par la fenêtre d'ingestion |

**L'artefact de rattachement, chiffré** :

- **29,2 %** de la valeur NIH a une première année fiscale **différente**
  de son année de début Orion ;
- **22,7 %** a plus d'un an d'écart ;
- **12,3 %** a **plus de cinq ans** d'écart.

**Le cas d'école** — le projet `P51OD011092` : `start_date` 1997-05-01,
190,21 M$, et ses années fiscales réelles sont **2012 à 2025**. Orion
date de 1997 de l'argent obligé quinze à vingt-huit ans plus tard.
Ce n'est pas un cas isolé : 41 879 projets NIH (16,33 Md€) portent une
date de début antérieure à 2005, dont une « cohorte 1997 » de
13,88 Md$ construite sur 1 814 projets.

**La censure à droite, symétrique** : la cohorte NIH 2023 vaut
19,81 Md$, celle de 2024 13,19 Md$, celle de 2025 6,77 Md$ — alors que
81 %, 88 % et 95 % de ces projets courent encore. La valeur n'a pas
baissé : elle **n'est pas encore écrite**.

### 2.3 NSF — un cumul d'obligations, et le profil réel conservé

| Question | Réponse constatée |
|---|---|
| Nature exacte du montant | `awd_amount` — « ce que NSF a **obligé**, jamais l'intention » (choix fondateur validé, commenté dans `ingest/nsf/parse.py:89`) |
| Date utilisée | `start_date = awd_eff_date`, date d'effet de l'attribution |
| Profil annuel réel | **OUI, et il est conservé** : `raw.fiscal_years` porte, par award, la liste `{fy, amount}` des obligations par exercice, telle que NSF la publie |
| Fidélité du profil | Les tranches couvrent **98,39 %** du montant total, et **93,91 %** des awards ont `awd_amount` = Σ tranches à 1 $ près ; **aucun projet NSF n'est dépourvu de profil**. L'écart de 1,6 % (2,80 Md$ sur 11 899 awards) est une censure résiduelle à gauche : des obligations antérieures à la fenêtre FY2005 |
| Amendements | Ce sont les incréments annuels eux-mêmes |
| Double compte | Les fratries collaboratives sont repliées sous quatre garde-fous ; grain projet/participation identique à 0,00 % |
| Engagement / obligation / paiement / dépense | **Obligation cumulée à date** — la grandeur la plus proche d'un flux annuel de tout le corpus |

**La mesure qui décide** : sur 146,12 Md$ de valeur NSF, **55,15 %
seulement est obligée dans l'année civile de début du projet**. Près de
la moitié de la valeur est rattachée par Orion à une année où la NSF ne
l'a pas obligée.

**Le cas d'école** — l'award `0856145` : 1 073,79 M$ rattachés par Orion
à 2008, alors que NSF publie ses obligations réelles de FY2009 à
FY2018, autour de 110 M$ par an. Et l'award `1755088` : 975,89 M$
rattachés à 2018, dont **5,9 M$** (0,6 %) réellement obligés cette
année-là.

### 2.4 La conclusion de l'audit, en une phrase par source

> **Le numérateur Orion CORDIS est comptablement un engagement
> prévisionnel plafonné, complet à la signature, et non une dépense.**
>
> **Le numérateur Orion NIH est comptablement une somme d'obligations
> annuelles déjà publiées, tronquée à gauche par la fenêtre FY2005 et à
> droite par le présent, et non un engagement initial.**
>
> **Le numérateur Orion NSF est comptablement une obligation cumulée à
> date, dont le profil annuel réel est connu, et non un engagement
> initial.**

Et donc, la phrase qui vaut amendement de R0 § D12 :

> **Orion n'additionne pas une grandeur comptable, il en additionne
> deux** — un engagement prévisionnel européen et un cumul d'obligations
> américain — sous une seule colonne `funding_amount`. Cette colonne est
> parfaitement légitime pour la question « combien d'argent a été
> attribué à ce projet », qui est celle du mode `nominal`. Elle ne l'est
> pas comme numérateur d'un ratio budgétaire, qui exige de savoir *quand*
> l'argent a été engagé.

### 2.5 Ce que la mesure dit du poids du problème

| Source | Valeur portée par des projets pluriannuels | Valeur portée par des projets de plus de 3 ans | Durée médiane |
|---|---:|---:|---:|
| `cordis-fp7` | 99,7 % | 73,5 % | 3,00 ans |
| `cordis-h2020` | 99,5 % | 78,8 % | 3,00 ans |
| `cordis-horizon` | 99,9 % | 72,2 % | 3,00 ans |
| `nih` | 99,0 % | 89,7 % | 4,00 ans |
| `nsf` | 98,1 % | 81,5 % | 3,50 ans |

Le rattachement à une seule année ne concerne pas une frange du corpus :
**il concerne 98 à 99,9 % de sa valeur.** Il n'y a pas de « cas normal »
où le problème ne se pose pas.

---

## 3. Taxonomie comptable — ce qui ne doit jamais entrer dans la même colonne

Le piège nommé par la consigne est réel : « appropriation », « budget
authority », « crédit d'engagement », « enveloppe » et « GBARD » portent
tous le mot budget et ne mesurent pas la même chose. La table ci-dessous
les sépare par leur **moment comptable** — l'instant où la grandeur
naît — parce que c'est le seul critère qui décide de la compatibilité
avec un numérateur d'Orion.

### 3.1 Les grandeurs, une par une

| Grandeur | Juridiction | Définition | Moment comptable | Stock / flux | Périodicité | Consolidée ? |
|---|---|---|---|---|---|---|
| **Appropriation** | US | Autorisation de dépenser votée par le Congrès pour une agence | Vote de la loi de finances | Flux d'autorisation | Annuelle (parfois pluriannuelle ou *no-year*) | Par agence et par compte |
| **Budget authority** | US | Autorité juridique d'engager l'État ; les appropriations en sont la forme principale | Promulgation | Flux d'autorisation | Annuelle | Par compte |
| **Obligation** | US | Engagement juridique ferme de payer (signature de l'award) | Signature de l'attribution | Flux | Exercice fédéral | Par award |
| **Outlay** | US | Décaissement effectif du Trésor | Paiement | Flux | Exercice fédéral | Par compte |
| **Award** | US | L'acte d'attribution lui-même, porteur d'une ou plusieurs obligations | Attribution, puis chaque incrément | Flux | Exercice | Par bénéficiaire |
| **Crédit d'engagement (CE)** | UE | Autorisation d'engager juridiquement l'Union sur des exercices futurs | Adoption du budget annuel | Flux d'autorisation | Annuelle | Par ligne budgétaire |
| **Crédit de paiement (CP)** | UE | Autorisation de décaisser pendant l'exercice | Adoption du budget annuel | Flux d'autorisation | Annuelle | Par ligne budgétaire |
| **Enveloppe pluriannuelle de programme** | UE | Montant maximal du programme inscrit à son règlement | Adoption du règlement | **Stock** (plafond) | Cadre financier (7 ans) | Par programme |
| **Allocation de work programme** | UE | Montant indicatif ouvert par appel/sujet dans le programme de travail | Adoption du work programme | Flux (indicatif) | Annuelle ou biennale | Par sujet et action |
| **Budget d'appel** | UE | Enveloppe d'un appel, somme de ses sujets | Publication de l'appel | Flux | Par appel | Par appel |
| **Dépense (expenditure)** | Toutes | Charge constatée, service fait | Constatation | Flux | Annuelle | Comptabilité générale |
| **GBARD / GBAORD** | OCDE / Eurostat | Crédits budgétaires que l'État **destine** à la R&D, relevés côté financeur dans les documents budgétaires | Vote (initial) ou budget final | Flux d'intention | Annuelle | **Toute l'administration**, tous ministères |
| **GERD financé par l'État** | OCDE / Eurostat | Part de la dépense intérieure de R&D **exécutée** et financée par l'État, relevée côté exécutant | Exécution | Flux | Annuelle | Économie entière |
| **Budget total d'une agence** | Toutes | L'ensemble des crédits de l'agence, R&D et non-R&D confondus | Vote | Flux | Annuelle | Par agence |
| **Budget R&D d'une agence** | Toutes | La part R&D du précédent | Vote | Flux | Annuelle | Par agence |

### 3.2 La règle qui découle du tableau

Trois familles, jamais mélangées :

1. **Autorisations** (appropriation, budget authority, CE, CP, enveloppe,
   allocation de work programme) — ce que l'État s'autorise à faire.
2. **Engagements** (obligation, award, signature de convention) — ce
   qu'il a juridiquement promis.
3. **Décaissements et charges** (outlay, paiement, dépense, GERD
   exécutée) — ce qui est sorti.

Un ratio n'a de sens que **si les deux côtés sont dans la même famille,
sur le même périmètre, et sur le même axe de temps.** Un numérateur
d'engagements divisé par un dénominateur d'autorisations mesure un taux
de consommation d'autorisation, ce qui est une grandeur légitime — mais
ce n'est pas « la part du budget consacrée à ce domaine », et le libellé
doit le dire.

### 3.3 Table de compatibilité numérateur ↔ dénominateur

Les trois numérateurs sont ceux établis au § 2.4. « Compatible » veut
dire : même famille comptable, périmètre superposable, axe de temps
réconciliable **sans transformation inventée**.

| Dénominateur candidat | vs numérateur CORDIS (engagement prévisionnel) | vs numérateur NIH (cumul d'obligations) | vs numérateur NSF (obligation cumulée) |
|---|---|---|---|
| Enveloppe pluriannuelle du programme (H2020, Horizon Europe) | **⚠️ Même famille, mais stock ÷ flux** — utilisable une seule fois, sur le programme entier et clos, jamais par année | ❌ Périmètre étranger | ❌ Périmètre étranger |
| Crédits d'engagement annuels UE | ⚠️ Même famille, **axes de temps différents** : l'engagement budgétaire de l'UE ne coïncide pas avec la date de début Orion (§ 11) | ❌ | ❌ |
| Crédits de paiement annuels UE | ❌ Famille différente (décaissement vs engagement) | ❌ | ❌ |
| **Allocation de work programme / budget d'appel** | ✅ **Même famille, même périmètre, même acte** — le seul couple propre du corpus | ❌ | ❌ |
| Appropriation annuelle NIH | ❌ | ⚠️ Famille différente (autorisation vs engagement) et **périmètre trop large** : l'appropriation NIH couvre l'intra-muros, la gestion, les constructions | ❌ |
| Obligations annuelles NIH (série officielle) | ❌ | ✅ **Même famille** — mais exige la Route D, donc un profil annuel qu'Orion a jeté (§ 2.2) | ❌ |
| Appropriation / budget authority NSF | ❌ | ❌ | ⚠️ Famille différente, périmètre plus large que R&RA |
| **Obligations annuelles NSF (série officielle)** | ❌ | ❌ | ✅ **Même famille, même grandeur, profil annuel disponible des deux côtés** |
| GBARD (Eurostat / OCDE) | ❌ voir § 7 | ❌ voir § 7 | ❌ voir § 7 |
| GERD financé par l'État | ❌ Côté exécutant, pas côté financeur | ❌ | ❌ |
| Budget total d'une agence | ❌ **Interdit par la doctrine** : une agence dont seule une partie est R&D ne fournit pas un dénominateur de R&D | ❌ | ❌ |

**Ce que cette table dit déjà, avant même la recherche documentaire** :
il n'existe **aucune ligne verte commune** aux trois numérateurs. La
symétrie EC / NIH / NSF sur un axe unique `% budget` est écartée par
construction comptable, pas par manque de données.


---

## 4. Union européenne — étude spécifique

Sources lues le 2026-08-26 : règlements (UE) n° 1291/2013 et (UE) 2021/695 (via l'API CELLAR de l'Office des publications), règlement financier 2024/2509, SWD(2024) 29 (évaluation ex-post H2020), décisions de programme de travail C(2024) 2371 et C(2025) 2779, fichiers budgétaires DG BUDG, *Statements of Estimates*, MGA Horizon Europe v1.2, FTS, Horizon Dashboard, documentation CORDIS DET.

### 4.1 Les grandeurs, séparées

| Grandeur | Montant / nature | Source |
|---|---|---|
| **Enveloppe légale H2020** | **74 828,3 M€** (prix courants) — art. 6 du règlement 1291/2013 **version consolidée**, après le redéploiement de 2 200 M€ vers l'EFSI (règlement 2015/1017) | Le chiffre initial de 77 028,3 M€ n'est plus le droit en vigueur |
| **Budget voté cumulé H2020** | **75 623,6 M€** | SWD(2024) 29 |
| **Enveloppe légale Horizon Europe** | **86 123 M€** (prix courants) + 7 953 M€ pour le Fonds européen de défense — art. 12 du règlement 2021/695 | Amendé une seule fois (STEP, 2024/795) : le montant recherche **reste inchangé** |
| **NextGenerationEU** | **jusqu'à 5 000 M€ en prix 2018**, **hors** de l'article 12 — l'article 13 en fait des **recettes affectées externes** | Règlement 2020/2094 |
| **Crédits d'engagement (CE)** | « cover the **total cost of the legal commitments entered into during the financial year** » | Art. 7(3) du règlement financier |
| **Crédits de paiement (CP)** | « cover payments made to honour the legal commitments entered into in the financial year **or preceding financial years** » | Art. 7(4) |
| **Allocation de work programme** | Plafond juridique, avec **flexibilité de 20 %** ; les budgets par appel et par sujet y sont explicitement « **indicative** » | Décisions C(2024) 2371, C(2025) 2779 |
| **`ecMaxContribution`** | « **Maximum amount for EU funding (commitment)** » | CORDIS `DET_fields_description.pdf` |
| **`startDate`** | « **Start of the action** » — pas une date budgétaire | idem |
| **`ecSignatureDate`** | « The date when the European Commission signs the Grant Agreement » | idem |

**La licence exacte des trois datasets ingérés, vérifiée fiche par
fiche (contre-relecture, 2026-08-26)** : les fiches data.europa.eu des
trois distributions CSV qu'Orion ingère (`cordisfp7projects`,
`cordish2020projects`, `cordis-eu-research-projects-under-horizon-europe-2021-2027`)
déclarent toutes la même licence — id `COM_REUSE`, label « **European
Commission reuse notice** », dont la ressource est le texte de la
**décision 2011/833/UE** elle-même. La mention légale de CORDIS ajoute :
« The Commission's reuse policy is implemented by Commission Decision
2011/833/EU », puis « Unless otherwise noted…, the reuse of the
**editorial content** on this website owned by the EU is authorized
under the Creative Commons Attribution 4.0 International (CC BY 4.0)
licence ». **Aucun des deux textes ne dit si les CSV en masse sont du
« editorial content »** : la tension n'est pas tranchée par la source.
Ce qui est certain : dans les deux régimes, la réutilisation
commerciale avec attribution est autorisée — le droit d'usage d'Orion
ne change pas. Deux réserves écrites à porter au registre : les droits
de propriété industrielle sont exclus de la politique de réutilisation,
et « materials provided by beneficiaries receiving EU funding may only
be used according to the terms and conditions applicable to the
respective grant » — une réserve dont la mention légale ne précise pas
quels contenus de CORDIS elle vise. L'archive FP7 elle-même
(vérifiée) n'embarque aucune notice. (Le FTS, lui, est bien déclaré
**CC BY 4.0** sur chacune de ses distributions annuelles.)

### 4.2 Le contrôle sur cas fermé — exigence 3 de la porte D12

C'est le contrôle que R0 § D12 demandait nommément, et il donne un
résultat remarquable :

| | Montant | Subventions |
|---|---:|---:|
| **SWD(2024) 29, évaluation ex-post officielle** | « **EUR 68.3 billion** […] allocated through **35 426 signed grants** » | 35 426 |
| **Orion, corpus `cordis-h2020`** | **68,334 Md€** | **35 389** |
| Écart | **0,05 %** | **0,10 %** |

**Le numérateur CORDIS d'Orion est exact.** Il reproduit, au dixième de
pour-cent près, le total officiel des subventions signées de Horizon
2020. Ce chantier ne trouve donc aucun défaut de collecte : le problème
est **entièrement** dans le rattachement temporel de ce total.

Pour situer ce total dans le programme : 68,334 Md€ représentent
**91,3 %** de l'enveloppe légale (74 828,3 M€) et **90,4 %** du budget
voté (75 623,6 M€). Les ~9 % restants sont la dépense administrative
(4 428 M€ selon le SWD) et ce qui n'est pas passé par des appels à
propositions. C'est cohérent, et c'est une mesure de **couverture**, pas
une métrique produit.

### 4.3 La question centrale, tranchée par la mesure

> **Un projet CORDIS pluriannuel, dont la contribution UE totale est
> rattachée à son année de début dans Orion, peut-il être divisé par un
> budget Horizon annuel sans produire un artefact ?**

**Non.** Voici le ratio, calculé sur les crédits d'engagement annuels
réellement adoptés (fichiers DG BUDG), avec les deux dates disponibles :

**Horizon Europe** — CE en Md€, cohortes Orion en Md€ :

| Année | CE adoptés | Par `startDate` | % | Par `ecSignatureDate` | % |
|---:|---:|---:|---:|---:|---:|
| 2021 | 11,507 | 1,180 | **10,3 %** | 0,799 | **6,9 %** |
| 2022 | 12,239 | 9,981 | 81,5 % | 16,685 | **136,3 %** |
| 2023 | 12,353 | 14,986 | **121,3 %** | 14,516 | **117,5 %** |
| 2024 | 12,897 | 13,322 | **103,3 %** | 11,580 | 89,8 % |
| 2025 | 12,762 | 10,388 | 81,4 % | 9,493 | 74,4 % |
| 2026 | 12,994 | 11,570 | 89,0 % | 9,348 | 71,9 % |

**Le ratio dépasse 100 % trois fois, et les deux dates le font.**
L'amplitude va de **6,9 % à 136,3 %** — un facteur vingt entre deux
années consécutives d'un programme dont le budget varie de 6 %. Aucun de
ces chiffres ne décrit un phénomène économique : ils décrivent le
décalage entre la signature d'une convention pluriannuelle et
l'inscription budgétaire de son engagement.

**Horizon 2020** — le même exercice, sur un programme clos :

| Année | CE adoptés | Par `startDate` | % | Par `ecSignatureDate` | % |
|---:|---:|---:|---:|---:|---:|
| 2014 | 9,022 | 1,597 | **17,7 %** | 3,482 | 38,6 % |
| 2015 | 9,539 | 8,837 | 92,6 % | 9,379 | 98,3 % |
| 2016 | 9,539 | 8,826 | 92,5 % | 9,002 | 94,4 % |
| 2017 | 10,346 | 8,661 | 83,7 % | 8,637 | 83,5 % |
| 2018 | 11,212 | 8,606 | 76,8 % | 9,412 | 83,9 % |
| 2019 | 12,392 | 10,515 | 84,9 % | 10,739 | 86,7 % |
| 2020 | 13,486 | 11,235 | 83,3 % | 11,571 | 85,8 % |
| **2021** | **aucun** | **9,282** | **indéfini** | 6,104 | **indéfini** |
| **2022** | **aucun** | 0,767 | **indéfini** | 0,009 | **indéfini** |

Le cœur du programme (2015-2020) donne des ratios plausibles et stables
(77-93 %). Mais **les deux bords sont ingérables** : l'année d'ouverture
donne 17,7 %, et **10,05 Md€ de cohortes tombent sur des années où le
programme n'a plus aucun crédit d'engagement**. On ne peut pas diviser
par zéro, et on ne peut pas non plus les rattacher à Horizon Europe sans
mélanger deux programmes (§ 17.4).

### 4.4 Le profil annuel n'existe nulle part — et la Commission le dit

Quatre vérifications convergentes, dont deux exhaustives :

1. **CORDIS, tous formats** : la documentation officielle
   (`DET_fields_description.pdf`, 558 lignes) ne contient **aucun** champ
   annuel. Vérifié aussi sur la ligne d'en-tête littérale de
   `project.csv` (22 colonnes, identiques pour H2020 et Horizon Europe),
   sur l'**énumération des 199 chemins d'éléments** d'un fichier XML de
   projet, et sur les propriétés du graphe RDF EURIO. Les seuls montants
   sont `totalCost` et `ecMaxContribution` au niveau projet,
   `ecContribution` / `netEcContribution` / `totalCost` au niveau
   participant. Tous des totaux uniques.
2. **Le FTS l'énonce explicitement**, et c'est un choix méthodologique
   assumé : « As many agreements last several years, with the committed
   amount being spread over that time, **annual information on payments
   cannot give a view of the overall value of the agreement. Therefore
   the site focuses only on commitments** ».
3. **Le Horizon Dashboard** n'offre que trois dimensions temporelles —
   année de signature, année de date limite d'appel, année de fin — et
   affecte donc **100 % de la contribution d'un projet à une seule
   année**, comme Orion.
4. L'évaluation ex-post, les comptes annuels et le rapport annuel de
   gestion ne descendent jamais sous le niveau du programme.

**La Route D est donc structurellement impossible côté UE.** Ce n'est
pas une lacune d'Orion : c'est la position documentée de la Commission.

**Un quatrième piège de champ, à graver** : le graphe EURIO expose une
classe `eurio:GrantPayment` avec **422 007 instances** et une propriété
`hasPayment`. Le nom promet un échéancier ; il n'en est rien. Ses seules
propriétés sont `hasPaymentAmount`, `hasRecipient`, `isPaymentOf` —
**aucune date, aucune année**. Vérification sur un projet : 21 instances,
une par participant, dont les libellés sont exactement les parts par
bénéficiaire. C'est la ventilation **par organisation**, pas par année.

**Une piste qui semblait ouverte, et qui se referme deux fois** : le FTS
porte l'**année de comptabilisation budgétaire** de chaque engagement
(« The year in which the amount awarded to the beneficiary is booked in
the budget »), un `Project ID` joignable à CORDIS, et une licence **CC BY
4.0** — tout ce qu'il faudrait.

- *Premier blocage, vérifié projet par projet* : le FTS **ne ventile
  pas**. Sur les 33 461 subventions H2020 retrouvées dans les millésimes
  2014-2022, **32 939 — soit 98,4 % — n'apparaissent que dans une seule
  année** ; côté Horizon Europe, 18 368 sur 18 855, soit **97,4 %**. Le
  cas typique est net : la subvention `824091`, projet du 01/01/2019 au
  31/12/2023, porte **l'intégralité** de ses 8,49 M€ dans l'exercice
  budgétaire **2018**, celui de sa signature. Aucun montant en 2019, ni
  après. Le « Commitment consumed amount » n'y change rien : c'est un
  **cumul à date réécrit dans la ligne d'origine**, jamais une série.
- *Second blocage* : les totaux FTS **dépassent les crédits votés** —
  18,05 Md€ d'engagements Horizon Europe déclarés pour 2022 contre
  12,24 Md€ de CE adoptés, parce que le FTS agrège gestion directe et
  indirecte et que les entreprises communes y déclarent leurs propres
  bénéficiaires. Un dénominateur ne peut pas être plus petit que le
  numérateur qu'il est censé contenir.

**L'exception, et elle est instructive** : quand un engagement budgétaire
est lui-même fractionné en tranches annuelles, le FTS publie bien un
profil — parce que son unité de publication est l'**engagement
budgétaire**, pas la subvention. C'est le cas d'EUROfusion (§ 17.1). Mais
c'est marginal : **9 subventions H2020 sur 33 461** apparaissent dans
trois années ou plus.

### 4.5 Le décalage engagement / paiement — et il est officiellement chiffré

**Le reste à liquider (RAL).** Ligne « 1.0.11 Horizon Europe » des
comptes annuels consolidés de l'Union, exercice 2024 (COM(2025) 359,
Table 6.10) : **28 646 M€ au 31/12/2024**, en progression continue
depuis 27 571 M€ fin 2021. C'est **2,5 années** de crédits d'engagement
de la rubrique 1 — indicateur publié chaque année par la Commission dans
ses *Progress reports on RAL*.

Deux faits que la ventilation par année d'origine (Table 6.11) rend
visibles :

- **3 624 M€ du RAL de fin 2024 sont d'origine antérieure à 2021**,
  c'est-à-dire du Horizon 2020 et du FP7 — un programme clos depuis
  quatre ans qui se paie encore. La dernière publication à isoler une
  ligne « Horizon 2020 » distincte est le DB2022 (**24 959 M€ au
  31/12/2020**) ; depuis, la nomenclature l'agrège sous « Horizon
  Europe ».
- Le RAL est **très concentré sur les engagements récents** : 12 715 M€
  de 2024, 5 777 M€ de 2023, contre 346 M€ d'avant 2018.

**Le profil temporel officiel existe** — et c'est le fait le plus
important de cette section. Il est publié par programme dans les
*Working Documents Part XII « Payment schedules »* accompagnant chaque
projet de budget (base légale : art. 41(3)(i) du règlement financier).
Pour la tranche d'engagements Horizon Europe de 2026 (DB2026, COM(2025)
300), le rapport des montants imprimés donne :

| Année de paiement | N | N+1 | N+2 | N+3 | N+4 | ultérieures |
|---|---:|---:|---:|---:|---:|---:|
| Part de l'engagement | **13,2 %** | **49,0 %** | 15,0 % | 10,1 % | 7,6 % | 5,1 % |

*(tranche 2025 : 10,9 % · 53,1 % · 13,6 % · 12,8 % · 6,5 % · 2,1 %)*

**Un engagement Horizon Europe de la tranche 2026 n'est prévu payé
qu'à 13,2 % l'année où il est pris** — la moitié l'année suivante, un
cinquième au-delà de trois ans, et la tranche 2025 dessine le même
profil. Ces pourcentages sont propres à **ce programme et à ce
millésime de Payment Schedule** (échéancier prévisionnel du DB2026,
pas une constante de tout engagement européen ni une position comptable
arrêtée) ; la colonne « Others » du document, non définie par la
Commission, est négligeable sur ces deux tranches annuelles (−0,7 %).
C'est la mesure officielle, pour Horizon Europe, de l'écart entre les
deux familles comptables du § 3.2 — elle confirme, chiffres de la
Commission à l'appui, qu'un numérateur d'engagements et un dénominateur
de paiements ne décrivent pas le même moment.

**Le taux de préfinancement, lui, est bien fixé** — contrairement à ce
que le MGA seul laisse croire. Les *Annexes générales* du programme de
travail Horizon Europe (WP 2023-2025, décision C(2025) 2779) l'énoncent :

> « normally, pre-financing of **160 % of the average EU funding per
> reporting period** (i.e. maximum grant amount/number of periods) »

Sous H2020, c'était **100 %** (AGA H2020 V5.2). Le MGA ne fixe que ce
qui l'entoure : mutuelle retenue à hauteur de **5-8 %** du montant
maximal (règlement 2021/695 art. 37(3) : 5 % par défaut, jusqu'à 8 %),
préfinancement qui reste « **property of the EU until the final
payment** », et **plafond de 90 %** sur le cumul préfinancement +
paiements intermédiaires — donc **au moins 10 % ne peut être versé qu'au
solde**. Pour H2020, la Cour des comptes européenne résume le cycle
(Revue rapide 05/2019, § 74) : « contract signature is followed by the
payment of pre-financing (**usually 10-30 %**). The average duration of
a contract is around **two or three years** ».

*Note de lecture* : la ligne « engagements pré-2025 encore ouverts » du
DB2026 (28 440,8 M€) et le RAL des comptes annuels (28 646 M€ au
31/12/2024) sont deux mesures voisines mais **de tables différentes** —
la première est un échéancier de paiement prévisionnel, la seconde une
position comptable arrêtée. Le chiffre canonique est celui des comptes
annuels.

### 4.6 La cohorte d'appel — instruite, et pourquoi elle ne sauve pas non plus

Les work programmes sont juridiquement des **décisions de financement
pluriannuelles** portant un plafond opposable, avec une flexibilité de
20 % ; leurs budgets par appel et par sujet sont explicitement
« **indicative** ». Surtout, **aucun ne couvre une année civile** : le
WP 2021-2022 en couvre deux, le WP 2023-2024 a été **étendu à 2025**, et
le WP 2025 couvre 2025, 2026 et 2027. Une « cohorte annuelle » d'appels
n'existe donc pas, même du côté du dénominateur.

Et le périmètre ne boucle pas : le CER (≈ 2,16 Md€ de CE en 2025), l'EIC,
l'EIT et Euratom relèvent de **décisions de financement distinctes**. Un
« % du work programme » ne couvrirait qu'une partie du programme, sans
que rien à l'écran ne le dise.

### 4.7 Deux écarts de réconciliation à consigner

Ils ne sont expliqués par aucune source officielle et invitent à la
prudence sur tout chiffre agrégé :

- **Horizon Europe** : CORDIS, signatures ≤ 2024, donne **43,58 Md€ pour
  15 186 conventions**, quand la DG RTD déclare **53,97 Md€ pour 15 987
  conventions** à fin 2024. Le nombre concorde à 5 %, le montant à
  **24 %**. *Vérifié deux fois* : ce chiffre a été obtenu
  indépendamment sur le jeu CORDIS officiel et sur le corpus Orion, qui
  rendent **exactement la même valeur** (43,58 Md€ / 15 186). L'écart est
  donc dans CORDIS, pas chez nous — vraisemblablement les entreprises
  communes et les actions non publiées, mais **aucune source officielle
  ne l'explique**.
- **H2020** : CORDIS donne 68,33 Md€, le Horizon Dashboard **70,20 Md€**
  (au 31/07/2026) — 2,7 % d'écart, et le dashboard porte des signatures
  jusqu'en 2022 quand CORDIS s'arrête en 2021. Le dashboard avertit
  lui-même qu'il **sous-évalue le programme d'environ 5 %**, et sa mesure
  d'en-tête « Net EU Contribution » **n'est définie nulle part**.

---

## 5. NIH — sources officielles et dénominateurs disponibles

Sources lues le 2026-08-26 : ExPORTER Data Dictionary, « Data Elements for RePORTER Project API » V2, RePORT FAQ, NIH Almanac (*Historical Budget Information*), NIH Office of Budget (*Appropriations History by IC*, *Mechanism Detail*), NIH Data Book, NIH Grants Policy Statement.

### 5.1 Ce que les champs veulent dire — confirmé à la source

| Champ | Définition officielle |
|---|---|
| `TOTAL_COST` | « Total project funding from all NIH Institute and Centers **for a given fiscal year** » |
| `FY` | « The fiscal year appropriation from which project funds were **obligated** » |
| `PROJECT_START` | « The start date of a project… **Upon competitive renewal, the project end date is extended** » |
| `BUDGET_START` / `BUDGET_END` | « The date when a project's funding **for a particular fiscal year** begins / ends » |
| `CORE_PROJECT_NUM` | « **This identifier is not specific to any particular year of the project** » |

**Le repli d'Orion est donc exact dans sa mécanique** : additionner les
`TOTAL_COST` d'un `CORE_PROJECT_NUM`, c'est additionner des obligations
d'exercices successifs. C'est le **rattachement** de cette somme à
`min(PROJECT_START)` qui pose problème, pas la somme.

**Le mécanisme confirmé** : un grant pluriannuel NIH est financé par des
*non-competing continuation awards* annuels (type 5), chacun donnant une
nouvelle ligne. Sur l'exercice FY2023, **52,12 % des dollars sont de
type 5** — des reconductions d'awards antérieurs. Un `CORE_PROJECT_NUM`
peut porter 25 lignes sur 35 ans avec un `PROJECT_START` unique de 1982.

### 5.2 La mesure indépendante qui confirme la nôtre

Faite directement sur le fichier ExPORTER FY2023 complet, en groupant les
dollars de cet exercice par **année civile de `PROJECT_START`** — c'est-à-dire
en appliquant exactement la convention d'Orion :

| Année de `PROJECT_START` | Dollars FY2023 | Part |
|---|---:|---:|
| **2023** | 9 116 824 277 $ | **20,47 %** |
| 2022 | 6 415 824 445 $ | 14,41 % |
| 2021 | 5 766 741 290 $ | 12,95 % |
| 2020 | 5 490 708 440 $ | 12,33 % |
| 2019 | 3 763 592 127 $ | 8,45 % |
| 2014-2018 | 4 738 798 356 $ | 10,64 % |
| ≤ 2012 | 3 524 349 742 $ | 7,91 % |
| Inexploitable | 5 374 951 171 $ | 12,07 % |

**Seuls 20,47 % des dollars d'un exercice seraient crédités à l'année en
cours ; 67,46 % remonteraient à des années antérieures.** Le
`PROJECT_START` le plus ancien tirant encore des crédits FY2023 est
**1972 — cinquante-et-un ans**. C'est la même conclusion que notre § 2.2,
obtenue par une voie indépendante et sur la population entière.

### 5.3 Les dénominateurs qui existent

| Série | FY2023 | Nature | Utilisable ? |
|---|---:|---|---|
| Appropriation NIH (Almanac / Office of Budget) | 47 683 485 k$ | **« Program level »** — BA discrétionnaire + mandataire diabète + Program Evaluation Financing | Famille différente (autorisation), périmètre trop large |
| Obligations réelles totales (*Mechanism Detail*) | 44 980 816 k$ | Obligations constatées, **hors B&F et OD-Other** | Bonne famille, périmètre à trancher |
| *NIH Research Grants and Other Awards* (RePORT #106) | 36 986 896 496 $ | Somme des awards de l'exercice | La plus proche du numérateur |
| Intra-muros / extra-muros (Data Book) | 37 406 M$ hors NIH | Ventilation | Complément |

**Trois avertissements de la source, à ne pas ignorer :**

1. **Les supplementals COVID NIH sont EXCLUS des séries d'appropriations.**
   Note 22 de l'Almanac, verbatim : « **Amounts exclude supplemental
   appropriations enacted in FY 2020 for COVID-19 research from
   P.L. 116-123, P.L. 116-136, P.L. 116-139, and P.L. 116-260.** » Soit
   **4 837 400 k$** absents du dénominateur — alors que le numérateur
   d'Orion contient 6,5 % de COVID en 2020 (§ 17.3). Le contre-exemple
   prédit est vérifié des deux côtés.
2. **Les sources officielles ne concordent pas entre elles.** Almanac et
   Office of Budget divergent de **1,0 Md$ sur FY2015** (30 311 349 vs
   31 311 349 k$), et le Data Book publie trois totaux différents pour
   FY2024 (44 945 / 47 439 / 49 068 M$). Choisir un dénominateur, ici,
   c'est arbitrer entre des chiffres officiels contradictoires.
3. **Un ratio naïf dépasse 100 %** : la somme des lignes RePORTER
   **sans** exclure les sous-projets donne 48 982 M$ contre une
   appropriation de 47 683 M$ — **102,7 %, impossible**. Orion évite ce
   piège (`NOT is_subproject`), mais il montre que le champ « montant »
   ne se somme pas naïvement.

### 5.4 Un défaut de périmètre du numérateur Orion, découvert ici

RePORTER publie aussi des attributions d'agences **qui ne sont pas le
NIH**. Mesuré dans notre corpus :

| Agence dans le corpus « NIH » d'Orion | Projets | Montant |
|---|---:|---:|
| AHRQ — Agency for Healthcare Research and Quality | 3 534 | 3,25 Md$ |
| FDA — Food and Drug Administration | 2 613 | 3,06 Md$ |
| ATSDR, HRSA | 202 | 0,28 Md$ |
| **Total non-NIH** | **6 349** | **6,59 Md$ — 0,90 % du numérateur** |

Ce n'est pas un défaut d'Orion aujourd'hui (le corpus dit « RePORTER »,
pas « NIH stricto sensu »), mais tout ratio « % du budget NIH » devrait
les filtrer d'abord.

### 5.5 Licence — un constat d'absence à consigner

**Il n'existe aucune déclaration de licence propre aux données
RePORTER.** Le document présenté comme « Data Access Policy » décrit ce
qui est public et comment demander le reste ; il ne contient **aucune
clause de copyright, de réutilisation ou d'usage commercial**. Le
« domaine public » retenu par `docs/data-sources.md` s'appuie donc sur
les politiques générales du NIH (NLM : « Works produced by the U.S.
government are not subject to copyright protection in the United
States »), qui visent le contenu éditorial des sites. **C'est une
extrapolation raisonnable, pas une licence lue.** À dire tel quel — la
règle de licence d'Orion mérite que ce soit écrit.

---

## 6. NSF — sources officielles et dénominateurs disponibles

Sources lues le 2026-08-26 : schéma officiel `Award.json`, documentation de l'API research.gov, PAPPG 24-1, *Merit Review Digests* (NSB-2015-14, NSB-2020-13), *Budget Requests to Congress* FY2025/FY2026/FY2027, *Agency Financial Report* FY2025, *NSF by the Numbers* (codebook), NCSES *Survey of Federal Funds for R&D*.

### 6.1 Les champs — et une bonne nouvelle pour Orion

**NSF ne publie aucun dictionnaire de données métier** : le seul schéma
officiel (`Award.json`) déclare les types, sans une seule clé
`description`. La sémantique a donc été établie empiriquement contre
l'API — et elle **confirme le choix fondateur d'Orion** :

- `awd_amount` / `fundsObligatedAmt` = **montant cumulé obligé à ce
  jour**, tous exercices confondus. La somme de `oblg_fy` égale
  `fundsObligatedAmt` à ±1 $ sur tous les awards testés — exactement les
  93,91 % que nous mesurons (§ 2.3).
- `oblg_fy` = **le profil réel des obligations par exercice**. C'est le
  seul champ qui porte la ventilation temporelle.
- `estimatedTotalAmt` **n'est pas fiable** : sur 400 awards, 20,8 % ont
  une valeur différente du cumulé, et **inférieure** — le commentaire du
  chargeur d'Orion (« l'intention s'inverse contre le montant obligé
  entre générations ») est confirmé.
- **47,0 % des awards** ont une année fiscale de `startDate` différente
  de leur première année d'obligation — mesure indépendante, cohérente
  avec nos 44,85 %.

**Le mécanisme, officiel** (*Merit Review Digest* FY2023) : « **Standard
grants are provided full funding for the duration of the project… at the
time NSF makes the initial award. Continuing grants receive funding
incrementally, usually annually.** » Et la table du National Science
Board le chiffre : **14 % à 29 % des dollars de chaque exercice** sont
des « CGIs and Supplements », c'est-à-dire des obligations sur des awards
accordés lors d'exercices **antérieurs**.

### 6.2 Le dénominateur — et c'est ici que la route se ferme

| Série | Couverture | Nature | Statut |
|---|---|---|---|
| **Appropriations NSF par compte** (*Budget Requests to Congress*) | **FY2005-FY2025**, complète | Budget authority votée, **après supplémentaires, transferts et reprogrammations** | ✅ Disponible |
| **Obligations totales NSF** (*Object Classification*, un CJ par exercice) | **FY2023, FY2024, FY2025 seulement** | Obligations constatées | ⚠️ **Pas une série** |
| **Award Obligation Amount** (*NSF by the Numbers*) | FY2011-FY2025 | **Le comparable exact** — « Obligations on awards in the fiscal year shown… includes funding on new awards **as well as increments or supplements made to awards made in prior fiscal years** » | ✅ **Valeurs extraites le 2026-08-26** en session Tableau invitée (vues *Trends* et *Numbers by State*, méthode au § 9.4.6) — pas de canal machine, série restatée sans archives (§ 9.4.7) |
| **BIIS** (*Budget Internet Information System*) | historique | La source historique | ❌ **Hôte mort** (NXDOMAIN) |
| NCSES *Federal Funds for R&D* | annuelle | Obligations **R&D** de NSF (7 971 M$ en 2023) | ⚠️ Périmètre R&D seul, ≠ obligations totales |

**Le fait décisif, révisé en contre-relecture** : la série qui est le
dénominateur exact — « Award Obligation Amount » de *NSF by the
Numbers*, dont la définition est mot pour mot ce qu'Orion calcule — a
finalement été **extraite intégralement** (FY2011-FY2025) en ouvrant une
session Tableau invitée dans un navigateur ; les exports restent vides
hors session et le BIIS, prédécesseur, ne résout plus. La réconciliation
contre cette série est au § 9.4 — elle passe.

### 6.3 Périmètre du numérateur NSF d'Orion

Orion couvre **toutes** les divisions NSF, y compris celles qui ne
relèvent pas de *Research and Related Activities* : **16 à 22 % de la
valeur** vient des divisions Éducation et Ressources humaines (`DGE`
7,52 Md$, `DUE` 7,32 Md$, `DRL` 5,61 Md$ sur l'ensemble du corpus). Le
dénominateur ne peut donc pas être R&RA seul.

### 6.4 Licence — domaine public, déclaré explicitement

**Correction de contre-relecture (2026-08-26)** : une première version
de cette section présentait le domaine public NSF comme une
extrapolation depuis les politiques générales du site. C'est faux — la
déclaration existe, explicite et spécifique aux données d'award, sur la
page officielle *Award Search Overview*
(https://www.nsf.gov/funding/award-search, consultée le 2026-08-26) :

> « **Award data posted on the NSF website, including award abstract
> text, is in the public domain and not subject to copyright.**
> Publications and conference proceedings listed as resulting from an
> award are subject to copyright as indicated by the publisher. »

Trois précisions de portée, lues sur pièces :

- la déclaration couvre « award data posted on the NSF website » sans
  restreindre à l'interface, et **la même page renvoie explicitement au
  téléchargement en masse par fiscal year** — le canal qu'Orion ingère ;
- la page *Download Awards* elle-même ne porte aucune mention de
  licence : la déclaration vit sur la page *Overview*, pas sur la page
  de téléchargement ;
- l'**exception est écrite** : les publications et actes de conférence
  listés comme résultats d'un award restent sous le copyright de leur
  éditeur. Orion n'ingère pas ces objets.

Le verdict « domaine public » du registre (`docs/data-sources.md`) est
donc **confirmé par une déclaration explicite**, pas extrapolé — c'est
le NIH qui reste un constat d'absence (§ 5.5), et les deux cas ne
doivent plus être présentés ensemble. À noter enfin : les fichiers de
téléchargement en masse étaient **temporairement absents au
2026-08-26** (« No export files available at this time ») et le format
est passé de XML à JSON en janvier 2025.

---

## 7. GBARD / GBAORD — le candidat international, instruit et écarté

Sources lues le 2026-08-26 : Manuel de Frascati 2015 **partie III, chapitre 12** (p. 321-342) ; métadonnées Eurostat ESMS du dossier `gba` ; OCDE *Main Science and Technology Indicators* mars 2026 ; UNESCO UIS Data Browser.

### 7.1 Ce que GBARD mesure exactement

**Définition (Frascati § 12.9, reprise au glossaire p. 370)** : les
crédits budgétaires que l'État **destine** à la R&D, financés sur des
ressources publiques prévues au budget. Eurostat le résume sans
ambiguïté (ESMS § 3.4) : GBARD « **refer to budget provisions, not to
actual expenditure** ».

Le manuel décrit **sept étapes budgétaires** (§ 12.41) — prévisions,
prévisions budgétaires, propositions au parlement, **crédits initiaux
votés** (étape 4), **crédits finaux votés** (étape 5), **obligations**
(étape 6), **dépenses** (étape 7) — et **recommande** l'étape 5 pour la
donnée finale (§ 12.43) : « It is suggested that the final GBARD data
should be based on the final budget appropriations. »

**Correction de contre-relecture (2026-08-26)** — une première version
de ce rapport affirmait que le § 12.43 *exclut* les étapes 6 et 7.
C'est trop fort : c'est une **recommandation**, et le manuel reconnaît
lui-même que la pratique nationale n'est pas homogène (§ 12.9 : « Some
countries will report on outlays, others on budget authorisations, and
still others on budget obligations »). Eurostat classe précisément
cette variation d'étape parmi les limites de comparabilité (ESMS
§ 15.1 : « the stage in the budgetary process from which final GBARD
data are drawn (final budget appropriations or actual outlays) »).

La conséquence pour Orion est corrigée en ce sens, et elle ne
s'améliore pas pour autant : GBARD n'est pas *défini contre* les
obligations, il est **d'étape comptable variable et non documentée pays
par pays**. Diviser un numérateur d'obligations (NIH/NSF, § 2.2-2.3)
par un GBARD reviendrait à diviser par une grandeur dont on ne sait
pas, pour un pays donné, si elle est un crédit voté, une obligation ou
une dépense — et les fondements du rejet restent les suivants,
inchangés : le rattachement temporel (§ 7.2), l'interdiction des
sous-ensembles (§ 7.4) et l'absence de toute série pour les
institutions de l'Union et les agences (§ 7.3).

### 7.2 Le rattachement temporel — GBARD et Orion se contredisent

Frascati **§ 12.44**, la règle qui décide :

> « Multi-annual projects budgeted in only one year or over several
> **should be allocated to the GBARD of the year(s) in which they are
> budgeted, not in the years of performance**. Multi-annual programmes
> that are authorised at some stage but budgeted over several years
> should be allocated to the years in which they are budgeted, **not the
> year of authorisation**. »

GBARD impute donc à l'année de **budgétisation**, et refuse
explicitement l'imputation à l'année d'**autorisation**. Orion impute à
l'année de **démarrage**. Les deux conventions ne coïncident sur aucune
étape du processus budgétaire — et l'écart n'est pas théorique : c'est
celui que le § 8 a mesuré à ±12 à ±123 points sur NSF.

### 7.3 Trois blocages de périmètre, chacun suffisant

**① Aucune série GBARD n'existe pour les institutions de l'Union.**
Vérifié sur les quatre jeux Eurostat (`gba_nabsfin07`, `gba_fundmod`,
`gba_nabste`, `gba_tncoor`) et sur les 39 zones de référence du dataflow
OCDE `DSD_RDS_GOV@DF_GBARD_NABS07` : **aucun code d'entité « institutions
UE »**. Les agrégats `EU27_2020` et `EA*` sont de simples **sommes
d'États membres** (ESMS § 18.4). Pire, Frascati § 12.19 demande
d'**exclure** des GBARD nationaux les contributions générales au budget
de l'Union :

> « General standing contributions to the general budget (such as those
> to international organisations or the European Union) should be
> excluded unless a defined component is specifically designated for
> R&D activities. »

Le budget de recherche de la Commission — celui d'où viennent les awards
CORDIS — **n'a donc de série GBARD ni comme déclarant, ni comme poste
identifiable ailleurs**. Il n'existe aucun dénominateur GBARD pour
CORDIS. Ce seul point ferme la route côté UE.

**② NIH et NSF ne sont pas identifiables dans GBARD.** Ni le dataflow
OCDE ni le dataset Eurostat n'ont de dimension financeur, agence ou
ministère : les dimensions sont l'objectif socio-économique (NABS), le
mode de financement, l'unité, la zone et l'année. Les statistiques
américaines proviennent de l'enquête NCSES *Survey of Federal Funds for
R&D*, reclassée depuis les *budget functions* vers les 14 objectifs
NABS — **et les agences disparaissent dans cette reclassification**. Le
NIH tombe majoritairement dans NABS07 « Health » (50 453 M$ en 2023),
poste qui agrège aussi la R&D santé du DoD, du VA, des CDC et de
l'AHRQ.

**③ Le GBARD américain est majoritairement militaire.** Part de la
défense (NABS14) dans le GBARD total, mesurée sur `gba_nabsfin07`,
unité `PC_GBA` :

| | 2022 | 2023 | 2024 | 2025 |
|---|---:|---:|---:|---:|
| **États-Unis** | 44,6 % | **51,65 %** | **53,24 %** | 51,5 % |
| UE-27 | 4,08 % | 4,20 % | 4,98 % | 5,75 % |

Diviser des awards NIH (santé civile) ou NSF (sciences civiles) par un
dénominateur dont plus de la moitié est militaire produirait un ratio
sans signification — et l'agrégat civil `TOTALXNABS14`, qui existe,
resterait un dénominateur « tout le gouvernement fédéral », pas
« l'agence observée ».

### 7.4 Ce que le manuel interdit en toutes lettres

- **§ 12.18** — « **It is not envisaged that GBARD is used to report for
  subsets of government** ». Un « % GBARD » d'un programme, d'un
  institut ou d'une division est hors de l'usage prévu.
- **§ 12.17** — « The level of detail available in the general budget…
  **will not necessarily allow GBARD data compilers to identify the
  ultimate use of the funds** ». On ne peut donc pas descendre au grain
  où Orion travaille.
- **OCDE MSTI mars 2026, § 3.1.6** — « **Readers are warned that GBARD
  data vary in coverage compared to government-financed GERD series and
  that these two types of data should not be combined.** » Et : « Budgets
  are allocated to socio-economic objectives **on the basis of intentions
  at the time funds are committed and not the actual content of the
  projects concerned**. »

**Honnêteté sur ce qui n'a pas été trouvé** : aucune source officielle
n'avertit *nommément* contre le rapprochement GBARD ↔ awards de projets.
L'interdiction est déduite — mais elle l'est de règles explicites
(§ 12.44, § 12.18, § 12.17) et de la recommandation d'étape du § 12.43,
pas d'une impression.

### 7.5 Deux fragilités supplémentaires, pour mémoire

- **GBARD est en partie estimé, pas compté** : § 12.13 prévoit des
  **coefficients** pour évaluer la part R&D des lignes budgétaires non
  exclusives, et § 12.46 avertit du « significant risk that the variable
  adoption of more in-depth inquiries… may result in
  difficult-to-compare data ».
- **GBARD est révisé, largement** : le communiqué OCDE du 31 mars 2026
  annonce une révision portant le recul 2024 à **−4,1 % en termes
  réels**, « larger than anticipated ». Les données de l'année N sont
  préliminaires à N+7 mois, finales à N+13 mois.
- **Le périmètre institutionnel varie par pays** : les notes officielles
  Eurostat (`gba_esms_an_4.xlsx`) portent « **Federal or central
  government only** » pour les États-Unis, le Japon et l'Autriche ; la
  Pologne exclut les fonds de la Commission ; la Hongrie signale que ses
  projets pluriannuels ne sont **pas** imputés à l'année de
  budgétisation — une violation déclarée du § 12.44 ; l'Allemagne, la
  France, la Suède et la Slovénie signalent que « the sum of the
  breakdown doesn't add up to the TOTAL GBARD ».

### 7.6 Réponse à la question décisive

> **GBARD est-il un dénominateur compatible avec des awards de projets
> individuels, ou seulement un indicateur macro du soutien budgétaire
> gouvernemental à la R&D ?**

**Le second, sans ambiguïté.** GBARD est un indicateur macro, côté
financeur, de l'intention budgétaire d'un État entier, imputé à l'année
de budgétisation, non désagrégeable par agence, non prévu pour des
sous-ensembles de l'administration, inexistant pour les institutions de
l'Union, et majoritairement militaire pour les États-Unis. Sa
comparabilité internationale — sa vraie qualité — ne le rend compatible
avec rien de ce qu'Orion additionne.

**GBARD est écarté comme dénominateur.** Il resterait légitime pour une
tout autre métrique — « quelle part de son PIB tel État destine-t-il à
la R&D » — qui ne prendrait aucun numérateur d'Orion et sortirait donc
du périmètre de ce chantier.

---

## 8. Les quatre routes, mises à l'épreuve

### Route A — année civile de début

```text
Σ montants des projets démarrant en année a
--------------------------------------------
budget R&D annuel du financeur en année a
```

**Présomption de la consigne : probablement fausse. Confirmée, et le
biais est chiffré.**

Le seul test qui ne dépende d'aucune source externe est disponible pour
NSF, parce que la source publie le profil annuel réel et qu'Orion l'a
conservé (§ 2.3). Comparer la Route A à la Route D, c'est comparer le
rattachement d'Orion à la vérité de la source, sans dénominateur du
tout :

| Année | Route A (année de début) | Route D (obligations réelles) | Écart |
|---:|---:|---:|---:|
| 2005 | 5,066 Md$ | 2,267 Md$ | **+123,5 %** |
| 2006 | 5,479 | 3,245 | +68,8 % |
| 2008 | 7,208 | 4,851 | +48,6 % |
| 2012 | 6,217 | 6,564 | −5,3 % |
| 2015 | 6,033 | 6,829 | −11,7 % |
| **2018** | **9,267** | **7,236** | **+28,1 %** |
| 2019 | 6,598 | 7,535 | −12,4 % |
| 2023 | 7,650 | 8,461 | −9,6 % |
| 2025 | 4,992 | 8,267 | **−39,6 %** |

Même au cœur de la série, là où les deux mesures sont pleinement
observées, l'écart va de **−12,4 à +28,1 points**. Le pic 2018 de la
Route A n'a jamais existé : il vient de trois grands équipements
(`1755088`, 975,9 M$ dont 5,9 obligés en 2018 ; `1902627`, 263,0 M$ dont
**zéro** ; `1764464`, 236,5 M$ dont **zéro**) qui apportent près de
1,5 Md$ à une année où la NSF n'en a obligé que 16,6 M$.

**Verdict Route A : rejetée.** Elle ne se trompe pas d'un décalage
constant qu'on pourrait corriger ; elle se trompe d'un montant qui
dépend de la composition de la cohorte, donc de façon non corrigeable.

### Route B — cohortes

```text
Σ montants d'une cohorte définie
----------------------------------
enveloppe budgétaire de cette même cohorte
```

**C'est la seule route comptablement propre, et elle est empiriquement
vide aujourd'hui.**

*Ce qui est bon* — la cohorte d'appel existe dans le corpus et elle est
complète. `subCall` couvre **100 % de la valeur des trois programmes**
(475 appels FP7, 894 H2020, 681 Horizon Europe) ; `masterCall`, plus
agrégé, couvre 100 % de H2020 (484 appels) et d'Horizon Europe (681),
mais **est absent de FP7** — la maille d'appel y est le `subCall`. Une
enveloppe d'appel et les subventions issues de cet appel sont toutes deux
des engagements, décidés par le même acte, sur le même périmètre : le
couple est propre.

*Ce qui prouve que l'année civile est le mauvais découpage* : un appel
ne tient pas dans une année. **60,3 % de la valeur H2020** vient
d'appels dont les projets démarrent sur **trois années civiles ou
plus** ; seulement 9,9 % vient d'appels tenant dans une seule année.
L'étalement maximal observé est de 4 ans. La Route A découpe donc
transversalement des enveloppes que la Route B respecterait.

*Ce qui bloque* — Orion possède les enveloppes, mais pas pour les
mêmes appels que les projets. La bonne clé de jointure est
`call_topics.identifier` ↔ `projects.raw->>'topics'` (le **sujet**), et
non le code d'appel ; elle donne un recouvrement bien plus large — puis
l'enveloppe s'évanouit exactement là où on en aurait besoin :

| Étape | Résultat |
|---|---|
| Sujets moissonnés au portail | 1 654 |
| … qui ont des projets financés dans Orion | **447** (5 367 projets, **8 602 M€**) |
| … **dont ceux qui portent aussi une enveloppe** | **3** |
| Valeur effectivement couverte | **13,7 M€ sur 176,4 Md€** (0,008 %) |

Autrement dit, ce n'est pas le rapprochement projets ↔ appels qui
manque — il fonctionne sur 8,6 Md€. C'est **le budget qui n'est pas là**
sur ces sujets-là : parmi les 447, 308 portent encore un statut source
« Forthcoming » et **aucun** n'a de bloc budget, 137 sont « Open » avec
un seul budget, 2 sont « Closed » avec les deux.

La cause est structurelle : le portail Funding & Tenders publie les
appels **ouverts, à venir et récemment clos**, tandis que CORDIS publie
les projets des appels **attribués**. Les deux fenêtres se croisent, mais
le bloc budgétaire n'est pas renseigné au moment où elles se croisent.
Mesuré sur Horizon Europe, il s'écoule en moyenne **1,15 an** entre
l'année de l'appel et le démarrage des projets, et seulement **11,8 % de
la valeur** démarre dans l'année de son propre appel.

*Et un piège qu'il faut nommer* : sur les deux appels qui se recouvrent,
le ratio naïf donne **5 100 %** et **1 000 %**. Non parce que la méthode
est fausse, mais parce que `budget_min_eur` / `budget_max_eur` du portail
sont le montant **par subvention**, pas l'enveloppe de l'appel. La vraie
enveloppe est ailleurs, dans `budget_overview.budgetTopicActionMap`, qui
porte le montant par sujet, par type d'action **et par année
budgétaire** — la grandeur juste. Prendre le champ qui s'appelle
« budget » sans lire ce qu'il contient produirait un ratio faux d'un
facteur 50.

*Ce qui joue en faveur de l'avenir* : Orion **archive déjà** les appels
qui quittent le flux (« un topic disparu du flux garde sa dernière
photographie », `ingest/ftcalls/load.py`). Le corpus contient
**409 appels clos, tous avec leur enveloppe**, ouverts entre avril 2025
et juin 2026. Leurs projets apparaîtront dans CORDIS d'ici deux à trois
ans. La Route B n'est pas fermée : **elle est en cours de chargement.**

**Verdict Route B : comptablement retenue, empiriquement en attente.**

### Route C — période longue

```text
Σ montants sur N années  /  Σ budgets correspondants sur N années
```

**Rejetée — et la raison n'est pas celle qu'on attendrait.**

L'agrégation pluriannuelle atténue effectivement l'écart… mais seulement
si la fenêtre est loin des deux bords :

| Fenêtre NSF | Route A | Route D | Écart |
|---|---:|---:|---:|
| 2010-2020 (au centre) | 77,246 Md$ | 75,930 Md$ | **+1,7 %** |
| 2008-2018 | 78,411 | 73,493 | +6,7 % |
| **2005-2015** (bord gauche) | 69,822 | 62,217 | **+12,2 %** |
| **2015-2025** (bord droit) | 79,622 | 84,309 | **−5,6 %** |
| 2012-2016 (5 ans, centre) | 32,487 | 33,399 | −2,7 % |
| 2016-2018 (3 ans) | 24,162 | 21,073 | +14,7 % |

La convergence au centre n'est pas une justesse retrouvée : c'est une
**compensation**. L'argent mal daté vers l'avant compense l'argent mal
daté vers l'arrière tant que la fenêtre est assez large et assez
centrée. Dès qu'elle touche un bord, l'erreur revient — et **l'utilisateur
choisit sa fenêtre**. Il choisira très souvent les dernières années,
c'est-à-dire le bord droit, celui où le numérateur est le plus tronqué.

Accepter la Route C reviendrait à publier une métrique juste au milieu
du corpus et fausse à ses extrémités, sans que rien à l'écran ne
distingue les deux cas. C'est exactement la « précision artificielle »
que la doctrine interdit.

### Route D — reconstitution annuelle par le profil publié

```text
Σ montants réellement rattachés par la source à l'exercice a
-------------------------------------------------------------
budget/obligations du financeur pour l'exercice a
```

**Praticable pour NSF seul. Impossible pour CORDIS. Récupérable pour
NIH, au prix d'une ingestion.**

| Source | Profil annuel publié par la source ? | Conservé par Orion ? | Route D |
|---|---|---|---|
| CORDIS | **Non** — confirmé par la documentation officielle des champs (aucun champ annuel sur 558 lignes) et **assumé par la Commission** : le FTS déclare que « annual information on payments cannot give a view of the overall value of the agreement. **Therefore the site focuses only on commitments** » | sans objet | ❌ **Structurellement impossible** |
| NIH | **Oui** (`TOTAL_COST` par exercice) | **Non** — la table de préparation est détruite ; `raw` ne garde que la liste des années | ⚠️ Possible après ré-ingestion |
| NSF | **Oui** (`fund_oblg_amt` par `fund_oblg_fiscal_yr`) | **Oui**, dans `raw.fiscal_years` | ✅ Immédiate |

**Et le profil est ventilable, sans aucune clé inventée** — vérifié
pendant cette étude, c'est le résultat technique le plus utile du
chantier. `raw.fiscal_years` est un objet dont **la clé est l'`awd_id`**,
et `participations.source_uid` porte **exactement cet identifiant**.
Chaque participation peut donc être rattachée à son propre profil
annuel :

| | |
|---|---|
| Participations NSF | 259 788 |
| Appariées à leur profil par `source_uid` | **259 766 — 99,99 %** |
| Valeur ainsi profilée | 143,83 Md$ |

Conséquence : la Route D est déclinable **par pays, par organisation et
par division** sans répartir quoi que ce soit à la main. C'est ce qui
sépare une piste théorique d'une piste constructible.

*Piège à graver au passage* : joindre naïvement le profil au grain
participation **sans** filtrer sur `source_uid` produit un double compte
de **+17 %** (168,67 Md$ au lieu de 143,8), parce que 17 523 projets NSF
agrègent plusieurs awards de fratries collaboratives. La jointure par
`source_uid` est obligatoire, pas optionnelle.

La série NSF reconstituée est **stable et plausible** — ce qui est en
soi un contrôle de vraisemblance :

| FY | 2009 | 2012 | 2015 | 2018 | 2021 | 2023 | 2025 |
|---|---:|---:|---:|---:|---:|---:|---:|
| Obligations Orion | 7,871 | 6,566 | 6,830 | 7,239 | 8,021 | 8,465 | 8,277 |

Pas de saut, pas d'année aberrante, une croissance régulière — le
contraire de la Route A. FY2005-2008 sont sous-couverts (les obligations
de ces années portent en partie sur des awards démarrés avant la
fenêtre) et FY2026 est un exercice en cours : **la fenêtre exploitable
est FY2009 → FY2025**.

**L'interdiction est tenue** : aucun étalement `montant / durée` n'a été
calculé nulle part dans cette étude. Les seules valeurs annuelles
utilisées sont celles que NSF publie elle-même.


---

## 9. Tests empiriques contre les dénominateurs officiels

### 9.1 NSF — la Route D confrontée aux trois dénominateurs officiels

Le numérateur est la Route D (obligations par exercice fédéral, telles
que NSF les publie et qu'Orion les conserve). Les dénominateurs sont
tous officiels, tous légitimes, tous différents. Montants en milliards
de dollars.

| FY | Orion (Route D) | Appropriation totale | % | Obligations totales | % | Obligations « Grants, subsidies, contributions » | % |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 2009 | 7,871 | 9,496 | 82,9 % | — | | — | |
| 2012 | 6,566 | 7,033 | 93,4 % | — | | — | |
| 2015 | 6,830 | 7,344 | 93,0 % | — | | — | |
| 2018 | 7,239 | 7,767 | 93,2 % | — | | — | |
| 2021 | 8,021 | 9,087 | 88,3 % | — | | — | |
| **2023** | **8,465** | 9,877 | **85,7 %** | 9,459 | **89,5 %** | 8,171 | **103,6 %** |
| 2024 | 8,071 | 9,060 | 89,1 % | 9,408 | 85,8 % | 7,926 | **101,8 %** |
| 2025 | 8,277 | 9,060 | 91,4 % | 9,370 | 88,3 % | 7,957 | **104,0 %** |

Pour le **même exercice** et le **même numérateur**, trois dénominateurs
officiels donnent **85,7 %, 89,5 % et 103,6 %** — dont un **supérieur à
100 %**. C'est le contre-exemple « ratio naïf > 100 % » demandé au § 8
de la consigne.

**Requalification de contre-relecture (2026-08-26).** Une première
version de ce rapport lisait ces dix-huit points d'amplitude comme une
ambiguïté disqualifiante. La contre-relecture corrige la lecture : ces
trois colonnes sont **trois grandeurs différentes** (appropriation
totale, obligations totales, obligations de la classe 41.0), et leur
multiplicité ne condamne pas la route — elle condamne le **libellé
vague** « % NSF budget ». Si la métrique nomme explicitement son
dénominateur — les **award obligations** — il n'y a qu'un seul
dénominateur légitime : la série *Award Obligation Amount* de « NSF by
the Numbers », dont la définition est mot pour mot ce qu'Orion calcule
(§ 6.2). Les colonnes ci-dessus restent au rapport comme démonstration
de ce que produirait un libellé vague, pas comme disqualification.

La question devient donc unique et falsifiable : **la série Orion
réconcilie-t-elle la série officielle Award Obligation Amount ?**
Le protocole et le résultat sont au § 9.5.

### 9.2 NIH — la Route A confrontée à l'appropriation

Le contrôle est direct : sur l'exercice FY2023, appliquer la convention
d'Orion (rattacher au `PROJECT_START`) ne crédite que **20,47 %** des
dollars de l'exercice à l'année en cours (§ 5.2).

| Construction du numérateur FY2023 | Montant | % de l'appropriation NIH (47,68 Md$) |
|---|---:|---:|
| Lignes parent, par exercice (le juste) | 44,53 Md$ | 93,4 % |
| Somme naïve **avec** sous-projets | 48,98 Md$ | **102,7 % — impossible** |
| **Convention Orion (rattachée à `PROJECT_START`)** | **9,12 Md$** | **~19 %** |

Le rapport entre le chiffre juste et le chiffre produit par la
convention d'Orion est de **presque cinq**. Un « % du budget NIH » bâti
sur les cohortes actuelles afficherait 19 % là où la réponse est 93 %.

### 9.3 Union européenne — le détail est au § 4.3

Rappel du résultat, parce qu'il est le plus spectaculaire de l'étude :
divisé par les crédits d'engagement réellement adoptés, le ratio Horizon
Europe va de **6,9 % à 136,3 %** selon l'année et la date retenue, et
**dépasse 100 % trois fois**. Côté H2020, **10,05 Md€ de cohortes**
tombent sur des années sans aucun crédit d'engagement du programme :
le ratio y est **indéfini**, pas seulement faux.

Et pourtant le numérateur est **exact** : 68,334 Md€ contre 68,3 Md€ à
l'évaluation ex-post officielle, 35 389 projets contre 35 426
subventions signées (§ 4.2). C'est la démonstration la plus nette que
**le problème n'est pas la collecte, mais l'axe du temps**.

### 9.4 Réconciliation NSF ↔ « Award Obligation Amount » (contre-relecture, 2026-08-26)

La contre-relecture rouvre exclusivement cette route, avec une question
unique : **la série Orion réconcilie-t-elle le total officiel « Award
Obligation Amount » de « NSF by the Numbers » ?** Le protocole ci-dessous
a été écrit, seuil compris, **avant** l'obtention des valeurs
officielles — il est horodaté et ne sera pas retouché après coup.

#### 9.4.1 Les deux grandeurs confrontées

| | Orion | NSF by the Numbers |
|---|---|---|
| Définition | Σ des tranches `{fy, amount}` de `raw.fiscal_years` (le champ `oblg_fy` publié par NSF), par exercice fédéral | « Obligations on awards in the fiscal year shown. This includes funding on new awards as well as increments or supplements made to awards made in prior fiscal years. Only NSF direct appropriations are included. » (codebook v1.0.7, avril 2026) |
| Grain | Award (identique au grain participation via `source_uid` — contrôles § 22.E et § 22.M, 125,097 Md$ des deux côtés sur FY2009-2025) | Agence entière |
| Millésime | Snapshot Orion du 2026-08-04 (archives par FY) | Mise à jour annuelle du dashboard |

#### 9.4.2 Périmètre du numérateur Orion, mesuré avant comparaison

- **Types de transaction** : `Grant` et `CoopAgrmnt` **exclusivement**
  (mesuré sur les 420 161 tranches — aucun autre type).
- **Instruments** : Standard Grant, Continuing Grant, Cooperative
  Agreement, Fellowship Award, plus des traces d'Interagency Agreement
  (**1,2 M$ sur FY2023, soit 0,014 %**). Aucun contrat en valeur.
- **Divisions** : toutes, y compris Éducation (DGE/DUE/DRL, 16-22 % de
  la valeur) — cohérent avec le périmètre déclaré du dashboard
  (« research, engineering and education directorates »).

#### 9.4.3 Écarts de périmètre attendus, avec leur signe, listés ex ante

| Poste | Effet attendu sur Orion | Borne estimée |
|---|---|---|
| Obligations récentes portées par des awards antérieurs à FY2005 (hors fenêtre d'ingestion) | **sous-estimation** (−) | **mesurée nulle sur les quatre FY testés** : le plus ancien award contribuant à FY2019 démarre en 2008, à FY2024 en 2013 |
| Awards non publiés dans les téléchargements par FY (retraits, cas sensibles) | sous-estimation (−) | inconnue, réputée faible |
| Comptes administratifs exclus du dashboard mais présents chez Orion | surestimation (+) | non observés dans le corpus (aucun compte administratif identifié) |
| Awards financés sur crédits **mandatory** (CHIPS Sec. 102 : 25-50 M$/an dès FY2023) alors que le dashboard ne compte que les *direct appropriations* | surestimation (+) | ≤ 0,6 % |
| Dé-obligations postérieures au snapshot Orion / antérieures à la mise à jour du dashboard | signe variable | faible |

#### 9.4.4 Le seuil, fixé avant le calcul

> **Seuil d'acceptation : écart relatif ≤ ±5 % sur CHACUN des quatre
> exercices testés (FY2019, FY2022, FY2023, FY2024), ET signe de
> l'écart compatible avec la table ci-dessus.** Si tous les écarts sont
> ≤ 2 %, la réconciliation est dite **forte**. Un seul exercice au-delà
> de 5 %, ou un écart de signe inexpliqué, vaut échec — pas de
> sauvetage par le wording.

*Justification du 5 %* : les postes de périmètre listés sont bornés,
individuellement, bien en dessous de 1 % (sauf le deuxième, inconnu) ;
la NSF déclare elle-même que les totaux du dashboard diffèrent
« slightly » de ses *Congressional Budget Actuals* (FAQ officielle) ;
et 5 % reste très en dessous de l'amplitude qui séparait les mauvais
dénominateurs entre eux (18 points, § 9.1). Un écart supérieur ne
serait plus explicable par les différences recensées : il signalerait
un périmètre incompris, ce qui est exactement ce que le seuil doit
attraper.

#### 9.4.5 Numérateur Orion, arrêté avant réception des valeurs officielles

| FY | Orion (USD exacts) |
|---:|---:|
| 2019 | 7 536 772 371 |
| 2022 | 8 442 209 512 |
| 2023 | 8 465 086 590 |
| 2024 | 8 070 548 543 |

#### 9.4.6 Résultat — la réconciliation passe

Les valeurs officielles ont été extraites du dashboard le **2026-08-26**
(le dashboard affichait lui-même « Report Ran on 26 août 2026 »), sans
filtre, depuis la vue *Trends* (FY2016-2025, table de données du
graphique) et la vue *Numbers by State* (FY2011-2015, KPI « Award
Obligation » avec filtre d'exercice) — cohérence inter-vues vérifiée sur
FY2016 (identique par les deux voies) et FY2020 (confirmé par tooltip).
URL : `https://tableau.external.nsf.gov/views/NSFbyNumbers/Trends`,
depuis https://www.nsf.gov/about/about-nsf-by-the-numbers.

Montants en millions de dollars ; Orion arrondi depuis le dollar exact.

| FY | Orion | Officiel (« Award Obligation Amount ») | Écart | Écart relatif |
|---:|---:|---:|---:|---:|
| 2011 | 6 374,02 | 6 480,02 | −106,00 | −1,64 % |
| 2012 | 6 565,93 | 6 671,64 | −105,71 | −1,58 % |
| 2013 | 6 456,92 | 6 510,85 | −53,93 | −0,83 % |
| 2014 | 6 585,20 | 6 727,78 | −142,58 | −2,12 % |
| 2015 | 6 829,66 | 6 928,47 | −98,81 | −1,43 % |
| 2016 | 6 967,04 | 7 071,84 | −104,80 | −1,48 % |
| 2017 | 6 872,17 | 6 982,04 | −109,87 | −1,57 % |
| 2018 | 7 238,58 | 7 417,98 | −179,40 | −2,42 % |
| **2019** | **7 536,77** | **7 688,61** | **−151,84** | **−1,97 %** |
| 2020 | 7 623,19 | 7 750,69 | −127,50 | −1,65 % |
| 2021 | 8 021,50 | 8 118,56 | −97,06 | −1,20 % |
| **2022** | **8 442,21** | **8 541,76** | **−99,55** | **−1,17 %** |
| **2023** | **8 465,09** | **8 653,72** | **−188,63** | **−2,18 %** |
| **2024** | **8 070,55** | **8 429,42** | **−358,87** | **−4,26 %** |
| 2025 | 8 277,40 | 8 601,82 | −324,42 | −3,77 % |

**Verdict de réconciliation, au seuil gravé au § 9.4.4 :**

- les quatre exercices testés sont **tous** dans le seuil ±5 % :
  −1,97 %, −1,17 %, −2,18 %, −4,26 % — **la réconciliation PASSE** ;
- elle n'est **pas** « forte » : FY2023 et FY2024 dépassent 2 % ;
- le **signe est uniforme et conforme** aux attentes ex ante : Orion
  sous-estime partout, comme prévu par les postes (−) du § 9.4.3. Le
  poste (+) mandatory est neutralisé par le codebook lui-même
  (« Actions funded by NSF mandatory appropriations are excluded »,
  IPA idem). L'écart résiduel est **compatible avec** les différences
  de snapshot (Orion au 2026-08-04, dashboard au 2026-08-26) et les
  restatements de la série — il n'est pas *démontré* par elles : la
  preuve exigerait une comparaison award par award qui n'existe pas
  encore (§ 9.4.8).

Contrôle hors protocole, sur les onze exercices non testés : le même
motif — tous négatifs, de −0,83 % à −3,77 %, moyenne de série
**−1,95 %**. Le gradient des deux dernières années (−4,26 %, −3,77 %)
est **compatible avec** des exercices récents encore amendés côté
source et figés côté Orion au snapshot — même réserve de preuve que
ci-dessus.

**Note d'amendement (2026-08-26, mise à jour par l'ultime verrou)** :
ce tableau mesure le périmètre A (tout le corpus, protocole
d'origine). Le § 9.4.8 avait ensuite proposé un périmètre « awards
seuls » — **invalidé sur preuve** par le § 9.4.9, qui gèle le
périmètre officiellement démontré (tout instrument, neuf funding
organizations) et donne la réconciliation finale à cinq colonnes.
Les trois tableaux restent au rapport : A (protocole d'origine),
§ 9.4.8 (l'erreur de méthode, conservée), § 9.4.9 (le périmètre
démontré, verdict **`R5B READY`**).

Le périmètre officiel, précisé par le codebook, correspond à celui
mesuré chez Orion au § 9.4.2 : « Award obligation data is restricted to
funding organizations in these directorates: BIO, CSE, EDU, ENG, GEO,
MPS, O/D, SBE, TIP » — c'est-à-dire recherche, ingénierie **et
éducation**, comme le corpus.

#### 9.4.7 Limites du dénominateur, à porter au contrat R5B

1. **La série est restatée sans archives.** Le PDF officiel de
   lancement (octobre 2021) publiait FY2011 = 6 093,56 M$ et
   FY2020 = 7 793,44 M$ ; le dashboard du 2026-08-26 affiche
   6 480,02 M$ et 7 750,69 M$. Les quinze valeurs ci-dessus forment un
   **millésime daté** (état du 2026-08-26) — la discipline vintage du
   Reference Engine (table append-only, dernière vintage gagne) est une
   condition nécessaire, pas un luxe.
2. **Pas d'API documentée** — mais Tableau documente officiellement
   l'export **Download → Crosstab** (Excel/CSV) des graphiques et de
   l'onglet Details. L'amendement final tranche en conséquence
   (§ 20.1) : la source R5B est **l'artefact officiel téléchargé**
   (Crosstab), jamais une transcription manuelle de valeurs lues à
   l'écran ; si le téléchargement ne peut pas être automatisé à cause
   de Tableau, un téléchargement **manuel de l'artefact** est accepté —
   la transcription manuelle, elle, ne l'est jamais. La table du
   § 9.4.6 (valeurs lues à l'écran, recoupées entre deux vues) reste la
   mesure de contre-relecture ; elle sera remplacée par l'extraction
   depuis l'artefact au lot 1.
3. **Pas de déclaration de licence propre au dashboard** — le régime
   applicable est celui des données fédérales américaines, et la
   déclaration explicite de domaine public du § 6.4 vise les « award
   data », pas nommément ce tableau de bord. À consigner tel quel.
4. **Mise à jour annuelle** : « updated annually when the fiscal year
   is complete » — l'exercice en cours n'existe pas au dénominateur, et
   le numérateur Orion de l'exercice en cours est lui-même incomplet
   (FY2026 : 3,97 Md$ au snapshot). La surface doit s'arrêter au
   dernier exercice clos des deux côtés.

### 9.4.8 Amendement final (2026-08-26) — audit de périmètre chiffré et règle gelée

L'amendement fondatrice exige que « les périmètres correspondent »
devienne une démonstration chiffrée, filtre du codebook par filtre.
Voici l'audit, en dollars et en awards, puis la règle qui en sort.

**① Funding organizations (les neuf directorates du codebook).**
Le corpus se ventile sur 15 organisations. Les neuf du codebook — MPS,
GEO, EDU (STEM Education), CSE (CISE), BIO, ENG, TIP, SBE, O/D (Office
of the Director) — portent l'essentiel ; hors d'elles :

| Organisation hors codebook | Awards | Montant total |
|---|---:|---:|
| Office of Information & Resource Management | 243 | 205 M$ |
| Office of Budget, Finance, & Award Management | 148 | 30 M$ |
| National Coordination Office, OCIO, NNCO, Polar, (null) | 116 | 72 M$ |
| **Total hors directorates** | **507** | **≈ 307 M$ (0,21 % du corpus)** |

En obligations annuelles : 30,7 M$ sur FY2019 (0,41 %), 24,5 M$ sur
FY2022 (0,29 %), **zéro** sur FY2023-FY2024. Ces bureaux sont
précisément les « administrative planning and related technology
investments » que le codebook exclut : le filtre ① couvre aussi ce
critère-là.

**② IPA.** Aucun instrument « IPA » (Intergovernmental Personnel Act)
n'existe dans les téléchargements — à ne pas confondre avec les
« Interagency Agreements », qui sont autre chose (③). Poste nul par
construction côté Orion.

**③ Instruments contractuels et interagency — le poste décisif.**
Quatre instruments du corpus ne sont pas des awards :

| Instrument | Awards | Montant total |
|---|---:|---:|
| Contract Interagency Agreement | 842 | 2 116,0 M$ |
| Contract | 88 | 555,0 M$ |
| Interagency Agreement | 395 | 285,3 M$ |
| Contract-BOA/Task Order | 80 | 44,2 M$ |
| **Total** | **1 405** | **≈ 3 000 M$ (2,05 % du corpus)** |

Leur profil temporel est singulier : **2,0 à 3,6 % des obligations de
chaque exercice de FY2011 à FY2022, puis quasi zéro (≤ 0,02 %) dès
FY2023** — ils disparaissent des téléchargements source. Et le
recouvrement avec ① est presque total : le « hors directorates » est un
sous-ensemble des vehicles à ≈ 1 M$ près (l'union vaut les vehicles).
**Un seul filtre — l'instrument — suffit donc à couvrir ① et ③.**

**④ Mandatory appropriations.** Aucun champ conservé ne les identifie.
Borne externe : les crédits mandatory NSF (CHIPS Sec. 102) valent 25 à
50 M$/an à partir de FY2023, soit **≤ 0,6 %**. Le champ
`awd_arra_amount` (ARRA, FY2009-2010, marginal sur FY2011) existe à la
source et n'est pas conservé : sa lecture est inscrite au contrat
(§ 20.1). Risque résiduel chiffré, non éliminable avec les champs
actuels.

**Le test de cohérence qui tranche ③.** Si le dénominateur officiel
incluait les vehicles, l'écart Orion↔officiel serait stable quel que
soit leur poids. Il ne l'est pas :

| Périmètre du numérateur | Écart moyen FY2011-2022 (vehicles : 2-3,6 %) | Écart moyen FY2023-2025 (vehicles : ≈ 0 %) | Écart-type 15 ans |
|---|---:|---:|---:|
| **A — tout le corpus** | −1,59 % | −3,40 % | 0,94 pt — **cassure en 2023, pile quand les vehicles disparaissent** |
| **B — awards seuls** (sans les 4 instruments) | −4,15 % | −3,42 % | **0,70 pt — homogène** |

La stabilité apparente du périmètre A sur 2011-2022 était une
**compensation** : les vehicles surcomptés masquaient une sous-couverture
plus profonde. Le périmètre B est le seul dont l'écart se comporte comme
un vrai écart de couverture — constant, de même signe, sans cassure
structurelle. Il est aussi le seul cohérent avec la lettre du codebook
(« obligations on **awards** », « **NSF direct appropriations** only » —
les vehicles interagency portent typiquement des fonds d'autres
agences).

**Règle de périmètre proposée ici — INVALIDÉE par l'ultime verrou
(§ 9.4.9)** : ce paragraphe proposait d'exclure les instruments
contractuels/interagency au motif que l'écart devenait homogène sans
eux. C'était une inférence statistique, pas une preuve — et
l'inspection ciblée de la population officielle a montré qu'elle était
**fausse** : la métrique « Award Obligations » inclut ces instruments
(1902627 y figure sur sept exercices), et le critère discriminant réel
est la funding organization. Le texte est conservé tel quel comme
pièce d'anatomie de l'erreur ; le prédicat gelé est au § 9.4.9.

**La réconciliation, rejouée sous la règle gelée** (périmètre B ;
l'officiel est inchangé) :

| FY | Orion (awards seuls) | Officiel | Écart relatif |
|---:|---:|---:|---:|
| 2019 | 7 327,70 | 7 688,61 | **−4,69 %** |
| 2022 | 8 185,81 | 8 541,76 | **−4,17 %** |
| 2023 | 8 463,08 | 8 653,72 | **−2,20 %** |
| 2024 | 8 069,37 | 8 429,42 | **−4,27 %** |

Les quatre exercices restent **dans le seuil ±5 %**, au même signe, et
la série quinze ans va de −2,20 % à −5,11 % (FY2012, la seule année
au-delà de 5 % — hors de la fenêtre testée, à surveiller si la surface
descend un jour sous FY2013). **La couverture revendiquée est donc
≈ 95-98 % selon l'exercice, pas « ±5 % »** : le seuil est le critère de
survie de la route, jamais une précision revendiquée.

**Reformulation imposée par l'amendement, reprise ici** : l'écart
résiduel est **compatible avec** les différences de snapshot et les
restatements de la série officielle — il n'est pas « expliqué par la
fraîcheur » tant qu'une preuve award par award ne l'établit pas. Cette
preuve n'existe pas aujourd'hui ; le Crosstab officiel « Details »
(population des new awards par FY, avec `Award ID` et instrument) la
rend possible — elle est inscrite au contrat comme contrôle C4
(§ 20.1).

### 9.4.9 Ultime verrou (2026-08-26) — le prédicat d'éligibilité, dérivé de la source et non de la courbe

L'ultime verrou fondatrice interdisait de déduire une règle de périmètre
du fait qu'elle améliore la réconciliation. Il avait raison de
l'interdire : **la règle d'instruments du § 9.4.8 était fausse**, et
c'est une inspection ciblée de la source officielle qui l'a montré.

#### La table officielle award × FY × obligation existe

Inspection du 2026-08-26 (session invitée ; aucune donnée téléchargée —
lecture par capture réseau, conformément à la consigne fichiers). Le
sélecteur de métrique est la colonne de cartes KPI de « Numbers by
State », et la sélection se propage à « Details ». Sous la métrique
**« Award Obligation »**, la page Details expose la feuille Crosstab
**« @Award Details Sheet »** — **31 colonnes**, dont `Award ID`,
`Fiscal Year` (= **FY de l'obligation**), `Award Fiscal Year` (= FY de
démarrage), `Award Instrument`, `Funding Directorate` / `Funding
Division`, `Managing Directorate` / `Managing Division`, et **`Award
Obligation Amount`** (= l'obligation de ce FY). Grain : une ligne par
award × FY d'obligation × funding division. Le codebook le confirme mot
pour mot : « *This data is public and presented in the award
obligations information in the 'Detail' tab* ». Tooltip officiel de la
métrique : « *NSF direct appropriations obligated in the given fiscal
year. Amounts shown do not include NSF's administrative accounts.* »

#### Les cinq tests d'Award ID — le critère est l'organisation, pas l'instrument

| Award | Instrument (Orion) | Organisation (Orion) | Population « Award Obligation » officielle |
|---|---|---|---|
| `1902627` | Contract Interagency Agreement | GEO / OPP | **Présent, 7 lignes FY2019-2025** (DOD Antarctic Support) |
| `2221247` | Contract Interagency Agreement | GEO / OPP | **Présent, 4 lignes FY2022-2025** |
| `2102180` | Contract Interagency Agreement | **OIRM / Administrative Services** | **Absent (0 ligne)** |
| `2231406` | Standard Grant (new FY2022) | CSE / OAC | Présent, 3 lignes FY2022-2024 |
| `1823600` | Continuing Grant (démarré 2018) | GEO | Présent, **15 lignes FY2018-2025** (increments prior-year inclus, scindés par funding division) |

Trois conclusions démontrées, chacune sur pièces :

1. **Les instruments contractuels/interagency SONT dans la métrique
   officielle** (1902627, 2221247 ; les premiers bénéficiaires
   affichés sous cette métrique sont Leidos, contractants et
   opérateurs). La clause « Contract based awards excluded » appartient
   au codebook du *NSF Institution Factsheet Dashboard*, un autre
   tableau de bord — le codebook *NSF by the Numbers* ne contient
   d'ailleurs **aucune** entrée « Award Instrument ». **La règle
   « awards seuls » du § 9.4.8 est INVALIDÉE** ; le test de cohérence
   statistique qui la soutenait reste au rapport comme pièce
   d'anatomie d'une erreur de méthode : un indice de courbe n'est pas
   une preuve d'éligibilité.
2. **Le critère discriminant est la funding organization** : 2102180,
   porté par un compte administratif hors des neuf organisations du
   codebook, est absent — exactement ce que prédisent les deux règles
   écrites (« restricted to funding organizations BIO…TIP », « do not
   include NSF's administrative accounts »). Trois vehicles testés,
   trois verdicts officiels prédits par l'organisation.
3. **Nos `oblg_fy` sont partiellement périmés** : pour 1902627,
   l'officiel porte trois exercices (FY2023-2025, ≈ 221 M$) absents de
   notre snapshot du 2026-08-04, et un restatement (FY2020 :
   58 324 658 $ officiel contre 58 496 658 $ chez nous). Les archives
   bulk ne suivent pas les obligations tardives d'un award ancien au
   rythme du dashboard.

#### Le prédicat d'éligibilité GELÉ — hérité, plus jamais inféré

La préférence énoncée par l'amendement (« si le Details officiel permet
une jointure fiable, préférer ce snapshot comme source de l'obligation
annuelle ») s'applique : la table existe, avec la clé exacte.

> **Prédicat gelé** : une ligne (award × FY × montant) est éligible au
> numérateur **si et seulement si elle provient du snapshot officiel
> « @Award Details Sheet » du millésime courant**. Le dénominateur d'un
> FY est la somme de **toutes** les lignes du même snapshot pour ce FY.
> La jointure `Award ID` ↔ `participations.source_uid` n'apporte que
> les dimensions d'Orion (pays, organisation, lentilles) — elle ne
> décide jamais de l'éligibilité. Les tranches `oblg_fy` d'Orion
> deviennent un **contrôle croisé** (§ 20.1 C4), plus une source.

Par construction : **aucune catégorie ne peut entrer au numérateur sans
être au dénominateur** — la condition nécessaire du GO est satisfaite
déterministiquement, pas statistiquement. `scope_unknown` est **vide
par construction** dans cette architecture ; la seule grandeur à
exposer est la **part du dénominateur non joignable à Orion** (awards
officiels absents du corpus), mesurée exactement au lot 1, avec un
seuil de fermeture par FY (> 5 % non joignable → FY indisponible pour
les sélections dimensionnelles).

#### La matrice du prédicat, condition par condition

| Condition officielle | Comment elle est décidée | Statut |
|---|---|---|
| Population « Award Obligations » | Présence de la ligne dans le snapshot officiel | **Exacte par construction** |
| IPA exclus | Hérité du snapshot | Exacte |
| Funding organizations ∈ {BIO, CSE, EDU, ENG, GEO, MPS, O/D, SBE, TIP} | Hérité du snapshot (colonnes `Funding Directorate/Division` présentes) | Exacte |
| NSF direct appropriations only / mandatory exclus | Hérité du snapshot (tooltip officiel) | Exacte |
| Comptes administratifs exclus | Hérité du snapshot | Exacte |
| Instrument | **N'est pas un critère** (prouvé ci-dessus) | Sans objet |
| Champ Orion `directorate` | Diagnostic seulement — c'est le **Managing** ; le critère officiel est le **Funding** ; validé 3/3 sur les tests mais jamais décisionnel | Proxy, **non utilisé pour décider** |

#### La réconciliation à cinq colonnes, au périmètre officiellement démontré

Le périmètre démontré est : tout instrument, neuf funding
organizations. Côté Orion (`oblg_fy`, en attendant le snapshot du
lot 1), la seule exclusion **officiellement justifiée** est le
hors-neuf-organisations (validée dans les deux sens par les tests) :

| FY | official total | Orion eligible total | excluded-known-ineligible (hors des 9 org.) | unclassified | relative gap |
|---:|---:|---:|---:|---:|---:|
| 2019 | 7 688,61 | 7 506,04 | 30,73 | 0 | **−2,37 %** |
| 2022 | 8 541,76 | 8 417,69 | 24,52 | 0 | **−1,45 %** |
| 2023 | 8 653,72 | 8 465,08 | 0,01 | 0 | **−2,18 %** |
| 2024 | 8 429,42 | 8 070,55 | 0,00 | 0 | **−4,26 %** |

(M$ ; les sommes eligible + excluded bouclent sur les totaux Orion du
§ 9.4.5 au centime d'arrondi près.) Les quatre exercices sont dans le
seuil ±5 % ex ante — qui reste le critère de survie de la route,
jamais une précision revendiquée. Décomposition du gap : il est
désormais **démontré sur un cas** qu'il contient de la couverture
manquante (tranches FY2023-25 de 1902627 absentes de nos bulk) et des
restatements (FY2020 du même award) ; la décomposition exhaustive
arrive avec le snapshot per-award (C4). `unclassified` est vide : plus
aucune ligne n'a d'éligibilité inconnue — le risque mandatory,
non attribuable ligne à ligne côté `oblg_fy`, disparaît dans
l'architecture snapshot (hérité) et reste borné ≤ 0,6 % pendant la
transition.

#### Verdict du verrou

Le prédicat est gelé sur preuves officielles : population officielle
comme périmètre, cinq conditions héritées, aucune règle inférée d'une
courbe, `scope_unknown` vide par construction, part non joignable
exposée avec seuil de fermeture par FY. La seule réserve est
opérationnelle et déjà au contrat : l'acquisition complète du snapshot
(15 exports FY, ~10-15 k lignes chacun ; aucun plafond rencontré à
19 400 lignes) est le premier geste du lot 1, avec ses validations.

**`R5B READY`**

### 9.5 Ce que ces quatre tests établissent

1. La Route A est **fausse d'un facteur proche de 5** côté NIH, produit
   des ratios de 6,9 % à 136,3 % côté UE, et s'écarte de −40 à +123 %
   côté NSF. Ce ne sont plus des biais, ce sont d'autres nombres.
2. La Route D est **juste**, mais elle est **impossible côté UE** (la
   Commission ne publie aucun profil annuel, et le FTS explique
   pourquoi) et **perdue côté NIH** (profil jeté à l'ingestion). Côté
   NSF, la contre-relecture a levé le blocage : le dénominateur exact —
   « Award Obligation Amount » — **existe en série FY2011-FY2025**, a
   été extrait le 2026-08-26, et **la réconciliation passe** au seuil
   gravé (§ 9.4.6 : quatre exercices testés entre −1,17 % et −4,26 %,
   signe uniforme, compatible avec les différences de snapshot). L'amplitude de 18 points entre
   dénominateurs disparaît dès que la métrique nomme explicitement le
   sien (§ 9.1).
3. Les sources ne se comportent même pas pareil sur les mêmes notions :
   les supplementals COVID sont **exclus** des séries NIH et **inclus**
   dans la table sommaire NSF ; le FTS européen déclare des engagements
   **supérieurs** aux crédits votés. Deux conventions opposées chez deux
   agences du même État, et un dénominateur européen plus petit que son
   propre numérateur.

---

## 10. Comparabilité entre financeurs — la matrice

| Financeur | Numérateur Orion (§ 2.4) | Dénominateur candidat le moins mauvais | Même base comptable ? | Même période ? | Verdict |
|---|---|---|---|---|---|
| **Commission européenne** (CORDIS) | Contribution UE maximale contractuelle — **engagement prévisionnel plafonné**, complet à la signature. Total **exact** : 68,334 Md€ contre 68,3 Md€ officiels (§ 4.2) | Crédits d'engagement annuels du programme | **Non** — l'engagement budgétaire de l'Union et la date de démarrage du projet ne sont pas le même acte | **Non** — ratios de **6,9 % à 136,3 %**, dont trois > 100 % ; 14,7 % de H2020 démarre hors du cadre, où le ratio est **indéfini** | ❌ **Incompatible par année** |
| **Commission européenne** (CORDIS), par cohorte d'appel | idem | **Enveloppe de l'appel / du work programme** | **Oui** — deux engagements, même acte, même périmètre | **Oui** — la cohorte est l'unité des deux côtés | ✅ **Compatible… mais 0,008 % de recouvrement** (§ 8, Route B) |
| **NIH** | Somme des obligations d'exercices déjà publiées, tronquée aux deux bouts | Obligations annuelles NIH | Oui, **en principe** | **Non en l'état** — Orion a jeté le profil annuel (§ 2.2) ; 29,2 % de la valeur a une première année fiscale différente de son année Orion | ⚠️ **Récupérable, pas disponible** |
| **NSF** | Obligation cumulée à date, **profil annuel conservé** | « **Award Obligation Amount** » (*NSF by the Numbers*, FY2011-FY2025) | **Oui** — obligations d'awards des deux côtés, même définition mot pour mot | **Oui** — exercice fédéral des deux côtés, via la Route D | ✅ **Compatible et RÉCONCILIÉ** : écarts de −1,17 % à −4,26 % sur les quatre FY testés, dans le seuil ±5 % gravé (§ 9.4.6) |
| **ADEME** | — | — | — | — | **Sans objet** : source non ingérée (décision fondatrice du 2026-07-31) |

### La réponse à la question posée

> **Peut-on afficher EC, NIH et NSF sur un même axe `% budget` sans
> comparer des choses différentes ?**

**Non.** Et il ne s'agit pas d'une nuance : les trois colonnes d'un même
graphique porteraient trois grandeurs distinctes.

- La barre **EC** dirait : « part d'un budget d'autorisation
  qu'un engagement prévisionnel complet représente ».
- La barre **NIH** dirait : « part d'un budget que représente un cumul
  d'obligations partiellement observé, daté d'une année où une partie de
  cet argent n'existait pas encore ».
- La barre **NSF** dirait : « part d'un budget que représentent les
  obligations réellement constatées cette année-là » — la seule des trois
  qui soit vraie.

Trois barres côte à côte, trois définitions, une seule légende : c'est
exactement le « faux ratio » que la doctrine interdit. La conséquence
opérationnelle est nette : **le mode global est écarté**, et toute
métrique budgétaire qui verrait le jour serait **explicitement
différente par financeur**, avec un libellé différent — jamais une
symétrie de présentation posée sur une asymétrie de fond.

---

## 11. Annualité et années fiscales

**La question `year_orion == year_budget` a-t-elle un sens ?** Réponse
par source, mesurée.

| Source | Année d'Orion | Année du dénominateur | Coïncidence ? |
|---|---|---|---|
| CORDIS | Année civile de `startDate` | Exercice budgétaire UE = année civile | Les **calendriers** coïncident ; les **événements** non (§ 11.2) |
| NIH | Année civile de `min(project_start)` | Exercice fédéral, 1ᵉʳ octobre → 30 septembre | Non, et le désalignement n'est pas le problème principal |
| NSF | Année civile de `awd_eff_date` | Exercice fédéral | Non — et **corriger l'axe aggrave l'alignement** (§ 11.1) |

### 11.1 La correction d'axe fiscal ne sauve rien — mesuré

Tentation naturelle : « il suffit de convertir l'année civile en
exercice fédéral ». Testé sur NSF, où la vérité est connue :

| Rattachement testé | Part de la valeur réellement obligée cette année-là |
|---|---:|
| Année **civile** de début (ce que fait Orion) | **56,05 %** |
| Année **fiscale** de début (`+1` si le mois ≥ octobre) | **51,14 %** |
| Cumulé jusqu'à l'exercice de début inclus | 62,93 % |
| Obligé **plus d'un an** après | 25,04 % |
| Obligé **plus de trois ans** après | 8,36 % |

Passer de l'année civile à l'exercice fédéral **dégrade** l'alignement
de 5 points. Le désalignement d'Orion n'est pas un décalage d'axe, c'est
un problème de **pluriannualité** : aucune transformation d'année ne le
corrige, parce qu'il n'y a pas une bonne année à trouver — il y en a
plusieurs.

Le décalage d'axe existe pourtant bien, et il est loin d'être marginal :
**19,6 % de la valeur NSF** démarre entre octobre et décembre, donc
bascule d'exercice ; le mois de démarrage le plus fréquent est
septembre, juste avant la bascule. Pour NIH, seulement 3,6 % de la
valeur est concernée. Pour CORDIS, 22,9 % (H2020) à 30,6 % (FP7) — sans
conséquence, l'exercice UE étant l'année civile.

**Règle qui en découle** : aucun décalage `+1` / `−1` ne sera appliqué
nulle part. Non parce qu'il serait implicite — on saurait l'écrire — mais
parce qu'il **n'améliore rien** et donnerait l'illusion d'une correction.

### 11.2 CORDIS : quatre dates, et Orion utilise la moins budgétaire

Le corpus porte deux dates exploitables et Orion a retenu celle du
démarrage :

| Date | Ce qu'elle marque | Utilisée par Orion ? |
|---|---|---|
| `ecSignatureDate` | L'**engagement juridique** de l'Union | Non |
| `startDate` | Le démarrage des travaux | **Oui** |

Elles ne sont pas interchangeables : la signature précède le démarrage
de **97 jours en moyenne** (H2020) et **120 jours** (Horizon Europe), et
seulement **68,5 % / 65,2 % de la valeur** tombe dans la même année
civile pour les deux dates. **Un tiers de la valeur change d'année**
selon la date retenue.

Si une métrique budgétaire devait un jour exister côté UE, elle devrait
utiliser `ecSignatureDate` — la date de l'engagement — et non
`startDate`. Ce serait un changement de convention, pas un réglage : il
déplacerait un tiers de la valeur d'une année à l'autre et rendrait le
mode incohérent avec tous les autres modes du Reference Engine, qui
reposent sur la convention ③ (`start_date`). **Cette divergence est en
soi un argument pour traiter un futur ratio budgétaire hors du
Reference Engine** (§ 14).

---

## 12. Devise, FX et inflation

**La présomption de la consigne est confirmée : le ratio doit se
construire en devise native, avant tout FX et avant toute déflation.**

La démonstration est arithmétique et n'a pas besoin des données. Pour
une année unique `a`, si numérateur et dénominateur sont tous deux en
USD et qu'on les convertit avec le **même** taux `r(a)` :

```text
(X_usd / r(a)) / (B_usd / r(a))  =  X_usd / B_usd
```

Le taux disparaît : le ratio annuel est invariant à la conversion. Mais
sur une **somme pluriannuelle**, les taux ne se simplifient plus :

```text
Σ (X_usd(a)/r(a))  /  Σ (B_usd(a)/r(a))   ≠   Σ X_usd(a) / Σ B_usd(a)
```

L'inégalité est d'autant plus forte que le taux bouge : le taux annuel
EUR/USD de la BCE stocké dans Orion va de **1,1069 (2016) à 1,4708
(2008)**, soit **33 % d'amplitude**. Un ratio « % du budget NSF » calculé
après passage par l'euro dépendrait donc de l'euro alors que les deux
grandeurs sont nativement en dollars — ce que la consigne interdit
explicitement, à raison.

Contrôle sur pièces : sur la fenêtre NSF 2008-2016, le taux implicite
pondéré par les montants (1,295727) diffère du taux moyen simple des
années (1,304559) de **−0,68 %**. L'écart est modeste ici parce que la
composition est régulière ; il n'y a aucune raison qu'il le reste sur
une fenêtre choisie par l'utilisateur.

**Règles gravées** :

- un ratio budgétaire se calcule **dans la devise du financeur**,
  jamais après conversion ;
- il est **nominal des deux côtés** — déflater le numérateur et le
  dénominateur par le même indice ne changerait rien au ratio, et les
  déflater par des indices différents serait une faute ;
- il ne réutilise donc **ni** la convention de change ④ d'Orion, **ni**
  la chaîne de déflation du moteur A, **ni** la convention PPP de R4.
  C'est le troisième signe que ce n'est pas un mode du Reference Engine
  (§ 14).

---

## 13. Grain, agrégation et surfaces

Chaque dimension pose une question différente ; aucune généralisation
n'est légitime.

| Grain | Le ratio dirait | Verdict |
|---|---|---|
| **Financeur** | La part du budget de l'agence qu'Orion observe | Défendable **si** le dénominateur est le budget de **cette** agence et que le périmètre R&D est isolé |
| **Programme** (institut NIH, division NSF, cluster Horizon) | Le poids d'un domaine dans l'enveloppe | Défendable **seulement** si la source publie le budget **par programme** ; sinon, dénominateur bricolé |
| **Appel / work programme** | Le poids d'un sujet dans son enveloppe | **Le grain le plus juste** — c'est la Route B |
| **Projet** | La part du budget annuel qu'un projet représente | **Refusé** : produit mécaniquement des valeurs absurdes (un grand équipement pluriannuel « pèse » 10 % d'un budget annuel qu'il consomme sur dix ans) |
| **Pays bénéficiaire** | La part du budget du financeur qui atterrit dans ce pays | Question **légitime et différente** — mais c'est une question de destination, pas d'effort. Le libellé doit le dire |
| **Organisation** | La part du budget captée par un bénéficiaire | Techniquement calculable, éditorialement dangereux, et sans dénominateur propre au grain |

Deux constats de mesure éclairent ces lignes :

- **La dimension « pays bénéficiaire » n'est pas symétrique entre
  sources.** Hors juridiction du financeur : CORDIS 12,07 % (Horizon) à
  25,27 % (FP7) de la valeur ; NIH **2,26 %** ; NSF **0,41 %**. Un
  « % du budget NIH par pays » serait une lecture presque dégénérée
  (97,65 % sur une seule ligne), alors que le même graphique côté UE
  serait riche. Le financement NIH hors États-Unis va d'ailleurs
  majoritairement à la santé mondiale (Afrique du Sud 1,48 Md€, Ouganda
  1,13, Nigeria 0,68, Kenya 0,59) — une histoire vraie, mais qui n'a
  rien à voir avec « l'effort de recherche » de ces pays.
- **Le grain projet et le grain participation concordent** (−2,45 % à
  +0,21 % selon la source), donc le choix de grain n'introduit pas
  d'écart matériel. Ce n'est pas là qu'est le problème.

**Surface interdite sans discussion : la carte et le donut.** Les modes
`gdp`, `capita`, `ppp` en sont déjà exclus par la règle 2 du § D4 de R0
(non sommables). Un ratio budgétaire est **différent** : si le
dénominateur est unique pour toute la vue (le budget NSF de FY2018), les
parts s'additionnent réellement et un donut serait mathématiquement
licite. C'est précisément ce qui le rend dangereux : il **inviterait** à
lire des parts d'un tout alors que le tout n'est observé qu'en partie.
Un donut « % du budget NSF » où les parts visibles totalisent 71 % ferait
croire que les 29 % manquants sont « les autres », alors qu'ils sont
« ce qu'Orion ne voit pas ».

**Et il y a pire, qui vaut d'être posé nettement** — le dilemme du
dénominateur :

- si le dénominateur est **le total observé par Orion**, les parts font
  100 % et le « ratio budgétaire » n'est qu'une part-du-tout, que le
  donut nominal sait déjà afficher : **aucune information nouvelle** ;
- si le dénominateur est **le budget officiel du financeur**, les parts
  ne font **pas** 100 % — et l'écart mélange deux choses très
  différentes : ce que le financeur consacre à autre chose (vrai
  signal), et ce qu'Orion ne voit pas (défaut de couverture). L'interface
  ne peut pas les distinguer.

Le second cas est le seul qui apporte quelque chose, et il oblige à
assumer à l'écran que le total ne boucle pas. C'est faisable, mais c'est
un contrat d'affichage nouveau dans Orion, pas un simple mode.

---

## 14. Interaction avec le Top — et l'arbitrage « mode de Reference » ou non

### 14.1 Le Top reste nominal

Doctrine R3/R4 inchangée et déjà en code (`search/explore.py` maintient
une colonne `ranking` nominale quand un mode est actif) : *Reference
change comment on regarde, pas qui on regarde.* Si un ratio budgétaire
existait un jour comme mode, il n'aurait aucun droit de reclasser le
Top ; l'échantillon resterait celui du nominal, pondéré comme lui.

### 14.2 Mais est-ce seulement un mode de Reference ? — arbitrage explicite

**Non.** Quatre raisons, toutes établies dans ce document, et aucune
n'est une question de goût :

1. **Le dénominateur ne dépend pas de la vue, mais du financeur.** Tous
   les modes existants (`real`, `gdp`, `capita`, `ppp`) transforment la
   valeur affichée à partir d'une référence attachée à l'**entité
   regardée** (son économie, sa population, son niveau de prix). Un ratio
   budgétaire divise par une grandeur attachée au **financeur**, qui
   n'est pas l'entité regardée dès que la vue est cadrée sur des pays ou
   des organisations.
2. **Il n'obéit pas aux conventions monétaires du moteur.** Il se calcule
   en devise native, sans FX et sans déflation (§ 12) — là où tout le
   Reference Engine repose sur la convention ④ et sur la déflation en
   devise d'origine.
3. **Il n'obéit pas à la convention de date du moteur.** Il exigerait
   `ecSignatureDate` côté UE (§ 11.2) et l'exercice d'obligation côté
   NSF, contre la convention ③ (`start_date`) partagée par tous les
   modes.
4. **Il ne survit pas au changement de financeur dans une même vue.**
   `% GDP` a déjà la règle « dénominateur unique et résolu pour toute la
   vue » (R0 § D4.b) ; un ratio budgétaire aurait la même contrainte en
   plus dure, puisqu'il faudrait *un budget par financeur et par année*.

**Arbitrage** : si une métrique budgétaire voit le jour, ce sera une
**métrique indépendante**, sur une surface dédiée, avec sa propre
grammaire — pas une entrée du sélecteur « View funding as ». La mettre
dans le sélecteur laisserait croire qu'elle est commutable avec `real`
ou `% GDP` sur la même vue, ce qui est faux dans les quatre cas
ci-dessus.

---

## 15. Données manquantes et exclusions — l'inventaire

Aucune des lignes ci-dessous n'autorise un remplacement par zéro, un
dénominateur voisin, ou un budget d'agence non-R&D.

| Cas | Constat mesuré | Traitement imposé |
|---|---|---|
| **Projet sans date de début** | NIH : 25 215 projets, **81,06 Md$ = 11,02 % de la valeur NIH** (recherche intra-muros ZIA/Z01, dates non publiées) | Hors de toute cohorte annuelle. Jamais datés d'office |
| **Projet sans montant** | NIH 14 931 ; NSF 439 | Exclus et comptés |
| **Année de début hors fenêtre d'ingestion** | NIH : 41 879 projets, 16,33 Md€, démarrant avant 2005 alors que les tranches commencent en FY2005 | Exclus de tout ratio annuel — leur valeur n'appartient pas à leur année affichée |
| **Cohorte tronquée à droite** | NIH 2024-2025, NSF 2024-2025 : 88 à 98 % des projets encore en cours | Années non publiables, jamais présentées comme une baisse |
| **Financeur sans budget compatible** | Les trois, à des degrés divers (§ 10) | Le mode n'apparaît pas pour ce financeur |
| **Appel sans enveloppe identifiable** | 179 des 181 codes d'appel budgétés n'ont aucun projet ; réciproquement l'immense majorité des appels historiques n'a plus d'enveloppe accessible | Aucun ratio sur ces appels |
| **Véhicules « parapluie » NIH** | 1 867 projets (0,5 %) concentrent 59,5 Md$ (8 %) ; ils pèsent de **5,9 % à 18,8 %** des cohortes annuelles selon l'année | À exclure ou à marquer avant tout ratio (§ 17.2) |
| **Appropriations supplémentaires** | COVID : 6,5 % de la cohorte NIH 2020, 4,9 % de 2021 | Le dénominateur doit les inclure, ou le numérateur les exclure — jamais l'inverse |
| **Budget total ≠ budget R&D** | NIH et NSF financent aussi de l'intra-muros, de la formation, des constructions, de l'administration | Un budget d'agence entier est un dénominateur **interdit** |

---

## 16. Licences et provenance des dénominateurs candidats

La règle de licence d'Orion est non négociable (`docs/data-sources.md`) :
seules entrent les licences limpides — domaine public, CC0, CC BY,
Licence Ouverte, OGL. **Pas sûr = pas ingéré.**

| Dénominateur candidat | Producteur | Série / table exacte | Licence constatée le 2026-08-26 | Commercial ? | Verdict |
|---|---|---|---|---|---|
| **GBARD Eurostat** | Eurostat | `gba_nabsfin07`, `gba_nabste`, `gba_fundmod`, `gba_tncoor` | Décision 2011/833/UE — **mais exception explicite** : les données de pays hors UE/AELE/candidats « **may not be reused for commercial purposes** » | **Non pour US/JP/KR/RU**, et littéralement UK | ❌ **Exclu** pour les lignes américaines — celles qui nous intéresseraient |
| **GBARD OCDE** | OCDE | `DSD_RDS_GOV@DF_GBARD_NABS07` | Terms & Conditions § 3 « Data », màj 2024-07-01 : commercial autorisé, citation obligatoire, **et clause propagée à toute sous-licence** | Oui, sous conditions | ⚠️ Licence acceptable, **objet incompatible** (§ 7) — et exigerait de refléter le pass-through dans les CGU d'Orion, comme R0 § D11 l'avait déjà noté |
| **UNESCO UIS** | UNESCO | — | CC BY-**SA** 4.0 (Data Browser) / CC BY-SA 3.0 IGO (ancienne page) — **les deux pages divergent** | ShareAlike | ❌ **Exclu** (règle de licence) — et sans objet : **l'UIS ne publie aucune série GBARD**, seulement une entrée de glossaire reprise du Frascati |
| **Budget de l'UE / work programmes** | Commission européenne | Fichiers DG BUDG `MFF_ABL_2021_2027`, décisions C(2024) 2371 et C(2025) 2779 | Décision 2011/833/UE | Oui, attribution | ✅ Licence compatible — **objet incompatible** (§ 4.3, § 4.6) |
| **Financial Transparency System** | Commission européenne (DG BUDG) | Datasets annuels `.xlsx`, 2007-2025 | **CC BY 4.0**, déclarée sur chaque distribution | Oui | ✅ Licence compatible — **chiffres inexploitables** : les engagements déclarés dépassent les crédits votés (§ 4.4) |
| **Horizon Dashboard** | Commission européenne | Application Qlik Sense | **Aucune licence propre publiée** ; le *Quick Guide* porte la décision 2011/833/UE | Incertain | ❌ Vue générée à la demande, redatée à chaque rafraîchissement — non rejouable |
| **Appels du portail F&T** | Commission européenne | `call_topics.budget_overview` | **CC BY 4.0** — déjà audité et ingéré (E1, `docs/data-sources.md`) | Oui | ✅ **Déjà dans Orion** |
| **Budgets NIH** | NIH / HHS | (§ 5) | Domaine public fédéral — par les politiques générales des agences ; aucune déclaration propre aux données (constat d'absence, § 5.5) | Oui | ✅ Compatible |
| **Budgets NSF** | NSF / NCSES | (§ 6) | **Domaine public déclaré explicitement** pour les award data (« in the public domain and not subject to copyright », page *Award Search Overview*, § 6.4) | Oui | ✅ Compatible |

**Conclusion licences** : la seule source dont la licence bloque
réellement est GBARD Eurostat sur ses lignes américaines — et c'est sans
conséquence, puisque GBARD est écarté pour des raisons comptables bien
avant d'être écarté pour des raisons juridiques. Les dénominateurs qui
survivent au § 10 sont tous sous des licences déjà auditées et acceptées
par Orion.

---

## 17. Contre-exemples — ce qui casse la métrique

Chaque contre-exemple demandé a été cherché activement dans le corpus.
Tous ont été trouvés.

### 17.1 Gros programme pluriannuel démarrant une année donnée

- **EUROfusion** (`633053`) : **678,8 M€** rattachés au 2014-01-01,
  premier jour de H2020. Et sa suite (`101052200`) : **549,4 M€**
  rattachés au 2021-01-01, premier jour d'Horizon Europe. Deux projets
  déposent 1,2 Md€ sur les deux journées d'ouverture de cadre.

  **Et pour ces deux-là, la Commission publie le profil réel** — parce
  que leur engagement budgétaire est fractionné en tranches annuelles, ce
  qui est l'unité de publication du FTS (§ 4.4). La comparaison est donc
  directe, et sans appel :

  | Exercice budgétaire | 2014 | 2015 | 2016 | 2017 | 2018 | 2019 | 2020 | **Total** |
  |---|---:|---:|---:|---:|---:|---:|---:|---:|
  | Engagé au FTS (M€) | 73,8 | 62,1 | 88,2 | 93,0 | 123,6 | 123,2 | 114,8 | **678,8** |

  La somme des tranches vaut **exactement** le montant qu'Orion porte
  (678,8 M€) — le numérateur est juste. Mais **10,9 % seulement ont été
  engagés en 2014**, l'année où Orion place la totalité. Même histoire
  côté Horizon Europe : les tranches 2021-2025 totalisent 549,4 M€, dont
  **18,6 % en 2021**.
- **NSF `0856145`** : **1 073,79 M$** rattachés à 2008, alors que NSF
  publie ses obligations de FY2009 à FY2018, autour de 110 M$ par an.
- **NSF `1902627`** et **`1764464`** : 263,0 M$ et 236,5 M$ rattachés à
  2018 avec **zéro dollar obligé en 2018** — leur première obligation
  est FY2019.

**Et ces objets ne sont pas une curiosité statistique** : **57 awards
NSF** (0,02 % du nombre) portent **14,07 Md$, soit 9,6 % de toute la
valeur NSF**. Moins de soixante objets — précisément ceux dont le
rattachement annuel est le plus faux — décident d'un dixième du
numérateur.

### 17.2 Agence dont le budget total n'est pas un budget de R&D — et véhicules qui n'en sont pas

- **NIH `ZIHLM200888`** : **5 200,7 M$**, le plus gros « projet » NIH
  du corpus. C'est de la recherche **intra-muros**, et il **n'a aucune
  date de début**.
- **NIH `75N91019D00024`** : 3 932,6 M$ sur **522 tranches** — un
  véhicule contractuel, pas un projet.
- **NIH `261200800001E`** : 3 338,3 M$ sur **619 tranches**.
- Effet sur les cohortes : les 1 867 projets « parapluie » (> 50
  tranches) pèsent **18,8 % de la cohorte 2008**, 13,7 % de 2019, mais
  5,9 % de 2012. Cette volatilité n'a aucune signification économique.

### 17.3 Appropriations supplémentaires américaines

La cohorte NIH 2020 contient **1,908 Md$ de projets COVID** (6,5 % de la
cohorte ; 4,9 % en 2021, contre 0,2-0,3 % avant 2020), dont
`OT2HL156812` (programme ACTIV, 1 270,7 M$). Cet argent vient
d'appropriations supplémentaires. Un ratio calculé sur l'appropriation
régulière gonflerait le numérateur d'un argent absent du dénominateur.

### 17.4 Année de transition H2020 → Horizon Europe

| Année de début | H2020 | Horizon Europe | Total CORDIS |
|---:|---:|---:|---:|
| 2014 | 1,597 Md€ | — | 6,236 Md€ *(dont 4,640 de FP7)* |
| 2020 | 11,235 | — | 11,235 |
| **2021** | **9,282** | **1,180** | **10,462** |
| 2022 | 0,767 | 9,981 | 10,748 |
| 2023 | 0,005 | 14,986 | 14,991 |

**2021 est ingérable** : un ratio « % du budget Horizon Europe 2021 »
calculé sur la cohorte 2021 serait à **89 % composé de projets
H2020**. Et l'année d'ouverture de H2020 (2014) contient plus de FP7
(4,640) que de H2020 (1,597). Les cadres financiers ne s'arrêtent pas
quand les cohortes s'arrêtent : **H2020 produit encore des démarrages en
2023**, trois ans après la fin du cadre.

**Le contrôle sur cas fermé exigé par R0 § D12 (exigence 3), chiffré** :

| Manière de sommer H2020 dans Orion | Valeur | Part du total H2020 d'Orion |
|---|---:|---:|
| Cohortes par **année de début**, 2014-2020 | 58,278 Md€ | 85,3 % |
| Cohortes par **année de signature**, 2014-2020 | **62,221 Md€** | **91,1 %** |
| Total H2020 dans Orion, toutes années | 68,334 Md€ | 100 % |

**14,7 % de la valeur H2020 démarre après la fin du cadre** — cette
valeur n'a aucune année budgétaire H2020 où se ranger. Passer à la date
de signature récupère 3,9 Md€ et réduit la fuite à 8,9 %, ce qui
confirme le § 11.2 : la signature est la meilleure date budgétaire, sans
être une date suffisante.

*Note de périmètre* : le total H2020 d'Orion inclut **1,094 Md€
d'Euratom** (99 projets), qui relève d'un règlement et d'une enveloppe
distincts du règlement (UE) n° 1291/2013 — 0,855 Md€ pour Horizon
Europe. Toute comparaison à une enveloppe publiée doit trancher ce
périmètre avant de diviser.

### 17.5 Award dépassant l'enveloppe apparente — et le dénominateur bricolé

Sur les deux seuls appels où Orion possède à la fois l'enveloppe
affichée et les projets, le ratio naïf donne **5 100 %**
(`ERC-2026-POC`) et **1 000 %** (`HORIZON-EIC-2026-AIC`). La méthode
n'est pas en cause : le champ `budget_max_eur` est le montant **par
subvention**, pas l'enveloppe. Contre-exemple parfait du « dénominateur
bricolé » — prendre le champ qui s'appelle « budget » sans lire ce qu'il
contient se trompe d'un facteur 50.

**Quatre pièges de champ ont été trouvés pendant cette étude, et chacun
aurait produit un chiffre publié faux** :

| Piège | Erreur produite |
|---|---|
| Prendre `budget_max_eur` (montant **par subvention**) pour l'enveloppe d'un appel | ratio de **5 100 %** |
| Sommer `budget_overview.budgetTopicActionMap` sans dédupliquer par sujet — le montant est répété pour chaque **type d'action** du même sujet | **190 491 M€ au lieu de 5 479 M€ : facteur 34,8** sur les seuls appels clos de l'exercice 2026 |
| Joindre le profil annuel NSF au grain participation sans filtrer sur `source_uid` | **+17 %** de double compte (§ 8, Route D) |
| Lire `eurio:GrantPayment` / `hasPayment` du graphe CORDIS comme un échéancier — 422 007 instances dont le nom promet des paiements datés | **aucune date n'existe** : c'est la ventilation **par organisation**, pas par année (§ 4.4) |

Aucun de ces quatre n'est détectable à la lecture d'un nom de champ.
Trois d'entre eux portent même un nom qui affirme le contraire de ce
qu'ils contiennent. Ils ne se voient qu'en confrontant le chiffre à un
ordre de grandeur connu — ce qui est précisément l'exercice que R5A avait
pour mandat de faire avant toute implémentation.

### 17.6 NIH renouvelé annuellement

**64,8 % de la valeur NIH** est portée par des projets à **5 exercices
ou plus** ; 19,9 % par des projets à 10 ou plus ; maximum observé 21.
Le cas d'école reste `P51OD011092` : daté 1997, argent fiscalement
2012-2025.

### 17.7 Cofinancement national + UE, et contribution ≠ coût total

Le taux de financement UE médian est de 100 %, mais le décile inférieur
descend à **67,6 % (FP7)**, **70,0 % (H2020)**, **79,2 % (Horizon)** :
**42,6 % des projets FP7** ne sont pas financés à 100 % (30,1 % pour
H2020, 22,2 % pour Horizon). Agrégé, l'écart est massif — FP7 :
46,04 Md€ de contribution UE pour **65,74 Md€** de coût total.
Utiliser `total_cost` au numérateur d'un ratio de budget européen
diviserait de l'argent national et privé par un budget de l'Union.

### 17.8 Projet dont la valeur ne peut appartenir à son année

Le cas le plus net du corpus, déjà cité : **NSF `1755088`**, 975,89 M$
rattachés à 2018, **5,9 M$ réellement obligés cette année-là** — soit
**0,6 %**. Orion attribue à 2018 cent-soixante-cinq fois ce que la NSF y
a engagé.

### 17.9 Programme UE dont engagement et paiement sont très décalés

Le reste à liquider (RAL) le mesure officiellement : **28 440,8 M€ pour
Horizon Europe au 1ᵉʳ janvier 2025**, soit **plus de deux années** de
crédits d'engagement (12,8 Md€/an). Et **Horizon 2020, clos depuis fin
2020, portait encore 3 574,7 M€ de RAL au 1ᵉʳ janvier 2025** — cinq ans
de paiements après la fin du programme.

Le MGA confirme que le décalage est structurel : le préfinancement reste
« **property of the EU until the final payment** », 5 à 8 % sont retenus
par la mutuelle, et **au moins 10 % du montant ne peut être versé qu'au
solde**. Un ratio construit sur des crédits de paiement mesurerait donc
des projets signés jusqu'à cinq ans plus tôt.

### 17.10 Le ratio qui dépasse 100 % — trouvé sur les deux continents

C'était le contre-exemple demandé, et il apparaît **partout où l'on
cherche**, y compris sur les routes qui semblaient propres :

| Cas | Ratio |
|---|---:|
| Horizon Europe 2022, par date de signature ÷ CE adoptés | **136,3 %** |
| Horizon Europe 2023, par date de début ÷ CE adoptés | **121,3 %** |
| Horizon Europe 2024, par date de début ÷ CE adoptés | **103,3 %** |
| NSF FY2025, Route D ÷ obligations « Grants, subsidies, contributions » | **104,0 %** |
| NIH FY2023, somme naïve avec sous-projets ÷ appropriation | **102,7 %** |
| Appel `ERC-2026-POC`, ÷ `budget_max_eur` | **5 100 %** |

Six franchissements de 100 %, sur trois financeurs, avec des
dénominateurs tous officiels. Aucun n'est le signe d'une erreur de
calcul : chacun est le signe d'un **périmètre ou d'un axe de temps qui
ne correspond pas**.


---

## 18. Scénarios produit

Trois scénarios, dont un seul est retenu. **Aucun Scénario 1 par
défaut** : il est instruit puis écarté sur pièces.

### Scénario 1 — Mode global `% of R&D budget` sur EC + NIH + NSF

**Écarté.** Quatre raisons indépendantes, chacune suffisante à elle
seule :

1. **Les numérateurs ne sont pas la même grandeur** (§ 2.4) : engagement
   prévisionnel complet côté UE, cumul d'obligations partiellement
   observé côté américain. Prouvé empiriquement par la censure à droite
   (§ 2.1-2.2).
2. **Aucun dénominateur commun n'existe** (§ 3.3, § 7) : la seule
   grandeur internationalement comparable, GBARD, est incompatible avec
   les trois numérateurs, et **n'existe pas du tout pour les institutions
   de l'Union**.
3. **L'axe de temps ne se réconcilie pas** : la Route A est fausse d'un
   facteur ~5 côté NIH (§ 9.2) et de −40 à +123 % côté NSF (§ 8).
4. **La symétrie serait un mensonge de présentation** : trois barres,
   trois définitions, une seule légende (§ 10).

### Scénario 2 — Mode limité : **2a RETENU en contre-relecture**

Trois périmètres réduits ont été instruits. La première version de ce
rapport les écartait tous les trois ; la contre-relecture du 2026-08-26
a rouvert exclusivement le premier, et il **survit**.

**2a — NSF seul, Route D — RETENU.**
La première version l'écartait sur trois griefs de dénominateur, tous
levés par la contre-relecture :

- ✅ Numérateur irréprochable, inchangé : obligations publiées par la
  source, conservées dans Orion, ventilables à **99,99 %** par
  participation (§ 8, Route D).
- ✅ **Le dénominateur EST une série** : « Award Obligation Amount »,
  FY2011-FY2025, extraite le 2026-08-26 (§ 9.4.6). Le grief venait
  d'une extraction inaboutie, pas d'une absence.
- ✅ **L'ambiguïté des 18 points était un artefact de libellé** : elle
  n'existe que si la métrique dit « % NSF budget » sans nommer son
  dénominateur. En nommant les *award obligations*, il n'y a qu'un
  dénominateur, et la réconciliation passe (−1,17 % à −4,26 % sur les
  quatre FY testés, seuil ±5 % gravé avant calcul).
- ⚠️ Le grief restant est requalifié, pas levé : au grain « toute la
  NSF », le ratio (~96-98 % après réconciliation) reste une mesure de
  couverture (question 1.A). **La valeur analytique est aux grains
  inférieurs** — division, programme, État, organisation : « quelle
  part des obligations d'awards de la NSF cette sélection
  représente-t-elle ? » est la question 1.B, la seule retenue au § 1,
  enfin dotée d'un dénominateur propre.

Les limites du dénominateur (série restatée sans archives, pas de canal
machine, mise à jour annuelle) sont consignées au § 9.4.7 et deviennent
des clauses du contrat R5B (§ 20).

**2b — UE, ratio par cohorte d'appel (Route B).**
Comptablement le plus propre de toute l'étude — et **vide** :
**3 sujets sur 447** portent à la fois une enveloppe et des projets,
soit **13,7 M€ sur 176,4 Md€** (§ 8). Deux obstacles s'y ajoutent, du
côté du dénominateur cette fois : **aucun work programme ne couvre une
année civile** (2021-2022, puis 2023-2024 étendu à 2025, puis 2025-2027),
et le CER, l'EIC, l'EIT et Euratom relèvent de **décisions de financement
distinctes** — un « % du work programme » ne couvrirait donc qu'une part
du programme, sans que rien à l'écran ne le dise (§ 4.6).

**2c — GBARD sur certaines surfaces.**
Écarté au § 7, sur cinq axes indépendants dont deux rédhibitoires :
GBARD n'existe pas pour les institutions de l'Union, et son étape
comptable varie par pays sans être documentée (§ 12.43 recommande les
crédits finaux votés, la pratique va des crédits aux dépenses — § 7.1).

### Scénario 3 — Aucun mode budgétaire — retenu partout SAUF NSF

Pour la Commission européenne, le NIH, GBARD et tout axe global
multi-financeurs, la conclusion de la première version tient : **aucune
métrique `% of budget`**. Le NO-GO du mode global reste acquis (§ 10) ;
seul le périmètre NSF du scénario 2a passe, et il passe comme métrique
**explicitement différente**, jamais comme symétrie rétablie.

---

## 19. La métrique survivante — définition, statut, surfaces

Une seule métrique survit à l'étude, et elle est proposée ici sans mock
ni code, conformément à la consigne.

### 19.1 La règle de nommage, gravée d'abord

> Un libellé `% of budget` est **interdit**. Le nom doit dire ce que le
> dénominateur **est**. Trois dénominateurs différents ne partagent
> jamais un libellé.

### 19.2 La fiche de la métrique

| | |
|---|---|
| **Nom EN** | **Share of NSF award obligations** |
| **Nom FR (proposé, arbitrage fondatrice)** | Part des obligations annuelles d'awards NSF |
| **Question utilisateur** | « Quelle part des obligations annuelles de financement d'awards de la NSF cette sélection représente-t-elle ? » (question 1.B du § 1, enfin dotée d'un dénominateur propre) |
| **Numérateur** | Σ des obligations annuelles des awards sélectionnés pendant le FY. **Source gelée (§ 9.4.9)** : les lignes du snapshot officiel « @Award Details Sheet » (award × FY × obligation-du-FY), la jointure `Award ID` ↔ `source_uid` n'apportant que les dimensions d'Orion — jamais l'éligibilité. Les `oblg_fy` des archives sont un contrôle croisé |
| **Dénominateur** | « Award Obligation Amount » (*NSF by the Numbers*), millésime daté, table de référence versionnée |
| **Formule (un FY)** | `100 × Σ obligations sélectionnées(FY) / Award Obligation Amount officiel(FY)` — même FY, même périmètre des deux côtés |
| **Formule (plusieurs FY)** | `100 × Σ obligations sur la période / Σ dénominateurs officiels correspondants` — **ratio des sommes, jamais moyenne arithmétique des pourcentages annuels** (même doctrine que R3) |
| **Unité** | % des obligations d'awards NSF de l'exercice (ou de la période) |
| **Axe de temps** | **Exercice fédéral d'obligation (FY)**, jamais `project.start_year` ni l'année civile ; du premier FY commun (2011) au dernier FY clos des deux côtés. Contrat URL : paramètre **`fy=`** propre à la surface (§ 19.4) |
| **Devise** | USD natif, **aucun FX, aucune déflation** (§ 12) |
| **Perspective** | Financeur, forcée — le dénominateur est un flux de la NSF |
| **Surfaces autorisées** | Vues cadrées sur le financeur NSF : par division/programme, par État ou pays bénéficiaire (libellé de **destination**, § 13), par organisation ; série temporelle par FY |
| **Surfaces interdites** | Toute vue multi-financeurs ; tout axe en année civile ; le **donut et la carte en part-du-tout** (les parts visibles ne bouclent pas à 100 % du dénominateur officiel — dilemme du § 13, tranché : le total ne boucle pas et doit le dire) ; l'exercice en cours |
| **Avertissement comptable (`ⓘ`)** | « Numerator: annual obligations as published by NSF for each award. Denominator: NSF's official *Award Obligation Amount* series (*NSF by the Numbers*, vintage {date}), which NSF restates over time. Orion's coverage of that series is measured at ≈ 95-98 % depending on the year; the gap is data Orion does not see, not "other awards". » |
| **URL** | Surface dédiée, grammaire propre, **hors** famille `value=` du Reference Engine ; l'axe temporel s'écrit **`fy=`** (ex. `fy=2019..2024`), jamais `time=` (§ 19.4) |

### 19.3 Métrique indépendante, pas un Reference mode — arbitrage

Présomption de contre-relecture : métrique indépendante. **Confirmée**,
pour cinq raisons dont les quatre du § 14.2 et une cinquième, décisive :

1. **Le numérateur change.** Tous les modes du Reference Engine
   transforment la valeur des **mêmes cohortes** (convention ③,
   `start_date`) ; cette métrique compte autre chose — les obligations
   par exercice (Route D). Un sélecteur de lecture qui changerait
   silencieusement *ce qui est compté* violerait sa promesse fondatrice
   (« comment on regarde, jamais qui — ni ce qu'on — regarde »).
2. L'axe est l'exercice fédéral, contre la convention ③ (année civile).
3. La devise est le USD natif sans FX, contre la convention ④.
4. Elle n'existe que pour **un financeur** — un mode qui n'apparaît que
   sur les vues NSF n'est pas un mode, c'est une surface.
5. Le dénominateur est attaché au financeur, pas à l'entité regardée
   (§ 14.2).

Conséquences : **aucune entrée dans « View funding as »**, aucun
paramètre `value=`. Le § D12 de R0 n'est donc pas « rouvert » : le
Reference Engine ne gagne aucun mode budgétaire — Orion gagne une
métrique séparée.

**Ce que la métrique n'est pas**, pour que personne ne l'y ramène : ce
n'est pas un « % NSF budget » (le dénominateur n'est pas un budget),
pas un mode Reference, pas du nominal/real/PPP, et **pas une
transformation du montant projet** — le numérateur est une autre
grandeur, comptée sur un autre axe.

### 19.4 Sémantique temporelle — le contrat qui interdit l'ambiguïté

Le risque nommé par l'amendement : qu'un même `time=2024` signifie
« année civile de début » dans l'Explorateur et « exercice fédéral
d'obligation » sur cette surface. La solution retenue est la moins
ambiguë des deux possibles — **deux paramètres, deux mondes,
étanches** :

1. **`time=` garde partout son sens actuel** (année civile de
   `start_date`, convention ③) et **n'existe pas** sur la surface R5 —
   une URL de la surface portant `time=` est rejetée (400), jamais
   réinterprétée.
2. **`fy=` est le seul axe temporel de la surface R5** (`fy=2023`,
   `fy=2019..2024`) et **n'existe sur aucune autre surface** — même
   règle de rejet en face.
3. Tout libellé d'axe, d'en-tête CSV, de deck et de `ⓘ` écrit
   « **FY 2024** », jamais « 2024 » nu ; la définition (« U.S. federal
   fiscal year: Oct 1 – Sep 30, labeled by end year ») est dans le `ⓘ`.

L'alternative (réutiliser `time=` avec un qualificateur) est rejetée :
elle rendrait deux URL visuellement identiques et sémantiquement
différentes — exactement l'ambiguïté silencieuse interdite.

### 19.5 Le Top de la surface — les obligations elles-mêmes

R5 change le numérateur : la doctrine « Top nominal stable sous
Reference » **ne s'applique pas ici**, et il faut le dire explicitement
pour que l'exception apparente n'en soit pas une. Cette doctrine
protège une promesse précise — *un sélecteur de lecture ne change pas
qui on regarde* — qui n'a de sens que quand on bascule entre modes
d'une même surface. La surface R5 n'a pas de sélecteur de lecture :
elle pose une autre question, sur une autre grandeur.

> **Règle gelée** : le Top de la surface R5 se classe par les
> **obligations R5 elles-mêmes** — « qui reçoit les plus fortes
> obligations NSF pendant le FY ou la période sélectionnés ». Un
> classement par montants attribués (`start_date`) sur cette surface
> mentirait deux fois : mauvais axe, mauvaise grandeur.

Ce n'est **pas** une exception à R0 § D12 ni à la doctrine R3/R4 : R5
n'est pas un Reference mode (§ 19.3), donc la règle du Top nominal ne
le régit pas.

### 19.6 Disponibilité — les cinq conditions, et rien d'autre

La métrique n'existe, pour un FY donné, que si **toutes** ces
conditions tiennent :

1. la vue est cadrée sur le financeur **NSF** ;
2. le FY est **couvert par le millésime officiel** chargé ;
3. le **périmètre est compatible** (prédicat du § 9.4.9 : chaque ligne
   du numérateur provient du snapshot officiel du millésime) ;
4. la **réconciliation du millésime courant est dans le seuil** pour ce
   FY (§ 20.1) ;
5. le **numérateur de la sélection est non vide**.

Refus, jamais d'approximation : **jamais de zéro** pour une référence
absente, **jamais de repli** vers une appropriation ou un « budget
NSF », un exercice futur ou en cours est simplement **indisponible**
(mécanique des refus nommés de R0 § D13, motifs propres à la surface).

---

## 20. Suites — ce qui est décidé, et ce qui rouvrirait la porte

### 20.1 Le CONTRAT R5B — gelé par l'amendement final (2026-08-26)

Le GO porte sur **la seule métrique du § 19.2** (*Share of NSF award
obligations*), comme **métrique indépendante** (§ 19.3). Le contrat
ci-dessous est **gelé** : il ne reste aucune décision méthodologique à
prendre pour l'implémenter. Rien ne se code avant l'arbitrage
fondatrice de ce rapport amendé.

#### C1 — L'inspection qui a tranché la source du numérateur

L'amendement exigeait d'inspecter le Crosstab « Details » avant de
choisir. Mesuré le 2026-08-26 (session Tableau invitée, export
Download → Crosstab lu octet par octet) :

- l'onglet **Details** existe ; sa feuille exportable s'appelle
  « **@New Awards Details** » ; format déclaré « CSV », en réalité
  **tabulé UTF-16LE** ;
- **22 colonnes**, dont `Award ID`, `Fiscal Year`, `Award Instrument`,
  `Directorate`, dates d'effet, et le montant « **Award Obligation to
  Date** » ;
- grain : **une ligne = un award**, la population d'un FY étant les
  **new awards** de ce FY (8 378 lignes pour FY2025 = exactement le
  compteur « New Awards Funded 2025 ») ; pas de plafond d'export
  observé (~19 400 lignes / 19 Mo testés) ;
- les Crosstabs de « Trends » et « Numbers by State » ne rendent que
  des **agrégats** — dont la feuille « **Trend-Awards Obligated
  Amount** », qui est la série du dénominateur elle-même.

**Lecture corrigée par l'ultime verrou (§ 9.4.9)** : cette première
inspection avait exporté la feuille de la métrique « New Awards
Funded » (« @New Awards Details », cumul à date par new award). Sous la
métrique **« Award Obligation »**, la page Details expose une autre
feuille — **« @Award Details Sheet »**, 31 colonnes — qui est la table
**award × FY × obligation-du-FY** elle-même, increments prior-year
inclus. La clause de préférence de l'amendement s'applique donc.

**Décision gelée (§ 9.4.9)** :

> **Numérateur ET dénominateur proviennent du même artefact officiel**
> — le snapshot « @Award Details Sheet » du millésime (un export par
> FY). Dénominateur d'un FY = Σ de toutes ses lignes ; numérateur
> d'une sélection = Σ des lignes jointes à la sélection par
> `Award ID` ↔ `source_uid`. L'éligibilité est la **présence dans le
> snapshot**, jamais une règle Orion. Contrôle de cohérence interne à
> chaque millésime : Σ du snapshot d'un FY ↔ valeur « Award
> Obligation Amount » de la série Trends du même millésime.
> **Les `oblg_fy` des archives deviennent un contrôle croisé** (C4) —
> ils sont d'ailleurs démontrés partiellement périmés (§ 9.4.9,
> cas 1902627).

#### C2 — Le pipeline du dénominateur (plus aucune transcription manuelle)

```text
official downloaded artifact        (Download → Crosstab, Excel ou CSV/TSV)
  → immutable raw snapshot          (fichier brut, jamais réécrit)
  → SHA256                          (calculé à l'acquisition, stocké)
  → deterministic parser            (UTF-16LE tabulé ; montants « $8 653,72M » → entiers)
  → validated reference vintage     (table append-only, dernière vintage gagne)
```

- Artefacts à acquérir par millésime : **un export « @Award Details
  Sheet » par FY** (métrique « Award Obligation » sélectionnée sur
  Numbers by State, filtre Fiscal Year posé, ~10-15 k lignes par FY —
  aucun plafond rencontré à 19 400 lignes), plus le Crosstab de
  contrôle « **Trend-Awards Obligated Amount** » (série agrégée,
  FY2016+) et, pour FY2011-FY2015, le KPI « Award Obligation » par
  exercice filtré. Toute matérialisation locale va exclusivement sous
  `<ORION_ROOT>/.research-downloads/r5/nsf/` tant qu'elle est un
  fichier de travail ; la promotion vers le répertoire de provenance
  R5B est une décision explicite (consigne fondatrice du 2026-08-26).
- Si le téléchargement ne peut pas être automatisé à cause de Tableau,
  un **téléchargement manuel de l'artefact** est accepté ; une
  **transcription manuelle de valeurs est interdite** dans tous les
  cas.
- Conservés pour chaque millésime : URL source ; date/heure
  d'acquisition ; **version du codebook** (v1.0.7 aujourd'hui) ;
  fichier brut ; SHA256 ; série extraite ; journal de validation.
- Validation à l'entrée : la série extraite du nouvel artefact est
  comparée au millésime précédent ; toute révision d'une valeur passée
  est **consignée comme restatement**, jamais écrasée en silence
  (§ 9.4.7-1 : Orion devient de facto l'archive publique de cette
  série — à dire sur `/about-data`).
- Contrôle de non-régression du lot 1 : la série extraite du premier
  artefact doit reproduire les quinze valeurs lues à l'écran au
  § 9.4.6, ou l'écart est investigué avant toute suite.

#### C3 — La réconciliation par millésime de production

Stocké pour **chaque** vintage, par FY :

```text
official_total | orion_observed_total | absolute_gap | relative_gap
| coverage | vintage dates (artefact, snapshot Orion, codebook)
```

- Le **±5 % est le seuil ex ante qui a permis à la route de survivre
  (§ 9.4.4) — il n'est jamais une précision revendiquée**. La précision
  revendicable est la couverture mesurée du millésime (≈ 95-98 % selon
  l'exercice au périmètre gelé, § 9.4.8).
- **Interdits** : multiplier les valeurs Orion pour atteindre 100 % ;
  toute normalisation implicite ; masquer l'écart. La couverture
  s'affiche.
- **Si la couverture d'un FY sort du seuil, la métrique devient
  indisponible pour ce FY** — elle se ferme, elle ne s'ajuste pas.
  (FY2012 est déjà à −5,11 % au périmètre gelé : si la surface descend
  un jour sous FY2013, ce FY naîtra indisponible.)
- Langage : l'écart est « **compatible avec** les différences de
  snapshot/restatements » tant que la preuve award par award (C4) ne
  l'a pas établi.

#### C4 — Les contrôles award par award (lot 1, puis chaque millésime)

La question d'instruments est **tranchée** (§ 9.4.9 — inclus, sur
preuve ; le point du contrat qui pouvait rouvrir a rouvert et s'est
refermé sur pièces). Restent trois contrôles :

1. **Couverture de jointure par FY** : part du dénominateur (lignes du
   snapshot) sans correspondant `source_uid` chez Orion — exposée, et
   **> 5 % → FY indisponible** pour les sélections dimensionnelles.
2. **Contrôle croisé `oblg_fy`** : |montant snapshot − montant
   `oblg_fy`| par award × FY joint ; les écarts sont des restatements
   ou des retards de bulk (cas démontré : 1902627), journalisés,
   jamais corrigés à la main.
3. Anomalies de comptage à vérifier : l'export « New Awards » FY2023
   portait 6 lignes de plus que le compteur agrégé ; vérifier
   l'équivalent côté « @Award Details Sheet » (Σ lignes ↔ série
   Trends).

#### C5 — Données, surface, refus

- **Numérateur et dénominateur** : table versionnée des lignes du
  snapshot officiel (C2), jointe à `participations.source_uid` ; même
  discipline de millésime que `price_indices`.
- **Contrôle croisé matérialisé** : les tranches `{fy, amount,
  instrument}` sortent de `raw.fiscal_years` vers une table requêtable
  (une lecture du corpus existant, pas une re-ingestion) — au service
  de C4-2, plus comme source.
- **Surface dédiée** : grammaire `fy=` (§ 19.4), Top par obligations R5
  (§ 19.5), disponibilité par les cinq conditions du § 19.6, formules
  du § 19.2 (ratio des sommes en multi-FY). Refus nommés, jamais de
  zéro, jamais de repli.
- **Registre** : la source « NSF by the Numbers — Award Obligation
  Amount » entre dans `docs/data-sources.md` au premier artefact
  acquis, avec URL, licence (régime des données fédérales, § 9.4.7-3),
  cadence annuelle et la mention de restatement.
- **Recette** : re-jouer § 9.4.6/§ 9.4.8 depuis l'artefact ;
  vérification C4-1 ; les cinq refus du § 19.6 testés un à un ;
  checklist design et recette Firefox comme pour tout lot.

*Hors lot, inchangé* : toute extension EC/NIH (conditions § 20.4), tout
raccordement au sélecteur « View funding as » (§ 19.3), tout donut ou
carte en part-du-tout (§ 19.2), toute lecture en année civile.

*Risques nommés* : la série officielle est restatée sans archives (C2
en fait l'archivage) ; le format « CSV »-UTF-16LE peut changer sans
préavis (le parseur échoue bruyamment, jamais silencieusement) ; le
libellé FR reste un arbitrage fondatrice.

### 20.2 Amendement R0 — une hypothèse existante à corriger

C'est le seul amendement que cette étude rend nécessaire, et il est
substantiel. Le § D12 de `docs/conception-reference-engine.md` affirme
aujourd'hui :

> « Orion observe des **cohortes d'engagement** — des montants totaux
> pluriannuels rattachés à l'année civile de début du projet
> (conventions ①②③). »

**C'est vrai pour CORDIS et faux pour NIH et NSF**, qui représentent
**76 % du corpus en valeur**. Mesuré : 93,91 % des attributions NSF
valent exactement la somme de leurs obligations annuelles **déjà
constatées**, et le montant NIH est la somme des tranches d'exercices
**déjà publiées**. Ces deux-là ne sont pas des engagements : ce sont des
cumuls d'obligations, tronqués à droite par le présent — et à gauche,
côté NIH, par la fenêtre FY2005.

La formulation exacte proposée pour remplacer la phrase du § D12 :

> Orion additionne **deux grandeurs comptables distinctes** sous une même
> colonne `funding_amount` : un **engagement prévisionnel plafonné**,
> complet dès la signature (CORDIS `ecMaxContribution`), et un **cumul
> d'obligations déjà constatées**, qui se remplit exercice après exercice
> (NIH, NSF). Cette colonne répond correctement à « combien a été
> attribué à ce projet » — la question du mode `nominal`. Elle ne peut
> pas servir de numérateur à un ratio budgétaire, qui exige de savoir
> *quand* l'argent a été engagé.

La conséquence pratique est déjà nommée dans R4 (§ 1.3), qui s'appuyait
sur la formulation ancienne : elle reste valide dans sa conclusion (le
PPP ne compare pas des flux monétaires) mais son prémisse doit être
corrigée dans les mêmes termes.

### 20.3 Trois gestes conservatoires, à peser séparément

Aucun n'est un R5B. Chacun est un petit chantier autonome, qui préserve
une option sans rien construire.

| Geste | Ce qu'il préserve | Coût | Urgence |
|---|---|---|---|
| **① Conserver le profil annuel NIH** — garder `(fy, total_cost)` dans `raw` au repli, comme NSF le fait déjà | Rend la Route D possible côté NIH ; supprime l'asymétrie entre les deux sources américaines | Faible : **les 961 Mo d'archives sont déjà en cache local**, c'est un changement de repli + une ré-ingestion | **Moyenne** — le coût ne fera qu'augmenter |
| **② Vérifier que la moisson d'appels capte l'enveloppe** — 308 des 447 sujets recoupant nos projets n'ont **aucun** bloc budget | Rend la Route B possible d'ici 2-3 ans, quand les appels archivés auront produit leurs projets | Faible : c'est une vérification d'ingestion, pas une source nouvelle | **Haute** — chaque appel qui passe sans son budget est définitivement perdu |
| **③ Trancher les deux réserves NIH** du 2026-08-03 (projets « parapluie », projets sans date) | Assainit le numérateur pour tout usage futur, budgétaire ou non | Décision fondatrice + marquage | Moyenne — indépendante de R5 |

### 20.4 Les conditions exactes d'un élargissement au-delà de NSF

La condition NSF de la première version est **remplie** (la série
existait, elle a été extraite et réconciliée — § 9.4) : c'est elle qui
fonde le GO du § 21. L'élargissement à d'autres financeurs reste fermé
tant que l'une de ces conditions n'est pas remplie — vérification
écrite d'avance, pas à improviser :

1. **Côté UE — le recouvrement enveloppe ↔ projets dépasse un seuil
   écrit d'avance.** Proposition : **au moins 30 % de la valeur CORDIS
   d'une année** rattachable à un sujet dont l'enveloppe est archivée.
   Aujourd'hui 0,008 %. La requête de contrôle est en annexe (§ 22.H).
2. **Côté NIH — le profil annuel est conservé** (geste ①), puis une
   réconciliation contre une série officielle d'obligations d'awards
   NIH (candidat : RePORT #106, § 5.3) passe un seuil gravé d'avance,
   sur le modèle du § 9.4.

Aucune de ces deux conditions n'est remplie au 2026-08-26.

---

## 21. Verdict

Une métrique budgétaire exige trois choses simultanées : un numérateur
dont on sait **quand** il a été engagé, un dénominateur de la **même
famille comptable**, et un **périmètre superposable**. L'étude a cherché
ce triplet sur quatre routes, trois financeurs et huit dénominateurs
candidats — puis la contre-relecture l'a re-cherché là où la première
version avait renoncé trop tôt.

- Le **numérateur** est bon. Il est même **exact** côté européen :
  68,334 Md€ contre 68,3 Md€ à l'évaluation ex-post officielle de
  Horizon 2020 (§ 4.2). Et côté NSF il est excellent : profil annuel
  publié par la source, conservé, ventilable à 99,99 %.
- Le **dénominateur** manque partout **sauf un** : GBARD est
  inexistant pour les institutions de l'Union, non désagrégeable par
  agence, et d'étape comptable variable et non documentée pays par pays
  (§ 7.1) ; la Commission ne publie aucun profil annuel par projet, et
  le FTS explique pourquoi ; les enveloppes d'appel européennes ne
  recouvrent que 0,008 % du corpus ; le profil annuel NIH a été jeté à
  l'ingestion. **L'exception est la NSF** : la série « Award Obligation
  Amount » a la définition exacte du numérateur d'Orion, elle a été
  extraite (FY2011-FY2025), et **la réconciliation passe** le seuil
  ±5 % gravé avant calcul — quatre exercices testés entre −1,17 % et
  −4,26 %, quinze années au même signe (§ 9.4.6), confirmée au périmètre officiellement démontré par l'ultime verrou (§ 9.4.9 : gaps de −1,45 % à −4,26 % sur les quatre FY, unclassified vide) — verrou conclu **`R5B READY`**.
- Le **périmètre** ne se superpose nulle part ailleurs : 0,90 % du
  numérateur « NIH » n'est pas du NIH, les supplementals sont exclus
  des séries NIH mais inclus des séries NSF, et le FTS européen déclare
  plus d'engagements que le budget n'a voté de crédits.

Ce qu'un ratio publié aurait raconté hors de ce périmètre, on le sait
précisément : un « % du budget Horizon Europe » oscillant entre
**6,9 % et 136,3 %** selon l'année, **indéfini** sur 10,05 Md€ de
cohortes H2020 tombées hors du cadre, **19 % là où la réponse est 93 %**
côté NIH, un pic NSF 2018 de **+28 %** qui n'a jamais eu lieu (par la
Route A — celle que la métrique retenue n'utilise pas), une année 2021
composée **à 89 % de projets H2020** — et quatre pièges de champ dont
trois portent un nom qui affirme le contraire de ce qu'ils contiennent.

Le cas d'EUROfusion résume le versant fermé du chantier en une ligne :
Orion en porte **678,8 M€**, exactement le montant que la Commission
publie — et les place en 2014, année où **10,9 %** seulement ont été
engagés.

**`GO R5B avec périmètre réduit`**

Le périmètre du GO est étroit et entièrement nommé : **une seule
métrique** — *Share of NSF award obligations* (§ 19.2) — sur **un seul
financeur**, en **métrique indépendante** hors du Reference Engine
(§ 19.3), sous le contrat de validité du § 20.1 (millésime daté,
ré-réconciliation au seuil à chaque mise à jour, fermeture si elle
casse). Tout le reste demeure fermé : **le mode global est NO-GO**, EC
et NIH sont NO-GO (conditions d'élargissement chiffrées au § 20.4),
GBARD est écarté. Le § D12 de R0 reste fermé pour le Reference Engine —
le GO ne lui ajoute aucun mode.

Ce verdict est daté, chiffré, rejouable (§ 22), et il doit sa forme à
la contre-relecture : la première version concluait NO-GO parce qu'une
extraction avait échoué et qu'un artefact de libellé avait été lu comme
une ambiguïté comptable. Les deux corrections sont consignées (§ 9.1,
§ 9.4.6), comme les quatre corrections factuelles (§ 7.1, § 6.4,
§ 4.1, § 4.5). Le geste ② du § 20.3 reste le plus urgent — chaque appel
européen qui quitte le portail sans que son enveloppe soit archivée
referme un peu plus la seule route qui, côté UE, était comptablement
propre.

---

## 22. Annexe — rejouer toutes les mesures

**Conditions exactes des mesures de ce document** : jouées le
2026-08-26 sur la base locale `orion` (corpus du dump de production du
2026-08-21, dernière ingestion des sources le **2026-08-04**), 699 798
projets. Aucune mesure n'a été faite sur la production.

*Note de millésime* : les chiffres CORDIS recalculés en parallèle sur le
jeu officiel (snapshot du 06/08/2026) donnent 62,42 Md€ / 23 451 projets
pour Horizon Europe, contre 62,05 Md€ / 23 278 dans notre corpus du
04/08 — l'écart est celui de deux jours d'ingestion sur un programme
vivant, pas une divergence de méthode. Les totaux H2020, sur un
programme clos, sont **identiques** (68,33 Md€).

Mise en route :

```bash
colima start && make db-up
```

Toutes les requêtes se jouent ainsi :

```bash
docker exec orion-dev-postgres-1 psql -U orion -d orion -c "<REQUÊTE>"
```

### A. Corpus et volumétrie (§ 2.0)

```sql
SELECT f.name AS funder, p.source, count(*) AS projets,
       count(p.start_date) AS avec_date, count(p.funding_amount) AS avec_montant,
       round(sum(p.funding_amount_eur)/1e9, 2) AS total_md_eur,
       min(p.start_date), max(p.start_date), max(p.funding_currency)
FROM projects p JOIN funders f ON f.id = p.funder_id
GROUP BY 1,2 ORDER BY 6 DESC NULLS LAST;
```

### B. Durées et poids du pluriannuel (§ 2.5)

```sql
WITH d AS (
  SELECT source, funding_amount_eur AS m, (end_date - start_date)/365.25 AS annees
  FROM projects
  WHERE start_date IS NOT NULL AND end_date IS NOT NULL AND funding_amount_eur IS NOT NULL)
SELECT source, count(*) AS n,
       round((percentile_cont(0.5) WITHIN GROUP (ORDER BY annees))::numeric,2) AS mediane,
       round(100.0*sum(m) FILTER (WHERE annees > 1.0)/sum(m),1) AS pct_valeur_pluriannuelle,
       round(100.0*sum(m) FILTER (WHERE annees > 3.0)/sum(m),1) AS pct_valeur_plus_3ans
FROM d GROUP BY 1 ORDER BY 1;
```

### C. NIH — écart entre année de début et exercices réels (§ 2.2)

```sql
WITH x AS (
  SELECT funding_amount AS m, extract(year FROM start_date)::int AS an_debut,
         (SELECT min(v::int) FROM jsonb_array_elements_text(raw->'fiscal_years') v) AS fy_min
  FROM projects
  WHERE source='nih' AND start_date IS NOT NULL AND funding_amount IS NOT NULL
    AND jsonb_typeof(raw->'fiscal_years')='array')
SELECT round(sum(m)/1e9,2) AS total_md_usd,
       round(100.0*sum(m) FILTER (WHERE fy_min <> an_debut)/sum(m),1) AS pct_1re_fy_differente,
       round(100.0*sum(m) FILTER (WHERE fy_min > an_debut + 1)/sum(m),1) AS pct_ecart_sup_1an,
       round(100.0*sum(m) FILTER (WHERE fy_min > an_debut + 5)/sum(m),1) AS pct_ecart_sup_5ans
FROM x;
```

### D. NSF — part réellement obligée l'année de début, et effet de l'axe fiscal (§ 2.3, § 11.1)

```sql
WITH slices AS (
  SELECT extract(year FROM p.start_date)::int AS an_civil,
         CASE WHEN extract(month FROM p.start_date) >= 10
              THEN extract(year FROM p.start_date)::int + 1
              ELSE extract(year FROM p.start_date)::int END AS fy_debut,
         (s.value->>'fy')::int AS fy, (s.value->>'amount')::numeric AS montant
  FROM projects p
  CROSS JOIN LATERAL jsonb_each(p.raw->'fiscal_years') AS awards(k, v)
  CROSS JOIN LATERAL jsonb_array_elements(awards.v) AS s(value)
  WHERE p.source='nsf' AND p.start_date IS NOT NULL AND p.funding_amount IS NOT NULL)
SELECT round(sum(montant)/1e9,3) AS total_oblig_md,
       round(100.0*sum(montant) FILTER (WHERE fy = an_civil)/sum(montant),2) AS pct_annee_civile,
       round(100.0*sum(montant) FILTER (WHERE fy = fy_debut)/sum(montant),2) AS pct_fy_debut,
       round(100.0*sum(montant) FILTER (WHERE fy > fy_debut + 1)/sum(montant),2) AS pct_plus_1an_apres,
       round(100.0*sum(montant) FILTER (WHERE fy > fy_debut + 3)/sum(montant),2) AS pct_plus_3ans_apres
FROM slices;
```

### E. Route A contre Route D, série annuelle NSF (§ 8, § 9)

```sql
WITH slices AS (
  SELECT (s.value->>'fy')::int AS fy, (s.value->>'amount')::numeric AS montant
  FROM projects p
  CROSS JOIN LATERAL jsonb_each(p.raw->'fiscal_years') AS aw(k, v)
  CROSS JOIN LATERAL jsonb_array_elements(aw.v) AS s(value)
  WHERE p.source='nsf' AND p.start_date IS NOT NULL AND p.funding_amount IS NOT NULL),
routeD AS (SELECT fy AS annee, sum(montant) AS d FROM slices WHERE fy BETWEEN 2005 AND 2026 GROUP BY 1),
routeA AS (SELECT extract(year FROM start_date)::int AS annee, sum(funding_amount) AS a
           FROM projects WHERE source='nsf' AND start_date IS NOT NULL
             AND extract(year FROM start_date) BETWEEN 2005 AND 2026 GROUP BY 1)
SELECT coalesce(a.annee,d.annee) AS annee,
       round(a.a/1e9,3) AS route_A_md_usd, round(d.d/1e9,3) AS route_D_md_usd,
       round(100.0*(a.a-d.d)/nullif(d.d,0),1) AS ecart_pct
FROM routeA a FULL JOIN routeD d USING (annee) ORDER BY 1;
```

### F. Route C — l'effet de bord (§ 8)

```sql
WITH slices AS (
  SELECT (s.value->>'fy')::int AS fy, (s.value->>'amount')::numeric AS montant
  FROM projects p CROSS JOIN LATERAL jsonb_each(p.raw->'fiscal_years') AS aw(k,v)
  CROSS JOIN LATERAL jsonb_array_elements(aw.v) AS s(value)
  WHERE p.source='nsf' AND p.start_date IS NOT NULL AND p.funding_amount IS NOT NULL),
a AS (SELECT extract(year FROM start_date)::int AS an, sum(funding_amount) AS v
      FROM projects WHERE source='nsf' AND start_date IS NOT NULL GROUP BY 1),
d AS (SELECT fy AS an, sum(montant) AS v FROM slices GROUP BY 1),
f AS (SELECT * FROM (VALUES (2005,2015),(2015,2025),(2010,2020),(2008,2018),(2005,2025)) AS t(deb,fin))
SELECT deb||'-'||fin AS fenetre,
       round((SELECT sum(v) FROM a WHERE an BETWEEN deb AND fin)/1e9,3) AS route_A,
       round((SELECT sum(v) FROM d WHERE an BETWEEN deb AND fin)/1e9,3) AS route_D,
       round(100.0*((SELECT sum(v) FROM a WHERE an BETWEEN deb AND fin)
             -(SELECT sum(v) FROM d WHERE an BETWEEN deb AND fin))
             /(SELECT sum(v) FROM d WHERE an BETWEEN deb AND fin),1) AS ecart_pct
FROM f;
```

### G. CORDIS — signature contre démarrage (§ 11.2)

```sql
WITH x AS (
  SELECT source, funding_amount AS m,
         extract(year FROM start_date)::int AS an_start,
         extract(year FROM (raw->>'ecSignatureDate')::date)::int AS an_sign,
         ((raw->>'ecSignatureDate')::date - start_date) AS jours
  FROM projects WHERE source LIKE 'cordis%' AND start_date IS NOT NULL
    AND nullif(raw->>'ecSignatureDate','') IS NOT NULL)
SELECT source, count(*) AS n,
       round(100.0*sum(m) FILTER (WHERE an_sign = an_start)/sum(m),1) AS pct_val_meme_annee,
       round(avg(jours)::numeric,0) AS ecart_moy_jours,
       round((percentile_cont(0.5) WITHIN GROUP (ORDER BY jours))::numeric,0) AS mediane_jours
FROM x GROUP BY 1 ORDER BY 1;
```

### H. Route B — le recouvrement enveloppes ↔ projets (§ 8)

```sql
WITH budgets AS (
  SELECT call_code, sum(budget_max_eur) AS budget FROM call_topics
  WHERE call_code IS NOT NULL AND budget_max_eur IS NOT NULL GROUP BY 1),
orion AS (
  SELECT raw->>'masterCall' AS call_code, count(*) AS n, sum(funding_amount) AS m
  FROM projects WHERE source LIKE 'cordis%' AND nullif(raw->>'masterCall','') IS NOT NULL GROUP BY 1)
SELECT count(*) AS call_codes_avec_budget,
       count(*) FILTER (WHERE o.call_code IS NOT NULL) AS aussi_dans_orion,
       coalesce(sum(o.n),0) AS projets_couverts,
       round(coalesce(sum(o.m),0)/1e6,1) AS valeur_couverte_m_eur
FROM budgets b LEFT JOIN orion o USING (call_code);
```

### I. Étalement d'un appel sur plusieurs années civiles (§ 8, Route B)

```sql
WITH c AS (
  SELECT source, raw->>'masterCall' AS appel, sum(funding_amount) AS m,
         max(extract(year FROM start_date)) - min(extract(year FROM start_date)) AS etalement
  FROM projects WHERE source IN ('cordis-h2020','cordis-horizon')
    AND nullif(raw->>'masterCall','') IS NOT NULL AND start_date IS NOT NULL
  GROUP BY 1,2)
SELECT source, count(*) AS appels,
       round(100.0*sum(m) FILTER (WHERE etalement = 0)/sum(m),1) AS pct_val_appels_1_annee,
       round(100.0*sum(m) FILTER (WHERE etalement >= 2)/sum(m),1) AS pct_val_appels_3ans_ou_plus,
       max(etalement) AS etalement_max
FROM c GROUP BY 1;
```

### J. Censure à droite (§ 2.1, § 2.2)

```sql
SELECT source, extract(year FROM start_date)::int AS annee_debut,
       round(sum(funding_amount)/1e9,2) AS md_natif,
       round(100.0*sum(funding_amount) FILTER (WHERE end_date > CURRENT_DATE)/sum(funding_amount),1)
         AS pct_valeur_encore_en_cours
FROM projects
WHERE source IN ('nih','nsf','cordis-horizon') AND start_date IS NOT NULL
  AND end_date IS NOT NULL AND funding_amount IS NOT NULL
  AND extract(year FROM start_date) BETWEEN 2018 AND 2025
GROUP BY 1,2 ORDER BY 1,2;
```

### K. Exclusions, parapluies, COVID (§ 15, § 17)

```sql
-- valeur sans date
SELECT source, round(sum(funding_amount) FILTER (WHERE start_date IS NULL)/1e9,2) AS md_sans_date,
       round(100.0*sum(funding_amount) FILTER (WHERE start_date IS NULL)/sum(funding_amount),2) AS pct,
       round(sum(funding_amount)/1e9,2) AS total_md_natif
FROM projects WHERE funding_amount IS NOT NULL GROUP BY 1 ORDER BY 1;

-- poids des « parapluies » NIH dans les cohortes
WITH x AS (SELECT extract(year FROM start_date)::int AS an, funding_amount AS m,
                  (raw->>'award_years')::int AS tranches
           FROM projects WHERE source='nih' AND start_date IS NOT NULL AND funding_amount IS NOT NULL)
SELECT an, round(sum(m)/1e9,2) AS cohorte_md_usd,
       round(100.0*sum(m) FILTER (WHERE tranches > 50)/sum(m),1) AS pct_parapluies
FROM x WHERE an BETWEEN 2005 AND 2020 GROUP BY 1 ORDER BY 3 DESC NULLS LAST;

-- poids du COVID dans les cohortes NIH
SELECT extract(year FROM start_date)::int AS an, round(sum(funding_amount)/1e9,3) AS cohorte_md,
       round(100.0*sum(funding_amount) FILTER (WHERE title ILIKE '%COVID%' OR title ILIKE '%SARS-CoV%'
             OR title ILIKE '%ACTIV %' OR title ILIKE '%RADx%')/sum(funding_amount),1) AS pct_covid
FROM projects WHERE source='nih' AND extract(year FROM start_date) BETWEEN 2018 AND 2022
GROUP BY 1 ORDER BY 1;
```

### L. Contribution UE contre coût total (§ 17.7)

```sql
SELECT source, round(sum(funding_amount)/1e9,2) AS contribution_md,
       round(sum(total_cost)/1e9,2) AS cout_total_md,
       round(100.0*sum(funding_amount)/nullif(sum(total_cost),0),1) AS taux_financement_pct
FROM projects WHERE source LIKE 'cordis%' GROUP BY 1 ORDER BY 1;
```

### M. Le profil annuel NSF ventilé par participation (§ 8, Route D)

La jointure obligatoire est `raw->'fiscal_years'->pa.source_uid`. **Sans
le filtre par `source_uid`, le total gonfle de 17 %.**

```sql
WITH j AS (
  SELECT pa.country_code AS pays, (e->>'fy')::int AS fy, (e->>'amount')::numeric AS m
  FROM participations pa JOIN projects p ON p.id = pa.project_id
  CROSS JOIN LATERAL jsonb_array_elements(p.raw->'fiscal_years'->pa.source_uid) e
  WHERE p.source='nsf')
SELECT fy, round(sum(m)/1e9,3) AS total_md,
       round(sum(m) FILTER (WHERE pays='US')/1e9,3) AS us_md
FROM j WHERE fy BETWEEN 2009 AND 2025 GROUP BY 1 ORDER BY 1;
-- contrôle : la somme FY2009-FY2025 doit valoir 125,097 Md$,
-- identique au total calculé au grain projet (requête E).
```

### N bis. La réconciliation au périmètre gelé (§ 9.4.8)

```sql
WITH s AS (
  SELECT p.raw->>'instrument' AS instr,
         (sl.value->>'fy')::int AS fy, (sl.value->>'amount')::numeric AS m
  FROM projects p
  CROSS JOIN LATERAL jsonb_each(p.raw->'fiscal_years') AS aw(k,v)
  CROSS JOIN LATERAL jsonb_array_elements(aw.v) AS sl(value)
  WHERE p.source='nsf')
SELECT fy, round(sum(m)/1e6,2) AS numerateur_gele_m_usd
FROM s
WHERE instr IN ('Standard Grant','Continuing Grant','Cooperative Agreement',
                'Fellowship Award','Fixed Amount Award')
  AND fy BETWEEN 2011 AND 2025
GROUP BY 1 ORDER BY 1;
-- à diviser par la série « Award Obligation Amount » du millésime
-- (quinze valeurs du § 9.4.6 pour l'état du 2026-08-26).
-- Attendu FY testés : 7 327,70 / 8 185,81 / 8 463,08 / 8 069,37 M$.
```

### N. Le double compte des enveloppes d'appel (§ 17.5)

```sql
WITH x AS (
  SELECT m.k AS topic_key, act.value->'budgetYearMap' AS bym
  FROM call_topics ct
  CROSS JOIN LATERAL jsonb_each(ct.budget_overview->'budgetTopicActionMap') AS m(k,v)
  CROSS JOIN LATERAL jsonb_array_elements(m.v) AS act(value)
  WHERE ct.status_label='Closed'),
y AS (SELECT topic_key, (b.value)::numeric AS montant
      FROM x CROSS JOIN LATERAL jsonb_each_text(x.bym) AS b(key,value)
      WHERE b.value ~ '^[0-9]+$' AND b.key='2026')
SELECT round(sum(montant)/1e6,1) AS somme_naive_m,
       round((SELECT sum(mx) FROM (SELECT max(montant) AS mx FROM y GROUP BY topic_key) z)/1e6,1)
         AS somme_dedupliquee_m
FROM y;
-- attendu : 190 490,9 M€ contre 5 478,6 M€ — facteur 34,8.
```

### O. Les sources externes, pour rejouer les dénominateurs

Toutes consultées le **2026-08-26**.

| Grandeur | Où la retrouver |
|---|---|
| Enveloppe H2020 (consolidée) | Règlement (UE) n° 1291/2013 art. 6, version consolidée `02013R1291-20150704` — https://eur-lex.europa.eu/eli/reg/2013/1291/2015-07-04 |
| Exécution H2020 | SWD(2024) 29 final, *Ex-post evaluation of Horizon 2020* (CELEX `52024SC0029`) |
| Enveloppe Horizon Europe | Règlement (UE) 2021/695 art. 12 — https://eur-lex.europa.eu/eli/reg/2021/695/oj ; NGEU à l'art. 13 et au règlement 2020/2094 art. 2(2)(a)(iv) |
| CE/CP annuels UE | DG BUDG, `2025-12-31_MFF_ABL_2021_2027_0.xlsx` (2021-2027) et `2021_04_15_abl_for_website_final.xlsx` (2014-2020) — https://commission.europa.eu/strategy-and-policy/eu-budget/how-it-works/annual-lifecycle/figures-2021-2027_en |
| Définition CE/CP | Règlement financier (UE, Euratom) 2024/2509, art. 7(3) et 7(4) |
| RAL | *Statements of Estimates* accompagnant les projets de budget, § 3.1.2 |
| Champs CORDIS | `DET_fields_description.pdf`, dans `information.zip` des archives H2020 et Horizon Europe (vérifié sur les archives en cache local ; l'archive FP7, plus ancienne, n'en contient pas) |
| Appropriations NIH | NIH Almanac — https://www.nih.gov/about-nih/nih-almanac/appropriations-section-1 ; NIH Office of Budget — https://officeofbudget.od.nih.gov/approp_hist.html |
| Obligations NIH par mécanisme | *Mechanism Detail for Total NIH, FY 2000 – FY 2025* (Office of Budget) |
| Champs RePORTER | ExPORTER Data Dictionary — https://report.nih.gov/exporter-data-dictionary |
| Appropriations NSF | Table « NSF Budget Requests and Appropriations by Account », dans chaque *Budget Request to Congress* |
| Obligations NSF | *Object Classification*, un CJ par exercice (FY2023-FY2025 seulement) |
| Schéma award NSF | https://www.nsf.gov/awardsearch/resources/Award.json |
| « Award Obligation Amount » (dénominateur retenu) | Dashboard *NSF by the Numbers* — `https://tableau.external.nsf.gov/views/NSFbyNumbers/Trends` depuis https://www.nsf.gov/about/about-nsf-by-the-numbers ; codebook v1.0.7 : https://www.nsf.gov/about/about-nsf-by-the-numbers/codebook ; méthode d'extraction et quinze valeurs du millésime 2026-08-26 consignées au § 9.4.6 (la série est restatée : citer toujours le millésime) |
| GBARD | Frascati 2015 ch. 12 ; Eurostat `gba_nabsfin07` (DOI `10.2908/GBA_NABSFIN07`) ; OCDE `DSD_RDS_GOV@DF_GBARD_NABS07` |
