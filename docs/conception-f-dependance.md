# Conception F — Dépendance et exposition (F0 : le contrat méthodologique)

> **Statut : VALIDÉ le 2026-08-29 (arbitrage Charlotte) — GO, avec
> trois corrections gravées ici même (M4 sans qualificatif, règle de
> refus F-D6, branche unique pour la dette Explorateur) et les deux
> questions ouvertes tranchées (groupes : première issue retenue, hors
> F1 ; contrefactuel : NO-GO).** Le plan d'implémentation est
> `docs/plan-f1-dependance.md`, soumis à arbitrage séparément.
> Le NO-GO reste un résultat valide (précédent R5A) : chaque mesure
> refusée ci-dessous l'est avec son motif, et la condition sous
> laquelle elle redeviendrait instruisable.
> Gold set calculé à la main le 2026-08-29 sur le corpus complet local
> (699 798 / 110 116 / 1 102 270, état de référence) et vérifié **au
> centime** contre le moteur de chaîne B1 (`chain.organisation_node`,
> `chain.country_node`) — § 8.

## 0. La question, et pourquoi ce contrat doit être inattaquable

F répond à : **« qui dépend de qui, à quel point, et qui est exposé à
quoi »** — la part d'un financeur dans l'argent reçu par une
organisation ou un pays, la concentration d'un portefeuille, l'exposition
à un programme. C'est la surface la plus sensible du produit pour les
clients stratégie/défense : chaque chiffre y sera lu comme une
**affirmation de dépendance** sur une organisation nommée. Un ratio
défendable à 90 % est un ratio indéfendable — le précédent R5A l'a
établi : un « % du budget » techniquement calculable mais comptablement
faux oscillait entre 6,9 % et 136,3 % selon l'année
(conception-r5 § 17.10). Ici l'erreur ne serait pas un chiffre absurde :
elle serait un chiffre **plausible et faux sur quelqu'un**.

Le socle existe déjà : le moteur B1 sert, pour toute organisation et
tout pays, des blocs par financeur — chacun dans SA mesure, SA devise,
avec SA couverture — et refuse le total unique par contrat
(`chain.py:136-140`, testé par le gold ITACONIX,
`test_chain_gold.py:567-591`). **F est l'étage analytique posé sur ces
blocs : il les lit, il ne les recalcule jamais** (§ 7, règle F-R1).

## 1. Ce que le corpus observe — la matière première, sans maquillage

Rappel B0 (conception-b § 3), car tout en découle :

| | CORDIS (ec) | NIH | NSF |
|---|---|---|---|
| Montant projet | engagement prévisionnel plafonné (`ecMaxContribution`), `commitment_ceiling` | Σ des obligations annuelles publiées (FY2005+), `obligations_annual_sum` | obligation cumulée à date d'ingestion, `obligations_cumulative` |
| Montant participant | `ecContribution` — **vraie part** (`commitment_share`) | **copie du total projet** — un marqueur de bénéficiaire, PAS une ventilation (`beneficiary_marker`) | `awd_amount` de l'award membre — vraie part |
| Devise native | EUR | USD | USD |
| Annualité | n'existe pas | détruite à l'ingestion (D6) | axe R5B séparé, incompatible avec le cumul |

« Il n'existe aucune ligne comptable commune aux trois sources »
(conception-b § 3, R5A § 3.3). Et ce que le corpus observe est du
**financement de projets attribué** — jamais le budget d'une
organisation : le CNRS a des ressources (subvention d'État, contrats,
dotations) qu'Orion ne voit pas et ne verra jamais. Ces deux faits
commandent tout le contrat.

## 2. F-D1 — le dénominateur : la décision la plus lourde

« X dépend à 40 % de l'UE » : 40 % de quoi ? Trois dénominateurs
candidats, deux refus, un GO.

### 2.1 REFUSÉ — le budget total de l'organisation

Le précédent R5A s'applique trait pour trait : *« si le dénominateur est
le budget officiel, les parts ne font pas 100 % — et l'écart mélange
deux choses que l'interface ne peut pas distinguer : ce que
l'organisation reçoit d'ailleurs (vrai signal) et ce qu'Orion ne voit
pas (défaut de couverture) »* (conception-r5 § 13). Aucune source de
« ressources totales » par organisation n'existe dans le corpus, aucune
n'est prouvable au grain organisation × année pour 110 116 entités.
**Motif : dénominateur non prouvé (précédent R5A NO-GO).** Condition de
réouverture : une source officielle de ressources par organisation,
même nature comptable que le numérateur, même axe de temps — elle
n'existe pas aujourd'hui, y compris chez les intéressés (GBARD : quatre
États signalent que leurs propres ventilations ne bouclent pas,
r5 § « GBARD »).

### 2.2 REFUSÉ — le total observé inter-financeurs

Le candidat « naturel » : part de l'UE dans le total Orion
(EC + NIH + NSF) de l'entité. Il est refusé, pour les raisons déjà
gravées au moteur et prouvées au gold :

- **Les natures ne se somment pas** (I3, I8) : chez Johns Hopkins, le
  ratio naïf « 93 % NIH » diviserait une part d'engagement UE par une
  somme mêlant engagements, obligations annuelles et obligations
  cumulées, en deux devises (gold F-1, § 8.1). Le dénominateur serait un
  chiffre inventé — exactement ce que `cross_funder_total.available:
  false` interdit, et ce que le test ITACONIX fige (`"total" not in
  node`).
- **Le biais de couverture devient une affirmation géopolitique** : la
  Suède « dépendrait à ~98 % de l'UE » (gold F-3) — non parce que c'est
  vrai, mais parce que NIH et NSF ne financent presque pas
  d'organisations suédoises *par construction du corpus*. Le ratio
  transformerait le périmètre d'Orion en fait sur le monde.
- La contre-valeur EUR observée (convention ④) ne sauve pas le ratio :
  elle rend les devises comparables, pas les natures — et elle exclut
  des lignes (`excluded_no_rate`) différemment selon le financeur, ce
  qui déforme la part.

**Verdict, aligné sur la page d'entrée de la chaîne : « no single
total ». La dépendance se décline PAR financeur, sans total menteur.**
Chaque bloc reste dans sa mesure et sa devise (le wording produit
existe déjà : « Pas de total unique. » `i18n money.noSingleTotal`).
Condition de réouverture : une ligne comptable commune aux sources — le
§ 3.3 de R5A a établi qu'elle n'existe pas ; l'arrivée d'une source
nouvelle ne la crée pas, elle ajoute une colonne au tableau du § 1.

### 2.3 GO — le total observé INTRA-financeur, intra-mesure

Au sein d'UN financeur, la mesure est homogène (même nature, même
devise) et le dénominateur est un **vrai sur-ensemble de la même
mesure** — la grammaire I8 que `_node_share` applique déjà aux ratios
de la chaîne (programme ⊂ financeur : oui ; appel transversal : refus
`transversal_call`, jamais un pourcentage faux). Le dénominateur licite
de F est donc :

> **Σ de la mesure du financeur, observée dans le corpus Orion, pour
> cette entité, sur les montants connus — l'inconnu exclu ET compté.**

C'est une part-du-tout-observé, et le contrat l'assume : elle ne dit
rien du budget de l'entité (§ 2.1), elle dit la **structure de ce
qu'Orion observe** — et le wording du § 3 le rend impossible à lire
autrement.

## 3. F-D2 — la sémantique : ce que « dépendance » a le droit de dire

Méthode E2 : nommer l'échelle, écrire la phrase exacte, dire l'absence
plutôt que l'habiller.

### 3.1 Le mot lui-même

**« Dépendance » est banni des titres et des chiffres.** Ce que F
mesure est une **concentration de financements observés** et une
**exposition observée** — des faits de structure du corpus, pas un
jugement de viabilité. « Dépendre » affirme un contrefactuel (sans X,
Y tombe) qu'Orion n'observe pas. Le mot peut apparaître dans la prose
pédagogique de la méthode (« ce qu'on appelle souvent dépendance »),
jamais dans un libellé de mesure.

### 3.2 Les formulations exactes (parité FR/EN testée, patron E2)

| Usage | FR | EN |
|---|---|---|
| Titre de surface | Concentration des financements observés | Concentration of observed funding |
| Part programme (EC) | {{pct}} des contributions UE observées de {{entity}} relèvent de {{programme}} (corpus Orion) | {{pct}} of {{entity}}'s observed EU contributions fall under {{programme}} (Orion corpus) |
| Part programme (NIH) | {{pct}} des montants de projets NIH observés dont {{entity}} est bénéficiaire relèvent de {{programme}} | {{pct}} of the observed NIH project amounts for which {{entity}} is the beneficiary fall under {{programme}} |
| Part programme (NSF) | {{pct}} des obligations NSF observées de {{entity}} relèvent de {{programme}} | {{pct}} of {{entity}}'s observed NSF obligations fall under {{programme}} |
| Phrase top N | Les {{n}} premiers programmes portent {{pct}} du montant observé ({{funder measure}}) | The top {{n}} programmes carry {{pct}} of the observed amount ({{funder measure}}) |
| Inconnu | {{n}} participations sans montant connu — exclues du calcul et comptées | {{n}} participations carry no known amount — excluded from the ratio and counted |
| Refus majorité inconnue | La part n'est pas calculable : la majorité des montants est inconnue ({{unknown}}/{{total}}) | No share can be computed: most amounts are unknown ({{unknown}}/{{total}}) |
| Refus de persistance (entité sans identifiant stable, F-D6) | Cette entité n'a pas d'identifiant public stable : la vue se consulte mais ne peut pas être conservée — une référence enregistrée pourrait se briser sans prévenir | This entity has no stable public identifier: the view can be browsed but not saved — a stored reference could break without warning |
| Non-surinterprétation (bloc méthode, fixe) | Parts calculées au sein des financements observés par Orion — jamais le budget ni les ressources de l'entité. Constat observé, aucune prédiction. | Shares computed within Orion-observed funding — never the entity's budget or resources. Observed facts, no prediction. |

**Interdits, avec leur remplacement :**

| Interdit | Remplacé par |
|---|---|
| « Le CNRS dépend de l'UE à X % » | « X % des contributions UE observées du CNRS relèvent de… » (il n'existe AUCUNE phrase licite de la première forme — le ratio inter-financeurs n'existe pas, § 2.2) |
| « X % du financement de {{entity}} » | « X % des {{mesure du financeur}} observées de {{entity}} » |
| « % du budget » | interdit sans exception (règle de nommage R5A § 19.1 : le nom dit ce que le dénominateur EST) |
| « mono-dépendant », « à risque », « fragile » | aucun équivalent — F publie des mesures, pas des diagnostics ; le tri est un tri déclaré, jamais un jugement (doctrine E2) |

### 3.3 Le bloc méthode obligatoire

Toute surface F porte le bloc à cinq lignes du patron E2 : corpus
(sources et fenêtres d'ingestion), unité de comptage (participation ;
« organisation × projet distinct » pour les comptes — règle R4, les
4 451 projets à entrées fusionnées répétées se comptent DISTINCT),
traitement des montants (la part du participant, jamais un budget
projet répété — sauf NIH : convention bénéficiaire, dite), formule de
chaque indice, phrase de non-surinterprétation. La dédup
d'organisations y est déclarée comme **analyse Orion** (B0 § 5).

## 4. F-D3 — les mesures : définition, périmètre, exclusions

### M1 — Le panorama par financeur (la « part financeur » honnête)

**Définition** : la réutilisation TELLE QUELLE des blocs `by_funder` de
B1 — montant natif, enveloppe de mesure, `coverage`
(`with_amount`/`unknown_amount`), `amount_eur_observed` avec
`excluded_no_rate`, `cross_funder_total: {available: false}`. F n'y
ajoute AUCUN pourcentage : les blocs se lisent côte à côte, c'est la
réponse à « de qui reçoit-il ? ». Aucun calcul nouveau, aucune
exclusion nouvelle.

### M2 — La part par programme, au sein d'un financeur

**Définition** : `part(P) = Σ mesure(participations de l'entité
rattachées à P, montants connus) / Σ mesure(participations de l'entité
chez ce financeur, montants connus)`, en devise native de la mesure.
- **Grain** : participation (la part du participant, `ecContribution`
  côté EC, `awd_amount` côté NSF) — jamais le total projet (règle R1,
  gold VerSiLiB ×8). Exception NIH : la « part » est la convention
  bénéficiaire (1 participation = 1 projet, montant = total projet) et
  son libellé le dit (§ 3.2).
- **Maille programme** : le code programme **par génération**, tel qu'en
  base — c'est la seule maille qui existe. Toutes les sources la
  portent (NIH : instituts ; NSF : divisions ; vérifié : 0 projet sans
  programme). Limite nommée, gold F-2 : l'exposition à une FAMILLE
  transgénérationnelle (l'ERC du CNRS = FP7-IDEAS-ERC + H2020-EU.1.1 +
  HORIZON.1.1 = 57 % du total observé, éclatés en trois codes) est
  SOUS-déclarée par cette maille. La part par code est donc un
  **plancher d'exposition par famille**, et la surface le dit. La
  famille elle-même n'existe pas en base : la construire est une
  **curation versionnée** (régime nuts-levels.csv), pas une règle de
  préfixe silencieuse — reportée à un lot ultérieur, jamais improvisée.
- **Exclusions comptées** : les participations sans montant sortent du
  ratio et s'affichent (« {{n}} sans montant connu »). Un montant NULL
  n'est jamais 0 (I4) ; une part réelle minuscule s'affiche « < 0,1 % »,
  jamais « 0 % » (format-share, esprit I4).

### M3 — Top N et part cumulée du top 3

**Définition** : tri déclaré par montant observé décroissant (doctrine
E2 : un tri, pas un jugement), au sein d'un financeur ; la phrase de
concentration du précédent B2 (« les 3 premiers représentent
{{pct}} ») calculée sur le même dénominateur que M2, affichée seulement
quand M2 est valide. Le compte total accompagne toujours le top
(« 3 premiers programmes sur 58 »).

### M4 — L'indice de concentration : HHI, formule affichée

**Choix : le HHI (Herfindahl-Hirschman)**, retenu contre la part
cumulée seule parce qu'il voit toute la distribution ; la part du top 3
(M3) reste affichée à côté comme lecture immédiate — les deux ensemble,
jamais l'indice nu (doctrine « un score sans ses composantes ne
s'affiche pas », audit-intelligence).
- **Formule, affichée dans le bloc méthode** :
  `HHI = 10 000 × Σᵢ (partᵢ)²` sur les parts M2 (montants connus, un
  financeur, une mesure). L'échelle 0–10 000 est affichée avec sa
  source (l'indice de Herfindahl-Hirschman, convention d'usage des
  *US DOJ/FTC Merger Guidelines*). **Aucun qualificatif** — pas de
  « faible / modérée / élevée » : ces paliers qualifient une
  concentration de MARCHÉ entre concurrents, quand F mesure un
  portefeuille (condition (d) ci-dessous) ; les importer serait le
  diagnostic que F-D2 bannit, avec l'habit d'un régulateur (arbitrage
  du 2026-08-29). Le nombre, la formule, l'échelle sourcée — rien
  d'autre.
- **Conditions de validité nommées** : (a) intra-financeur strictement —
  un HHI inter-financeurs est le ratio du § 2.2, refusé ; (b) même
  régime « majorité connue » que M2 ; (c) maille = code programme par
  génération, donc le HHI est un **plancher** de concentration par
  famille (l'éclatement ERC du gold F-2 le sous-estime) — dit en
  méthode ; (d) jamais de HHI « toutes organisations » agrégé en un
  chiffre de marché : F mesure un portefeuille, pas un marché.

### M5 — L'évolution temporelle : des cohortes, jamais des flux

La leçon D6/R5A est absolue : 98-99,9 % de la valeur du corpus est
rattachée à la seule année de début (« cohorte d'attribution ») ; NIH
et CORDIS n'ont pas d'annualité ; aucun décalage d'axe ne corrige quoi
que ce soit (R5A § 15 : « il n'y a pas une bonne année à trouver — il y
en a plusieurs »).
- **Définition** : M2/M3/M4 calculées sur une **fenêtre de cohortes
  déclarée** (`extract(year from start_date)`, la convention de
  l'Explorateur), libellée « cohortes {{from}}–{{to}} » — jamais
  « en {{année}} », jamais « flux annuel ».
- **Comparaison** : deux fenêtres déclarées côte à côte (la règle des
  fenêtres mûres existante : années ≤ now−2), chaque fenêtre avec sa
  couverture ; refus si l'une des deux est en majorité inconnue.
- **Interdit** : toute série « dépendance année par année » présentée
  comme un flux ; toute comparaison d'une part sur cohortes à une
  grandeur annuelle (budget, obligation d'un FY).

### M6 — L'exposition d'un pays à un programme

**Définition** : au grain pays (destination institutionnelle, jamais un
effort national — la note de provenance du nœud pays B1 fait foi), le
classement des organisations du pays par montant observé sous le
programme P (mesure du financeur de P), chacune avec sa part M2. Le
pays lui-même reçoit M1 (panorama) et, par financeur, M2-M4 — mêmes
règles, mêmes refus.

## 5. Les pièges hérités, traités un par un

| Piège | Traitement contractuel | Preuve |
|---|---|---|
| Double comptage multi-participants | Grain participation partout (R1) ; le gold ITACONIX et VerSiLiB restent les tests de recette ; NIH via convention bénéficiaire, étiquetée | § 8, golds F-1/F-2 ; `test_chain_gold.py:417-427, 567-591` |
| Remontée organisation (deux niveaux d'argent B0) | F lit les blocs B1 (`_by_funder_blocks`), qui somment les PARTS (jamais l'étage projet) ; R2 : les deux étages jamais additionnés | § 7, F-R1 |
| Fusions/alias — les IDs bougent | La dépendance se calcule sur l'**entité canonique dédupliquée** (analyse Orion, déclarée en méthode). Toute persistance (dossier, export, URL durable) référence le couple **`(scheme, value)` d'`organisation_identifiers`** (pic > uei > ipf > rnsr — faits source réattachés au survivant d'une fusion), jamais `organisations.id` (supprimé par `merge.py:143`), jamais `lei` (dérivé, reconstruit à chaque run). **La règle du cas « entité sans identifiant stable » (arbitrage 2026-08-29)** : elles sont **9 016 sur 110 116** (8,2 %, portant 5 565,9 M€ observés — mesuré sur l'état de référence, chiffre au contrat). Pour elles, la **persistance durable est REFUSÉE avec message explicite** (phrase au § 3.2) : pas de dossier, pas d'export référencé, pas d'URL durable — la consultation à chaud reste entière. Jamais de référence dégradée silencieuse (un `organisations.id` persisté « faute de mieux » serait exactement le défaut G8 que cette règle ferme) | inventaire § dédup ; audit G8 |
| Deux entités légitimes sous un même nom | Le CNRS existe en DEUX entités à PIC distincts (18159 : 3 016,6 M€ ; 2373 : 0,78 M€) — ce n'est pas un défaut de dédup (PIC différents = jamais fusionnés, `STRONG_SCHEMES`). Une part calculée sur l'une n'inclut pas l'autre : la surface liste les homonymes non consolidés quand ils existent (régime « note d'honnêteté de périmètre » des groupes), jamais une fusion silencieuse | gold F-2 |
| Natures jamais sommées entre financeurs | F-D1 § 2.2 — le refus est structurel, pas un affichage | gold F-1 |
| Montants inconnus | Trois étages, chacun nommé : `unknown_amount` (inconnu à la source — exclu du ratio et compté), `excluded_no_rate` (connu mais sans taux BCE — n'affecte que la vue EUR, jamais les parts natives), et l'inconnu **dépendant de la convention** (les instituts intra-muros NIH : participations NULL mais convention bénéficiaire pleine — gold F-4a). Garde-fou : règle « majorité connue » (§ 6) | golds F-1, F-4 |
| Le chemin existant qui contredit tout ça | `explore.aggregate(by="funder", organisation=…)` produit DÉJÀ une répartition par financeur en `sum(amount_eur)` inter-natures — exactement ce que F refuse. **Branche unique, arbitrée (2026-08-29) : alignement sur M1** — `by=funder` garde ses comptes et ses montants natifs par financeur, il **perd la somme EUR inter-natures**. L'option « étiqueter Σ observée, natures mêlées » est écartée : une étiquette ne rend pas un chiffre vrai, elle s'en excuse — et elle installerait la même somme interdite sur la fiche et tolérée sur l'Explorateur. Résorption en **F1.1**, avant toute surface nouvelle | inventaire § 4 ; même régime que la dette « hero » de conception-b § NO-GO 3 |

## 6. La condition de validité « majorité connue » (F-D4)

Une part calculée sur 7 % de montants connus est un mensonge poli. La
règle, simple et vérifiable :

> **Si `unknown_amount > with_amount` sur le dénominateur (le bloc
> financeur de l'entité), les mesures M2-M5 se REFUSENT pour ce
> financeur** — motif `unknown_majority`, phrase du § 3.2, le fait brut
> affiché à la place (montant connu, compte d'inconnues). Elles ne
> s'ajustent pas, elles se ferment (régime R5B : « la métrique devient
> indisponible — elle se ferme, elle ne s'ajuste pas »).

Le seuil « majorité » (50 %) est délibérément le plus faible défendable :
il ne prétend pas garantir la précision, il interdit l'absurde. En
dessous du refus, la couverture reste affichée sur chaque part (« sur
{{with}}/{{total}} participations à montant connu »). M1 (panorama)
n'est jamais refusé : il montre des montants et des comptes, pas des
ratios. Gold d'application : Harvard (93 % inconnu côté EC) → refus ;
Johns Hopkins EC (36/57 inconnues = 63 %) → refus AUSSI, malgré
13,6 M€ connus — le contrat assume qu'une part UE de JHU n'est pas
publiable ; son panorama M1, si.

## 7. Les règles d'architecture (pour le futur plan F1 — pas un plan)

- **F-R1 — F lit B1, ne recalcule pas.** Les blocs par financeur
  viennent de `chain.organisation_node` / `chain.country_node`. Les
  mesures M2-M6 sont des extensions du MOTEUR (mêmes registres, mêmes
  enveloppes, mêmes golds), jamais des calculs de vue — la leçon de
  l'audit (G6 : la vue B2 recalculait de la sémantique comptable) est
  un interdit de naissance ici.
- **F-R2 — pas de nouvelle vérité de mesure.** F n'introduit ni
  nature comptable ni convention de conversion : il compose celles de
  B0/B1 et du Reference Engine. Tout libellé de part vient d'un
  registre, l'UI ne devine rien.
- **F-R3 — chaque mesure naît avec son gold.** Le § 8 est le socle du
  futur `test_dependency_gold.py` ; aucun chiffre de F ne s'affiche
  sans un gold à la main qui le verrouille.

## 8. Le gold set — calculé à la main, vérifié contre B1

Base : corpus complet local (état de référence). Concordance
main/moteur : **au centime sur les quatre cas**.

### 8.1 Gold F-1 — Johns Hopkins University (dense, trois financeurs)

| Financeur | Participations | Connues/inconnues | Montant natif (mesure) | EUR observé (conv. ④) |
|---|---|---|---|---|
| EC | 57 | 21 / 36 | 13 581 718,55 € (`ec_contribution_sum`) | idem, `excluded_no_rate` 36 |
| NIH | 7 502 (=projets, 1:1) | 7 478 / 24 | 15 034 167 102 $ (`nih_beneficiary_projects_total`) | 9 664 859 798,11 €, `excluded_no_rate` 1 056 |
| NSF | 1 597 | 1 596 / 1 | 831 404 240 $ (`nsf_awards_obligated_sum`) | 667 804 232,70 €, `excluded_no_rate` 40 |

Ce que le gold verrouille : le ratio inter-financeurs n'existe pas
(trois natures, deux devises — `cross_funder_total.available: false`
servi par le moteur) ; la part EC de JHU est refusée par F-D4
(majorité inconnue) ; les parts NIH/NSF intra-financeur sont licites.

### 8.2 Gold F-2 — CNRS, id 18159 (mono-financeur dense)

EC seul : 4 962 participations, 129 inconnues (2,6 % — « majorité
connue » passée), **3 016 610 461,35 €** observés (moteur : ✓).
Concentration intra-EC sur 58 programmes (montants connus) :
**top 3 = 57,04 %**, **HHI = 1 273** (échelle 0–10 000, § M4 — sans
qualificatif). Le
plancher-famille en acte : ERC = 349,16 + 734,30 + 637,06 M€ sur trois
codes de générations — la part « ERC famille » (57 %) n'est pas servie
faute de curation famille, et le HHI par code sous-estime cette
concentration : la surface le dit. Homonyme non consolidé : CNRS
id 2373 (PIC 900696120, 0,78 M€) listé, jamais fusionné.

### 8.3 Gold F-3 — la Suède (pays petit)

EC : 13 990 participations (9 243 projets), 873 inconnues,
**6 101 343 035,42 €** (moteur : ✓). NIH : 58 parts, ~42,4 M€ observés.
NSF : 16 parts, ~48,1 M€. Le gold verrouille le refus § 2.2 : « la
Suède dépend à 98 % de l'UE » est le chiffre que F ne produira jamais —
le panorama M1 montre trois blocs dans leurs mesures, et le biais de
couverture (NIH/NSF ne financent presque pas hors États-Unis) est dit
en méthode. *Correction au brief : il n'existe pas de « recette
Suède » antérieure — le gold pays du moteur est la Finlande
(`test_chain_gold.py:593`), la Suède vient de la doctrine des mailles
(ses NUTS2 sont des constructions statistiques). Elle est retenue ici
précisément parce qu'elle est petite, dense côté EC et quasi absente
côté NIH/NSF.*

### 8.4 Gold F-4 — les inconnus massifs, deux visages

**(a) L'inconnu dépend de la convention, pas de la colonne** : Division
of Basic Sciences – NCI (id 117744), 2 167 participations TOUTES à
montant NULL — et pourtant le moteur sert 14 366 044 591 $ à couverture
pleine (2 167/0), car la convention bénéficiaire NIH lit le total
projet. Le contrat compte l'inconnu **dans la convention de la mesure**,
jamais en relisant la colonne.
**(b) Le refus « majorité inconnue »** : Harvard (id 15598), 129
participations EC, 93 % sans montant, 0,23 M€ connus → M2-M5 refusées
(`unknown_majority`), le fait brut affiché. Idem Stanford (92 %),
Regents of the University of California (80 %). Ces cas sont
structurels : participants de pays tiers des consortiums UE, souvent
sans contribution UE publiée.

## 9. La carte des surfaces — les questions, pas les maquettes

| Surface | Questions client (leurs mots) | Mesures servies |
|---|---|---|
| Fiche organisation | « Mon labo est-il mono-dépendant ? » « D'où vient l'argent de mon concurrent ? » | M1 (panorama par financeur) ; par financeur : M2 (parts programmes), M3 (top 3 + phrase), M4 (HHI), M5 (deux fenêtres de cohortes) |
| Fiche pays | « Quels acteurs français sont les plus exposés au programme X ? » « Que reçoit ce pays, de qui ? » | M1 pays ; M6 (classement des organisations par exposition à P) ; M2-M4 par financeur au grain pays |
| Vue comparative (benchmark existant) | « Entre A, B et C, qui est le plus exposé à Horizon Europe ? » | M2/M3 côte à côte, même financeur, même fenêtre — jamais de comparaison inter-financeurs |
| Fiche groupe | « À quoi mon groupe est-il exposé ? » | **Tranché (arbitrage 2026-08-29), première issue retenue** : blocs M1 par financeur AVANT pondération — chaque bloc pondéré JV dans SA devise et SA nature, **jamais de total consolidé** ; la pondération des JV est une classification dérivée Orion, déclarée au bloc méthode. **Chantier séparé, hors F1** — rien de groupe dans le plan F1 |

## 10. Ce qu'on ne construit pas

Un total inter-financeurs sous quelque étiquette que ce soit (même
« Σ observée ») sur une surface F — le panorama suffit ; un « % du
budget » ; un score de dépendance composite (un indice sans formule
affichée, une note, un feu tricolore) ; **un qualificatif de
concentration** (faible/modérée/élevée — arbitrage 2026-08-29, § M4) ;
une famille de programmes par règle de préfixe non versionnée ; une
série annuelle de dépendance ; un HHI de « marché » ; une prédiction,
une recommandation, un qualificatif de risque ; une part calculée en
re-requêtant les tables depuis la vue (F-R1) ; **le contrefactuel
(« si le programme X −20 % ») : NO-GO tranché (2026-08-29)** —
l'arithmétique n'ajoute rien à M2/M3 (la part EST déjà l'exposition),
et le cadrage de scénario ajoute tout le risque de lecture prédictive.
Question fermée, pas reportée.

## 11. Récapitulatif des décisions — ARBITRÉES le 2026-08-29

| # | Décision | Verdict |
|---|---|---|
| F-D1 | Dénominateur | **VALIDÉ** — budget : NO-GO (R5A) ; inter-financeurs : NO-GO (I3/I8, golds F-1/F-3) ; intra-financeur sur montants connus : GO |
| F-D2 | Wording | **VALIDÉ** — « dépendance » banni des libellés ; formulations exactes § 3.2, parité FR/EN testée ; « % du budget » interdit |
| F-D3 | Mesures | **VALIDÉ, corrigé** — M1 panorama (B1 tel quel), M2 parts programmes, M3 top 3, M4 HHI (nombre + formule + échelle 0–10 000 sourcée, **sans qualificatif**), M5 fenêtres de cohortes, M6 exposition pays→programme |
| F-D4 | Refus « majorité connue » | **VALIDÉ** — `unknown_amount > with_amount` ⇒ M2-M5 fermées, motif `unknown_majority` — y compris JHU côté EC |
| F-D5 | Maille programme | **VALIDÉ** — code par génération (la seule en base) ; part = plancher de famille, dit ; famille = curation versionnée future, jamais un préfixe silencieux |
| F-D6 | Clé stable | **VALIDÉ, complété** — entité canonique dédupliquée (analyse Orion déclarée) ; persistance par `(scheme, value)` — jamais `organisations.id`, jamais `lei` ; **9 016 entités sans identifiant fort : persistance refusée avec message explicite (§ 3.2), jamais de référence dégradée silencieuse** |
| F-D7 | Dette Explorateur | **TRANCHÉ** — branche unique : alignement de `by=funder` sur M1 (comptes + montants natifs, plus de somme EUR inter-natures), en F1.1 avant toute surface nouvelle |
| F-D8 | Groupes | **TRANCHÉ** — blocs M1 par financeur avant pondération, chaque bloc pondéré JV dans sa devise et sa nature, jamais de total consolidé ; JV = classification dérivée déclarée. **Chantier séparé, hors F1** |
| F-D9 | Contrefactuel | **NO-GO** — inscrit au § 10 avec son motif. Question fermée |

**Le plan d'implémentation est `docs/plan-f1-dependance.md` (soumis à
arbitrage), séquence imposée : F1.0 registre `FUNDER_PROFILE` (lot 4 de
l'audit — prérequis maintenu) → F1.1 dette Explorateur → F1.2 moteur
M1-M4 → F1.3 M5-M6 → F1.4 surfaces.**
