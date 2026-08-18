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
import time
from datetime import date
from pathlib import Path
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

from orion.core.db import SessionLocal
from orion.ingest.runlog import RunStats, record_run

LENSES_DIR = Path(__file__).resolve().parents[3] / "curation" / "lenses"
REGISTRY_FILE = LENSES_DIR / "registry.csv"

REGISTRY_COLUMNS = ["family_key", "slug", "rank", "status", "version"]
COLUMNS = ["rule_type", "value", "tag", "sources", "evidence", "source"]
# La hiérarchie de preuve (I6) : structurel > taxonomique > textuel.
# `call` et `topic` sont des FAITS de la source — l'appel qui a financé,
# le concept exact qu'elle a posé. `theme` est un sous-arbre de
# nomenclature. `text` interprète. Un `veto` textuel ne peut annuler
# qu'un tag taxonomique ou textuel : une interprétation ne renverse
# jamais un fait de la source.
PROOF_OF_RULE = {
    "call": "structural",
    "topic": "structural",
    "programme": "structural",
    "theme": "taxonomic",
    "text": "textual",
}
# Du plus faible au plus fort : l'ordre d'application, pour qu'un tag
# finisse toujours avec la preuve la plus forte qui le justifie.
PROOFS = ("textual", "taxonomic", "structural")
RULE_TYPES = ("call", "topic", "programme", "theme", "text", "veto")
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
            if rule["rule_type"] == "veto":
                if rule["tag"]:
                    _fail(
                        path.name,
                        index,
                        "un veto ne porte pas de tag : il retire, il ne classe pas",
                    )
            elif rule["tag"] not in TAGS:
                _fail(path.name, index, f"tag « {rule['tag']} » (core|enabling)")
            if not rule["value"]:
                _fail(path.name, index, "value est obligatoire")
            if not rule["evidence"] or not rule["source"]:
                _fail(path.name, index, "évidence et source sont obligatoires")
            sources = [s for s in rule["sources"].split("|") if s]
            if rule["rule_type"] in ("text", "veto"):
                if not sources:
                    _fail(path.name, index, "un motif texte doit CADRER ses sources (cordis|nsf)")
                unknown = set(sources) - TEXT_SOURCES
                if unknown:
                    _fail(path.name, index, f"sources inconnues : {sorted(unknown)}")
                if len(rule["value"]) < 6 and " " not in rule["value"]:
                    _fail(path.name, index, "motif trop court et sans espace — trop ambigu")
            elif sources:
                _fail(path.name, index, "sources ne s'applique qu'aux motifs texte et veto")
            rule["sources_list"] = sources
            rule["line"] = index
            rules.append(rule)
        return rules


def _check_files(entries: list[dict[str, Any]], base: Path) -> None:
    """Registre et fichiers de règles se répondent exactement — dans les
    deux sens : pas de lentille sans règles, pas de règles sans registre."""
    slugs = {e["slug"] for e in entries}
    files = {f.stem for f in base.glob("*.csv")} - {"registry"}
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


def _apply_rule(
    session: Session, slug: str, tag: str, proof: str, where: str, params: dict[str, Any]
) -> int:
    """Pose un tag, avec l'origine qui le justifie.

    L'ordre d'application fait la loi : `enabling` d'abord, `core`
    ensuite (core bat enabling, structurellement) ; et dans chaque tag,
    du plus faible au plus fort niveau de preuve — le tag finit donc
    toujours avec la preuve la plus forte qui le justifie."""
    if tag == "core":
        conflict = (
            "ON CONFLICT (project_id, lens) DO UPDATE SET tag = 'core', proof = excluded.proof"
        )
    else:
        conflict = (
            "ON CONFLICT (project_id, lens) DO UPDATE "
            "SET tag = 'enabling', proof = excluded.proof "
            "WHERE project_lens_tags.tag <> 'core'"
        )
    result = session.execute(
        text(
            "INSERT INTO project_lens_tags (project_id, lens, tag, proof) "
            f"SELECT p.id, :lens, :tag, :proof FROM projects p WHERE ({where}) {conflict}"
        ),
        {**params, "lens": slug, "tag": tag, "proof": proof},
    )
    return result.rowcount or 0


def _rule_clause(session: Session, rule: dict[str, Any]) -> tuple[str, dict[str, Any]] | None:
    """La clause SQL d'une règle — None si le corpus ne la connaît pas."""
    kind, value = rule["rule_type"], rule["value"]
    if kind == "programme":
        ids = _programme_subtree(session, value)
        return ("p.programme_id = ANY(:prog_ids)", {"prog_ids": ids}) if ids else None
    if kind == "call":
        # Un PRÉFIXE de code d'appel : le fait structurel que la source
        # donne — quel appel a financé ce projet.
        return (
            "p.call_id IN (SELECT id FROM calls WHERE code LIKE :call_prefix)",
            {"call_prefix": value + "%"},
        )
    if kind == "topic":
        # Le concept EXACT, sans son sous-arbre (I7) : on nomme ce dont
        # on parle, on n'hérite pas des voisins.
        return (
            """p.id IN (
                SELECT pt.project_id FROM project_topics pt
                JOIN topics tp ON tp.id = pt.topic_id
                WHERE tp.scheme = 'euroscivoc' AND tp.code = :topic_code
            )""",
            {"topic_code": value},
        )
    if kind == "theme":
        return (
            """p.id IN (
                SELECT pt.project_id FROM project_topics pt
                JOIN topics tp ON tp.id = pt.topic_id
                WHERE tp.scheme = 'euroscivoc'
                  AND (tp.code = :code OR tp.code LIKE :prefix)
            )""",
            {"code": value, "prefix": value + "/%"},
        )
    return (
        """p.source LIKE ANY(:src_likes) AND p.id IN (
            SELECT ptx.project_id FROM project_texts ptx
            WHERE ptx.title ILIKE :needle OR ptx.abstract ILIKE :needle
        )""",
        {"src_likes": [f"{src}%" for src in rule["sources_list"]], "needle": f"%{value}%"},
    )


def _apply_veto(session: Session, slug: str, rule: dict[str, Any]) -> int:
    """Un veto retire un tag — jamais un tag STRUCTUREL (I6) : une
    interprétation ne renverse pas un fait de la source."""
    result = session.execute(
        text(
            "DELETE FROM project_lens_tags plt USING projects p "
            "WHERE plt.lens = :lens AND plt.project_id = p.id "
            "AND plt.proof <> 'structural' "
            "AND p.source LIKE ANY(:src_likes) AND p.id IN ("
            "  SELECT ptx.project_id FROM project_texts ptx "
            "  WHERE ptx.title ILIKE :needle OR ptx.abstract ILIKE :needle)"
        ),
        {
            "lens": slug,
            "src_likes": [f"{src}%" for src in rule["sources_list"]],
            "needle": f"%{rule['value']}%",
        },
    )
    return result.rowcount or 0


def _measure(session: Session, slug: str) -> dict[str, Any]:
    """L'état chiffré d'une lentille — mesuré, jamais estimé (S1 ①)."""
    row = session.execute(
        text(
            "SELECT count(*) FILTER (WHERE plt.tag = 'core') AS core, "
            "       count(*) FILTER (WHERE plt.tag = 'enabling') AS enabling, "
            "       coalesce(sum(p.funding_amount_eur), 0) AS funding "
            "FROM project_lens_tags plt JOIN projects p ON p.id = plt.project_id "
            "WHERE plt.lens = :lens"
        ),
        {"lens": slug},
    ).one()
    return {"core": row.core, "enabling": row.enabling, "funding": float(row.funding or 0)}


def load_lens(session: Session, stats: RunStats, slug: str, path: Path) -> None:
    """Rétague UNE lentille depuis son fichier — total, à chaque run, et
    SANS jamais toucher aux tags des autres lentilles (I4)."""
    if not path.exists():
        stats.add("lens_file_missing")
        return
    rules = parse_rules(path)
    before = _measure(session, slug)

    session.execute(text("DELETE FROM project_lens_tags WHERE lens = :lens"), {"lens": slug})

    # enabling puis core ; dans chaque tag, du plus faible au plus fort
    # niveau de preuve — la priorité est structurelle, jamais dépendante
    # de l'ordre du fichier.
    for wanted in ("enabling", "core"):
        for proof in PROOFS:
            for rule in rules:
                if rule["rule_type"] == "veto" or rule["tag"] != wanted:
                    continue
                if PROOF_OF_RULE[rule["rule_type"]] != proof:
                    continue
                clause = _rule_clause(session, rule)
                if clause is None:
                    stats.add("rule_skipped_no_match")
                    continue
                where, params = clause
                stats.add(
                    f"tagged_{wanted}", _apply_rule(session, slug, wanted, proof, where, params)
                )
    # Les vetos passent en DERNIER, et ne mordent pas sur le structurel.
    for rule in rules:
        if rule["rule_type"] == "veto":
            stats.add("vetoed", _apply_veto(session, slug, rule))

    session.execute(
        text(
            "UPDATE lenses SET rules_total = :total, rules_programme = :programme, "
            "rules_theme = :theme, rules_text = :text WHERE slug = :slug"
        ),
        {
            "slug": slug,
            "total": len(rules),
            "programme": sum(1 for r in rules if PROOF_OF_RULE.get(r["rule_type"]) == "structural"),
            "theme": sum(1 for r in rules if r["rule_type"] == "theme"),
            "text": sum(1 for r in rules if r["rule_type"] in ("text", "veto")),
        },
    )
    session.commit()

    after = _measure(session, slug)
    for tag in TAGS:
        count = session.execute(
            text("SELECT count(*) FROM project_lens_tags WHERE lens = :lens AND tag = :tag"),
            {"lens": slug, "tag": tag},
        ).scalar()
        stats.add(f"{slug}_{tag}", count or 0)
    for proof in PROOFS:
        count = session.execute(
            text("SELECT count(*) FROM project_lens_tags WHERE lens = :lens AND proof = :proof"),
            {"lens": slug, "proof": proof},
        ).scalar()
        if count:
            stats.add(f"proof_{proof}", count)
    _record_change(session, slug, before, after, stats)


def _record_change(
    session: Session, slug: str, before: dict[str, Any], after: dict[str, Any], stats: RunStats
) -> None:
    """Le journal de méthodologie, DÉRIVÉ (S1 ①) : quand la version du
    registre dépasse la dernière version journalisée ET qu'il existait
    un état antérieur, le run écrit l'avant/après qu'il vient de
    MESURER — jamais une estimation, jamais une saisie. Seule la
    justification éditoriale reste curée, en i18n.

    Un premier chargement n'est pas un changement : sans état antérieur,
    rien n'est journalisé."""
    version = session.execute(
        text("SELECT version FROM lenses WHERE slug = :slug"), {"slug": slug}
    ).scalar()
    if version is None or before["core"] + before["enabling"] == 0:
        return
    logged = session.execute(
        text("SELECT coalesce(max(version), 0) FROM lens_changelog WHERE lens = :slug"),
        {"slug": slug},
    ).scalar()
    if version <= (logged or 0):
        return
    session.execute(
        text(
            "INSERT INTO lens_changelog (lens, version, changed_on, core_before, core_after, "
            "enabling_before, enabling_after, funding_before_eur, funding_after_eur) "
            "VALUES (:slug, :version, :day, :cb, :ca, :eb, :ea, :fb, :fa)"
        ),
        {
            "slug": slug,
            "version": version,
            "day": date.today(),
            "cb": before["core"],
            "ca": after["core"],
            "eb": before["enabling"],
            "ea": after["enabling"],
            "fb": before["funding"],
            "fa": after["funding"],
        },
    )
    session.commit()
    stats.add("changelog_recorded")


def load_all(
    session: Session, stats: RunStats, base_dir: Path | None = None, only: str | None = None
) -> None:
    """Registre miroité puis chaque lentille rétaguée. `only` limite le
    travail à UNE lentille (I4) : les tags des autres ne sont jamais
    touchés — chaque lentille vit sa propre vie."""
    base = base_dir or LENSES_DIR
    entries = parse_registry(base / "registry.csv")
    _check_files(entries, base)
    if only is not None and only not in {e["slug"] for e in entries}:
        raise LensError(f"lentille inconnue au registre : « {only} »")
    mirror_registry(session, entries)
    for entry in entries:
        if only is not None and entry["slug"] != only:
            continue
        if entry["status"] == "retired":
            stats.add("lens_retired_skipped")
            continue
        load_lens(session, stats, entry["slug"], base / f"{entry['slug']}.csv")


def run(force: bool = False, lens: str | None = None) -> dict[str, int]:  # noqa: ARG001
    """Rétague les lentilles. `lens` en cible UNE seule (I4) ; sans lui,
    le recalcul global reste disponible comme opération d'audit.

    Chaque lentille a SON run journalisé — lentille, version, durée,
    comptes, statut — et le retag d'une lentille ne touche jamais les
    tags des autres."""
    entries = parse_registry(REGISTRY_FILE)
    _check_files(entries, LENSES_DIR)
    known = {e["slug"] for e in entries}
    if lens is not None and lens not in known:
        raise LensError(f"lentille inconnue au registre : « {lens} » (connues : {sorted(known)})")

    session = SessionLocal()
    try:
        mirror_registry(session, entries)
        session.commit()
    finally:
        session.close()

    combined: dict[str, int] = {}
    for entry in entries:
        if lens is not None and entry["slug"] != lens:
            continue
        if entry["status"] == "retired":
            combined["lens_retired_skipped"] = combined.get("lens_retired_skipped", 0) + 1
            continue
        # Un run journalisé PAR lentille : `space-lens` garde son nom.
        started = time.perf_counter()
        with record_run(f"{entry['slug']}-lens") as stats:
            stats.add("lens_version", entry["version"])
            session = SessionLocal()
            try:
                load_lens(session, stats, entry["slug"], LENSES_DIR / f"{entry['slug']}.csv")
            finally:
                session.close()
            stats.add("seconds", int(time.perf_counter() - started))
        for key, value in stats.counts.items():
            combined[key] = combined.get(key, 0) + value
    return combined
