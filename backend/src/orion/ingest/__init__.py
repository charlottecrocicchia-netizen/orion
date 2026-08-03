"""Ingestion pipelines, one module per public source.

Live: reference (countries, funders), ECB rates, CORDIS (Horizon Europe,
H2020, FP7), NIH RePORTER, and the identity layer (GLEIF, Wikidata,
groups). The ANR left the product on 2026-08-03 — its ODbL share-alike
clause is a legal risk a commercial SaaS does not take; read the licence
rule in docs/data-sources.md before adding any source.
"""

from orion.ingest import cordis, dedup, reference

__all__ = ["cordis", "dedup", "reference"]
