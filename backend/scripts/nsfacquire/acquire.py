#!/usr/bin/env python3
"""Acquisition R5B : exports Crosstab du dashboard NSF by the Numbers.

Stratégie A — protocole vizql rejoué en HTTP pur (urllib, python3 système).
Usage :
  python3 acquire.py awards 2011 2012 ...   # exports @Award Details Sheet + Filters Used par FY
  python3 acquire.py trends                 # exports Trend-Awards Obligated Amount (Blue)/(Gold)
Les fichiers vont dans le dossier parent (nsf/). Reprise : les FY déjà
valides (fichier + meta présents) sont sautés.
"""

import contextlib
import datetime
import json
import os
import re
import subprocess
import sys
import time
import urllib.error

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from tableau_client import TableauSession, parse_chunked

DEST = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # .../r5/nsf
DS = "federated.1ucp0d20vxue551c2il2p0ombnfm"
FN_FY = f"[{DS}].[none:Fiscal Year (copy)_1294222005582745603:ok]"
FN_METRIC = f"[{DS}].[none:Calculation_1727693475224645632:nk]"
METRIC_VALUE = "Award Obligation ($M)"
CODEBOOK = "v1.0.7 (April 2026)"
REQUIRED_COLS = [
    "Award ID",
    "Fiscal Year",
    "Award Obligation Amount",
    "Award Instrument",
    "Funding Directorate",
]


def log(*a):
    print(f"[{datetime.datetime.now(datetime.UTC).isoformat(timespec='seconds')}]", *a, flush=True)


def sha256(path):
    out = subprocess.run(["shasum", "-a", "256", path], capture_output=True, text=True, check=True)
    return out.stdout.split()[0]


def write_meta(path, source_url, sheet, filters, method):
    n = os.path.getsize(path)
    meta = {
        "source_url": source_url,
        "sheet": sheet,
        "filters": filters,
        "acquired_at": datetime.datetime.now(datetime.UTC).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "codebook_version": CODEBOOK,
        "bytes": n,
        "sha256": sha256(path),
        "method": method,
    }
    with open(path + ".meta.json", "w") as f:
        json.dump(meta, f, indent=1, ensure_ascii=False)
        f.write("\n")
    return meta


def validate_tsv(path, min_lines=2):
    with open(path, "rb") as f:
        data = f.read()
    if data[:2] != b"\xff\xfe":
        return False, "BOM UTF-16LE absent"
    text = data.decode("utf-16-le")
    lines = text.splitlines()
    header = lines[0].lstrip("﻿") if lines else ""
    cols = header.split("\t")
    missing = [c for c in REQUIRED_COLS if not any(c in col for col in cols)]
    return True, {"lines": len(lines), "columns": len(cols), "missing_required": missing}


class DetailsSession:
    """Session sur la vue Details, avec le filtre métrique déjà appliqué."""

    def __init__(self):
        self.s = None
        self.view_ids = None

    def open(self):
        self.s = TableauSession("Details")
        self.s.start()
        chunks = parse_chunked(self.s.bootstrap())
        world = chunks[0]["worldUpdate"]["applicationPresModel"]
        dp = world["workbookPresModel"]["dashboardPresModel"]
        self.view_ids = dp["viewIds"]
        log("session ouverte", self.s.session_id, "viewIds:", list(self.view_ids))
        # filtre métrique sur les deux feuilles de détail concernées
        self.catfilter("@Award Details Sheet", FN_METRIC, "Select Award Metrics 1", [METRIC_VALUE])

    def catfilter(self, worksheet, fn, caption, values):
        r = self.s.command(
            "tabdoc/dashboard-categorical-filter",
            {
                "visualIdPresModel": json.dumps({"worksheet": worksheet, "dashboard": "Details"}),
                "globalFieldName": fn,
                "qualifiedFieldCaption": caption,
                "membershipTarget": "filter",
                "filterUpdateType": "filter-replace",
                "filterValues": json.dumps(values),
                "exclude": "false",
            },
        )
        txt = r.decode("utf-8", "replace")
        m = re.search(r'"errorMessage": "([^"]*)"', txt)
        if m:
            raise RuntimeError(f"filtre {caption}={values} refusé : {m.group(1)}")
        return r

    def export_view(self, sheet_name, out_path):
        r = self.s.command(
            "tabsrv/export-crosstab-to-csvserver",
            {
                "useTabs": "true",
                "viewId": self.view_ids[sheet_name],
            },
        )
        txt = r.decode("utf-8", "replace")
        m = re.search(r'"resultKey": "([^"]+)"', txt)
        if not m:
            raise RuntimeError(f"pas de resultKey dans la réponse export : {txt[:400]}")
        key = m.group(1)
        path_q = (
            f"{self.s.vizql_root}/tempfile/sessions/{self.s.session_id}"
            f"?key={key}&keepfile=yes&attachment=yes"
        )
        data, headers = self.s.get_raw(path_q)
        with open(out_path, "wb") as f:
            f.write(data)
        url = f"https://tableau.external.nsf.gov{path_q}"
        return url, len(data)


def acquire_awards(years):
    sess = DetailsSession()
    sess.open()
    results = {}
    for fy in years:
        out = os.path.join(DEST, f"award-details-fy{fy}.tsv")
        fu_out = os.path.join(DEST, f"filters-used-fy{fy}.tsv")
        if os.path.exists(out) and os.path.exists(out + ".meta.json"):
            log(f"FY{fy} déjà acquis, sauté")
            continue
        for attempt in (1, 2, 3):
            try:
                log(f"FY{fy} : filtre Fiscal Year = {fy}")
                sess.catfilter("@New Awards Details", FN_FY, "Fiscal Year", [str(fy)])
                log(f"FY{fy} : export @Award Details Sheet")
                url, n = sess.export_view("@Award Details Sheet", out)
                ok, info = validate_tsv(out)
                if not ok:
                    raise RuntimeError(f"validation échouée : {info}")
                log(f"FY{fy} : {n} octets, {info}")
                filters = {"Fiscal Year": [str(fy)], "Select Award Metrics 1": [METRIC_VALUE]}
                write_meta(out, url, "@Award Details Sheet", filters, "http-script")
                # Filters Used — facultatif : la feuille peut être vide
                # (« The crosstab has no data ») ; dans ce cas les filtres
                # restent consignés dans le meta de l'artefact principal.
                try:
                    log(f"FY{fy} : export Filters Used")
                    url2, n2 = sess.export_view("Filters Used", fu_out)
                    ok2, info2 = validate_tsv(fu_out)
                    log(f"FY{fy} : Filters Used {n2} octets, {info2}")
                    write_meta(fu_out, url2, "Filters Used", filters, "http-script")
                except urllib.error.HTTPError as e:
                    detail = ""
                    with contextlib.suppress(Exception):
                        detail = e.read().decode("utf-8", "replace")[:300]
                    log(
                        f"FY{fy} : Filters Used indisponible ({e.code}) — "
                        f"filtres consignés dans le meta principal. {detail}"
                    )
                    for p in (fu_out, fu_out + ".meta.json"):
                        if os.path.exists(p):
                            os.remove(p)
                results[fy] = info
                time.sleep(8)
                break
            except (urllib.error.HTTPError, urllib.error.URLError, OSError, RuntimeError) as e:
                detail = ""
                if isinstance(e, urllib.error.HTTPError):
                    with contextlib.suppress(Exception):
                        detail = e.read().decode("utf-8", "replace")[:500]
                log(f"FY{fy} tentative {attempt} : ÉCHEC {type(e).__name__}: {e} {detail}")
                for p in (out, out + ".meta.json", fu_out, fu_out + ".meta.json"):
                    if os.path.exists(p):
                        os.remove(p)
                if attempt < 3:
                    time.sleep(5)
                    log("réouverture de session")
                    sess.open()
                else:
                    raise
    return results


def acquire_trends():
    s = TableauSession("Trends")
    s.start()
    chunks = parse_chunked(s.bootstrap())
    dp = chunks[0]["worldUpdate"]["applicationPresModel"]["workbookPresModel"]["dashboardPresModel"]
    view_ids = dp["viewIds"]
    log("session Trends", s.session_id, "viewIds:", list(view_ids))
    for sheet, fname in [
        ("Trend-Awards Obligated Amount (Blue)", "trend-awards-obligated-amount-blue.tsv"),
        ("Trend-Awards Obligated Amount (Gold)", "trend-awards-obligated-amount-gold.tsv"),
    ]:
        out = os.path.join(DEST, fname)
        r = s.command(
            "tabsrv/export-crosstab-to-csvserver", {"useTabs": "true", "viewId": view_ids[sheet]}
        )
        m = re.search(r'"resultKey": "([^"]+)"', r.decode("utf-8", "replace"))
        if not m:
            raise RuntimeError(f"pas de resultKey pour {sheet}")
        path_q = (
            f"{s.vizql_root}/tempfile/sessions/{s.session_id}"
            f"?key={m.group(1)}&keepfile=yes&attachment=yes"
        )
        data, _ = s.get_raw(path_q)
        with open(out, "wb") as f:
            f.write(data)
        ok, info = validate_tsv(out)
        log(sheet, "->", fname, len(data), "octets", info)
        write_meta(
            out,
            f"https://tableau.external.nsf.gov{path_q}",
            sheet,
            {"note": "état par défaut de la page Trends, aucun filtre modifié"},
            "http-script",
        )


if __name__ == "__main__":
    mode = sys.argv[1] if len(sys.argv) > 1 else "awards"
    if mode == "awards":
        years = [int(y) for y in sys.argv[2:]] or list(range(2011, 2026))
        acquire_awards(years)
    elif mode == "trends":
        acquire_trends()
    else:
        raise SystemExit(f"mode inconnu : {mode}")
    log("terminé")
