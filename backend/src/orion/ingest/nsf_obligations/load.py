"""Ingestion des artefacts officiels « Award Obligation » (lot R5B).

Pipeline du contrat R5A § 20.1 C2, appliqué tel quel :

    official artifact → immutable raw snapshot → SHA256
    → deterministic parser → validated reference vintage

Le répertoire d'artefacts est un espace de TRAVAIL (consigne fondatrice
du 2026-08-26 : `.research-downloads/r5/nsf/`, hors git) ; la promotion
vers un répertoire de provenance définitif est une décision explicite,
pas un défaut de ce chargeur. Chaque artefact exige son sidecar
`<nom>.meta.json` (URL, horodatage, SHA256…) : un artefact sans
provenance est refusé, un SHA divergent est refusé — aucun chiffre
n'est jamais retapé.

Réconciliation (C3/C4) par (vintage, FY) : total officiel = Σ des
lignes du snapshot ; part joignable à `participations.source_uid` ;
contrôle contre la série Trends du même millésime (tolérance = le seul
arrondi d'affichage de la vue, un demi-centime de million). Un FY dont
la couverture de jointure sort du seuil gelé, ou dont le contrôle
Trends casse, est marqué INDISPONIBLE — jamais un zéro, jamais un
repli, jamais une renormalisation.
"""

import hashlib
import json
import os
import re
from datetime import date
from decimal import Decimal
from pathlib import Path

from sqlalchemy import text
from sqlalchemy.orm import Session

from orion.core.config import get_settings
from orion.core.db import SessionLocal
from orion.ingest.nsf_obligations import parse
from orion.ingest.runlog import RunStats, record_run
from orion.models import NsfAwardObligation, NsfObligationArtifact, NsfObligationTotal

SOURCE = "nsf-obligations"

# Seuil de disponibilité gelé (R5A § 9.4.9 / § 20.1 C4) : plus de 5 %
# du dénominateur officiel non joignable à Orion → FY indisponible.
COVERAGE_THRESHOLD = Decimal("0.95")

# La vue Trends affiche des centièmes de million : l'écart d'arrondi
# maximal entre Σ des détails et la valeur affichée est un demi-centime
# de million. Au-delà, l'artefact est incohérent avec sa propre série.
TREND_TOLERANCE = Decimal("5000")

_DETAIL_NAME = re.compile(r"^award-details-fy(20\d{2})\.tsv$")
_TREND_NAME = re.compile(r"^trend-awards-obligated-amount.*\.tsv$")


def artifact_dir() -> Path:
    """Le magasin durable des artefacts : `data/r5-nsf/<millésime>/`.

    Régime `data/` d'Orion (sources brutes hors git) — mais à la
    différence des autres sources, les artefacts R5 ne sont PAS
    re-téléchargeables à l'identique (série officielle restatée sans
    archives) : le dossier de millésime est la seule archive brute, la
    base versionnée en porte le contenu et la provenance. Le défaut est
    le millésime le plus récent ; `.research-downloads/` reste l'espace
    de travail de l'ACQUISITION, jamais une source d'ingestion par
    défaut (la promotion est un geste explicite, runbook § 2)."""
    configured = os.environ.get("ORION_NSF_OBLIGATIONS_DIR")
    if configured:
        return Path(configured)
    store = Path(get_settings().data_dir) / "r5-nsf"
    vintages = sorted(p for p in store.iterdir() if p.is_dir()) if store.is_dir() else []
    if not vintages:
        raise parse.ArtifactFormatError(
            f"aucun millésime d'artefacts sous {store} — promouvoir l'acquisition "
            "(runbook-nsf-obligations § 2) ou poser ORION_NSF_OBLIGATIONS_DIR"
        )
    return vintages[-1]


def _sha256(raw: bytes) -> str:
    return hashlib.sha256(raw).hexdigest()


def _load_meta(path: Path) -> dict:
    meta_path = path.with_name(path.name + ".meta.json")
    if not meta_path.exists():
        raise parse.ArtifactFormatError(f"{path.name}: sidecar {meta_path.name} absent")
    return json.loads(meta_path.read_text())


def _read_artifact(path: Path) -> tuple[bytes, dict]:
    raw = path.read_bytes()
    meta = _load_meta(path)
    recorded = str(meta.get("sha256", "")).lower()
    actual = _sha256(raw)
    if recorded != actual:
        raise parse.ArtifactFormatError(
            f"{path.name}: SHA256 divergent (meta {recorded[:12]}…, fichier {actual[:12]}…)"
        )
    return raw, meta


def _joinable_ids(session: Session) -> set[str]:
    rows = session.execute(
        text("SELECT DISTINCT source_uid FROM participations WHERE source = 'nsf'")
    )
    return {row[0] for row in rows}


def _current_vintage_shas(session: Session) -> set[str]:
    rows = session.execute(
        text(
            "SELECT sha256 FROM nsf_obligation_artifacts WHERE vintage_date = "
            "(SELECT max(vintage_date) FROM nsf_obligation_artifacts)"
        )
    )
    return {row[0] for row in rows}


def run(force: bool = False, **_: object) -> dict[str, int]:
    directory = artifact_dir()
    with record_run(SOURCE) as stats:
        session = SessionLocal()
        try:
            _run(session, directory, stats, force=force)
        finally:
            session.close()
        return dict(stats.counts)


def _run(session: Session, directory: Path, stats: RunStats, *, force: bool) -> None:
    if not directory.is_dir():
        raise parse.ArtifactFormatError(f"répertoire d'artefacts introuvable: {directory}")
    detail_paths = sorted(p for p in directory.iterdir() if _DETAIL_NAME.match(p.name))
    trend_paths = sorted(p for p in directory.iterdir() if _TREND_NAME.match(p.name))
    if not detail_paths:
        raise parse.ArtifactFormatError(f"aucun artefact award-details-fy*.tsv dans {directory}")

    artifacts: list[tuple[Path, bytes, dict]] = []
    for path in [*detail_paths, *trend_paths]:
        raw, meta = _read_artifact(path)
        artifacts.append((path, raw, meta))
    fresh_shas = {_sha256(raw) for _, raw, _ in artifacts}
    if not force and fresh_shas == _current_vintage_shas(session):
        stats.add("unchanged", 0)
        return

    # Parse détails, refus bruyant sur toute incohérence.
    rows_by_fy: dict[int, list[parse.ObligationRow]] = {}
    detail_meta: dict[int, tuple[Path, bytes, dict]] = {}
    for path, raw, meta in artifacts:
        match = _DETAIL_NAME.match(path.name)
        if not match:
            continue
        fy = int(match.group(1))
        rows = parse.parse_award_details(raw, filename=path.name)
        strays = {r.fiscal_year for r in rows} - {fy}
        if strays:
            raise parse.ArtifactFormatError(
                f"{path.name}: exercices étrangers dans l'artefact: {sorted(strays)}"
            )
        # Le crosstab est un agrégat : deux lignes RIGOUREUSEMENT
        # identiques ne peuvent pas exister — c'est le seul doublon
        # refusé (un grain « métier » supposé s'est avéré indéfinissable
        # sur pièces : division, institution, État, managing division…).
        seen: set[parse.ObligationRow] = set()
        for row in rows:
            if row in seen:
                raise parse.ArtifactFormatError(
                    f"{path.name}: ligne rigoureusement dupliquée "
                    f"({row.award_id}, FY{row.fiscal_year}) — refus"
                )
            seen.add(row)
        rows_by_fy[fy] = rows
        detail_meta[fy] = (path, raw, meta)
        stats.add("rows", len(rows))

    # Série Trends de contrôle (fusion des exports ; conflit = refus).
    trend_totals: dict[int, Decimal] = {}
    for path, raw, _meta in artifacts:
        if not _TREND_NAME.match(path.name):
            continue
        for year, value in parse.parse_trend_totals(raw, filename=path.name).items():
            if year in trend_totals and trend_totals[year] != value:
                raise parse.ArtifactFormatError(
                    f"{path.name}: FY{year} en conflit entre artefacts Trends"
                )
            trend_totals[year] = value

    joinable_ids = _joinable_ids(session)
    vintage = date.today()
    # Rejouer le même jour remplace la vintage DU JOUR, jamais une
    # vintage antérieure (même règle que `price_indices`).
    session.execute(
        text("DELETE FROM nsf_obligation_artifacts WHERE vintage_date = :v"), {"v": vintage}
    )
    session.execute(
        text("DELETE FROM nsf_award_obligations WHERE vintage_date = :v"), {"v": vintage}
    )
    session.execute(
        text("DELETE FROM nsf_obligation_totals WHERE vintage_date = :v"), {"v": vintage}
    )
    session.flush()

    for fy in sorted(rows_by_fy):
        path, raw, meta = detail_meta[fy]
        rows = rows_by_fy[fy]
        official_total = sum((r.amount for r in rows), Decimal(0))
        joinable_total = sum((r.amount for r in rows if r.award_id in joinable_ids), Decimal(0))
        unjoinable_total = official_total - joinable_total
        # Diagnostic d'identifiants (zéros de tête) : jamais joint par
        # heuristique — seulement compté et visible.
        zfill_only = sum(
            (
                r.amount
                for r in rows
                if r.award_id not in joinable_ids and r.award_id.zfill(7) in joinable_ids
            ),
            Decimal(0),
        )
        coverage = (
            (joinable_total / official_total).quantize(Decimal("0.0001"))
            if official_total
            else Decimal(0)
        )
        trend_total = trend_totals.get(fy)
        trend_gap = abs(official_total - trend_total) if trend_total is not None else None
        trend_ok = trend_gap is None or trend_gap <= TREND_TOLERANCE
        available = bool(coverage >= COVERAGE_THRESHOLD and trend_ok)
        notes: list[str] = []
        if trend_gap is not None and not trend_ok:
            notes.append(f"trend_gap={trend_gap}")
        if zfill_only:
            notes.append(f"zfill_only_usd={zfill_only}")
        validation = {
            "rows": len(rows),
            "official_total": str(official_total),
            "trend_total": str(trend_total) if trend_total is not None else None,
            "trend_ok": trend_ok,
            "coverage": str(coverage),
            "available": available,
        }
        artifact = NsfObligationArtifact(
            vintage_date=vintage,
            filename=path.name,
            sheet=str(meta.get("sheet", "@Award Details Sheet")),
            source_url=str(meta.get("source_url", "")),
            filters=meta.get("filters"),
            acquired_at=meta["acquired_at"],
            codebook_version=meta.get("codebook_version"),
            sha256=_sha256(raw),
            bytes=len(raw),
            parser_version=parse.PARSER_VERSION,
            validation=validation,
        )
        session.add(artifact)
        session.flush()
        session.add_all(
            NsfAwardObligation(
                vintage_date=vintage,
                artifact_id=artifact.id,
                award_id=r.award_id,
                fiscal_year=r.fiscal_year,
                award_fiscal_year=r.award_fiscal_year,
                funding_directorate=r.funding_directorate,
                funding_division=r.funding_division,
                award_instrument=r.award_instrument,
                managing_directorate=r.managing_directorate,
                managing_division=r.managing_division,
                institution_id=r.institution_id,
                institution_name=r.institution_name,
                institution_state_code=r.institution_state_code,
                country_code=r.country_code,
                amount=r.amount,
            )
            for r in rows
        )
        session.add(
            NsfObligationTotal(
                vintage_date=vintage,
                fiscal_year=fy,
                official_total=official_total,
                trend_total=trend_total,
                joinable_total=joinable_total,
                unjoinable_total=unjoinable_total,
                coverage=coverage,
                available=available,
                notes="; ".join(notes) or None,
            )
        )
        stats.add("fiscal_years")
        if available:
            stats.add("available_years")

    for path, raw, meta in artifacts:
        if not _TREND_NAME.match(path.name):
            continue
        session.add(
            NsfObligationArtifact(
                vintage_date=vintage,
                filename=path.name,
                sheet=str(meta.get("sheet", "Trend-Awards Obligated Amount")),
                source_url=str(meta.get("source_url", "")),
                filters=meta.get("filters"),
                acquired_at=meta["acquired_at"],
                codebook_version=meta.get("codebook_version"),
                sha256=_sha256(raw),
                bytes=len(raw),
                parser_version=parse.PARSER_VERSION,
                validation={"trend_years": sorted(trend_totals)},
            )
        )
        stats.add("trend_artifacts")

    session.commit()
    # Les statistiques du planificateur, tout de suite : une vintage
    # fraîchement écrite sans ANALYZE rend le pire cas multi-FY ~3×
    # plus lent (mesuré 2,4 s → 0,7 s).
    session.execute(text("ANALYZE nsf_award_obligations"))
    session.execute(text("ANALYZE nsf_obligation_totals"))
    session.commit()
