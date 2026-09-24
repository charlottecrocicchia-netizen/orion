# Lancer Orion en local

[Accueil du dépôt](../README.md) · [Documentation](README.md) · [Architecture](architecture.md)

Ce guide lance une instance de développement sur votre machine. Il ne donne pas accès aux comptes ni aux données privées du service hébergé.

## 1. Préparer les outils

| Outil | Utilisation |
|---|---|
| Git | Récupérer le dépôt. |
| Docker et Docker Compose | Exécuter PostgreSQL 16 avec pgvector. |
| [uv](https://docs.astral.sh/uv/) | Installer Python et les dépendances du backend ; Python ≥ 3.12. |
| Node.js 24 et pnpm 11 | Installer et lancer le frontend, comme en CI. |

Vérifiez que le moteur Docker est démarré et que `docker compose version`, `uv --version`, `node --version` et `pnpm --version` répondent.

Sur macOS, conservez le dépôt dans un répertoire non synchronisé avec iCloud, par exemple `~/dev/orion`. Le Makefile place l’environnement Python dans `~/.venvs/orion-backend` pour éviter les problèmes de synchronisation des environnements virtuels.

## 2. Installer et démarrer

Depuis un terminal :

```bash
git clone https://github.com/charlottecrocicchia-netizen/orion.git
cd orion
make bootstrap
make migrate
./scripts/claude-dev.sh
```

`make migrate` démarre la base et applique les migrations. Le script lance ensuite l’API sur le port **8000** et le frontend sur **5173**, avec une configuration de connexion locale.

Ces commandes arrêtent l’autre pile Docker locale d’Orion avant de démarrer la base de développement : n’utilisez pas simultanément les deux modes.

## 3. Se connecter

1. Ouvrez [localhost:5173/login](http://localhost:5173/login).
2. Saisissez **`dev@lensorion.test`**, l’adresse fictive autorisée par le script.
3. Envoyez le formulaire, puis cliquez sur le **lien de développement** affiché.
4. Validez la connexion sur la page suivante si elle vous le demande.

En mode développement, aucun message ne part par email. Le serveur retourne le lien dans `dev_link`, et l’interface l’affiche. Utilisez `localhost` de façon cohérente plutôt que de mélanger `localhost` et `127.0.0.1`.

Le bouton n’apparaît pas ? Vérifiez que l’API a bien été lancée avec `./scripts/claude-dev.sh`. `make dev` seul ne configure pas la liste des comptes autorisés et refuse donc les connexions par défaut.

## 4. Comprendre la base vide

Un clone contient le code et les migrations, **pas le corpus complet**. Les pages peuvent donc être vides après une installation réussie.

Pour charger les données publiques dans la base de développement :

```bash
make ingest
```

Ce traitement peut durer plusieurs heures et consommer des dizaines de Go entre téléchargements, caches et base. Il n’est pas nécessaire pour lire le code. Certaines sources dépendent de services externes et de leurs disponibilités.

Pour consulter les chargeurs disponibles sans lancer d’ingestion :

```bash
cd backend
UV_PROJECT_ENVIRONMENT="$HOME/.venvs/orion-backend" uv run orion-ingest --help
```

Les obligations annuelles NSF suivent un chargement distinct, absent de `all` : voir le [runbook NSF](runbook-nsf-obligations.md). Les parcours automatisés utilisent leur propre jeu de données de recette via `./scripts/e2e-local.sh` ; ce harnais recrée sa base `orion_e2e` à chaque exécution.

## 5. Repères et commandes

| Adresse ou commande | Rôle |
|---|---|
| `http://localhost:5173` | Interface de développement. |
| `http://localhost:8000/api/health` | Santé de l’API. |
| `http://localhost:5173/api/docs` | Documentation interactive via le proxy frontend, après connexion. |
| `make help` | Liste des commandes disponibles. |
| `make lint` | Analyse statique et vérification du format. |
| `make test` | Tests backend et frontend ; nécessite Docker. |
| `Ctrl+C` dans le terminal du script | Arrêter les serveurs de développement. |
| `make db-down` | Arrêter la base de développement. |

Avant les tests de bout en bout, arrêtez les serveurs qui utilisent les ports 8000 et 4173, puis installez les navigateurs et lancez le harnais :

```bash
(cd frontend && pnpm exec playwright install chromium firefox)
./scripts/e2e-local.sh
```

Sur Linux, Playwright peut aussi demander ses dépendances système. Le harnais est prévu pour Bash et utilise notamment `lsof` et les outils PostgreSQL du conteneur.

## Configuration

Le backend lit les variables **`ORION_*`** de l’environnement. Le fichier [.env.example](../.env.example) décrit notamment la configuration de la pile Docker et de l’authentification. Un `.env` à la racine n’est pas automatiquement chargé par toutes les commandes Python.

| Variable | Rôle |
|---|---|
| `ORION_DATABASE_URL` | Connexion PostgreSQL ; valeur locale par défaut dans `core/config.py`. |
| `ORION_PUBLIC_ORIGIN` | Origine utilisée pour les liens de connexion. |
| `ORION_LOGIN_ALLOWLIST` | Adresses autorisées, séparées par des virgules ; vide = aucun accès. |
| `ORION_AUTH_DEV` | Liens retournés à l’interface sans envoi d’email ; développement uniquement. |
| `ORION_SMTP_*` | Paramètres d’envoi des emails pour une instance hébergée. |

Ne versionnez pas de véritables listes de comptes, secrets ou fichiers `.env`. Utilisez des adresses fictives dans les exemples et les tickets.

## Autre mode : la pile Docker complète

Pour travailler avec PostgreSQL, l’API, le frontend construit et Caddy :

```bash
make up
# Site : http://localhost:8080
make down
```

`make up` crée un `.env` avec un mot de passe de base aléatoire si nécessaire. La connexion applicative reste fermée sans configuration des comptes : ce mode n’est pas le raccourci de développement présenté plus haut. Consultez le [runbook](../infra/README.md) avant de configurer ou déployer une instance.

## Dépannage

| Symptôme | À vérifier |
|---|---|
| Docker ne répond pas | Démarrer Docker Desktop, OrbStack ou Colima, puis relancer `make migrate`. |
| `docker compose` est introuvable | Installer le plugin Compose correspondant à votre installation Docker. |
| Le frontend refuse de démarrer | Utiliser Node.js 24 et pnpm 11, puis refaire `make bootstrap`. |
| Aucun lien de connexion | Employer l’adresse fictive et le script du guide ; vérifier les erreurs du terminal. |
| Les résultats sont vides | La base ne contient pas encore de corpus : voir l’étape 4. |
| Un port est déjà occupé | Arrêter l’ancienne instance avant de relancer ; ne pas lancer plusieurs harnais. |
| Python ne trouve pas les modules | Passer par `make` ou définir `UV_PROJECT_ENVIRONMENT="$HOME/.venvs/orion-backend"` avec `uv`. |

Si le problème persiste, [ouvrez un ticket](https://github.com/charlottecrocicchia-netizen/orion/issues/new/choose) avec la commande, votre système et un extrait de log sans données personnelles.
