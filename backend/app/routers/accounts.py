"""Bank accounts and cards, and settling what a card owes."""
from __future__ import annotations

import sqlite3
from datetime import date
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel, Field

from .. import accounts as accounts_view, analytics, repository as repo
from ..db import get_db
from ..models import AccountIn, AccountOut

router = APIRouter(prefix="/api/accounts", tags=["accounts"])


class SettleIn(BaseModel):
    up_to: date | None = Field(default=None, description="Settle charges on or before this day")
    paid_on: date | None = Field(default=None, description="When you actually paid the bill")


@router.get("")
def view(month: str | None = None, db: sqlite3.Connection = Depends(get_db)) -> dict[str, Any]:
    target = month or analytics.month_of(date.today())
    return accounts_view.build_accounts(db, target)


@router.post("", response_model=AccountOut, status_code=status.HTTP_201_CREATED)
def create(payload: AccountIn, db: sqlite3.Connection = Depends(get_db)) -> dict[str, Any]:
    try:
        return repo.create_account(db, payload)
    except sqlite3.IntegrityError as exc:
        raise HTTPException(
            status_code=409, detail=f"An account named “{payload.name}” already exists"
        ) from exc


@router.put("/{account_id}", response_model=AccountOut)
def update(
    account_id: int, payload: AccountIn, db: sqlite3.Connection = Depends(get_db)
) -> dict[str, Any]:
    try:
        updated = repo.update_account(db, account_id, payload)
    except sqlite3.IntegrityError as exc:
        raise HTTPException(
            status_code=409, detail=f"An account named “{payload.name}” already exists"
        ) from exc
    if updated is None:
        raise HTTPException(status_code=404, detail="account not found")
    return updated


@router.delete("/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove(account_id: int, db: sqlite3.Connection = Depends(get_db)) -> Response:
    if not repo.delete_account(db, account_id):
        raise HTTPException(status_code=404, detail="account not found")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{account_id}/unsettled")
def unsettled(account_id: int, db: sqlite3.Connection = Depends(get_db)) -> list[dict[str, Any]]:
    if repo.get_account(db, account_id) is None:
        raise HTTPException(status_code=404, detail="account not found")
    return repo.unsettled_charges(db, account_id)


@router.post("/{account_id}/settle")
def settle(
    account_id: int, payload: SettleIn, db: sqlite3.Connection = Depends(get_db)
) -> dict[str, Any]:
    """Clear a card's debt.

    Deliberately does not create an expense: the spending was recorded on the
    day it happened, so charging it again when the bill is paid would count the
    same money twice.
    """
    account = repo.get_account(db, account_id)
    if account is None:
        raise HTTPException(status_code=404, detail="account not found")
    if account["kind"] != "credit":
        raise HTTPException(status_code=422, detail="only a credit card has charges to settle")

    today = date.today()
    up_to = (payload.up_to or today).isoformat()
    paid_on = (payload.paid_on or today).isoformat()
    cleared = repo.settle_charges(db, account_id, up_to, paid_on)
    return {
        "settled": cleared,
        "up_to": up_to,
        "paid_on": paid_on,
        "note": "Settling clears the debt only — the spending was already counted "
        "on the day you made it.",
    }
