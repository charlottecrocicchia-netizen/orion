# L'Explorateur — conception

**Statut : proposé** (rien n'est implémenté ; validation attendue avant toute ligne de code).
Maquette associée : [docs/design/explorateur-maquette.html](design/explorateur-maquette.html).

L'Explorateur est la page qui définit Orion : l'utilisateur **compose sa vue** des
financements R&D au lieu de consommer des pages figées. Le novice entre par une
histoire préparée ; l'expert construit sa question. Les deux manipulent le même objet.

---

## 1. Ce que le benchmark nous apprend

Quatre références étudiées (captures en annexe de la session du 1ᵉʳ août 2026).

**Our World in Data (Grapher)** — la référence absolue.
- Un même jeu de données se regarde en **courbe, carte ou table** : de simples onglets.
- Le **panneau d'entités** (chercher un pays, cocher, comparer) rend la comparaison triviale.
- **L'URL encode tout l'état** (`?country=FRA~DEU~GBR&time=1990..2024`) : chaque vue est
  partageable, citable, embeddable. C'est ce qui a fait d'OWID une infrastructure du web.
- Télécharger (données + image) est un droit de première classe, avec la licence affichée.

**USAspending (Spending Explorer)**
- La **phrase d'état explicite** : « You are viewing FY 2026 spending by Budget Function ».
  L'utilisateur sait toujours ce qu'il regarde, et le pivot de dimension est un seul menu.
- Le **treemap cliquable** fait du drill-down un geste naturel (fonction → agence → compte).
- Le total de référence reste affiché en permanence pendant qu'on descend.

**Dimensions (analytics)**
- Le pivot facette ↔ agrégat : toute recherche filtrée se bascule en vue agrégée
  (par organisation, bailleur, pays). Notre moteur de recherche est déjà structuré ainsi
  (facettes calculées sur le match set) : l'Explorateur en est le prolongement naturel.

**Electricity Maps**
- La **couleur est la donnée** ; la carte est l'interface. Sobriété maximale des contrôles.
- Le curseur temporel est omniprésent : le temps n'est pas un filtre, c'est une dimension
  qu'on caresse.

Ce qu'Orion en retient : une vue = **une phrase lisible** + **le bon graphique choisi
automatiquement** + **une URL qui dit tout** + **des portes d'entrée éditoriales**.

---

## 2. Le modèle : métrique × dimension × comparaison × filtres

Toute vue de l'Explorateur est la phrase :

> **Montrer** [métrique] **par** [dimension] (**comparer** [entités…]) (**dans le temps**)
> **pour** [filtres : période · thème · scope]

La phrase est l'interface (pattern USAspending, poussé plus loin) : chaque segment est un
menu. Elle se lit comme du français — le novice comprend ce qu'il regarde, l'expert la
modifie segment par segment.

### Métriques (5 au lancement)

| Métrique | Définition | Source de vérité |
|---|---|---|
| Financements (€) | Somme des montants | `projects.funding_amount_eur` (vues projet) / `participations.amount_eur` (vues pays·organisation) |
| Projets | Nombre de projets distincts | `count(distinct project_id)` |
| Organisations actives | Organisations ayant ≥ 1 participation | `count(distinct organisation_id)` |
| Financement moyen | € / projet | dérivée |
| Part en coordination | % de participations en coordinateur | `role = 'coordinator'` |

Règle anti-double-compte : dès que la dimension est **pays**, **organisation** ou **type
d'organisation**, les montants viennent des *participations* (la part de chacun), jamais du
total projet. Par **programme**, **bailleur**, **année** : montants projets. L'unité
affichée le dit explicitement (« part des participants », « budget des projets »).

### Dimensions (V1 : six · V2 : sept)

| Dimension | Source | Notes |
|---|---|---|
| Année | `start_date` 2005-2027 | aussi disponible en **split** de toute autre vue |
| Pays | `participations.country_code` | ~40 pays significatifs, 213 au total |
| Programme | racines du référentiel (rollup existant) | Horizon Europe, H2020, FP7, ANR… |
| Organisation | top N (vue MV `organisation_stats`) | jamais exhaustif : top 10/25/50 |
| Bailleur | `funders` | UE / ANR (extensible multi-pays, déjà prévu) |
| Type d'organisation | les 8 catégories canoniques | recherche, université, entreprise… |
| Thème *(V2)* | `topics` (euroSciVoc + axes ANR) | nécessite une passe de normalisation |

**Le thème en V1 sans attendre la taxonomie** : le filtre `q` réutilise le moteur de
recherche bilingue existant. « Où va l'argent de l'hydrogène ? » = l'ensemble des projets
qui matchent *hydrogen/hydrogène*, agrégé par n'importe quelle dimension. C'est un filtre
transversal, pas une dimension — et c'est déjà rapide (match set matérialisé, < 150 ms).

### Comparaison

Sous-ensemble d'entités de la dimension courante (2 à 6) : France vs Allemagne,
Horizon Europe vs ANR, CNRS vs CEA vs Fraunhofer. Sans sélection : top 5 automatique.

### Filtres transversaux

Période (bornes années), thème (`q`), scope géographique (le sélecteur de scope validé
dans l'architecture — V1 : Europe + France, valeur unique).

---

## 3. Le bon graphique, choisi automatiquement

L'utilisateur ne choisit pas un type de graphique, il compose une question ; la vue se
choisit seule (et reste débrayable par onglets, pattern OWID).

| Forme de la question | Vue automatique | Alternatives offertes |
|---|---|---|
| métrique par **année** | aires douces | courbe · table |
| métrique par dimension catégorielle | **barres horizontales** top N | treemap · table |
| part d'un tout (programme, bailleur, type, thème) | barres | **treemap** (drill-down) |
| dimension × **temps** (split) | **courbes multiples** (max 6) | aires empilées · table |
| **pays** sans temps | barres | **carte Europe** *(V2)* |
| n'importe quoi | — | **table** toujours disponible |

Tout en SVG maison (comme la constellation et les year-bars) : cohérence de la DA Lumière,
animations de dessin, zéro dépendance. La carte V2 : TopoJSON Europe simplifié embarqué
(~50 Ko), toujours sans bibliothèque. Risque assumé : plus de code à nous ; mitigation :
quatre primitives seulement (barres, courbes/aires, treemap, carte).

---

## 4. Chaque vue est une URL ; chaque URL s'exporte

```
/explore?metric=funding&by=country&compare=FR~DE&time=2005..2027&q=hydrogen&view=lines
```

- Paramètres : `metric`, `by`, `compare` (tilde-séparé, style OWID), `time` (`a..b`),
  `q` (thème), `view` (débrayage manuel du graphique), plus tard `scope`.
- État par défaut omis de l'URL (URLs courtes et lisibles).
- **Partager** : copie l'URL canonique. **CSV** : les données exactes de la vue (avec
  colonnes unité et période). **PNG** *(V2)* : le rendu, avec titre et attribution.
- Chaque export embarque l'attribution de licence calculée selon les sources présentes
  dans la vue (CC-BY 4.0 European Union / ODbL ANR — prérequis juridique déjà tracé).

---

## 5. Les vues préparées : l'entrée des non-spécialistes

Des cartes éditoriales sur `/explore` (et deux sur l'accueil). Chacune est **un état de
l'explorateur** — en cliquant, le novice arrive dans l'outil *déjà rempli*, avec la phrase
de composition qui lui explique ce qu'il voit. La modifier, c'est apprendre l'outil.

Set de lancement (6) :

| Histoire | État |
|---|---|
| Où va l'argent de l'hydrogène ? | `metric=funding&by=programme&q=hydrogen` (treemap) |
| Le top 10 français | `metric=funding&by=organisation&country=FR` (barres) |
| France · Allemagne, vingt ans de R&D | `by=country&compare=FR~DE&split=year` (courbes) |
| Le Brexit vu des financements | `by=country&compare=GB~FR&split=year` (courbes) |
| L'essor du quantique | `by=year&q=quantum` (aires) |
| Qui coordonne l'Europe ? | `metric=coordination&by=country` (barres) |

(La quatrième s'est imposée d'elle-même en préparant la maquette : la série GB montre
l'effondrement 2022-2024 puis le retour dans Horizon Europe — les données racontent.)

---

## 6. Architecture technique

**Un seul endpoint** : `GET /api/explore/aggregate` avec les mêmes paramètres que l'URL.
- Combinaisons **whitelistées** (la matrice §2-§3) : toute demande hors matrice → 400.
- Réponse : `{ unit, dimension, series: [{key, label, value | points[]}], total, meta }`.
- Chaque gabarit SQL est de la même famille que les hubs actuels (déjà < 10 ms cachés,
  < 300 ms à froid) ; cache par empreinte d'ingestion, comme tout le reste.
- Le filtre `q` réutilise `_materialize_match` tel quel.

**Frontend** : page `/explore` (la nav « Explorer » pointe dessus ; `/explore/countries`
et `/explore/programmes` restent les index, liés depuis l'Explorateur et les hubs).
Composants : `Composer` (la phrase), `AutoChart` (4 primitives SVG), `StoryCard`.
État = `useSearchParams`, même pattern que la recherche (aucune nouvelle machinerie).

---

## 7. Phasage proposé

| Étape | Contenu | Sortie |
|---|---|---|
| **V1** | composeur-phrase, barres/courbes/aires/treemap, URL canonique, CSV, table, 6 histoires, filtre thème via FTS | la page qui définit Orion, dans la recette v0.2.0 ou v0.3.0 |
| **V2** | carte Europe, thèmes normalisés (euroSciVoc), export PNG, embed iframe | partage public |
| **V3** (P6) | scope selector par abonnement, vues sauvegardées par compte | monétisation |

---

## 8. Décisions demandées avant implémentation

1. **La phrase de composition comme UI principale** (originalité assumée) plutôt que le
   panneau latéral à la OWID — la maquette montre la phrase ; le panneau reste possible.
2. **Treemap dès V1** (sinon V1 = barres/courbes seulement, plus vite livré).
3. **Carte en V2** (pas V1) — assumer que le lancement se fait sans carte.
4. Le **set de 6 histoires** (contenus et titres à ajuster librement).
5. **Tout-SVG maison, zéro bibliothèque de graphiques** (cohérence DA, poids, contrôle).
