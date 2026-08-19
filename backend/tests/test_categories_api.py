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
    by_name = {c["name"]: c for c in body}
    assert by_name["Payment/Refund"]["exclude_from_total"] is True
    assert by_name["Uber"]["exclude_from_total"] is False


async def test_create_category(client: AsyncClient) -> None:
    response = await client.post("/api/v1/categories/", json={"name": "Custom Category"})

    assert response.status_code == 201
    body = response.json()
    assert body["name"] == "Custom Category"
    assert body["is_default"] is False
    assert body["exclude_from_total"] is False
    assert body["id"]


async def test_create_duplicate_category_is_rejected_case_insensitively(
    client: AsyncClient,
) -> None:
    response = await client.post("/api/v1/categories/", json={"name": "uber"})

    assert response.status_code == 409


async def test_create_category_empty_name_is_rejected(client: AsyncClient) -> None:
    response = await client.post("/api/v1/categories/", json={"name": ""})

    assert response.status_code == 422


async def test_update_category_toggles_exclude_from_total(client: AsyncClient) -> None:
    list_response = await client.get("/api/v1/categories/")
    uber_id = next(c["id"] for c in list_response.json() if c["name"] == "Uber")

    response = await client.patch(
        f"/api/v1/categories/{uber_id}", json={"exclude_from_total": True}
    )

    assert response.status_code == 200
    assert response.json()["exclude_from_total"] is True

    list_response = await client.get("/api/v1/categories/")
    uber = next(c for c in list_response.json() if c["id"] == uber_id)
    assert uber["exclude_from_total"] is True


async def test_update_category_not_found(client: AsyncClient) -> None:
    response = await client.patch(
        "/api/v1/categories/000000000000000000000000", json={"exclude_from_total": True}
    )

    assert response.status_code == 404


async def test_update_category_invalid_id_format(client: AsyncClient) -> None:
    response = await client.patch(
        "/api/v1/categories/not-a-valid-id", json={"exclude_from_total": True}
    )

    assert response.status_code == 404
