from fastapi import APIRouter, HTTPException, status

from app.schemas.payment_method import (
    PaymentMethodCreate,
    PaymentMethodResponse,
    PaymentMethodUpdate,
)
from app.services import payment_method_service

router = APIRouter(prefix="/payment-methods", tags=["payment-methods"])


@router.get("/", response_model=list[PaymentMethodResponse])
async def list_payment_methods() -> list[PaymentMethodResponse]:
    return await payment_method_service.list_payment_methods()


@router.post("/", response_model=PaymentMethodResponse, status_code=status.HTTP_201_CREATED)
async def create_payment_method(payload: PaymentMethodCreate) -> PaymentMethodResponse:
    try:
        return await payment_method_service.create_payment_method(payload)
    except payment_method_service.DuplicatePaymentMethodError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc


@router.patch("/{payment_method_id}", response_model=PaymentMethodResponse)
async def update_payment_method(
    payment_method_id: str, payload: PaymentMethodUpdate
) -> PaymentMethodResponse:
    try:
        return await payment_method_service.update_payment_method(payment_method_id, payload)
    except payment_method_service.PaymentMethodNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except payment_method_service.CannotUnsetDefaultImportError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
