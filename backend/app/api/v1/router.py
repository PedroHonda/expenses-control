from fastapi import APIRouter

from app.api.v1 import categories, expenses, payment_methods

api_router = APIRouter()
api_router.include_router(expenses.router)
api_router.include_router(categories.router)
api_router.include_router(payment_methods.router)
