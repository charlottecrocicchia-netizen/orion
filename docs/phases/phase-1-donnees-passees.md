# Phase 1 — Données passées

- **Statut : terminée le 2026-07-31** (tag `v0.1.0`)
- **Amendements à la validation** : (a) FP7 inclus ; (b) le modèle de données et le registre des sources sont conçus **multi-pays et multi-devises** dès maintenant — des sources hors Europe (US, UK, Japon…) seront ajoutées plus tard. Concrètement : table `funders` (bailleur, juridiction, devise par défaut), montants stockés en devise d'origine + contre-valeur EUR calculée (table `exchange_rates`, politique documentée dans l'ADR 0002), identifiants d'organisations extensibles par schéma (PIC, SIREN/SIRET, ROR réservé…), pays normalisés ISO 3166-1, langues taguées sur les champs textuels.
- **Objectif : la base Orion contient l'historique des projets R&D financés en Europe et en France** (~106 000 projets et ~61 000 organisations attendus, chiffres du brief), **reconstructible de zéro en une commande** (`make ingest`), avec mises à jour automatiques planifiées et traçabilité complète de chaque enregistrement.

## Modèle de données cible (formalisé dans l'ADR 0002 au démarrage)

Entités publiques, migrées par Alembic :

- **`funders`** — le bailleur (Commission européenne, ANR, ADEME…, demain NSF, UKRI, JSPS) avec juridiction et devise par défaut : la clé de voûte du multi-pays
- **`projects`** — acronyme, titre, résumé (avec langue), dates, coût total et financement **en devise d'origine + contre-valeur EUR**, statut, bailleur, programme, appel d'origine, lien officiel
- **`organisations`** — nom canonique, pays (ISO 3166-1), ville, type d'acteur, géolocalisation
- **`organisation_identifiers`** — identifiants par schéma extensible (PIC, SIREN, SIRET… ROR réservé pour l'international) : aucun identifiant national codé en dur
- **`participations`** — projet × organisation : rôle (coordinateur/partenaire), pays, montant (devise + EUR)
- **`programmes`** — hiérarchie bailleur → cadre → programme (Horizon Europe → cluster, ANR → AAPG…)
- **`calls`** — appels d'origine des projets (la table sera étendue en phase 5 pour les appels à venir)
- **`topics`** — classifications thématiques par source (euroSciVoc pour CORDIS, axes ANR…) ; l'unification inter-sources est un sujet de phase 3
- **`organisation_aliases`** — chaque libellé brut rencontré (source, nom, pays) relié à l'organisation canonique : c'est le support du dédoublonnage
- **`countries`** et **`exchange_rates`** — référentiels : pays ISO (région, membre UE) et taux de change annuels pour la contre-valeur EUR (vides de taux tant que toutes les sources sont en EUR)

Traçabilité (§4.3 du brief) : chaque ligne garde sa source, son identifiant source, ses dates de première/dernière importation et son payload brut (JSONB) — on peut re-mapper sans re-télécharger.

Multi-tenant (leçon 4) : l'ADR 0002 documente les conventions et le nommage des futures tables comptes/espaces de travail (phase 6) pour qu'aucun choix de schéma public ne les contredise ; rien n'est créé maintenant.

Extensions Postgres activées dès cette phase : `unaccent`, `pg_trgm` (dédoublonnage) ; bascule de l'image vers une image pgvector-ready pour que `vector` soit activable en phase 3 sans migration d'infra.

## Étapes

1. **ADR 0002 + schéma** : migrations du modèle ci-dessus ; création du registre `docs/data-sources.md` (URL officielle, licence vérifiée, mention d'attribution, cadence de publication, volumétrie constatée — pour chaque source).
2. **Socle d'ingestion commun** (`orion/ingest/`) : téléchargement avec cache local (`data/`, gitignoré, skip si source inchangée via ETag/Last-Modified), validation Pydantic à l'entrée, upserts idempotents sur (source, id source), journalisation dans `ingestion_runs`, CLI `orion-ingest <source|all>` et cible `make ingest`.
3. **CORDIS — Horizon Europe puis H2020** (datasets bulk officiels : projets, organisations/participations, thématiques euroSciVoc). FP7 selon la question ouverte ci-dessous.
4. **ANR** (données ouvertes : projets financés + partenaires).
5. **ADEME** (aides publiées en open data ; périmètre par défaut : dispositifs recherche/innovation — les aides hors R&D n'entrent pas, pour ne pas polluer les analyses ; ajustable quand on verra les données réelles).
6. **LIFE** (base publique CINEA — la source la moins standardisée, voir risques).
7. **Dédoublonnage des organisations** (le « vrai sujet » du brief) : fusion par clés exactes d'abord (PIC, SIREN/SIRET), puis rapprochement nom normalisé + pays via pg_trgm avec seuil prudent (précision avant rappel) ; métriques publiées en fin de phase (taux de fusion, doublons résiduels estimés sur échantillon).
8. **Automatisation** (leçon 5) : conteneur `scheduler` activé dans la stack (rafraîchissement hebdomadaire incrémental, chaque exécution journalisée), endpoint `GET /api/sources` (fraîcheur + volumétrie par source), bloc « Données » sur la page d'accueil (X projets · Y organisations · mis à jour le …).
9. **Recette** : critères ci-dessous, CHANGELOG, tag `v0.1.0`.

## Livrables (définition du « fini »)

- [x] `make ingest` part d'une base vide et reconstruit tout en une commande (~35-40 min constatées hors téléchargements : CORDIS ~6 min, ANR ~2 min, dédoublonnage ~27 min)
- [x] Volumes au rendez-vous : **119 172 projets** (cible ~106 k dépassée sans ADEME ni LIFE) ; 103 649 organisations — écart vs ~61 k expliqué dans `docs/data-sources.md` (dédoublonnage volontairement prudent)
- [x] Rejouer l'ingestion ne change rien : idempotence prouvée par tests **et** par re-run réel de cordis-horizon (comptes strictement identiques)
- [x] Chaque enregistrement porte source, identifiant source, dates d'import ; payload brut sur les projets
- [x] Tests verts en CI sans réseau : fixtures committées, base de test dédiée créée et migrée par la suite elle-même (26 tests backend)
- [x] Scheduler actif dans la stack locale (cron lundi 03:00 UTC), journal `ingestion_runs` alimenté (échecs compris), `/api/sources` expose fraîcheur et volumétrie
- [x] Démo : la page d'accueil affiche la volumétrie et la fraîcheur réelles (http://localhost:8080)
- [x] Licences vérifiées source par source — CORDIS CC-BY 4.0, ANR **ODbL** (prérequis juridique bloquant du go-live, décision fondatrice), ADEME Licence Ouverte (source écartée), LIFE reporté
- [x] ADR 0002 accepté, CHANGELOG à jour, tag `v0.1.0`

## Décisions fondatrice du 2026-07-31 (arbitrages de sources)

- **ADEME : non ingérée.** La source ouverte est le fichier de transparence des subventions (2,3 % de R&D, pas de filtre fiable) — hors sujet pour le produit. **France 2030** sera visé plus tard comme source française de R&D industrielle.
- **ANR : ingestion maintenue malgré la licence ODbL.** Arbitrage juridique **avant toute mise en ligne publique** — prérequis bloquant du go-live, tracé dans `docs/data-sources.md`.
- **LIFE : reporté**, ne bloque pas la v0.1.0. Piste future : récupération via OpenAIRE.

## Hors périmètre (volontairement)

- Recherche full-text, facettes et fiches (phase 2 — les index FTS arrivent avec la recherche)
- Analytics, unification thématique inter-sources, résolution d'entités avancée (phase 3)
- France 2030 / scanR (« extension possible » du brief — décision séparée après la phase 1)
- Appels à venir (phase 5), auth et comptes (phase 6)

## Risques identifiés

| Risque | Parade |
|---|---|
| LIFE sans export machine exploitable ou licence restrictive | vérification licence d'abord ; scraping léger si permis ; sinon report documenté avec décision dédiée — les 3 autres sources ne l'attendent pas |
| Organisations françaises sans identifiant stable (noms libres) | dédoublonnage prudent, seuils élevés, métriques honnêtes ; l'amélioration continue est un sujet de phase 3 |
| Téléchargements CORDIS volumineux (centaines de Mo) | cache local + reprise ; skip si inchangé ; jamais committé |
| VM Docker à 3 Go de RAM | chargement par lots (COPY/batchs), pas de dataframe géant en mémoire |
| Écart entre volumes attendus et constatés | comptes réels publiés et expliqués plutôt que masqués |

## Estimation

- Développement : 2 à 4 sessions, avec un jalon démontrable après chaque source (CORDIS seul est déjà une démo)
- Fondatrice : rien à fournir — tout est open data, aucun compte ni clé d'API nécessaire

## Question ouverte — tranchée

1. **FP7 (2007-2013) : inclus** (validation du 2026-07-31).
