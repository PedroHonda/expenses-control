"""One-off backfill: sets payment_method="Nubank" on every existing Expense
document that doesn't have one yet (see .github/specs/08_payment_methods.spec.md
§2.7).

Deliberately a raw pymongo update_many on the `expenses` collection, NOT a
Beanie `Expense.find().to_list()` round-trip: the (now-required)
`payment_method` field on the `Expense` Pydantic model would fail
validation while loading a pre-migration document, before this script
even got a chance to fix it.

Idempotent: the filter only matches documents missing the field, so
re-running this after it's already succeeded is a no-op.

Run from backend/, with the virtualenv active:
    python -m scripts.migrate_backfill_payment_method
"""

import asyncio

from pymongo import AsyncMongoClient

from app.core.config import get_settings

BACKFILL_VALUE = "Nubank"


async def migrate() -> None:
    settings = get_settings()
    client = AsyncMongoClient(settings.mongodb_uri)
    try:
        collection = client[settings.mongodb_db_name]["expenses"]
        result = await collection.update_many(
            {"payment_method": {"$exists": False}},
            {"$set": {"payment_method": BACKFILL_VALUE}},
        )
        print(
            f"Backfilled {result.modified_count} expense(s) with "
            f"payment_method='{BACKFILL_VALUE}'."
        )
    finally:
        await client.close()


if __name__ == "__main__":
    asyncio.run(migrate())
