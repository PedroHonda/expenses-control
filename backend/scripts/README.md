# `scripts/`

## Responsibility
One-off operational scripts that aren't part of the running API — database seeding and data migrations.

## Files
- **`seed_categories.py`** — reads `app/core/default_categories.json` and delegates the actual insert-if-missing loop to `category_service.seed_default_categories` (shared with the test suite's `seeded_categories` fixture, so both use identical logic). Idempotent: safe to run multiple times, or after editing the JSON file to add more defaults later.
- **`seed_payment_methods.py`** — same pattern as `seed_categories.py`, for `PaymentMethod` (reads `app/core/default_payment_methods.json`, delegates to `payment_method_service.seed_default_payment_methods`). See `.github/specs/08_payment_methods.spec.md`.
- **`migrate_backfill_payment_method.py`** — one-off: sets `payment_method="Nubank"` on every `Expense` document that doesn't have the field yet (pre-existing data, from before spec 08 added it as required). A raw `update_many` on the collection, not a Beanie round-trip — see the script's own docstring for why loading old documents through the (now-required-field) `Expense` model first would fail before the fix could run. Idempotent (filters on the field being absent), but conceptually a one-time migration rather than something re-run on every deploy the way the two seed scripts are.

## Usage
From `backend/`, with the virtualenv active and `MONGODB_URI`/`MONGODB_DB_NAME` configured (via `.env` or environment):
```bash
python -m scripts.seed_categories
python -m scripts.seed_payment_methods
python -m scripts.migrate_backfill_payment_method
```

To seed your **own** default categories or payment methods instead of the shipped sets, edit `app/core/default_categories.json` / `app/core/default_payment_methods.json` before running the seeders the first time.
