"""Every SQL statement the app runs lives here."""
from __future__ import annotations

import sqlite3
from typing import Any

from .models import ExpenseIn, MonthPlanIn

_EXPENSE_COLS = "id, spent_on, category, amount, note, created_at"


def _rows(cur: sqlite3.Cursor) -> list[dict[str, Any]]:
    return [dict(row) for row in cur.fetchall()]


# ---------------------------------------------------------------- expenses


def list_expenses(conn: sqlite3.Connection, start: str, end: str) -> list[dict[str, Any]]:
    cur = conn.execute(
        f"SELECT {_EXPENSE_COLS} FROM expense "
        "WHERE spent_on BETWEEN ? AND ? "
        "ORDER BY spent_on DESC, id DESC",
        (start, end),
    )
    return _rows(cur)


def get_expense(conn: sqlite3.Connection, expense_id: int) -> dict[str, Any] | None:
    cur = conn.execute(f"SELECT {_EXPENSE_COLS} FROM expense WHERE id = ?", (expense_id,))
    row = cur.fetchone()
    return dict(row) if row else None


def create_expense(conn: sqlite3.Connection, payload: ExpenseIn) -> dict[str, Any]:
    cur = conn.execute(
        "INSERT INTO expense (spent_on, category, amount, note) VALUES (?, ?, ?, ?)",
        (payload.spent_on.isoformat(), payload.category, payload.amount, payload.note),
    )
    created = get_expense(conn, int(cur.lastrowid))
    assert created is not None
    return created


def update_expense(
    conn: sqlite3.Connection, expense_id: int, payload: ExpenseIn
) -> dict[str, Any] | None:
    conn.execute(
        "UPDATE expense SET spent_on = ?, category = ?, amount = ?, note = ? WHERE id = ?",
        (
            payload.spent_on.isoformat(),
            payload.category,
            payload.amount,
            payload.note,
            expense_id,
        ),
    )
    return get_expense(conn, expense_id)


def delete_expense(conn: sqlite3.Connection, expense_id: int) -> bool:
    cur = conn.execute("DELETE FROM expense WHERE id = ?", (expense_id,))
    return cur.rowcount > 0


# ------------------------------------------------------------- month plan


def get_plan(conn: sqlite3.Connection, month: str) -> dict[str, Any]:
    cur = conn.execute(
        "SELECT month, income, fixed_costs, savings_goal, reflection "
        "FROM month_plan WHERE month = ?",
        (month,),
    )
    row = cur.fetchone()
    if row:
        return dict(row)
    return {
        "month": month,
        "income": 0.0,
        "fixed_costs": 0.0,
        "savings_goal": 0.0,
        "reflection": "",
    }


def upsert_plan(conn: sqlite3.Connection, month: str, payload: MonthPlanIn) -> dict[str, Any]:
    conn.execute(
        """
        INSERT INTO month_plan (month, income, fixed_costs, savings_goal, reflection)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(month) DO UPDATE SET
            income       = excluded.income,
            fixed_costs  = excluded.fixed_costs,
            savings_goal = excluded.savings_goal,
            reflection   = excluded.reflection,
            updated_at   = datetime('now')
        """,
        (month, payload.income, payload.fixed_costs, payload.savings_goal, payload.reflection),
    )
    return get_plan(conn, month)


# ---------------------------------------------------------------- rollups


def month_category_totals(
    conn: sqlite3.Connection, month: str, through_day: int | None = None
) -> dict[str, dict[str, float]]:
    """Per-category totals for a month.

    ``through_day`` clips to the first N days so an in-progress month can be
    compared against the same stretch of the month before it.
    """
    sql = (
        "SELECT category, ROUND(SUM(amount), 2) AS total, COUNT(*) AS entries "
        "FROM expense WHERE substr(spent_on, 1, 7) = ?"
    )
    params: list[Any] = [month]
    if through_day is not None:
        sql += " AND CAST(substr(spent_on, 9, 2) AS INTEGER) <= ?"
        params.append(through_day)
    sql += " GROUP BY category"
    cur = conn.execute(sql, params)
    return {
        row["category"]: {"total": float(row["total"] or 0), "entries": int(row["entries"])}
        for row in cur.fetchall()
    }


def known_months(conn: sqlite3.Connection) -> list[str]:
    cur = conn.execute(
        """
        SELECT month FROM (
            SELECT DISTINCT substr(spent_on, 1, 7) AS month FROM expense
            UNION
            SELECT month FROM month_plan
        )
        ORDER BY month DESC
        """
    )
    return [row["month"] for row in cur.fetchall()]


def month_history(conn: sqlite3.Connection, limit: int = 12) -> list[dict[str, Any]]:
    """Recent months with spend + plan, newest first — powers the trend strip."""
    cur = conn.execute(
        """
        SELECT
            m.month                                        AS month,
            COALESCE(p.income, 0)                          AS income,
            COALESCE(p.fixed_costs, 0)                     AS fixed_costs,
            COALESCE(p.savings_goal, 0)                    AS savings_goal,
            COALESCE(ROUND(e.total, 2), 0)                 AS spent
        FROM (
            SELECT DISTINCT substr(spent_on, 1, 7) AS month FROM expense
            UNION
            SELECT month FROM month_plan
        ) AS m
        LEFT JOIN month_plan p ON p.month = m.month
        LEFT JOIN (
            SELECT substr(spent_on, 1, 7) AS month, SUM(amount) AS total
            FROM expense GROUP BY 1
        ) AS e ON e.month = m.month
        ORDER BY m.month DESC
        LIMIT ?
        """,
        (limit,),
    )
    return _rows(cur)


def repeat_notes(conn: sqlite3.Connection, month: str, min_count: int = 3) -> list[dict[str, Any]]:
    """Same note logged several times — kakeibo's classic 'small leak' finder."""
    cur = conn.execute(
        """
        SELECT
            LOWER(TRIM(note))      AS label,
            COUNT(*)               AS entries,
            ROUND(SUM(amount), 2)  AS total,
            category
        FROM expense
        WHERE substr(spent_on, 1, 7) = ? AND TRIM(note) <> ''
        GROUP BY LOWER(TRIM(note)), category
        HAVING COUNT(*) >= ?
        ORDER BY total DESC
        LIMIT 6
        """,
        (month, min_count),
    )
    return _rows(cur)
