from pydantic import BaseModel, Field


class CategoryCreate(BaseModel):
    name: str = Field(min_length=1, max_length=50)


class CategoryResponse(BaseModel):
    id: str
    name: str
    is_default: bool
