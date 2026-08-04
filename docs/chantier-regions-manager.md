# Chantier « régions manager » — conception

> **Statut : PROPOSÉ le 2026-08-04, en attente de validation fondatrice.**
> Rien ne s'implémente avant. La décision de principe date du 2026-08-02
> ([roadmap](roadmap.md)) : dès les sources mondiales, le globe et
> l'analyse raisonnent aussi en grandes régions parlantes, une teinte par
> région, l'intensité continuant d'encoder le montant. Les sources
> mondiales sont là (NIH + NSF : 74 % du corpus en euros est américain) —
> le site, lui, ne les montre pas encore : **la couche cliquable du globe
> ne contient que 38 pays européens ; les États-Unis sont du décor
> gris.** Ce chantier est l'adaptation du site aux données qu'il a déjà.
>
> **Maquette : [design/regions-manager-maquette.html](design/regions-manager-maquette.html)**
> (à ouvrir dans Firefox — carte mondiale sur les montants réels du
> 2026-08-04, clair et sombre, sélection démontrée, palette et verdicts
> du validateur).

## 1. Le découpage — cinq régions qui parlent à un décideur

| Région | Teinte | Contenu | Corpus réel (2026-08-04) |
| --- | --- | --- | --- |
| **Europe** | outremer | UE27 + GB, CH, NO, Balkans, UA, TR, RU, Caucase | 52 pays · 252 706 projets · 171,9 Md€ |
| **Amérique du Nord** | ocre | US, CA, MX + BM, GL, PM | 5 pays · 602 503 projets · 547,8 Md€ |
| **Asie-Pacifique** | teal | Asie hors Moyen-Orient + Océanie | 37 pays · 4 448 projets · 1,2 Md€ |
| **Amérique latine** | pourpre | Amériques hors Nord | 20 pays · 2 096 projets · 0,6 Md€ |
| **Moyen-Orient & Afrique** | framboise | Afrique + péninsule arabique, Levant, Iran/Iraq | 67 pays · 9 456 projets · 10,0 Md€ |

Écarts avec le référentiel `REGIONS` du backend (qui reste la matière
première) : les **Amériques sont scindées** (le bloc unique mêlait
États-Unis et Brésil — un décideur ne raisonne pas ainsi), le
**Moyen-Orient quitte l'« Asie »** pour rejoindre l'Afrique (le bloc
MEA des directions commerciales), l'**Océanie se fond dans
l'Asie-Pacifique** (dix petits pays ne valent pas une sixième teinte).

**Choix de frontière à valider** (décision ③) : la Russie et la Turquie
restent en **Europe** (réalité du corpus — leurs participations sont des
projets-cadres européens) ; **Israël va au Moyen-Orient & Afrique**
(lecture géographique ; l'alternative « logique programme » le mettrait
en Europe via son association Horizon — je recommande la géographie,
les données parlent d'elles-mêmes). Ce choix pèse : Israël représente
**4 299 projets et 3,2 Md€**, soit un tiers de la région MEA telle que
proposée. La Guyane et les outre-mers restent
dans leur pays (la France colore un morceau d'Amérique du Sud en
outremer : c'est juridiquement et budgétairement vrai).

## 2. La palette — ce que le validateur a tranché

Spec : [design/assets/palette-regions.json](design/assets/palette-regions.json) ·
vérification : `node scripts/validate_palette.js docs/design/assets/palette-regions.json`
(le validateur, référencé par la doctrine, a été recréé dans ce
chantier : il compose chaque teinte sur le fond à chaque palier
d'opacité et mesure ce que l'œil voit — distinguabilité ΔE entre
régions, simulations deutéranopie/protanopie (Machado 2009),
perceptibilité des extrêmes, « pas de donnée » ≠ « peu de donnée »,
liseré de sélection, interdits de doctrine).

| Région | Clair | Sombre |
| --- | --- | --- |
| Europe | `#2d4fe3` (l'accent du produit) | `#8b9aff` |
| Amérique du Nord | `#b45309` | `#d97706` |
| Asie-Pacifique | `#0d9488` | `#14b8a6` |
| Amérique latine | `#6b21a8` | `#a855f7` |
| Moyen-Orient & Afrique | `#9d174d` | `#e11d48` |

**Deux couleurs des six séries validées ont été REJETÉES par la
mesure** — c'est le résultat le plus utile du chantier :

- **l'olive (série 6)** : ΔE 5,7 avec l'ocre en deutéranopie (seuil 11).
  Un lecteur daltonien ne sépare pas l'Amérique du Nord du
  Moyen-Orient & Afrique. L'olive reste une série de graphiques.
- **le violet (série 5, `#7c3aed`)** : ΔE 2,7 avec l'outremer en
  deutéranopie — pour un deutéranope, le violet EST l'outremer.
  Remplacé par un **pourpre profond `#6b21a8`**, séparé de l'Europe par
  la clarté : ΔE ≥ 12,1 sous les deux simulations.

**Assumé** : au palier le plus pâle (0,12) les cinq teintes convergent
(ΔE ~5) — à ce niveau l'identité est portée par le survol, la légende
et le libellé, pas par l'aplat seul.

**Sélection** : teinte de la région pleine force (opacité 0,92) +
liseré couleur de fond 1,8 px — le précédent de recette est respecté
(l'encre pure a été essayée sur le globe et rejetée : « c'est moche »).
La mise en évidence tranche sur toutes les teintes, le validateur le
vérifie (liseré ≥ 3:1 sur chaque région, les deux modes).

## 3. L'échelle mondiale — décision d'encodage (⑤)

La carte Europe encode le montant par **quantiles de rang** (paliers
d'opacité 0,12→0,88, seuils aux quantiles 20/40/60/80). À l'échelle
mondiale, cette mécanique **ment visuellement** : 193 pays sont financés
(les participations CORDIS touchent toute la planète), le dernier
quintile commence à ~335 M€ — le Brésil (0,4 Md€) sortirait aussi foncé
que l'Allemagne (27 Md€), qui pèse 60 fois plus.

**Proposition** : cinq **paliers logarithmiques nommés en euros** —
< 10 M€ · 10-100 M€ · 0,1-1 Md€ · 1-10 Md€ · > 10 Md€ — mêmes opacités,
légende absolue (un décideur lit « foncé = plus de 10 Md€ »). C'est
l'encodage de la maquette.

À trancher : **(a) paliers log partout** (une seule logique, les scopes
se comparent entre eux ; la carte Europe actuelle change légèrement
d'aspect) — *recommandé* — ou (b) log en scope monde, quantiles
conservés en scope Europe (l'existant ne bouge pas, mais deux logiques
coexistent).

## 4. Le sélecteur de scope géographique (porté par l'URL)

- **Paramètre `scope=`** : `europe` · `north-america` · `latin-america`
  · `asia-pacific` · `middle-east-africa` ; absent = monde. Slugs
  anglais stables (convention des paramètres existants) ; libellés
  affichés localisés FR/EN.
- **Lu par** : la page pays (le cadre de la carte s'adapte à la région
  — la fenêtre Europe actuelle devient la fenêtre du scope `europe`),
  l'Explorateur (agrégats, répartitions), la recherche (pré-filtre
  pays ∈ région), le benchmark.
- **UI discrète** : une rangée de chips (Monde + cinq régions) à la
  page pays et dans l'Explorateur — pas un menu envahissant ; la
  mécanique (URL partageable, épinglable) est le vrai livrable, c'est
  elle qui portera un jour les **abonnements par zone**.
- Le premier clic sur une carte **explore toujours** (règle fondatrice) ;
  le scope ne téléporte jamais, il cadre.

## 5. Raisonner et comparer par région

- **API** : `/api/countries` expose la région manager de chaque pays ;
  un agrégat par région (projets, financement, pays actifs) est servi
  soit en vol (5 groupes, trivial), soit ajouté à `country_stats` — au
  choix de l'implémentation, l'égalité vue/live restant testée.
- **Globe** : les pays à données prennent la teinte de leur région
  (aujourd'hui : outremer uniforme « couverture ») ; la sélection
  garde sa mécanique. **La couche cliquable passe de 38 pays européens
  au monde entier** (régénération de `world-geo.json`, source Natural
  Earth déjà outillée).
- **Explorateur** : « Région » devient une dimension de répartition —
  cinq parts, le donut est permis (≤ 7) avec ses couleurs de régions.
- **Benchmark** : comparer deux régions comme on compare deux pays.
- **Fiche pays** : badge de région (lien vers le scope).

## 6. La passe « le site dit vrai » — inventaire daté du 2026-08-04

| Endroit | Aujourd'hui | Correction |
| --- | --- | --- |
| Note de couverture (globe, i18n `coverageHave`) | « données UE + France » | « Europe — CORDIS » (l'ANR est sortie, la France n'est plus une source à part) |
| `coverageNote` | « EU, France and the United States (NIH) » | « Europe — CORDIS · États-Unis — NIH, NSF » |
| `coverageDetail` | « United States, United Kingdom, Japan — sources in preparation » | « À venir : Royaume-Uni (UKRI), Suisse (SNSF), Pays-Bas (NWO), Suède (Vinnova) » — les US ne sont plus « en préparation », le Japon n'est pas en vague 1 |
| `globeLabel` | « la couverture en outremer » | « la couverture par région » (l'outremer devient la teinte de l'Europe) |
| Globe / `world-geo.json` | 38 pays cliquables, US = décor gris | monde entier, tout pays à données est cliquable |
| Carte plate | fenêtre Europe câblée en dur | fenêtres par scope (`europe` conserve l'actuelle) |
| Page données | à jour (NSF ajoutée au chargement) | — |

## 7. Lots d'implémentation (après validation)

| Lot | Contenu | Estimation |
| --- | --- | --- |
| A | Référentiel : découpage manager au backend (à côté de `REGIONS`), exposition API, agrégats par région + tests. **Constat chiffré : 27 pays ou territoires à données ne sont rattachés à aucune région** (Haïti 349 M€, Guyana, Macao, Jersey, Caraïbes…) — règle du lot : *aucun pays à données sans région*, garantie par un test | ~0,5 j |
| B | Géométrie monde (régénération `world-geo.json`, fenêtres par scope) ; globe et cartes aux teintes de régions ; sélection ; légende euros ; recette Firefox clair/sombre | ~1,5-2 j |
| C | Scope URL + chips ; Explorateur dimension région ; benchmark régions ; recherche pré-filtrée | ~1-1,5 j |
| D | Passe « le site dit vrai » (tableau §6) + captures de recette | ~0,5 j |

Chaque lot : tests, captures, checklist des 10 pièges, CI verte, prod
reconstruite, recette fondatrice avant le lot suivant.

## 8. Soumis à validation

1. **Le découpage** en cinq régions (§1) et ses frontières (③ : RU/TR
   en Europe, IL en MEA, outre-mers avec leur pays).
2. **La palette** (§2) — dont l'entrée du pourpre à la place du violet
   rejeté, et l'olive écartée des cartes.
3. **L'échelle mondiale** (⑤ §3) : paliers log partout (reco) ou
   log-monde/quantiles-Europe.
4. **Les slugs et l'UI du sélecteur** (§4).
5. **Les corrections de vérité** (§6) — appliquées avec le lot D.
