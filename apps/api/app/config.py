from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # SQLite by default so local setup needs zero infrastructure.
    # Production uses Postgres: paste the provider's URL as-is (postgres://… or postgresql://…).
    database_url: str = "sqlite:///./ajaia.db"
    jwt_secret: str = "dev-only-secret-change-me-in-production-0123456789"
    jwt_algorithm: str = "HS256"
    cookie_name: str = "ajaia_session"
    cookie_secure: bool = False
    session_hours: int = 24 * 7
    cors_origins: str = "http://localhost:3000"
    # 4 MB, not 5: Vercel rejects request bodies above ~4.5 MB, so a higher limit couldn't work there.
    max_upload_bytes: int = 4 * 1024 * 1024

    @field_validator("database_url")
    @classmethod
    def use_psycopg_driver(cls, v: str) -> str:
        # Hosted Postgres (Neon, Supabase, Heroku…) hands out `postgres://` / `postgresql://` URLs;
        # SQLAlchemy needs the driver named explicitly.
        for prefix in ("postgres://", "postgresql://"):
            if v.startswith(prefix):
                return "postgresql+psycopg://" + v[len(prefix) :]
        return v

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
