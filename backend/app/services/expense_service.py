from datetime import UTC, date, datetime

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
