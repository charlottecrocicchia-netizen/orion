"""La maille sous le pays — référentiel + backfill depuis les caches.

Lot D (2026-08-17), conçu dans docs/conception-drill-etats.md. Deux
passes, idempotentes et journalisées :

1. RÉFÉRENTIEL — les 51 États américains (50 + District de Columbia) et
   les cinq territoires qui apparaissent dans les données fédérales.
   Complet par construction : la liste des mailles cliquables dérive de
   cette table, jamais d'une liste côté client.
2. BACKFILL — la subdivision se lit dans les CACHES déjà sur disque, et
   se pose sur les participations existantes par leur `source_uid` :

   - NSF   : `inst.inst_state_code` du bénéficiaire ; uid = `awd_id` ;
   - NIH   : colonne `ORG_STATE` de RePORTER ; uid = `CORE_PROJECT_NUM` ;
   - CORDIS: `nutsCode` brut de organization.csv ; uid préfixé
     `{projectID}:{pic}:` (l'ordre de participation varie, le préfixe
     non).

Le côté retenu est celui du BÉNÉFICIAIRE, comme le pays (décision
fondatrice NSF, 2026-08-03) : `perf_st_code` (lieu d'exécution) existe
dans la source et reste délibérément inutilisé — même registre que
`perf_ctry_code`.

Aucun retéléchargement : un cache absent est compté, jamais fatal — le
backfill est rejouable et n'écrase que ce qu'il sait.
"""

import csv
import io
import json
import zipfile
from pathlib import Path
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

from orion.core.db import SessionLocal
from orion.ingest.download import cache_dir
from orion.ingest.runlog import RunStats, record_run

SOURCE = "subdivisions"
CHUNK = 5000
NUTS_FILE = Path(__file__).resolve().parents[3] / "curation" / "nuts-nomenclature.tsv"
LEVELS_FILE = Path(__file__).resolve().parents[3] / "curation" / "nuts-levels.csv"

# Les 50 États + DC, puis les cinq territoires qui reçoivent des
# financements fédéraux (ils apparaissent dans NIH/NSF : la règle gravée
# veut qu'ils soient cliquables, donc référencés).
US_STATES: dict[str, str] = {
    "AL": "Alabama",
    "AK": "Alaska",
    "AZ": "Arizona",
    "AR": "Arkansas",
    "CA": "California",
    "CO": "Colorado",
    "CT": "Connecticut",
    "DE": "Delaware",
    "DC": "District of Columbia",
    "FL": "Florida",
    "GA": "Georgia",
    "HI": "Hawaii",
    "ID": "Idaho",
    "IL": "Illinois",
    "IN": "Indiana",
    "IA": "Iowa",
    "KS": "Kansas",
    "KY": "Kentucky",
    "LA": "Louisiana",
    "ME": "Maine",
    "MD": "Maryland",
    "MA": "Massachusetts",
    "MI": "Michigan",
    "MN": "Minnesota",
    "MS": "Mississippi",
    "MO": "Missouri",
    "MT": "Montana",
    "NE": "Nebraska",
    "NV": "Nevada",
    "NH": "New Hampshire",
    "NJ": "New Jersey",
    "NM": "New Mexico",
    "NY": "New York",
    "NC": "North Carolina",
    "ND": "North Dakota",
    "OH": "Ohio",
    "OK": "Oklahoma",
    "OR": "Oregon",
    "PA": "Pennsylvania",
    "RI": "Rhode Island",
    "SC": "South Carolina",
    "SD": "South Dakota",
    "TN": "Tennessee",
    "TX": "Texas",
    "UT": "Utah",
    "VT": "Vermont",
    "VA": "Virginia",
    "WA": "Washington",
    "WV": "West Virginia",
    "WI": "Wisconsin",
    "WY": "Wyoming",
}
US_TERRITORIES: dict[str, str] = {
    "PR": "Puerto Rico",
    "VI": "U.S. Virgin Islands",
    "GU": "Guam",
    "AS": "American Samoa",
    "MP": "Northern Mariana Islands",
}


def seed_subdivisions(session: Session, stats: RunStats) -> None:
    """Pass 1 — le référentiel, remplacé en entier (dérivé, pas saisi)."""
    rows = [
        {"code": f"US-{code}", "country": "US", "name": name, "level": "state"}
        for code, name in {**US_STATES, **US_TERRITORIES}.items()
    ]
    session.execute(text("DELETE FROM subdivisions WHERE country_code = 'US'"))
    session.execute(
        text(
            "INSERT INTO subdivisions (code, country_code, name, level) "
            "VALUES (:code, :country, :name, :level)"
        ),
        rows,
    )
    session.commit()
    stats.add("subdivisions", len(rows))


def _apply(session: Session, pairs: list[tuple[str, str]], source_like: str, column: str) -> int:
    """Pose la valeur sur les participations d'une source, par uid exact."""
    touched = 0
    for start in range(0, len(pairs), CHUNK):
        chunk = pairs[start : start + CHUNK]
        result = session.execute(
            text(f"""
            UPDATE participations pa SET {column} = v.value
            FROM (SELECT unnest(CAST(:uids AS text[])) AS uid,
                         unnest(CAST(:values AS text[])) AS value) v
            WHERE pa.source LIKE :src AND pa.source_uid = v.uid
            """),
            {
                "uids": [uid for uid, _ in chunk],
                "values": [value for _, value in chunk],
                "src": source_like,
            },
        )
        touched += result.rowcount or 0
    session.commit()
    return touched


def backfill_nsf(session: Session, stats: RunStats) -> None:
    """NSF — un JSON par award dans chaque archive annuelle."""
    pairs: list[tuple[str, str]] = []
    for path in sorted(cache_dir().glob("nsf-*.zip")):
        with zipfile.ZipFile(path) as archive:
            for name in archive.namelist():
                if not name.endswith(".json"):
                    continue
                try:
                    award = json.loads(archive.read(name))
                except (json.JSONDecodeError, KeyError):
                    stats.add("nsf_unreadable")
                    continue
                code = (award.get("inst") or {}).get("inst_state_code")
                awd_id = award.get("awd_id") or name.removesuffix(".json")
                if not code or not awd_id:
                    continue
                if code in US_STATES or code in US_TERRITORIES:
                    pairs.append((str(awd_id), f"US-{code}"))
    if not pairs:
        stats.add("nsf_cache_missing")
        return
    stats.add("nsf_subdivisions", _apply(session, pairs, "nsf%", "subdivision_code"))


def backfill_nih(session: Session, stats: RunStats) -> None:
    """NIH — le CSV RePORTER par année fiscale (ORG_STATE, CORE_PROJECT_NUM)."""
    pairs: dict[str, str] = {}
    for path in sorted(cache_dir().glob("nih-projects-*.zip")):
        with zipfile.ZipFile(path) as archive:
            for name in archive.namelist():
                if not name.lower().endswith(".csv"):
                    continue
                with archive.open(name) as raw:
                    stream = io.TextIOWrapper(raw, encoding="utf-8-sig", errors="replace")
                    reader = csv.DictReader(stream)
                    for row in reader:
                        core = (row.get("CORE_PROJECT_NUM") or "").strip()
                        state = (row.get("ORG_STATE") or "").strip().upper()
                        country = (row.get("ORG_COUNTRY") or "").strip().upper()
                        if not core or not state:
                            continue
                        # Les bénéficiaires hors États-Unis portent parfois
                        # une « province » dans ORG_STATE : la maille US ne
                        # vaut que pour les États-Unis.
                        if country and "UNITED STATES" not in country:
                            continue
                        if state in US_STATES or state in US_TERRITORIES:
                            # La dernière année fiscale gagne — même règle
                            # que le chargeur (DISTINCT ON … fy DESC).
                            pairs[core] = f"US-{state}"
    if not pairs:
        stats.add("nih_cache_missing")
        return
    stats.add("nih_subdivisions", _apply(session, list(pairs.items()), "nih%", "subdivision_code"))


def backfill_cordis(session: Session, stats: RunStats) -> None:
    """CORDIS — le NUTS brut, apparié sur les DEUX premiers segments de
    l'uid (`projet:pic:`).

    Le motif LIKE par préfixe était intenable (mesuré en prod le
    2026-08-17 : chaque lot de 5 000 relançait un balayage des 842 k
    participations, la passe n'en finissait pas). On charge les paires
    dans une table temporaire, on les indexe, et UNE jointure sur
    `split_part` fait tout le travail en une passe — la même leçon que
    le chantier performance : ne jamais faire boucler la base sur ce
    qu'une jointure sait faire d'un coup."""
    total = 0
    session.execute(text("DROP TABLE IF EXISTS tmp_cordis_nuts"))
    session.execute(text("CREATE TEMP TABLE tmp_cordis_nuts (project text, pic text, nuts text)"))
    loaded = 0
    for path in sorted(cache_dir().glob("cordis-*.zip")):
        with zipfile.ZipFile(path) as archive:
            if "organization.csv" not in archive.namelist():
                continue
            with archive.open("organization.csv") as raw:
                stream = io.TextIOWrapper(raw, encoding="utf-8-sig", errors="replace")
                reader = csv.DictReader(stream, delimiter=";")
                batch: list[dict[str, str]] = []
                for row in reader:
                    nuts = (row.get("nutsCode") or "").strip()
                    project = (row.get("projectID") or "").strip()
                    pic = (row.get("organisationID") or "").strip()
                    if not (nuts and project and pic):
                        continue
                    batch.append({"project": project, "pic": pic, "nuts": nuts[:8]})
                    if len(batch) >= CHUNK:
                        session.execute(
                            text(
                                "INSERT INTO tmp_cordis_nuts (project, pic, nuts) "
                                "VALUES (:project, :pic, :nuts)"
                            ),
                            batch,
                        )
                        loaded += len(batch)
                        batch = []
                if batch:
                    session.execute(
                        text(
                            "INSERT INTO tmp_cordis_nuts (project, pic, nuts) "
                            "VALUES (:project, :pic, :nuts)"
                        ),
                        batch,
                    )
                    loaded += len(batch)
    if loaded == 0:
        stats.add("cordis_cache_missing")
        return
    session.execute(text("CREATE INDEX ON tmp_cordis_nuts (project, pic)"))
    session.execute(text("ANALYZE tmp_cordis_nuts"))
    result = session.execute(
        text("""
        UPDATE participations pa SET nuts_code = v.nuts
        FROM tmp_cordis_nuts v
        WHERE pa.source LIKE 'cordis%'
          AND split_part(pa.source_uid, ':', 1) = v.project
          AND split_part(pa.source_uid, ':', 2) = v.pic
        """)
    )
    total = result.rowcount or 0
    session.execute(text("DROP TABLE IF EXISTS tmp_cordis_nuts"))
    session.commit()
    stats.add("cordis_nuts", total)


def seed_nuts_nomenclature(session: Session, stats: RunStats, path: Path | None = None) -> None:
    """Les NOMS des régions européennes — nomenclature statistique
    Eurostat (codelist SDMX GEO, CC BY 4.0, registre des sources au
    2026-08-17), versionnée dans le dépôt comme la curation : le diff
    est le journal d'audit. Remplacée en entier, tout ou rien — un
    référentiel à moitié chargé mentirait sur ce qu'il sait nommer.

    Libellés officiels VERBATIM (« Ile de France » sans accent : c'est
    l'écriture Eurostat, on ne retouche pas une source). Deux
    modifications assumées et consignées : filtrage aux codes NUTS des
    pays du système, suffixes de millésime retirés des libellés."""
    path = path or NUTS_FILE
    with open(path, encoding="utf-8", newline="") as fh:
        reader = csv.DictReader(fh, delimiter="\t")
        rows = [
            {"code": row["code"], "level": int(row["level"]), "name": row["name"]} for row in reader
        ]
    if not rows:
        raise ValueError(f"nomenclature NUTS vide : {path}")
    session.execute(text("DELETE FROM nuts_nomenclature"))
    session.execute(
        text("INSERT INTO nuts_nomenclature (code, level, name) VALUES (:code, :level, :name)"),
        rows,
    )
    session.commit()
    stats.add("nuts_names", len(rows))


# Les préfixes NUTS qui ne sont pas des codes ISO : la Grèce s'écrit EL
# chez Eurostat et GR dans notre référentiel pays, le Royaume-Uni UK/GB.
_NUTS_TO_ISO = {"EL": "GR", "UK": "GB"}
_ISO_TO_NUTS = {v: k for k, v in _NUTS_TO_ISO.items()}


def _nuts_levels(path: Path | None = None) -> dict[str, int]:
    """La maille par pays — un choix de CURATION (conception symétrie
    validée le 2026-08-17) : le « bon » niveau NUTS n'est pas le même
    partout (Länder NUTS1, comunidades NUTS2, län NUTS3 — la France en
    NUTS1, la carte de 2016 que tout le monde connaît)."""
    path = path or LEVELS_FILE
    with open(path, encoding="utf-8", newline="") as fh:
        levels = {row["country"]: int(row["level"]) for row in csv.DictReader(fh)}
    if not levels or not all(1 <= level <= 3 for level in levels.values()):
        raise ValueError(f"niveaux NUTS illisibles : {path}")
    return levels


def seed_nuts_meshes(session: Session, stats: RunStats) -> None:
    """Le référentiel des mailles européennes : pour chaque pays curé, ses
    régions AU NIVEAU CHOISI, nommées par la nomenclature. Remplacé en
    entier, comme la maille US — la liste des mailles dérive de LUI."""
    levels = _nuts_levels()
    rows: list[dict[str, str]] = []
    for country, level in levels.items():
        prefix = _ISO_TO_NUTS.get(country, country)
        for code, name in session.execute(
            text(
                "SELECT code, name FROM nuts_nomenclature "
                "WHERE level = :level AND left(code, 2) = :prefix"
            ),
            {"level": level, "prefix": prefix},
        ):
            rows.append({"code": code, "country": country, "name": name, "level": f"nuts{level}"})
    if not rows:
        raise ValueError("aucune maille européenne — nomenclature chargée ?")
    session.execute(text("DELETE FROM subdivisions WHERE country_code <> 'US'"))
    session.execute(
        text(
            "INSERT INTO subdivisions (code, country_code, name, level) "
            "VALUES (:code, :country, :name, :level)"
        ),
        rows,
    )
    session.commit()
    stats.add("nuts_meshes", len(rows))


def backfill_nuts_meshes(session: Session, stats: RunStats) -> None:
    """Pose la maille d'affichage sur les participations européennes :
    le nuts_code BRUT tronqué au niveau curé du pays — quand la troncature
    existe au référentiel. Un code trop court (« FR » sec) ou inconnu
    reste NULL : c'est le résidu « non rattaché », affiché, jamais fondu
    (règle du lot E). Vue recalculable : changer un niveau au fichier puis
    rejouer la passe change l'affichage, jamais la donnée brute."""
    total = 0
    for country, level in _nuts_levels().items():
        result = session.execute(
            text("""
            UPDATE participations pa SET subdivision_code = left(pa.nuts_code, :len)
            FROM subdivisions s
            WHERE pa.country_code = :country
              AND pa.nuts_code IS NOT NULL
              AND s.country_code = :country
              AND s.code = left(pa.nuts_code, :len)
              AND pa.subdivision_code IS DISTINCT FROM left(pa.nuts_code, :len)
            """),
            {"country": country, "len": level + 2},
        )
        total += result.rowcount or 0
    session.commit()
    stats.add("nuts_mesh_backfill", total)


def run(force: bool = False) -> dict[str, int]:  # noqa: ARG001 — backfill total
    with record_run(SOURCE) as stats:
        session = SessionLocal()
        try:
            seed_subdivisions(session, stats)
            seed_nuts_nomenclature(session, stats)
            seed_nuts_meshes(session, stats)
            backfill_nsf(session, stats)
            backfill_nih(session, stats)
            backfill_cordis(session, stats)
            # Après le NUTS brut : la maille d'affichage européenne.
            backfill_nuts_meshes(session, stats)
        finally:
            session.close()
    return stats.counts


def subdivision_index(session: Session, country: str) -> list[dict[str, Any]]:
    """Le référentiel d'un pays, chargé de ses chiffres — la matière de
    la choroplèthe. Toute maille référencée sort, financée ou non : le
    gris dira l'absence, jamais une maille manquante."""
    rows = session.execute(
        text("""
        SELECT s.code, s.name,
               count(DISTINCT pa.project_id) AS projects,
               coalesce(sum(pa.amount_eur), 0) AS funding
        FROM subdivisions s
        LEFT JOIN participations pa ON pa.subdivision_code = s.code
        WHERE s.country_code = :country
        GROUP BY s.code, s.name
        ORDER BY funding DESC, s.name
        """),
        {"country": country},
    ).all()
    return [
        {
            "code": r.code,
            "name": r.name,
            "projects_count": r.projects,
            "funding_eur": float(r.funding or 0),
        }
        for r in rows
    ]
