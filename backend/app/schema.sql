-- Kakeibo ledger. Two tables: the monthly plan, and the expenses themselves.
--
-- FROZEN AT VERSION 1. Do not add columns here — this file runs before
-- migrations, on databases that may be years old, so anything it references
-- must exist in every database that ever shipped. Every change since v1 lives
-- in migrations.py, which runs straight afterwards and is the only path that
-- both a brand-new and a long-running database take.

CREATE TABLE IF NOT EXISTS month_plan (
    month        TEXT PRIMARY KEY,
    income       REAL NOT NULL DEFAULT 0,
    fixed_costs  REAL NOT NULL DEFAULT 0,
    savings_goal REAL NOT NULL DEFAULT 0,
    reflection   TEXT NOT NULL DEFAULT '',
    created_at   TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at   TEXT NOT NULL DEFAULT (datetime('now')),
    CHECK (month GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]'),
    CHECK (income >= 0 AND fixed_costs >= 0 AND savings_goal >= 0)
);

CREATE TABLE IF NOT EXISTS expense (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    spent_on   TEXT NOT NULL,
    category   TEXT NOT NULL,
    amount     REAL NOT NULL,
    note       TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    CHECK (spent_on GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
    CHECK (category IN ('needs', 'wants', 'culture', 'unexpected')),
    CHECK (amount > 0)
);

CREATE INDEX IF NOT EXISTS idx_expense_spent_on ON expense (spent_on);
CREATE INDEX IF NOT EXISTS idx_expense_month    ON expense (substr(spent_on, 1, 7));
CREATE INDEX IF NOT EXISTS idx_expense_category ON expense (category, spent_on);
