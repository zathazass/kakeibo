"""Runtime configuration. Everything has a working default so the app runs with no setup."""
from __future__ import annotations

import os
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
PROJECT_DIR = BACKEND_DIR.parent


def _path(env_key: str, default: Path) -> Path:
    raw = os.getenv(env_key)
    return (BACKEND_DIR / raw).resolve() if raw else default


DB_PATH: Path = _path("KAKEIBO_DB", BACKEND_DIR / "kakeibo.db")
FRONTEND_DIST: Path = _path("KAKEIBO_FRONTEND_DIST", PROJECT_DIR / "frontend" / "build" / "client")

CURRENCY: str = os.getenv("KAKEIBO_CURRENCY", "₹")
LOCALE: str = os.getenv("KAKEIBO_LOCALE", "en-IN")

CORS_ORIGINS: list[str] = [
    origin.strip()
    for origin in os.getenv(
        "KAKEIBO_CORS_ORIGINS",
        "http://localhost:8004,http://127.0.0.1:8004",
    ).split(",")
    if origin.strip()
]
