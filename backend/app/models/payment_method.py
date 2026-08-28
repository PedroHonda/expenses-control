from beanie import Document
from pymongo import ASCENDING, IndexModel


class PaymentMethod(Document):
    name: str
    is_default: bool = False
    is_default_for_import: bool = False

    class Settings:
        name = "payment_methods"
        # Same case-insensitive-unique approach as Category.name -- see
        # app/models/category.py for why a collation (not a plain unique
        # index) is needed here.
        indexes = [
            IndexModel(
                [("name", ASCENDING)],
                unique=True,
                collation={"locale": "en", "strength": 2},
                name="uq_payment_method_name_ci",
            )
        ]
