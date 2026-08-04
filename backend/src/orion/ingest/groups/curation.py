"""La curation des groupes — des faits humains, versionnés, sourcés.

Le fichier `backend/curation/groups.csv` est LA source de vérité des
rattachements manuels : une ligne = un fait (rattachement ou refus),
avec son évidence et sa source publiques. Il vit dans git — la revue de
PR est l'interface de curation, le diff est le journal d'audit.

Règles du chargeur, toutes bloquantes (une ligne fausse = rien ne
charge — un fichier de curation ne se charge pas « au mieux ») :

- `decision` vaut `attach` ou `refuse` ;
- évidence ET source obligatoires — jamais de devinette silencieuse ;
- le groupe se trouve par son LEI (sinon par son nom exact) ;
- l'organisation se trouve par son nom EXACT + pays — portable entre
  environnements, contrairement aux ids ; plusieurs organisations sous
  le même nom exact sont le même acteur dédoublonné, toutes rattachées ;
- une ligne qui ne trouve rien est une ligne périmée : erreur ;
- JV : `is_jv=true` exige `share` (0 < share ≤ 100) — un 67/33 reste
  un 67/33, jamais un 100 silencieux (cahier des charges).

Rechargement : les lignes `attach` remplacent TOUTES les adhésions
`method='curation'`, les `refuse` remplacent la table des refus. Le
rebuild automatique (gleif/wikidata) ne touche jamais à la curation ;
la curation ne touche jamais aux adhésions automatiques.
"""

import csv
import re
from pathlib import Path
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

from orion.ingest.runlog import RunStats

CURATION_FILE = Path(__file__).resolve().parents[4] / "curation" / "groups.csv"

COLUMNS = [
    "group_lei",
    "group_name",
    "org_name",
    "org_country",
    "decision",
    "confidence",
    "is_jv",
    "share",
    "status",
    "valid_from",
    "valid_to",
    "evidence",
    "source",
]

STATUSES = ("active", "announced", "historical")


_ISO_DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


class CurationError(ValueError):
    """Une ligne du fichier de curation est fausse — rien n'est chargé."""


def _fail(line: int, message: str) -> None:
    raise CurationError(f"curation/groups.csv ligne {line} : {message}")


def _parse_rows(path: Path) -> list[dict[str, Any]]:
    with path.open(newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        if reader.fieldnames != COLUMNS:
            raise CurationError(f"colonnes attendues {COLUMNS}, trouvées {reader.fieldnames}")
        rows = []
        for index, raw in enumerate(reader, start=2):
            row = {key: (value or "").strip() for key, value in raw.items()}
            if row["decision"] not in ("attach", "refuse"):
                _fail(index, f"decision « {row['decision']} » (attach|refuse)")
            if not row["evidence"] or not row["source"]:
                _fail(index, "évidence et source sont obligatoires")
            if not row["org_name"]:
                _fail(index, "org_name est obligatoire")
            # org_country vide = l'organisation du corpus n'a pas de pays
            # (rare mais réel : « Airbus Group Spain », pays NUL).
            for field in ("valid_from", "valid_to"):
                if row[field] and not _ISO_DATE.match(row[field]):
                    _fail(index, f"{field} « {row[field]} » n'est pas AAAA-MM-JJ")
            row["status"] = row["status"] or "active"
            if row["status"] not in STATUSES:
                _fail(index, f"status « {row['status']} » (active|announced|historical)")
            if not row["group_lei"] and not row["group_name"]:
                _fail(index, "group_lei ou group_name requis")
            if row["decision"] == "attach":
                try:
                    row["confidence"] = float(row["confidence"])
                except ValueError:
                    _fail(index, f"confidence « {row['confidence']} » illisible")
                if not 0 < row["confidence"] <= 1:
                    _fail(index, "confidence hors de (0, 1]")
                if row["is_jv"] not in ("true", "false", ""):
                    _fail(index, f"is_jv « {row['is_jv']} » (true|false|vide)")
                row["is_jv"] = row["is_jv"] == "true"
                if row["is_jv"]:
                    try:
                        row["share"] = float(row["share"])
                    except ValueError:
                        _fail(index, "une JV exige sa part (share)")
                    if not 0 < row["share"] <= 100:
                        _fail(index, "share hors de (0, 100]")
                else:
                    if row["share"]:
                        _fail(index, "share sans is_jv=true n'a pas de sens")
                    row["share"] = None
            row["line"] = index
            rows.append(row)
        return rows


def _resolve_group(session: Session, row: dict[str, Any]) -> int:
    if row["group_lei"]:
        found = session.execute(
            text("SELECT id FROM groups WHERE lei = :lei"), {"lei": row["group_lei"]}
        ).first()
        if found:
            return found.id
    found = session.execute(
        text("SELECT id FROM groups WHERE name = :name"), {"name": row["group_name"]}
    ).first()
    if found:
        return found.id
    if row["decision"] == "attach" and row["group_name"]:
        # Tête inconnue des registres (opération annoncée, tête sans
        # LEI) : la curation la crée, source='curation' — la revue de
        # PR est la garde contre la coquille, le diff son journal.
        session.execute(
            text(
                "INSERT INTO groups (name, country_code, lei, source) "
                "VALUES (:name, NULL, :lei, 'curation')"
            ),
            {"name": row["group_name"], "lei": row["group_lei"] or None},
        )
        return session.execute(
            text("SELECT id FROM groups WHERE name = :name"), {"name": row["group_name"]}
        ).scalar_one()
    _fail(row["line"], f"groupe introuvable ({row['group_lei'] or row['group_name']})")
    raise AssertionError  # unreachable


def _resolve_organisations(session: Session, row: dict[str, Any]) -> list[int]:
    where = "country_code = :country" if row["org_country"] else "country_code IS NULL"
    ids = [
        r.id
        for r in session.execute(
            text(f"SELECT id FROM organisations WHERE name = :name AND {where}"),
            {"name": row["org_name"], "country": row["org_country"] or None},
        )
    ]
    if not ids:
        _fail(
            row["line"],
            f"organisation introuvable : « {row['org_name']} » ({row['org_country']})",
        )
    return ids


def load_curation(session: Session, stats: RunStats, path: Path | None = None) -> None:
    """Charge le fichier de curation — tout ou rien."""
    path = path or CURATION_FILE
    if not path.exists():
        stats.add("curation_file_missing")
        return
    rows = _parse_rows(path)

    attachments: list[dict[str, Any]] = []
    refusals: list[dict[str, Any]] = []
    for row in rows:
        group_id = _resolve_group(session, row)
        for org_id in _resolve_organisations(session, row):
            if row["decision"] == "attach":
                attachments.append(
                    {
                        "organisation_id": org_id,
                        "group_id": group_id,
                        "method": "curation",
                        "confidence": row["confidence"],
                        "source": "curation",
                        "is_jv": row["is_jv"],
                        "share": row["share"],
                        "status": row["status"],
                        "valid_from": row["valid_from"] or None,
                        "valid_to": row["valid_to"] or None,
                    }
                )
            else:
                refusals.append({"organisation_id": org_id, "group_id": group_id})

    # Le fichier est LA vérité de la curation : remplacement intégral.
    session.execute(text("DELETE FROM entity_group_map WHERE method = 'curation'"))
    session.execute(text("DELETE FROM group_curation_refusals"))
    for entry in attachments:
        session.execute(
            text("""
            INSERT INTO entity_group_map
                (organisation_id, group_id, method, confidence, source, is_jv, share,
                 status, valid_from, valid_to)
            VALUES (:organisation_id, :group_id, :method, :confidence, :source, :is_jv, :share,
                    :status, :valid_from, :valid_to)
            ON CONFLICT (organisation_id, group_id, method) DO UPDATE
                SET confidence = excluded.confidence,
                    is_jv = excluded.is_jv, share = excluded.share,
                    status = excluded.status,
                    valid_from = excluded.valid_from, valid_to = excluded.valid_to
            """),
            entry,
        )
    for entry in refusals:
        session.execute(
            text("""
            INSERT INTO group_curation_refusals (organisation_id, group_id)
            VALUES (:organisation_id, :group_id) ON CONFLICT DO NOTHING
            """),
            entry,
        )
    # Les têtes créées par curation et devenues orphelines repartent —
    # APRÈS les inserts : une tête créée ce run porte déjà ses adhésions.
    session.execute(
        text("""
        DELETE FROM groups g WHERE g.source = 'curation'
        AND NOT EXISTS (SELECT 1 FROM entity_group_map m WHERE m.group_id = g.id)
        """)
    )
    session.commit()
    stats.add("curation_attachments", len(attachments))
    stats.add("curation_refusals", len(refusals))
