from datetime import UTC, datetime
from io import BytesIO

import pytest
from httpx import AsyncClient
from pypdf import PdfReader

pytestmark = pytest.mark.usefixtures("seeded_categories", "seeded_payment_methods")


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
        "payment_method": "Nubank",
    }

    response = await client.post("/api/v1/expenses/", json=payload)

    assert response.status_code == 201
    body = response.json()
    assert body["id"]
    assert body["category"] == "Parking"
    assert body["payment_method"] == "Nubank"
    assert body["value"] == pytest.approx(12.5)
    assert body["created_at"]


async def test_create_expense_with_unknown_category_returns_422(client: AsyncClient) -> None:
    payload = {
        "date": "2026-08-10",
        "title": "X",
        "value": 1,
        "category": "DoesNotExist",
        "payment_method": "Nubank",
    }

    response = await client.post("/api/v1/expenses/", json=payload)

    assert response.status_code == 422
    assert "DoesNotExist" in response.json()["detail"]


async def test_create_expense_with_unknown_payment_method_returns_422(
    client: AsyncClient,
) -> None:
    payload = {
        "date": "2026-08-10",
        "title": "X",
        "value": 1,
        "category": "Uber",
        "payment_method": "DoesNotExist",
    }

    response = await client.post("/api/v1/expenses/", json=payload)

    assert response.status_code == 422
    assert "DoesNotExist" in response.json()["detail"]


async def test_create_expense_with_non_positive_value_returns_422(client: AsyncClient) -> None:
    payload = {
        "date": "2026-08-10",
        "title": "X",
        "value": 0,
        "category": "Uber",
        "payment_method": "Nubank",
    }

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
            "payment_method": "Nubank",
        },
    )
    await client.post(
        "/api/v1/expenses/",
        json={
            "date": "2026-09-01",
            "title": "Out of range",
            "value": 20,
            "category": "Uber",
            "payment_method": "Nubank",
        },
    )
    await client.post(
        "/api/v1/expenses/",
        json={
            "date": "2026-08-05",
            "title": "Wrong category",
            "value": 30,
            "category": "Food",
            "payment_method": "Nubank",
        },
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
            "payment_method": "Nubank",
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
            "payment_method": "Pix",
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
    payload = {
        "date": "2026-08-10",
        "title": "X",
        "value": 1,
        "category": "Uber",
        "payment_method": "Nubank",
    }

    response = await client.put("/api/v1/expenses/000000000000000000000000", json=payload)

    assert response.status_code == 404


async def test_update_expense_with_unknown_category_returns_422(client: AsyncClient) -> None:
    create_response = await client.post(
        "/api/v1/expenses/",
        json={
            "date": "2026-08-10",
            "title": "X",
            "value": 1,
            "category": "Uber",
            "payment_method": "Nubank",
        },
    )
    expense_id = create_response.json()["id"]

    response = await client.put(
        f"/api/v1/expenses/{expense_id}",
        json={
            "date": "2026-08-10",
            "title": "X",
            "value": 1,
            "category": "DoesNotExist",
            "payment_method": "Nubank",
        },
    )

    assert response.status_code == 422
    unchanged = await client.get("/api/v1/expenses/")
    assert unchanged.json()["items"][0]["category"] == "Uber"


async def test_update_expense_with_unknown_payment_method_returns_422(
    client: AsyncClient,
) -> None:
    create_response = await client.post(
        "/api/v1/expenses/",
        json={
            "date": "2026-08-10",
            "title": "X",
            "value": 1,
            "category": "Uber",
            "payment_method": "Nubank",
        },
    )
    expense_id = create_response.json()["id"]

    response = await client.put(
        f"/api/v1/expenses/{expense_id}",
        json={
            "date": "2026-08-10",
            "title": "X",
            "value": 1,
            "category": "Uber",
            "payment_method": "DoesNotExist",
        },
    )

    assert response.status_code == 422
    unchanged = await client.get("/api/v1/expenses/")
    assert unchanged.json()["items"][0]["payment_method"] == "Nubank"


async def test_delete_expense(client: AsyncClient) -> None:
    create_response = await client.post(
        "/api/v1/expenses/",
        json={
            "date": "2026-08-10",
            "title": "X",
            "value": 1,
            "category": "Uber",
            "payment_method": "Nubank",
        },
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
            "payment_method": "Nubank",
            "trip": "Serra Trip",
        },
    )
    await client.post(
        "/api/v1/expenses/",
        json={
            "date": "2026-08-02",
            "title": "Groceries",
            "value": 100,
            "category": "Supermarket",
            "payment_method": "Nubank",
        },
    )

    response = await client.get("/api/v1/expenses/", params={"trip": "Serra Trip"})

    assert response.json()["total"] == 1


async def test_list_expenses_filters_by_payment_method(client: AsyncClient) -> None:
    await client.post(
        "/api/v1/expenses/",
        json={
            "date": "2026-08-01",
            "title": "Toll",
            "value": 15.8,
            "category": "Toll",
            "payment_method": "Pix",
        },
    )
    await client.post(
        "/api/v1/expenses/",
        json={
            "date": "2026-08-02",
            "title": "Groceries",
            "value": 100,
            "category": "Supermarket",
            "payment_method": "Nubank",
        },
    )

    response = await client.get("/api/v1/expenses/", params={"payment_method": "Pix"})

    assert response.json()["total"] == 1


async def test_expense_summary_groups_by_category(client: AsyncClient) -> None:
    await client.post(
        "/api/v1/expenses/",
        json={
            "date": "2026-08-01",
            "title": "Groceries",
            "value": 100,
            "category": "Supermarket",
            "payment_method": "Nubank",
        },
    )
    await client.post(
        "/api/v1/expenses/",
        json={
            "date": "2026-08-05",
            "title": "More groceries",
            "value": 50,
            "category": "Supermarket",
            "payment_method": "Nubank",
        },
    )
    await client.post(
        "/api/v1/expenses/",
        json={
            "date": "2026-08-03",
            "title": "Ride",
            "value": 20,
            "category": "Uber",
            "payment_method": "Nubank",
        },
    )

    response = await client.get("/api/v1/expenses/summary")

    assert response.status_code == 200
    items = {item["category"]: item for item in response.json()["items"]}
    assert items["Supermarket"]["total"] == pytest.approx(150)
    assert items["Supermarket"]["count"] == 2
    assert items["Uber"]["total"] == pytest.approx(20)
    assert items["Uber"]["count"] == 1
    # Sorted by total descending.
    assert [item["category"] for item in response.json()["items"][:2]] == ["Supermarket", "Uber"]


async def test_expense_summary_filters_by_date_range(client: AsyncClient) -> None:
    await client.post(
        "/api/v1/expenses/",
        json={
            "date": "2026-08-01",
            "title": "In range",
            "value": 10,
            "category": "Uber",
            "payment_method": "Nubank",
        },
    )
    await client.post(
        "/api/v1/expenses/",
        json={
            "date": "2026-09-01",
            "title": "Out of range",
            "value": 999,
            "category": "Uber",
            "payment_method": "Nubank",
        },
    )

    response = await client.get(
        "/api/v1/expenses/summary",
        params={"date_from": "2026-08-01", "date_to": "2026-08-31"},
    )

    items = response.json()["items"]
    assert len(items) == 1
    assert items[0] == {"category": "Uber", "total": pytest.approx(10), "count": 1}


async def test_expense_summary_empty_when_no_expenses(client: AsyncClient) -> None:
    response = await client.get("/api/v1/expenses/summary")

    assert response.status_code == 200
    assert response.json()["items"] == []


async def test_monthly_summary_groups_by_year_month_category(client: AsyncClient) -> None:
    await client.post(
        "/api/v1/expenses/",
        json={
            "date": "2026-08-01",
            "title": "Groceries",
            "value": 100,
            "category": "Supermarket",
            "payment_method": "Nubank",
        },
    )
    await client.post(
        "/api/v1/expenses/",
        json={
            "date": "2026-08-20",
            "title": "More groceries",
            "value": 50,
            "category": "Supermarket",
            "payment_method": "Nubank",
        },
    )
    await client.post(
        "/api/v1/expenses/",
        json={
            "date": "2026-09-01",
            "title": "Ride",
            "value": 20,
            "category": "Uber",
            "payment_method": "Nubank",
        },
    )

    response = await client.get("/api/v1/expenses/summary-by-month")

    assert response.status_code == 200
    items = response.json()["items"]
    assert len(items) == 2
    august = next(item for item in items if item["month"] == 8)
    september = next(item for item in items if item["month"] == 9)
    assert august == {"year": 2026, "month": 8, "category": "Supermarket", "total": 150, "count": 2}
    assert september == {"year": 2026, "month": 9, "category": "Uber", "total": 20, "count": 1}
    # Sorted chronologically (year, then month).
    assert [item["month"] for item in items] == [8, 9]


async def test_monthly_summary_filters_by_date_range(client: AsyncClient) -> None:
    await client.post(
        "/api/v1/expenses/",
        json={
            "date": "2026-08-01",
            "title": "In range",
            "value": 10,
            "category": "Uber",
            "payment_method": "Nubank",
        },
    )
    await client.post(
        "/api/v1/expenses/",
        json={
            "date": "2026-09-01",
            "title": "Out of range",
            "value": 999,
            "category": "Uber",
            "payment_method": "Nubank",
        },
    )

    response = await client.get(
        "/api/v1/expenses/summary-by-month",
        params={"date_from": "2026-08-01", "date_to": "2026-08-31"},
    )

    items = response.json()["items"]
    assert len(items) == 1
    assert items[0] == {"year": 2026, "month": 8, "category": "Uber", "total": 10, "count": 1}


async def test_monthly_summary_empty_when_no_expenses(client: AsyncClient) -> None:
    response = await client.get("/api/v1/expenses/summary-by-month")

    assert response.status_code == 200
    assert response.json()["items"] == []


def _pdf_text(content: bytes) -> str:
    reader = PdfReader(BytesIO(content))
    return "\n".join(page.extract_text() for page in reader.pages)


async def test_monthly_summary_pdf_returns_pivot_table(client: AsyncClient) -> None:
    await client.post(
        "/api/v1/expenses/",
        json={
            "date": "2026-08-01",
            "title": "Groceries",
            "value": 100,
            "category": "Supermarket",
            "payment_method": "Nubank",
        },
    )
    await client.post(
        "/api/v1/expenses/",
        json={
            "date": "2026-09-01",
            "title": "Ride",
            "value": 20,
            "category": "Uber",
            "payment_method": "Nubank",
        },
    )

    response = await client.get(
        "/api/v1/expenses/summary-by-month/pdf",
        params={"categories": ["Supermarket", "Uber"]},
    )

    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    assert 'attachment; filename="relatorio_mensal_todos_os_periodos.pdf"' in (
        response.headers["content-disposition"]
    )
    assert response.content.startswith(b"%PDF")

    text = _pdf_text(response.content)
    assert "Supermarket" in text
    assert "Uber" in text
    assert "08/2026" in text
    assert "09/2026" in text
    assert "R$ 100,00" in text
    assert "R$ 20,00" in text
    assert "R$ 120,00" in text  # grand total


async def test_monthly_summary_pdf_excludes_unselected_categories(client: AsyncClient) -> None:
    await client.post(
        "/api/v1/expenses/",
        json={
            "date": "2026-08-01",
            "title": "Groceries",
            "value": 100,
            "category": "Supermarket",
            "payment_method": "Nubank",
        },
    )
    await client.post(
        "/api/v1/expenses/",
        json={
            "date": "2026-08-01",
            "title": "Ride",
            "value": 20,
            "category": "Uber",
            "payment_method": "Nubank",
        },
    )

    response = await client.get(
        "/api/v1/expenses/summary-by-month/pdf",
        params={"categories": ["Supermarket"]},
    )

    assert response.status_code == 200
    text = _pdf_text(response.content)
    assert "Supermarket" in text
    assert "Uber" not in text


async def test_monthly_summary_pdf_filters_by_date_range(client: AsyncClient) -> None:
    await client.post(
        "/api/v1/expenses/",
        json={
            "date": "2026-08-01",
            "title": "In range",
            "value": 10,
            "category": "Uber",
            "payment_method": "Nubank",
        },
    )
    await client.post(
        "/api/v1/expenses/",
        json={
            "date": "2026-09-01",
            "title": "Out of range",
            "value": 999,
            "category": "Uber",
            "payment_method": "Nubank",
        },
    )

    response = await client.get(
        "/api/v1/expenses/summary-by-month/pdf",
        params={
            "categories": ["Uber"],
            "date_from": "2026-08-01",
            "date_to": "2026-08-31",
        },
    )

    assert response.status_code == 200
    assert 'filename="relatorio_mensal_2026-08-01_a_2026-08-31.pdf"' in (
        response.headers["content-disposition"]
    )
    text = _pdf_text(response.content)
    assert "R$ 10,00" in text
    assert "999" not in text


async def test_monthly_summary_pdf_requires_categories_param(client: AsyncClient) -> None:
    response = await client.get("/api/v1/expenses/summary-by-month/pdf")

    assert response.status_code == 422


async def test_monthly_summary_pdf_404_when_no_expense_matches(client: AsyncClient) -> None:
    await client.post(
        "/api/v1/expenses/",
        json={
            "date": "2026-08-01",
            "title": "Groceries",
            "value": 100,
            "category": "Supermarket",
            "payment_method": "Nubank",
        },
    )

    response = await client.get(
        "/api/v1/expenses/summary-by-month/pdf",
        params={"categories": ["Uber"]},
    )

    assert response.status_code == 404
