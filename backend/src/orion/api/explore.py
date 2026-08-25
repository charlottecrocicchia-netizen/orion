from datetime import date, timedelta
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session

from orion import constanteuro, macro
from orion.api.lens_param import resolve_lens_param
from orion.core.config import get_settings
from orion.core.db import get_db
from orion.ingest import subdivisions
from orion.search import aggregates, explore, groups_hub

router = APIRouter()


@router.get("/explore/aggregate")
def explore_aggregate(  # noqa: PLR0913 — one whitelisted signature for every composed view
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    metric: str = "funding",
    by: str = "country",
    split: bool = False,
    compare: Annotated[str | None, Query(description="tilde-separated keys")] = None,
    year_from: int | None = None,
    year_to: int | None = None,
    q: str | None = None,
    country: str | None = None,
    scope: Annotated[
        str | None, Query(description="manager region slug — frames every view")
    ] = None,
    limit: int = 8,
    programme: Annotated[
        int | None, Query(description="drill-down: group by this programme's direct children")
    ] = None,
    organisation: Annotated[
        str | None,
        Query(description="entity filter: organisation id or group ref (g<id>)"),
    ] = None,
    sector: Annotated[
        str | None,
        Query(description="registry lens: '<slug>' (core+enabling) or '<slug>-direct'"),
    ] = None,
    subdivision: Annotated[str | None, Query(description="mesh filter: ISO 3166-2 (US-CA)")] = None,
    value: Annotated[
        str,
        Query(description="reading mode (R0 § D10): nominal (default), real, gdp, capita or ppp"),
    ] = "nominal",
    base: Annotated[
        int | None,
        Query(description="real mode reference year — defaults to the configured one"),
    ] = None,
    cur: Annotated[str, Query(description="real mode display currency (EUR or USD)")] = "EUR",
) -> dict[str, Any]:
    # Le mode real (euros constants, moteur A sous la grammaire R0) se
    # REFUSE explicitement quand les indices ou le taux de la devise
    # d'affichage manquent pour l'année demandée — jamais un repli
    # silencieux vers le nominal côté serveur (422 réservé à cette
    # indisponibilité globale du mode).
    factor_set = None
    scale = None
    macro_denominators = None
    rates = None
    ppp_set = None
    if value == "real":
        if cur not in constanteuro.DISPLAY_CURRENCIES:
            raise HTTPException(status_code=400, detail="Unsupported display currency")
        reference_year = base or get_settings().constant_euro_reference_year
        factor_set = constanteuro.factor_set(db, reference_year, display_currency=cur)
        if factor_set is None:
            raise HTTPException(status_code=422, detail="real_unavailable")
    elif value in ("gdp", "capita"):
        # ECONOMIC SCALE (lot R3, R0 § D3/D4) : le mode n'existe que là
        # où CHAQUE série a un dénominateur de juridiction résoluble —
        # by=funder (effort), by=country ou by=year cadré sur un pays
        # (intensité reçue), métrique funding. Ailleurs : refus
        # explicite, jamais une interprétation silencieuse.
        view_ok = by == "funder" or by == "country" or (by == "year" and country)
        if metric != "funding" or not view_ok:
            raise HTTPException(status_code=422, detail=f"{value}_unavailable")
        scale = value
        concept = "gdp_current_usd" if value == "gdp" else "population"
        macro_denominators = macro.macro_set(db, concept)
        if macro_denominators is None:
            raise HTTPException(status_code=422, detail=f"{value}_unavailable")
        if value == "gdp":
            rates = macro.usd_rates(db)
            if not rates:
                raise HTTPException(status_code=422, detail="gdp_unavailable")
        else:
            # Par-habitant : numérateur en valeur RÉELLE — année de
            # référence et devise d'affichage comme en real (R0 § D1).
            if cur not in constanteuro.DISPLAY_CURRENCIES:
                raise HTTPException(status_code=400, detail="Unsupported display currency")
            reference_year = base or get_settings().constant_euro_reference_year
            factor_set = constanteuro.factor_set(db, reference_year, display_currency=cur)
            if factor_set is None:
                raise HTTPException(status_code=422, detail="capita_unavailable")
    elif value == "ppp":
        # PURCHASING POWER (lot R4B). L'ordre des contrôles est celui du
        # § 17 étape 6 : du plus large au plus précis, chacun avec son
        # code — un message faux serait pire qu'un refus générique.
        #
        # ① Les paramètres étrangers au mode. Le client les efface à
        # l'écriture (canonicalisation) ; une URL forgée à la main les
        # porterait encore, et le silence formerait une combinaison que
        # la grammaire interdit. `cur` a un défaut et `perspective`
        # n'est pas déclaré : seule la chaîne brute les distingue.
        if {"base", "cur", "perspective"} & set(request.query_params):
            raise HTTPException(status_code=400, detail="Unsupported parameter for value=ppp")
        # ② La vue : quatre dimensions, la métrique monétaire, pas de
        # série éclatée (un `split` est un axe temporel déguisé).
        if by not in explore.PPP_DIMS or metric != "funding" or split:
            raise HTTPException(status_code=422, detail="ppp_unavailable")
        # ③ Une seule année d'attribution — la condition d'existence du
        # mode (§ 4.4). Une borne unique n'est jamais produite par
        # l'Explorateur mais reste forçable : elle tombe ici, jamais
        # devinée.
        if year_from is None or year_to is None or year_from != year_to:
            raise HTTPException(status_code=422, detail="ppp_requires_single_award_year")
        # ④ Le couple, à millésimes alignés. `None` couvre deux cas —
        # rien de chargé, ou millésimes divergents (défaut de
        # chargement, journalisé) : dans les deux, le mode n'existe pas.
        ppp_set = macro.ppp_ratio_set(db)
        if ppp_set is None:
            raise HTTPException(status_code=422, detail="ppp_unavailable")
        # ⑤ L'année elle-même. Deux préconditions GLOBALES de l'année —
        # les séries et le taux BCE — donc un seul code, et un message
        # qui n'attribue la cause à personne en particulier.
        rates = macro.usd_rates(db)
        if year_from not in ppp_set.years or year_from not in rates:
            raise HTTPException(status_code=422, detail="ppp_year_unavailable")
    elif value != "nominal":
        raise HTTPException(status_code=400, detail="Unsupported value mode")
    result = explore.aggregate(
        db,
        metric=metric,
        by=by,
        split=split,
        compare=compare.split("~") if compare else None,
        year_from=year_from,
        year_to=year_to,
        q=q or None,
        country=country or None,
        scope=scope or None,
        limit=limit,
        programme=programme,
        organisation=organisation or None,
        sector=resolve_lens_param(request, db, sector),
        subdivision=subdivision or None,
        factor_set=factor_set,
        scale=scale,
        macro=macro_denominators,
        usd_rates=rates,
        ppp=ppp_set,
    )
    if result is None:
        raise HTTPException(status_code=400, detail="Unsupported metric/dimension combination")
    # ⑥ Le seul refus qui ne peut PAS se décider avant la requête : le
    # périmètre filtré porte de la valeur nominale, mais rien n'y est
    # convertible (§ 15.3). Savoir si les Bermudes ont une référence en
    # 2025 demande la requête. Le corps calculé est jeté — une vue non
    # définie n'a ni couverture ni exclusions, et n'est JAMAIS servie
    # comme « 100 % exclu ». La décision étant déterministe, le cache
    # d'agrégats reste valide : c'est elle qui est rejouée.
    if result.get("meta", {}).get("reference", {}).get("no_convertible_value"):
        raise HTTPException(status_code=422, detail="ppp_reference_unavailable_for_view")
    return result


@router.get("/explore/ppp-years")
def ppp_years(db: Annotated[Session, Depends(get_db)]) -> dict[str, list[int]]:
    """Les années d'attribution que le mode PPP peut RÉELLEMENT honorer.

    « Le contrôle n'offre que ce que la vue peut honorer » (R0 § D6) :
    sans cette liste, le sélecteur proposait le mode sur une année sans
    référence — 2026 aujourd'hui — et l'utilisateur tombait sur un refus.
    Les conditions sont exactement celles du contrôle ⑤ de l'agrégat :
    le couple publié ET le taux BCE de l'année. Le client ne peut donc
    jamais proposer une année qui finirait en 422.

    La liste vient du référentiel, jamais d'une borne codée en dur : le
    jour où la Banque mondiale publiera 2026, le mode y apparaîtra sans
    qu'une ligne change."""
    ppp = macro.ppp_ratio_set(db)
    if ppp is None:
        return {"years": []}
    rates = macro.usd_rates(db)
    return {"years": sorted(year for year in ppp.years if year in rates)}


@router.get("/stats")
def stats(db: Annotated[Session, Depends(get_db)]) -> dict[str, Any]:
    return aggregates.global_stats(db)


@router.get("/countries")
def countries(db: Annotated[Session, Depends(get_db)]) -> list[dict[str, Any]]:
    return aggregates.countries_index(db)


@router.get("/regions")
def regions(db: Annotated[Session, Depends(get_db)]) -> list[dict[str, Any]]:
    """The five manager regions, aggregated from the countries' view."""
    return aggregates.regions_index(db)


@router.get("/groups/{group_id}")
def group(group_id: int, db: Annotated[Session, Depends(get_db)]) -> dict[str, Any]:
    """A corporate group's consolidated file — the identity layer read
    as a product surface (never a merge of the entities)."""
    hub = groups_hub.group_hub(db, group_id)
    if hub is None:
        raise HTTPException(status_code=404, detail="Group not found")
    # Le poste de veille consolidé — même horloge que la fiche
    # organisation : « nouveau partenaire » = premier projet partagé
    # dans les 24 derniers mois.
    hub["watchpost"] = aggregates.group_watchpost(
        db, group_id, (date.today() - timedelta(days=730)).isoformat()
    )
    return hub


@router.get("/compare/organisations")
def compare_organisations(
    db: Annotated[Session, Depends(get_db)],
    ids: Annotated[str, Query(description="tilde-separated organisation ids, 2 to 4")],
) -> dict[str, Any]:
    # Le benchmark accepte les groupes (« g<id> ») comme les
    # organisations — Safran face à Thales EN TANT QUE groupes.
    refs = [
        ref
        for ref in ids.split("~")
        if ref.isdigit() or (ref.startswith("g") and ref[1:].isdigit())
    ][:4]
    if len(refs) < 1:
        raise HTTPException(status_code=400, detail="ids must hold 1 to 4 entity refs")
    return aggregates.compare_entries(db, refs)  # {entries, common_partners}


@router.get("/countries/flows")
def countries_flows(
    db: Annotated[Session, Depends(get_db)], limit: int = 60
) -> list[dict[str, Any]]:
    return aggregates.country_flows(db, limit=min(max(limit, 1), 200))


@router.get("/countries/{code}")
def country(code: str, db: Annotated[Session, Depends(get_db)]) -> dict[str, Any]:
    hub = aggregates.country_hub(db, code)
    if hub is None:
        raise HTTPException(status_code=404, detail="Country not found")
    # La maille sous le pays (lot D) : présente quand le référentiel en
    # tient une pour ce pays — la fiche décide seule d'ouvrir sa carte
    # d'États, jamais une liste en dur côté client.
    hub["subdivisions"] = subdivisions.subdivision_index(db, code.upper())
    return hub


@router.get("/programmes")
def programmes(db: Annotated[Session, Depends(get_db)]) -> list[dict[str, Any]]:
    return aggregates.programmes_index(db)


@router.get("/programmes/{programme_id}")
def programme(programme_id: int, db: Annotated[Session, Depends(get_db)]) -> dict[str, Any]:
    hub = aggregates.programme_hub(db, programme_id)
    if hub is None:
        raise HTTPException(status_code=404, detail="Programme not found")
    return hub
