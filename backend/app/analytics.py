"""Turns a month of raw expenses into the kakeibo picture.

Everything the dashboard shows is computed here so the UI stays a rendering
layer: budget maths, day/week rollups, month-over-month movement, and the
written verdicts about where money was saved and where it leaked.
"""
from __future__ import annotations

import calendar
import sqlite3
from datetime import date, timedelta
from typing import Any

from . import repository as repo
from .config import CURRENCY, LOCALE
from .models import CATEGORIES, CATEGORY_META, TAG_SUGGESTIONS

MONTH_NAMES = (
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
)
MONTH_ABBR = ("Jan", "Feb", "Mar", "Apr", "May", "Jun",
              "Jul", "Aug", "Sep", "Oct", "Nov", "Dec")
WEEKDAY_SHORT = ("Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun")
WEEKDAY_LONG = ("Monday", "Tuesday", "Wednesday", "Thursday",
                "Friday", "Saturday", "Sunday")

# Kakeibo's rough guidance on a healthy mix; used only to raise a flag, never to
# hard-fail a month.
WANTS_SHARE_FLAG = 30.0
UNEXPECTED_SHARE_FLAG = 15.0
WANTS_LEAN_FLAG = 20.0

# A leak is small *and* frequent: repeated at least this often, and averaging no
# more than this share of the month per occurrence.
LEAK_MIN_REPEATS = 3
LEAK_MAX_SHARE = 0.02
# A trimmable habit is judged the same way, against a month's typical spend.
HABIT_MAX_SHARE = 0.05

QUIET_DAYS_MIN = 5
WEEKEND_RATIO_FLAG = 1.3
# Days of entries needed before a month-end projection is worth showing / trusting.
PROJECTION_MIN_DAYS = 3
FORECAST_MIN_DAYS = 7


# --------------------------------------------------------------- month maths


def parse_month(month: str) -> tuple[int, int]:
    year, mon = month.split("-")
    return int(year), int(mon)


def month_of(day: date) -> str:
    return f"{day.year:04d}-{day.month:02d}"


def month_bounds(month: str) -> tuple[date, date]:
    year, mon = parse_month(month)
    return date(year, mon, 1), date(year, mon, calendar.monthrange(year, mon)[1])


def shift_month(month: str, delta: int) -> str:
    year, mon = parse_month(month)
    index = year * 12 + (mon - 1) + delta
    return f"{index // 12:04d}-{index % 12 + 1:02d}"


def month_label(month: str) -> str:
    year, mon = parse_month(month)
    return f"{MONTH_NAMES[mon - 1]} {year}"


def short_month_label(month: str) -> str:
    year, mon = parse_month(month)
    return f"{MONTH_ABBR[mon - 1]} {str(year)[2:]}"


def day_label(day: date) -> str:
    return f"{MONTH_ABBR[day.month - 1]} {day.day}"


# ------------------------------------------------------------------ helpers


def money(value: float) -> float:
    return round(float(value or 0), 2)


def pct(part: float, whole: float) -> float:
    if not whole:
        return 0.0
    return round(part / whole * 100, 1)


def div(part: float, whole: float) -> float:
    return money(part / whole) if whole else 0.0


def _blank_day() -> dict[str, float]:
    return {"total": 0.0, "entries": 0, **{cat: 0.0 for cat in CATEGORIES}}


# --------------------------------------------------------------- the builder


def build_dashboard(conn: sqlite3.Connection, month: str, today: date) -> dict[str, Any]:
    first, last = month_bounds(month)
    days_in_month = last.day
    prev_month = shift_month(month, -1)

    plan = repo.get_plan(conn, month)
    expenses = repo.list_expenses(conn, first.isoformat(), last.isoformat())

    # A fresh month starts blank; offer last month's plan rather than writing it
    # behind the user's back.
    plan_suggestion = None
    if plan["income"] == 0 and plan["fixed_costs"] == 0 and plan["savings_goal"] == 0:
        previous = repo.get_plan(conn, prev_month)
        if previous["income"] > 0 or previous["fixed_costs"] > 0:
            plan_suggestion = {
                "from_month": prev_month,
                "from_label": month_label(prev_month),
                "income": money(previous["income"]),
                "fixed_costs": money(previous["fixed_costs"]),
                "savings_goal": money(previous["savings_goal"]),
            }

    is_current_month = (today.year, today.month) == (first.year, first.month)
    is_past_month = last < today
    if is_current_month:
        days_elapsed = today.day
    elif is_past_month:
        days_elapsed = days_in_month
    else:
        days_elapsed = 0
    days_left = days_in_month - days_elapsed

    totals = _totals(plan, expenses, days_in_month, days_elapsed, days_left)
    categories = _categories(conn, expenses, totals["spent"], prev_month, days_elapsed, is_current_month)
    daily = _daily(expenses, first, days_in_month, today, totals["daily_allowance"])
    weekly = _weekly(daily, first, last, totals["daily_allowance"])
    weekday_profile = _weekday_profile(daily)
    comparison = _comparison(conn, plan, totals, prev_month, days_elapsed, is_current_month)
    leaks = repo.repeat_notes(conn, month, min_count=LEAK_MIN_REPEATS)
    top_expenses = sorted(expenses, key=lambda e: e["amount"], reverse=True)[:5]
    history = _history(conn)

    insights = _insights(
        totals=totals,
        categories=categories,
        daily=daily,
        weekly=weekly,
        weekday_profile=weekday_profile,
        comparison=comparison,
        leaks=leaks,
        top_expenses=top_expenses,
        prev_month=prev_month,
        days_elapsed=days_elapsed,
        days_left=days_left,
        days_in_month=days_in_month,
        is_current_month=is_current_month,
        has_plan=totals["income"] > 0,
    )

    return {
        "month": month,
        "month_label": month_label(month),
        "prev_month": prev_month,
        "next_month": shift_month(month, 1),
        "current_month": month_of(today),
        "is_current_month": is_current_month,
        "is_future_month": first > today,
        "today": today.isoformat(),
        "days_in_month": days_in_month,
        "days_elapsed": days_elapsed,
        "days_left": days_left,
        "currency": CURRENCY,
        "locale": LOCALE,
        "category_meta": CATEGORY_META,
        "tags": {
            "suggestions": TAG_SUGGESTIONS,
            # Everything you have invented so far, offered back on the form.
            "used": [row["tag"] for row in repo.known_tags(conn)],
        },
        "rules": {
            "wants_flag_pct": WANTS_SHARE_FLAG,
            "wants_lean_pct": WANTS_LEAN_FLAG,
            "unexpected_flag_pct": UNEXPECTED_SHARE_FLAG,
            "leak_min_repeats": LEAK_MIN_REPEATS,
            "leak_max_share_pct": round(LEAK_MAX_SHARE * 100, 1),
            "quiet_days_min": QUIET_DAYS_MIN,
            "weekend_ratio_flag": WEEKEND_RATIO_FLAG,
            "projection_min_days": PROJECTION_MIN_DAYS,
            "forecast_min_days": FORECAST_MIN_DAYS,
        },
        "plan": plan,
        "plan_suggestion": plan_suggestion,
        "totals": totals,
        "categories": categories,
        "daily": daily,
        "weekly": weekly,
        "weekday_profile": weekday_profile,
        "comparison": comparison,
        "history": history,
        "leaks": [
            {
                "label": row["label"],
                "entries": int(row["entries"]),
                "total": money(row["total"]),
                "category": row["category"],
            }
            for row in leaks
        ],
        "top_expenses": top_expenses,
        "expenses": expenses,
        "insights": insights,
        "outlook": _outlook(
            conn,
            month=month,
            totals=totals,
            categories=categories,
            history=history,
            leaks=leaks,
            days_left=days_left,
            days_elapsed=days_elapsed,
            days_in_month=days_in_month,
            is_current_month=is_current_month,
        ),
        "reflection_questions": _reflection_questions(totals, categories, insights),
    }


# ------------------------------------------------------------------ sections


def _totals(
    plan: dict[str, Any],
    expenses: list[dict[str, Any]],
    days_in_month: int,
    days_elapsed: int,
    days_left: int,
) -> dict[str, Any]:
    income = money(plan["income"])
    fixed_costs = money(plan["fixed_costs"])
    savings_goal = money(plan["savings_goal"])

    # Kakeibo's defining move: savings come off the top, before spending money.
    available = money(income - fixed_costs - savings_goal)
    spent = money(sum(e["amount"] for e in expenses))
    remaining = money(available - spent)
    actual_savings = money(income - fixed_costs - spent)

    daily_allowance = div(available, days_in_month)
    avg_daily_spend = div(spent, days_elapsed)
    projected_spend = money(avg_daily_spend * days_in_month) if days_elapsed else spent
    expected_by_now = money(daily_allowance * days_elapsed)

    return {
        "income": income,
        "fixed_costs": fixed_costs,
        "savings_goal": savings_goal,
        "available_to_spend": available,
        "spent": spent,
        "remaining": remaining,
        "entries": len(expenses),
        "actual_savings": actual_savings,
        "savings_rate": pct(actual_savings, income),
        "savings_goal_pct": pct(actual_savings, savings_goal) if savings_goal else 0.0,
        "daily_allowance": daily_allowance,
        "safe_daily_left": div(remaining, days_left) if days_left > 0 and remaining > 0 else 0.0,
        "avg_daily_spend": avg_daily_spend,
        "projected_spend": projected_spend,
        "projected_savings": money(income - fixed_costs - projected_spend),
        "projected_over": money(projected_spend - available),
        "budget_used_pct": pct(spent, available),
        "month_elapsed_pct": pct(days_elapsed, days_in_month),
        "expected_by_now": expected_by_now,
        "pace_delta": money(spent - expected_by_now),
        "is_over_budget": remaining < 0,
    }


def _categories(
    conn: sqlite3.Connection,
    expenses: list[dict[str, Any]],
    spent: float,
    prev_month: str,
    days_elapsed: int,
    is_current_month: bool,
) -> list[dict[str, Any]]:
    current: dict[str, dict[str, float]] = {
        cat: {"total": 0.0, "entries": 0} for cat in CATEGORIES
    }
    for row in expenses:
        bucket = current[row["category"]]
        bucket["total"] += row["amount"]
        bucket["entries"] += 1

    # Compare like with like: an in-progress month is measured against the same
    # stretch of the previous month, not against its full total.
    cutoff = days_elapsed if is_current_month else None
    previous = repo.month_category_totals(conn, prev_month, through_day=cutoff)

    out: list[dict[str, Any]] = []
    for slot, cat in enumerate(CATEGORIES, start=1):
        amount = money(current[cat]["total"])
        prev_amount = money(previous.get(cat, {}).get("total", 0.0))
        delta = money(amount - prev_amount)
        out.append(
            {
                "key": cat,
                "label": CATEGORY_META[cat]["label"],
                "jp": CATEGORY_META[cat]["jp"],
                "hint": CATEGORY_META[cat]["hint"],
                "slot": slot,
                "amount": amount,
                "entries": int(current[cat]["entries"]),
                "share": pct(amount, spent),
                "prev_amount": prev_amount,
                "delta": delta,
                "delta_pct": pct(delta, prev_amount) if prev_amount else None,
                "avg_per_entry": div(amount, current[cat]["entries"]),
            }
        )
    return out


def _daily(
    expenses: list[dict[str, Any]],
    first: date,
    days_in_month: int,
    today: date,
    daily_allowance: float,
) -> list[dict[str, Any]]:
    by_day: dict[str, dict[str, float]] = {}
    for row in expenses:
        bucket = by_day.setdefault(row["spent_on"], _blank_day())
        bucket["total"] += row["amount"]
        bucket["entries"] += 1
        bucket[row["category"]] += row["amount"]

    series: list[dict[str, Any]] = []
    running = 0.0
    for offset in range(days_in_month):
        day = first + timedelta(days=offset)
        iso = day.isoformat()
        bucket = by_day.get(iso, _blank_day())
        running += bucket["total"]
        series.append(
            {
                "date": iso,
                "day": day.day,
                "label": day_label(day),
                "weekday": day.weekday(),
                "weekday_short": WEEKDAY_SHORT[day.weekday()],
                "is_weekend": day.weekday() >= 5,
                "is_today": day == today,
                "is_future": day > today,
                "total": money(bucket["total"]),
                "entries": int(bucket["entries"]),
                **{cat: money(bucket[cat]) for cat in CATEGORIES},
                "cumulative": money(running),
                "pace": money(daily_allowance * (offset + 1)),
            }
        )
    return series


def _weekly(
    daily: list[dict[str, Any]],
    first: date,
    last: date,
    daily_allowance: float,
) -> list[dict[str, Any]]:
    """Calendar weeks (Monday start) clipped to the month."""
    by_date = {row["date"]: row for row in daily}
    weeks: list[dict[str, Any]] = []
    cursor = first
    index = 1
    while cursor <= last:
        end = min(cursor + timedelta(days=6 - cursor.weekday()), last)
        span = [
            by_date[(cursor + timedelta(days=i)).isoformat()]
            for i in range((end - cursor).days + 1)
        ]
        days = len(span)
        total = money(sum(r["total"] for r in span))
        allowance = money(daily_allowance * days)
        elapsed_days = sum(1 for r in span if not r["is_future"])
        weeks.append(
            {
                "index": index,
                "label": f"Week {index}",
                "range_label": (
                    day_label(cursor)
                    if cursor == end
                    else f"{day_label(cursor)} – {end.day}"
                    if cursor.month == end.month
                    else f"{day_label(cursor)} – {day_label(end)}"
                ),
                "start": cursor.isoformat(),
                "end": end.isoformat(),
                "days": days,
                "elapsed_days": elapsed_days,
                "is_partial": days < 7,
                "is_future": elapsed_days == 0,
                "total": total,
                **{cat: money(sum(r[cat] for r in span)) for cat in CATEGORIES},
                "entries": sum(r["entries"] for r in span),
                "allowance": allowance,
                "delta_vs_allowance": money(total - allowance),
                "avg_per_day": div(total, elapsed_days),
                "busiest_day": max(span, key=lambda r: r["total"])["date"] if span else None,
            }
        )
        cursor = end + timedelta(days=1)
        index += 1
    return weeks


def _weekday_profile(daily: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Which day of the week the money actually goes out on."""
    buckets: list[dict[str, Any]] = [
        {
            "weekday": wd,
            "label": WEEKDAY_LONG[wd],
            "short": WEEKDAY_SHORT[wd],
            "is_weekend": wd >= 5,
            "total": 0.0,
            "days": 0,
            "entries": 0,
        }
        for wd in range(7)
    ]
    for row in daily:
        if row["is_future"]:
            continue
        bucket = buckets[row["weekday"]]
        bucket["total"] += row["total"]
        bucket["days"] += 1
        bucket["entries"] += row["entries"]
    for bucket in buckets:
        bucket["total"] = money(bucket["total"])
        bucket["avg"] = div(bucket["total"], bucket["days"])
    return buckets


def _comparison(
    conn: sqlite3.Connection,
    plan: dict[str, Any],
    totals: dict[str, Any],
    prev_month: str,
    days_elapsed: int,
    is_current_month: bool,
) -> dict[str, Any]:
    cutoff = days_elapsed if is_current_month else None
    prev_cats = repo.month_category_totals(conn, prev_month, through_day=cutoff)
    prev_spent = money(sum(row["total"] for row in prev_cats.values()))
    prev_full = repo.month_category_totals(conn, prev_month)
    prev_full_spent = money(sum(row["total"] for row in prev_full.values()))
    prev_plan = repo.get_plan(conn, prev_month)
    delta = money(totals["spent"] - prev_spent)

    return {
        "prev_month": prev_month,
        "prev_month_label": month_label(prev_month),
        "prev_month_short": short_month_label(prev_month),
        "like_for_like": is_current_month,
        "cutoff_day": cutoff,
        "prev_spent": prev_spent,
        "prev_full_spent": prev_full_spent,
        "prev_savings": money(prev_plan["income"] - prev_plan["fixed_costs"] - prev_full_spent),
        "spent": totals["spent"],
        "delta": delta,
        "delta_pct": pct(delta, prev_spent) if prev_spent else None,
        "direction": "up" if delta > 0 else ("down" if delta < 0 else "flat"),
    }


def _history(conn: sqlite3.Connection, limit: int = 12) -> list[dict[str, Any]]:
    rows = repo.month_history(conn, limit)
    out = []
    for row in reversed(rows):  # oldest → newest for the trend strip
        available = money(row["income"] - row["fixed_costs"] - row["savings_goal"])
        out.append(
            {
                "month": row["month"],
                "label": short_month_label(row["month"]),
                "spent": money(row["spent"]),
                "income": money(row["income"]),
                "available": available,
                "saved": money(row["income"] - row["fixed_costs"] - row["spent"]),
                "over_budget": available > 0 and row["spent"] > available,
            }
        )
    return out


# ------------------------------------------------------------ money in prose

def _group_digits(digits: str) -> str:
    """Indian grouping (1,23,456) for en-IN, plain thousands elsewhere."""
    if len(digits) <= 3:
        return digits
    if LOCALE.replace("_", "-").lower().endswith("in"):
        head, tail = digits[:-3], digits[-3:]
        chunks: list[str] = []
        while len(head) > 2:
            chunks.insert(0, head[-2:])
            head = head[:-2]
        if head:
            chunks.insert(0, head)
        return ",".join(chunks) + "," + tail
    return f"{int(digits):,}"


def fmt(value: float) -> str:
    """Currency for prose. Whole units — insight text does not need paise."""
    amount = abs(round(float(value or 0)))
    return f"{CURRENCY}{_group_digits(str(amount))}"


def _ratio(a: float, b: float) -> float:
    return round(a / b, 1) if b else 0.0


def plural(count: int, singular: str, plural_form: str | None = None) -> str:
    word = singular if count == 1 else (plural_form or f"{singular}s")
    return f"{count} {word}"


# ----------------------------------------------------------------- insights

TONE_RANK = {"critical": 0, "serious": 1, "warning": 2, "good": 3, "info": 4}


def _insights(
    *,
    totals: dict[str, Any],
    categories: list[dict[str, Any]],
    daily: list[dict[str, Any]],
    weekly: list[dict[str, Any]],
    weekday_profile: list[dict[str, Any]],
    comparison: dict[str, Any],
    leaks: list[dict[str, Any]],
    top_expenses: list[dict[str, Any]],
    prev_month: str,
    days_elapsed: int,
    days_left: int,
    days_in_month: int,
    is_current_month: bool,
    has_plan: bool,
) -> list[dict[str, Any]]:
    """The written half of a kakeibo month: what went right, what leaked."""
    out: list[dict[str, Any]] = []

    def add(tone: str, group: str, icon: str, title: str, detail: str) -> None:
        out.append(
            {
                "tone": tone,
                "group": group,
                "icon": icon,
                "title": title,
                "detail": detail,
                "rank": TONE_RANK[tone],
            }
        )

    spent = totals["spent"]
    available = totals["available_to_spend"]
    prev_short = comparison["prev_month_short"]
    like_for_like = (
        f" (same {days_elapsed} days of {prev_short})" if comparison["like_for_like"] else ""
    )
    by_key = {c["key"]: c for c in categories}

    # --- setup -------------------------------------------------------------
    if not has_plan:
        add(
            "info", "pace", "info",
            "Set your month up to unlock the budget view",
            "Enter income and fixed costs above. Kakeibo puts savings aside first — "
            "what is left after that is the only money the month is allowed to spend.",
        )

    if spent == 0 and days_elapsed > 0:
        add(
            "info", "pattern", "info",
            "Nothing logged yet",
            "Add an entry below and the pace, weekly and day-of-week views fill in from there.",
        )

    # --- pace & projection -------------------------------------------------
    if has_plan and available > 0 and days_elapsed > 0:
        gap = totals["budget_used_pct"] - totals["month_elapsed_pct"]
        pace_delta = totals["pace_delta"]
        if pace_delta > 0:
            tone = "critical" if gap > 15 else "serious" if gap > 5 else "warning"
            add(
                tone, "overspent", "up",
                "Spending is ahead of pace",
                f"{totals['budget_used_pct']:.0f}% of your spending money is gone with "
                f"{totals['month_elapsed_pct']:.0f}% of the month behind you — "
                f"{fmt(pace_delta)} more than an even day-by-day pace.",
            )
        elif pace_delta < 0:
            add(
                "good", "reduced", "check",
                "Running under pace",
                f"You are {fmt(pace_delta)} below an even pace — "
                f"{totals['budget_used_pct']:.0f}% of the budget used, "
                f"{totals['month_elapsed_pct']:.0f}% of the month gone.",
            )

        if is_current_month and days_elapsed >= PROJECTION_MIN_DAYS:
            over = totals["projected_over"]
            if over > 0:
                add(
                    "serious" if over > available * 0.1 else "warning", "overspent", "up",
                    f"On track to overspend by {fmt(over)}",
                    f"At {fmt(totals['avg_daily_spend'])} a day you would finish the month at "
                    f"{fmt(totals['projected_spend'])} against {fmt(available)} of spending money.",
                )
            else:
                add(
                    "good", "reduced", "check",
                    f"On track to finish {fmt(over)} under budget",
                    f"At {fmt(totals['avg_daily_spend'])} a day the month lands around "
                    f"{fmt(totals['projected_spend'])}, leaving {fmt(totals['projected_savings'])} saved.",
                )

    if has_plan and is_current_month and days_left > 0:
        if totals["remaining"] > 0:
            add(
                "info", "pace", "clock",
                f"{fmt(totals['safe_daily_left'])} a day for the {days_left} days left",
                f"{fmt(totals['remaining'])} of spending money remains. Staying under that daily "
                f"figure keeps the savings goal untouched.",
            )
        else:
            add(
                "critical", "overspent", "warn",
                "Spending money is gone",
                f"{days_left} days still to go and you are {fmt(totals['remaining'])} past the "
                f"budget — anything more comes out of the {fmt(totals['savings_goal'])} savings goal.",
            )

    # --- savings -----------------------------------------------------------
    if totals["savings_goal"] > 0:
        saved = totals["actual_savings"]
        goal = totals["savings_goal"]
        if saved >= goal:
            add(
                "good", "reduced", "star",
                "Savings goal is intact",
                f"{fmt(saved)} saved against a {fmt(goal)} goal — "
                f"{totals['savings_rate']:.0f}% of income.",
            )
        elif saved > 0:
            add(
                "warning", "overspent", "warn",
                f"Savings short by {fmt(goal - saved)}",
                f"{fmt(saved)} of the {fmt(goal)} goal survives at today's spending.",
            )
        else:
            add(
                "critical", "overspent", "warn",
                "Nothing saved this month",
                f"Spending has eaten the whole {fmt(goal)} goal and then some.",
            )

    # --- month over month --------------------------------------------------
    if comparison["prev_spent"] > 0:
        delta = comparison["delta"]
        delta_pct = comparison["delta_pct"] or 0
        if delta < 0:
            add(
                "good", "reduced", "down",
                f"Total spending down {abs(delta_pct):.0f}% vs {prev_short}",
                f"{fmt(spent)} against {fmt(comparison['prev_spent'])}{like_for_like} — "
                f"{fmt(delta)} less.",
            )
        elif delta > 0:
            add(
                "warning", "overspent", "up",
                f"Total spending up {delta_pct:.0f}% vs {prev_short}",
                f"{fmt(spent)} against {fmt(comparison['prev_spent'])}{like_for_like} — "
                f"{fmt(delta)} more.",
            )

    # --- category movers ---------------------------------------------------
    # Culture is deliberately excluded: kakeibo does not want it trimmed, so a
    # fall there is not an improvement and a rise there is not a problem.
    movers = sorted(
        [
            c
            for c in categories
            if c["prev_amount"] > 0 and c["delta"] != 0 and c["key"] != "culture"
        ],
        key=lambda c: c["delta"],
    )
    for cat in [c for c in reversed(movers) if c["delta"] > 0][:2]:
        add(
            "warning", "overspent", "up",
            f"{cat['label']} up {fmt(cat['delta'])} vs {prev_short}",
            f"{fmt(cat['amount'])} across {plural(cat['entries'], 'entry', 'entries')}, "
            f"against {fmt(cat['prev_amount'])}{like_for_like} — "
            f"{abs(cat['delta_pct'] or 0):.0f}% more.",
        )
    for cat in [c for c in movers if c["delta"] < 0][:2]:
        add(
            "good", "reduced", "down",
            f"{cat['label']} down {fmt(cat['delta'])} vs {prev_short}",
            f"{fmt(cat['amount'])} against {fmt(cat['prev_amount'])}{like_for_like} — "
            f"{abs(cat['delta_pct'] or 0):.0f}% less. This is where the month improved.",
        )

    # --- the kakeibo category rules ---------------------------------------
    wants, unexpected, culture = by_key["wants"], by_key["unexpected"], by_key["culture"]
    if spent > 0 and wants["share"] > WANTS_SHARE_FLAG:
        add(
            "warning", "overspent", "warn",
            f"Wants are {wants['share']:.0f}% of your spending",
            f"{fmt(wants['amount'])} across {plural(wants['entries'], 'entry', 'entries')}. Wants are the first "
            f"place kakeibo trims — nothing here is required to get through the month.",
        )
    elif spent > 0 and wants["share"] <= WANTS_LEAN_FLAG:
        add(
            "good", "reduced", "check",
            f"Wants held to {wants['share']:.0f}% of spending",
            f"{fmt(wants['amount'])} on optional spending — a lean split by kakeibo's reckoning.",
        )

    if spent > 0 and unexpected["share"] > UNEXPECTED_SHARE_FLAG:
        add(
            "warning", "overspent", "warn",
            f"Unexpected costs took {unexpected['share']:.0f}% of the month",
            f"{fmt(unexpected['amount'])} of surprises. A separate buffer keeps these from "
            f"eating spending money that was meant for something else.",
        )

    if spent > 0 and culture["amount"] == 0:
        add(
            "info", "pattern", "info",
            "No culture spending this month",
            "Books, courses, museums, music. Kakeibo gives self-enrichment its own bucket "
            "precisely so it does not quietly get cut first.",
        )
    elif culture["amount"] > 0:
        add(
            "good", "reduced", "star",
            f"{fmt(culture['amount'])} went to culture",
            f"{culture['share']:.0f}% of spending on books, learning and the like — "
            f"the one category kakeibo does not ask you to shrink.",
        )
        if culture["delta"] < 0 and culture["prev_amount"] > 0:
            add(
                "info", "pattern", "info",
                f"Culture spending is down {fmt(culture['delta'])}",
                f"{fmt(culture['amount'])} against {fmt(culture['prev_amount'])}{like_for_like}. "
                f"Worth noticing rather than celebrating — this is the bucket kakeibo asks you "
                f"to protect when you trim.",
            )

    # --- rhythm: weeks, days, weekdays ------------------------------------
    live_weeks = [w for w in weekly if not w["is_future"] and w["total"] > 0]
    if len(live_weeks) > 1:
        heaviest = max(live_weeks, key=lambda w: w["total"])
        lightest = min(live_weeks, key=lambda w: w["total"])
        over = heaviest["delta_vs_allowance"]
        add(
            "warning" if over > 0 else "info", "pattern", "up",
            f"{heaviest['label']} was the heaviest — {fmt(heaviest['total'])}",
            f"{heaviest['range_label']}, {fmt(abs(over))} "
            f"{'over' if over > 0 else 'under'} that week's {fmt(heaviest['allowance'])} share "
            f"of the budget.",
        )
        if lightest["index"] != heaviest["index"]:
            add(
                "good", "reduced", "down",
                f"{lightest['label']} was the leanest — {fmt(lightest['total'])}",
                f"{lightest['range_label']}, averaging {fmt(lightest['avg_per_day'])} a day.",
            )

    spent_days = [d for d in daily if d["total"] > 0]
    if spent_days:
        biggest = max(spent_days, key=lambda d: d["total"])
        add(
            "info", "pattern", "up",
            f"Biggest day: {fmt(biggest['total'])} on {biggest['label']}",
            f"{WEEKDAY_LONG[biggest['weekday']]}, {plural(biggest['entries'], 'entry', 'entries')} — "
            f"{pct(biggest['total'], spent):.0f}% of the whole month in one day.",
        )

    elapsed_days = [d for d in daily if not d["is_future"]]
    quiet = [d for d in elapsed_days if d["total"] == 0]
    if len(quiet) >= QUIET_DAYS_MIN:
        add(
            "good", "reduced", "check",
            f"{len(quiet)} no-spend days",
            f"{pct(len(quiet), len(elapsed_days)):.0f}% of the days so far cost nothing at all.",
        )

    weekend = [b for b in weekday_profile if b["is_weekend"] and b["days"]]
    weekday = [b for b in weekday_profile if not b["is_weekend"] and b["days"]]
    if weekend and weekday:
        we_avg = div(sum(b["total"] for b in weekend), sum(b["days"] for b in weekend))
        wd_avg = div(sum(b["total"] for b in weekday), sum(b["days"] for b in weekday))
        if wd_avg > 0 and we_avg > wd_avg * WEEKEND_RATIO_FLAG:
            add(
                "warning", "pattern", "up",
                f"Weekends cost {_ratio(we_avg, wd_avg)}× a weekday",
                f"{fmt(we_avg)} per weekend day against {fmt(wd_avg)} on weekdays.",
            )
        elif we_avg > 0 and wd_avg > we_avg * WEEKEND_RATIO_FLAG:
            add(
                "info", "pattern", "info",
                "Weekdays cost more than weekends",
                f"{fmt(wd_avg)} per weekday against {fmt(we_avg)} per weekend day — "
                f"commuting and lunches are the usual culprits.",
            )

    live_weekdays = [b for b in weekday_profile if b["days"] and b["total"] > 0]
    if len(live_weekdays) >= 3:
        priciest = max(live_weekdays, key=lambda b: b["avg"])
        add(
            "info", "pattern", "info",
            f"{priciest['label']} is your priciest day of the week",
            f"{fmt(priciest['avg'])} on an average {priciest['short']} — "
            f"{fmt(priciest['total'])} over {plural(priciest['days'], 'such day')} so far.",
        )

    # --- leaks -------------------------------------------------------------
    # A leak is small *and* frequent. A big repeated cost (rent top-up, the
    # weekly grocery run) is a recurring cost and gets a neutral mention.
    small, recurring = [], []
    for leak in leaks:
        entries = int(leak["entries"])
        total = money(leak["total"])
        avg = total / entries if entries else 0.0
        (small if spent > 0 and avg <= spent * LEAK_MAX_SHARE else recurring).append((leak, entries, total, avg))

    for leak, entries, total, avg in small[:2]:
        add(
            "warning", "leak", "leak",
            f"“{leak['label']}” × {entries} = {fmt(total)}",
            f"Just {fmt(avg)} a time in {CATEGORY_META[leak['category']]['label']}, but it adds up "
            f"to {pct(total, spent):.0f}% of the month. Small repeats are the leak kakeibo is "
            f"built to catch.",
        )
    for leak, entries, total, avg in recurring[:1]:
        add(
            "info", "leak", "info",
            f"“{leak['label']}” × {entries} = {fmt(total)}",
            f"A recurring {CATEGORY_META[leak['category']]['label']} cost at {fmt(avg)} a time — "
            f"{pct(total, spent):.0f}% of the month.",
        )

    if top_expenses:
        top = top_expenses[0]
        label = top["note"] or CATEGORY_META[top["category"]]["label"]
        add(
            "info", "pattern", "info",
            f"Largest single spend: {fmt(top['amount'])}",
            f"{label} on {day_label(date.fromisoformat(top['spent_on']))} "
            f"({CATEGORY_META[top['category']]['label']}).",
        )

    return out


def _reflection_questions(
    totals: dict[str, Any],
    categories: list[dict[str, Any]],
    insights: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """The four questions a kakeibo month closes on."""
    after_fixed = money(totals["income"] - totals["fixed_costs"])
    biggest = max(categories, key=lambda c: c["amount"])
    saved, goal = totals["actual_savings"], totals["savings_goal"]

    if goal > 0 and saved >= goal:
        savings_detail = f"{fmt(saved)} is standing — the goal is covered."
    elif goal > 0:
        savings_detail = f"{fmt(saved)} standing against it; {fmt(goal - saved)} short so far."
    else:
        savings_detail = "No goal set for this month yet."

    fixable = [i for i in insights if i["group"] in ("overspent", "leak")]
    fixable.sort(key=lambda i: i["rank"])
    if fixable:
        improve = f"{fixable[0]['title']}. {fixable[0]['detail']}"
    elif totals["spent"] == 0:
        improve = "Nothing logged yet — the answer arrives once the month has some entries."
    else:
        improve = (
            f"Nothing is running away this month. {biggest['label']} is the largest bucket at "
            f"{fmt(biggest['amount'])} ({biggest['share']:.0f}%), so that is where a further "
            f"cut would come from."
        )

    return [
        {
            "question": "How much money do I have?",
            "value": after_fixed,
            "detail": (
                f"{fmt(totals['income'])} income less {fmt(totals['fixed_costs'])} of fixed costs. "
                f"After the savings goal, {fmt(totals['available_to_spend'])} is spendable."
            ),
        },
        {
            "question": "How much would I like to save?",
            "value": goal,
            "detail": savings_detail,
        },
        {
            "question": "How much am I actually spending?",
            "value": totals["spent"],
            "detail": (
                f"{plural(totals['entries'], 'entry', 'entries')}, "
                f"{fmt(totals['avg_daily_spend'])} a day. "
                f"Biggest bucket: {biggest['label']} at {fmt(biggest['amount'])}."
            ),
        },
        {
            "question": "How can I improve?",
            "value": None,
            "detail": improve,
        },
    ]


# ------------------------------------------------------------------ outlook


def _round_down(value: float, step: int = 100) -> float:
    """Round a suggested figure down to something a person would actually set."""
    if value <= 0:
        return 0.0
    return float(int(value // step) * step)


def _outlook(
    conn: sqlite3.Connection,
    *,
    month: str,
    totals: dict[str, Any],
    categories: list[dict[str, Any]],
    history: list[dict[str, Any]],
    leaks: list[dict[str, Any]],
    days_left: int,
    days_elapsed: int,
    days_in_month: int,
    is_current_month: bool,
) -> dict[str, Any]:
    """Everything forward-looking: what the month lands at, what is left to
    spend per day under several ambitions, and what next month should be set to.
    """
    life = repo.lifetime_totals(conn)
    in_progress = month if is_current_month else None
    life_cats = repo.lifetime_category_totals(conn, exclude_month=in_progress)
    habits = repo.recurring_habits(conn)

    months_tracked = int(life["months"] or 0)
    # The divisor for "usual" excludes the month in progress, or the comparison
    # would be circular: this month would be part of its own average.
    settled_months = max(1, months_tracked - (1 if is_current_month else 0))
    lifetime_spent = money(life["spent"])

    # Averages come from *finished* months only — an in-progress one would drag
    # every average down and make the projections lie.
    past = [row for row in history if row["month"] < month]
    recent = past[-3:]
    avg_spend = div(sum(row["spent"] for row in past), len(past))
    recent_avg = div(sum(row["spent"] for row in recent), len(recent))
    avg_saved = div(sum(row["saved"] for row in past if row["income"] > 0),
                    sum(1 for row in past if row["income"] > 0))

    spent_past = [row for row in past if row["spent"] > 0]
    best = min(spent_past, key=lambda row: row["spent"]) if len(spent_past) >= 2 else None
    worst = max(spent_past, key=lambda row: row["spent"]) if len(spent_past) >= 2 else None

    income, fixed = totals["income"], totals["fixed_costs"]
    spent, available = totals["spent"], totals["available_to_spend"]
    ceiling = money(income - fixed)

    # --- what you may spend per day for the rest of the month ---------------
    limits: list[dict[str, Any]] = []

    def add_limit(key: str, label: str, budget: float, detail: str, tone: str) -> None:
        if budget <= 0:
            return
        left = money(budget - spent)
        limits.append(
            {
                "key": key,
                "label": label,
                "budget": money(budget),
                "left": left,
                "per_day": div(left, days_left) if days_left > 0 and left > 0 else 0.0,
                "per_week": money(div(left, days_left) * 7) if days_left > 0 and left > 0 else 0.0,
                "used_pct": pct(spent, budget),
                "blown": left <= 0,
                "tone": tone,
                "detail": detail,
            }
        )

    def add_unique_limit(key, label, budget, detail, tone) -> None:
        if any(abs(existing["budget"] - money(budget)) < 1 for existing in limits):
            return
        add_limit(key, label, budget, detail, tone)

    if is_current_month and days_left > 0:
        if available > 0:
            add_limit(
                "goal", "Keep the savings goal intact", available,
                f"Spending money for {month_label(month)}, after {fmt(totals['savings_goal'])} "
                f"was set aside.", "good",
            )
        if best:
            add_unique_limit(
                "best", f"Match your best month ({best['label']})", best["spent"],
                f"Your leanest finished month came in at {fmt(best['spent'])}.", "info",
            )
        if avg_spend > 0:
            add_unique_limit(
                "average", "Match your usual month", avg_spend,
                f"Your average across {plural(len(past), 'finished month')} is "
                f"{fmt(avg_spend)}.", "info",
            )
        if ceiling > 0:
            add_unique_limit(
                "ceiling", "Save nothing at all", ceiling,
                "The hard stop — everything past this is borrowed from somewhere else.",
                "critical",
            )

    # --- where the month lands, and what next month should be ---------------
    basis = days_elapsed if is_current_month else days_in_month
    reliable = basis >= FORECAST_MIN_DAYS

    # Blend the recent finished months with where this one is heading. Using
    # history alone would suggest a savings goal this month already disproves.
    basis_values = [row["spent"] for row in recent if row["spent"] > 0]
    if is_current_month and reliable and totals["projected_spend"] > 0:
        basis_values.append(totals["projected_spend"])
    expected_next = div(sum(basis_values), len(basis_values)) if basis_values else totals["spent"]
    suggested_goal = _round_down(max(0.0, income - fixed - expected_next), 500)

    projection = {
        "spend": totals["projected_spend"],
        "savings": totals["projected_savings"],
        "over": totals["projected_over"],
        "basis_days": basis,
        # Under a week of data the daily rate is mostly noise.
        "reliable": reliable,
        "next_month": shift_month(month, 1),
        "next_month_label": month_label(shift_month(month, 1)),
        "expected_spend": money(expected_next),
        "suggested_goal": suggested_goal,
        "suggested_from": (
            plural(len(basis_values), "recent month") if basis_values else None
        ),
    }

    # --- collective picture -------------------------------------------------
    per_month_cats = []
    for slot, cat in enumerate(CATEGORIES, start=1):
        total = money(life_cats.get(cat, {}).get("total", 0.0))
        per_month_cats.append(
            {
                "key": cat,
                "label": CATEGORY_META[cat]["label"],
                "slot": slot,
                "total": total,
                "avg_per_month": div(total, settled_months),
                "share": pct(total, sum(
                    life_cats.get(c, {}).get("total", 0.0) for c in CATEGORIES
                )),
                "this_month": next(c["amount"] for c in categories if c["key"] == cat),
            }
        )

    lifetime = {
        "months": months_tracked,
        "entries": int(life["entries"] or 0),
        "active_days": int(life["active_days"] or 0),
        "spent": lifetime_spent,
        "first_day": life["first_day"],
        "last_day": life["last_day"],
        "avg_monthly_spend": avg_spend,
        "recent_avg_spend": recent_avg,
        "avg_monthly_saved": avg_saved,
        "avg_daily_spend": div(lifetime_spent, int(life["active_days"] or 0)),
        "total_saved": money(sum(row["saved"] for row in past if row["income"] > 0)),
        "best_month": best,
        "worst_month": worst,
        "categories": per_month_cats,
    }

    return {
        "lifetime": lifetime,
        "limits": limits,
        "projection": projection,
        "suggestions": _suggestions(
            totals=totals,
            categories=categories,
            per_month_cats=per_month_cats,
            projection=projection,
            limits=limits,
            habits=habits,
            leaks=leaks,
            past=past,
            days_left=days_left,
            is_current_month=is_current_month,
        ),
    }


def _suggestions(
    *,
    totals: dict[str, Any],
    categories: list[dict[str, Any]],
    per_month_cats: list[dict[str, Any]],
    projection: dict[str, Any],
    limits: list[dict[str, Any]],
    habits: list[dict[str, Any]],
    leaks: list[dict[str, Any]],
    past: list[dict[str, Any]],
    days_left: int,
    is_current_month: bool,
) -> list[dict[str, Any]]:
    """Concrete, costed moves — never "spend less"."""
    out: list[dict[str, Any]] = []

    def add(tone: str, icon: str, title: str, detail: str, amount: float | None = None) -> None:
        out.append(
            {
                "tone": tone,
                "icon": icon,
                "title": title,
                "detail": detail,
                "amount": money(amount) if amount is not None else None,
                "rank": TONE_RANK[tone],
            }
        )

    # 1. the daily number that pulls a projected overspend back onto budget
    if is_current_month and days_left > 0 and projection["over"] > 0:
        goal_limit = next((l for l in limits if l["key"] == "goal"), None)
        if goal_limit and not goal_limit["blown"]:
            add(
                "serious", "clock",
                f"Hold to {fmt(goal_limit['per_day'])} a day to finish on budget",
                f"You are projected {fmt(projection['over'])} over. "
                f"{fmt(goal_limit['left'])} left across {plural(days_left, 'day')} keeps the "
                f"savings goal whole.",
                goal_limit["per_day"],
            )
        elif goal_limit:
            add(
                "critical", "warn",
                "The budget is already spent",
                f"{plural(days_left, 'day')} still to go. Every further rupee comes out of "
                f"savings — the next realistic target is next month.",
            )

    # 2. categories running above their own long-run average
    for cat in sorted(per_month_cats, key=lambda c: c["this_month"] - c["avg_per_month"], reverse=True):
        gap = money(cat["this_month"] - cat["avg_per_month"])
        if cat["key"] == "culture" or cat["avg_per_month"] <= 0 or gap <= 0:
            continue
        if gap < cat["avg_per_month"] * 0.15:
            continue
        add(
            "warning", "up",
            f"{cat['label']} is {fmt(gap)} above its usual",
            f"{fmt(cat['this_month'])} this month against a {fmt(cat['avg_per_month'])} average. "
            f"Bringing it back to normal frees {fmt(gap)}.",
            gap,
        )
        break

    # 3. a habit worth pricing per month
    monthly_yardstick = max(
        totals["spent"], next((c["avg_per_month"] for c in per_month_cats), 0), 1
    )
    for habit in habits:
        months = int(habit["months"]) or 1
        entries = int(habit["entries"]) or 1
        per_month = money(float(habit["total"]) / months)
        per_time = float(habit["total"]) / entries
        # Small and frequent is a habit; large and repeated is just a bill.
        if per_month <= 0 or per_time > monthly_yardstick * HABIT_MAX_SHARE:
            continue
        add(
            "info", "leak",
            f"“{habit['label']}” costs about {fmt(per_month)} a month",
            f"{plural(int(habit['entries']), 'entry', 'entries')} across "
            f"{plural(months, 'month')} in {CATEGORY_META[habit['category']]['label']}. "
            f"Halving it would add {fmt(per_month / 2)} a month to savings.",
            per_month,
        )
        break

    # 4. an unexpected-costs buffer, sized from what actually happened
    unexpected = next((c for c in per_month_cats if c["key"] == "unexpected"), None)
    if unexpected and unexpected["avg_per_month"] > 0 and len(past) >= 2:
        add(
            "info", "info",
            f"Budget {fmt(unexpected['avg_per_month'])} a month for surprises",
            "Unexpected costs are not really unexpected once you have a few months of them. "
            "Treating that as a fixed cost stops them eating spending money meant for "
            "something else.",
            unexpected["avg_per_month"],
        )

    # 5. next month's savings goal, from what you have actually managed
    if projection["suggested_goal"] > 0:
        add(
            "good", "target",
            f"Set {projection['next_month_label']}'s savings goal to {fmt(projection['suggested_goal'])}",
            f"You are spending about {fmt(projection['expected_spend'])} a month"
            + (f", judged on your {projection['suggested_from']}" if projection["suggested_from"] else "")
            + ". That leaves this much to put aside without changing anything else.",
            projection["suggested_goal"],
        )

    # 6. a run of good months earns a harder target
    kept = [row for row in past[-3:] if row["available"] > 0 and row["spent"] <= row["available"]]
    if len(kept) >= 3 and totals["savings_goal"] > 0:
        headroom = money(min(row["available"] - row["spent"] for row in kept))
        if headroom > 0:
            add(
                "good", "star",
                "Three months inside budget — you have room to save more",
                f"The tightest of those three still finished {fmt(headroom)} under. Raising the "
                f"goal by that much would have held every time.",
                headroom,
            )

    out.sort(key=lambda item: item["rank"])
    return out
