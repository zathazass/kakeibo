"""Bank accounts and cards.

Kakeibo records a spend on the day you spend it. A card charge therefore
belongs to the month you bought the thing, not the month the bill is paid —
otherwise a month's picture would depend on your billing cycle rather than on
your behaviour.

Paying the bill is not a new expense. It settles charges already recorded, so
the app tracks what is still owed instead, and settling only clears that debt.
"""
from __future__ import annotations

import sqlite3
from typing import Any

from . import repository as repo
from .analytics import money, pct
from .models import ACCOUNT_KINDS

# Utilisation above this is the level credit scoring tends to notice.
UTILISATION_FLAG = 30.0


def build_accounts(conn: sqlite3.Connection, month: str) -> dict[str, Any]:
    rows = repo.list_accounts(conn, include_archived=True)
    spend = repo.account_month_spend(conn, month)
    owed = repo.credit_outstanding(conn)

    accounts: list[dict[str, Any]] = []
    for row in rows:
        this_month = spend.get(row["id"], {})
        entry: dict[str, Any] = {
            **row,
            "kind_label": ACCOUNT_KINDS[row["kind"]]["label"],
            "kind_hint": ACCOUNT_KINDS[row["kind"]]["hint"],
            "credit_limit": money(row["credit_limit"]),
            "spent_this_month": money(this_month.get("total", 0.0)),
            "entries_this_month": int(this_month.get("entries", 0)),
        }
        if row["kind"] == "credit":
            debt = owed.get(row["id"], {})
            outstanding = money(debt.get("total", 0.0))
            limit = entry["credit_limit"]
            entry.update(
                {
                    "outstanding": outstanding,
                    "unsettled_entries": int(debt.get("entries", 0)),
                    "oldest_unsettled": debt.get("oldest"),
                    "available": money(limit - outstanding) if limit > 0 else 0.0,
                    "utilisation": pct(outstanding, limit) if limit > 0 else 0.0,
                    "utilisation_high": limit > 0
                    and pct(outstanding, limit) > UTILISATION_FLAG,
                }
            )
        accounts.append(entry)

    live = [a for a in accounts if not a["archived"]]
    cards = [a for a in live if a["kind"] == "credit"]
    limit_total = money(sum(c["credit_limit"] for c in cards))
    owed_total = money(sum(c["outstanding"] for c in cards))

    assigned = money(sum(a["spent_this_month"] for a in accounts))
    month_total = money(
        sum(row["total"] for row in repo.month_category_totals(conn, month).values())
    )

    return {
        "month": month,
        "kinds": [
            {"key": key, **meta} for key, meta in ACCOUNT_KINDS.items()
        ],
        "accounts": accounts,
        "has_accounts": bool(live),
        "credit": {
            "limit": limit_total,
            "outstanding": owed_total,
            "available": money(limit_total - owed_total),
            "utilisation": pct(owed_total, limit_total) if limit_total > 0 else 0.0,
            "flag_at": UTILISATION_FLAG,
            "cards": len(cards),
        },
        "unassigned": {
            "total": money(month_total - assigned),
            "share": pct(month_total - assigned, month_total),
        },
        "month_total": month_total,
    }
