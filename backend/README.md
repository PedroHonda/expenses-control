# `backend/`

## Responsibility
The FastAPI + MongoDB application that serves the expense-tracking REST API: CSV import (parse-then-review, see spec §1), manual expense entry, filtering/reporting, and dynamic category management. Contract: [`.github/specs/01_api_contract.spec.md`](../.github/specs/01_api_contract.spec.md).

## Structure
```
backend/
├── pyproject.toml              # dependencies + ruff/black/isort config
├── .env.example                # copy to .env and adjust
├── app/
│   ├── main.py                 # FastAPI app, lifespan (DB connect/disconnect), CORS, /health
│   ├── core/                   # settings, DB connection, default_categories.json
│   ├── models/                 # Beanie Documents (Expense, Category) -- the DB layer
│   ├── schemas/                 # Pydantic DTOs -- the HTTP request/response layer
│   ├── services/                # business logic: csv_parser, expense_service, category_service
│   └── api/v1/                  # FastAPI routers
└── scripts/
    └── seed_categories.py       # idempotent default-category seeder
```
Each subdirectory has its own `README.md` with the "why" behind its files — this file is just the map.

## Setup
```bash
python -m venv .venv
source .venv/Scripts/activate   # Windows Git Bash; .venv\Scripts\activate on cmd/PowerShell
pip install -e ".[dev]"
cp .env.example .env
python -m scripts.seed_categories
uvicorn app.main:app --reload
```
Needs a reachable MongoDB (`MONGODB_URI` in `.env`). Interactive API docs at `/docs` once running.

## Linting
```bash
ruff check app scripts
black app scripts
isort app scripts
```
All three must pass clean (project Rule 1 — zero warnings) before a change is considered done.

## Why these choices
- **FastAPI**: async-first, typed request/response validation via Pydantic, automatic OpenAPI docs — good fit for a typed contract-first API.
- **MongoDB + Beanie**: the expense schema has optional fields (`details`, `trip`) and dynamically-managed categories, which suits a flexible document store better than a rigid relational schema.
- **PyMongo's native async client, not Motor**: the original plan (and `PROMPT_SPECIFICATION_EN.md`) called for Motor, but Motor is being sunset by MongoDB in favor of PyMongo's own async driver (`pymongo.AsyncMongoClient`, stable since PyMongo 4.9), and the installed Beanie version now targets that driver directly — running it through Motor threw a hard `TypeError` at startup. Full story in [`../learning/001_fastapi_mongodb_setup.md`](../learning/001_fastapi_mongodb_setup.md). This keeps the dependency actively maintained, per project Rule 5.
- **Python 3.11+**: current stable line with performance improvements relevant to async I/O workloads.
