"""Application configuration, loaded from environment variables."""

import os
from datetime import timedelta

from dotenv import load_dotenv

load_dotenv()

BASE_DIR = os.path.abspath(os.path.dirname(__file__))


def _build_database_uri() -> str:
    """Prefer an explicit DATABASE_URL, else assemble one from the parts."""
    explicit = os.getenv("DATABASE_URL")
    if explicit:
        # SQLAlchemy 2.x needs a driver-qualified scheme for psycopg3.
        if explicit.startswith("postgres://"):
            explicit = explicit.replace("postgres://", "postgresql+psycopg://", 1)
        elif explicit.startswith("postgresql://"):
            explicit = explicit.replace("postgresql://", "postgresql+psycopg://", 1)
        return explicit

    user = os.getenv("POSTGRES_USER", "snapense_user")
    password = os.getenv("POSTGRES_PASSWORD", "snapense_pass")
    host = os.getenv("POSTGRES_HOST", "localhost")
    port = os.getenv("POSTGRES_PORT", "5432")
    name = os.getenv("POSTGRES_DB", "snapense_db")
    return f"postgresql+psycopg://{user}:{password}@{host}:{port}/{name}"


class Config:
    SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-change-me")

    SQLALCHEMY_DATABASE_URI = _build_database_uri()
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {"pool_pre_ping": True}

    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "dev-jwt-secret-change-me")
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(
        minutes=int(os.getenv("JWT_ACCESS_TOKEN_MINUTES", "60"))
    )
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(
        days=int(os.getenv("JWT_REFRESH_TOKEN_DAYS", "30"))
    )

    UPLOAD_FOLDER = os.getenv("UPLOAD_FOLDER", os.path.join(BASE_DIR, "uploads"))
    MAX_CONTENT_LENGTH = int(os.getenv("MAX_UPLOAD_MB", "10")) * 1024 * 1024
    ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "webp", "heic", "pdf"}

    # Receipts more than this many standard deviations above a user's category
    # average are flagged by the anomaly service.
    ANOMALY_ZSCORE_THRESHOLD = float(os.getenv("ANOMALY_ZSCORE_THRESHOLD", "2.5"))
    ANOMALY_MIN_HISTORY = int(os.getenv("ANOMALY_MIN_HISTORY", "5"))

    # Vision LLM used to read receipts. Swapping provider/model is env-only;
    # see services/ocr_service.py for the per-provider adapters.
    LLM_PROVIDER = os.getenv("LLM_PROVIDER", "gemini").strip().lower()
    LLM_MODEL = os.getenv("LLM_MODEL", "gemini-2.5-flash").strip()
    LLM_TIMEOUT_SECONDS = float(os.getenv("LLM_TIMEOUT_SECONDS", "60"))
    LLM_MAX_OUTPUT_TOKENS = int(os.getenv("LLM_MAX_OUTPUT_TOKENS", "2048"))
    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")


class DevelopmentConfig(Config):
    DEBUG = True


class TestingConfig(Config):
    TESTING = True
    SQLALCHEMY_DATABASE_URI = os.getenv("TEST_DATABASE_URL", "sqlite:///:memory:")


class ProductionConfig(Config):
    DEBUG = False


CONFIG_BY_NAME = {
    "development": DevelopmentConfig,
    "testing": TestingConfig,
    "production": ProductionConfig,
}


def get_config(name: str | None = None):
    name = name or os.getenv("FLASK_ENV", "development")
    return CONFIG_BY_NAME.get(name, DevelopmentConfig)
