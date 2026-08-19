# `app/api/v1/`

## Responsibility
Version 1 of the REST API. Holds the actual route handlers, grouped by resource.

## Files
- **`router.py`** — `api_router`, an `APIRouter` that includes `expenses.router` and `categories.router`. Mounted at `settings.api_v1_prefix` (`/api/v1`) in `app/main.py`.
- **`expenses.py`** — `POST /expenses/` (manual entry), `POST /expenses/upload-csv` (CSV parse-only), `POST /expenses/import-batch` (validate + persist a completed batch), `GET /expenses/` (filtered/paginated list). Endpoint contracts: `.github/specs/01_api_contract.spec.md` §4.
- **`categories.py`** — `GET /categories/`, `POST /categories/`, `PATCH /categories/{id}` (toggle `exclude_from_total`, `404` if the id doesn't exist — see `.github/specs/03_category_settings.spec.md`).

## Why versioned
Keeping routes under `v1/` (rather than directly in `app/api/`) means a future incompatible contract change can ship as a parallel `v2/` package without breaking existing clients of `v1/`.
