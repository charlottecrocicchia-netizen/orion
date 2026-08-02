# Leçons d'une spécification externe

**Statut : trié le 2026-08-02.** Source : document de spécification généré
par une autre IA sur le benchmark de la fondatrice — **matériau
d'inspiration, pas cahier des charges** (calibré pour une équipe de 15,
ignore l'existant d'Orion, stack étrangère). Non committé ; leçons
reformulées ci-dessous, chaque adoption avec sa destination.

## ① Adopté — et où ça atterrit

| Idée (reformulée) | Destination |
|---|---|
| **Le rapport par blocs, chaque affirmation citée** : un livrable est un assemblage de blocs versionnés — chacun porte sa vue, sa requête, la date des données et ses sources ; aucun chiffre orphelin | **Spec du lot 4 (le dossier)** — notre atout natif : chaque vue Explorateur EST déjà une URL reproductible, le « snapshot » est gratuit |
| **Deux régimes, guidé et expert, sur les mêmes objets** — jamais deux produits | Principe nommé dans la [conception parcours](conception-parcours-visualisations.md) ; déjà en germe (texte libre + Analyses prêtes + Angles = guidé ; composeur = expert) |
| **Navigation par intentions** (découvrir / analyser / construire / retrouver) plutôt que par tables | Chantier « première visite » (avec les patterns KAILA) — nos portes d'intention en sont la V1 |
| **Le score de correspondance toujours DÉCOMPOSÉ, jamais unique** ; un critère inconnu n'est pas un critère incompatible ; l'exclusion dure se fait avant le classement | **Cahier P5 (matching/éligibilité)** — rejoint nos seuils d'honnêteté |
| **La fiche à structure stable avec un volet Sources/provenance** | Backlog « fiche organisation complète » (lot 4 bis) ; les pills et la consolidation en sont l'amorce |
| **Provenance par champ + conflits exposés, jamais écrasés en silence** | Principe données de la **vague 1** (les sources US multiplieront les conflits) ; notre garde-fou anti-fusion l'applique déjà aux organisations |
| **« Chaque résultat est un objet de travail »** (retenir, exclure, suivre, ajouter au rapport) | « Ajouter au dossier » (lot 4) en est le premier verbe ; les autres attendent les comptes (P6) |

## ② Bon mais prématuré — daté dans la roadmap

- **Workspace collaboratif** (commentaires, approbations, journal de
  décisions, diff de rapports) → P6, enrichit le « partage d'équipe » déjà
  noté.
- **Recherche hybride sémantique + reranking expliqué** → P4 (la couche
  LLM du brief) ; principes retenus : le lexical et les identifiants
  d'abord, l'explication de chaque classement.
- **Pointeurs d'API sources US/UK** (Grants.gov, NIH, NSF, SBIR,
  USAspending, UKRI) et cadences de fraîcheur par source → dossier
  d'instruction de la **vague 1**.
- **Taxonomie fédérée multi-référentiels** (correspondances EuroVoc, NACE,
  taxonomies client) → chantier catégorisation permanent (leçon U6),
  vague 1+.
- **Constructeur de consortium** (matrice de complémentarité, axes
  multiples plutôt qu'un score) → P5+, affine notre R6 (découverte de
  partenaires data-driven).
- **Exports Word/PowerPoint natifs** → après le dossier V1 (print
  d'abord) ; seulement si la demande client le prouve.

## ③ Rejeté — un motif par ligne

- **La stack** (Elasticsearch, Next.js, ClickHouse, Redis, Dagster,
  Temporal, Neo4j…) : notre ADR 0001 tient — Postgres + FTS + caches
  tiennent nos budgets **mesurés** (< 300 ms) ; on ne réarchitecture pas
  sur des hypothèses.
- **Microservices, BFF, gateway** : monolithe modulaire acté (et la spec
  elle-même le recommande au départ).
- **Équipe de 15, 100-160 personnes-mois, gantt à 18 mois** : sans objet —
  Orion livre par phases validées, pas par trimestres d'effectifs.
- **Hypothèses de dimensionnement** (5-50 M d'enregistrements, 99,9 %,
  multi-tenant jour 1) : non mesurées ; nos volumes réels décident.
- **Deux interfaces séparées guidé/expert** : un seul produit, deux
  régimes — la doctrine préfère la densité lisible au dédoublement.
- **La formule de score à huit coefficients** : le principe de
  décomposition est adopté (①), la pondération inventée ne l'est pas —
  nos coefficients naîtront des données et des retours réels.
- **Le mélange des noms Vega/Orion** : Vega est un souvenir dont on tire
  des leçons ([pieges-vega.md](pieges-vega.md)), pas un produit à
  spécifier.
