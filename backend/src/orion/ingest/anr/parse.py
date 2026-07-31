import csv
from collections.abc import Iterator
from datetime import date
from decimal import Decimal
from pathlib import Path

from pydantic import BaseModel

from orion.ingest.reference import parse_decimal

# Personal data present in the ANR files is deliberately NOT ingested:
# Responsable_scientifique.{Nom,Prenom,ORCID} identify individuals and play no
# part in funding intelligence (data minimisation — see ADR 0002).
PERSONAL_DATA_COLUMNS = frozenset(
    {
        "Projet.Partenaire.Responsable_scientifique.Nom",
        "Projet.Partenaire.Responsable_scientifique.Prenom",
        "Projet.Partenaire.Responsable_scientifique.ORCID",
    }
)


def iter_rows(path: Path) -> Iterator[dict[str, str]]:
    """Yield sanitized rows, with personal-data columns dropped at the door."""
    with path.open(encoding="utf-8-sig", newline="") as fh:
        for row in csv.DictReader(fh, delimiter=";", quotechar='"', restval=""):
            row.pop(None, None)
            yield {
                key: (value or "")
                for key, value in row.items()
                if key and key not in PERSONAL_DATA_COLUMNS
            }


def _clean(raw: str | None, limit: int | None = None) -> str | None:
    value = (raw or "").strip()
    if not value:
        return None
    return value[:limit] if limit else value


def _parse_date(raw: str | None) -> date | None:
    value = (raw or "").strip()
    if not value:
        return None
    try:
        return date.fromisoformat(value[:10])
    except ValueError:
        return None


def _parse_year(raw: str | None) -> int | None:
    value = (raw or "").strip()[:4]
    return int(value) if value.isdigit() else None


class AnrProjectRow(BaseModel):
    source_id: str
    acronym: str | None
    title: str
    title_lang: str
    abstract: str | None
    abstract_lang: str | None
    start_date: date | None
    funding_amount: Decimal | None
    programme_code: str | None
    programme_name: str | None
    edition: int | None
    raw: dict[str, str]

    @classmethod
    def from_csv(cls, row: dict[str, str]) -> "AnrProjectRow":
        # DGDS files carry both languages; DGPIE files are French-only.
        title_fr = _clean(row.get("Projet.Titre.Francais"))
        title_en = _clean(row.get("Projet.Titre.Anglais"))
        title, title_lang = (title_fr, "fr") if title_fr else (title_en, "en")

        abstract_fr = _clean(row.get("Projet.Resume.Francais"))
        abstract_en = _clean(row.get("Projet.Resume.Anglais"))
        abstract, abstract_lang = (
            (abstract_fr, "fr") if abstract_fr else (abstract_en, "en" if abstract_en else None)
        )

        programme_code = _clean(row.get("Programme.Acronyme") or row.get("Action.Edition"), 100)
        return cls(
            source_id=_clean(row.get("Projet.Code_Decision")) or "",
            acronym=_clean(row.get("Projet.Acronyme"), 100),
            title=title or "",
            title_lang=title_lang,
            abstract=abstract,
            abstract_lang=abstract_lang,
            start_date=_parse_date(
                row.get("Projet.T0 scientifique") or row.get("Projet.Date_debut")
            ),
            funding_amount=parse_decimal(
                row.get("Projet.Montant.AF.Aide_allouee.ANR") or row.get("Projet.Aide_allouee")
            ),
            programme_code=programme_code,
            programme_name=_clean(row.get("Action.Titre.Francais")),
            edition=_parse_year(row.get("AAP.Edition") or row.get("Action.Edition")),
            raw=row,
        )

    def is_valid(self) -> bool:
        return bool(self.source_id.startswith("ANR-") and self.title)


class AnrPartnerRow(BaseModel):
    project_source_id: str
    partner_source_id: str
    is_coordinator: bool
    name: str
    category: str | None
    rnsr: str | None
    city: str | None
    region: str | None
    country_raw: str | None
    amount: Decimal | None

    @classmethod
    def from_csv(cls, row: dict[str, str]) -> "AnrPartnerRow":
        return cls(
            project_source_id=_clean(row.get("Projet.Code_Decision")) or "",
            partner_source_id=_clean(row.get("Projet.Partenaire.Code_Decision"), 200) or "",
            is_coordinator=(row.get("Projet.Partenaire.Est_coordinateur") or "").strip().lower()
            in {"true", "1", "oui"},
            name=_clean(row.get("Projet.Partenaire.Nom_organisme")) or "",
            category=_clean(row.get("Projet.Partenaire.Categorie_organisme"), 50),
            rnsr=_clean(row.get("Projet.Partenaire.Code_RNSR"), 100),
            city=_clean(row.get("Projet.Partenaire.Adresse.Ville"), 200),
            region=_clean(row.get("Projet.Partenaire.Adresse.Region"), 100),
            country_raw=_clean(row.get("Projet.Partenaire.Adresse.Pays"), 100),
            amount=parse_decimal(row.get("Projet.Partenaire.Aide_allouee.ANR")),
        )

    def is_valid(self) -> bool:
        return bool(
            self.project_source_id.startswith("ANR-") and self.partner_source_id and self.name
        )
