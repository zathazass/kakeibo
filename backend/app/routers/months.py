"""Monthly plan: income, fixed costs, savings goal, and the closing reflection."""
from __future__ import annotations

import sqlite3
from typing import Any

from fastapi import APIRouter, Depends

from .. import repository as repo
from ..db import get_db
from ..models import MonthPlanIn, MonthPlanOut
from .dashboard import validate_month

router = APIRouter(prefix="/api/months", tags=["months"])


@router.get("/{month}/plan", response_model=MonthPlanOut)
def get_plan(month: str, db: sqlite3.Connection = Depends(get_db)) -> dict[str, Any]:
    return repo.get_plan(db, validate_month(month))


@router.put("/{month}/plan", response_model=MonthPlanOut)
def put_plan(
    month: str, payload: MonthPlanIn, db: sqlite3.Connection = Depends(get_db)
) -> dict[str, Any]:
    return repo.upsert_plan(db, validate_month(month), payload)
