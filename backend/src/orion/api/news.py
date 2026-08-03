"""Official R&D funding news, relayed for the home ticker.

The browser cannot read the institutional RSS feeds directly (no CORS),
so this endpoint aggregates them server-side: short timeout per feed, a
process-level cache refreshed every 30 minutes, and STALE-ON-ERROR — a
feed going down serves the last good read, and a feed that is empty (the
ANR's currently is) simply contributes nothing. The ticker mixes these
with Orion's computed stories; zero news never breaks it.

Feed roster (probed 2026-08-02): the European Commission's DG R&I news
feed is the one rich official source; CORDIS retired its public news
RSS and the Funding & Tenders portal exposes none — revisit at wave 1.
"""

import threading
import time
import urllib.request
import xml.etree.ElementTree as ET
from email.utils import parsedate_to_datetime
from typing import Annotated, Any

from fastapi import APIRouter, Query

router = APIRouter()

FEEDS = [
    {
        "code": "ec-ri",
        "source": "Commission européenne · R&I",
        "url": "https://research-and-innovation.ec.europa.eu/node/2/rss_en",
    },
    {
        # Valid RSS but EMPTY as of 2026-08-02 — kept configured so items
        # appear the day the ANR fills it; costs one cached fetch.
        "code": "anr",
        "source": "ANR",
        "url": "https://anr.fr/rss",
    },
]

CACHE_TTL_S = 30 * 60
FETCH_TIMEOUT_S = 6
MAX_ITEMS = 8
_UA = "OrionBot/0.1 (owner@example.com) news-relay"

_cache: dict[str, Any] = {"items": [], "fetched_at": 0.0, "ever": False}
_lock = threading.Lock()


def _fetch_feed(url: str) -> bytes:
    request = urllib.request.Request(url, headers={"User-Agent": _UA})
    with urllib.request.urlopen(request, timeout=FETCH_TIMEOUT_S) as response:
        return response.read()


def _parse_feed(raw: bytes, source: str, code: str) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    root = ET.fromstring(raw)
    for item in root.findall(".//item"):
        title = (item.findtext("title") or "").strip()
        link = (item.findtext("link") or "").strip()
        if not title or not link.startswith("http"):
            continue
        published = None
        pub_date = item.findtext("pubDate")
        if pub_date:
            try:
                published = parsedate_to_datetime(pub_date).isoformat()
            except (TypeError, ValueError):
                published = None
        items.append(
            {
                "title": title,
                "url": link,
                "source": source,
                "source_code": code,
                "published": published,
            }
        )
    return items


def _refresh() -> None:
    collected: list[dict[str, Any]] = []
    for feed in FEEDS:
        try:
            collected.extend(_parse_feed(_fetch_feed(feed["url"]), feed["source"], feed["code"]))
        except Exception:  # noqa: BLE001 — a dead feed must never break the relay
            continue
    if collected:
        collected.sort(key=lambda item: item["published"] or "", reverse=True)
        _cache["items"] = collected[:MAX_ITEMS]
        _cache["ever"] = True
    # No harvest at all: keep whatever we had (stale-on-error); first-ever
    # failure leaves an honest empty list.
    _cache["fetched_at"] = time.time()


@router.get("/news")
def news(limit: Annotated[int, Query(ge=1, le=8)] = 8) -> list[dict[str, Any]]:
    stale = time.time() - _cache["fetched_at"] > CACHE_TTL_S
    # One refresher at a time; concurrent readers get the stale copy
    # instead of piling onto the feeds.
    if stale and _lock.acquire(blocking=False):
        try:
            _refresh()
        finally:
            _lock.release()
    return _cache["items"][:limit]
