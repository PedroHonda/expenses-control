import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.usefixtures("seeded_categories")


async def test_list_categories_returns_the_18_seeded_defaults(client: AsyncClient) -> None:
    response = await client.get("/api/v1/categories/")

    assert response.status_code == 200
    body = response.json()
    names = {c["name"] for c in body}
    assert len(body) == 18
    assert "Uber" in names
    assert "Payment/Refund" in names
    assert all(c["is_default"] is True for c in body)


async def test_create_category(client: AsyncClient) -> None:
    response = await client.post("/api/v1/categories/", json={"name": "Custom Category"})

    assert response.status_code == 201
    body = response.json()
    assert body["name"] == "Custom Category"
    assert body["is_default"] is False
    assert body["id"]


async def test_create_duplicate_category_is_rejected_case_insensitively(
    client: AsyncClient,
) -> None:
    response = await client.post("/api/v1/categories/", json={"name": "uber"})

    assert response.status_code == 409


async def test_create_category_empty_name_is_rejected(client: AsyncClient) -> None:
    response = await client.post("/api/v1/categories/", json={"name": ""})

    assert response.status_code == 422
