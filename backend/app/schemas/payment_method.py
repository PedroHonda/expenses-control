from pydantic import BaseModel, Field


class PaymentMethodCreate(BaseModel):
    name: str = Field(min_length=1, max_length=50)


class PaymentMethodUpdate(BaseModel):
    # Deliberately just one field, and only `True` is meaningful -- see
    # payment_method_service.set_default_import_payment_method for why
    # `False` is rejected rather than silently accepted.
    is_default_for_import: bool


class PaymentMethodResponse(BaseModel):
    id: str
    name: str
    is_default: bool
    is_default_for_import: bool
