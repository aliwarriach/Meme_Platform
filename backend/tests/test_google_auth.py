import pytest
from httpx import AsyncClient

import app.services.google_auth as google_auth_service
from app.core.config import settings
from tests.conftest import auth_header, register

TEST_AUDIENCE = "test-client-id.apps.googleusercontent.com"


@pytest.fixture(autouse=True)
def _configure_google_signin(monkeypatch):
    monkeypatch.setattr(settings, "google_signin_client_ids", TEST_AUDIENCE)


def _mock_tokeninfo(monkeypatch, *, sub: str, email: str, aud: str = TEST_AUDIENCE, verified: str = "true"):
    async def _fake_fetch(id_token: str) -> dict:
        return {"sub": sub, "email": email, "aud": aud, "email_verified": verified}

    monkeypatch.setattr(google_auth_service, "_fetch_google_tokeninfo", _fake_fetch)


async def test_new_google_identity_starts_a_pending_registration(
    client: AsyncClient, monkeypatch
):
    _mock_tokeninfo(monkeypatch, sub="google-sub-1", email="newperson@gmail.example.com")

    response = await client.post("/auth/google", json={"id_token": "fake"})
    assert response.status_code == 202
    body = response.json()
    assert body["email"] == "newperson@gmail.example.com"
    assert "pending_token" in body


async def test_completing_registration_creates_a_verified_account(
    client: AsyncClient, monkeypatch
):
    _mock_tokeninfo(monkeypatch, sub="google-sub-2", email="newperson2@gmail.example.com")
    start = await client.post("/auth/google", json={"id_token": "fake"})
    pending_token = start.json()["pending_token"]

    complete = await client.post(
        "/auth/google/complete",
        json={"pending_token": pending_token, "username": "newgoogleuser", "date_of_birth": "2000-01-01"},
    )
    assert complete.status_code == 201
    body = complete.json()
    assert body["user"]["email"] == "newperson2@gmail.example.com"
    assert body["user"]["email_verified_at"] is not None

    # A second sign-in with the same Google identity now logs straight in (200, no
    # pending-registration step) rather than trying to create a duplicate account.
    again = await client.post("/auth/google", json={"id_token": "fake"})
    assert again.status_code == 200
    assert again.json()["user"]["username"] == "newgoogleuser"


async def test_completing_registration_rejects_under_13(client: AsyncClient, monkeypatch):
    _mock_tokeninfo(monkeypatch, sub="google-sub-3", email="kid@gmail.example.com")
    start = await client.post("/auth/google", json={"id_token": "fake"})
    pending_token = start.json()["pending_token"]

    response = await client.post(
        "/auth/google/complete",
        json={"pending_token": pending_token, "username": "kiduser", "date_of_birth": "2018-01-01"},
    )
    assert response.status_code == 400


async def test_completing_registration_rejects_taken_username(client: AsyncClient, monkeypatch):
    await register(client, email="taken@test.com", username="claimeduser")

    _mock_tokeninfo(monkeypatch, sub="google-sub-4", email="newperson4@gmail.example.com")
    start = await client.post("/auth/google", json={"id_token": "fake"})
    pending_token = start.json()["pending_token"]

    response = await client.post(
        "/auth/google/complete",
        json={"pending_token": pending_token, "username": "claimeduser", "date_of_birth": "2000-01-01"},
    )
    assert response.status_code == 409


async def test_google_pending_token_is_single_use(client: AsyncClient, monkeypatch):
    _mock_tokeninfo(monkeypatch, sub="google-sub-5", email="newperson5@gmail.example.com")
    start = await client.post("/auth/google", json={"id_token": "fake"})
    pending_token = start.json()["pending_token"]

    payload = {"pending_token": pending_token, "username": "onceuser", "date_of_birth": "2000-01-01"}
    first = await client.post("/auth/google/complete", json=payload)
    assert first.status_code == 201

    second = await client.post(
        "/auth/google/complete",
        json={**payload, "username": "onceuser2"},
    )
    assert second.status_code == 400


async def test_google_links_an_existing_unverified_password_account(
    client: AsyncClient, monkeypatch
):
    register_response = await register(client, email="linkme@test.com", username="linkme")
    old_token_header = auth_header(register_response.json())

    _mock_tokeninfo(monkeypatch, sub="google-sub-6", email="linkme@test.com")
    response = await client.post("/auth/google", json={"id_token": "fake"})
    assert response.status_code == 200
    assert response.json()["user"]["username"] == "linkme"
    assert response.json()["user"]["email_verified_at"] is not None

    # The original session still works — linking isn't a revocation event.
    me = await client.get("/auth/me", headers=old_token_header)
    assert me.status_code == 200


async def test_google_auth_rejects_wrong_audience(client: AsyncClient, monkeypatch):
    _mock_tokeninfo(monkeypatch, sub="google-sub-7", email="x@gmail.example.com", aud="someone-elses-app")
    response = await client.post("/auth/google", json={"id_token": "fake"})
    assert response.status_code == 401


async def test_google_auth_rejects_unverified_google_email(client: AsyncClient, monkeypatch):
    _mock_tokeninfo(monkeypatch, sub="google-sub-8", email="x@gmail.example.com", verified="false")
    response = await client.post("/auth/google", json={"id_token": "fake"})
    assert response.status_code == 401


async def test_google_auth_fails_cleanly_when_not_configured(client: AsyncClient, monkeypatch):
    monkeypatch.setattr(settings, "google_signin_client_ids", "")
    response = await client.post("/auth/google", json={"id_token": "fake"})
    assert response.status_code == 401


async def test_completing_registration_rejects_invalid_pending_token(client: AsyncClient):
    response = await client.post(
        "/auth/google/complete",
        json={"pending_token": "not-a-real-token", "username": "someone", "date_of_birth": "2000-01-01"},
    )
    assert response.status_code == 400
