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
from .models import ACCOUNT_KINDS, TRANSFER_KINDS

# Utilisation above this is the level credit scoring tends to notice.
UTILISATION_FLAG = 30.0


def build_accounts(conn: sqlite3.Connection, month: str) -> dict[str, Any]:
    rows = repo.list_accounts(conn, include_archived=True)
    spend_month = repo.account_month_spend(conn, month)
    owed = repo.credit_outstanding(conn)

    # Balances are cumulative up to and including the month being viewed.
    spend_todate = repo.spend_by_account(conn, up_to_month=month)
    income_todate = repo.income_by_account(conn, up_to_month=month)
    moved_todate = repo.transfer_movement(conn)
    moved_month = repo.transfer_movement(conn, month)

    plan = repo.get_plan(conn, month)
    sip = repo.month_sip_total(conn, month)

    accounts: list[dict[str, Any]] = []
    for row in rows:
        acct_id = row["id"]
        this_month = spend_month.get(acct_id, {})
        flows = moved_todate.get(acct_id, {"in": 0.0, "out": 0.0})
        month_flows = moved_month.get(acct_id, {"in": 0.0, "out": 0.0})
        is_credit = row["kind"] == "credit"

        entry: dict[str, Any] = {
            **row,
            "kind_label": ACCOUNT_KINDS[row["kind"]]["label"],
            "kind_hint": ACCOUNT_KINDS[row["kind"]]["hint"],
            "credit_limit": money(row["credit_limit"]),
            "opening_balance": money(row["opening_balance"]),
            "spent_this_month": money(this_month.get("total", 0.0)),
            "entries_this_month": int(this_month.get("entries", 0)),
            "income_to_date": money(income_todate.get(acct_id, 0.0)),
            "salary_this_month": money(
                plan["income"] if plan.get("income_account_id") == acct_id else 0.0
            ),
            "moved_in": money(flows["in"]),
            "moved_out": money(flows["out"]),
            "moved_in_month": money(month_flows["in"]),
            "moved_out_month": money(month_flows["out"]),
        }

        if is_credit:
            debt = owed.get(acct_id, {})
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
                    "balance": None,
                }
            )
        else:
            # A card is a debt, not a balance, so only real accounts get one.
            entry["balance"] = money(
                entry["opening_balance"]
                + entry["income_to_date"]
                + entry["moved_in"]
                - money(spend_todate.get(acct_id, 0.0))
                - entry["moved_out"]
            )
            entry["has_balance"] = (
                entry["opening_balance"] != 0
                or entry["income_to_date"] != 0
                or entry["moved_in"] != 0
                or entry["moved_out"] != 0
                or spend_todate.get(acct_id, 0.0) != 0
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

    # What actually reached savings this month: money moved into a savings
    # account, plus anything invested. This is the savings goal being carried
    # out — never spending.
    savings_ids = {a["id"] for a in accounts if a["kind"] == "savings"}
    into_savings = money(
        sum(moved_month.get(acct, {"in": 0.0})["in"] for acct in savings_ids)
    )
    put_aside = money(into_savings + sip["sip"])
    goal = money(plan["savings_goal"])

    income_account = next(
        (a for a in accounts if a["id"] == plan.get("income_account_id")), None
    )

    return {
        "month": month,
        "kinds": [{"key": key, **meta} for key, meta in ACCOUNT_KINDS.items()],
        "transfer_kinds": [{"key": key, **meta} for key, meta in TRANSFER_KINDS.items()],
        "accounts": accounts,
        "has_accounts": bool(live),
        "salary": {
            "amount": money(plan["income"]),
            "account_id": plan.get("income_account_id"),
            "account_name": income_account["name"] if income_account else None,
        },
        "savings": {
            "goal": goal,
            "into_savings": into_savings,
            "sip": money(sip["sip"]),
            "put_aside": put_aside,
            "short_by": money(max(0.0, goal - put_aside)),
            "goal_pct": pct(put_aside, goal) if goal > 0 else 0.0,
            "met": goal > 0 and put_aside >= goal,
        },
        "credit": {
            "limit": limit_total,
            "outstanding": owed_total,
            "available": money(limit_total - owed_total),
            "utilisation": pct(owed_total, limit_total) if limit_total > 0 else 0.0,
            "flag_at": UTILISATION_FLAG,
            "cards": len(cards),
        },
        "transfers": repo.list_transfers(conn, month),
        "unassigned": {
            "total": money(month_total - assigned),
            "share": pct(month_total - assigned, month_total),
        },
        "month_total": month_total,
    }
