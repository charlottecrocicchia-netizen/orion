.DEFAULT_GOAL := help

# The repo lives in an iCloud-synced folder; keep the Python venv outside of it
# (iCloud mangles .pth files with hidden flags and " 2" conflict copies).
export UV_PROJECT_ENVIRONMENT := $(HOME)/.venvs/orion-backend

COMPOSE_DEV := docker compose -f compose.dev.yml

help: ## List available commands
	@grep -hE '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-10s\033[0m %s\n", $$1, $$2}'

bootstrap: ## Install backend and frontend dependencies
	cd backend && uv sync
	@command -v chflags >/dev/null && find backend/.venv -name "*.pth" -exec chflags nohidden {} + || true
	cd frontend && pnpm install

db-up: ## Start the local dev database (Docker)
	$(COMPOSE_DEV) up -d --wait postgres

db-down: ## Stop the local dev database
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
	cd infra && docker compose --env-file ../.env -f compose.prod.yml build

up: .env ## Run the full production stack locally (http://localhost:8080)
	cd infra && docker compose --env-file ../.env -f compose.prod.yml up -d --build --wait
	@echo "Orion is up: http://localhost:8080"

down: ## Stop the production stack
	cd infra && docker compose --env-file ../.env -f compose.prod.yml down

ingest: migrate ## Rebuild the database from public sources
	cd backend && uv run orion-ingest all

deploy: ## Deploy to the configured VPS (see infra/README.md)
	./infra/deploy.sh

.env:
	@sed "s/^POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=$$(openssl rand -hex 16)/" .env.example > .env
	@echo "Generated .env with a random database password"

.PHONY: help bootstrap db-up db-down migrate dev test lint format build up down ingest deploy
