<p align="center">
  <img src="docs/assets/orion-banner.svg" alt="Orion — Explorer les financements publics de la recherche" width="100%">
</p>

<p align="center">
  <a href="https://lensorion.com"><strong>Découvrir le site</strong></a> ·
  <a href="docs/getting-started.md">Démarrer en local</a> ·
  <a href="docs/README.md">Documentation</a> ·
  <a href="CHANGELOG.md">Évolutions</a>
</p>

<p align="center">
  <a href="https://github.com/charlottecrocicchia-netizen/orion/actions/workflows/ci.yml"><img src="https://github.com/charlottecrocicchia-netizen/orion/actions/workflows/ci.yml/badge.svg" alt="État de la CI"></a>
  <img src="https://img.shields.io/badge/Python-3.12%2B-3776AB?logo=python&amp;logoColor=white" alt="Python 3.12 ou supérieur">
  <img src="https://img.shields.io/badge/React-19-149ECA?logo=react&amp;logoColor=white" alt="React 19">
  <img src="https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&amp;logoColor=white" alt="PostgreSQL 16">
</p>

## À quoi sert Orion ?

**Qui finance la recherche, quels projets sont soutenus et quelles organisations y participent ?** Orion rassemble des données publiques de financement de la R&D pour rendre ces questions explorables, du programme de financement jusqu’au projet et à ses bénéficiaires.

Le projet associe une chaîne de traitement de données, une API et une interface d’exploration en français et en anglais. Il couvre notamment les programmes européens **CORDIS**, les financements américains **NIH RePORTER** et **NSF**, ainsi que les appels du portail européen **Funding & Tenders**.

> **Code public, application sur invitation.** Le dépôt présente le travail et son fonctionnement. La page d’accueil de [lensorion.com](https://lensorion.com) est publique ; les outils d’analyse nécessitent un compte autorisé. Le code reste sous le régime **tous droits réservés**.

<details>
<summary><strong>English overview</strong></summary>

Orion makes public R&D funding traceable and explorable. It combines official European and US datasets, organisation identity resolution, a FastAPI backend and a bilingual React interface. Explore projects, organisations, countries, funding programmes and open calls, with explicit source coverage and methodological limits.

The repository is public; the hosted application is invitation-only. Local development instructions are in the [getting-started guide](docs/getting-started.md). All rights reserved; public visibility does not grant an open-source licence.

</details>

## Ce que l’on peut explorer

| Une question | Ce qu’Orion propose |
|---|---|
| Quels projets travaillent sur un sujet ? | Recherche dans les titres et résumés, filtres par pays, programme et bailleur. |
| Qui participe à ces projets ? | Fiches d’organisations, rapprochement des identités et groupes d’entreprises. |
| Où se situent les activités financées ? | Vues par pays et régions, programmes et thèmes. |
| Où va l’argent public ? | Parcours du bailleur vers les programmes, projets et organisations, avec les limites propres à chaque source. |
| Comment lire les montants dans le temps ? | Euros courants ou constants et indicateurs de contexte : PIB, population, parité de pouvoir d’achat, selon les données disponibles. |
| Quelles opportunités suivre ? | Consultation des appels et de leurs échéances ; dossiers dans un espace de travail personnel. |
| Comment étudier un secteur ? | Lentilles thématiques, notamment spatial et aviation, construites à partir de règles de curation versionnées. |

### Un aperçu de l’interface

![Recherche Orion : projets sur l’hydrogène, filtrés par pays et bailleur](docs/assets/project-search.png)

*Capture de développement conservée pour illustrer la recherche et ses filtres. Les chiffres et l’apparence ne constituent pas un état actuel du service.*

## Des chiffres que l’on peut expliquer

Orion distingue les données publiées par les sources, les transformations effectuées et les analyses produites. Une donnée manquante n’est pas un zéro ; un financement observé n’est pas nécessairement une dépense annuelle. Les engagements européens et les obligations américaines ne sont pas interchangeables.

- **Traçabilité** : sources, règles de curation et migrations sont documentées.
- **Couverture explicite** : les résultats décrivent les corpus chargés, pas toute la recherche mondiale.
- **Comparaisons encadrées** : devise, période, nature du montant et données disponibles comptent.

Pour les attributions et conditions propres aux données, voir le [registre des sources](docs/data-sources.md). Pour les choix de calcul, voir le [guide d’architecture](docs/architecture.md).

## Par où commencer ?

| Vous souhaitez… | Point d’entrée |
|---|---|
| Découvrir le projet | Cette page, puis [le site](https://lensorion.com). |
| Lancer le code sur votre machine | [Installation et première connexion](docs/getting-started.md). |
| Comprendre la construction du projet | [Architecture et carte du code](docs/architecture.md). |
| Retrouver une décision ou une méthode | [Index de la documentation](docs/README.md). |
| Signaler un problème ou proposer une amélioration | [Guide de contribution](CONTRIBUTING.md), puis [nouveau ticket](https://github.com/charlottecrocicchia-netizen/orion/issues/new/choose). |

## Démarrage rapide

Prérequis : **Git**, **Docker avec Compose**, **uv**, **Node.js 24** et **pnpm 11** (versions Node/pnpm utilisées en CI).

```bash
git clone https://github.com/charlottecrocicchia-netizen/orion.git
cd orion
make bootstrap
make migrate
./scripts/claude-dev.sh
```

Ouvrez **http://localhost:5173/login**, saisissez `dev@lensorion.test`, puis cliquez sur le lien de développement affiché après l’envoi du formulaire. Aucun email n’est envoyé dans ce mode.

**La base locale est vide au départ.** Le corpus de production n’est pas distribué avec le code. Le [guide de démarrage](docs/getting-started.md) explique le chargement des données, la configuration et le dépannage. Les commandes de développement arrêtent la pile Docker de production locale si elle tourne déjà.

## À l’intérieur du dépôt

```text
orion/
├── backend/          API FastAPI, ingestion, modèles et tests Python
│   ├── src/orion/    Logique métier, recherche et authentification
│   ├── alembic/      Historique des migrations de base de données
│   └── curation/     Référentiels et règles de curation versionnés
├── frontend/         Interface React, TypeScript et Tailwind CSS
│   ├── src/          Pages, composants, traductions et tests unitaires
│   └── e2e/          Parcours de bout en bout avec Playwright
├── infra/            Docker, Caddy et procédures de déploiement
├── scripts/          Outils de développement et de recette
└── docs/             Architecture, méthodes et décisions de conception
```

**Stack :** Python · FastAPI · SQLAlchemy · PostgreSQL/pgvector · React · TypeScript · Vite · Tailwind CSS · Docker · Caddy.

## Qualité et vérification

```bash
make lint               # Python et frontend
make test               # pytest et Vitest ; démarre la base de développement
./scripts/e2e-local.sh   # Playwright dans une base dédiée de recette
```

La [CI GitHub Actions](https://github.com/charlottecrocicchia-netizen/orion/actions/workflows/ci.yml) vérifie le lint, les tests, le build frontend, les parcours de bout en bout et des budgets de latence sur un petit jeu de données. Elle construit également les images Docker après ces vérifications. Le déploiement du service reste manuel : [runbook d’exploitation](infra/README.md).

## Droits et données personnelles

**Tous droits réservés — code propriétaire.** La publication du dépôt ne change pas les droits d’utilisation du logiciel. Les données sources ont leurs propres conditions et attributions, détaillées dans le [registre](docs/data-sources.md).

Les listes de comptes autorisés et les secrets de configuration doivent rester hors du dépôt. Pour un ticket ou une capture, utilisez uniquement des données publiques ou fictives ; voir [CONTRIBUTING.md](CONTRIBUTING.md).
