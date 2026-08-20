import re

from httpx import AsyncClient

from tests.conftest import auth_header, create_user


def _extract_otp(calls: list[dict]) -> str:
    assert len(calls) == 1
    match = re.search(r"\b(\d{6})\b", calls[0]["body"])
    assert match is not None
    return match.group(1)


async def test_request_reset_always_succeeds_even_for_unknown_email(
    client: AsyncClient, mock_gmail_send
):
    """SecurityIssues.md L-1's account-existence-oracle rule extends to this endpoint —
    it must not be usable to test whether an email is registered."""
    response = await client.post(
        "/auth/password-reset/request", json={"email": "nobody@test.com"}
    )
    assert response.status_code == 204
    assert mock_gmail_send == []


async def test_reset_confirm_changes_password_and_revokes_existing_sessions(
    client: AsyncClient, mock_gmail_send
):
    alice = await create_user(client, "alice")
    old_token_header = auth_header(alice)

    await client.post("/auth/password-reset/request", json={"email": "alice@test.com"})
    otp = _extract_otp(mock_gmail_send)

    confirm = await client.post(
        "/auth/password-reset/confirm",
        json={"email": "alice@test.com", "code": otp, "new_password": "new-password-456"},
    )
    assert confirm.status_code == 204

    # The old session is dead.
    me = await client.get("/auth/me", headers=old_token_header)
    assert me.status_code == 401

    # The new password works.
    login = await client.post(
        "/auth/login", json={"email": "alice@test.com", "password": "new-password-456"}
    )
    assert login.status_code == 200

    # The old password doesn't.
    old_login = await client.post(
        "/auth/login", json={"email": "alice@test.com", "password": "password123"}
    )
    assert old_login.status_code == 401


async def test_reset_confirm_with_wrong_code_is_rejected(client: AsyncClient, mock_gmail_send):
    await create_user(client, "alice")
    await client.post("/auth/password-reset/request", json={"email": "alice@test.com"})

    response = await client.post(
        "/auth/password-reset/confirm",
        json={"email": "alice@test.com", "code": "000000", "new_password": "new-password-456"},
    )
    assert response.status_code == 400


async def test_reset_confirm_without_requesting_is_rejected(client: AsyncClient):
    await create_user(client, "alice")
    response = await client.post(
        "/auth/password-reset/confirm",
        json={"email": "alice@test.com", "code": "123456", "new_password": "new-password-456"},
    )
    assert response.status_code == 400


async def test_reset_locks_out_after_too_many_attempts(client: AsyncClient, mock_gmail_send):
    await create_user(client, "alice")
    await client.post("/auth/password-reset/request", json={"email": "alice@test.com"})

    for _ in range(5):
        response = await client.post(
            "/auth/password-reset/confirm",
            json={
                "email": "alice@test.com",
                "code": "000000",
                "new_password": "new-password-456",
            },
        )
        assert response.status_code == 400

    locked_out = await client.post(
        "/auth/password-reset/confirm",
        json={"email": "alice@test.com", "code": "000000", "new_password": "new-password-456"},
    )
    assert locked_out.status_code == 429


async def test_change_password_requires_correct_current_password(client: AsyncClient):
    alice = await create_user(client, "alice")

    wrong = await client.post(
        "/auth/change-password",
        json={"current_password": "not-the-password", "new_password": "new-password-456"},
        headers=auth_header(alice),
    )
    assert wrong.status_code == 401

    right = await client.post(
        "/auth/change-password",
        json={"current_password": "password123", "new_password": "new-password-456"},
        headers=auth_header(alice),
    )
    assert right.status_code == 204

    # Changing password also revokes the session that made the change.
    me = await client.get("/auth/me", headers=auth_header(alice))
    assert me.status_code == 401

    login = await client.post(
        "/auth/login", json={"email": "alice@test.com", "password": "new-password-456"}
    )
    assert login.status_code == 200
