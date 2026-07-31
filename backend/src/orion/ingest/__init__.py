"""Ingestion pipelines, one module per public source.

Live: reference (countries, funders), CORDIS (Horizon Europe, H2020, FP7), ANR.
Coming in phase 1: ADEME, LIFE.
"""

from orion.ingest import anr, cordis, dedup, reference

__all__ = ["anr", "cordis", "dedup", "reference"]
