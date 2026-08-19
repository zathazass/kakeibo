"""Cross-period comparison: month, quarter, half-year, year."""
from __future__ import annotations

import sqlite3
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query

from .. import periods, repository as repo
from ..db import get_db
from ..models import TAG_SUGGESTIONS

router = APIRouter(prefix="/api", tags=["compare"])


@router.get("/compare")
def compare(
    grain: str = Query(default="month", description="month | quarter | half | year"),
    db: sqlite3.Connection = Depends(get_db),
) -> dict[str, Any]:
    if grain not in periods.GRAIN_KEYS:
        raise HTTPException(
            status_code=422,
            detail=f"grain must be one of: {', '.join(sorted(periods.GRAIN_KEYS))}",
        )
    return periods.build_comparison(db, grain)


@router.get("/tags")
def tags(db: sqlite3.Connection = Depends(get_db)) -> dict[str, Any]:
    """Suggestions plus every tag already invented, for the entry form."""
    return {"suggestions": TAG_SUGGESTIONS, "used": repo.known_tags(db)}
