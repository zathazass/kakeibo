"""Earned moments.

Two rules shape every one of these.

They reward the *habit*, never simply spending less. A badge for a small month
would quietly encourage leaving entries out, which would ruin the only thing
this app depends on — an honest ledger. So these celebrate turning up: logging,
labelling, closing the month, keeping a promise you made to yourself.

And they are earned once. The row is written the first time the condition is
true, so reloading the page cannot farm them, and the celebration you see is
always genuinely new.
"""
from __future__ import annotations

import sqlite3
from datetime import date, timedelta
from typing import Any, Callable

from . import repository as repo

Check = Callable[[dict[str, Any]], bool]


def _detail(stats: dict[str, Any], key: str, default: str = "") -> str:
    return str(stats.get(key, default))


# tier drives how loud the celebration is on screen
CATALOGUE: list[dict[str, Any]] = [
    {
        "key": "first_entry", "title": "The first line", "tier": "bronze", "icon": "pencil",
        "hint": "Write your first entry",
        "flavour": "Every ledger starts with one line. Yours is written.",
        "check": lambda s: s["entries"] >= 1,
    },
    {
        "key": "entries_25", "title": "Twenty-five in", "tier": "bronze", "icon": "pencil",
        "hint": "Log 25 entries",
        "flavour": "Twenty-five conscious moments. The habit is forming.",
        "check": lambda s: s["entries"] >= 25,
    },
    {
        "key": "entries_100", "title": "A hundred entries", "tier": "gold", "icon": "star",
        "hint": "Log 100 entries",
        "flavour": "A hundred times you stopped and wrote it down. That is the whole method.",
        "check": lambda s: s["entries"] >= 100,
    },
    {
        "key": "days_7", "title": "A week of turning up", "tier": "bronze", "icon": "calendar",
        "hint": "Log on 7 different days",
        "flavour": "Seven separate days you came back to it.",
        "check": lambda s: s["active_days"] >= 7,
    },
    {
        "key": "streak_5", "title": "Five days running", "tier": "silver", "icon": "trend",
        "hint": "Log something five days in a row",
        "flavour": "Five days unbroken. Momentum looks like this.",
        "check": lambda s: s["streak"] >= 5,
    },
    {
        "key": "streak_14", "title": "A fortnight unbroken", "tier": "gold", "icon": "trend",
        "hint": "Log something fourteen days in a row",
        "flavour": "Two solid weeks. This is no longer an experiment.",
        "check": lambda s: s["streak"] >= 14,
    },
    {
        "key": "planner", "title": "Savings first", "tier": "bronze", "icon": "wallet",
        "hint": "Set up a month with a savings goal",
        "flavour": "Income, fixed costs, savings — decided before a rupee was spent.",
        "check": lambda s: s["has_plan"] and s["savings_goal"] > 0,
    },
    {
        "key": "goal_kept", "title": "You kept the promise", "tier": "gold", "icon": "target",
        "hint": "Actually move your savings goal across",
        "flavour": "Not planned. Moved. The money is genuinely aside.",
        "check": lambda s: s["put_aside"] > 0 and s["put_aside"] >= s["savings_goal"] > 0,
    },
    {
        "key": "under_budget", "title": "Inside the lines", "tier": "silver", "icon": "check",
        "hint": "Finish a month inside its budget",
        "flavour": "A whole month closed without crossing the line.",
        "check": lambda s: s["months_under_budget"] >= 1,
    },
    {
        "key": "under_budget_3", "title": "Three in a row", "tier": "gold", "icon": "star",
        "hint": "Finish three months inside budget",
        "flavour": "Three consecutive months held. That is not luck any more.",
        "check": lambda s: s["under_budget_streak"] >= 3,
    },
    {
        "key": "quiet_10", "title": "Ten quiet days", "tier": "silver", "icon": "check",
        "hint": "Have ten no-spend days in one month",
        "flavour": "Ten days that cost nothing at all.",
        "check": lambda s: s["quiet_days"] >= 10,
    },
    {
        "key": "reflected", "title": "The fourth question", "tier": "silver", "icon": "quote",
        "hint": "Write your own reflection on a month",
        "flavour": "The one question the app cannot answer for you — answered.",
        "check": lambda s: s["reflections"] >= 1,
    },
    {
        "key": "culture", "title": "Something to keep", "tier": "bronze", "icon": "layers",
        "hint": "Spend on Culture — books, learning, music",
        "flavour": "The one bucket kakeibo never asks you to shrink.",
        "check": lambda s: s["culture_total"] > 0,
    },
    {
        "key": "labelled", "title": "Everything named", "tier": "silver", "icon": "table",
        "hint": "Label every entry in a month with at least 10 entries",
        "flavour": "Every rupee accounted for by name, not just by bucket.",
        "check": lambda s: s["month_entries"] >= 10 and s["untagged_this_month"] == 0,
    },
    {
        "key": "invested", "title": "Paid yourself", "tier": "gold", "icon": "target",
        "hint": "Record your first investment",
        "flavour": "Money moved out of reach on purpose. The best kind of spending that isn't spending.",
        "check": lambda s: s["sip_count"] >= 1,
    },
    {
        "key": "card_clear", "title": "Nothing owed", "tier": "silver", "icon": "coins",
        "hint": "Clear a credit card with charges on it",
        "flavour": "Settled in full. The card owes you nothing and you owe it nothing.",
        "check": lambda s: s["cards_with_history"] >= 1 and s["credit_outstanding"] == 0,
    },
    {
        "key": "low_utilisation", "title": "Light touch", "tier": "bronze", "icon": "check",
        "hint": "Keep credit use under 30% with a real balance on the card",
        "flavour": "Using the card without leaning on it.",
        "check": lambda s: 0 < s["credit_utilisation"] < 30,
    },
    {
        "key": "three_months", "title": "A season tracked", "tier": "gold", "icon": "calendar",
        "hint": "Keep the ledger for three separate months",
        "flavour": "Three months of honest record. Now the comparisons mean something.",
        "check": lambda s: s["months_tracked"] >= 3,
    },
]

BY_KEY = {a["key"]: a for a in CATALOGUE}


def gather_stats(conn: sqlite3.Connection, month: str, today: date) -> dict[str, Any]:
    """Everything the checks need, in one pass."""
    life = repo.lifetime_totals(conn)
    entries = int(life["entries"] or 0)

    days = [
        row[0]
        for row in conn.execute("SELECT DISTINCT spent_on FROM expense ORDER BY spent_on DESC")
    ]
    streak = 0
    if days:
        cursor = date.fromisoformat(days[0])
        # A streak may end today or yesterday — logging is allowed to lag a day.
        if (today - cursor).days <= 1:
            known = set(days)
            while cursor.isoformat() in known:
                streak += 1
                cursor -= timedelta(days=1)

    plan = repo.get_plan(conn, month)
    month_rows = repo.list_expenses(conn, f"{month}-01", f"{month}-31")
    untagged = sum(1 for row in month_rows if not (row["tag"] or "").strip())

    sip = repo.month_sip_total(conn, month)
    sip_all = conn.execute("SELECT COUNT(*) FROM transfer WHERE kind = 'sip'").fetchone()[0]

    accounts = repo.list_accounts(conn, include_archived=True)
    owed = repo.credit_outstanding(conn)
    cards = [a for a in accounts if a["kind"] == "credit"]
    ever_charged = conn.execute(
        "SELECT COUNT(DISTINCT account_id) FROM expense e "
        "JOIN account a ON a.id = e.account_id WHERE a.kind = 'credit'"
    ).fetchone()[0]
    limit_total = sum(c["credit_limit"] for c in cards)
    owed_total = sum(v["total"] for v in owed.values())

    savings_ids = {a["id"] for a in accounts if a["kind"] == "savings"}
    moved = repo.transfer_movement(conn, month)
    into_savings = sum(moved.get(acct, {"in": 0.0})["in"] for acct in savings_ids)

    # Finished months only — an in-progress month has not been held yet.
    history = conn.execute(
        """
        SELECT p.month, p.income - p.fixed_costs - p.savings_goal AS available,
               COALESCE(e.total, 0) AS spent
        FROM month_plan p
        LEFT JOIN (SELECT substr(spent_on,1,7) m, SUM(amount) total FROM expense GROUP BY 1) e
               ON e.m = p.month
        WHERE p.month < ? AND p.income > 0
        ORDER BY p.month
        """,
        (month,),
    ).fetchall()
    under = [row for row in history if row["available"] > 0 and row["spent"] <= row["available"]]
    streak_under = 0
    for row in reversed(history):
        if row["available"] > 0 and row["spent"] <= row["available"]:
            streak_under += 1
        else:
            break

    quiet = 0
    if month_rows or plan["income"]:
        spent_days = {row["spent_on"] for row in month_rows}
        elapsed = today.day if month == f"{today.year:04d}-{today.month:02d}" else 31
        quiet = sum(
            1
            for day in range(1, elapsed + 1)
            if f"{month}-{day:02d}" not in spent_days
        )

    return {
        "entries": entries,
        "active_days": int(life["active_days"] or 0),
        "months_tracked": int(life["months"] or 0),
        "streak": streak,
        "has_plan": plan["income"] > 0,
        "savings_goal": plan["savings_goal"],
        "put_aside": into_savings + sip["sip"],
        "months_under_budget": len(under),
        "under_budget_streak": streak_under,
        "quiet_days": quiet,
        "reflections": conn.execute(
            "SELECT COUNT(*) FROM month_plan WHERE TRIM(reflection) <> ''"
        ).fetchone()[0],
        "culture_total": conn.execute(
            "SELECT COALESCE(SUM(amount), 0) FROM expense WHERE category = 'culture'"
        ).fetchone()[0],
        "month_entries": len(month_rows),
        "untagged_this_month": untagged,
        "sip_count": sip_all,
        "cards_with_history": ever_charged,
        "credit_outstanding": round(owed_total, 2),
        "credit_utilisation": (owed_total / limit_total * 100) if limit_total else 0.0,
    }


def evaluate(conn: sqlite3.Connection, month: str, today: date) -> dict[str, Any]:
    """Award anything newly true, and report what is still locked."""
    stats = gather_stats(conn, month, today)
    already = {
        row["key"]: dict(row)
        for row in conn.execute("SELECT key, earned_on, month, detail, seen FROM achievement")
    }

    fresh: list[dict[str, Any]] = []
    for item in CATALOGUE:
        if item["key"] in already:
            continue
        try:
            won = bool(item["check"](stats))
        except Exception:
            won = False
        if won:
            conn.execute(
                "INSERT OR IGNORE INTO achievement (key, earned_on, month) VALUES (?, ?, ?)",
                (item["key"], today.isoformat(), month),
            )
            already[item["key"]] = {
                "key": item["key"], "earned_on": today.isoformat(),
                "month": month, "detail": "", "seen": 0,
            }
            fresh.append(item)
    if fresh:
        conn.commit()

    earned = []
    locked = []
    for item in CATALOGUE:
        record = already.get(item["key"])
        shape = {
            "key": item["key"],
            "title": item["title"],
            "tier": item["tier"],
            "icon": item["icon"],
            "hint": item["hint"],
            "flavour": item["flavour"],
        }
        if record:
            earned.append({**shape, "earned_on": record["earned_on"], "month": record["month"]})
        else:
            locked.append(shape)

    return {
        # Only unseen ones celebrate, so a reload never replays a party.
        "unlocked": [
            {**BY_KEY[key], "check": None}
            for key in (a["key"] for a in fresh)
        ],
        "earned": earned,
        "locked": locked,
        "total": len(CATALOGUE),
        "earned_count": len(earned),
        "stats": stats,
    }

