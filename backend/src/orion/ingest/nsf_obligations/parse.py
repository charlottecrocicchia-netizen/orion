"""Parseur déterministe des artefacts « @Award Details Sheet » (R5B, C2).

Le fichier que Tableau appelle CSV est en réalité TABULÉ UTF-16LE avec
BOM : le format est DÉTECTÉ ET VALIDÉ explicitement, jamais supposé
(contrat R5A § 20.1 C2). Toute ligne qui ne matche pas exactement un
motif attendu est un refus bruyant — aucun chiffre n'est deviné, aucun
n'est retapé.

Les montants sortent formatés dans la locale du navigateur au moment de
l'export : « $24,209,691.00 » (en-US) ou « $24 209 691,00 » (fr, espaces
insécables). Les DEUX motifs, et EUX SEULS, sont acceptés — mélangés
dans un même fichier c'est un refus (un artefact vient d'une session,
donc d'une locale).
"""

import re
from dataclasses import dataclass
from decimal import Decimal

PARSER_VERSION = "1.0.0"

BOM_UTF16_LE = b"\xff\xfe"

# Colonnes REQUISES, par leur nom exact dans l'en-tête officiel.
REQUIRED_COLUMNS = (
    "Award ID",
    "Fiscal Year",
    "Award Fiscal Year",
    "Funding Directorate",
    "Funding Division",
    "Award Instrument",
    "Managing Directorate",
    "Managing Division",
    "Institution ID",
    "Institution Name",
    "Institution State Code",
    "Country Code",
    "Award Obligation Amount",
)

# Les deux formats de montant, exclusifs l'un de l'autre par artefact.
_SPACES = "   "  # insécable, fine insécable, espace
# Le signe négatif s'observe AVANT ou APRÈS le dollar (« -$1,234.56 »
# et « $-491.58 », les deux constatés sur pièces) — jamais doublé.
_AMOUNT_EN = re.compile(r"^(?:-\$|\$-|-|\$)?\d{1,3}(,\d{3})*\.\d{2}$")
_AMOUNT_FR = re.compile(rf"^(?:-\$|\$-|-|\$)?\d{{1,3}}([{_SPACES}]\d{{3}})*,\d{{2}}$")
_YEAR = re.compile(rf"^\d{{4}}$|^\d[{_SPACES}]\d{{3}}$")
_AWARD_ID = re.compile(r"^\d{1,10}$")


class ArtifactFormatError(ValueError):
    """Le fichier ne respecte pas le format attendu — refus bruyant."""


@dataclass(frozen=True)
class ObligationRow:
    award_id: str
    fiscal_year: int
    award_fiscal_year: int | None
    funding_directorate: str | None
    funding_division: str | None
    award_instrument: str | None
    managing_directorate: str | None
    managing_division: str | None
    institution_id: str | None
    institution_name: str | None
    institution_state_code: str | None
    country_code: str | None
    amount: Decimal


def decode(raw: bytes, *, filename: str) -> str:
    """Valide le BOM UTF-16LE et décode — le format est vérifié, pas supposé."""
    if not raw.startswith(BOM_UTF16_LE):
        raise ArtifactFormatError(
            f"{filename}: BOM UTF-16LE (FF FE) absent — le fichier n'est pas "
            "l'export Crosstab attendu"
        )
    return raw.decode("utf-16-le").lstrip("﻿")


def _parse_year(value: str, *, filename: str, line: int, column: str) -> int:
    cleaned = value.strip()
    if not _YEAR.match(cleaned):
        raise ArtifactFormatError(f"{filename}:{line}: {column} illisible: {cleaned!r}")
    return int(re.sub(rf"[{_SPACES}]", "", cleaned))


def _parse_amount(value: str, *, locale: str, filename: str, line: int) -> Decimal:
    cleaned = value.strip()
    if locale == "en":
        if not _AMOUNT_EN.match(cleaned):
            raise ArtifactFormatError(f"{filename}:{line}: montant hors format en-US: {cleaned!r}")
        negative = "-" in cleaned
        digits = cleaned.replace("$", "").replace(",", "").replace("-", "")
        if negative:
            digits = "-" + digits
    else:
        if not _AMOUNT_FR.match(cleaned):
            raise ArtifactFormatError(f"{filename}:{line}: montant hors format fr: {cleaned!r}")
        negative = "-" in cleaned
        digits = re.sub(rf"[{_SPACES}]", "", cleaned.replace("$", "")).replace(",", ".")
        digits = digits.replace("-", "")
        if negative:
            digits = "-" + digits
    return Decimal(digits)


def detect_amount_locale(sample: str, *, filename: str) -> str:
    """Détecte la locale des montants sur le premier montant rencontré.

    Un artefact vient d'une session, donc d'une seule locale : chaque
    montant suivant est validé contre CE format, et un mélange casse."""
    cleaned = sample.strip()
    if _AMOUNT_EN.match(cleaned):
        return "en"
    if _AMOUNT_FR.match(cleaned):
        return "fr"
    raise ArtifactFormatError(
        f"{filename}: premier montant {cleaned!r} hors des deux formats attendus"
    )


def _read_grid(text: str, *, filename: str) -> list[list[str]]:
    """Lit le tabulé Tableau en lignes LOGIQUES.

    Constaté sur l'artefact réel (FY2019, 2026-08-26) : fins de ligne
    **LF**, et les champs contenant tab, retour à la ligne ou guillemet
    sont **quotés façon CSV** (`"…"`, guillemets doublés). Le dialecte
    est donc csv(delimiter=tab, quotechar='"'), lu en mode strict —
    toute quote malformée est un refus, jamais une réparation."""
    import csv
    import io

    try:
        return list(csv.reader(io.StringIO(text), delimiter="\t", quotechar='"', strict=True))
    except csv.Error as exc:
        raise ArtifactFormatError(f"{filename}: dialecte tabulé illisible: {exc}") from exc


def parse_award_details(raw: bytes, *, filename: str) -> list[ObligationRow]:
    """Parse un artefact « @Award Details Sheet » complet, ou refuse."""
    text = decode(raw, filename=filename)
    grid = _read_grid(text, filename=filename)
    if grid and grid[-1] == []:
        grid.pop()
    if not grid:
        raise ArtifactFormatError(f"{filename}: artefact vide")
    # Les noms officiels portent des espaces traînants (« Award
    # Obligation Amount␣␣ ») et une colonne vide finale : le lookup se
    # fait sur les noms STRIPPÉS, la largeur reste exigée constante.
    header = [h.strip() for h in grid[0]]
    missing = [c for c in REQUIRED_COLUMNS if c not in header]
    if missing:
        raise ArtifactFormatError(f"{filename}: colonnes absentes: {missing}")
    idx = {name: header.index(name) for name in REQUIRED_COLUMNS}
    width = len(grid[0])

    rows: list[ObligationRow] = []
    locale: str | None = None
    for number, fields in enumerate(grid[1:], start=2):
        if fields == []:
            raise ArtifactFormatError(f"{filename}:{number}: ligne vide inattendue")
        if len(fields) != width:
            raise ArtifactFormatError(
                f"{filename}:{number}: {len(fields)} champs pour {width} colonnes"
            )
        raw_amount = fields[idx["Award Obligation Amount"]]
        if locale is None:
            locale = detect_amount_locale(raw_amount, filename=filename)
        award_id = fields[idx["Award ID"]].strip()
        if not _AWARD_ID.match(award_id):
            raise ArtifactFormatError(f"{filename}:{number}: Award ID illisible: {award_id!r}")
        award_fy_raw = fields[idx["Award Fiscal Year"]].strip()
        rows.append(
            ObligationRow(
                award_id=award_id,
                fiscal_year=_parse_year(
                    fields[idx["Fiscal Year"]],
                    filename=filename,
                    line=number,
                    column="Fiscal Year",
                ),
                award_fiscal_year=(
                    _parse_year(
                        award_fy_raw, filename=filename, line=number, column="Award Fiscal Year"
                    )
                    if award_fy_raw
                    else None
                ),
                funding_directorate=fields[idx["Funding Directorate"]].strip() or None,
                funding_division=fields[idx["Funding Division"]].strip() or None,
                award_instrument=fields[idx["Award Instrument"]].strip() or None,
                managing_directorate=fields[idx["Managing Directorate"]].strip() or None,
                managing_division=fields[idx["Managing Division"]].strip() or None,
                institution_id=fields[idx["Institution ID"]].strip() or None,
                institution_name=fields[idx["Institution Name"]].strip() or None,
                institution_state_code=fields[idx["Institution State Code"]].strip() or None,
                country_code=fields[idx["Country Code"]].strip() or None,
                amount=_parse_amount(raw_amount, locale=locale, filename=filename, line=number),
            )
        )
    if not rows:
        raise ArtifactFormatError(f"{filename}: aucune ligne de données")
    return rows


def parse_trend_totals(raw: bytes, *, filename: str) -> dict[int, Decimal]:
    """Parse l'artefact de contrôle « Trend-Awards Obligated Amount ».

    Matrice Crosstab : une colonne de libellés, des colonnes d'exercices ;
    la ligne des montants porte un montant par FY. Les cellules vides
    (exercices non renseignés par la vue) sont ignorées ; tout montant
    présent doit matcher un des deux formats."""
    text = decode(raw, filename=filename)
    grid = [row for row in _read_grid(text, filename=filename) if row]
    if len(grid) < 2:
        raise ArtifactFormatError(f"{filename}: matrice Trends illisible")
    year_columns: dict[int, int] = {}
    header_row = None
    for row in grid:
        found = {
            col: int(re.sub(rf"[{_SPACES}]", "", cell.strip()))
            for col, cell in enumerate(row)
            if _YEAR.match(cell.strip())
        }
        if len(found) >= 2:
            header_row = row
            year_columns = {year: col for col, year in found.items()}
            break
    if header_row is None:
        raise ArtifactFormatError(f"{filename}: aucune ligne d'exercices trouvée")
    # La matrice mêle des lignes de montants (« $8,601.82M », dupliquées
    # par une ligne tooltip identique) et des lignes techniques
    # (« Trendline Buffer » : années). Une cellule n'est un candidat QUE
    # si elle matche un motif de montant — suffixe M (millions abrégés)
    # détecté par cellule ; le reste est ignoré. Deux montants
    # DIFFÉRENTS pour la même année restent un refus.
    totals: dict[int, Decimal] = {}
    for row in grid:
        if row is header_row:
            continue
        for year, col in year_columns.items():
            cell = row[col].strip() if col < len(row) else ""
            if not cell:
                continue
            has_m = cell.endswith("M")
            body = cell[:-1] if has_m else cell
            if _AMOUNT_EN.match(body):
                value = _parse_amount(body, locale="en", filename=filename, line=0)
            elif _AMOUNT_FR.match(body):
                value = _parse_amount(body, locale="fr", filename=filename, line=0)
            else:
                continue
            if has_m:
                value *= Decimal(1_000_000)
            if year in totals and totals[year] != value:
                raise ArtifactFormatError(f"{filename}: deux totaux différents pour FY{year}")
            totals[year] = value
    if not totals:
        raise ArtifactFormatError(f"{filename}: aucun total annuel lu")
    return totals
