"""Create, edit and delete ledger entries."""
from __future__ import annotations

import sqlite3
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status

from .. import analytics, repository as repo
from ..db import get_db
from ..models import ExpenseIn, ExpenseOut
from .dashboard import validate_month

router = APIRouter(prefix="/api/expenses", tags=["expenses"])


@router.get("", response_model=list[ExpenseOut])
def list_expenses(
    month: str | None = Query(default=None),
    db: sqlite3.Connection = Depends(get_db),
) -> list[dict[str, Any]]:
    first, last = analytics.month_bounds(validate_month(month))
    return repo.list_expenses(db, first.isoformat(), last.isoformat())


@router.post("", response_model=ExpenseOut, status_code=status.HTTP_201_CREATED)
def create_expense(
    payload: ExpenseIn, db: sqlite3.Connection = Depends(get_db)
) -> dict[str, Any]:
    return repo.create_expense(db, payload)


@router.put("/{expense_id}", response_model=ExpenseOut)
def update_expense(
    expense_id: int, payload: ExpenseIn, db: sqlite3.Connection = Depends(get_db)
) -> dict[str, Any]:
    updated = repo.update_expense(db, expense_id, payload)
    if updated is None:
        raise HTTPException(status_code=404, detail="expense not found")
    return updated


@router.delete("/{expense_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_expense(expense_id: int, db: sqlite3.Connection = Depends(get_db)) -> Response:
    if not repo.delete_expense(db, expense_id):
        raise HTTPException(status_code=404, detail="expense not found")
    return Response(status_code=status.HTTP_204_NO_CONTENT)
