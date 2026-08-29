"""Calculs de la métrique `Share of NSF award obligations` (lot R5B).

Métrique INDÉPENDANTE (R5A § 19.3) : rien ici ne touche le Reference
Engine, `project.start_year` ou `project.amount`. L'axe est l'exercice
fédéral d'obligation ; le numérateur et le dénominateur viennent du
même snapshot officiel (dernière vintage validée) ; la jointure
`award_id` ↔ `participations.source_uid` n'apporte que les dimensions
d'Orion. Multi-FY = ratio des sommes, jamais moyenne de pourcentages.
Le Top de la surface se classe par les obligations elles-mêmes
(R5A § 19.5) — pas par le nominal des cohortes de projets.
"""

from decimal import Decimal
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

# Dimensions autorisées par le contrat (R5A § 19.2) — une dimension
# absente d'ici est REFUSÉE, jamais improvisée.
OFFICIAL_DIMENSIONS = ("division", "state")
JOINED_DIMENSIONS = ("country", "organisation")
DIMENSIONS = ("fy", *OFFICIAL_DIMENSIONS, *JOINED_DIMENSIONS)


def latest_vintage(session: Session) -> str | None:
    row = session.execute(text("SELECT max(vintage_date) FROM nsf_obligation_totals")).scalar()
    return row.isoformat() if row else None


def fiscal_years(session: Session) -> dict[str, Any]:
    """L'état de la dernière vintage : la liste que le client peut offrir.

    Même doctrine que `/explore/ppp-years` : ne jamais proposer un FY
    qui finirait en 422."""
    vintage = latest_vintage(session)
    if vintage is None:
        return {"vintage": None, "years": []}
    rows = session.execute(
        text(
            "SELECT fiscal_year, official_total, coverage, available "
            "FROM nsf_obligation_totals WHERE vintage_date = :v ORDER BY fiscal_year"
        ),
        {"v": vintage},
    ).all()
    return {
        "vintage": vintage,
        "years": [
            {
                "fy": int(fy),
                "official_total_usd": float(total),
                "coverage": float(coverage),
                "available": bool(available),
            }
            for fy, total, coverage, available in rows
        ],
    }


class FyUnavailable(ValueError):
    """FY hors de la vintage courante (non publié / futur)."""


class FyCoverageBelowThreshold(ValueError):
    """FY publié mais fermé : couverture de réconciliation hors seuil."""


def _totals_for(session: Session, vintage: str, fys: list[int]) -> list[dict[str, Any]]:
    rows = session.execute(
        text(
            "SELECT fiscal_year, official_total, trend_total, joinable_total, "
            "       unjoinable_total, coverage, available "
            "FROM nsf_obligation_totals "
            "WHERE vintage_date = :v AND fiscal_year = ANY(:fys) ORDER BY fiscal_year"
        ),
        {"v": vintage, "fys": fys},
    ).all()
    found = {int(r[0]) for r in rows}
    missing = [fy for fy in fys if fy not in found]
    if missing:
        raise FyUnavailable(str(missing[0]))
    closed = [int(r[0]) for r in rows if not r[6]]
    if closed:
        raise FyCoverageBelowThreshold(str(closed[0]))
    return [
        {
            "fy": int(r[0]),
            "official_total": Decimal(r[1]),
            "trend_total": Decimal(r[2]) if r[2] is not None else None,
            "joinable_total": Decimal(r[3]),
            "unjoinable_total": Decimal(r[4]),
            "coverage": Decimal(r[5]),
        }
        for r in rows
    ]


_BUCKET_SQL = {
    # Dimensions OFFICIELLES : lues du snapshot seul, aucune jointure.
    "division": (
        "SELECT coalesce(o.funding_directorate, '—') || ' — ' || "
        "       coalesce(o.funding_division, '—') AS k1, "
        "       coalesce(o.funding_division, '—') AS k2, sum(o.amount) AS total "
        "FROM nsf_award_obligations o "
        "WHERE o.vintage_date = :v AND o.fiscal_year = ANY(:fys) "
        "GROUP BY o.funding_directorate, o.funding_division"
    ),
    "state": (
        "SELECT coalesce(o.institution_state_code, '—') AS k1, "
        "       max(coalesce(o.institution_state_code, '—')) AS k2, "
        "       sum(o.amount) AS total "
        "FROM nsf_award_obligations o "
        "WHERE o.vintage_date = :v AND o.fiscal_year = ANY(:fys) "
        "GROUP BY 1"
    ),
    # Dimensions JOINTES : le snapshot reste la source des montants, la
    # jointure n'apporte que la dimension. Ce qui ne se joint pas reste
    # au dénominateur et sort à part (`unjoinable`), jamais renormalisé.
    # Pré-agrégation par award AVANT la jointure : les lignes du
    # snapshot se réduisent d'abord à un total par award (le grain de la
    # jointure 1:1), la jointure et le GROUP BY final travaillent sur
    # ~15 k lignes au lieu de ~22 k×dimensions — mesuré 614 → ~80 ms à
    # froid sur by=organisation.
    "country": (
        "SELECT pa.country_code AS k1, max(pa.country_code) AS k2, sum(x.total) AS total "
        "FROM (SELECT award_id, sum(amount) AS total FROM nsf_award_obligations "
        "      WHERE vintage_date = :v AND fiscal_year = ANY(:fys) GROUP BY award_id) x "
        "JOIN participations pa ON pa.source = 'nsf' AND pa.source_uid = x.award_id "
        "WHERE pa.country_code IS NOT NULL "
        "GROUP BY 1"
    ),
    "organisation": (
        "SELECT cast(org.id AS text) AS k1, org.name AS k2, sum(x.total) AS total "
        "FROM (SELECT award_id, sum(amount) AS total FROM nsf_award_obligations "
        "      WHERE vintage_date = :v AND fiscal_year = ANY(:fys) GROUP BY award_id) x "
        "JOIN participations pa ON pa.source = 'nsf' AND pa.source_uid = x.award_id "
        "JOIN organisations org ON org.id = pa.organisation_id "
        "GROUP BY 1, 2"
    ),
}


def aggregate(session: Session, *, fys: list[int], by: str, limit: int = 20) -> dict[str, Any]:
    """La vue d'une sélection : parts du total officiel, Top inclus.

    Formule gelée (R5A § 19.2) : 100 × Σ obligations sélectionnées sur
    la période / Σ totaux officiels correspondants — ratio des sommes."""
    if by not in DIMENSIONS:
        raise ValueError(f"dimension inconnue: {by}")
    vintage = latest_vintage(session)
    if vintage is None:
        raise FyUnavailable("no_vintage")
    totals = _totals_for(session, vintage, fys)
    denominator = sum((t["official_total"] for t in totals), Decimal(0))
    joinable = sum((t["joinable_total"] for t in totals), Decimal(0))
    unjoinable = sum((t["unjoinable_total"] for t in totals), Decimal(0))
    coverage = (joinable / denominator).quantize(Decimal("0.0001")) if denominator else Decimal(0)

    payload: dict[str, Any] = {
        "metric": "nsf_award_obligations_share",
        "vintage": vintage,
        "fiscal_years": [t["fy"] for t in totals],
        "denominator_usd": float(denominator),
        "joinable_usd": float(joinable),
        "unjoinable_usd": float(unjoinable),
        "coverage": float(coverage),
        "per_fy": [
            {
                "fy": t["fy"],
                "official_total_usd": float(t["official_total"]),
                "joinable_usd": float(t["joinable_total"]),
                "unjoinable_usd": float(t["unjoinable_total"]),
                "coverage": float(t["coverage"]),
            }
            for t in totals
        ],
    }
    if by == "fy":
        return payload

    rows = session.execute(text(_BUCKET_SQL[by]), {"v": vintage, "fys": fys}).all()
    ordered = sorted(rows, key=lambda r: Decimal(r[2]), reverse=True)
    buckets = [
        {
            "key": r[0],
            "label": r[1],
            "amount_usd": float(r[2]),
            "share_pct": float((Decimal(r[2]) * 100 / denominator).quantize(Decimal("0.0001")))
            if denominator
            else 0.0,
        }
        for r in ordered[:limit]
    ]
    payload["by"] = by
    payload["buckets"] = buckets
    payload["bucket_count"] = len(rows)
    return payload
