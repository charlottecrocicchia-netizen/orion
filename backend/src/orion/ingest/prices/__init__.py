"""Les indices de prix officiels (lot A) — chargeur versionné par vintage.

Deux séries, licences relues sur pièce (conception § 0) : HICP Eurostat
`prc_hicp_aind` (zone euro, tous articles, moyenne annuelle — CC-BY 4.0)
et CPI-U BLS `CUUR0000SA0` (all items, US city average, moyennes
annuelles — domaine public). Cadence annuelle, geste manuel :
`orion-ingest prices` — pas de job scheduler."""

from orion.ingest.prices.load import run

__all__ = ["run"]
