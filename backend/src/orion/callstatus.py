"""Le statut DÉRIVÉ d'un appel — une seule source de vérité (E1/E3).

Règle gravée d'E1 : « aucun appel clos présenté comme ouvert ». Les
dates priment sur le code source ; le code ne tranche que lorsqu'elles
manquent. Extrait d'api/calls.py à l'ouverture d'E3 pour que le service
des opportunités applique EXACTEMENT la même règle sans la dupliquer.
"""

from datetime import datetime


def parse_instants(values: list | None) -> list[datetime]:
    out = []
    for value in values or []:
        try:
            out.append(datetime.fromisoformat(value))
        except (TypeError, ValueError):
            continue
    return out


def derived_status(
    opening: datetime | None,
    deadlines: list[datetime],
    status_code: str | None,
    now: datetime,
) -> str:
    """Le statut affiché. Les dates priment ; le code source ne tranche
    que lorsqu'elles manquent."""
    if deadlines:
        if any(d > now for d in deadlines):
            if opening and opening > now:
                return "upcoming"
            return "open"
        return "closed"
    if status_code == "31094501":
        return "upcoming"
    if status_code == "31094502":
        # « Open » sans aucune deadline publiée : l'ouverture fait foi.
        return "upcoming" if opening and opening > now else "open"
    return "closed"


def next_deadline(deadlines: list[datetime], now: datetime) -> datetime | None:
    future = [d for d in deadlines if d > now]
    if future:
        return min(future)
    return max(deadlines) if deadlines else None
