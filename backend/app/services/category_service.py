import re

from pymongo.errors import DuplicateKeyError

from app.models.category import Category
from app.schemas.category import CategoryCreate, CategoryResponse


class DuplicateCategoryError(Exception):
    def __init__(self, name: str) -> None:
        self.name = name
        super().__init__(f"category already exists: '{name}'")


def _to_response(category: Category) -> CategoryResponse:
    return CategoryResponse(id=str(category.id), name=category.name, is_default=category.is_default)


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
