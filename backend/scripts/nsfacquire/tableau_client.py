#!/usr/bin/env python3
"""Client HTTP pur pour le protocole Tableau vizql (NSF by the Numbers).

Aucune dépendance hors bibliothèque standard. Python3 système.
"""

import http.cookiejar
import io
import json
import random
import re
import string
import urllib.parse
import urllib.request

HOST = "https://tableau.external.nsf.gov"
WORKBOOK = "NSFbyNumbers"


class TableauSession:
    def __init__(self, view):
        self.view = view
        self.jar = http.cookiejar.CookieJar()
        self.opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.jar))
        self.opener.addheaders = [
            (
                "User-Agent",
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
            ),
            ("Accept-Language", "en-US,en;q=0.9"),
        ]
        self.session_id = None
        self.routing_key = None  # Global-Session-Header
        self.config = None
        self.vizql_root = None

    def _request(self, url, data=None, headers=None, method=None):
        req = urllib.request.Request(url, data=data, method=method)
        for k, v in (headers or {}).items():
            req.add_header(k, v)
        if self.routing_key:
            req.add_header("Global-Session-Header", self.routing_key)
        return self.opener.open(req, timeout=180)

    def start(self):
        # 1. GET la page (cookies éventuels)
        self._request(f"{HOST}/views/{WORKBOOK}/{self.view}?:embed=y&:showVizHome=no").read()
        # 2. POST startSession/viewing
        url = (
            f"{HOST}/vizql/w/{WORKBOOK}/v/{self.view}/startSession/viewing?:embed=y&:showVizHome=no"
        )
        resp = self._request(
            url,
            method="POST",
            headers={
                "Accept": "application/json",
                "Tableau-Viz-Path": f"/w/{WORKBOOK}#{random.randint(0, 2)}",
            },
            data=b"",
        )
        self.routing_key = resp.headers.get("Global-Session-Header") or None
        body = resp.read()
        self.config = json.loads(body)
        self.session_id = self.config["sessionid"]
        self.vizql_root = self.config["vizql_root"]
        return self.config

    def bootstrap(self):
        url = f"{HOST}{self.vizql_root}/bootstrapSession/sessions/{self.session_id}"
        fields = {
            "worksheetPortSize": '{"w":1425,"h":983}',
            "dashboardPortSize": '{"w":1425,"h":983}',
            "clientDimension": '{"w":1425,"h":983}',
            "renderMapsClientSide": "true",
            "isBrowserRendering": "true",
            "browserRenderingThreshold": "100",
            "formatDataValueLocally": "false",
            "clientNum": "1",
            "navType": "Nav",
            "navSrc": "Parse",
            "devicePixelRatio": "2",
            "clientRenderPixelRatio": "2",
            "allowAutogenWorksheetPhoneLayouts": "false",
            "sheet_id": self.config["sheetId"],
            "showParams": self.config["showParams"],
            "stickySessionKey": self.config["stickySessionKey"],
            "filterTileSize": "200",
            "locale": "en_US",
            "language": "en",
            "verboseMode": "false",
            ":session_feature_flags": "{}",
            "keychain_version": "1",
        }
        data = urllib.parse.urlencode(fields).encode()
        resp = self._request(
            url,
            data=data,
            headers={
                "Content-Type": "application/x-www-form-urlencoded",
                "Accept": "text/javascript",
                "X-Requested-With": "XMLHttpRequest",
                "X-Tsi-Active-Tab": self.config["sheetId"],
            },
        )
        return resp.read()

    def command(self, ns_cmd, fields, extra_headers=None):
        """POST multipart /sessions/<id>/commands/<ns>/<cmd>."""
        url = f"{HOST}{self.vizql_root}/sessions/{self.session_id}/commands/{ns_cmd}"
        boundary = "----WebKitFormBoundary" + "".join(
            random.choices(string.ascii_letters + string.digits, k=16)
        )
        buf = io.BytesIO()
        for k, v in fields.items():
            buf.write(f"--{boundary}\r\n".encode())
            buf.write(f'Content-Disposition: form-data; name="{k}"\r\n\r\n'.encode())
            buf.write(str(v).encode())
            buf.write(b"\r\n")
        buf.write(f"--{boundary}--\r\n".encode())
        headers = {
            "Content-Type": f"multipart/form-data; boundary={boundary}",
            "Accept": "text/javascript",
            "X-Requested-With": "XMLHttpRequest",
            "X-Tsi-Active-Tab": self.config["sheetId"],
        }
        headers.update(extra_headers or {})
        resp = self._request(url, data=buf.getvalue(), headers=headers)
        return resp.read()

    def get_raw(self, path_and_query):
        """GET binaire brut (tempfile)."""
        resp = self._request(f"{HOST}{path_and_query}")
        return resp.read(), dict(resp.headers)


def parse_chunked(payload):
    """Le format bootstrap: '<len>;{json}<len>;{json}...' -> liste de dicts.

    len est en caractères UTF-8 ? En pratique octets. On décode prudemment.
    """
    out = []
    text = payload.decode("utf-8") if isinstance(payload, bytes) else payload
    i = 0
    while i < len(text):
        m = re.match(r"(\d+);", text[i:])
        if not m:
            break
        n = int(m.group(1))
        start = i + m.end()
        out.append(json.loads(text[start : start + n]))
        i = start + n
    return out


def find_paths(obj, pred, path=""):
    """Debug: retrouve les chemins où pred(clé, valeur) est vrai."""
    hits = []
    if isinstance(obj, dict):
        for k, v in obj.items():
            p = f"{path}.{k}"
            try:
                if pred(k, v):
                    hits.append((p, v))
            except Exception:
                pass
            hits.extend(find_paths(v, pred, p))
    elif isinstance(obj, list):
        for idx, v in enumerate(obj):
            hits.extend(find_paths(v, pred, f"{path}[{idx}]"))
    return hits
