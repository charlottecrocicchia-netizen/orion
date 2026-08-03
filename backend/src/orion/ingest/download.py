import json
from pathlib import Path
from typing import Any

import httpx

from orion.core.config import get_settings


def cache_dir() -> Path:
    path = Path(get_settings().data_dir) / "cache"
    path.mkdir(parents=True, exist_ok=True)
    return path


def _signature(headers: httpx.Headers) -> dict[str, Any]:
    return {
        "etag": headers.get("etag"),
        "last_modified": headers.get("last-modified"),
        "content_length": headers.get("content-length"),
    }


def cached_download(url: str, filename: str, force: bool = False) -> tuple[Path, bool]:
    """Download `url` into the cache unless the remote copy is unchanged.

    Returns (path, changed). Change detection reads Last-Modified/ETag/size
    and persists them next to the file. A HEAD request is the cheap way to
    get them, but not every host allows it — NIH RePORTER answers 405
    (real-run finding, 2026-08-03). The fallback opens a STREAMING GET and
    reads the same headers before touching the body: unchanged means the
    stream is closed without downloading a single megabyte.
    """
    dest = cache_dir() / filename
    meta_path = dest.with_suffix(dest.suffix + ".meta.json")
    cached = (
        json.loads(meta_path.read_text())
        if not force and dest.exists() and meta_path.exists()
        else None
    )

    with httpx.Client(follow_redirects=True, timeout=60) as client:
        try:
            head = client.head(url)
            head.raise_for_status()
            remote = _signature(head.headers)
        except httpx.HTTPStatusError as error:
            if error.response.status_code not in (403, 405, 501):
                raise
            remote = None  # decided from the streaming response below

        if remote is not None and cached is not None and cached.get("remote") == remote:
            return dest, False

        tmp = dest.with_suffix(dest.suffix + ".part")
        with client.stream("GET", url) as response:
            response.raise_for_status()
            if remote is None:
                remote = _signature(response.headers)
                if cached is not None and cached.get("remote") == remote:
                    return dest, False  # body never read
            with tmp.open("wb") as fh:
                for chunk in response.iter_bytes(1024 * 1024):
                    fh.write(chunk)
        tmp.replace(dest)
        meta_path.write_text(json.dumps({"url": url, "remote": remote}))
        return dest, True
