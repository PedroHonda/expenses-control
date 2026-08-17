from beanie import Document
from pymongo import ASCENDING, IndexModel


class Category(Document):
    name: str
    is_default: bool = False

    class Settings:
        name = "categories"
        # MongoDB unique indexes are case-sensitive by default ("Uber" and "uber"
        # would both be allowed). A collation with strength=2 makes the index
        # compare names case-insensitively while still treating accented
        # characters as distinct (important since categories can be in Portuguese).
        indexes = [
            IndexModel(
                [("name", ASCENDING)],
                unique=True,
                collation={"locale": "en", "strength": 2},
                name="uq_category_name_ci",
            )
        ]
