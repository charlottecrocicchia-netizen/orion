#!/usr/bin/env python3
"""Construit MANIFEST.json depuis les sidecars *.meta.json présents dans nsf/."""

import datetime
import glob
import json
import os

DEST = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
entries = []
for meta_path in sorted(glob.glob(os.path.join(DEST, "*.meta.json"))):
    with open(meta_path) as f:
        meta = json.load(f)
    artefact = os.path.basename(meta_path)[: -len(".meta.json")]
    entries.append(
        {
            "file": artefact,
            "sheet": meta.get("sheet"),
            "filters": meta.get("filters"),
            "bytes": meta.get("bytes"),
            "sha256": meta.get("sha256"),
            "method": meta.get("method"),
            "acquired_at": meta.get("acquired_at"),
        }
    )
manifest = {
    "source": "https://tableau.external.nsf.gov/views/NSFbyNumbers/"
    " (dashboard NSF by the Numbers, session invitée)",
    "codebook_version": "v1.0.7 (April 2026)",
    "generated_at": datetime.datetime.now(datetime.UTC).strftime("%Y-%m-%dT%H:%M:%SZ"),
    "artefacts": entries,
}
out = os.path.join(DEST, "MANIFEST.json")
with open(out, "w") as f:
    json.dump(manifest, f, indent=1, ensure_ascii=False)
    f.write("\n")
print(f"{out} : {len(entries)} artefacts")
