from datetime import UTC, date, datetime

from beanie import PydanticObjectId
from beanie.operators import In

from app.models.expense import Expense
from app.schemas.expense import (
    CategorySummaryItem,
    ExpenseCreate,
    ExpenseListResponse,
    ExpenseMonthlySummaryResponse,
    ExpenseResponse,
    ExpenseSummaryResponse,
    ImportBatchRowError,
    MonthlySummaryItem,
)
from app.services.category_service import find_category_ci
from app.services.payment_method_service import find_payment_method_ci


class UnknownCategoryError(Exception):
    def __init__(self, category: str) -> None:
        self.category = category
        super().__init__(f"unknown category: '{category}'")


class UnknownPaymentMethodError(Exception):
    def __init__(self, payment_method: str) -> None:
        self.payment_method = payment_method
        super().__init__(f"unknown payment method: '{payment_method}'")


class ExpenseNotFoundError(Exception):
    def __init__(self, expense_id: str) -> None:
        self.expense_id = expense_id
        super().__init__(f"expense not found: '{expense_id}'")


class ImportBatchValidationError(Exception):
    def __init__(self, row_errors: list[ImportBatchRowError]) -> None:
        self.row_errors = row_errors
        super().__init__("import batch validation failed")


def _to_response(expense: Expense) -> ExpenseResponse:
    return ExpenseResponse(
        id=str(expense.id),
        date=expense.date,
        title=expense.title,
        value=expense.value,
        category=expense.category,
        payment_method=expense.payment_method,
        details=expense.details,
        trip=expense.trip,
        created_at=expense.created_at,
        updated_at=expense.updated_at,
    )


async def create_expense(data: ExpenseCreate) -> ExpenseResponse:
    if await find_category_ci(data.category) is None:
        raise UnknownCategoryError(data.category)
    if await find_payment_method_ci(data.payment_method) is None:
        raise UnknownPaymentMethodError(data.payment_method)

    now = datetime.now(UTC)
    expense = Expense(**data.model_dump(), created_at=now, updated_at=now)
    await expense.insert()
    return _to_response(expense)


async def _get_or_raise(expense_id: str) -> Expense:
    try:
        expense = await Expense.get(PydanticObjectId(expense_id))
    except Exception as exc:  # invalid ObjectId format, e.g. "abc"
        raise ExpenseNotFoundError(expense_id) from exc

    if expense is None:
        raise ExpenseNotFoundError(expense_id)
    return expense


async def update_expense(expense_id: str, data: ExpenseCreate) -> ExpenseResponse:
    expense = await _get_or_raise(expense_id)

    if await find_category_ci(data.category) is None:
        raise UnknownCategoryError(data.category)
    if await find_payment_method_ci(data.payment_method) is None:
        raise UnknownPaymentMethodError(data.payment_method)

    for field, value in data.model_dump().items():
        setattr(expense, field, value)
    expense.updated_at = datetime.now(UTC)
    await expense.save()
    return _to_response(expense)


async def delete_expense(expense_id: str) -> None:
    expense = await _get_or_raise(expense_id)
    await expense.delete()


async def create_expenses_batch(items: list[ExpenseCreate]) -> list[ExpenseResponse]:
    """All-or-nothing: every item's category is validated before any insert
    happens, and every failure is collected (not just the first) so the
    caller can report which table rows need fixing."""
    row_errors: list[ImportBatchRowError] = []
    for index, item in enumerate(items):
        errors = []
        if await find_category_ci(item.category) is None:
            errors.append(f"unknown category: '{item.category}'")
        if await find_payment_method_ci(item.payment_method) is None:
            errors.append(f"unknown payment method: '{item.payment_method}'")
        if errors:
            row_errors.append(ImportBatchRowError(index=index, errors=errors))

    if row_errors:
        raise ImportBatchValidationError(row_errors)

    now = datetime.now(UTC)
    docs = [Expense(**item.model_dump(), created_at=now, updated_at=now) for item in items]
    result = await Expense.insert_many(docs)
    # insert_many (unlike single .insert()) returns a pymongo InsertManyResult
    # and does not mutate the Document objects with their new ids -- do that
    # ourselves so the response reflects real ids, not None.
    for doc, inserted_id in zip(docs, result.inserted_ids, strict=True):
        doc.id = inserted_id
    return [_to_response(doc) for doc in docs]


async def find_duplicate_keys(
    candidates: list[tuple[date, str, float]],
) -> set[tuple[date, str, float]]:
    """Given candidate (date, title, value) triples -- typically freshly
    parsed CSV rows -- returns the subset that already exist as a persisted
    Expense with the same date, the same value, and a title that matches
    case-insensitively. Used to pre-flag likely re-imports of a bill the
    user already entered."""
    if not candidates:
        return set()

    dates = {candidate[0] for candidate in candidates}
    existing = await Expense.find(In(Expense.date, list(dates))).to_list()
    existing_keys = {(item.date, item.title.strip().lower(), item.value) for item in existing}

    return {
        candidate
        for candidate in candidates
        if (candidate[0], candidate[1].strip().lower(), candidate[2]) in existing_keys
    }


async def list_expenses(
    *,
    date_from: date | None,
    date_to: date | None,
    category: str | None,
    trip: str | None,
    skip: int,
    limit: int,
) -> ExpenseListResponse:
    query_filters = []
    if date_from is not None:
        query_filters.append(Expense.date >= date_from)
    if date_to is not None:
        query_filters.append(Expense.date <= date_to)
    if category is not None:
        query_filters.append(Expense.category == category)
    if trip is not None:
        query_filters.append(Expense.trip == trip)

    query = Expense.find(*query_filters)
    total = await query.count()
    items = await query.sort(-Expense.date).skip(skip).limit(limit).to_list()
    return ExpenseListResponse(items=[_to_response(item) for item in items], total=total)


async def get_category_summary(
    *,
    date_from: date | None,
    date_to: date | None,
) -> ExpenseSummaryResponse:
    """Per-category totals for a date range, unpaginated -- backs the
    Reports view (spec 06). Unlike `list_expenses`, this runs a real
    server-side aggregation rather than a capped client-side sum, since a
    report is exactly the case a fixed row limit doesn't fit."""
    query_filters = []
    if date_from is not None:
        query_filters.append(Expense.date >= date_from)
    if date_to is not None:
        query_filters.append(Expense.date <= date_to)

    pipeline = [
        {"$group": {"_id": "$category", "total": {"$sum": "$value"}, "count": {"$sum": 1}}},
        {"$project": {"_id": 0, "category": "$_id", "total": 1, "count": 1}},
        {"$sort": {"total": -1}},
    ]
    items = (
        await Expense.find(*query_filters)
        .aggregate(pipeline, projection_model=CategorySummaryItem)
        .to_list()
    )
    return ExpenseSummaryResponse(items=items)


async def get_monthly_summary(
    *,
    date_from: date | None,
    date_to: date | None,
) -> ExpenseMonthlySummaryResponse:
    """Per-(year, month, category) totals for a date range, unpaginated --
    backs the Reports view's "By month" mode (spec 07). Category is kept in
    the grouping (rather than collapsing straight to per-month totals) so
    the frontend can filter by the selected category set client-side, same
    as `get_category_summary`."""
    query_filters = []
    if date_from is not None:
        query_filters.append(Expense.date >= date_from)
    if date_to is not None:
        query_filters.append(Expense.date <= date_to)

    pipeline = [
        {
            "$group": {
                "_id": {
                    "year": {"$year": "$date"},
                    "month": {"$month": "$date"},
                    "category": "$category",
                },
                "total": {"$sum": "$value"},
                "count": {"$sum": 1},
            }
        },
        {
            "$project": {
                "_id": 0,
                "year": "$_id.year",
                "month": "$_id.month",
                "category": "$_id.category",
                "total": 1,
                "count": 1,
            }
        },
        {"$sort": {"year": 1, "month": 1, "total": -1}},
    ]
    items = (
        await Expense.find(*query_filters)
        .aggregate(pipeline, projection_model=MonthlySummaryItem)
        .to_list()
    )
    return ExpenseMonthlySummaryResponse(items=items)
