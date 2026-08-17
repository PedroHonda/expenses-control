# `scripts/`

## Responsibility
One-off operational scripts that aren't part of the running API — currently just database seeding.

## Files
- **`seed_categories.py`** — reads `app/core/default_categories.json` and inserts any category name not already present (case-insensitive check via `category_service.find_category_ci`). Idempotent: safe to run multiple times, or after editing the JSON file to add more defaults later.

## Usage
From `backend/`, with the virtualenv active and `MONGODB_URI`/`MONGODB_DB_NAME` configured (via `.env` or environment):
```bash
python -m scripts.seed_categories
```

To seed your **own** default categories instead of the shipped set, edit `app/core/default_categories.json` before running this the first time.
