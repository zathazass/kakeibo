"""Every SQL statement the app runs lives here."""
from __future__ import annotations

import sqlite3
from typing import Any

from .models import ExpenseIn, MonthPlanIn

_EXPENSE_COLS = (
    "id, spent_on, category, amount, note, tag, account_id, settled_on, created_at"
)


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
        "INSERT INTO expense (spent_on, category, amount, note, tag, account_id) "
        "VALUES (?, ?, ?, ?, ?, ?)",
        (
            payload.spent_on.isoformat(),
            payload.category,
            payload.amount,
            payload.note,
            payload.tag,
            payload.account_id,
        ),
    )
    created = get_expense(conn, int(cur.lastrowid))
    assert created is not None
    return created


def update_expense(
    conn: sqlite3.Connection, expense_id: int, payload: ExpenseIn
) -> dict[str, Any] | None:
    conn.execute(
        "UPDATE expense SET spent_on = ?, category = ?, amount = ?, note = ?, tag = ?, "
        "account_id = ? WHERE id = ?",
        (
            payload.spent_on.isoformat(),
            payload.category,
            payload.amount,
            payload.note,
            payload.tag,
            payload.account_id,
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


def lifetime_totals(conn: sqlite3.Connection) -> dict[str, Any]:
    """Everything ever logged, for the collective view."""
    row = conn.execute(
        """
        SELECT
            ROUND(COALESCE(SUM(amount), 0), 2)          AS spent,
            COUNT(*)                                    AS entries,
            COUNT(DISTINCT substr(spent_on, 1, 7))      AS months,
            COUNT(DISTINCT spent_on)                    AS active_days,
            MIN(spent_on)                               AS first_day,
            MAX(spent_on)                               AS last_day
        FROM expense
        """
    ).fetchone()
    return dict(row)


def lifetime_category_totals(
    conn: sqlite3.Connection, exclude_month: str | None = None
) -> dict[str, dict[str, float]]:
    """Per-category totals across every month.

    ``exclude_month`` drops the month in progress, so a half-finished month
    cannot drag down the averages it is then compared against.
    """
    sql = "SELECT category, ROUND(SUM(amount), 2) AS total, COUNT(*) AS entries FROM expense"
    params: list[Any] = []
    if exclude_month:
        sql += " WHERE substr(spent_on, 1, 7) <> ?"
        params.append(exclude_month)
    sql += " GROUP BY category"
    cur = conn.execute(sql, params)
    return {
        row["category"]: {"total": float(row["total"] or 0), "entries": int(row["entries"])}
        for row in cur.fetchall()
    }


def recurring_habits(conn: sqlite3.Connection, min_months: int = 2) -> list[dict[str, Any]]:
    """Notes that keep coming back month after month — the trimmable habits."""
    cur = conn.execute(
        """
        SELECT
            LOWER(TRIM(note))                       AS label,
            category,
            COUNT(*)                                AS entries,
            COUNT(DISTINCT substr(spent_on, 1, 7))  AS months,
            ROUND(SUM(amount), 2)                   AS total
        FROM expense
        WHERE TRIM(note) <> ''
        GROUP BY LOWER(TRIM(note)), category
        HAVING COUNT(DISTINCT substr(spent_on, 1, 7)) >= ? AND COUNT(*) >= 4
        ORDER BY total DESC
        LIMIT 5
        """,
        (min_months,),
    )
    return _rows(cur)


# ------------------------------------------------- cross-period aggregation


def monthly_category_matrix(conn: sqlite3.Connection) -> list[dict[str, Any]]:
    cur = conn.execute(
        """
        SELECT substr(spent_on, 1, 7) AS month, category,
               ROUND(SUM(amount), 2) AS total, COUNT(*) AS entries
        FROM expense GROUP BY 1, 2 ORDER BY 1
        """
    )
    return _rows(cur)


def monthly_tag_matrix(conn: sqlite3.Connection) -> list[dict[str, Any]]:
    cur = conn.execute(
        """
        SELECT substr(spent_on, 1, 7) AS month, TRIM(tag) AS tag, category,
               ROUND(SUM(amount), 2) AS total, COUNT(*) AS entries
        FROM expense GROUP BY 1, 2, 3 ORDER BY 1
        """
    )
    return _rows(cur)


def all_plans(conn: sqlite3.Connection) -> list[dict[str, Any]]:
    cur = conn.execute(
        "SELECT month, income, fixed_costs, savings_goal FROM month_plan ORDER BY month"
    )
    return _rows(cur)


def biggest_expenses(conn: sqlite3.Connection, limit: int = 10) -> list[dict[str, Any]]:
    cur = conn.execute(
        f"SELECT {_EXPENSE_COLS} FROM expense ORDER BY amount DESC, spent_on DESC LIMIT ?",
        (limit,),
    )
    return _rows(cur)


def known_tags(conn: sqlite3.Connection) -> list[dict[str, Any]]:
    """Tags already in use, so the entry form can offer them back."""
    cur = conn.execute(
        """
        SELECT TRIM(tag) AS tag, category, COUNT(*) AS entries,
               ROUND(SUM(amount), 2) AS total
        FROM expense WHERE TRIM(tag) <> ''
        GROUP BY TRIM(tag), category ORDER BY entries DESC, total DESC
        """
    )
    return _rows(cur)


# ------------------------------------------------------------ budget limits


def get_budgets(conn: sqlite3.Connection, month: str) -> list[dict[str, Any]]:
    cur = conn.execute(
        "SELECT scope, key, amount FROM budget WHERE month = ? ORDER BY scope, key",
        (month,),
    )
    return _rows(cur)


def set_budgets(
    conn: sqlite3.Connection, month: str, rows: list[tuple[str, str, float]]
) -> None:
    """Replace the whole set for a month. A zero or missing row means no limit."""
    conn.execute("DELETE FROM budget WHERE month = ?", (month,))
    keepers = [(month, scope, key, amount) for scope, key, amount in rows if amount > 0]
    if keepers:
        conn.executemany(
            "INSERT INTO budget (month, scope, key, amount) VALUES (?, ?, ?, ?)",
            keepers,
        )


def month_tag_totals(conn: sqlite3.Connection, month: str) -> dict[str, dict[str, Any]]:
    cur = conn.execute(
        """
        SELECT TRIM(tag) AS tag, category,
               ROUND(SUM(amount), 2) AS total, COUNT(*) AS entries
        FROM expense
        WHERE substr(spent_on, 1, 7) = ? AND TRIM(tag) <> ''
        GROUP BY TRIM(tag), category
        """,
        (month,),
    )
    return {
        row["tag"]: {
            "total": float(row["total"] or 0),
            "entries": int(row["entries"]),
            "category": row["category"],
        }
        for row in cur.fetchall()
    }


def tag_month_averages(
    conn: sqlite3.Connection, exclude_month: str | None = None
) -> dict[str, dict[str, Any]]:
    """Average spend per month for each label, for suggesting allocations."""
    sql = """
        SELECT TRIM(tag) AS tag, category,
               ROUND(SUM(amount), 2) AS total,
               COUNT(DISTINCT substr(spent_on, 1, 7)) AS months
        FROM expense
        WHERE TRIM(tag) <> ''
    """
    params: list[Any] = []
    if exclude_month:
        sql += " AND substr(spent_on, 1, 7) <> ?"
        params.append(exclude_month)
    sql += " GROUP BY TRIM(tag), category"
    cur = conn.execute(sql, params)
    return {
        row["tag"]: {
            "avg": round(float(row["total"] or 0) / max(1, int(row["months"])), 2),
            "category": row["category"],
        }
        for row in cur.fetchall()
    }


# ----------------------------------------------------------------- accounts

_ACCOUNT_COLS = "id, name, bank, kind, credit_limit, note, archived"


def list_accounts(conn: sqlite3.Connection, include_archived: bool = False) -> list[dict[str, Any]]:
    sql = f"SELECT {_ACCOUNT_COLS} FROM account"
    if not include_archived:
        sql += " WHERE archived = 0"
    sql += " ORDER BY archived, kind, name"
    return _rows(conn.execute(sql))


def get_account(conn: sqlite3.Connection, account_id: int) -> dict[str, Any] | None:
    row = conn.execute(
        f"SELECT {_ACCOUNT_COLS} FROM account WHERE id = ?", (account_id,)
    ).fetchone()
    return dict(row) if row else None


def create_account(conn: sqlite3.Connection, payload: Any) -> dict[str, Any]:
    cur = conn.execute(
        "INSERT INTO account (name, bank, kind, credit_limit, note) VALUES (?, ?, ?, ?, ?)",
        (payload.name, payload.bank, payload.kind, payload.credit_limit, payload.note),
    )
    created = get_account(conn, int(cur.lastrowid))
    assert created is not None
    return created


def update_account(
    conn: sqlite3.Connection, account_id: int, payload: Any
) -> dict[str, Any] | None:
    conn.execute(
        "UPDATE account SET name = ?, bank = ?, kind = ?, credit_limit = ?, note = ?, "
        "archived = ? WHERE id = ?",
        (
            payload.name,
            payload.bank,
            payload.kind,
            payload.credit_limit,
            payload.note,
            1 if payload.archived else 0,
            account_id,
        ),
    )
    return get_account(conn, account_id)


def delete_account(conn: sqlite3.Connection, account_id: int) -> bool:
    """Detach the account from its entries rather than deleting them."""
    conn.execute("UPDATE expense SET account_id = NULL WHERE account_id = ?", (account_id,))
    cur = conn.execute("DELETE FROM account WHERE id = ?", (account_id,))
    return cur.rowcount > 0


def account_month_spend(conn: sqlite3.Connection, month: str) -> dict[int, dict[str, Any]]:
    cur = conn.execute(
        """
        SELECT account_id, ROUND(SUM(amount), 2) AS total, COUNT(*) AS entries
        FROM expense
        WHERE substr(spent_on, 1, 7) = ? AND account_id IS NOT NULL
        GROUP BY account_id
        """,
        (month,),
    )
    return {
        int(row["account_id"]): {"total": float(row["total"] or 0), "entries": int(row["entries"])}
        for row in cur.fetchall()
    }


def credit_outstanding(conn: sqlite3.Connection) -> dict[int, dict[str, Any]]:
    """Charges on a card that have not been settled yet — what you still owe."""
    cur = conn.execute(
        """
        SELECT e.account_id,
               ROUND(SUM(e.amount), 2) AS total,
               COUNT(*)                AS entries,
               MIN(e.spent_on)         AS oldest
        FROM expense e
        JOIN account a ON a.id = e.account_id
        WHERE a.kind = 'credit' AND TRIM(e.settled_on) = ''
        GROUP BY e.account_id
        """
    )
    return {
        int(row["account_id"]): {
            "total": float(row["total"] or 0),
            "entries": int(row["entries"]),
            "oldest": row["oldest"],
        }
        for row in cur.fetchall()
    }


def unsettled_charges(conn: sqlite3.Connection, account_id: int) -> list[dict[str, Any]]:
    return _rows(
        conn.execute(
            f"SELECT {_EXPENSE_COLS} FROM expense "
            "WHERE account_id = ? AND TRIM(settled_on) = '' ORDER BY spent_on",
            (account_id,),
        )
    )


def settle_charges(
    conn: sqlite3.Connection, account_id: int, up_to: str, paid_on: str
) -> int:
    """Mark card charges as paid. This is not a new expense — the spending was
    already recorded on the day it happened; this only clears the debt."""
    cur = conn.execute(
        "UPDATE expense SET settled_on = ? "
        "WHERE account_id = ? AND TRIM(settled_on) = '' AND spent_on <= ?",
        (paid_on, account_id, up_to),
    )
    return cur.rowcount
