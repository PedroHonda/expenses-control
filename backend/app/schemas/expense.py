# Imported as a module, not `from datetime import date`: a field literally
# named `date` with a default value (see ParsedExpenseRow below) would shadow
# a bare `date` import inside its own class body -- the `= None` assignment
# binds the class attribute before the `date | None` annotation is resolved,
# so a bare `date` in the annotation would resolve to that attribute, not the
# type. Qualifying as `dt.date` sidesteps the collision entirely.
import datetime as dt

from pydantic import BaseModel, Field


class ExpenseCreate(BaseModel):
    date: dt.date
    title: str = Field(min_length=1, max_length=200)
    value: float = Field(gt=0)
    category: str
    details: str | None = Field(default=None, max_length=1000)
    trip: str | None = Field(default=None, max_length=100)


class ExpenseResponse(ExpenseCreate):
    id: str
    created_at: dt.datetime
    updated_at: dt.datetime


class ExpenseListResponse(BaseModel):
    items: list[ExpenseResponse]
    total: int


class ParsedExpenseRow(BaseModel):
    """One row from an uploaded CSV, parsed but not yet persisted.

    Every field but `row_index` is optional: at parse time we don't know
    yet whether the row is complete enough to become a real Expense.
    """

    row_index: int
    date: dt.date | None = None
    title: str | None = None
    value: float | None = None
    category: str | None = None
    details: str | None = None
    trip: str | None = None
    missing_required: list[str] = Field(default_factory=list)
    parse_errors: list[str] = Field(default_factory=list)
    raw: dict[str, str] = Field(default_factory=dict)


class CSVParseResponse(BaseModel):
    filename: str
    detected_columns: list[str]
    unmapped_columns: list[str]
    rows: list[ParsedExpenseRow]


class ImportBatchRequest(BaseModel):
    expenses: list[ExpenseCreate] = Field(min_length=1)


class ImportBatchRowError(BaseModel):
    index: int
    errors: list[str]


class ImportBatchResponse(BaseModel):
    created: list[ExpenseResponse]
    count: int
