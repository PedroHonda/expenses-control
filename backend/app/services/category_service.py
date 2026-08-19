import re
from collections.abc import Iterable
from typing import Any

from beanie import PydanticObjectId
from pymongo.errors import DuplicateKeyError

from app.models.category import Category
from app.schemas.category import CategoryCreate, CategoryResponse, CategoryUpdate


class DuplicateCategoryError(Exception):
    def __init__(self, name: str) -> None:
        self.name = name
        super().__init__(f"category already exists: '{name}'")


class CategoryNotFoundError(Exception):
    def __init__(self, category_id: str) -> None:
        self.category_id = category_id
        super().__init__(f"category not found: '{category_id}'")


def _to_response(category: Category) -> CategoryResponse:
    return CategoryResponse(
        id=str(category.id),
        name=category.name,
        is_default=category.is_default,
        exclude_from_total=category.exclude_from_total,
    )


async def find_category_ci(name: str) -> Category | None:
    """Case-insensitive lookup by name (accent-sensitive)."""
    pattern = f"^{re.escape(name.strip())}$"
    return await Category.find_one({"name": {"$regex": pattern, "$options": "i"}})


async def list_categories() -> list[CategoryResponse]:
    categories = await Category.find_all().sort(+Category.name).to_list()
    return [_to_response(category) for category in categories]


async def create_category(data: CategoryCreate, *, is_default: bool = False) -> CategoryResponse:
    if await find_category_ci(data.name) is not None:
        raise DuplicateCategoryError(data.name)

    category = Category(name=data.name.strip(), is_default=is_default)
    try:
        await category.insert()
    except DuplicateKeyError as exc:
        # Belt-and-suspenders: the unique collation index (see app/models/category.py)
        # is the real guarantee against a race between the check above and this insert.
        raise DuplicateCategoryError(data.name) from exc

    return _to_response(category)


async def update_category(category_id: str, data: CategoryUpdate) -> CategoryResponse:
    try:
        category = await Category.get(PydanticObjectId(category_id))
    except Exception as exc:  # invalid ObjectId format, e.g. "abc"
        raise CategoryNotFoundError(category_id) from exc

    if category is None:
        raise CategoryNotFoundError(category_id)

    category.exclude_from_total = data.exclude_from_total
    await category.save()
    return _to_response(category)


async def seed_default_categories(entries: Iterable[dict[str, Any]]) -> int:
    """Inserts any name not already present (case-insensitive) as a default
    category. Each entry is `{"name": str, "exclude_from_total": bool}`
    (see app/core/default_categories.json). Idempotent: safe to call
    repeatedly. Returns the number of categories actually created. Shared
    by scripts/seed_categories.py and the test suite's `seeded_categories`
    fixture, so both use the exact same idempotent-insert logic."""
    created = 0
    for entry in entries:
        name = entry["name"]
        if await find_category_ci(name) is None:
            await Category(
                name=name,
                is_default=True,
                exclude_from_total=entry.get("exclude_from_total", False),
            ).insert()
            created += 1
    return created
