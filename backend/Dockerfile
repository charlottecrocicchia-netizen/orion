FROM python:3.13-slim

COPY --from=ghcr.io/astral-sh/uv:0.12 /uv /uvx /usr/local/bin/

ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=never \
    UV_PYTHON_PREFERENCE=only-system \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

COPY . .
RUN uv sync --frozen --no-dev

RUN useradd --create-home appuser && chown -R appuser:appuser /app
USER appuser

# Le tampon de révision (2026-08-17) : l'image dit de quelles sources
# elle est née, et le lanceur du Bureau refuse d'ouvrir une pile dont le
# tampon ne correspond plus. Placé en DERNIER, l'ARG n'invalide que
# cette couche-ci — pas les `uv sync` qui coûtent des minutes.
ARG GIT_REV=inconnu
LABEL org.opencontainers.image.revision=$GIT_REV

EXPOSE 8000
CMD ["./docker-entrypoint.sh"]
