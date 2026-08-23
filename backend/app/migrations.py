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
    # Where the money came from. An account is a bank account or a card; every
    # expense may name one. Kakeibo still records a spend on the day you spend
    # it — a card charge belongs to the month you bought the thing, not the
    # month the bill is paid — so credit charges carry a settled_on stamp
    # instead, which is how the app knows what is still owed.
    (
        4,
        [
            """
            CREATE TABLE IF NOT EXISTS account (
                id           INTEGER PRIMARY KEY AUTOINCREMENT,
                name         TEXT NOT NULL UNIQUE,
                bank         TEXT NOT NULL DEFAULT '',
                kind         TEXT NOT NULL,
                credit_limit REAL NOT NULL DEFAULT 0,
                note         TEXT NOT NULL DEFAULT '',
                archived     INTEGER NOT NULL DEFAULT 0,
                created_at   TEXT NOT NULL DEFAULT (datetime('now')),
                CHECK (kind IN ('savings', 'spending', 'salary', 'credit')),
                CHECK (credit_limit >= 0)
            )
            """,
            "ALTER TABLE expense ADD COLUMN account_id INTEGER REFERENCES account(id)",
            "ALTER TABLE expense ADD COLUMN settled_on TEXT NOT NULL DEFAULT ''",
            "CREATE INDEX IF NOT EXISTS idx_expense_account ON expense (account_id)",
        ],
    ),
    # Money moving between your own accounts: salary landing, cash swept into
    # savings, a SIP going out. None of this is spending — it never leaves your
    # hands — so it stays out of the four buckets and out of every spending
    # total. It is tracked here so account balances are real.
    (
        5,
        [
            "ALTER TABLE account ADD COLUMN opening_balance REAL NOT NULL DEFAULT 0",
            "ALTER TABLE month_plan ADD COLUMN income_account_id INTEGER REFERENCES account(id)",
            """
            CREATE TABLE IF NOT EXISTS transfer (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                moved_on        TEXT NOT NULL,
                from_account_id INTEGER REFERENCES account(id),
                to_account_id   INTEGER REFERENCES account(id),
                amount          REAL NOT NULL,
                kind            TEXT NOT NULL DEFAULT 'transfer',
                note            TEXT NOT NULL DEFAULT '',
                created_at      TEXT NOT NULL DEFAULT (datetime('now')),
                CHECK (amount > 0),
                CHECK (kind IN ('transfer', 'sip')),
                CHECK (moved_on GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]')
            )
            """,
            "CREATE INDEX IF NOT EXISTS idx_transfer_month ON transfer (substr(moved_on, 1, 7))",
            "CREATE INDEX IF NOT EXISTS idx_transfer_from ON transfer (from_account_id)",
            "CREATE INDEX IF NOT EXISTS idx_transfer_to ON transfer (to_account_id)",
        ],
    ),
    # Prepaid things: a 90-day recharge, an annual subscription. The cash goes
    # out once, but the cost belongs to every month it covers. The entry still
    # records the real payment on the real day — this only says how many months
    # that payment buys, so the app can also show the monthly equivalent.
    (
        6,
        [
            "ALTER TABLE expense ADD COLUMN spread_months INTEGER NOT NULL DEFAULT 1",
            "CREATE INDEX IF NOT EXISTS idx_expense_spread ON expense (spread_months)",
        ],
    ),
    # Earned moments. Recorded once, so an achievement celebrates the first
    # time only and cannot be farmed by reloading the page.
    (
        7,
        [
            """
            CREATE TABLE IF NOT EXISTS achievement (
                key       TEXT PRIMARY KEY,
                earned_on TEXT NOT NULL,
                month     TEXT NOT NULL DEFAULT '',
                detail    TEXT NOT NULL DEFAULT '',
                seen      INTEGER NOT NULL DEFAULT 0
            )
            """,
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
