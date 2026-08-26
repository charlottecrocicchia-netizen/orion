#!/usr/bin/env python3
"""Validations finales R5B sur les artefacts posés dans nsf/."""

import glob
import json
import os

DEST = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REQUIRED_COLS = [
    "Award ID",
    "Fiscal Year",
    "Award Obligation Amount",
    "Award Instrument",
    "Funding Directorate",
]


def decode(path):
    with open(path, "rb") as f:
        data = f.read()
    bom = data[:2] == b"\xff\xfe"
    return bom, data.decode("utf-16-le").lstrip("﻿"), len(data)


def award_ids(text):
    """Ensemble des Award ID (première colonne utile) du TSV décodé."""
    ids = set()
    lines = text.splitlines()
    header = lines[0].split("\t")
    try:
        idx = next(i for i, c in enumerate(header) if "Award ID" in c)
    except StopIteration:
        idx = None
    for ln in lines[1:]:
        cells = ln.split("\t")
        if idx is not None and idx < len(cells):
            ids.add(cells[idx].strip())
    return ids


def main():
    report = {}
    all_ids = {}
    for fy in range(2011, 2026):
        p = os.path.join(DEST, f"award-details-fy{fy}.tsv")
        if not os.path.exists(p):
            report[fy] = "ABSENT"
            continue
        bom, text, nbytes = decode(p)
        lines = text.splitlines()
        header = lines[0].split("\t")
        missing = [c for c in REQUIRED_COLS if not any(c in col for col in header)]
        fys_in_file = set()
        try:
            fyidx = next(i for i, c in enumerate(header) if c.strip() == "Fiscal Year")
        except StopIteration:
            fyidx = None
        if fyidx is not None:
            for ln in lines[1:]:
                cells = ln.split("\t")
                if fyidx < len(cells):
                    fys_in_file.add(cells[fyidx].strip())
        all_ids[fy] = award_ids(text)
        report[fy] = {
            "bom_utf16le": bom,
            "bytes": nbytes,
            "lines": len(lines),
            "columns": len(header),
            "missing_required": missing,
            "fiscal_years_in_file": sorted(fys_in_file),
            "gt_1000_lines": len(lines) > 1000,
        }
    print(json.dumps(report, indent=1, ensure_ascii=False))

    print("\n--- contrôles ponctuels ---")
    checks = [
        ("1902627", 2019, True),
        ("2221247", 2022, True),
        ("1823600", 2018, True),
        ("1823600", 2024, True),
    ]
    for award, fy, expected in checks:
        present = award in all_ids.get(fy, set())
        status = "OK" if present == expected else "ANOMALIE"
        etat = "présent" if present else "ABSENT"
        print(f"{status} : award {award} {etat} dans fy{fy} (attendu: présent)")
    hits = [fy for fy, ids in all_ids.items() if "2102180" in ids]
    if hits:
        print(f"ANOMALIE : award 2102180 présent dans {hits} (attendu : aucun)")
    else:
        print("OK : award 2102180 absent de tous les fichiers (attendu)")

    print("\n--- meta sidecars ---")
    for p in sorted(glob.glob(os.path.join(DEST, "*.tsv"))):
        m = p + ".meta.json"
        print(os.path.basename(p), "meta:", "présent" if os.path.exists(m) else "MANQUANT")


if __name__ == "__main__":
    main()
