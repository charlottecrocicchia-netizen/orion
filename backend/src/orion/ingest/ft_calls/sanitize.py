"""Sanitizer HTML par allowlist — stdlib seulement, pas de dépendance.

Le portail publie descriptions et conditions en HTML riche. Orion les
affiche : tout ce qui n'est pas dans l'allowlist est DÉBALLÉ (le texte
reste, la balise part), les attributs sont jetés sauf `href` des liens
http(s), et le texte est ré-échappé. L'original complet vit dans `raw` —
le sanitizer perd de la mise en forme, jamais de l'information d'audit.
"""

import html
from html.parser import HTMLParser

ALLOWED_TAGS = frozenset(
    {
        "p",
        "br",
        "ul",
        "ol",
        "li",
        "strong",
        "em",
        "b",
        "i",
        "u",
        "a",
        "h3",
        "h4",
        "table",
        "thead",
        "tbody",
        "tr",
        "th",
        "td",
    }
)
VOID_TAGS = frozenset({"br"})
# Le contenu de ces balises est du code ou du bruit, pas du texte à garder.
DROP_CONTENT_TAGS = frozenset({"script", "style"})


class _Sanitizer(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []
        self._drop_depth = 0
        # Un booléen par <a> ouvert : émis (href sûr) ou déballé.
        self._a_stack: list[bool] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag in DROP_CONTENT_TAGS:
            self._drop_depth += 1
            return
        if self._drop_depth or tag not in ALLOWED_TAGS:
            return
        if tag == "a":
            href = next((value for name, value in attrs if name == "href"), None)
            emitted = bool(href and href.startswith(("http://", "https://")))
            if emitted:
                self.parts.append(
                    f'<a href="{html.escape(href or "", quote=True)}"'
                    ' rel="noopener noreferrer" target="_blank">'
                )
            # Lien sans destination sûre : le texte reste, la balise part.
            self._a_stack.append(emitted)
        elif tag in VOID_TAGS:
            self.parts.append(f"<{tag}>")
        else:
            self.parts.append(f"<{tag}>")

    def handle_endtag(self, tag: str) -> None:
        if tag in DROP_CONTENT_TAGS:
            self._drop_depth = max(0, self._drop_depth - 1)
            return
        if self._drop_depth or tag not in ALLOWED_TAGS or tag in VOID_TAGS:
            return
        if tag == "a":
            if self._a_stack and self._a_stack.pop():
                self.parts.append("</a>")
            return
        self.parts.append(f"</{tag}>")

    def handle_data(self, data: str) -> None:
        if not self._drop_depth:
            self.parts.append(html.escape(data))


def sanitize_html(value: str | None) -> str | None:
    if not value:
        return None
    parser = _Sanitizer()
    parser.feed(value)
    parser.close()
    result = "".join(parser.parts).strip()
    return result or None
