# Imported as a module (see app/schemas/expense.py for why): keeps `dt.date`/
# `dt.datetime` unambiguous even though this class also has a field named `date`.
import datetime as dt

from beanie import Document
from pydantic import Field


class Expense(Document):
    date: dt.date
    title: str
    value: float
    category: str
    details: str | None = None
    trip: str | None = None
    created_at: dt.datetime = Field(default_factory=lambda: dt.datetime.now(dt.UTC))
    updated_at: dt.datetime = Field(default_factory=lambda: dt.datetime.now(dt.UTC))

    class Settings:
        name = "expenses"
        indexes = ["date", "category", "trip"]
