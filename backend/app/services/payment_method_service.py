import re
from collections.abc import Iterable
from typing import Any

from beanie import PydanticObjectId
from beanie.operators import Eq
from pymongo.errors import DuplicateKeyError

from app.models.payment_method import PaymentMethod
from app.schemas.payment_method import (
    PaymentMethodCreate,
    PaymentMethodResponse,
    PaymentMethodUpdate,
)


class DuplicatePaymentMethodError(Exception):
    def __init__(self, name: str) -> None:
        self.name = name
        super().__init__(f"payment method already exists: '{name}'")


class PaymentMethodNotFoundError(Exception):
    def __init__(self, payment_method_id: str) -> None:
        self.payment_method_id = payment_method_id
        super().__init__(f"payment method not found: '{payment_method_id}'")


class CannotUnsetDefaultImportError(Exception):
    def __init__(self) -> None:
        super().__init__(
            "cannot unset the CSV-import default directly -- set a different "
            "payment method's is_default_for_import instead"
        )


def _to_response(payment_method: PaymentMethod) -> PaymentMethodResponse:
    return PaymentMethodResponse(
        id=str(payment_method.id),
        name=payment_method.name,
        is_default=payment_method.is_default,
        is_default_for_import=payment_method.is_default_for_import,
    )


async def find_payment_method_ci(name: str) -> PaymentMethod | None:
    """Case-insensitive lookup by name (accent-sensitive), mirroring
    category_service.find_category_ci."""
    pattern = f"^{re.escape(name.strip())}$"
    return await PaymentMethod.find_one({"name": {"$regex": pattern, "$options": "i"}})


async def list_payment_methods() -> list[PaymentMethodResponse]:
    methods = await PaymentMethod.find_all().sort(+PaymentMethod.name).to_list()
    return [_to_response(method) for method in methods]


async def get_default_import_payment_method() -> str | None:
    """The current CSV-import default's name, or None if somehow unset
    (e.g. a fresh, unseeded database) -- backs the upload-csv route's
    per-row default-fill (spec 08 §2.3)."""
    method = await PaymentMethod.find_one(Eq(PaymentMethod.is_default_for_import, True))
    return method.name if method is not None else None


async def create_payment_method(
    data: PaymentMethodCreate, *, is_default: bool = False, is_default_for_import: bool = False
) -> PaymentMethodResponse:
    if await find_payment_method_ci(data.name) is not None:
        raise DuplicatePaymentMethodError(data.name)

    method = PaymentMethod(
        name=data.name.strip(), is_default=is_default, is_default_for_import=is_default_for_import
    )
    try:
        await method.insert()
    except DuplicateKeyError as exc:
        raise DuplicatePaymentMethodError(data.name) from exc

    return _to_response(method)


async def update_payment_method(
    payment_method_id: str, data: PaymentMethodUpdate
) -> PaymentMethodResponse:
    if not data.is_default_for_import:
        raise CannotUnsetDefaultImportError()

    try:
        method = await PaymentMethod.get(PydanticObjectId(payment_method_id))
    except Exception as exc:  # invalid ObjectId format, e.g. "abc"
        raise PaymentMethodNotFoundError(payment_method_id) from exc

    if method is None:
        raise PaymentMethodNotFoundError(payment_method_id)

    # Exclusive: clear every other method's flag before setting this one,
    # so there's never a moment with zero or multiple defaults (spec 08 §2.1).
    await PaymentMethod.find(Eq(PaymentMethod.is_default_for_import, True)).update(
        {"$set": {"is_default_for_import": False}}
    )
    method.is_default_for_import = True
    await method.save()
    return _to_response(method)


async def seed_default_payment_methods(entries: Iterable[dict[str, Any]]) -> int:
    """Inserts any name not already present (case-insensitive) as a default
    payment method. Each entry is `{"name": str, "is_default_for_import":
    bool}` (see app/core/default_payment_methods.json). Idempotent: safe to
    call repeatedly. Mirrors category_service.seed_default_categories."""
    created = 0
    for entry in entries:
        name = entry["name"]
        if await find_payment_method_ci(name) is None:
            await PaymentMethod(
                name=name,
                is_default=True,
                is_default_for_import=entry.get("is_default_for_import", False),
            ).insert()
            created += 1
    return created
