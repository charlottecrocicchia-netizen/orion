# La recherche composable — refonte des pages Découvrir

> **ÉTAT : LIVRÉ (V1) — document historique.** La recherche composable
> V1 est en production (`e310570`, `c7173d6`) — la roadmap la dit
> « livrée (V1 en recette) ». Le statut « proposition à itérer avant
> toute implémentation » ci-dessous est dépassé. *(Bandeau posé le
> 2026-08-29, Hygiène G2.)*

- **Statut : proposition du 2026-08-02, à itérer avec la fondatrice avant
  toute implémentation** (grande recette : « une liste de tout le
  catalogue n'intéresse personne »).
- **Objet** : `/projects` et `/organisations` cessent d'être des
  annuaires ; une barre unique compose la question, les résultats suivent
  en direct.

## 1. Le principe

Une vraie barre, au centre de la page. On y tape **librement**, et chaque
critère reconnu devient un **tag typé** :

```
⌕ [ 🇩🇪 Allemagne ×] [ European Commission ×] [ hydrogen ×] |
   ────────────────  ──────────────────────  ────────────
   tag PAYS           tag BAILLEUR            texte libre (recherche bilingue)

   2 847 projets · les résultats se refiltrent à chaque tag
```

- La reconnaissance passe par **le moteur du lot 1** (l'autocomplete de la
  palette ⌘K) : pendant la frappe, les suggestions typées apparaissent
  sous la barre — pays (Intl.DisplayNames, tolérant aux accents),
  bailleurs, programmes, organisations (trigramme serveur), thèmes.
  Choisir une suggestion **pose le tag** ; ce qui n'est reconnu par rien
  reste du **texte libre** (la recherche bilingue existante).
- Chaque tag se retire d'un ×. L'état complet vit dans l'**URL** — les
  paramètres de recherche existants, rien de nouveau : une recherche
  composée se partage comme tout le reste d'Orion.
- **Pas de syntaxe experte** : jamais de `country:DE` à connaître. Le
  typage vient des suggestions, pas de l'utilisateur.

## 2. La grammaire des tags — ce que l'API sait déjà faire

| Tag | Exemple | Filtre API | État |
|---|---|---|---|
| Pays | 🇩🇪 Allemagne | `country=DE` | **existe** |
| Bailleur | European Commission | `funder=ec` | **existe** |
| Programme | Horizon Europe | `programme=<id>` | **existe** |
| Années | 2019 → 2024 | `year_from/year_to` | **existe** |
| Texte libre | hydrogen | `q=` (bilingue) | **existe** |
| Thème | énergie | `q=` en V1 (texte) | filtre exact euroSciVoc en backlog |
| Organisation | CNRS | — | **extension proposée** : `organisation=<id>` sur `/search/projects` (un EXISTS sur les participations) — « les projets où le CNRS est partenaire » |

L'exemple de la commande — « Allemagne » + « European Commission » +
« hydrogen » — fonctionne **sans aucun nouveau backend**. L'extension
`organisation=` est la seule pièce serveur proposée, et elle ouvre le tag
le plus demandé (le veilleur qui compose « Safran + hydrogène + 2021 »).

## 3. La page, réorganisée autour de la barre

- **Le hero, c'est la barre** : grande, focalisée à l'arrivée, avec trois
  exemples cliquables en dessous (le motif de l'accueil) — la page
  *enseigne* le geste au lieu d'afficher un annuaire.
- **Les résultats suivent en direct** (debounce 250 ms) : la liste
  actuelle est conservée telle quelle — regroupements, sparklines,
  extraits — elle arrive simplement *après* la question, plus jamais à
  froid sur tout le catalogue.
- **Les facettes deviennent des suggestions de tags** : le panneau de
  facettes actuel (bailleurs, programmes, pays, années avec décomptes) ne
  disparaît pas — cliquer une facette **pose le tag correspondant** dans
  la barre. Une seule mécanique, deux portes d'entrée.
- **Organisations** : même barre, tags utiles au corpus (pays, type
  d'organisation, texte trigramme) ; même grammaire, jamais deux produits.
- L'état vide (aucun tag, aucun texte) ne montre plus l'annuaire : les
  chiffres du corpus, les exemples, et les trois tags les plus posés —
  du réel, pas une liste infinie.

## 4. Ce qu'on ne fait pas

- **Pas de NLP magique** : comprendre « les projets hydrogène allemands
  depuis 2021 » en une phrase est le travail de la **P4** (la couche
  sémantique du brief). Ici, chaque tag est un choix explicite de
  l'utilisateur — lisible, corrigeable, honnête.
- **Pas de nouveaux endpoints** hors l'extension `organisation=` ci-dessus.
- **Pas de duplication** : la palette ⌘K reste la navigation rapide
  (aller à une fiche) ; la barre composable est la construction d'une
  *liste de travail*. Même moteur de suggestions, deux gestes.

## 5. Lots proposés (après itération)

1. **Lot A — la barre sur `/projects`** : tags pays / bailleur /
   programme / années + texte libre, suggestions typées, URL, résultats
   live. (Le gros du geste.)
2. **Lot B — `/organisations`** au même modèle.
3. **Lot C — le tag organisation** : l'extension backend `organisation=`
   + le tag « participant » sur les projets.
4. **Lot D — facettes → poseurs de tags** et l'état vide repensé.

Chaque lot passe la checklist de recette (10 pièges, « aucun texte
tronqué », clavier complet — la barre est un combobox APG, comme la
palette).
