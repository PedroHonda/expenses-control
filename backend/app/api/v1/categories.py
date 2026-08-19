from fastapi import APIRouter, HTTPException, status

from app.schemas.category import CategoryCreate, CategoryResponse, CategoryUpdate
from app.services import category_service

router = APIRouter(prefix="/categories", tags=["categories"])


@router.get("/", response_model=list[CategoryResponse])
async def list_categories() -> list[CategoryResponse]:
    return await category_service.list_categories()


@router.post("/", response_model=CategoryResponse, status_code=status.HTTP_201_CREATED)
async def create_category(payload: CategoryCreate) -> CategoryResponse:
    try:
        return await category_service.create_category(payload)
    except category_service.DuplicateCategoryError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc


@router.patch("/{category_id}", response_model=CategoryResponse)
async def update_category(category_id: str, payload: CategoryUpdate) -> CategoryResponse:
    try:
        return await category_service.update_category(category_id, payload)
    except category_service.CategoryNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
