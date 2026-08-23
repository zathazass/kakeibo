"""Earned moments."""
from __future__ import annotations

import sqlite3
from datetime import date
from typing import Any

from fastapi import APIRouter, Depends
from .. import analytics, rewards
from ..db import get_db

router = APIRouter(prefix="/api/rewards", tags=["rewards"])



@router.get("")
def view(month: str | None = None, db: sqlite3.Connection = Depends(get_db)) -> dict[str, Any]:
    today = date.today()
    return rewards.evaluate(db, month or analytics.month_of(today), today)
