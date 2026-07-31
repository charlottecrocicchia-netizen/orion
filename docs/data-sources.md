# Registre des sources de données

Registre vivant : chaque source publique ingérée par Orion, avec sa juridiction, sa devise, sa licence vérifiée et sa volumétrie constatée. Conçu multi-pays et multi-devises (amendement du 2026-07-31) — les sources hors Europe s'ajouteront ici sans changement de schéma.

| Source (code) | Juridiction | Devise | Licence (vérifiée) | Cadence de publication | Volumétrie constatée |
|---|---|---|---|---|---|
| CORDIS Horizon Europe (`cordis-horizon`) | UE | EUR | CC BY 4.0 — décision 2011/833/EU, réutilisation commerciale autorisée avec attribution (vérifiée le 2026-07-31 sur la politique de réutilisation de la Commission) | ~mensuelle (dernier rafraîchissement source : 2026-07-21) | 23 278 projets, 144 117 participations (2026-07-31) |
| CORDIS H2020 (`cordis-h2020`) | UE | EUR | idem CC BY 4.0 | figée (programme clos) + corrections | 35 389 projets, 178 967 participations (2026-07-31) |
| CORDIS FP7 (`cordis-fp7`) | UE | EUR | idem CC BY 4.0 | figée (programme clos) | 25 785 projets, 140 063 participations (2026-07-31) |
| ANR (`anr`) | FR | EUR | à vérifier à l'ingestion (attendu : Licence Ouverte 2.0 / Etalab) | annuelle+ | — (à venir) |
| ADEME (`ademe`) | FR | EUR | à vérifier à l'ingestion (attendu : Licence Ouverte 2.0) | continue | — (à venir) |
| LIFE (`life`) | UE | EUR | à vérifier (base CINEA) — source la moins standardisée | ? | — (à venir) |

## URLs officielles

- CORDIS bulk : `https://cordis.europa.eu/data/cordis-HORIZONprojects-csv.zip` · `…/cordis-h2020projects-csv.zip` · `…/cordis-fp7projects-csv.zip`
- Politique de réutilisation Commission : `https://commission.europa.eu/legal-notice_en`

## Attribution à afficher dans le produit

> Contains European Union public data: CORDIS — EU research projects (Horizon Europe, H2020, FP7), © European Union, reused under CC BY 4.0.

(Les mentions ANR/ADEME/LIFE seront ajoutées avec leur ingestion.)

## Notes de qualité constatées (2026-07-31)

- CSV CORDIS : séparateur `;`, décimales à virgule, lignes occasionnellement décalées (~166 sur ~84 k projets, rejetées et comptées `invalid_*`/`suspect_*` dans `ingestion_runs.detail`), 28 participations en doublon dans H2020 (dédupliquées).
- Identité des organisations : le PIC fusionne naturellement les organisations entre les trois cadres (80 225 organisations brutes avant l'étape de dédoublonnage flou du plan).
- Total CORDIS constaté : **84 452 projets**, cohérent avec la cible du brief (~106 k avec ANR + ADEME + LIFE).
