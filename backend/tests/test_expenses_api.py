import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.usefixtures("seeded_categories")


async def test_create_expense(client: AsyncClient) -> None:
    payload = {
        "date": "2026-08-10",
        "title": "Parking near work",
        "value": 12.5,
        "category": "Parking",
    }

    response = await client.post("/api/v1/expenses/", json=payload)

    assert response.status_code == 201
    body = response.json()
    assert body["id"]
    assert body["category"] == "Parking"
    assert body["value"] == pytest.approx(12.5)
    assert body["created_at"]


async def test_create_expense_with_unknown_category_returns_422(client: AsyncClient) -> None:
    payload = {"date": "2026-08-10", "title": "X", "value": 1, "category": "DoesNotExist"}

    response = await client.post("/api/v1/expenses/", json=payload)

    assert response.status_code == 422
    assert "DoesNotExist" in response.json()["detail"]


async def test_create_expense_with_non_positive_value_returns_422(client: AsyncClient) -> None:
    payload = {"date": "2026-08-10", "title": "X", "value": 0, "category": "Uber"}

    response = await client.post("/api/v1/expenses/", json=payload)

    assert response.status_code == 422


async def test_list_expenses_filters_by_category_and_date_range(client: AsyncClient) -> None:
    await client.post(
        "/api/v1/expenses/",
        json={
            "date": "2026-08-01",
            "title": "In range, right category",
            "value": 10,
            "category": "Uber",
        },
    )
    await client.post(
        "/api/v1/expenses/",
        json={"date": "2026-09-01", "title": "Out of range", "value": 20, "category": "Uber"},
    )
    await client.post(
        "/api/v1/expenses/",
        json={"date": "2026-08-05", "title": "Wrong category", "value": 30, "category": "Food"},
    )

    response = await client.get(
        "/api/v1/expenses/",
        params={"category": "Uber", "date_from": "2026-08-01", "date_to": "2026-08-31"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["title"] == "In range, right category"


async def test_list_expenses_filters_by_trip(client: AsyncClient) -> None:
    await client.post(
        "/api/v1/expenses/",
        json={
            "date": "2026-08-01",
            "title": "Toll",
            "value": 15.8,
            "category": "Toll",
            "trip": "Serra Trip",
        },
    )
    await client.post(
        "/api/v1/expenses/",
        json={"date": "2026-08-02", "title": "Groceries", "value": 100, "category": "Supermarket"},
    )

    response = await client.get("/api/v1/expenses/", params={"trip": "Serra Trip"})

    assert response.json()["total"] == 1
