from datetime import datetime, timedelta

import pytest

ADAPTER_SECRET_VAL = "test-adapter-secret"


@pytest.fixture(autouse=True)
def _set_adapter_secret(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("ADAPTER_SECRET", ADAPTER_SECRET_VAL)


def _headers(include_secret: bool = True):
    headers = {"Content-Type": "application/json"}
    if include_secret:
        headers["X-Adapter-Secret"] = ADAPTER_SECRET_VAL
    return headers


@pytest.mark.integration
async def test_unauthorized_without_secret(client):
    resp = await client.get("/api/internal/auth/users/00000000-0000-0000-0000-000000000000")
    assert resp.status_code == 401


@pytest.mark.integration
async def test_auth_adapter_crud_flow(client):
    email = "user@example.com"

    # 1) Create user
    resp = await client.post(
        "/api/internal/auth/users",
        headers=_headers(),
        json={"email": email, "name": "Alice"},
    )
    assert resp.status_code == 200, resp.text
    user = resp.json()
    assert user["email"] == email
    assert user["credits_balance"] == 10000
    user_id = user["id"]

    # 2) Get user by id
    resp = await client.get(f"/api/internal/auth/users/{user_id}", headers=_headers())
    assert resp.status_code == 200
    assert resp.json()["id"] == user_id

    # 3) Get user by email
    resp = await client.get(f"/api/internal/auth/users/by-email/{email}", headers=_headers())
    assert resp.status_code == 200
    assert resp.json()["id"] == user_id

    # 4) Link account
    provider = "google"
    provider_account_id = "acct-123"
    resp = await client.post(
        "/api/internal/auth/accounts",
        headers=_headers(),
        json={
            "user_id": user_id,
            "type": "oauth",
            "provider": provider,
            "provider_account_id": provider_account_id,
        },
    )
    assert resp.status_code == 200, resp.text
    account = resp.json()
    assert account["user_id"] == user_id

    # 5) Get user by account
    resp = await client.get(
        f"/api/internal/auth/users/by-account/{provider}/{provider_account_id}",
        headers=_headers(),
    )
    assert resp.status_code == 200
    got = resp.json()
    assert got and got["id"] == user_id

    # 6) Update user
    resp = await client.put(
        f"/api/internal/auth/users/{user_id}",
        headers=_headers(),
        json={"name": "Alice Updated"},
    )
    assert resp.status_code == 200
    assert resp.json()["name"] == "Alice Updated"

    # 7) Verification token create/use with hashing
    raw_token = "sometoken"
    expires = (datetime.utcnow() + timedelta(minutes=5)).isoformat()
    resp = await client.post(
        "/api/internal/auth/verification-tokens",
        headers=_headers(),
        json={"identifier": email, "token": raw_token, "expires": expires},
    )
    assert resp.status_code == 200
    vt = resp.json()
    assert vt["token"] == raw_token

    resp = await client.post(
        "/api/internal/auth/verification-tokens/use",
        headers=_headers(),
        json={"identifier": email, "token": raw_token},
    )
    assert resp.status_code == 200
    vt_used = resp.json()
    assert vt_used and vt_used["token"] == raw_token

    # Using again should return null
    resp = await client.post(
        "/api/internal/auth/verification-tokens/use",
        headers=_headers(),
        json={"identifier": email, "token": raw_token},
    )
    assert resp.status_code == 200
    assert resp.json() is None

    # 8) Unlink account
    resp = await client.delete(
        f"/api/internal/auth/accounts/{provider}/{provider_account_id}", headers=_headers()
    )
    assert resp.status_code == 204
    resp = await client.get(
        f"/api/internal/auth/users/by-account/{provider}/{provider_account_id}",
        headers=_headers(),
    )
    assert resp.status_code == 200
    assert resp.json() is None

    # 9) Delete user
    resp = await client.delete(f"/api/internal/auth/users/{user_id}", headers=_headers())
    assert resp.status_code == 204
    resp = await client.get(f"/api/internal/auth/users/{user_id}", headers=_headers())
    assert resp.status_code == 200
    assert resp.json() is None

