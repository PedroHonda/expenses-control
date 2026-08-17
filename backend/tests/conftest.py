from collections.abc import AsyncIterator

import pytest_asyncio
from beanie import init_beanie
from httpx import ASGITransport, AsyncClient
from pymongo import AsyncMongoClient

from app.core.config import get_settings
from app.main import app
from app.models.category import Category
from app.models.expense import Expense
from app.services.category_service import seed_default_categories

# A dedicated, disposable database -- never the real MONGODB_DB_NAME from
# .env. The app's own lifespan (which connects to the real database) is
# never triggered in these tests: plain httpx.ASGITransport doesn't run
# ASGI lifespan events, so this fixture is the only thing that connects
# Beanie to a database at all.
TEST_DB_NAME = "expense_tracker_test"

DEFAULT_CATEGORY_NAMES = [
    "Parking",
    "Toll",
    "Gifts",
    "Games",
    "Home",
    "Supermarket",
    "Food",
    "Bakery",
    "Fuel",
    "Pharmacy",
    "Health",
    "Care",
    "Entertainment",
    "Show",
    "Shopping",
    "Car",
    "Uber",
    "Payment/Refund",
]


@pytest_asyncio.fixture(scope="session")
async def mongo_client() -> AsyncIterator[AsyncMongoClient]:
    settings = get_settings()
    client = AsyncMongoClient(settings.mongodb_uri)
    await init_beanie(database=client[TEST_DB_NAME], document_models=[Expense, Category])
    # Guard against leftovers from a previous interrupted run.
    await Expense.delete_all()
    await Category.delete_all()

    yield client

    await client.drop_database(TEST_DB_NAME)
    await client.close()


@pytest_asyncio.fixture(autouse=True)
async def clean_db(mongo_client: AsyncMongoClient) -> AsyncIterator[None]:
    """Every test starts against an empty DB and leaves one behind, so
    tests never depend on each other's data."""
    yield
    await Expense.delete_all()
    await Category.delete_all()


@pytest_asyncio.fixture
async def seeded_categories(mongo_client: AsyncMongoClient) -> None:
    """Opt-in fixture (via `pytestmark = pytest.mark.usefixtures(...)`) for
    tests that need the 18 default categories to exist -- e.g. anything
    that creates an Expense, since category existence is validated."""
    await seed_default_categories(DEFAULT_CATEGORY_NAMES)


@pytest_asyncio.fixture
async def client(mongo_client: AsyncMongoClient) -> AsyncIterator[AsyncClient]:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
