import json
from pathlib import Path

import httpx

from orion.core.config import get_settings


def cache_dir() -> Path:
    path = Path(get_settings().data_dir) / "cache"
    path.mkdir(parents=True, exist_ok=True)
    return path


def cached_download(url: str, filename: str, force: bool = False) -> tuple[Path, bool]:
    """Download `url` into the cache unless the remote copy is unchanged.

    Returns (path, changed). Change detection uses Last-Modified/ETag/size from
    a HEAD request, persisted next to the file.
    """
    dest = cache_dir() / filename
    meta_path = dest.with_suffix(dest.suffix + ".meta.json")

    with httpx.Client(follow_redirects=True, timeout=60) as client:
        head = client.head(url)
        head.raise_for_status()
        remote = {
            "etag": head.headers.get("etag"),
            "last_modified": head.headers.get("last-modified"),
            "content_length": head.headers.get("content-length"),
        }

        if not force and dest.exists() and meta_path.exists():
            cached = json.loads(meta_path.read_text())
            if cached.get("remote") == remote:
                return dest, False

        tmp = dest.with_suffix(dest.suffix + ".part")
        with client.stream("GET", url) as response:
            response.raise_for_status()
            with tmp.open("wb") as fh:
                for chunk in response.iter_bytes(1024 * 1024):
                    fh.write(chunk)
        tmp.replace(dest)
        meta_path.write_text(json.dumps({"url": url, "remote": remote}))
        return dest, True
