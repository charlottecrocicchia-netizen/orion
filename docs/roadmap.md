# Roadmap d'exécution

> Fil de pilotage tenu à jour à chaque validation de la fondatrice.
> Règle inchangée : chaque chantier est proposé, validé, puis exécuté.

## En cours — le chantier design (doctrine, étapes validées une à une)

Référence : [design-doctrine.md](design-doctrine.md).

| Étape | Contenu | Statut |
| --- | --- | --- |
| 1 — Fondations | Tokens typographiques, tabular figures globales, encre/hairlines/une ombre, Geist Mono, StatHero | **Validée** (2026-08-02) |
| 2 — Hero signature | Accueil en actes, hero piné GSAP (scrub), trois entrées éditoriales, footer parchemin | **Validée** (2026-08-02) |
| 3 — Explorateur & listes | Grilles type Attio/Linear, filtres Polaris, sparklines, hover réels ; lien source CORDIS/ANR sur chaque fiche projet | **Validée** (2026-08-02) |
| 3 bis — Globe en acte 3 | Globe V1 photo, constellation de flux, panneau pays, sélection lumineuse (9 retours fondatrice intégrés) | **Livrée** (2026-08-02) — gelée, on y reviendra |
| 4 — Fiches & benchmark | Layout record Attio, barres horizontales, TrajectorySpark | **Validée** (2026-08-02) |
| 5 — Passe anti-« IA » | Audit continu, checklist des 10 pièges à chaque écran | Continue |

## Chantier transverse — parcours & visualisations (conception validée à itérer)

Issu de la [conception parcours](conception-parcours-visualisations.md) et des
[leçons UX de Vega](pieges-vega.md) (2026-08-02). Ordre proposé, révisé après
les huit leçons :

1. **Autocomplete de recherche** — **livré** (2026-08-02, lot 1, recette
   validée).
2. **Hub « poste de veille »** — **livré** (2026-08-02, lot 2, en recette).
3. **Les Angles** sur les Analyses prêtes de l'Explorateur (+ peek Apple).
4. **Le dossier** (maquette, puis print stylesheet) — **priorité montée**
   en recette lot 2 : KAILA en fait un bouton central de fiche
   (« Organisation report »).
4 bis. **Fiche organisation complète** (recette lot 2 vs KAILA) : timeline
   financements/projets, split participé/coordonné, carte des
   collaborateurs.
5. Formes B1-B6 au fil des lots ; **hygiène U2** (constante marque) en
   chemin.

## Ensuite — extension des sources, vague 1

Décision fondatrice (2026-08-02) : après le chantier design, ouvrir la
**vague 1 du rapport sources** — NIH, NSF, SBIR, UKRI, etc. Le rapport
détaillé (périmètre exact, ordre, volumétries) sera versé au repo au
lancement du chantier. Fondations déjà en place : le modèle `funders`
multi-juridictions/multi-devises prévu dès la phase 1.

Points d'attention connus :
- normalisation des montants (devises, années fiscales US/UK) ;
- dédoublonnage inter-sources des organisations (les garde-fous
  identifiants existants s'appliquent) ;
- couverture géographique du globe/carte à étendre au-delà de l'Europe
  (la note d'honnêteté sur la couverture reste de mise) ;
- **flux longue distance sur le globe** : passer les lignes de la
  constellation en géodésiques projetées (les cordes d'écran actuelles ne
  tiennent pas visuellement au transatlantique) ;
- **la couche groupes** (leçon U5 de Vega, décision fondatrice 2026-08-02) :
  hiérarchie **groupe → entités légales** — l'industriel veut voir Thales
  entier, CORDIS donne les filiales. Vue consolidée ET détail par entité ;
  le garde-fou anti-fusion actuel reste (les entités restent vraies), la
  couche groupe s'y superpose. Rejoint les homonymes CNRS et le
  rattachement RNSR. Chantier données majeur, à cadrer avec la vague 1 ;
- **grandes régions « manager »** (décision fondatrice 2026-08-02) : dès
  les sources mondiales, le globe et l'analyse doivent aussi raisonner en
  régions parlantes — Europe, Amérique du Nord, Asie… — comme dimension
  d'agrégation (Explorateur, benchmark, panneaux du globe). Spécification
  couleur retenue : **une teinte par région** (candidates : les six séries
  validées — Europe outremer, Amérique du Nord ochre, Asie teal…),
  l'**intensité continuant d'encoder le montant** dans chaque teinte, et le
  **pays sélectionné à l'encre** — hors de toute teinte de région, déjà en
  place sur le globe depuis 2026-08-02. Toute déclinaison passe au
  validateur de palette avant adoption.

## Puis — phase 5 : les appels (calls)

Cahier des charges enrichi par l'[analyse fonctionnelle de la concurrence]
(analyse-fonctionnelle-concurrence.md) (2026-08-02, à valider) : catalogue
filtrable + matching par description libre avec % de correspondance + test
d'éligibilité rapide + alertes deadlines — les standards du marché — PLUS
nos twists uniques : **alertes sur le passé** (un concurrent gagne un
projet sur mon thème), pont « qui a gagné les calls similaires », et
découverte de partenaires data-driven. Prérequis : la couche groupes
(on s'abonne à « Thales », pas à 12 entités légales) — **différenciateur
frontal confirmé sur pièces** : KAILA fait regrouper 21 entités à la main
(Merge/Cross) à chaque session ; notre couche automatique le rend caduc.

**Hors périmètre assumé** (décision à confirmer) : rédaction IA de
candidatures et gestion post-award (le métier de Granter/Streamlyne — 
l'exécution) ; Orion reste l'intelligence.

Horizon Europe + ANR ouverts, reliés aux tendances (la promesse tenue par
la note « Phase 5 · automne 2026 » sur l'accueil). Navigation passé/futur
(vision §9 du [document d'architecture](architecture-information.md)).

## Horizon — phase 6

Périmètre étendu par l'analyse concurrence (à valider) : + partage
d'équipe (vues partagées, digest d'espace — l'acheteur redistribue),
+ API publique produit (l'OpenAPI interne, avec clés et quotas),
+ essai self-serve / tier gratuit borné (décision de modèle).

Dashboard configurable par persona ; homepage vitrine (le globe d'accueil
de 3 bis en est la première pierre). Voir [phase-6-notes.md](phase-6-notes.md).

## Prérequis go-live (rappel bloquant)

La revue juridique ODbL (ANR) reste un prérequis de mise en production
commerciale — voir [data-sources.md](data-sources.md).
