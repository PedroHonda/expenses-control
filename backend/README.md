# `backend/`

## Responsibility
The FastAPI + MongoDB application that serves the expense-tracking REST API: CSV import, manual expense entry, filtering/reporting, and dynamic category management.

## Contents
Empty as of Phase 0. Scaffolding (`app/main.py`, `app/models`, `app/api`, `app/services`, `app/core`) is created in Phase 2, per [`.github/specs/01_api_contract.spec.md`](../.github/specs/) once that spec exists.

## Why this approach
- **FastAPI**: async-first, typed request/response validation via Pydantic, automatic OpenAPI docs — good fit for a typed contract-first API.
- **MongoDB + Motor/Beanie**: the expense schema has optional fields (`Details`, `Trip`) and dynamically-managed categories, which suits a flexible document store better than a rigid relational schema.
- **Python 3.11+**: current stable line with performance improvements relevant to async I/O workloads.
