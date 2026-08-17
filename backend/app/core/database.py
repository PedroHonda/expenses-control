from beanie import init_beanie
from pymongo import AsyncMongoClient

from app.core.config import get_settings
from app.models.category import Category
from app.models.expense import Expense

_client: AsyncMongoClient | None = None


async def connect_to_mongo() -> None:
    global _client
    settings = get_settings()
    _client = AsyncMongoClient(settings.mongodb_uri)
    await init_beanie(
        database=_client[settings.mongodb_db_name],
        document_models=[Expense, Category],
    )


async def close_mongo_connection() -> None:
    global _client
    if _client is not None:
        await _client.close()
        _client = None
