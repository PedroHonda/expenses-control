from datetime import UTC, date, datetime

from beanie import PydanticObjectId
from beanie.operators import In

from app.models.expense import Expense
from app.schemas.expense import (
    ExpenseCreate,
    ExpenseListResponse,
    ExpenseResponse,
    ImportBatchRowError,
)
from app.services.category_service import find_category_ci


class UnknownCategoryError(Exception):
    def __init__(self, category: str) -> None:
        self.category = category
        super().__init__(f"unknown category: '{category}'")


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
        details=expense.details,
        trip=expense.trip,
        created_at=expense.created_at,
        updated_at=expense.updated_at,
    )


async def create_expense(data: ExpenseCreate) -> ExpenseResponse:
    if await find_category_ci(data.category) is None:
        raise UnknownCategoryError(data.category)

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
        if await find_category_ci(item.category) is None:
            row_errors.append(
                ImportBatchRowError(index=index, errors=[f"unknown category: '{item.category}'"])
            )

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
