from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings, read from ORION_* environment variables."""

    model_config = SettingsConfigDict(env_prefix="ORION_", extra="ignore")

    env: str = "dev"
    database_url: str = "postgresql+psycopg://orion:orion@localhost:5432/orion"
    data_dir: str = "data"
    # Weekly full refresh, Monday 03:00 UTC (crontab syntax).
    ingest_cron: str = "0 3 * * 1"
    ingest_on_start: bool = False
    # Les jobs que CE conteneur scheduler porte (E1, deux régimes
    # d'ingestion) : « all » = la moisson complète hebdomadaire (Mac),
    # « calls » = les appels seuls, quotidiens (VPS). Liste à virgules.
    scheduler_jobs: str = "all"
    # La fraîcheur des appels : quotidienne, 05:00 UTC.
    calls_cron: str = "0 5 * * *"

    # --- Euros constants (lot A) ---
    # L'année de référence : la dernière année civile complète publiée
    # dans la vintage courante des indices (HICP, CPI-U) avec son taux
    # BCE en base. Basculer vers 2026 = changer cette valeur, zéro
    # migration — le mode constant se REFUSE de lui-même tant que les
    # trois données de l'année demandée manquent (constant_euro.py).
    constant_euro_reference_year: int = 2025

    # --- Comptes (conception-workspace, lot 1) ---
    # L'origine publique du site — la base des liens magiques envoyés
    # par email. En prod : https://lensorion.com.
    public_origin: str = "http://localhost:5173"
    # Mode dev/e2e : aucun email ne part, le lien s'écrit dans la
    # réponse de POST /api/auth/login (jamais en prod).
    auth_dev: bool = False
    # La porte d'accès (amendement 2026-08-21) : emails approuvés,
    # séparés par des virgules. VIDE = porte fermée pour tous (défaut
    # sûr) ; un email hors liste reçoit la même réponse et rien ne part.
    login_allowlist: str = ""
    # Verrou 5 — seuils du rate limit de la demande de lien. Les
    # DÉFAUTS sont le contrat de prod ; seule la pile locale relève la
    # limite IP (le harnais e2e vient d'une seule IP et l'épuiserait).
    login_limit_per_ip_hour: int = 20
    login_limit_per_pair_hour: int = 5
    login_limit_per_email_hour: int = 10
    login_cooldown_seconds: int = 60
    # L'envoi SMTP (porte email franchie le 2026-08-21 : Brevo).
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = ""

    @property
    def allowed_emails(self) -> frozenset[str]:
        return frozenset(e.strip().lower() for e in self.login_allowlist.split(",") if e.strip())


@lru_cache
def get_settings() -> Settings:
    return Settings()
