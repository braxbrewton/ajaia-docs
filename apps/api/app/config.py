from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # SQLite by default so local setup needs zero infrastructure.
    # Production uses Postgres, e.g. postgresql+psycopg://user:pass@host/db
    database_url: str = "sqlite:///./ajaia.db"
    jwt_secret: str = "dev-secret-change-me"
    jwt_algorithm: str = "HS256"
    cookie_name: str = "ajaia_session"
    cookie_secure: bool = False
    session_hours: int = 24 * 7
    cors_origins: str = "http://localhost:3000"
    max_upload_bytes: int = 5 * 1024 * 1024

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
