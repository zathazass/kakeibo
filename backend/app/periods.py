"""Cross-period comparison: month, quarter, half-year, year.

Rolls the monthly figures up to whichever grain you ask for, so the same code
answers "how did March compare with February" and "how did this year compare
with last". Kakeibo's own monthly view is untouched — this sits alongside it.
"""
from __future__ import annotations

import sqlite3
from typing import Any

from . import repository as repo
from .analytics import MONTH_ABBR, MONTH_NAMES, div, money, parse_month, pct
from .config import CURRENCY, LOCALE
from .models import CATEGORIES, CATEGORY_META

GRAINS: list[dict[str, str]] = [
    {"key": "month", "label": "Month"},
    {"key": "quarter", "label": "Quarter"},
    {"key": "half", "label": "Half year"},
    {"key": "year", "label": "Year"},
]
GRAIN_KEYS = {g["key"] for g in GRAINS}


def bucket_for(month: str, grain: str) -> tuple[str, str, str]:
    """(sort key, headline label, the months it covers)."""
    year, mon = parse_month(month)
    if grain == "month":
        return month, f"{MONTH_NAMES[mon - 1]} {year}", ""
    if grain == "quarter":
        q = (mon - 1) // 3 + 1
        first = (q - 1) * 3
        return (
            f"{year}-Q{q}",
            f"Q{q} {year}",
            f"{MONTH_ABBR[first]}–{MONTH_ABBR[first + 2]}",
        )
    if grain == "half":
        h = 1 if mon <= 6 else 2
        return (
            f"{year}-H{h}",
            f"H{h} {year}",
            "Jan–Jun" if h == 1 else "Jul–Dec",
        )
    return str(year), str(year), "Jan–Dec"


def build_comparison(conn: sqlite3.Connection, grain: str) -> dict[str, Any]:
    if grain not in GRAIN_KEYS:
        grain = "month"

    cat_rows = repo.monthly_category_matrix(conn)
    tag_rows = repo.monthly_tag_matrix(conn)
    plans = {row["month"]: row for row in repo.all_plans(conn)}

    months = sorted({row["month"] for row in cat_rows} | set(plans))

    # ---- roll the months up into buckets -----------------------------------
    buckets: dict[str, dict[str, Any]] = {}
    for month in months:
        key, label, span = bucket_for(month, grain)
        bucket = buckets.setdefault(
            key,
            {
                "key": key,
                "label": label,
                "span": span,
                "months": [],
                "spent": 0.0,
                "entries": 0,
                "income": 0.0,
                "fixed_costs": 0.0,
                "savings_goal": 0.0,
                "categories": {cat: 0.0 for cat in CATEGORIES},
                "tags": {},
            },
        )
        bucket["months"].append(month)
        plan = plans.get(month)
        if plan:
            bucket["income"] += plan["income"]
            bucket["fixed_costs"] += plan["fixed_costs"]
            bucket["savings_goal"] += plan["savings_goal"]

    for row in cat_rows:
        key, _, _ = bucket_for(row["month"], grain)
        bucket = buckets[key]
        bucket["spent"] += row["total"]
        bucket["entries"] += row["entries"]
        bucket["categories"][row["category"]] += row["total"]

    for row in tag_rows:
        key, _, _ = bucket_for(row["month"], grain)
        name = (row["tag"] or "").strip() or "Untagged"
        slot = buckets[key]["tags"].setdefault(
            name, {"tag": name, "category": row["category"], "total": 0.0, "entries": 0}
        )
        slot["total"] += row["total"]
        slot["entries"] += row["entries"]

    ordered = [buckets[key] for key in sorted(buckets)]

    # ---- finish each period, with movement against the one before ----------
    periods: list[dict[str, Any]] = []
    for index, bucket in enumerate(ordered):
        spent = money(bucket["spent"])
        income = money(bucket["income"])
        fixed = money(bucket["fixed_costs"])
        saved = money(income - fixed - spent) if income > 0 else 0.0
        previous = periods[-1]["spent"] if periods else 0.0
        delta = money(spent - previous) if index > 0 else 0.0

        periods.append(
            {
                "key": bucket["key"],
                "label": bucket["label"],
                "span": bucket["span"],
                "months": len(bucket["months"]),
                "month_keys": bucket["months"],
                "spent": spent,
                "entries": bucket["entries"],
                "income": income,
                "fixed_costs": fixed,
                "savings_goal": money(bucket["savings_goal"]),
                "available": money(income - fixed - bucket["savings_goal"]),
                "saved": saved,
                "savings_rate": pct(saved, income) if income > 0 else 0.0,
                "avg_per_month": div(spent, len(bucket["months"])),
                "categories": [
                    {
                        "key": cat,
                        "label": CATEGORY_META[cat]["label"],
                        "slot": slot,
                        "amount": money(bucket["categories"][cat]),
                        "share": pct(bucket["categories"][cat], spent),
                    }
                    for slot, cat in enumerate(CATEGORIES, start=1)
                ],
                "delta": delta,
                "delta_pct": pct(delta, previous) if index > 0 and previous else None,
                "direction": "up" if delta > 0 else ("down" if delta < 0 else "flat"),
            }
        )

    # ---- the picture across every period ------------------------------------
    total_spent = money(sum(p["spent"] for p in periods))
    with_income = [p for p in periods if p["income"] > 0]
    spent_periods = [p for p in periods if p["spent"] > 0]

    tag_totals: dict[str, dict[str, Any]] = {}
    for bucket in ordered:
        for name, slot in bucket["tags"].items():
            entry = tag_totals.setdefault(
                name,
                {"tag": name, "category": slot["category"], "total": 0.0, "entries": 0},
            )
            entry["total"] += slot["total"]
            entry["entries"] += slot["entries"]

    tags = sorted(tag_totals.values(), key=lambda t: t["total"], reverse=True)
    for tag in tags:
        tag["total"] = money(tag["total"])
        tag["share"] = pct(tag["total"], total_spent)
        tag["avg"] = div(tag["total"], tag["entries"])
        tag["label"] = CATEGORY_META[tag["category"]]["label"]

    category_totals = []
    for slot, cat in enumerate(CATEGORIES, start=1):
        amount = money(sum(b["categories"][cat] for b in ordered))
        category_totals.append(
            {
                "key": cat,
                "label": CATEGORY_META[cat]["label"],
                "slot": slot,
                "amount": amount,
                "share": pct(amount, total_spent),
                "avg_per_period": div(amount, len(spent_periods)),
            }
        )

    summary = {
        "grain": grain,
        "periods": len(periods),
        "months": sum(p["months"] for p in periods),
        "entries": sum(p["entries"] for p in periods),
        "total_spent": total_spent,
        "total_income": money(sum(p["income"] for p in periods)),
        "total_saved": money(sum(p["saved"] for p in with_income)),
        "avg_per_period": div(total_spent, len(spent_periods)),
        "savings_rate": pct(
            sum(p["saved"] for p in with_income), sum(p["income"] for p in with_income)
        )
        if with_income
        else 0.0,
        "highest": max(spent_periods, key=lambda p: p["spent"]) if len(spent_periods) > 1 else None,
        "lowest": min(spent_periods, key=lambda p: p["spent"]) if len(spent_periods) > 1 else None,
        "best_saved": max(with_income, key=lambda p: p["saved"]) if len(with_income) > 1 else None,
    }

    return {
        "grain": grain,
        "grains": GRAINS,
        "currency": CURRENCY,
        "locale": LOCALE,
        "periods": periods,
        "summary": summary,
        "category_totals": category_totals,
        "tags": tags[:14],
        "tagged_share": pct(
            sum(t["total"] for t in tags if t["tag"] != "Untagged"), total_spent
        ),
        "top_expenses": repo.biggest_expenses(conn, 8),
    }
