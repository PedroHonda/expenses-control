from fastapi import APIRouter

from app.api.v1 import categories, expenses

api_router = APIRouter()
api_router.include_router(expenses.router)
api_router.include_router(categories.router)
