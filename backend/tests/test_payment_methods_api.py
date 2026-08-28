import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.usefixtures("seeded_payment_methods")


async def test_list_payment_methods_returns_the_3_seeded_defaults(client: AsyncClient) -> None:
    response = await client.get("/api/v1/payment-methods/")

    assert response.status_code == 200
    body = response.json()
    names = {m["name"] for m in body}
    assert len(body) == 3
    assert names == {"Nubank", "Pix", "Mercado Pago"}
    assert all(m["is_default"] is True for m in body)
    by_name = {m["name"]: m for m in body}
    assert by_name["Nubank"]["is_default_for_import"] is True
    assert by_name["Pix"]["is_default_for_import"] is False
    assert by_name["Mercado Pago"]["is_default_for_import"] is False


async def test_create_payment_method(client: AsyncClient) -> None:
    response = await client.post("/api/v1/payment-methods/", json={"name": "Cash"})

    assert response.status_code == 201
    body = response.json()
    assert body["name"] == "Cash"
    assert body["is_default"] is False
    assert body["is_default_for_import"] is False
    assert body["id"]


async def test_create_duplicate_payment_method_is_rejected_case_insensitively(
    client: AsyncClient,
) -> None:
    response = await client.post("/api/v1/payment-methods/", json={"name": "nubank"})

    assert response.status_code == 409


async def test_create_payment_method_empty_name_is_rejected(client: AsyncClient) -> None:
    response = await client.post("/api/v1/payment-methods/", json={"name": ""})

    assert response.status_code == 422


async def test_update_payment_method_sets_a_new_exclusive_default(client: AsyncClient) -> None:
    list_response = await client.get("/api/v1/payment-methods/")
    pix_id = next(m["id"] for m in list_response.json() if m["name"] == "Pix")

    response = await client.patch(
        f"/api/v1/payment-methods/{pix_id}", json={"is_default_for_import": True}
    )

    assert response.status_code == 200
    assert response.json()["is_default_for_import"] is True

    # Exclusive: Nubank (the previous default) must now be unset.
    list_response = await client.get("/api/v1/payment-methods/")
    by_name = {m["name"]: m for m in list_response.json()}
    assert by_name["Pix"]["is_default_for_import"] is True
    assert by_name["Nubank"]["is_default_for_import"] is False
    assert by_name["Mercado Pago"]["is_default_for_import"] is False


async def test_update_payment_method_rejects_unsetting_the_default_directly(
    client: AsyncClient,
) -> None:
    list_response = await client.get("/api/v1/payment-methods/")
    nubank_id = next(m["id"] for m in list_response.json() if m["name"] == "Nubank")

    response = await client.patch(
        f"/api/v1/payment-methods/{nubank_id}", json={"is_default_for_import": False}
    )

    assert response.status_code == 400


async def test_update_payment_method_not_found(client: AsyncClient) -> None:
    response = await client.patch(
        "/api/v1/payment-methods/000000000000000000000000",
        json={"is_default_for_import": True},
    )

    assert response.status_code == 404


async def test_update_payment_method_invalid_id_format(client: AsyncClient) -> None:
    response = await client.patch(
        "/api/v1/payment-methods/not-a-valid-id", json={"is_default_for_import": True}
    )

    assert response.status_code == 404
