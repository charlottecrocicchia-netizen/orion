"""Le moteur de la chaîne de l'argent public (lot B1).

Répond à « où est passé cet argent ? » sur le modèle réellement
supporté par B0 (docs/conception-b-chaine-argent-public.md) :

    Financeur → Programme → [Call] → Projet → Participation →
    Organisation → Pays

Invariants portés par ce module (contrat B0 § 6, arbitrages § 11) :
- profondeur VARIABLE : un étage absent d'une source est sauté, jamais
  synthétisé (I5) — NIH et NSF n'ont pas d'étage Call ;
- chaque montant voyage avec sa nature comptable, sa provenance (fait
  source / dérivé / analyse Orion), sa devise et sa base de calcul
  (I6) — deux nombres ne deviennent pas comparables parce qu'ils
  vivent dans la même colonne ;
- chaque changement de grain publie sa réconciliation : total parent,
  somme des enfants connus, non-ventilé signé, inconnus, couverture
  (D5) — jamais « Σ participations = financement » sur parole (I2, I7) ;
- une navigation valide n'implique pas une agrégation valide (I8) : le
  nœud organisation refuse le total unique inter-financeurs (gold
  ITACONIX) ;
- NULL reste inconnu, jamais zéro (I4) ; le `total_cost = 0` publié
  par CORDIS est requalifié « non disponible » à la lecture (D7),
  provenance du zéro source conservée ;
- le rattachement au programme recouvré depuis legalBasis.csv (B0.1,
  règle de l'ancêtre commun comprise) est exposé comme DÉRIVÉ Orion,
  jamais comme fait source littéral.

Aucun état serveur : chaque nœud est adressé par un identifiant stable
(code financeur, id numérique, code ISO) — URL = vue reproductible.
"""

from decimal import Decimal
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

from orion.models import Call, Funder, Organisation, Programme, Project


class NodeNotFound(Exception):
    """Le nœud demandé n'existe pas."""


class LevelNotAvailable(Exception):
    """Étage absent pour cette source — jamais synthétisé (I5)."""


def _family(source: str) -> str:
    return "cordis" if source.startswith("cordis") else source


def _num(value: Decimal | float | None) -> float | None:
    """Decimal → float pour la sérialisation ; None RESTE None (I4)."""
    return float(value) if value is not None else None


# ---------------------------------------------------------------- registre
# La sémantique comptable par famille de source (B0 § 3-4). C'est LE
# point de vérité : l'UI de B2 ne devine rien, elle lit ces enveloppes.

PROJECT_MEASURE: dict[str, dict[str, Any]] = {
    "cordis": {
        "key": "ec_max_contribution",
        "label": "Contribution UE maximale (convention de subvention)",
        "accounting_nature": "commitment_ceiling",
        "provenance": "source_fact",
        "currency": "EUR",
        "basis": "cordis:project.ecMaxContribution",
        "period": "projet entier, rattaché à la date de début",
    },
    "nih": {
        "key": "nih_obligations_window_sum",
        "label": "Somme des obligations annuelles publiées (fenêtre FY2005+)",
        "accounting_nature": "obligations_annual_sum",
        "provenance": "derived",
        "currency": "USD",
        "basis": "somme des TOTAL_COST annuels RePORTER du core project, hors sous-projets",
        "period": "exercices publiés du core project, fenêtre d'ingestion FY2005+",
    },
    "nsf": {
        "key": "nsf_obligated_cumulative",
        "label": "Obligation cumulée à la date d'ingestion",
        "accounting_nature": "obligations_cumulative",
        "provenance": "source_fact",  # devient "derived" pour une fratrie repliée
        "currency": "USD",
        "basis": "nsf:awd_amount (jamais l'intention tot_intn_awd_amt)",
        "period": "cumul depuis le début de l'award, à la date d'ingestion",
    },
}

PARTICIPATION_MEASURE: dict[str, dict[str, Any]] = {
    "cordis": {
        "key": "ec_contribution",
        "label": "Contribution UE de ce participant",
        "accounting_nature": "commitment_share",
        "provenance": "source_fact",
        "currency": "EUR",
        "basis": "cordis:organization.ecContribution",
        "semantics": "funding_share",
    },
    "nih": {
        "key": None,
        "label": "Bénéficiaire (aucune ventilation financière publiée)",
        "accounting_nature": None,
        "provenance": None,
        "currency": None,
        "basis": "RePORTER ne publie pas de part par organisation ; "
        "la ligne ingérée recopie le total du projet",
        "semantics": "beneficiary_marker",
    },
    "nsf": {
        "key": "nsf_award_obligated",
        "label": "Obligation cumulée de l'award constituant",
        "accounting_nature": "obligations_cumulative",
        "provenance": "source_fact",
        "currency": "USD",
        "basis": "nsf:awd_amount de l'award membre",
        "semantics": "constituent_award",
    },
}

# Le libellé d'un roll-up dit ce que la somme EST (règle de nommage
# R5A § 19.1) : une Σ observée dans le corpus, jamais un budget.
ROLLUP_LABEL = {
    "cordis": "Σ des contributions UE maximales observées dans le corpus Orion",
    "nih": "Σ des obligations annuelles NIH observées dans le corpus Orion (fenêtre FY2005+)",
    "nsf": "Σ des obligations cumulées NSF observées dans le corpus Orion",
}

EUR_ENVELOPE = {
    "key": "amount_eur_observed",
    "provenance": "derived",
    "currency": "EUR",
    "basis": "convention ④ : taux annuel moyen BCE de l'année de début du projet "
    "(hypothèse de taux, pas une observation)",
}

CROSS_FUNDER_TOTAL_REFUSAL = {
    "available": False,
    "reason": "natures comptables et devises incompatibles entre financeurs — "
    "un total unique serait un chiffre inventé (I3, I8 ; gold ITACONIX)",
}

# Navigation par financeur : la descente réellement supportée (I5, I8).
# `restricted` porte toujours sa raison ; un étage absent n'apparaît
# qu'en `not_available`, jamais comme nœud.
_CALL_RESTRICTION = (
    "Programme → Call est reconstruit via les projets (aucune clé source) ; "
    "sous un programme, un appel n'affiche que ses projets de CE programme — "
    "103 appels transversaux réels servent plusieurs programmes"
)
NAVIGATION_DOWN = {
    "ec": [
        {"level": "programme", "status": "allowed", "reason": None},
        {"level": "call", "status": "restricted", "reason": _CALL_RESTRICTION},
        {"level": "project", "status": "allowed", "reason": None},
        {"level": "participation", "status": "allowed", "reason": None},
        {"level": "organisation", "status": "allowed", "reason": "comptes DISTINCT requis"},
        {
            "level": "country",
            "status": "allowed",
            "reason": "pays = destination institutionnelle, jamais un effort national",
        },
    ],
    "nih": [
        {"level": "programme", "status": "allowed", "reason": None},
        {
            "level": "call",
            "status": "not_available",
            "reason": "aucun appel/FOA ingéré — étage sauté, jamais synthétisé (I5)",
        },
        {"level": "project", "status": "allowed", "reason": None},
        {
            "level": "participation",
            "status": "restricted",
            "reason": "la participation NIH est un bénéficiaire, pas une ventilation financière",
        },
        {"level": "organisation", "status": "allowed", "reason": None},
        {
            "level": "country",
            "status": "allowed",
            "reason": "pays = destination institutionnelle",
        },
    ],
    "nsf": [
        {"level": "programme", "status": "allowed", "reason": None},
        {
            "level": "call",
            "status": "not_available",
            "reason": "aucun appel/program element ingéré — étage sauté, jamais synthétisé (I5)",
        },
        {"level": "project", "status": "allowed", "reason": None},
        {"level": "participation", "status": "allowed", "reason": None},
        {"level": "organisation", "status": "allowed", "reason": None},
        {
            "level": "country",
            "status": "allowed",
            "reason": "pays = destination institutionnelle",
        },
    ],
}

ASCENT_RESTRICTION = (
    "remontée valide comme navigation, pas comme agrégation : la somme par "
    "financeur reste dans SA mesure et SA devise ; aucun total unique (I8)"
)


def _rollup_envelope(family: str) -> dict[str, Any]:
    base = PROJECT_MEASURE[family]
    return {
        "key": f"{base['key']}_sum",
        "label": ROLLUP_LABEL[family],
        "accounting_nature": base["accounting_nature"],
        "provenance": "derived",
        "currency": base["currency"],
        "basis": "somme observée dans le corpus Orion — jamais un budget",
    }


def _aggregate_block(
    family: str, amount, amount_eur, projects: int, with_amount: int, with_eur: int
) -> dict[str, Any]:
    """Un roll-up avec sa couverture : l'absence est comptée, jamais fondue."""
    return {
        "measure": _rollup_envelope(family),
        "amount": _num(amount),
        "projects": projects,
        "coverage": {
            "with_amount": with_amount,
            "unknown_amount": projects - with_amount,
        },
        "amount_eur_observed": {
            **EUR_ENVELOPE,
            "amount": _num(amount_eur),
            "excluded_no_rate": projects - with_eur,
        },
    }


def _page(page: int, size: int) -> tuple[int, int]:
    size = min(max(size, 1), 100)
    return (max(page, 1) - 1) * size, size


# ---------------------------------------------------------------- financeur


def funder_node(db: Session, code: str) -> dict[str, Any]:
    funder = db.query(Funder).filter(Funder.code == code).first()
    if funder is None:
        raise NodeNotFound
    # UN SEUL balayage des projets du financeur, replié feuille → racine
    # (l'arbre EC a deux niveaux ; NIH/NSF sont plats). La variante
    # LATERAL par racine coûtait ~20 s sur les 77 instituts NIH.
    rollup = db.execute(
        text(
            """
            SELECT COALESCE(pr.parent_id, pr.id) AS root_id,
                   count(p.id) AS projects,
                   count(p.funding_amount) AS with_amount,
                   sum(p.funding_amount) AS amount,
                   count(p.funding_amount_eur) AS with_eur,
                   sum(p.funding_amount_eur) AS amount_eur
            FROM projects p JOIN programmes pr ON pr.id = p.programme_id
            WHERE p.funder_id = :fid
            GROUP BY COALESCE(pr.parent_id, pr.id)
            """
        ),
        {"fid": funder.id},
    ).all()
    by_root = {r.root_id: r for r in rollup}

    if not rollup:
        aggregate = None
    else:
        family = _family_of_funder(funder)
        aggregate = _aggregate_block(
            family,
            sum((r.amount for r in rollup if r.amount is not None), Decimal(0))
            if any(r.amount is not None for r in rollup)
            else None,
            sum((r.amount_eur for r in rollup if r.amount_eur is not None), Decimal(0))
            if any(r.amount_eur is not None for r in rollup)
            else None,
            sum(r.projects for r in rollup),
            sum(r.with_amount for r in rollup),
            sum(r.with_eur for r in rollup),
        )

    root_rows = db.execute(
        text("SELECT id, code, name FROM programmes WHERE funder_id = :fid AND parent_id IS NULL"),
        {"fid": funder.id},
    ).all()
    roots = sorted(
        (
            {
                "id": r.id,
                "code": r.code,
                "name": r.name,
                "projects": by_root[r.id].projects if r.id in by_root else 0,
                "with_amount": by_root[r.id].with_amount if r.id in by_root else 0,
                "amount": by_root[r.id].amount if r.id in by_root else None,
            }
            for r in root_rows
        ),
        key=lambda r: (r["amount"] is None, -(r["amount"] or 0), r["code"]),
    )

    return {
        "node": {
            "level": "funder",
            "id": funder.code,
            "label": funder.name,
            "currency": funder.default_currency,
            "provenance": {"table": "funders", "code": funder.code},
        },
        "aggregate": aggregate,
        "children": {
            "level": "programme",
            "total": len(roots),
            "items": [
                {
                    "level": "programme",
                    "id": r["id"],
                    "code": r["code"],
                    "label": r["name"],
                    "projects": r["projects"],
                    "amount": _num(r["amount"]),
                    "coverage": {
                        "with_amount": r["with_amount"],
                        "unknown_amount": r["projects"] - r["with_amount"],
                    },
                }
                for r in roots
            ],
        },
        "navigation": {"down": NAVIGATION_DOWN.get(funder.code, []), "up": []},
        "restrictions": [
            "les programmes des différents financeurs sont trois objets "
            "différents (ligne budgétaire / institut / division) — jamais "
            "comparables entre financeurs"
        ],
    }


# ---------------------------------------------------------------- programme


def programme_node(db: Session, programme_id: int, page: int = 1, size: int = 50) -> dict[str, Any]:
    programme = db.get(Programme, programme_id)
    if programme is None:
        raise NodeNotFound
    funder = db.get(Funder, programme.funder_id)
    offset, limit = _page(page, size)

    agg = db.execute(
        text(
            """
            SELECT count(p.id) AS projects, count(p.funding_amount) AS with_amount,
                   sum(p.funding_amount) AS amount,
                   count(p.funding_amount_eur) AS with_eur,
                   sum(p.funding_amount_eur) AS amount_eur,
                   min(p.source) AS source
            FROM projects p
            WHERE p.programme_id = :pid
               OR p.programme_id IN (
                    SELECT c.id FROM programmes c WHERE c.parent_id = :pid)
            """
        ),
        {"pid": programme_id},
    ).one()
    family = _family(agg.source) if agg.source else _family_of_funder(funder)
    aggregate = _aggregate_block(
        family, agg.amount, agg.amount_eur, agg.projects, agg.with_amount, agg.with_eur
    )

    sub_count = db.query(Programme).filter(Programme.parent_id == programme_id).count()
    if sub_count:
        children = _programme_children_programmes(db, programme_id)
    elif funder.code == "ec":
        children = _programme_children_calls(db, programme_id, offset, limit)
    else:
        children = _children_projects(
            db, "p.programme_id = :key", programme_id, family, offset, limit
        )

    parent: dict[str, Any]
    if programme.parent_id:
        parent_row = db.get(Programme, programme.parent_id)
        parent = {"level": "programme", "id": parent_row.id, "code": parent_row.code}
    else:
        parent = {"level": "funder", "id": funder.code}

    return {
        "node": {
            "level": "programme",
            "id": programme.id,
            "code": programme.code,
            "label": programme.name,
            "funder": funder.code,
            "parent": parent,
            "provenance": {
                "table": "programmes",
                "semantics": {
                    "ec": "ligne budgétaire (legalBasis CORDIS)",
                    "nih": "institut adjudicateur (ADMINISTERING_IC)",
                    "nsf": "division NSF",
                }[funder.code],
            },
        },
        "aggregate": aggregate,
        "children": children,
        "navigation": {
            "down": NAVIGATION_DOWN[funder.code],
            "up": [{"level": parent["level"], "status": "allowed", "reason": None}],
        },
        "restrictions": [ROLLUP_LABEL[family] + " — jamais le budget du programme"],
    }


def _family_of_funder(funder: Funder) -> str:
    return {"ec": "cordis", "nih": "nih", "nsf": "nsf"}.get(funder.code, "cordis")


def _programme_children_programmes(db: Session, programme_id: int) -> dict[str, Any]:
    rows = db.execute(
        text(
            """
            SELECT c.id, c.code, c.name, count(p.id) AS projects,
                   count(p.funding_amount) AS with_amount,
                   sum(p.funding_amount) AS amount
            FROM programmes c
            LEFT JOIN projects p ON p.programme_id = c.id
            WHERE c.parent_id = :pid
            GROUP BY c.id ORDER BY amount DESC NULLS LAST, c.code
            """
        ),
        {"pid": programme_id},
    ).all()
    direct = db.execute(
        text("SELECT count(*) FROM projects WHERE programme_id = :pid"), {"pid": programme_id}
    ).scalar_one()
    return {
        "level": "programme",
        "total": len(rows),
        # Les projets rattachés au parent lui-même restent une tranche
        # nommée — même règle que le drill de l'Explorateur.
        "directly_on_parent": direct,
        "items": [
            {
                "level": "programme",
                "id": r.id,
                "code": r.code,
                "label": r.name,
                "projects": r.projects,
                "amount": _num(r.amount),
                "coverage": {
                    "with_amount": r.with_amount,
                    "unknown_amount": r.projects - r.with_amount,
                },
            }
            for r in rows
        ],
    }


def _programme_children_calls(
    db: Session, programme_id: int, offset: int, limit: int
) -> dict[str, Any]:
    total = db.execute(
        text(
            "SELECT count(DISTINCT p.call_id) FROM projects p "
            "WHERE p.programme_id = :pid AND p.call_id IS NOT NULL"
        ),
        {"pid": programme_id},
    ).scalar_one()
    no_call = db.execute(
        text("SELECT count(*) FROM projects WHERE programme_id = :pid AND call_id IS NULL"),
        {"pid": programme_id},
    ).scalar_one()
    rows = db.execute(
        text(
            """
            SELECT c.id, c.code, count(p.id) AS projects,
                   count(p.funding_amount) AS with_amount,
                   sum(p.funding_amount) AS amount
            FROM projects p JOIN calls c ON c.id = p.call_id
            WHERE p.programme_id = :pid
            GROUP BY c.id ORDER BY amount DESC NULLS LAST, c.code
            LIMIT :limit OFFSET :offset
            """
        ),
        {"pid": programme_id, "limit": limit, "offset": offset},
    ).all()
    return {
        "level": "call",
        "total": total,
        "no_call_projects": no_call,
        "restriction": _CALL_RESTRICTION,
        "items": [
            {
                "level": "call",
                "id": r.id,
                "code": r.code,
                "projects": r.projects,
                "amount": _num(r.amount),
                "coverage": {
                    "with_amount": r.with_amount,
                    "unknown_amount": r.projects - r.with_amount,
                },
                # Le montant d'un appel affiché SOUS un programme ne
                # couvre que les projets de ce programme (anti-double-
                # compte des appels transversaux).
                "scope": "projects_of_this_programme_only",
            }
            for r in rows
        ],
    }


def _children_projects(
    db: Session, where: str, key, family: str, offset: int, limit: int
) -> dict[str, Any]:
    total, with_amount = db.execute(
        text(f"SELECT count(*), count(funding_amount) FROM projects p WHERE {where}"),
        {"key": key},
    ).one()
    rows = db.execute(
        text(
            f"""
            SELECT p.id, p.source, p.source_id, p.acronym, p.title,
                   p.funding_amount, p.start_date
            FROM projects p WHERE {where}
            ORDER BY p.funding_amount DESC NULLS LAST, p.id
            LIMIT :limit OFFSET :offset
            """
        ),
        {"key": key, "limit": limit, "offset": offset},
    ).all()
    return {
        "level": "project",
        "total": total,
        "coverage": {"with_amount": with_amount, "unknown_amount": total - with_amount},
        "items": [
            {
                "level": "project",
                "id": r.id,
                "source": r.source,
                "source_id": r.source_id,
                "label": r.acronym or r.title,
                "amount": _num(r.funding_amount),
                "measure_key": PROJECT_MEASURE[family]["key"],
            }
            for r in rows
        ],
    }


# ---------------------------------------------------------------- call


def call_node(
    db: Session,
    call_id: int,
    programme_id: int | None = None,
    page: int = 1,
    size: int = 50,
) -> dict[str, Any]:
    call = db.get(Call, call_id)
    if call is None:
        raise NodeNotFound
    offset, limit = _page(page, size)

    programmes = db.execute(
        text(
            """
            SELECT pr.id, pr.code, count(*) AS projects
            FROM projects p JOIN programmes pr ON pr.id = p.programme_id
            WHERE p.call_id = :cid GROUP BY pr.id ORDER BY projects DESC
            """
        ),
        {"cid": call_id},
    ).all()

    if programme_id is not None:
        where = "p.call_id = :key AND p.programme_id = :prog"
        params = {"key": call_id, "prog": programme_id}
    else:
        where = "p.call_id = :key"
        params = {"key": call_id}
    agg = db.execute(
        text(
            f"""
            SELECT count(*) AS projects, count(p.funding_amount) AS with_amount,
                   sum(p.funding_amount) AS amount,
                   count(p.funding_amount_eur) AS with_eur,
                   sum(p.funding_amount_eur) AS amount_eur
            FROM projects p WHERE {where}
            """
        ),
        params,
    ).one()
    rows = db.execute(
        text(
            f"""
            SELECT p.id, p.source, p.source_id, p.acronym, p.title,
                   p.funding_amount
            FROM projects p WHERE {where}
            ORDER BY p.funding_amount DESC NULLS LAST, p.id
            LIMIT :limit OFFSET :offset
            """
        ),
        {**params, "limit": limit, "offset": offset},
    ).all()

    aggregate = _aggregate_block(
        "cordis", agg.amount, agg.amount_eur, agg.projects, agg.with_amount, agg.with_eur
    )
    restrictions = []
    if len(programmes) > 1 and programme_id is None:
        restrictions.append(
            "appel transversal : sert plusieurs programmes — son total global "
            "ne doit apparaître sous AUCUN programme (double compte)"
        )

    return {
        "node": {
            "level": "call",
            "id": call.id,
            "code": call.code,
            "label": call.code,
            "funder": "ec",
            "provenance": {"table": "calls", "semantics": "subCall/masterCall CORDIS"},
        },
        "context": (
            {
                "programme_id": programme_id,
                "restriction": "seuls les projets de ce programme sont comptés ici",
            }
            if programme_id is not None
            else None
        ),
        "programmes": [
            {"level": "programme", "id": r.id, "code": r.code, "projects": r.projects}
            for r in programmes
        ],
        "aggregate": aggregate,
        "children": {
            "level": "project",
            "total": agg.projects,
            "coverage": {
                "with_amount": agg.with_amount,
                "unknown_amount": agg.projects - agg.with_amount,
            },
            "items": [
                {
                    "level": "project",
                    "id": r.id,
                    "source": r.source,
                    "source_id": r.source_id,
                    "label": r.acronym or r.title,
                    "amount": _num(r.funding_amount),
                    "measure_key": PROJECT_MEASURE["cordis"]["key"],
                }
                for r in rows
            ],
        },
        "navigation": {
            "down": NAVIGATION_DOWN["ec"],
            "up": [
                {
                    "level": "programme",
                    "status": "restricted" if len(programmes) > 1 else "allowed",
                    "reason": _CALL_RESTRICTION if len(programmes) > 1 else None,
                }
            ],
        },
        "restrictions": restrictions,
    }


# ---------------------------------------------------------------- projet


def _attribution(project: Project, programme: Programme | None) -> dict[str, Any]:
    """La nature du rattachement projet → programme (doctrine des trois
    natures, arbitrage B0.1) : littéral = fait source ; recouvré depuis
    legalBasis.csv (ancêtre commun compris) = dérivé Orion."""
    if programme is None:
        return {"provenance": None, "basis": None}
    if not project.source.startswith("cordis"):
        return {"provenance": "source_fact", "basis": "champ source direct"}
    raw_lb = ((project.raw or {}).get("legalBasis") or "").strip()
    if raw_lb == programme.code:
        return {"provenance": "source_fact", "basis": "legalBasis littéral de project.csv"}
    return {
        "provenance": "derived",
        "basis": "rattachement recouvré depuis legalBasis.csv (B0.1 — "
        "ancêtre commun si plusieurs parts à drapeau) ; la valeur "
        "project.csv était inutilisable ou différente",
    }


def _reconciliation(family: str, parent_amount, children: list) -> dict[str, Any]:
    """Total parent vs somme des enfants connus — le contrat D5.

    Le statut dit ce que les données permettent : `exact`, `gap`
    (non-ventilé positif), `children_exceed_parent` (les parts dépassent
    le plafond, cas EUROfusion), `no_parent_amount`, ou
    `not_applicable` quand l'étage enfant n'est PAS une ventilation
    (NIH : bénéficiaire)."""
    if family == "nih":
        return {
            "status": "not_applicable",
            "reason": "la participation NIH est un bénéficiaire, pas une "
            "ventilation financière — rien à réconcilier (B0 § 3)",
            "parent_amount": _num(parent_amount),
            "children_known_sum": None,
            "unallocated": None,
            "unknown_children": None,
            "coverage": None,
        }
    known = [c.amount for c in children if c.amount is not None]
    known_sum = sum(known, Decimal(0)) if known else None
    unknown = len(children) - len(known)
    if parent_amount is None:
        status = "no_parent_amount"
        unallocated = None
    elif known_sum is None:
        status = "no_children_amounts"
        unallocated = None
    else:
        unallocated = parent_amount - known_sum
        if abs(unallocated) <= Decimal("0.01") and unknown == 0:
            status = "exact"
        elif unallocated >= 0:
            status = "gap"
        else:
            status = "children_exceed_parent"
    return {
        "status": status,
        "reason": None,
        "parent_amount": _num(parent_amount),
        "children_known_sum": _num(known_sum),
        "unallocated": _num(unallocated),
        "unknown_children": unknown,
        "coverage": {"with_amount": len(known), "total": len(children)},
    }


def _nsf_annual_axis(db: Session, award_uids: list[str]) -> dict[str, Any] | None:
    """L'axe annuel R5B d'un projet NSF — un SECOND système de mesure,
    jamais un raffinement du cumul (R3) : fenêtre FY du snapshot, USD,
    versionné par millésime. Pré-agrégé PAR AWARD avant toute lecture
    (le grain crosstab porte plusieurs lignes par FY)."""
    if not award_uids:
        return None
    vintage = db.execute(
        text("SELECT max(vintage_date) FROM nsf_award_obligations")
    ).scalar_one_or_none()
    if vintage is None:
        return None
    rows = db.execute(
        text(
            """
            SELECT fiscal_year, sum(amount) AS amount
            FROM nsf_award_obligations
            WHERE vintage_date = :v AND award_id = ANY(:uids)
            GROUP BY fiscal_year ORDER BY fiscal_year
            """
        ),
        {"v": vintage, "uids": award_uids},
    ).all()
    if not rows:
        return None
    window_sum = sum((r.amount for r in rows), Decimal(0))
    return {
        "measure": {
            "key": "nsf_obligation_fy",
            "label": "Obligations annuelles NSF (snapshot officiel, R5B)",
            "accounting_nature": "obligation_fiscal_year",
            "provenance": "source_fact",
            "currency": "USD",
            "basis": "@Award Details Sheet, pré-agrégé par award",
        },
        "vintage": vintage.isoformat(),
        "fiscal_years": [{"fy": r.fiscal_year, "amount": _num(r.amount)} for r in rows],
        "window_sum": _num(window_sum),
        "comparability": {
            "with_cumulative_total": "incompatible",
            "reason": "fenêtre du snapshot (FY2011+) vs cumul depuis le début de "
            "l'award — les deux chiffres coexistent, chacun libellé, "
            "jamais sommés ni présentés comme le détail exact l'un de "
            "l'autre (B0 R3, gold BEACON)",
        },
    }


def project_node(db: Session, project_id: int) -> dict[str, Any]:
    project = db.get(Project, project_id)
    if project is None:
        raise NodeNotFound
    family = _family(project.source)
    programme = db.get(Programme, project.programme_id) if project.programme_id else None
    call = db.get(Call, project.call_id) if project.call_id else None

    participations = db.execute(
        text(
            """
            SELECT pt.id, pt.role, pt.amount, pt.amount_eur, pt.currency,
                   pt.country_code, pt.source_uid, pt.order_index,
                   o.id AS organisation_id, o.name AS organisation_name
            FROM participations pt
            JOIN organisations o ON o.id = pt.organisation_id
            WHERE pt.project_id = :pid
            ORDER BY pt.order_index NULLS LAST, pt.id
            """
        ),
        {"pid": project_id},
    ).all()

    part_measure = PARTICIPATION_MEASURE[family]
    children_level = "beneficiary" if family == "nih" else "participation"
    items = []
    for r in participations:
        item = {
            "level": children_level,
            "organisation": {
                "level": "organisation",
                "id": r.organisation_id,
                "label": r.organisation_name,
            },
            "role": r.role,
            "country": r.country_code,
            "source_uid": r.source_uid,
            "semantics": part_measure["semantics"],
        }
        if family == "nih":
            # Le montant ingéré est une COPIE du total projet — l'exposer
            # ici fabriquerait une fausse ventilation (I1, I7).
            item["amount"] = None
            item["amount_note"] = part_measure["basis"]
        else:
            item["amount"] = _num(r.amount)
            item["amount_eur_observed"] = {**EUR_ENVELOPE, "amount": _num(r.amount_eur)}
            item["measure_key"] = part_measure["key"]
        items.append(item)

    measure = dict(PROJECT_MEASURE[family])
    if family == "nsf" and project.source_id.startswith("c-"):
        measure["provenance"] = "derived"
        measure["basis"] = (
            "fratrie collaborative repliée (analyse Orion assumée, gardes "
            "documentées) : somme des awd_amount des awards membres"
        )

    total_cost: dict[str, Any] | None = None
    if family == "cordis":
        if project.total_cost is not None and project.total_cost == 0:
            # D7 : le zéro publié par CORDIS est une absence de donnée,
            # jamais un coût réellement nul — provenance conservée.
            total_cost = {
                "amount": None,
                "status": "not_available",
                "provenance_note": "source_published_zero (CORDIS publie 0 "
                "quand le coût total n'est pas renseigné — arbitrage D7)",
            }
        else:
            total_cost = {
                "amount": _num(project.total_cost),
                "status": "available" if project.total_cost is not None else "unknown",
                "measure": {
                    "key": "total_cost",
                    "label": "Coût total du projet, cofinancements inclus",
                    "accounting_nature": "total_project_cost",
                    "provenance": "source_fact",
                    "currency": "EUR",
                    "basis": "cordis:project.totalCost — strictement ≠ contribution UE, "
                    "jamais additionné avec elle",
                },
            }

    reconciliation = _reconciliation(family, project.funding_amount, participations)

    result: dict[str, Any] = {
        "node": {
            "level": "project",
            "id": project.id,
            "source": project.source,
            "source_id": project.source_id,
            "label": project.acronym or project.title,
            "title": project.title,
            "funder": {"cordis": "ec", "nih": "nih", "nsf": "nsf"}[family],
            "start_date": project.start_date.isoformat() if project.start_date else None,
            "end_date": project.end_date.isoformat() if project.end_date else None,
            "parent": (
                {"level": "call", "id": call.id, "code": call.code}
                if call
                else (
                    {"level": "programme", "id": programme.id, "code": programme.code}
                    if programme
                    else None
                )
            ),
            "programme": (
                {
                    "level": "programme",
                    "id": programme.id,
                    "code": programme.code,
                    "attribution": _attribution(project, programme),
                }
                if programme
                else None
            ),
            "provenance": {"table": "projects", "source_id": project.source_id},
        },
        "measure": {
            **measure,
            "amount": _num(project.funding_amount),
        },
        "amount_eur_observed": {**EUR_ENVELOPE, "amount": _num(project.funding_amount_eur)},
        "total_cost": total_cost,
        "children": {
            "level": children_level,
            "total": len(items),
            "measure": part_measure,
            "items": items,
        },
        "reconciliation": reconciliation,
        "navigation": {
            "down": NAVIGATION_DOWN[{"cordis": "ec", "nih": "nih", "nsf": "nsf"}[family]],
            "up": [
                {
                    "level": "call" if call else "programme",
                    "status": "allowed",
                    "reason": None,
                }
            ],
        },
        "restrictions": [],
    }
    if family == "nsf":
        result["annual_obligations"] = _nsf_annual_axis(db, [r.source_uid for r in participations])
    return result


# ------------------------------------------------------- organisation / pays


# La source d'une participation désigne son financeur sans jointure :
# les chargeurs écrivent participation.source = source du projet
# (cordis-* → ec). Éviter la jointure projects fait tomber le nœud pays
# US de 2,3 s à 1,6 s (plan B1.1 : le hash de la table projects entière
# coûtait ~900 ms pour ne rapporter que funder/source).
_FUNDER_BY_FAMILY = {"cordis": "ec", "nih": "nih", "nsf": "nsf"}


def _by_funder_blocks(db: Session, where: str, key) -> list[dict[str, Any]]:
    rows = db.execute(
        text(
            f"""
            SELECT pt.source,
                   count(*) AS participations,
                   count(DISTINCT pt.project_id) AS projects,
                   count(pt.amount) AS with_amount,
                   sum(pt.amount) AS amount,
                   count(pt.amount_eur) AS with_eur,
                   sum(pt.amount_eur) AS amount_eur
            FROM participations pt
            WHERE {where}
            GROUP BY pt.source
            """
        ),
        {"key": key},
    ).all()
    # Regroupe les trois sources CORDIS sous le financeur ec — même
    # mesure, même devise (B0 § 4).
    merged: dict[str, dict[str, Any]] = {}
    for r in rows:
        family = _family(r.source)
        funder = _FUNDER_BY_FAMILY.get(family)
        if funder is None:
            continue  # source hors chaîne (fixtures) — jamais un bloc inventé
        block = merged.setdefault(
            funder,
            {
                "funder": funder,
                "family": family,
                "participations": 0,
                "projects": 0,
                "with_amount": 0,
                "amount": None,
                "with_eur": 0,
                "amount_eur": None,
            },
        )
        block["participations"] += r.participations
        block["projects"] += r.projects
        block["with_amount"] += r.with_amount
        block["with_eur"] += r.with_eur
        if r.amount is not None:
            block["amount"] = (block["amount"] or Decimal(0)) + r.amount
        if r.amount_eur is not None:
            block["amount_eur"] = (block["amount_eur"] or Decimal(0)) + r.amount_eur

    labels = {
        "cordis": "Σ des contributions UE observées de cette entité (parts source)",
        "nih": "Σ des montants des projets NIH dont l'entité est bénéficiaire "
        "(PAS une ventilation : le bénéficiaire porte le total projet)",
        "nsf": "Σ des obligations cumulées des awards NSF de l'entité",
    }
    keys = {
        "cordis": "ec_contribution_sum",
        "nih": "nih_beneficiary_projects_total",
        "nsf": "nsf_awards_obligated_sum",
    }
    blocks = []
    for block in merged.values():
        family = block["family"]
        base = PARTICIPATION_MEASURE[family] if family != "nih" else PROJECT_MEASURE["nih"]
        blocks.append(
            {
                "funder": block["funder"],
                "measure": {
                    "key": keys[family],
                    "label": labels[family],
                    "accounting_nature": base["accounting_nature"],
                    "provenance": "derived",
                    "currency": base["currency"],
                    "basis": "somme observée dans le corpus Orion",
                },
                "amount": _num(block["amount"]),
                "projects": block["projects"],
                "participations": block["participations"],
                "coverage": {
                    "with_amount": block["with_amount"],
                    "unknown_amount": block["participations"] - block["with_amount"],
                },
                "amount_eur_observed": {
                    **EUR_ENVELOPE,
                    "amount": _num(block["amount_eur"]),
                    "excluded_no_rate": block["participations"] - block["with_eur"],
                },
            }
        )
    blocks.sort(key=lambda b: b["funder"])
    return blocks


def organisation_node(db: Session, organisation_id: int) -> dict[str, Any]:
    organisation = db.get(Organisation, organisation_id)
    if organisation is None:
        raise NodeNotFound
    return {
        "node": {
            "level": "organisation",
            "id": organisation.id,
            "label": organisation.name,
            "country": organisation.country_code,
            "provenance": {
                "table": "organisations",
                "note": "entité dédupliquée inter-sources — la déduplication "
                "est une ANALYSE Orion (B0 § 5)",
            },
        },
        "by_funder": _by_funder_blocks(db, "pt.organisation_id = :key", organisation_id),
        # I8/I3 : pas de champ total — le refus est le contrat, pas un oubli.
        "cross_funder_total": CROSS_FUNDER_TOTAL_REFUSAL,
        "navigation": {
            "down": [
                {
                    "level": "country",
                    "status": "allowed",
                    "reason": "pays de l'organisation (destination institutionnelle)",
                }
            ],
            "up": [
                {"level": "project", "status": "allowed", "reason": None},
                {"level": "programme", "status": "allowed", "reason": ASCENT_RESTRICTION},
                {"level": "funder", "status": "restricted", "reason": ASCENT_RESTRICTION},
            ],
        },
        "restrictions": [ASCENT_RESTRICTION],
    }


def country_node(db: Session, country_code: str) -> dict[str, Any]:
    exists = db.execute(
        text("SELECT 1 FROM countries WHERE code = :key"), {"key": country_code}
    ).scalar()
    if not exists:
        raise NodeNotFound
    organisations = db.execute(
        text(
            # Sous-requête DISTINCT : l'agrégat direct choisissait un
            # parcours d'index complet (966 k buffers, 1,4 s sur US) ;
            # cette forme hash-distinct tient en 235 ms sans index (B1.1).
            "SELECT count(*) FROM (SELECT DISTINCT organisation_id "
            "FROM participations WHERE country_code = :key) s"
        ),
        {"key": country_code},
    ).scalar_one()
    return {
        "node": {
            "level": "country",
            "id": country_code,
            "label": country_code,
            "provenance": {
                "table": "participations.country_code",
                "note": "pays de l'organisation participante — destination "
                "institutionnelle, jamais un lieu d'exécution ni un "
                "effort national (B0 § 4)",
            },
        },
        "organisations": organisations,
        "by_funder": _by_funder_blocks(db, "pt.country_code = :key", country_code),
        "cross_funder_total": CROSS_FUNDER_TOTAL_REFUSAL,
        "navigation": {
            "down": [],
            "up": [
                {"level": "organisation", "status": "allowed", "reason": None},
                {"level": "funder", "status": "restricted", "reason": ASCENT_RESTRICTION},
            ],
        },
        "restrictions": [ASCENT_RESTRICTION],
    }
