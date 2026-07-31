# ADR 0002 — Modèle de données publiques et architecture d'ingestion

- **Statut : Accepté** (2026-07-31 — découle du plan de phase 1 validé et de son amendement multi-pays/multi-devises)
- **Décideurs : Charlotte (fondatrice), Claude (développement)**

## Contexte

La phase 1 charge l'historique des projets R&D financés (~106 k projets, ~61 k organisations attendus) depuis CORDIS (Horizon Europe, H2020, FP7), l'ANR, l'ADEME et LIFE. Amendement de la fondatrice à la validation : **le modèle et le registre des sources doivent être multi-pays et multi-devises dès maintenant** — des sources hors Europe (US, UK, Japon…) arriveront plus tard. Contraintes héritées du brief : traçabilité de chaque enregistrement (§4.3), dédoublonnage des organisations traité comme un vrai sujet (§4.1), reconstruction en une commande (leçon 2), mises à jour planifiées et journalisées (leçon 5), schéma qui n'entre pas en collision avec le multi-tenant de la phase 6 (leçon 4).

## Décision 1 — Modèle : le bailleur comme clé de voûte

Toute donnée de financement se rattache à un **`funder`** (bailleur) porteur de la juridiction (`EU`, `FR`, demain `US`, `UK`, `JP`) et de la devise par défaut. Les programmes forment une hiérarchie `funder → programme parent → programme` (Horizon Europe → cluster ; ANR → AAPG). Les appels (`calls`) sont rattachés au bailleur et réutilisés en phase 5 pour les appels à venir.

Tables : `funders`, `programmes`, `calls`, `projects`, `organisations`, `organisation_identifiers`, `organisation_aliases`, `participations`, `topics`, `project_topics`, `countries`, `exchange_rates` (+ `ingestion_runs` existante, enrichie d'un champ `detail` JSONB).

Unicité et provenance : chaque ligne issue d'une source porte `source`, `source_id` (unicité `(source, source_id)`), `first_imported_at` et `last_seen_at` ; les projets conservent en plus leur payload brut en JSONB — on peut re-mapper sans re-télécharger. Les participations, sans identifiant naturel stable, portent un `source_uid` construit (`projet:organisation:ordre`), unique par source ; leur matière brute est couverte par le payload projet et les alias d'organisations.

## Décision 2 — Multi-pays

- **Pays : ISO 3166-1 alpha-2 partout**, normalisés à l'ingestion. Les codes propres aux données UE sont convertis (`EL` → `GR`, `UK` → `GB`) ; la valeur brute reste dans le payload. Référentiel `countries` (code, nom anglais, région, membre UE) seedé par l'ingestion — les noms localisés à l'écran viendront de `Intl.DisplayNames` côté frontend, pas de la base.
- **Identifiants d'organisations : table `organisation_identifiers` (schéma, valeur)** avec unicité `(scheme, value)` — schémas actuels `pic` (UE), `siren`/`siret` (FR) ; `ror` réservé pour l'identité internationale, `uei` (US) ou autres s'ajouteront sans migration. Aucune colonne d'identifiant national codée en dur.
- **Langues : champs textuels tagués** (`title_lang`, `abstract_lang`, ISO 639-1) — CORDIS est en anglais, l'ANR en français, les sources futures apporteront d'autres langues ; la recherche (phase 2) s'appuiera sur ces tags.
- Le registre `docs/data-sources.md` porte pour chaque source : juridiction, devise, licence vérifiée, attribution, cadence, volumétrie.

## Décision 3 — Multi-devises

- Les montants sont stockés **en devise d'origine** (`amount` + `currency` ISO 4217) **et jamais écrasés**.
- Une **contre-valeur EUR** (`amount_eur`) est calculée à l'ingestion pour les agrégations inter-sources : taux **annuel moyen** de la table `exchange_rates` (source : taux de référence BCE, publics), l'année de référence étant **l'année de début du projet** (à défaut : année de signature, puis année d'import). Pour les sources en euros, `amount_eur = amount`.
- Taux manquant → `amount_eur` NULL + comptage en anomalie dans le journal d'ingestion ; jamais de taux inventé. La contre-valeur est **recalculable** à tout moment puisque montant et devise d'origine sont conservés.
- `exchange_rates` reste vide tant que toutes les sources sont en EUR ; elle se remplit avec la première source USD/GBP/JPY.

Option écartée : convertir à l'import au taux du jour — non reproductible (deux ingestions du même dataset donneraient des chiffres différents) et destructeur d'information.

## Décision 4 — Dédoublonnage des organisations

1. **Fusion par clés exactes d'abord** : même identifiant (`pic`, `siren`…) → même organisation canonique. Entre les trois cadres CORDIS, le PIC fusionne naturellement les organisations dès l'ingestion.
2. **Rapprochement flou ensuite** (étape dédiée du plan) : nom normalisé (casse, accents via `unaccent`, formes juridiques) + pays, similarité trigramme `pg_trgm` avec **seuil prudent — précision avant rappel**. Toute fusion floue est traçable via `organisation_aliases`.
3. **Métriques publiées** en fin de phase : taux de fusion, doublons résiduels estimés sur échantillon. L'amélioration continue (ROR, embeddings) est un sujet de phase 3.

## Décision 5 — Architecture d'ingestion

- Un module par source dans `orion/ingest/`, orchestré par une CLI `orion-ingest <source|all>` (et `make ingest`).
- **Téléchargement avec cache** (`data/`, jamais commité) : skip si la source n'a pas changé (Last-Modified/ETag, taille).
- **Validation Pydantic à l'entrée** : une ligne invalide est comptée et journalisée, pas insérée silencieusement ; un taux d'invalidité anormal fait échouer le run.
- **Upserts idempotents** par lots (`INSERT … ON CONFLICT`) : rejouer une ingestion converge vers le même état (prouvé par test). `make ingest` = reconstruction complète ; le scheduler rejouera les mêmes upserts en incrémental.
- **Journalisation** : chaque exécution écrit dans `ingestion_runs` (statut, volumes, anomalies, durée) — c'est la matière du tableau de bord M5 et de l'endpoint de fraîcheur.
- **Référentiels seedés par l'ingestion, pas par les migrations** : les migrations restent du DDL pur ; `orion-ingest reference` (idempotent, inclus dans `all`) remplit `countries` et `funders`.
- **CI sans réseau** : les tests de parseurs tournent sur des fixtures committées (quelques Ko) ; le test d'intégration prouve l'idempotence sur le Postgres de service.

## Décision 6 — Réservations multi-tenant (leçon 4)

Les tables publiques ci-dessus sont **communes à tous les clients** et ne portent jamais de colonne client. Les futures tables privées (phase 6) seront préfixées `workspace_*` (`workspaces`, `workspace_members`, `workspace_lists`, `workspace_alerts`, `workspace_notes`…) et porteront systématiquement `workspace_id`. Aucun nom réservé n'est utilisé par le schéma public ; l'isolation par client se fera au niveau requête + politiques applicatives.

## Conséquences

- Ajouter une source US/UK/JP = un module d'ingestion + une ligne `funders` + des taux dans `exchange_rates` ; **zéro migration de schéma**.
- Les agrégations inter-sources (phases 2-3) utilisent `amount_eur` ; les fiches détaillées affichent la devise d'origine.
- Le payload brut JSONB coûte quelques centaines de Mo à l'échelle cible — accepté pour la re-mappabilité (leçon 2 : la base reste jetable et reconstructible).
- Infra : l'image Postgres passe à une image pgvector-ready (extension `vector` activable en phase 3 sans changement d'infra) ; `unaccent` et `pg_trgm` sont activées dès maintenant.
