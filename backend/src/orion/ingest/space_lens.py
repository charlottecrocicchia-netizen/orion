"""La lentille spatiale — le secteur identifiable dans le corpus (V1).

`backend/curation/space-lens.csv` définit le périmètre spatial en trois
familles de règles, chacune sourcée :

- `programme` : un CODE de programme — le programme ET son sous-arbre
  (FP7-SPACE, LEIT-Space H2020, divisions NSF) ;
- `theme`     : un PRÉFIXE de code euroSciVoc — jamais un libellé
  (« astro » attrapait la gastro-entérologie, constat 2026-08-05) ;
- `text`      : un motif FERMÉ validé à la main sur titres et résumés,
  CADRÉ par source — jamais NIH, où « satellite cell » est un muscle.

Le tag est `core` (spatial au cœur) ou `adjacent` (technologie
habilitante) ; core gagne. Refus délibérés, documentés ici : HORIZON.2.4
entier (Digital+Industry+Space mêlés — ses projets spatiaux entrent par
les thèmes et les motifs), tout match par libellé, tout motif d'un seul
mot ambigu (« satellite » nu).

Validation TOUT OU RIEN sur la FORME (type de règle, tag, évidence,
source) ; résolution SOUPLE sur le corpus : une règle dont le programme
n'existe pas dans cette base (graine CI, dev partiel) est comptée
`skipped`, jamais une erreur — la règle reste vraie, le corpus varie.
Le chargeur RÉTAGUE tout à chaque run : le fichier est la seule vérité,
rien n'est jamais supprimé du corpus (invariant fondatrice).
"""

import csv
from pathlib import Path
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

from orion.core.db import SessionLocal
from orion.ingest.runlog import RunStats, record_run

SOURCE = "space-lens"
LENS_FILE = Path(__file__).resolve().parents[3] / "curation" / "space-lens.csv"

COLUMNS = ["rule_type", "value", "tag", "sources", "evidence", "source"]
RULE_TYPES = ("programme", "theme", "text")
TAGS = ("core", "adjacent")
TEXT_SOURCES = {"cordis", "nsf", "nih"}


class SpaceLensError(ValueError):
    """Une règle de la lentille est mal formée — rien n'est tagué."""


def _fail(line: int, message: str) -> None:
    raise SpaceLensError(f"curation/space-lens.csv ligne {line} : {message}")


def parse_rules(path: Path) -> list[dict[str, Any]]:
    with path.open(newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        if reader.fieldnames != COLUMNS:
            raise SpaceLensError(f"colonnes attendues {COLUMNS}, trouvées {reader.fieldnames}")
        rules = []
        for index, raw in enumerate(reader, start=2):
            rule = {key: (value or "").strip() for key, value in raw.items()}
            if rule["rule_type"] not in RULE_TYPES:
                _fail(index, f"rule_type « {rule['rule_type']} » (programme|theme|text)")
            if rule["tag"] not in TAGS:
                _fail(index, f"tag « {rule['tag']} » (core|adjacent)")
            if not rule["value"]:
                _fail(index, "value est obligatoire")
            if not rule["evidence"] or not rule["source"]:
                _fail(index, "évidence et source sont obligatoires")
            sources = [s for s in rule["sources"].split("|") if s]
            if rule["rule_type"] == "text":
                if not sources:
                    _fail(index, "un motif texte doit CADRER ses sources (cordis|nsf)")
                unknown = set(sources) - TEXT_SOURCES
                if unknown:
                    _fail(index, f"sources inconnues : {sorted(unknown)}")
                if len(rule["value"]) < 6 and " " not in rule["value"]:
                    _fail(index, "motif trop court et sans espace — trop ambigu")
            elif sources:
                _fail(index, "sources ne s'applique qu'aux motifs texte")
            rule["sources_list"] = sources
            rule["line"] = index
            rules.append(rule)
        return rules


def _programme_subtree(session: Session, code: str) -> list[int]:
    """Le programme et tout son sous-arbre, par parent_id."""
    return [
        row[0]
        for row in session.execute(
            text("""
            WITH RECURSIVE sub AS (
                SELECT id FROM programmes WHERE code = :code
                UNION ALL
                SELECT pr.id FROM programmes pr JOIN sub ON pr.parent_id = sub.id
            )
            SELECT id FROM sub
            """),
            {"code": code},
        )
    ]


def _apply_tag(session: Session, tag: str, where: str, params: dict[str, Any]) -> int:
    # core écrase adjacent ; adjacent ne touche jamais core.
    guard = "" if tag == "core" else " AND space_tag IS DISTINCT FROM 'core'"
    result = session.execute(
        text(f"UPDATE projects SET space_tag = :tag WHERE ({where}){guard}"),
        {**params, "tag": tag},
    )
    return result.rowcount or 0


def load_space_lens(session: Session, stats: RunStats, path: Path | None = None) -> None:
    path = path or LENS_FILE
    if not path.exists():
        stats.add("lens_file_missing")
        return
    rules = parse_rules(path)

    session.execute(text("UPDATE projects SET space_tag = NULL WHERE space_tag IS NOT NULL"))

    # adjacent d'abord, core ensuite : la priorité est structurelle, pas
    # dépendante de l'ordre du fichier.
    for wanted in ("adjacent", "core"):
        for rule in rules:
            if rule["tag"] != wanted:
                continue
            if rule["rule_type"] == "programme":
                ids = _programme_subtree(session, rule["value"])
                if not ids:
                    stats.add("rule_skipped_no_match")
                    continue
                touched = _apply_tag(
                    session,
                    wanted,
                    "programme_id = ANY(:prog_ids)",
                    {"prog_ids": ids},
                )
            elif rule["rule_type"] == "theme":
                touched = _apply_tag(
                    session,
                    wanted,
                    """id IN (
                        SELECT pt.project_id FROM project_topics pt
                        JOIN topics tp ON tp.id = pt.topic_id
                        WHERE tp.scheme = 'euroscivoc'
                          AND (tp.code = :code OR tp.code LIKE :prefix)
                    )""",
                    {"code": rule["value"], "prefix": rule["value"] + "/%"},
                )
            else:
                like_sources = [f"{s}%" for s in rule["sources_list"]]
                touched = _apply_tag(
                    session,
                    wanted,
                    """source LIKE ANY(:src_likes) AND id IN (
                        SELECT ptx.project_id FROM project_texts ptx
                        WHERE ptx.title ILIKE :needle OR ptx.abstract ILIKE :needle
                    )""",
                    {"src_likes": like_sources, "needle": f"%{rule['value']}%"},
                )
            stats.add(f"tagged_{wanted}", touched)
    session.commit()
    core = session.execute(text("SELECT count(*) FROM projects WHERE space_tag = 'core'")).scalar()
    adjacent = session.execute(
        text("SELECT count(*) FROM projects WHERE space_tag = 'adjacent'")
    ).scalar()
    stats.add("space_core", core or 0)
    stats.add("space_adjacent", adjacent or 0)


def run(force: bool = False) -> dict[str, int]:  # noqa: ARG001 — retag total à chaque run
    with record_run(SOURCE) as stats:
        session = SessionLocal()
        try:
            load_space_lens(session, stats)
        finally:
            session.close()
    return stats.counts
