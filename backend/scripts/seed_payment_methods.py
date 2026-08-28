"""Idempotent seeder for default payment methods.

Reads app/core/default_payment_methods.json and inserts any name not
already present (case-insensitive). Safe to re-run: existing payment
methods are skipped, never duplicated or overwritten. Mirrors
seed_categories.py exactly -- see that script's docstring.

Run from backend/, with the virtualenv active:
    python -m scripts.seed_payment_methods
"""

import asyncio
import json
from pathlib import Path

from app.core.database import close_mongo_connection, connect_to_mongo
from app.services.payment_method_service import seed_default_payment_methods

DEFAULT_PAYMENT_METHODS_PATH = (
    Path(__file__).resolve().parent.parent / "app" / "core" / "default_payment_methods.json"
)


async def seed() -> None:
    entries = json.loads(DEFAULT_PAYMENT_METHODS_PATH.read_text(encoding="utf-8"))

    await connect_to_mongo()
    try:
        created = await seed_default_payment_methods(entries)
        skipped = len(entries) - created
        print(f"Seeded {created} new payment methods ({skipped} already existed).")
    finally:
        await close_mongo_connection()


if __name__ == "__main__":
    asyncio.run(seed())
