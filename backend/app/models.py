"""Request/response shapes and the four kakeibo categories."""
from __future__ import annotations

from datetime import date
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

Category = Literal["needs", "wants", "culture", "unexpected"]

CATEGORIES: tuple[Category, ...] = ("needs", "wants", "culture", "unexpected")

# Kakeibo's four buckets. The split is by *intent*, not by merchant — the same
# coffee is a Need or a Want depending on why it was bought.
CATEGORY_META: dict[str, dict[str, str]] = {
    "needs": {
        "label": "Needs",
        "jp": "必要",
        "hint": "Survival: groceries, transport, rent top-ups, medicine, bills.",
    },
    "wants": {
        "label": "Wants",
        "jp": "欲求",
        "hint": "Optional pleasure: eating out, shopping, treats, entertainment.",
    },
    "culture": {
        "label": "Culture",
        "jp": "文化",
        "hint": "Self-enrichment: books, courses, museums, music, temple visits.",
    },
    "unexpected": {
        "label": "Unexpected",
        "jp": "予期せぬ",
        "hint": "Surprises: repairs, medical bills, gifts, fines.",
    },
}


# Suggestions only — the field is free text, and anything you type is kept.
TAG_SUGGESTIONS: dict[str, list[str]] = {
    "needs": [
        "Groceries", "Vegetables", "Milk & dairy", "Transport", "Fuel",
        "Rent", "Utilities", "Phone & internet", "Medicine", "Healthcare",
        "Household", "Childcare", "Insurance",
    ],
    "wants": [
        "Dining out", "Snacks", "Coffee & tea", "Gadgets", "Clothing",
        "Entertainment", "Subscriptions", "Travel", "Hobbies", "Beauty",
        "Takeaway",
    ],
    "culture": [
        "Books", "Courses", "Music", "Museums", "Temple & offerings",
        "Newspapers", "Software & tools",
    ],
    "unexpected": [
        "Repairs", "Medical", "Gifts", "Fines", "Donations", "Travel emergency",
    ],
}


AccountKind = Literal["savings", "spending", "salary", "credit"]

ACCOUNT_KINDS: dict[str, dict[str, str]] = {
    "savings": {
        "label": "Savings",
        "hint": "Money set aside. Kakeibo's savings goal should end up here.",
    },
    "spending": {
        "label": "Spending",
        "hint": "The everyday account most entries are paid from.",
    },
    "salary": {
        "label": "Salary & investments",
        "hint": "Where income lands, and where SIPs and other standing debits go out from.",
    },
    "credit": {
        "label": "Credit card",
        "hint": "Charged now, paid later. The spend still counts on the day you made it.",
    },
}


def _round_money(value: float) -> float:
    return round(float(value), 2)


class ExpenseIn(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    spent_on: date
    category: Category
    amount: float = Field(gt=0, le=1_000_000_000)
    note: str = Field(default="", max_length=200)
    tag: str = Field(default="", max_length=60)
    account_id: int | None = None

    @field_validator("amount")
    @classmethod
    def _money(cls, v: float) -> float:
        return _round_money(v)


class ExpenseOut(BaseModel):
    id: int
    spent_on: str
    category: Category
    amount: float
    note: str
    tag: str = ""
    account_id: int | None = None
    settled_on: str = ""
    created_at: str


class MonthPlanIn(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    income: float = Field(default=0, ge=0, le=1_000_000_000)
    fixed_costs: float = Field(default=0, ge=0, le=1_000_000_000)
    savings_goal: float = Field(default=0, ge=0, le=1_000_000_000)
    reflection: str = Field(default="", max_length=4000)

    @field_validator("income", "fixed_costs", "savings_goal")
    @classmethod
    def _money(cls, v: float) -> float:
        return _round_money(v)


class MonthPlanOut(BaseModel):
    month: str
    income: float
    fixed_costs: float
    savings_goal: float
    reflection: str


class AccountIn(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    name: str = Field(min_length=1, max_length=60)
    bank: str = Field(default="", max_length=60)
    kind: AccountKind
    credit_limit: float = Field(default=0, ge=0, le=1_000_000_000)
    note: str = Field(default="", max_length=200)
    archived: bool = False

    @field_validator("credit_limit")
    @classmethod
    def _money(cls, v: float) -> float:
        return _round_money(v)


class AccountOut(BaseModel):
    id: int
    name: str
    bank: str
    kind: AccountKind
    credit_limit: float
    note: str
    archived: int
