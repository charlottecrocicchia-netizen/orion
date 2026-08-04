.DEFAULT_GOAL := help

# The repo lives in an iCloud-synced folder; keep the Python venv outside of it
# (iCloud mangles .pth files with hidden flags and " 2" conflict copies).
export UV_PROJECT_ENVIRONMENT := $(HOME)/.venvs/orion-backend

COMPOSE_DEV := docker compose -f compose.dev.yml
COMPOSE_PROD := cd infra && docker compose --env-file ../.env -f compose.prod.yml

# ONE STACK AT A TIME. The development database and the production stack
# each run their own PostgreSQL; on the 8 GB machine this project is
# built on, running both means two instances competing for a VM that is
# itself paged out by macOS. Every entry point below stops the other
# side first — measured 2026-08-04, see docs/hebergement.md.

help: ## List available commands
	@grep -hE '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-10s\033[0m %s\n", $$1, $$2}'

bootstrap: ## Install backend and frontend dependencies
	cd backend && uv sync
	@command -v chflags >/dev/null && find backend/.venv -name "*.pth" -exec chflags nohidden {} + || true
	cd frontend && pnpm install

db-up: ## Start the test/dev database (stops the production stack first)
	@$(COMPOSE_PROD) down --remove-orphans >/dev/null 2>&1 || true
	$(COMPOSE_DEV) up -d --wait postgres

db-down: ## Stop the test/dev database
	$(COMPOSE_DEV) down

migrate: db-up ## Apply database migrations
	cd backend && uv run alembic upgrade head

dev: migrate ## Run API (:8000) + web (:5173) with hot reload
	./scripts/dev.sh

test: migrate ## Run backend and frontend test suites
	cd backend && uv run pytest
	cd frontend && pnpm test

lint: ## Lint and check formatting (backend + frontend)
	cd backend && uv run ruff check . && uv run ruff format --check .
	cd frontend && pnpm lint

format: ## Auto-format the backend
	cd backend && uv run ruff format . && uv run ruff check --fix .

build: ## Build production Docker images
	$(COMPOSE_PROD) build

up: .env ## Run the production stack locally (stops the dev database first)
	@$(COMPOSE_DEV) down >/dev/null 2>&1 || true
	$(COMPOSE_PROD) up -d --build --wait
	@echo "Orion is up: http://localhost:8080"

down: ## Stop the production stack
	$(COMPOSE_PROD) down

ingest: migrate ## Rebuild the DEV database from public sources
	cd backend && uv run orion-ingest all

identity: migrate ## Rebuild the DEV identity layer (GLEIF, Wikidata, bridges, groups)
	cd backend && uv run orion-ingest gleif wikidata groups

prod-ingest: ## Load sources INTO THE RUNNING PROD STACK: make prod-ingest SOURCES="nsf dedup"
	@test -n "$(SOURCES)" || (echo "usage: make prod-ingest SOURCES=\"nsf dedup groups\"" && exit 1)
	docker compose --env-file .env -f infra/compose.prod.yml exec -T api \
		uv run --no-sync orion-ingest $(SOURCES)

deploy: ## Deploy to the configured VPS (see infra/README.md)
	./infra/deploy.sh

.env:
	@sed "s/^POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=$$(openssl rand -hex 16)/" .env.example > .env
	@echo "Generated .env with a random database password"

.PHONY: help bootstrap db-up db-down migrate dev test lint format build up down \
        ingest identity prod-ingest deploy
