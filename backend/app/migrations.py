"""Schema versioning.

`schema.sql` creates the tables if they are missing, which covers a fresh
database. It cannot alter an existing one — so any change to the shape of the
data goes here as a numbered migration, applied once and recorded in SQLite's
own `user_version`. That is the guarantee that upgrading the app never asks you
to delete a ledger you have been filling in for months.

To add one: append a tuple, using the next number. Never edit or renumber a
migration that has already shipped.

    MIGRATIONS = [
        (2, ["ALTER TABLE expense ADD COLUMN payment_method TEXT NOT NULL DEFAULT ''"]),
    ]
"""
from __future__ import annotations

import sqlite3

# Version 1 is the baseline that `schema.sql` produces. Migrations start at 2.
BASELINE_VERSION = 1

MIGRATIONS: list[tuple[int, list[str]]] = []


def current_version(conn: sqlite3.Connection) -> int:
    return int(conn.execute("PRAGMA user_version").fetchone()[0])


def migrate(conn: sqlite3.Connection) -> list[int]:
    """Bring a database up to date. Returns the versions actually applied."""
    version = current_version(conn)

    # A database that predates versioning but already holds the baseline tables
    # is at the baseline, not at zero.
    if version == 0:
        has_tables = conn.execute(
            "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name IN ('expense', 'month_plan')"
        ).fetchone()[0]
        version = BASELINE_VERSION if has_tables else 0
        conn.execute(f"PRAGMA user_version = {version}")

    applied: list[int] = []
    for target, statements in sorted(MIGRATIONS):
        if target <= version:
            continue
        for statement in statements:
            conn.execute(statement)
        conn.execute(f"PRAGMA user_version = {target}")
        applied.append(target)
        version = target

    conn.commit()
    return applied
