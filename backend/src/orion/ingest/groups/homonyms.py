"""Homonymes non rattachés — la mesure du trou de couverture des groupes.

Le pont conservateur refuse l'ambiguïté (un pont qui hésite n'est pas un
pont) : des organisations qui PORTENT le nom d'un groupe restent donc hors
de son périmètre tant que la curation n'a pas tranché. Ce module donne la
même définition d'« homonyme » à toutes les surfaces — la note d'honnêteté
de la fiche groupe, le diagnostic chiffré, la fournée de curation — pour
qu'aucune ne mesure un trou différent des autres.

Définition : est homonyme d'un groupe toute organisation dont la clé de
comparaison (`normalize_name`, celle du pont) est ÉGALE à la clé du nom du
groupe ou commence par elle suivie d'une espace, et qui n'est pas membre
du groupe. Une organisation rattachée à un AUTRE groupe est signalée comme
telle : ce n'est pas le même trou (c'est un arbitrage, pas un oubli).
"""

from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

from orion.ingest.dedup.normalize import normalize_name

# La condition unique partagée par toutes les requêtes du module :
# même clé exacte, ou clé du groupe en préfixe de mot.
_MATCH = "(o.name_normalized = :key OR o.name_normalized LIKE :key || ' %')"

# Formes légales que `normalize_name` NE replie pas (le pont reste
# conservateur — élargir SA clé est une décision d'identité, pas la
# nôtre) mais qu'un nom de TÊTE de groupe traîne souvent : « AIRBUS SE »,
# « Siemens Aktiengesellschaft », « LEONARDO - SOCIETA' PER AZIONI ».
# Sans ce repli, le radar sous-compte — Airbus affichait zéro homonyme
# pendant qu'AIRBUS OPERATIONS SAS attendait dehors (constat 2026-08-04).
_HEAD_TAILS = frozenset(
    {
        "se",
        "aktiengesellschaft",
        "aktiebolag",
        "aktiebolaget",
        "aktieselskab",
        "osakeyhtio",
        "societa",
        "per",
        "azioni",
        "societe",
        "anonyme",
    }
)


def group_key(name: str | None) -> str | None:
    """La clé de comparaison d'un nom de groupe : celle du pont
    (`normalize_name`), puis les formes légales de tête de groupe
    retirées en QUEUE seulement, tant qu'il reste un mot."""
    key = normalize_name(name)
    if key is None:
        return None
    tokens = key.split(" ")
    while len(tokens) > 1 and tokens[-1] in _HEAD_TAILS:
        tokens.pop()
    return " ".join(tokens)


def unattached_for_group(session: Session, group_id: int) -> list[dict[str, Any]]:
    """Les homonymes hors périmètre d'UN groupe, pesés (fiche + fournée)."""
    row = session.execute(text("SELECT name FROM groups WHERE id = :id"), {"id": group_id}).first()
    key = group_key(row.name) if row else None
    if key is None:
        return []
    rows = session.execute(
        text(f"""
        SELECT o.id, o.name, o.country_code,
               count(DISTINCT pa.project_id) AS projects,
               coalesce(sum(pa.amount_eur), 0) AS funding,
               (SELECT g2.name FROM entity_group_map m2
                JOIN groups g2 ON g2.id = m2.group_id
                WHERE m2.organisation_id = o.id AND m2.group_id <> :gid
                LIMIT 1) AS other_group
        FROM organisations o
        LEFT JOIN participations pa ON pa.organisation_id = o.id
        WHERE {_MATCH}
          AND NOT EXISTS (SELECT 1 FROM entity_group_map m
                          WHERE m.organisation_id = o.id AND m.group_id = :gid)
          AND NOT EXISTS (SELECT 1 FROM group_curation_refusals cr
                          WHERE cr.organisation_id = o.id AND cr.group_id = :gid)
        GROUP BY o.id, o.name, o.country_code
        ORDER BY funding DESC, o.name
        """),
        {"key": key, "gid": group_id},
    ).all()
    return [
        {
            "id": r.id,
            "name": r.name,
            "country": r.country_code,
            "projects": r.projects,
            "funding_eur": float(r.funding or 0),
            "other_group": r.other_group,
        }
        for r in rows
    ]


def unattached_summary(session: Session, group_id: int) -> dict[str, Any]:
    """Le résumé que la fiche avoue : combien d'homonymes hors périmètre,
    et ce qu'ils pèsent. Les organisations rattachées à un autre groupe ne
    comptent pas dans le trou — elles sont arbitrées, pas oubliées."""
    orgs = [o for o in unattached_for_group(session, group_id) if o["other_group"] is None]
    return {
        "unattached_count": len(orgs),
        "unattached_funding_eur": sum(o["funding_eur"] for o in orgs),
    }


def unattached_all_groups(session: Session) -> list[dict[str, Any]]:
    """Le diagnostic en une passe : pour chaque groupe, ses homonymes hors
    périmètre et leur poids. La jointure passe par le premier jeton de la
    clé (hachable) avant de vérifier le préfixe complet."""
    groups = session.execute(text("SELECT id, name, country_code, lei FROM groups")).all()
    keyed = [
        {"gid": g.id, "gname": g.name, "gcountry": g.country_code, "glei": g.lei, "key": key}
        for g in groups
        if (key := group_key(g.name)) is not None
    ]
    if not keyed:
        return []
    values = ", ".join(f"(:gid{i}, :key{i})" for i in range(len(keyed)))
    params: dict[str, Any] = {}
    for i, entry in enumerate(keyed):
        params[f"gid{i}"] = entry["gid"]
        params[f"key{i}"] = entry["key"]
    rows = session.execute(
        text(f"""
        WITH keys(group_id, key) AS (VALUES {values}),
        matches AS (
            SELECT k.group_id, o.id AS org_id, o.name, o.country_code
            FROM keys k
            JOIN organisations o
              ON split_part(o.name_normalized, ' ', 1) = split_part(k.key, ' ', 1)
             AND (o.name_normalized = k.key OR o.name_normalized LIKE k.key || ' %')
            WHERE NOT EXISTS (SELECT 1 FROM entity_group_map m
                              WHERE m.organisation_id = o.id AND m.group_id = k.group_id)
              AND NOT EXISTS (SELECT 1 FROM group_curation_refusals cr
                              WHERE cr.organisation_id = o.id AND cr.group_id = k.group_id)
        )
        SELECT ma.group_id, ma.org_id, ma.name, ma.country_code,
               count(DISTINCT pa.project_id) AS projects,
               coalesce(sum(pa.amount_eur), 0) AS funding,
               (SELECT g2.name FROM entity_group_map m2
                JOIN groups g2 ON g2.id = m2.group_id
                WHERE m2.organisation_id = ma.org_id AND m2.group_id <> ma.group_id
                LIMIT 1) AS other_group
        FROM matches ma
        LEFT JOIN participations pa ON pa.organisation_id = ma.org_id
        GROUP BY ma.group_id, ma.org_id, ma.name, ma.country_code
        """),
        params,
    ).all()
    by_group: dict[int, list[dict[str, Any]]] = {}
    for r in rows:
        by_group.setdefault(r.group_id, []).append(
            {
                "id": r.org_id,
                "name": r.name,
                "country": r.country_code,
                "projects": r.projects,
                "funding_eur": float(r.funding or 0),
                "other_group": r.other_group,
            }
        )
    out = []
    for entry in keyed:
        orgs = sorted(by_group.get(entry["gid"], []), key=lambda o: -o["funding_eur"])
        out.append({**entry, "unattached": orgs})
    return out
