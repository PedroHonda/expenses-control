# `app/api/`

## Responsibility
The HTTP layer: FastAPI routers that parse requests, call into `app/services/`, and translate service-layer exceptions into HTTP status codes. Routes stay thin — no business logic or database queries live here directly.

## Structure
```
api/
└── v1/
    ├── router.py      # aggregates all v1 routers into one api_router
    ├── expenses.py    # POST /expenses/, POST /expenses/upload-csv, POST /expenses/import-batch, GET /expenses/
    └── categories.py  # GET /categories/, POST /categories/
```

Versioning under `v1/` (mounted at `/api/v1` in `app/main.py`) means a future breaking change can live in a `v2/` package without touching this one.

## Why exceptions map to HTTP codes here, not in services
`app/services/*.py` raises plain Python exceptions (`UnknownCategoryError`, `DuplicateCategoryError`, `ImportBatchValidationError`, `csv_parser.CsvParseError`) — it has no concept of "422" or "409". Each route's `try/except` is where a domain error becomes a specific `HTTPException`. This keeps the services importable and testable without pulling in FastAPI at all (see `../services/README.md`).
