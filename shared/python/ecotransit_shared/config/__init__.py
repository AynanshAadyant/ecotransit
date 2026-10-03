"""Settings classes loaded and validated from environment variables."""

from __future__ import annotations

from urllib.parse import quote_plus

from dotenv import find_dotenv, load_dotenv
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

_dotenv_path = find_dotenv()
if _dotenv_path:
    load_dotenv(_dotenv_path, override=False)


class DatabaseSettings(BaseSettings):
    """PostgreSQL database configuration."""

    model_config = SettingsConfigDict(
        env_file=_dotenv_path or ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    postgres_host: str = Field(default="localhost", alias="POSTGRES_HOST")
    postgres_port: int = Field(default=5432, alias="POSTGRES_PORT")
    postgres_user: str = Field(default="postgres", alias="POSTGRES_USER")
    postgres_password: str = Field(default="", alias="POSTGRES_PASSWORD")
    database_name: str = Field(default="ecotransit", alias="DATABASE_NAME")

    @property
    def dsn(self) -> str:
        user = quote_plus(self.postgres_user)
        pwd = quote_plus(self.postgres_password)
        return f"postgresql://{user}:{pwd}@{self.postgres_host}:{self.postgres_port}/{self.database_name}"


class RedisSettings(BaseSettings):
    """Redis cache and live position configuration."""

    model_config = SettingsConfigDict(
        env_file=_dotenv_path or ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    redis_host: str = Field(default="localhost", alias="REDIS_HOST")
    redis_port: int = Field(default=6379, alias="REDIS_PORT")
    redis_password: str | None = Field(default=None, alias="REDIS_PASSWORD")

    @property
    def url(self) -> str:
        if self.redis_password:
            pwd = quote_plus(self.redis_password)
            return f"redis://:{pwd}@{self.redis_host}:{self.redis_port}"
        return f"redis://{self.redis_host}:{self.redis_port}"


class CommonSettings(BaseSettings):
    """Common application configuration."""

    model_config = SettingsConfigDict(
        env_file=_dotenv_path or ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_env: str = Field(default="development", alias="STATUS")
    timezone: str = "Asia/Kolkata"
    log_level: str = "INFO"
