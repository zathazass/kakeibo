"""Monthly allocations by bucket and by label."""
from __future__ import annotations

import sqlite3
from datetime import date
from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict, Field

from .. import analytics, budgets, repository as repo
from ..db import get_db
from .dashboard import validate_month

router = APIRouter(prefix="/api/months", tags=["budget"])


class BudgetIn(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    categories: dict[str, float] = Field(default_factory=dict)
    tags: dict[str, float] = Field(default_factory=dict)


def _view(conn: sqlite3.Connection, month: str) -> dict[str, Any]:
    first, last = analytics.month_bounds(month)
    today = date.today()
    is_current = (today.year, today.month) == (first.year, first.month)
    days_elapsed = today.day if is_current else (last.day if last < today else 0)

    plan = repo.get_plan(conn, month)
    available = plan["income"] - plan["fixed_costs"] - plan["savings_goal"]
    spend = {
        key: row["total"] for key, row in repo.month_category_totals(conn, month).items()
    }

    return budgets.build_budget(
        conn,
        month=month,
        available=available,
        category_spend=spend,
        days_elapsed=days_elapsed,
        days_in_month=last.day,
        is_current_month=is_current,
    )


@router.get("/{month}/budget")
def get_budget(month: str, db: sqlite3.Connection = Depends(get_db)) -> dict[str, Any]:
    return _view(db, validate_month(month))


@router.put("/{month}/budget")
def put_budget(
    month: str, payload: BudgetIn, db: sqlite3.Connection = Depends(get_db)
) -> dict[str, Any]:
    checked = validate_month(month)
    budgets.save_budget(db, checked, payload.categories, payload.tags)
    return _view(db, checked)
