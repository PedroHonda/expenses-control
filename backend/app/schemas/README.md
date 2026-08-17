# `app/schemas/`

## Responsibility
Pydantic DTOs (data transfer objects) that define the HTTP request/response shapes for the API, exactly as specified in `.github/specs/01_api_contract.spec.md` §3. These are **not** the same classes as `app/models/` — a request/response shape and a database document are different concerns that happen to overlap in fields.

## Files
- **`expense.py`** — `ExpenseCreate` (input), `ExpenseResponse` (output, extends `ExpenseCreate` with server-set `id`/`created_at`/`updated_at`), `ExpenseListResponse` (paginated list), and the CSV-import-specific shapes: `ParsedExpenseRow` (stage 1 — every field optional, since a parsed row may be incomplete), `CSVParseResponse`, `ImportBatchRequest`/`ImportBatchRowError`/`ImportBatchResponse` (stage 2).
- **`category.py`** — `CategoryCreate` (input), `CategoryResponse` (output).

## Why DTOs are separate from `app/models/` Documents
`ExpenseCreate` intentionally has no `id` field — a client must never be able to set its own primary key on create. `ExpenseResponse` adds it back because the *server* assigns it. If we reused the `Expense` Document class directly as the request body, FastAPI would happily accept a client-supplied `id`/`created_at` and silently overwrite the real ones — bugs like that are exactly what a boundary type at the API layer prevents. It also means the database schema (models) and the public API contract (schemas) can evolve independently: renaming an internal DB field doesn't have to break the API, and vice versa.
