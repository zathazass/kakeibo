"""The single endpoint the screen is built from."""
from __future__ import annotations

import re
import sqlite3
from datetime import date
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query

from .. import analytics, repository as repo
from ..db import get_db

router = APIRouter(prefix="/api", tags=["dashboard"])

MONTH_RE = re.compile(r"^\d{4}-(0[1-9]|1[0-2])$")


def validate_month(month: str | None) -> str:
    if not month:
        return analytics.month_of(date.today())
    if not MONTH_RE.match(month):
        raise HTTPException(status_code=422, detail="month must look like YYYY-MM")
    return month


@router.get("/dashboard")
def get_dashboard(
    month: str | None = Query(default=None, description="YYYY-MM; defaults to this month"),
    db: sqlite3.Connection = Depends(get_db),
) -> dict[str, Any]:
    return analytics.build_dashboard(db, validate_month(month), date.today())


@router.get("/months")
def get_months(db: sqlite3.Connection = Depends(get_db)) -> dict[str, Any]:
    """Months that already hold data, plus this one, for the picker."""
    months = repo.known_months(db)
    current = analytics.month_of(date.today())
    if current not in months:
        months.append(current)
    months = sorted(set(months), reverse=True)
    return {
        "current": current,
        "months": [
            {"month": m, "label": analytics.month_label(m), "short": analytics.short_month_label(m)}
            for m in months
        ],
    }
