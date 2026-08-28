# `app/api/v1/`

## Responsibility
Version 1 of the REST API. Holds the actual route handlers, grouped by resource.

## Files
- **`router.py`** — `api_router`, an `APIRouter` that includes `expenses.router`, `categories.router`, and `payment_methods.router`. Mounted at `settings.api_v1_prefix` (`/api/v1`) in `app/main.py`.
- **`expenses.py`** — `POST /expenses/` (manual entry), `POST /expenses/upload-csv` (CSV parse-only; also flags each row's `is_duplicate` against already-persisted expenses via `expense_service.find_duplicate_keys`, and fills any row's missing `payment_method` with the configured CSV-import default via `payment_method_service.get_default_import_payment_method`, so a re-imported bill is pre-flagged and every row already has a payment method for the frontend), `POST /expenses/import-batch` (validate + persist a completed batch), `PUT /expenses/{id}` (full-record edit, `404`/`422` on missing id/unknown category or payment method), `DELETE /expenses/{id}` (`404` if missing), `GET /expenses/` (filtered/paginated list), `GET /expenses/summary` (unpaginated per-category totals for a date range — backs the Reports view, see `.github/specs/06_category_reports.spec.md`), `GET /expenses/summary-by-month` (unpaginated per-year-month-category totals, see `.github/specs/07_monthly_summary.spec.md`). Endpoint contracts: `.github/specs/01_api_contract.spec.md` §4, `.github/specs/04_expense_edit_delete.spec.md`.
- **`categories.py`** — `GET /categories/`, `POST /categories/`, `PATCH /categories/{id}` (toggle `exclude_from_total`, `404` if the id doesn't exist — see `.github/specs/03_category_settings.spec.md`).
- **`payment_methods.py`** — `GET /payment-methods/`, `POST /payment-methods/` (`409` on a case-insensitive duplicate), `PATCH /payment-methods/{id}` (sets `is_default_for_import` — `400` if the body tries to set it `False` directly, `404` if the id doesn't exist — see `.github/specs/08_payment_methods.spec.md`).

## Why versioned
Keeping routes under `v1/` (rather than directly in `app/api/`) means a future incompatible contract change can ship as a parallel `v2/` package without breaking existing clients of `v1/`.
