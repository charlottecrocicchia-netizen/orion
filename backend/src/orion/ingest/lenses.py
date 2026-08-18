"""Les lentilles — le secteur identifiable dans le corpus, généralisé (M0).

Une lentille est un jeu de règles versionnées qui pose un tag sur les
projets — une LECTURE du corpus, jamais une partition (D3, conception
multi-lentilles) : un projet peut porter plusieurs lentilles, chaque vue
n'en lit qu'une, les nombres de deux lentilles ne s'additionnent pas.

`backend/curation/lenses/registry.csv` est le registre : famille →
lentille (`family_key,slug,rank`). La clé de famille est TECHNIQUE et
stable — jamais un libellé, les mots vivent en i18n. Le chargeur MIRE le
registre dans la table `lenses` (le fichier reste la seule vérité
éditable) et refuse autant un CSV de règles hors registre qu'une entrée
de registre sans son CSV.

`backend/curation/lenses/<slug>.csv` définit chaque lentille en trois
familles de règles, chacune sourcée :

- `programme` : un CODE de programme — le programme ET son sous-arbre
  (FP7-SPACE, LEIT-Space H2020, divisions NSF) ;
- `theme`     : un PRÉFIXE de code euroSciVoc — jamais un libellé
  (« astro » attrapait la gastro-entérologie, constat 2026-08-05) ;
- `text`      : un motif FERMÉ validé à la main sur titres et résumés,
  CADRÉ par source — jamais NIH, où « satellite cell » est un muscle.

Le tag est `core` (au cœur) ou `enabling` (technologie habilitante) ;
core gagne, structurellement. Ces deux mots sont le registre TECHNIQUE
d'une paire unique (I3) — le registre utilisateur (« X direct » /
« X + habilitant ») vit en i18n, et il n'existe pas de troisième terme.

Refus délibérés, documentés ici : HORIZON.2.4 entier (Digital+Industry+
Space mêlés), tout match par libellé, tout motif d'un seul mot ambigu
(« satellite » nu).

Validation TOUT OU RIEN sur la FORME (registre et règles) ; résolution
SOUPLE sur le corpus : une règle dont le programme n'existe pas dans
cette base (graine CI, dev partiel) est comptée `skipped`, jamais une
erreur — la règle reste vraie, le corpus varie. Le chargeur RÉTAGUE
toute la lentille à chaque run : le fichier est la seule vérité, rien
n'est jamais supprimé du corpus (invariant fondatrice).

Le run s'appelle `<slug>-lens` — pour le spatial, `space-lens` : le nom
que la page À-propos affiche depuis la V1 reste vrai par construction.
"""

import csv
import re
from pathlib import Path
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

from orion.core.db import SessionLocal
from orion.ingest.runlog import RunStats, record_run

LENSES_DIR = Path(__file__).resolve().parents[3] / "curation" / "lenses"
REGISTRY_FILE = LENSES_DIR / "registry.csv"

REGISTRY_COLUMNS = ["family_key", "slug", "rank", "status", "version"]
CHANGELOG_FILE_NAME = "changelog.csv"
CHANGELOG_COLUMNS = [
    "slug",
    "version",
    "changed_on",
    "core_before",
    "core_after",
    "enabling_before",
    "enabling_after",
    "funding_before_eur",
    "funding_after_eur",
]
COLUMNS = ["rule_type", "value", "tag", "sources", "evidence", "source"]
RULE_TYPES = ("programme", "theme", "text")
TAGS = ("core", "enabling")
# I2 : draft se charge sans être exposée, published est le produit,
# retired n'est plus rechargée — ses tags restent gelés en base.
STATUSES = ("draft", "published", "retired")
TEXT_SOURCES = {"cordis", "nsf", "nih"}

# La grammaire URL réserve le suffixe « -direct » au périmètre (D2) ; un
# slug qui le porterait rendrait `sector=<slug>` inanalysable.
_SLUG_RE = re.compile(r"[a-z][a-z0-9]*(?:-[a-z0-9]+)*")
_FAMILY_RE = re.compile(r"[a-z][a-z0-9_]*")


class LensError(ValueError):
    """Le registre ou une règle est mal formé — rien n'est tagué."""


def _fail(name: str, line: int, message: str) -> None:
    raise LensError(f"curation/lenses/{name} ligne {line} : {message}")


def parse_registry(path: Path) -> list[dict[str, Any]]:
    """Le registre famille → lentille, validé tout ou rien, trié par rang."""
    with path.open(newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        if reader.fieldnames != REGISTRY_COLUMNS:
            raise LensError(
                f"registre : colonnes attendues {REGISTRY_COLUMNS}, trouvées {reader.fieldnames}"
            )
        entries: list[dict[str, Any]] = []
        for index, raw in enumerate(reader, start=2):
            entry = {key: (value or "").strip() for key, value in raw.items()}
            if not _FAMILY_RE.fullmatch(entry["family_key"]):
                _fail(path.name, index, f"family_key « {entry['family_key']} » (clé technique)")
            if not _SLUG_RE.fullmatch(entry["slug"]):
                _fail(path.name, index, f"slug « {entry['slug']} » (minuscules, tirets)")
            if entry["slug"].endswith("-direct"):
                _fail(path.name, index, "un slug ne finit jamais par « -direct » (grammaire D2)")
            if not entry["rank"].isdigit() or int(entry["rank"]) < 1:
                _fail(path.name, index, f"rank « {entry['rank']} » (entier ≥ 1)")
            if entry["status"] not in STATUSES:
                _fail(path.name, index, f"status « {entry['status']} » (draft|published|retired)")
            if not entry["version"].isdigit() or int(entry["version"]) < 1:
                _fail(path.name, index, f"version « {entry['version']} » (entier ≥ 1)")
            entry["rank"] = int(entry["rank"])
            entry["version"] = int(entry["version"])
            entries.append(entry)
        slugs = [e["slug"] for e in entries]
        if len(set(slugs)) != len(slugs):
            raise LensError("registre : un slug apparaît deux fois")
        ranks = [e["rank"] for e in entries]
        if len(set(ranks)) != len(ranks):
            raise LensError("registre : un rang apparaît deux fois")
        return sorted(entries, key=lambda e: e["rank"])


def parse_rules(path: Path) -> list[dict[str, Any]]:
    with path.open(newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        if reader.fieldnames != COLUMNS:
            raise LensError(f"colonnes attendues {COLUMNS}, trouvées {reader.fieldnames}")
        rules = []
        for index, raw in enumerate(reader, start=2):
            rule = {key: (value or "").strip() for key, value in raw.items()}
            if rule["rule_type"] not in RULE_TYPES:
                _fail(path.name, index, f"rule_type « {rule['rule_type']} » (programme|theme|text)")
            if rule["tag"] not in TAGS:
                _fail(path.name, index, f"tag « {rule['tag']} » (core|enabling)")
            if not rule["value"]:
                _fail(path.name, index, "value est obligatoire")
            if not rule["evidence"] or not rule["source"]:
                _fail(path.name, index, "évidence et source sont obligatoires")
            sources = [s for s in rule["sources"].split("|") if s]
            if rule["rule_type"] == "text":
                if not sources:
                    _fail(path.name, index, "un motif texte doit CADRER ses sources (cordis|nsf)")
                unknown = set(sources) - TEXT_SOURCES
                if unknown:
                    _fail(path.name, index, f"sources inconnues : {sorted(unknown)}")
                if len(rule["value"]) < 6 and " " not in rule["value"]:
                    _fail(path.name, index, "motif trop court et sans espace — trop ambigu")
            elif sources:
                _fail(path.name, index, "sources ne s'applique qu'aux motifs texte")
            rule["sources_list"] = sources
            rule["line"] = index
            rules.append(rule)
        return rules


def _check_files(entries: list[dict[str, Any]], base: Path) -> None:
    """Registre et fichiers de règles se répondent exactement — dans les
    deux sens : pas de lentille sans règles, pas de règles sans registre."""
    slugs = {e["slug"] for e in entries}
    files = {f.stem for f in base.glob("*.csv")} - {"registry", "changelog"}
    orphans = sorted(files - slugs)
    if orphans:
        raise LensError(f"CSV hors registre : {orphans} — toute lentille naît au registre")
    missing = sorted(slugs - files)
    if missing:
        raise LensError(f"lentille sans règles : {missing} — le registre promet un CSV")


def mirror_registry(session: Session, entries: list[dict[str, Any]]) -> None:
    """La table `lenses` MIRE le fichier — jamais l'inverse. Pas de
    suppression silencieuse : retirer une lentille est un geste manuel."""
    for entry in entries:
        session.execute(
            text(
                "INSERT INTO lenses (slug, family_key, rank, status, version) "
                "VALUES (:slug, :family_key, :rank, :status, :version) "
                "ON CONFLICT (slug) DO UPDATE "
                "SET family_key = excluded.family_key, rank = excluded.rank, "
                "    status = excluded.status, version = excluded.version"
            ),
            entry,
        )


def parse_changelog(path: Path) -> list[dict[str, Any]]:
    """Le journal de méthodologie : une ligne par version, ses comptes
    avant/après. La JUSTIFICATION n'est pas ici — elle vit en i18n, dans
    les deux langues (invariant des surfaces de méthode)."""
    if not path.exists():
        return []
    with path.open(newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        if reader.fieldnames != CHANGELOG_COLUMNS:
            raise LensError(
                f"changelog : colonnes attendues {CHANGELOG_COLUMNS}, trouvées {reader.fieldnames}"
            )
        entries = []
        for index, raw in enumerate(reader, start=2):
            entry = {key: (value or "").strip() for key, value in raw.items()}
            if not _SLUG_RE.fullmatch(entry["slug"]):
                _fail(path.name, index, f"slug « {entry['slug']} »")
            if not entry["version"].isdigit() or int(entry["version"]) < 1:
                _fail(path.name, index, f"version « {entry['version']} » (entier ≥ 1)")
            if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", entry["changed_on"]):
                _fail(path.name, index, f"changed_on « {entry['changed_on']}» (AAAA-MM-JJ)")
            for count in ("core_before", "core_after", "enabling_before", "enabling_after"):
                if not entry[count].isdigit():
                    _fail(path.name, index, f"{count} doit être un entier")
                entry[count] = int(entry[count])
            for amount in ("funding_before_eur", "funding_after_eur"):
                try:
                    entry[amount] = float(entry[amount])
                except ValueError:
                    _fail(path.name, index, f"{amount} doit être un nombre")
            entry["version"] = int(entry["version"])
            entries.append(entry)
        return entries


def mirror_changelog(session: Session, entries: list[dict[str, Any]], slugs: set[str]) -> None:
    for entry in entries:
        if entry["slug"] not in slugs:
            raise LensError(f"changelog : « {entry['slug']} » n'est pas au registre")
        session.execute(
            text(
                "INSERT INTO lens_changelog (lens, version, changed_on, core_before, core_after, "
                "enabling_before, enabling_after, funding_before_eur, funding_after_eur) "
                "VALUES (:slug, :version, :changed_on, :core_before, :core_after, "
                ":enabling_before, :enabling_after, :funding_before_eur, :funding_after_eur) "
                "ON CONFLICT (lens, version) DO UPDATE SET "
                "changed_on = excluded.changed_on, core_before = excluded.core_before, "
                "core_after = excluded.core_after, enabling_before = excluded.enabling_before, "
                "enabling_after = excluded.enabling_after, "
                "funding_before_eur = excluded.funding_before_eur, "
                "funding_after_eur = excluded.funding_after_eur"
            ),
            entry,
        )


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


def _apply_rule(session: Session, slug: str, tag: str, where: str, params: dict[str, Any]) -> int:
    # La lentille vient d'être vidée : enabling s'insère sans jamais
    # écraser (DO NOTHING), core passe après et écrase (DO UPDATE) — la
    # priorité reste structurelle, pas dépendante de l'ordre du fichier.
    conflict = (
        "ON CONFLICT (project_id, lens) DO UPDATE SET tag = excluded.tag"
        if tag == "core"
        else "ON CONFLICT (project_id, lens) DO NOTHING"
    )
    result = session.execute(
        text(
            "INSERT INTO project_lens_tags (project_id, lens, tag) "
            f"SELECT p.id, :lens, :tag FROM projects p WHERE ({where}) {conflict}"
        ),
        {**params, "lens": slug, "tag": tag},
    )
    return result.rowcount or 0


def load_lens(session: Session, stats: RunStats, slug: str, path: Path) -> None:
    """Rétague UNE lentille depuis son fichier — total, à chaque run."""
    if not path.exists():
        stats.add("lens_file_missing")
        return
    rules = parse_rules(path)

    session.execute(text("DELETE FROM project_lens_tags WHERE lens = :lens"), {"lens": slug})

    # enabling d'abord, core ensuite : voir _apply_rule.
    for wanted in ("enabling", "core"):
        for rule in rules:
            if rule["tag"] != wanted:
                continue
            if rule["rule_type"] == "programme":
                ids = _programme_subtree(session, rule["value"])
                if not ids:
                    stats.add("rule_skipped_no_match")
                    continue
                touched = _apply_rule(
                    session,
                    slug,
                    wanted,
                    "p.programme_id = ANY(:prog_ids)",
                    {"prog_ids": ids},
                )
            elif rule["rule_type"] == "theme":
                touched = _apply_rule(
                    session,
                    slug,
                    wanted,
                    """p.id IN (
                        SELECT pt.project_id FROM project_topics pt
                        JOIN topics tp ON tp.id = pt.topic_id
                        WHERE tp.scheme = 'euroscivoc'
                          AND (tp.code = :code OR tp.code LIKE :prefix)
                    )""",
                    {"code": rule["value"], "prefix": rule["value"] + "/%"},
                )
            else:
                like_sources = [f"{s}%" for s in rule["sources_list"]]
                touched = _apply_rule(
                    session,
                    slug,
                    wanted,
                    """p.source LIKE ANY(:src_likes) AND p.id IN (
                        SELECT ptx.project_id FROM project_texts ptx
                        WHERE ptx.title ILIKE :needle OR ptx.abstract ILIKE :needle
                    )""",
                    {"src_likes": like_sources, "needle": f"%{rule['value']}%"},
                )
            stats.add(f"tagged_{wanted}", touched)
    # Le compte des règles voyage avec la lentille : l'À-propos le lit,
    # il ne l'écrit plus (M1.3).
    session.execute(
        text(
            "UPDATE lenses SET rules_total = :total, rules_programme = :programme, "
            "rules_theme = :theme, rules_text = :text WHERE slug = :slug"
        ),
        {
            "slug": slug,
            "total": len(rules),
            **{kind: sum(1 for rule in rules if rule["rule_type"] == kind) for kind in RULE_TYPES},
        },
    )
    session.commit()
    for tag in TAGS:
        count = session.execute(
            text("SELECT count(*) FROM project_lens_tags WHERE lens = :lens AND tag = :tag"),
            {"lens": slug, "tag": tag},
        ).scalar()
        # Pour le spatial : `space_core` / `space_enabling` — le journal
        # parle le registre technique, comme la base et le payload.
        stats.add(f"{slug}_{tag}", count or 0)


def load_all(session: Session, stats: RunStats, base_dir: Path | None = None) -> None:
    """Registre miroité puis chaque lentille rétaguée — le chemin de la
    graine e2e et des rechargements en une session."""
    base = base_dir or LENSES_DIR
    entries = parse_registry(base / "registry.csv")
    _check_files(entries, base)
    mirror_registry(session, entries)
    mirror_changelog(
        session, parse_changelog(base / CHANGELOG_FILE_NAME), {e["slug"] for e in entries}
    )
    for entry in entries:
        if entry["status"] == "retired":
            stats.add("lens_retired_skipped")
            continue
        load_lens(session, stats, entry["slug"], base / f"{entry['slug']}.csv")


def run(force: bool = False) -> dict[str, int]:  # noqa: ARG001 — retag total à chaque run
    entries = parse_registry(REGISTRY_FILE)
    _check_files(entries, LENSES_DIR)
    session = SessionLocal()
    try:
        mirror_registry(session, entries)
        mirror_changelog(
            session,
            parse_changelog(LENSES_DIR / CHANGELOG_FILE_NAME),
            {e["slug"] for e in entries},
        )
        session.commit()
    finally:
        session.close()

    combined: dict[str, int] = {}
    for entry in entries:
        # Une lentille retirée ne se recharge plus — pas même un run.
        if entry["status"] == "retired":
            combined["lens_retired_skipped"] = combined.get("lens_retired_skipped", 0) + 1
            continue
        # Un run journalisé PAR lentille : `space-lens` garde son nom.
        with record_run(f"{entry['slug']}-lens") as stats:
            session = SessionLocal()
            try:
                load_lens(session, stats, entry["slug"], LENSES_DIR / f"{entry['slug']}.csv")
            finally:
                session.close()
        for key, value in stats.counts.items():
            combined[key] = combined.get(key, 0) + value
    return combined
