"""Client de la SEARCH API du portail EU Funding & Tenders (SEDIA).

API publique documentée par la page « APIs » du portail (lue sur pièce
le 2026-08-22 — « available… for further integration with their
internal systems »). Particularités constatées sur le vif :

- POST multipart : les pièces `query` et `languages` doivent être des
  fichiers JSON typés (`application/json`) — en simple champ texte,
  l'API répond 500 ;
- sans `languages`, un même topic revient UNE FOIS PAR LANGUE ;
- la syntaxe de requête est de l'Elasticsearch bool/terms/range ;
- SANS pièce `sort`, l'ordre est « relevance » — instable de page en
  page (constaté sur le vif : deux moissons consécutives différaient de
  ~200 topics). Le tri `identifier:ASC` rend la pagination déterministe.

Politesse (aucun quota publié) : pause entre pages, User-Agent
identifiable, timeout court, échec BRUYANT — l'appelant journalise et
la base reste sur la dernière moisson saine.
"""

import json
import time
from typing import Any

import httpx

SEARCH_URL = "https://api.tech.ec.europa.eu/search-api/prod/rest/search"
FACET_URL = "https://api.tech.ec.europa.eu/search-api/prod/rest/facet"
API_KEY = "SEDIA"
USER_AGENT = "Orion/0.4 (+https://lensorion.com)"
PAGE_SIZE = 100
PAGE_PAUSE_SECONDS = 0.5
TIMEOUT = 60
# Filet contre une pagination qui ne converge pas (réponse anormale) :
# 200 pages × 100 = 20 000 topics, très au-dessus du périmètre E1.
MAX_PAGES = 200

LANGUAGES = ["en"]
SORT = {"field": "identifier", "order": "ASC"}


def _multipart(query: dict[str, Any], with_sort: bool) -> dict[str, tuple[str, str, str]]:
    parts = {
        "query": ("query.json", json.dumps(query), "application/json"),
        "languages": ("languages.json", json.dumps(LANGUAGES), "application/json"),
    }
    # La FACET API refuse la pièce `sort` (500 constaté) — elle n'a pas
    # d'ordre à rendre ; seule la SEARCH API la reçoit.
    if with_sort:
        parts["sort"] = ("sort.json", json.dumps(SORT), "application/json")
    return parts


def fetch_page(
    client: httpx.Client, query: dict[str, Any], page_number: int, page_size: int = PAGE_SIZE
) -> dict[str, Any]:
    response = client.post(
        SEARCH_URL,
        params={
            "apiKey": API_KEY,
            "text": "***",
            "pageSize": str(page_size),
            "pageNumber": str(page_number),
        },
        files=_multipart(query, with_sort=True),
    )
    response.raise_for_status()
    return response.json()


def fetch_all(
    client: httpx.Client, query: dict[str, Any], page_size: int = PAGE_SIZE
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """Toutes les pages d'une requête : (résultats, pages brutes)."""
    results: list[dict[str, Any]] = []
    pages: list[dict[str, Any]] = []
    for page_number in range(1, MAX_PAGES + 1):
        page = fetch_page(client, query, page_number, page_size)
        pages.append(page)
        batch = page.get("results") or []
        results.extend(batch)
        if len(batch) < page_size:
            return results, pages
        time.sleep(PAGE_PAUSE_SECONDS)
    raise RuntimeError(
        f"ft-portal: pagination au-delà de {MAX_PAGES} pages — réponse anormale, moisson refusée"
    )


def fetch_facets(client: httpx.Client, query: dict[str, Any]) -> dict[str, Any]:
    response = client.post(
        FACET_URL,
        params={"apiKey": API_KEY, "text": "***"},
        files=_multipart(query, with_sort=False),
    )
    response.raise_for_status()
    return response.json()


def make_client() -> httpx.Client:
    return httpx.Client(timeout=TIMEOUT, headers={"User-Agent": USER_AGENT})
