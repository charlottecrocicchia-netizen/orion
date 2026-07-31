# ADR 0001 — Stack technique initiale

- **Statut : Accepté** (2026-07-31)
- **Date : 2026-07-31**
- **Décideurs : Charlotte (fondatrice), Claude (développement)**
- **Amendement (2026-07-31)** : la mise en ligne est différée — pas d'hébergeur pour l'instant. La cible devient une stack de production complète fonctionnant **en local via Docker**, avec l'intégralité du pipeline de déploiement (images, CI, script VPS générique) prêt à brancher sur une cible plus tard.

## Contexte

Le brief fondateur ([BRIEF.md](../../BRIEF.md)) impose des contraintes de résultat, pas de moyens : ~110 000 projets et ~61 000 organisations à terme, vraie recherche full-text avec facettes, API documentée (OpenAPI), frontend au niveau des produits data premium, coût d'hébergement initial < 30 €/mois, tests et CI dès le début, secrets hors du repo. S'y ajoutent les cinq leçons de Vega (§3 du brief) : modularité dès le premier commit, base entièrement reconstructible par scripts, déploiement répétable dès le jour 1, auth/multi-tenant pensés dès le schéma, mises à jour automatisées et journalisées.

Autre donnée de contexte : un seul développeur (Claude), une fondatrice ingénieure concentrée sur le produit. La stack doit donc minimiser le nombre de systèmes à opérer et de langages à maintenir.

## Décision

### Backend et API — Python 3.12+ / FastAPI

- **FastAPI + Pydantic v2** : l'OpenAPI est générée nativement (exigence §6 satisfaite d'office, et socle des futurs accès API clients) ; Pydantic sert aussi de validation de schéma pour l'ingestion — chaque enregistrement entrant est validé avant d'atteindre la base (§4.3).
- **SQLAlchemy 2 + Alembic** : ORM éprouvé et migrations versionnées dès la première table.
- **Pourquoi Python** : le cœur de la valeur d'Orion est la qualité de l'ingestion de données publiques hétérogènes (CSV/JSON/API de CORDIS, ANR, ADEME, LIFE, Funding & Tenders). Python est le langage le mieux outillé pour ce travail, et le SDK Anthropic y est de première classe pour la phase 4 (couche langage naturel).
- **Modularité imposée** (leçon n°1) : paquets `ingest/` (un module par source), `api/` (routeurs par domaine), `search/`, `analytics/`, `models/`, `core/` (config, base). Règle de conduite : pas de fichier qui dépasse ~300 lignes sans justification ; un monolithe *modulaire* — un seul déployable, des frontières internes nettes.
- Outillage : `uv` (environnements et dépendances), `ruff` (lint + format), `pytest`.

### Base de données — PostgreSQL 16+, et rien d'autre

Un seul moteur couvre quatre besoins qui, ailleurs, exigeraient trois services :

1. **Relationnel** : projets, organisations, participations, programmes, appels, thématiques.
2. **Recherche full-text** : `tsvector` + index GIN, extension `unaccent` (corpus bilingue FR/EN), requêtes `websearch_to_tsquery`. À ~110 k documents, temps de réponse attendu en dizaines de millisecondes.
3. **Dédoublonnage des noms d'organisations** : extension `pg_trgm` (similarité trigramme) — le brief en fait un sujet de premier rang, le moteur le traite nativement.
4. **Sémantique** (phases 3-5) : extension `pgvector` pour les embeddings (matching de calls, découverte de partenaires).

**Pourquoi pas Elasticsearch / Meilisearch / Typesense** : à cette échelle ils n'apportent rien de mesurable et coûtent un service de plus à héberger, opérer, synchroniser et sauvegarder. **Critère de bascule documenté** : si le corpus dépasse ~1 M de documents ou si le p95 de la recherche dépasse 300 ms malgré une indexation correcte, ouvrir un ADR pour un moteur dédié.

**Reconstructibilité** (leçon n°2) : la base n'est jamais un artefact précieux — `make ingest` la reconstruit de zéro depuis les sources publiques ; les sauvegardes (`pg_dump` quotidien) ne protègent que le temps de reconstruction et les données privées des clients (espaces de travail, phase 6).

### Frontend — React + TypeScript, SPA Vite

- **Vite + React + TypeScript**, servie en fichiers statiques : aucune infrastructure Node en production, vitesse perçue maximale, séparation nette avec l'API.
- **Tailwind CSS + shadcn/ui** (composants sur base Radix, possédés dans le repo et entièrement personnalisables) : c'est le chemin le plus court vers la barre design fixée au §7 (Linear, CB Insights) sans réinventer chaque composant, avec dark mode natif.
- **TanStack Query** (cache et états de chargement — squelettes exigés au §7), **TanStack Table** (tables denses, virtualisation), **React Router**.
- **Dataviz : ECharts** (pressenti — confirmé par un ADR en phase 3) : couvre cartes, graphes de partenariats et séries temporelles dans une seule bibliothèque.
- **i18n dès le premier écran** : anglais par défaut, français en option ; aucune chaîne en dur.
- Si le SEO des pages publiques devient un enjeu (phase 6), pré-rendu statique de landing/pricing — pas de SSR complet.

### Infrastructure — Docker Compose sur un VPS européen, Caddy en frontal

- **Docker Compose** avec quatre services : `postgres`, `api`, `web` (statique servi par Caddy), `scheduler`.
- **Caddy** : HTTPS automatique (Let's Encrypt), reverse proxy vers l'API, sert le frontend.
- **VPS UE — différé** (amendement du 2026-07-31) : quand la question se posera, Hetzner recommandé, Scaleway en alternative « données en France » ; de l'ordre de 8-15 €/mois pour 4 vCPU / 8 Go, largement dimensionné pour le volume cible. En attendant, la même stack Compose tourne intégralement en local via Docker.
- **Sauvegardes** : snapshots de l'hébergeur + `pg_dump` quotidien vers un stockage objet (~1-2 €/mois). Total infra visé : **< 20 €/mois**, sous la contrainte des 30 €.
- **Chemin de montée en charge**, dans l'ordre et sans réécriture : VPS plus gros → Postgres managé → séparation des services sur plusieurs machines.

### CI/CD — GitHub Actions

- Sur chaque PR : lint (`ruff`, `eslint`), types (`tsc`), tests (`pytest` avec Postgres de service, `vitest`), build des deux images Docker.
- Sur `main` : push des images vers GHCR, déploiement par SSH (`docker compose pull && up -d`), smoke test sur `/api/health`. `main` déployable en permanence (leçon n°3).
- Secrets : variables d'environnement en production, secrets GitHub pour la CI, `.env` local jamais commité (règle n°3).

### Jobs planifiés — conteneur `scheduler`

- APScheduler dans un conteneur dédié ; chaque exécution est enregistrée en base (source, début/fin, volumétrie, erreurs). C'est cette table qui alimentera le tableau de bord de fraîcheur du module M5 (leçon n°5).

## Options écartées

| Option | Pour | Contre — raison du rejet |
|---|---|---|
| Tout-TypeScript (Next.js + Prisma) | Une seule langue ; déploiement Vercel trivial | L'ingestion de données publiques est nettement mieux outillée en Python ; SSR inutile pour une app derrière login ; OpenAPI moins naturel |
| Django (+ DRF ou Ninja) | Auth et admin « gratuits » | Plus lourd pour une API-first ; l'admin M5 sera de toute façon une vraie page du produit ; FastAPI plus léger et plus moderne pour le même résultat |
| SQLite | Zéro ops | Exclu : leçon Vega n°2 (reproductibilité, WAL), écritures concurrentes, production multi-utilisateurs |
| Moteur de recherche dédié (Elastic, Meili…) | Facettes et scoring riches | Surdimensionné à 110 k documents ; un service de plus à payer et opérer ; critère de bascule documenté ci-dessus |
| PaaS (Vercel, Railway, Fly.io) | Moins d'ops | Coût moins prévisible (Postgres managé + services facturés à l'unité), contrôle moindre ; revu si l'ops du VPS devient un poids |

## Conséquences

- **Positif** : un serveur, une base, deux langages (Python, TypeScript) — surface minimale pour tout contributeur futur ; sauvegarder = `pg_dump` ; coût total < 20 €/mois ; l'exigence OpenAPI et la validation d'ingestion sortent « gratuitement » du choix FastAPI/Pydantic.
- **Prévu dès la phase 1** : le schéma inclut les notions de compte, organisation cliente et espace de travail (leçon n°4), même si l'UI d'auth n'arrive qu'en phase 6.
- **Accepté** : deux écosystèmes (Python + TS) à maintenir — chacun est le meilleur outil de son côté ; l'ops du VPS nous incombe — compensé par Compose, la doc `infra/` et le chemin PaaS/managé si besoin.
