"""Jetons opaques (D1/D3) : 256 bits de `secrets`, stockés en SHA-256.

Un dump de la base ne donne ni lien de connexion ni session utilisable ;
le clair ne vit que dans l'email (lien magique) ou le navigateur
(cookie). Pas de JWT — la révocation est un DELETE.
"""

import hashlib
import secrets


def new_token() -> tuple[str, str]:
    """(clair, hash) — le clair part vers le destinataire, le hash en base."""
    clear = secrets.token_urlsafe(32)
    return clear, hash_token(clear)


def hash_token(clear: str) -> str:
    return hashlib.sha256(clear.encode()).hexdigest()


def mask_email(email: str) -> str:
    """`charlotte@example.com` → `c••••@example.com` (verrou 2 : la
    confirmation porte l'adresse partiellement masquée)."""
    local, _, domain = email.partition("@")
    head = local[0] if local else ""
    return f"{head}••••@{domain}"
