from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Placeholder values that must never be treated as a real secret in any deployment.
_SECRET_KEY_PLACEHOLDERS = {
    "",
    "change-me-in-production",
    "dev-secret-key-change-in-production",
    "your-secret-key-here-change-in-production",
}


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "AI Revenue Recovery Agent"
    app_env: str = "development"
    debug: bool = False
    secret_key: str

    database_url: str = "sqlite+aiosqlite:///./revenue_recovery.db"

    anthropic_api_key: str = ""

    smtp_host: str = "smtp.gmail.com"
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""

    twilio_account_sid: str = ""
    twilio_auth_token: str = ""
    twilio_whatsapp_from: str = "whatsapp:+14155238886"

    frontend_url: str = "http://localhost:3000"

    # ── Public demo deployment ────────────────────────────────
    # Origin allowed to call this API via CORS (e.g. the WordPress marketing
    # site / hosted frontend URL). No wildcard for a publicly reachable API.
    allowed_origin: str = "http://localhost:3000"

    # When true (the default): destructive endpoints are disabled and
    # interactive API docs (/docs, /redoc) are turned off.
    public_demo_mode: bool = True

    # How often (in minutes) the demo database is restored to its
    # originally-seeded state. Only used when public_demo_mode is true.
    demo_reset_interval_minutes: int = 60

    @field_validator("secret_key")
    @classmethod
    def validate_secret_key(cls, v: str) -> str:
        if v.strip() in _SECRET_KEY_PLACEHOLDERS:
            raise ValueError(
                "SECRET_KEY must be set to a real, generated value via the SECRET_KEY "
                "environment variable — it cannot be blank or use a placeholder default. "
                "Generate one with: python -c \"import secrets; print(secrets.token_hex(32))\""
            )
        return v


settings = Settings()
