"""SQLite access.

One connection per request: SQLite connections are not safe to share across the
threads FastAPI runs sync endpoints on, and opening a local file db is cheap.
"""
from __future__ import annotations

import os
import sqlite3
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path

from . import migrations
from .config import DB_PATH

SCHEMA_PATH = Path(__file__).resolve().parent / "schema.sql"


def connect() -> sqlite3.Connection:
    try:
        DB_PATH.parent.mkdir(parents=True, exist_ok=True)
        conn = sqlite3.connect(DB_PATH, timeout=10.0)
        conn.execute("SELECT 1")
    except (sqlite3.OperationalError, OSError) as exc:
        # Almost always a permissions problem: Docker created the folder as
        # root, so the unprivileged app cannot write its database into it.
        raise RuntimeError(
            f"Cannot open the ledger at {DB_PATH}. The folder "
            f"{DB_PATH.parent} must exist and be writable by the app "
            f"(uid {os.getuid()}). If Docker created it as root, run: "
            f"sudo chown -R $(id -u):$(id -g) data"
        ) from exc
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    conn.execute("PRAGMA synchronous = NORMAL")
    return conn


def init_db() -> list[int]:
    """Create tables if missing, then apply any pending migrations.

    Both halves are idempotent, so this runs on every boot and never touches
    data that is already there.
    """
    conn = connect()
    try:
        conn.executescript(SCHEMA_PATH.read_text(encoding="utf-8"))
        conn.commit()
        return migrations.migrate(conn)
    finally:
        conn.close()


@contextmanager
def session() -> Iterator[sqlite3.Connection]:
    conn = connect()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def get_db() -> Iterator[sqlite3.Connection]:
    """FastAPI dependency."""
    with session() as conn:
        yield conn
