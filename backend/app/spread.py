"""Prepaid costs spread across the months they cover.

A ₹899 recharge lasting 90 days is one payment and three months of service.
Recorded as cash it makes one month spike and the next two look artificially
light — which is exactly the comparison the rest of the app is built on.

So the entry keeps the truth (real amount, real day, real account) and simply
carries how many months it buys. From that, the same data yields two views:

  as paid      what actually left your account this month
  monthly cost what this month really costs you

Neither is more correct than the other. The first is cash flow, the second is
what a month is worth comparing against another month.
"""
from __future__ import annotations

import sqlite3
from datetime import date
from typing import Any

from . import repository as repo
from .analytics import month_label, month_of, money, pct, shift_month
from .models import CATEGORIES, CATEGORY_META


def coverage(entry: dict[str, Any]) -> list[str]:
    """The months a payment covers, starting with the one it was made in."""
    start = entry["spent_on"][:7]
    months = max(1, int(entry.get("spread_months") or 1))
    return [shift_month(start, offset) for offset in range(months)]


def monthly_share(entry: dict[str, Any]) -> float:
    months = max(1, int(entry.get("spread_months") or 1))
    return money(entry["amount"] / months)


def build_spread(
    conn: sqlite3.Connection, month: str, today: date | None = None
) -> dict[str, Any]:
    today = today or date.today()
    this_month = month_of(today)

    prepaid = repo.spread_entries(conn)
    cash_rows = repo.month_category_totals(conn, month)
    cash_by_cat = {cat: float(cash_rows.get(cat, {}).get("total", 0.0)) for cat in CATEGORIES}
    cash_total = money(sum(cash_by_cat.values()))

    # Start from cash, then swap each prepaid payment for its monthly share.
    monthly_by_cat = dict(cash_by_cat)
    paid_here: list[dict[str, Any]] = []
    carried_in: list[dict[str, Any]] = []

    for entry in prepaid:
        months = coverage(entry)
        share = monthly_share(entry)
        paid_in = entry["spent_on"][:7]

        if paid_in == month:
            # Take the full payment back out; put one month's worth in.
            monthly_by_cat[entry["category"]] -= entry["amount"]
            monthly_by_cat[entry["category"]] += share
            paid_here.append({**entry, "monthly": share, "months": len(months)})
        elif month in months:
            # Paid earlier, still covering this month.
            monthly_by_cat[entry["category"]] += share
            carried_in.append(
                {
                    **entry,
                    "monthly": share,
                    "months": len(months),
                    "month_index": months.index(month) + 1,
                }
            )

    monthly_total = money(sum(monthly_by_cat.values()))

    # Everything still running, judged from today rather than the month viewed.
    commitments: list[dict[str, Any]] = []
    for entry in prepaid:
        months = coverage(entry)
        if months[-1] < this_month:
            continue
        used = sum(1 for m in months if m <= this_month)
        remaining = max(0, len(months) - used)
        commitments.append(
            {
                "id": entry["id"],
                "note": entry["note"],
                "tag": entry["tag"],
                "category": entry["category"],
                "label": CATEGORY_META[entry["category"]]["label"],
                "amount": money(entry["amount"]),
                "monthly": monthly_share(entry),
                "months": len(months),
                "months_used": used,
                "months_left": remaining,
                "paid_on": entry["spent_on"],
                "covers_until": months[-1],
                "covers_until_label": month_label(months[-1]),
                "unused_value": money(monthly_share(entry) * remaining),
                "expiring_soon": remaining <= 1,
            }
        )
    commitments.sort(key=lambda c: (c["months_left"], -c["monthly"]))

    return {
        "month": month,
        "cash_spent": cash_total,
        "monthly_spent": monthly_total,
        "difference": money(monthly_total - cash_total),
        "has_spread": bool(prepaid),
        "categories": [
            {
                "key": cat,
                "label": CATEGORY_META[cat]["label"],
                "slot": slot,
                "cash": money(cash_by_cat[cat]),
                "monthly": money(monthly_by_cat[cat]),
                "share": pct(monthly_by_cat[cat], monthly_total),
            }
            for slot, cat in enumerate(CATEGORIES, start=1)
        ],
        "paid_here": paid_here,
        "carried_in": carried_in,
        "commitments": commitments,
        "committed_monthly": money(sum(c["monthly"] for c in commitments)),
        "unused_value": money(sum(c["unused_value"] for c in commitments)),
    }
