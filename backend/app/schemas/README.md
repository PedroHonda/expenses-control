# `app/schemas/`

## Responsibility
Pydantic DTOs (data transfer objects) that define the HTTP request/response shapes for the API, exactly as specified in `.github/specs/01_api_contract.spec.md` §3. These are **not** the same classes as `app/models/` — a request/response shape and a database document are different concerns that happen to overlap in fields.

## Files
- **`expense.py`** — `ExpenseCreate` (input), `ExpenseResponse` (output, extends `ExpenseCreate` with server-set `id`/`created_at`/`updated_at`), `ExpenseListResponse` (paginated list), `CategorySummaryItem`/`ExpenseSummaryResponse` (output of `GET /expenses/summary` — per-category `total`/`count` for a date range, see `.github/specs/06_category_reports.spec.md`), and the CSV-import-specific shapes: `ParsedExpenseRow` (stage 1 — every field optional, since a parsed row may be incomplete; `is_duplicate` defaults `False` and is only set by the `upload-csv` route after parsing, since the parser itself has no database access), `CSVParseResponse`, `ImportBatchRequest`/`ImportBatchRowError`/`ImportBatchResponse` (stage 2).
- **`category.py`** — `CategoryCreate` (input), `CategoryUpdate` (input for `PATCH /categories/{id}` — currently just `exclude_from_total`), `CategoryResponse` (output, includes `exclude_from_total`).

## Why DTOs are separate from `app/models/` Documents
`ExpenseCreate` intentionally has no `id` field — a client must never be able to set its own primary key on create. `ExpenseResponse` adds it back because the *server* assigns it. If we reused the `Expense` Document class directly as the request body, FastAPI would happily accept a client-supplied `id`/`created_at` and silently overwrite the real ones — bugs like that are exactly what a boundary type at the API layer prevents. It also means the database schema (models) and the public API contract (schemas) can evolve independently: renaming an internal DB field doesn't have to break the API, and vice versa.
