"""Idempotent seeder for default categories.

Reads app/core/default_categories.json and inserts any name not already
present (case-insensitive). Safe to re-run: existing categories are
skipped, never duplicated or overwritten.

Run from backend/, with the virtualenv active:
    python -m scripts.seed_categories

To use your own default set instead of the shipped one, edit
app/core/default_categories.json before running this for the first time.
"""

import asyncio
import json
from pathlib import Path

from app.core.database import close_mongo_connection, connect_to_mongo
from app.services.category_service import seed_default_categories

DEFAULT_CATEGORIES_PATH = (
    Path(__file__).resolve().parent.parent / "app" / "core" / "default_categories.json"
)


async def seed() -> None:
    entries = json.loads(DEFAULT_CATEGORIES_PATH.read_text(encoding="utf-8"))

    await connect_to_mongo()
    try:
        created = await seed_default_categories(entries)
        skipped = len(entries) - created
        print(f"Seeded {created} new categories ({skipped} already existed).")
    finally:
        await close_mongo_connection()


if __name__ == "__main__":
    asyncio.run(seed())
