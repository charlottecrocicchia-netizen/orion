# Roadmap d'exécution

> Fil de pilotage tenu à jour à chaque validation de la fondatrice.
> Règle inchangée : chaque chantier est proposé, validé, puis exécuté.

## En cours — le chantier design (doctrine, étapes validées une à une)

Référence : [design-doctrine.md](design-doctrine.md).

| Étape | Contenu | Statut |
| --- | --- | --- |
| 1 — Fondations | Tokens typographiques, tabular figures globales, encre/hairlines/une ombre, Geist Mono, StatHero | **Validée** (2026-08-02) |
| 2 — Hero signature | Accueil en actes, hero piné GSAP (scrub), trois entrées éditoriales, footer parchemin | **Validée** (2026-08-02) |
| 3 — Explorateur & listes | Grilles type Attio/Linear, filtres Polaris, sparklines, hover réels ; **lien source CORDIS/ANR visible sur chaque fiche projet** | En cours |
| 3 bis — Globe en acte 3 | Le globe remplace la carte sur l'accueil : rotation lente, flux au survol, panneau pays au clic (2 maquettes : photo / sans photo) | Conception en cours, implémentation après validation |
| 4 — Fiches & benchmark | Layout record Attio, barres horizontales | À venir |
| 5 — Passe anti-« IA » | Audit continu, checklist des 10 pièges à chaque écran | Continue |

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
  (la note d'honnêteté sur la couverture reste de mise).

## Puis — phase 5 : les appels (calls)

Horizon Europe + ANR ouverts, reliés aux tendances (la promesse tenue par
la note « Phase 5 · automne 2026 » sur l'accueil). Navigation passé/futur
(vision §9 du [document d'architecture](architecture-information.md)).

## Horizon — phase 6

Dashboard configurable par persona ; homepage vitrine (le globe d'accueil
de 3 bis en est la première pierre). Voir [phase-6-notes.md](phase-6-notes.md).

## Prérequis go-live (rappel bloquant)

La revue juridique ODbL (ANR) reste un prérequis de mise en production
commerciale — voir [data-sources.md](data-sources.md).
