# Phase 0 — Fondations

- **Statut : terminée le 2026-07-31** (tag `v0.0.1`)
- **Amendement à la validation** : pas de mise en ligne — aucun hébergeur pour l'instant. La démo de fin de phase est la stack de production complète tournant **en local via Docker** ; le pipeline de déploiement (images GHCR, CI, script VPS générique, runbook) est livré prêt à brancher sur une cible future.
- **Objectif : un « hello world » Orion complet** — repo propre, squelette modulaire, CI verte, stack de production locale, mise en ligne future réduite à une formalité.

## Décisions actées le 2026-07-31

- ADR 0001 accepté (stack FastAPI + PostgreSQL + React/Vite + Docker Compose + GitHub Actions)
- Repo GitHub privé `orion` sous le compte `charlottecrocicchia-netizen`
- Convention de langue : code, commits et README en anglais ; ADR et échanges en français
- Hébergement différé : cible locale Docker en attendant le choix d'un hébergeur

## Livrables (définition du « fini »)

- [x] `make up` lance la stack de production complète en local (Postgres + API + web statique + Caddy) ; la page d'accueil Orion s'affiche sur http://localhost:8080 (placeholder soigné, dark mode)
- [x] `GET /api/health` renvoie l'état de l'API et de la base ; `/api/docs` sert l'OpenAPI
- [x] CI verte sur GitHub Actions : lint, types, tests backend et frontend, build des images (run n°1 vert en 1 min 44)
- [x] Un push sur `main` publie les images `orion-api` et `orion-web` sur GHCR ; un job de déploiement déclenchable existe (il n'attend que les secrets du futur serveur)
- [x] `infra/deploy.sh` générique (tout VPS Docker) + runbook `infra/README.md` : la mise en ligne future = créer un serveur, renseigner 3 secrets, lancer le job
- [x] Un développeur tiers peut lancer le projet en local en < 15 minutes avec le seul README (`brew install … && colima start`, `make bootstrap`, `make dev`)
- [x] Aucun secret ni artefact de build dans le repo ; `.env.example` documenté
- [x] Tag `v0.0.1`, CHANGELOG initialisé, ADR 0001 en « Accepté »

## Étapes

1. **Outillage local** : uv, pnpm, Colima/Docker (constat initial : brew, Node et Python déjà présents ; Docker, pnpm, uv manquants).
2. **Repo et hygiène** : `git init -b main`, `.gitignore`, repo GitHub privé via `gh`, arborescence `backend/`, `frontend/`, `infra/`, `docs/`, premier commit documentaire.
3. **Squelette backend** : FastAPI modulaire (`core/`, `api/`, `models/`, places réservées `ingest/`, `search/`, `analytics/`), configuration par variables d'environnement, Alembic avec migration 0001 (table `ingestion_runs` — prouve le circuit de migrations et servira dès la phase 1), `GET /api/health` vérifiant la base, tests pytest.
4. **Squelette frontend** : Vite + React + TS, Tailwind + composants shadcn-style, layout minimal avec identité provisoire, dark mode, i18n EN/FR, carte d'état système branchée sur l'API, test vitest.
5. **Conteneurs et dev local** : Dockerfiles `api` et `web`, `compose.dev.yml` (Postgres seul, hot reload natif), `Makefile` (`dev`, `test`, `lint`, `build`, `up`).
6. **CI** : GitHub Actions — lint + types + tests + builds sur chaque PR ; sur `main`, publication des images sur GHCR ; job `deploy` en `workflow_dispatch`, gardé par la présence des secrets.
7. **Kit de mise en ligne (différée)** : `infra/compose.prod.yml` + Caddy (HTTPS automatique dès qu'un domaine existera), `infra/deploy.sh` générique, runbook pas à pas — sans serveur cible pour l'instant.
8. **Recette** : vérification de chaque livrable, tag `v0.0.1`, entrée CHANGELOG.

## Hors périmètre (volontairement)

- Aucune donnée réelle — l'ingestion est la phase 1
- Pas d'auth ni de comptes — le schéma les prévoit dès la phase 1, l'UI arrive en phase 6
- Pas d'identité visuelle définitive — proposition logo/palette en phase 2
- Pas de mise en ligne effective — tout est prêt pour le jour où un hébergeur sera choisi

## Estimation

- Développement : une session de travail
- Fondatrice : rien à faire — le choix d'hébergeur et le domaine sont repoussés à la mise en ligne

## Risques identifiés

| Risque | Parade |
|---|---|
| Docker via Colima sur M1 avec 8 Go de RAM | VM dimensionnée sobrement (2 CPU / 3 Go), suffisante pour Postgres + builds ; Docker Desktop/OrbStack restent possibles plus tard |
| Pas de serveur cible pour valider le déploiement réel | Le job deploy et le script sont testés « à blanc » (garde-fous, dry-run) ; la stack prod locale valide le reste (images, Caddy, migrations au démarrage) |
