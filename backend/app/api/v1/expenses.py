from datetime import date

from fastapi import APIRouter, File, HTTPException, Query, UploadFile, status

from app.schemas.expense import (
    CSVParseResponse,
    ExpenseCreate,
    ExpenseListResponse,
    ExpenseMonthlySummaryResponse,
    ExpenseResponse,
    ExpenseSummaryResponse,
    ImportBatchRequest,
    ImportBatchResponse,
)
from app.services import csv_parser, expense_service

router = APIRouter(prefix="/expenses", tags=["expenses"])

MAX_CSV_SIZE_BYTES = 5 * 1024 * 1024


@router.post("/", response_model=ExpenseResponse, status_code=status.HTTP_201_CREATED)
async def create_expense(payload: ExpenseCreate) -> ExpenseResponse:
    try:
        return await expense_service.create_expense(payload)
    except expense_service.UnknownCategoryError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=str(exc)
        ) from exc


@router.post("/upload-csv", response_model=CSVParseResponse)
async def upload_csv(file: UploadFile = File(...)) -> CSVParseResponse:
    """Stage 1 of CSV import: parse only, no persistence. See spec §4.2."""
    if not (file.filename or "").lower().endswith(".csv"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="only .csv files are accepted"
        )

    content = await file.read()
    if len(content) > MAX_CSV_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="file exceeds 5MB limit"
        )

    try:
        parsed = csv_parser.parse_csv(content, filename=file.filename or "upload.csv")
    except csv_parser.CsvParseError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    candidates = [
        (row.date, row.title, row.value)
        for row in parsed.rows
        if row.date is not None and row.title is not None and row.value is not None
    ]
    duplicate_keys = await expense_service.find_duplicate_keys(candidates)
    for row in parsed.rows:
        if row.date is not None and row.title is not None and row.value is not None:
            row.is_duplicate = (row.date, row.title, row.value) in duplicate_keys

    return parsed


@router.post(
    "/import-batch", response_model=ImportBatchResponse, status_code=status.HTTP_201_CREATED
)
async def import_batch(payload: ImportBatchRequest) -> ImportBatchResponse:
    """Stage 2 of CSV import: validate + persist the batch the user completed
    in the review table. See spec §4.3."""
    try:
        created = await expense_service.create_expenses_batch(payload.expenses)
    except expense_service.ImportBatchValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=[row_error.model_dump() for row_error in exc.row_errors],
        ) from exc
    return ImportBatchResponse(created=created, count=len(created))


@router.get("/summary", response_model=ExpenseSummaryResponse)
async def get_expense_summary(
    date_from: date | None = None,
    date_to: date | None = None,
) -> ExpenseSummaryResponse:
    """Unpaginated per-category totals for a date range. Backs the Reports
    view (spec 06) -- see `expense_service.get_category_summary` for why
    this is a real aggregation rather than reusing `list_expenses`."""
    return await expense_service.get_category_summary(date_from=date_from, date_to=date_to)


@router.get("/summary-by-month", response_model=ExpenseMonthlySummaryResponse)
async def get_expense_monthly_summary(
    date_from: date | None = None,
    date_to: date | None = None,
) -> ExpenseMonthlySummaryResponse:
    """Unpaginated per-(year, month, category) totals for a date range.
    Backs the Reports view's "By month" mode (spec 07) -- see
    `expense_service.get_monthly_summary`."""
    return await expense_service.get_monthly_summary(date_from=date_from, date_to=date_to)


@router.put("/{expense_id}", response_model=ExpenseResponse)
async def update_expense(expense_id: str, payload: ExpenseCreate) -> ExpenseResponse:
    try:
        return await expense_service.update_expense(expense_id, payload)
    except expense_service.ExpenseNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except expense_service.UnknownCategoryError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=str(exc)
        ) from exc


@router.delete("/{expense_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_expense(expense_id: str) -> None:
    try:
        await expense_service.delete_expense(expense_id)
    except expense_service.ExpenseNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.get("/", response_model=ExpenseListResponse)
async def list_expenses(
    date_from: date | None = None,
    date_to: date | None = None,
    category: str | None = None,
    trip: str | None = None,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
) -> ExpenseListResponse:
    return await expense_service.list_expenses(
        date_from=date_from,
        date_to=date_to,
        category=category,
        trip=trip,
        skip=skip,
        limit=limit,
    )
