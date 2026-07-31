"""Ingestion pipelines, one module per public source.

Live: reference (countries, funders), CORDIS (Horizon Europe, H2020, FP7).
Coming in phase 1: ANR, ADEME, LIFE.
"""

from orion.ingest import cordis, reference
from orion.ingest.cordis import load

__all__ = ["cordis", "load", "reference"]
