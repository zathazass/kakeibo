"""Monthly allocations, by kakeibo bucket and by your own labels.

Kakeibo already decides how much the month may spend in total. This splits that
figure up: how much of it is meant for Needs, or for "Groceries", or for
"Gadgets" — and how each one is doing against its share.

Entirely optional. A month with no allocations behaves exactly as before.
"""
from __future__ import annotations

import sqlite3
from typing import Any

from . import repository as repo
from .analytics import div, money, pct
from .models import CATEGORIES, CATEGORY_META

# Share of an allocation at which it stops being comfortable.
CLOSE_AT = 80.0


def _state(budget: float, spent: float) -> str:
    if budget <= 0:
        return "none"
    used = pct(spent, budget)
    if used > 100:
        return "over"
    if used >= CLOSE_AT:
        return "close"
    return "ok"


def _pace(budget: float, spent: float, elapsed: float) -> str:
    """Whether an allocation is being used faster than the month is passing."""
    if budget <= 0 or elapsed <= 0:
        return "none"
    expected = budget * elapsed
    if spent > expected * 1.1:
        return "ahead"
    if spent < expected * 0.9:
        return "behind"
    return "even"


def build_budget(
    conn: sqlite3.Connection,
    *,
    month: str,
    available: float,
    category_spend: dict[str, float],
    days_elapsed: int,
    days_in_month: int,
    is_current_month: bool,
) -> dict[str, Any]:
    rows = repo.get_budgets(conn, month)
    limits = {(row["scope"], row["key"]): money(row["amount"]) for row in rows}

    tag_spend = repo.month_tag_totals(conn, month)
    settled = month if is_current_month else None
    cat_history = repo.lifetime_category_totals(conn, exclude_month=settled)
    tag_history = repo.tag_month_averages(conn, exclude_month=settled)

    life = repo.lifetime_totals(conn)
    settled_months = max(1, int(life["months"] or 0) - (1 if is_current_month else 0))
    elapsed = (days_elapsed / days_in_month) if is_current_month and days_in_month else 1.0

    categories: list[dict[str, Any]] = []
    for slot, key in enumerate(CATEGORIES, start=1):
        budget = limits.get(("category", key), 0.0)
        spent = money(category_spend.get(key, 0.0))
        categories.append(
            {
                "key": key,
                "label": CATEGORY_META[key]["label"],
                "slot": slot,
                "budget": budget,
                "spent": spent,
                "left": money(budget - spent) if budget > 0 else 0.0,
                "used_pct": pct(spent, budget) if budget > 0 else 0.0,
                "state": _state(budget, spent),
                "pace": _pace(budget, spent, elapsed),
                "suggested": div(cat_history.get(key, {}).get("total", 0.0), settled_months),
            }
        )

    # Every label with a limit, plus every label spent on this month.
    tag_names = sorted(
        {key for scope, key in limits if scope == "tag"} | set(tag_spend),
        key=str.casefold,
    )
    tags: list[dict[str, Any]] = []
    for name in tag_names:
        budget = limits.get(("tag", name), 0.0)
        actual = tag_spend.get(name, {})
        spent = money(actual.get("total", 0.0))
        category = actual.get("category") or tag_history.get(name, {}).get("category") or "wants"
        tags.append(
            {
                "tag": name,
                "category": category,
                "label": CATEGORY_META[category]["label"],
                "budget": budget,
                "spent": spent,
                "entries": int(actual.get("entries", 0)),
                "left": money(budget - spent) if budget > 0 else 0.0,
                "used_pct": pct(spent, budget) if budget > 0 else 0.0,
                "state": _state(budget, spent),
                "pace": _pace(budget, spent, elapsed),
                "suggested": money(tag_history.get(name, {}).get("avg", 0.0)),
            }
        )

    allocated = money(sum(c["budget"] for c in categories))
    tag_allocated = money(sum(t["budget"] for t in tags))
    spent_total = money(sum(c["spent"] for c in categories))

    return {
        "month": month,
        "available": money(available),
        "allocated": allocated,
        "unallocated": money(available - allocated),
        "over_allocated": allocated > available and available > 0,
        "tag_allocated": tag_allocated,
        "spent": spent_total,
        "has_budgets": bool(limits),
        "categories": categories,
        "tags": tags,
        "can_suggest": any(c["suggested"] > 0 for c in categories)
        or any(t["suggested"] > 0 for t in tags),
        "close_at": CLOSE_AT,
    }


def save_budget(
    conn: sqlite3.Connection,
    month: str,
    categories: dict[str, float],
    tags: dict[str, float],
) -> None:
    rows: list[tuple[str, str, float]] = []
    for key, amount in categories.items():
        if key in CATEGORIES:
            rows.append(("category", key, round(float(amount or 0), 2)))
    for name, amount in tags.items():
        cleaned = (name or "").strip()
        if cleaned:
            rows.append(("tag", cleaned, round(float(amount or 0), 2)))
    repo.set_budgets(conn, month, rows)
