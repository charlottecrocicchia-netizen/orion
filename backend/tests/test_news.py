"""The news relay: parse, ordering, stale-on-error — no network ever."""

import time

from orion.api import news as news_module

RSS = b"""<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel><title>Feed</title>
<item><title>Newer story</title><link>https://example.eu/a</link>
<enclosure url="https://example.eu/a.jpg" type="image/jpeg"/>
<pubDate>Tue, 28 Jul 2026 15:02:15 +0200</pubDate></item>
<item><title>Older story</title><link>https://example.eu/b</link>
<pubDate>Mon, 20 Jul 2026 12:40:13 +0200</pubDate></item>
<item><title>No link, dropped</title><link></link></item>
</channel></rss>"""


def _reset_cache():
    news_module._cache.update({"items": [], "fetched_at": 0.0, "ever": False})


def test_parses_sorts_and_drops_broken_items(monkeypatch):
    _reset_cache()
    monkeypatch.setattr(news_module, "_fetch_feed", lambda url: RSS)
    items = news_module.news()
    titles = [item["title"] for item in items]
    # One roster fetch per feed, duplicated here — dedupe not needed yet.
    assert titles[0] == "Newer story"
    assert "No link, dropped" not in titles
    assert items[0]["source"] in {feed["source"] for feed in news_module.FEEDS}
    assert items[0]["published"].startswith("2026-07-28")
    # Image enclosures surface; items without one carry None.
    assert items[0]["image"] == "https://example.eu/a.jpg"
    older = next(item for item in items if item["title"] == "Older story")
    assert older["image"] is None


def test_stale_on_error_keeps_last_good_read(monkeypatch):
    _reset_cache()
    monkeypatch.setattr(news_module, "_fetch_feed", lambda url: RSS)
    first = news_module.news()
    assert len(first) > 0
    # Feeds die; the cache expires; the relay must serve the last read.
    monkeypatch.setattr(
        news_module, "_fetch_feed", lambda url: (_ for _ in ()).throw(OSError("down"))
    )
    news_module._cache["fetched_at"] = time.time() - news_module.CACHE_TTL_S - 1
    again = news_module.news()
    assert [item["title"] for item in again] == [item["title"] for item in first]


def test_first_failure_yields_an_honest_empty_list(monkeypatch):
    _reset_cache()
    monkeypatch.setattr(
        news_module, "_fetch_feed", lambda url: (_ for _ in ()).throw(OSError("down"))
    )
    assert news_module.news() == []
