"""Request and response schemas.

Every field a client can send is bounded here. Validation is the cheapest
place to stop malformed or hostile input, and it happens before any value
reaches an upstream URL or the database.
"""

from __future__ import annotations

from datetime import date
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, field_validator

Symbol = Annotated[str, Field(min_length=2, max_length=12, pattern=r"^[A-Za-z0-9]+$")]
CoinId = Annotated[str, Field(min_length=1, max_length=80, pattern=r"^[a-z0-9\-]+$")]


class AddHoldingRequest(BaseModel):
    # Reject unknown keys outright - notably `user_id`, which a client must
    # never be able to influence.
    model_config = ConfigDict(extra="forbid")

    symbol: Symbol
    name: str = Field(min_length=1, max_length=120)
    coin_id: CoinId
    amount: float = Field(gt=0, le=1e15)
    avg_price: float = Field(ge=0, le=1e12)
    purchase_date: date | None = None
    notes: str | None = Field(default=None, max_length=500)

    @field_validator("symbol")
    @classmethod
    def _upper(cls, value: str) -> str:
        return value.upper()

    @field_validator("name", "notes")
    @classmethod
    def _strip(cls, value: str | None) -> str | None:
        return value.strip() if value else value


class HoldingEntry(BaseModel):
    id: str
    symbol: str
    quantity: float
    price_used: float
    total_cost: float
    purchase_date: date | None = None
    notes: str | None = None
    name: str | None = None
    coin_id: str | None = None


class AggregatedHolding(BaseModel):
    symbol: str
    name: str | None = None
    coin_id: str
    total_quantity: float
    average_buy_price: float
    total_invested: float
    current_price: float
    current_value: float
    profit_or_loss: float
    profit_or_loss_percentage: float
    priced: bool
    entries: list[HoldingEntry]


class PortfolioSummary(BaseModel):
    total_portfolio_value: float
    total_invested: float
    total_profit_or_loss: float
    total_profit_or_loss_percentage: float
    holdings: list[AggregatedHolding]


class Identity(BaseModel):
    """What the server believes about the caller, after verification."""

    user_id: str
    email: str | None = None
    session_id: str | None = None


class Deleted(BaseModel):
    deleted: bool
