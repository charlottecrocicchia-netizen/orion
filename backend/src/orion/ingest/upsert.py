from typing import Any

from sqlalchemy import func
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

CHUNK = 1000


def upsert(
    session: Session,
    model: type,
    rows: list[dict[str, Any]],
    conflict_cols: list[str],
    update_cols: list[str] | None = None,
    touch_last_seen: bool = False,
) -> None:
    """Idempotent batched INSERT … ON CONFLICT (DO UPDATE or DO NOTHING)."""
    for start in range(0, len(rows), CHUNK):
        chunk = rows[start : start + CHUNK]
        stmt = pg_insert(model).values(chunk)
        if update_cols:
            update_map: dict[str, Any] = {c: stmt.excluded[c] for c in update_cols}
            if touch_last_seen:
                update_map["last_seen_at"] = func.now()
            stmt = stmt.on_conflict_do_update(index_elements=conflict_cols, set_=update_map)
        else:
            stmt = stmt.on_conflict_do_nothing(index_elements=conflict_cols)
        session.execute(stmt)
