import re

from httpx import AsyncClient

from tests.conftest import auth_header
from tests.conftest import register as _register


async def _create_unverified_user(client: AsyncClient, username: str) -> dict:
    response = await _register(client, email=f"{username}@test.com", username=username)
    assert response.status_code == 201
    return response.json()


def _extract_otp(calls: list[dict]) -> str:
    assert len(calls) == 1
    match = re.search(r"\b(\d{6})\b", calls[0]["body"])
    assert match is not None
    return match.group(1)


async def test_request_otp_sends_email_and_confirm_verifies(client: AsyncClient, mock_gmail_send):
    alice = await _create_unverified_user(client, "alice")

    request_response = await client.post(
        "/auth/email/verify/request", headers=auth_header(alice)
    )
    assert request_response.status_code == 204
    otp = _extract_otp(mock_gmail_send)

    confirm_response = await client.post(
        "/auth/email/verify/confirm", json={"code": otp}, headers=auth_header(alice)
    )
    assert confirm_response.status_code == 204

    me = await client.get("/auth/me", headers=auth_header(alice))
    assert me.json()["email_verified_at"] is not None


async def test_confirm_with_wrong_code_is_rejected(client: AsyncClient, mock_gmail_send):
    alice = await _create_unverified_user(client, "alice")
    await client.post("/auth/email/verify/request", headers=auth_header(alice))

    response = await client.post(
        "/auth/email/verify/confirm", json={"code": "000000"}, headers=auth_header(alice)
    )
    assert response.status_code == 400

    me = await client.get("/auth/me", headers=auth_header(alice))
    assert me.json()["email_verified_at"] is None


async def test_confirm_without_requesting_is_rejected(client: AsyncClient):
    alice = await _create_unverified_user(client, "alice")
    response = await client.post(
        "/auth/email/verify/confirm", json={"code": "123456"}, headers=auth_header(alice)
    )
    assert response.status_code == 400


async def test_too_many_wrong_attempts_locks_out_the_code(client: AsyncClient, mock_gmail_send):
    alice = await _create_unverified_user(client, "alice")
    await client.post("/auth/email/verify/request", headers=auth_header(alice))

    for _ in range(5):
        response = await client.post(
            "/auth/email/verify/confirm", json={"code": "000000"}, headers=auth_header(alice)
        )
        assert response.status_code == 400

    locked_out = await client.post(
        "/auth/email/verify/confirm", json={"code": "000000"}, headers=auth_header(alice)
    )
    assert locked_out.status_code == 429

    # The correct code no longer works either — attempts exhaustion clears it, matching
    # the "request a new code" message.
    otp = _extract_otp(mock_gmail_send)
    still_locked = await client.post(
        "/auth/email/verify/confirm", json={"code": otp}, headers=auth_header(alice)
    )
    assert still_locked.status_code == 400


async def test_requesting_again_after_verified_is_rejected(client: AsyncClient, mock_gmail_send):
    alice = await _create_unverified_user(client, "alice")
    await client.post("/auth/email/verify/request", headers=auth_header(alice))
    otp = _extract_otp(mock_gmail_send)
    await client.post(
        "/auth/email/verify/confirm", json={"code": otp}, headers=auth_header(alice)
    )

    response = await client.post("/auth/email/verify/request", headers=auth_header(alice))
    assert response.status_code == 409


async def test_unverified_user_cannot_generate_ai_caption(client: AsyncClient):
    alice = await _create_unverified_user(client, "alice")
    response = await client.post(
        "/ai-caption/generate",
        json={"context": "a cat", "current_caption": None},
        headers=auth_header(alice),
    )
    assert response.status_code == 403


async def test_unverified_user_cannot_vote(client: AsyncClient):
    alice = await _create_unverified_user(client, "alice")
    bob = await _create_unverified_user(client, "bob")

    files = {"image": ("test.png", b"fake-bytes", "image/png")}
    meme = await client.post(
        "/memes",
        files=files,
        data={"caption": "hi", "audiences": ["public"]},
        headers=auth_header(bob),
    )

    response = await client.post(
        f"/memes/{meme.json()['id']}/votes", json={"value": 1}, headers=auth_header(alice)
    )
    assert response.status_code == 403


async def test_unverified_user_cannot_create_community(client: AsyncClient):
    alice = await _create_unverified_user(client, "alice")
    response = await client.post(
        "/communities",
        data={"name": "Test Community", "privacy": "open"},
        headers=auth_header(alice),
    )
    assert response.status_code == 403


async def test_unverified_user_cannot_start_a_new_conversation(client: AsyncClient):
    alice = await _create_unverified_user(client, "alice")
    bob = await _create_unverified_user(client, "bob")

    request = await client.post(
        "/friends/requests", json={"username": "bob"}, headers=auth_header(alice)
    )
    await client.post(f"/friends/requests/{request.json()['id']}/accept", headers=auth_header(bob))

    response = await client.post(
        "/messaging/conversations", json={"user_id": bob["user"]["id"]}, headers=auth_header(alice)
    )
    assert response.status_code == 403
