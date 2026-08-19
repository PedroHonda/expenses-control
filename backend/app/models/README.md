# `app/models/`

## Responsibility
Beanie `Document` classes — the objects that actually map 1:1 to MongoDB collections. These are the persistence layer, distinct from the Pydantic DTOs in `app/schemas/` that shape the HTTP request/response bodies (see `../schemas/README.md` for why they're kept separate).

## Files
- **`expense.py`** — `Expense` document → `expenses` collection. Indexed on `date`, `category`, `trip` (the three fields `GET /expenses/` filters by, per `.github/specs/01_api_contract.spec.md` §4.4). `created_at`/`updated_at` default to "now" via `Field(default_factory=...)`, so callers never have to set them.
- **`category.py`** — `Category` document → `categories` collection. Has a **unique index on `name` with a case-insensitive collation** (`strength=2`) so `"uber"` and `"Uber"` can't both exist — this is what actually enforces the "unique, case-insensitive" rule from the spec at the database level (the service layer's pre-check is a UX nicety, not the source of truth; a `DuplicateKeyError` from this index is the real guarantee against race conditions). `exclude_from_total: bool` (default `False`) marks a category (e.g. `Payment/Refund`) as excluded from the dashboard's Total — see `.github/specs/03_category_settings.spec.md`.

## Why Beanie
Beanie sits on top of Motor (the async MongoDB driver) and Pydantic, so a `Document` subclass gets both async query methods (`Expense.find(...)`, `.insert()`, `.insert_many(...)`) and Pydantic-style validation for free, without hand-writing serialization code.
