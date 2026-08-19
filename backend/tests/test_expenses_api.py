from datetime import UTC, datetime

import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.usefixtures("seeded_categories")


def _parse_timestamp(value: str) -> datetime:
    # MongoDB stores datetimes at millisecond precision and Beanie returns a
    # naive datetime after a read-then-write round trip (unlike the tz-aware,
    # microsecond-precision value returned right after an in-memory insert) --
    # compare instants at millisecond resolution rather than exact strings.
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=UTC)
    return parsed.replace(microsecond=(parsed.microsecond // 1000) * 1000)


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


async def test_update_expense(client: AsyncClient) -> None:
    create_response = await client.post(
        "/api/v1/expenses/",
        json={
            "date": "2026-08-10",
            "title": "Parking near work",
            "value": 12.5,
            "category": "Parking",
        },
    )
    expense_id = create_response.json()["id"]

    response = await client.put(
        f"/api/v1/expenses/{expense_id}",
        json={
            "date": "2026-08-11",
            "title": "Parking downtown",
            "value": 20,
            "category": "Parking",
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["id"] == expense_id
    assert body["title"] == "Parking downtown"
    assert body["value"] == pytest.approx(20)
    assert body["updated_at"] != create_response.json()["updated_at"]
    assert _parse_timestamp(body["created_at"]) == _parse_timestamp(
        create_response.json()["created_at"]
    )


async def test_update_expense_not_found_returns_404(client: AsyncClient) -> None:
    payload = {"date": "2026-08-10", "title": "X", "value": 1, "category": "Uber"}

    response = await client.put("/api/v1/expenses/000000000000000000000000", json=payload)

    assert response.status_code == 404


async def test_update_expense_with_unknown_category_returns_422(client: AsyncClient) -> None:
    create_response = await client.post(
        "/api/v1/expenses/",
        json={"date": "2026-08-10", "title": "X", "value": 1, "category": "Uber"},
    )
    expense_id = create_response.json()["id"]

    response = await client.put(
        f"/api/v1/expenses/{expense_id}",
        json={"date": "2026-08-10", "title": "X", "value": 1, "category": "DoesNotExist"},
    )

    assert response.status_code == 422
    unchanged = await client.get("/api/v1/expenses/")
    assert unchanged.json()["items"][0]["category"] == "Uber"


async def test_delete_expense(client: AsyncClient) -> None:
    create_response = await client.post(
        "/api/v1/expenses/",
        json={"date": "2026-08-10", "title": "X", "value": 1, "category": "Uber"},
    )
    expense_id = create_response.json()["id"]

    response = await client.delete(f"/api/v1/expenses/{expense_id}")

    assert response.status_code == 204
    remaining = await client.get("/api/v1/expenses/")
    assert remaining.json()["total"] == 0


async def test_delete_expense_not_found_returns_404(client: AsyncClient) -> None:
    response = await client.delete("/api/v1/expenses/000000000000000000000000")

    assert response.status_code == 404


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
