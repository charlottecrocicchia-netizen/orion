"""L'envoi du lien magique — stdlib seule, SMTP configurable.

Le corps est du TEXTE BRUT : la porte email (2026-08-21) a montré que
Brevo n'y réécrit pas les URLs — un lien de connexion réécrit via un
domaine de tracking serait un lien qui passe par un tiers. La recette
du lot vérifie que le lien reçu pointe directement vers le site.
"""

import email.utils
import smtplib
from email.message import EmailMessage

from orion.core.config import get_settings


def send_login_email(to: str, link: str) -> None:
    settings = get_settings()
    msg = EmailMessage()
    msg["From"] = email.utils.formataddr(("Orion", settings.smtp_from))
    msg["To"] = to
    msg["Subject"] = "Votre lien de connexion Orion — Your Orion sign-in link"
    msg["Date"] = email.utils.formatdate(localtime=True)
    msg["Message-ID"] = email.utils.make_msgid(domain="lensorion.com")
    msg.set_content(
        "Connexion à Orion — ce lien est valable 15 minutes et ne sert "
        "qu'une fois :\n\n"
        f"{link}\n\n"
        "Si vous n'êtes pas à l'origine de cette demande, ignorez cet "
        "email : sans ce lien, personne ne peut se connecter.\n\n"
        "---\n\n"
        "Sign in to Orion — this link is valid for 15 minutes and works "
        "once. If you did not request it, simply ignore this email.\n\n"
        f"— Orion · {settings.public_origin}\n"
    )
    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=30) as smtp:
        smtp.starttls()
        smtp.login(settings.smtp_user, settings.smtp_password)
        smtp.send_message(msg)
