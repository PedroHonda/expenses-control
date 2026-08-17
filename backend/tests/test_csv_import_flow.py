from pathlib import Path

import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.usefixtures("seeded_categories")

FIXTURE_PATH = Path(__file__).parent / "fixtures" / "sample_bank_export.csv"


async def test_upload_csv_parses_without_persisting_anything(client: AsyncClient) -> None:
    with FIXTURE_PATH.open("rb") as f:
        response = await client.post(
            "/api/v1/expenses/upload-csv",
            files={"file": ("sample_bank_export.csv", f, "text/csv")},
        )

    assert response.status_code == 200
    body = response.json()
    assert len(body["rows"]) == 3

    payment_row = next(r for r in body["rows"] if r["category"] == "Payment/Refund")
    assert payment_row["value"] == pytest.approx(2403.28)
    assert payment_row["missing_required"] == []

    purchase_rows = [r for r in body["rows"] if r["category"] is None]
    assert len(purchase_rows) == 2
    assert all(r["missing_required"] == ["category"] for r in purchase_rows)

    # Stage 1 is parse-only: nothing should be in the database yet.
    list_response = await client.get("/api/v1/expenses/")
    assert list_response.json()["total"] == 0


async def test_upload_csv_rejects_non_csv_extension(client: AsyncClient) -> None:
    response = await client.post(
        "/api/v1/expenses/upload-csv",
        files={"file": ("not-a-csv.txt", b"date,title,amount\n", "text/plain")},
    )

    assert response.status_code == 400


async def test_import_batch_is_all_or_nothing(client: AsyncClient) -> None:
    payload = {
        "expenses": [
            {"date": "2026-08-01", "title": "Valid", "value": 10, "category": "Food"},
            {"date": "2026-08-02", "title": "Invalid category", "value": 20, "category": "NotReal"},
        ]
    }

    response = await client.post("/api/v1/expenses/import-batch", json=payload)

    assert response.status_code == 422
    assert response.json()["detail"][0]["index"] == 1

    list_response = await client.get("/api/v1/expenses/")
    assert list_response.json()["total"] == 0


async def test_import_batch_success_returns_real_ids(client: AsyncClient) -> None:
    """Regression test for a Phase 2 bug: Expense.insert_many() doesn't
    populate .id on the inserted Document objects, so the response used to
    come back with id: "None" even though the DB write itself was correct."""
    payload = {
        "expenses": [
            {"date": "2026-08-01", "title": "A", "value": 10, "category": "Food"},
            {"date": "2026-08-02", "title": "B", "value": 20, "category": "Shopping"},
        ]
    }

    response = await client.post("/api/v1/expenses/import-batch", json=payload)

    assert response.status_code == 201
    body = response.json()
    assert body["count"] == 2
    ids = [item["id"] for item in body["created"]]
    assert all(len(item_id) == 24 for item_id in ids), ids
    assert len(set(ids)) == 2  # distinct, real ObjectIds

    list_response = await client.get("/api/v1/expenses/")
    assert list_response.json()["total"] == 2
