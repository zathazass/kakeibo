"""Schema versioning.

`schema.sql` creates the tables if they are missing, which covers a fresh
database. It cannot alter an existing one — so any change to the shape of the
data goes here as a numbered migration, applied once and recorded in SQLite's
own `user_version`. That is the guarantee that upgrading the app never asks you
to delete a ledger you have been filling in for months.

To add one: append a tuple, using the next number. Never edit or renumber a
migration that has already shipped, and never add anything to `schema.sql` —
that file is frozen at version 1 because it runs before this does, on databases
that may be years old.
"""
from __future__ import annotations

import sqlite3

# Version 1 is the baseline that `schema.sql` produces. Migrations start at 2.
BASELINE_VERSION = 1

MIGRATIONS: list[tuple[int, list[str]]] = [
    # A finer label underneath the kakeibo bucket — "Groceries" inside Needs,
    # "Gadgets" inside Wants. Optional, free text, and the four buckets are
    # untouched: this is an extra axis, not a replacement.
    (
        2,
        [
            "ALTER TABLE expense ADD COLUMN tag TEXT NOT NULL DEFAULT ''",
            "CREATE INDEX IF NOT EXISTS idx_expense_tag ON expense (tag)",
        ],
    ),
    # Per-month allocations: how much of the spending money is meant for each
    # kakeibo bucket, and for each of your own labels. Optional — a month with
    # no rows here simply has no allocations.
    (
        3,
        [
            """
            CREATE TABLE IF NOT EXISTS budget (
                month  TEXT NOT NULL,
                scope  TEXT NOT NULL,
                key    TEXT NOT NULL,
                amount REAL NOT NULL DEFAULT 0,
                PRIMARY KEY (month, scope, key),
                CHECK (scope IN ('category', 'tag')),
                CHECK (amount >= 0),
                CHECK (month GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]')
            )
            """,
            "CREATE INDEX IF NOT EXISTS idx_budget_month ON budget (month)",
        ],
    ),
]


def current_version(conn: sqlite3.Connection) -> int:
    return int(conn.execute("PRAGMA user_version").fetchone()[0])


def migrate(conn: sqlite3.Connection) -> list[int]:
    """Bring a database up to date. Returns the versions actually applied."""
    version = current_version(conn)

    # A database that predates versioning but already holds the baseline tables
    # is at the baseline, not at zero.
    if version == 0:
        has_tables = conn.execute(
            "SELECT COUNT(*) FROM sqlite_master "
            "WHERE type = 'table' AND name IN ('expense', 'month_plan')"
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
