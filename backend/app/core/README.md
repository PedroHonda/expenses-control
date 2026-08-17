# `app/core/`

## Responsibility
Cross-cutting infrastructure that every other layer depends on: configuration and the database connection. Nothing here knows about HTTP or business rules.

## Files
- **`config.py`** — `Settings` (a `pydantic-settings` `BaseSettings`), reading `MONGODB_URI`, `MONGODB_DB_NAME`, `CORS_ORIGINS`, `API_V1_PREFIX` from environment variables / a `.env` file (see `../.env.example`). `get_settings()` is `@lru_cache`d so the whole app shares one parsed `Settings` instance.
- **`database.py`** — `connect_to_mongo()` / `close_mongo_connection()`, called from `app/main.py`'s FastAPI lifespan. Creates PyMongo's native async client (`pymongo.AsyncMongoClient` — not Motor; see `../../learning/001_fastapi_mongodb_setup.md`) and calls `beanie.init_beanie(...)` to register the `Expense` and `Category` document models (this is what makes `Expense.find(...)`-style queries work).
- **`default_categories.json`** — the seed list of default category names, read by `scripts/seed_categories.py`. Deliberately **not** hardcoded in Python: per the approved spec (`.github/specs/01_api_contract.spec.md` §2.2/§6), the user can edit this file before first running the seeder to use their own default category set instead of the shipped one.

## Why these choices
- **`pydantic-settings`** over raw `os.environ` reads: validates types (e.g. `cors_origins` as `list[str]`) and fails fast at startup on a misconfigured `.env`, instead of failing later with a cryptic error deep in a request handler.
- **A JSON file, not a Python constant, for default categories**: keeps "what the defaults are" a data/config concern editable by a non-programmer, separate from "how seeding works" (the script logic).
