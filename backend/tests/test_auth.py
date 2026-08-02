import asyncio

from httpx import AsyncClient

from tests.conftest import register as _register


async def test_register_creates_user_and_returns_token(client: AsyncClient):
    response = await _register(client)
    assert response.status_code == 201
    body = response.json()
    assert body["user"]["email"] == "alice@test.com"
    assert body["user"]["username"] == "alice"
    assert "access_token" in body


async def test_register_rejects_duplicate_email(client: AsyncClient):
    await _register(client)
    response = await _register(client, username="alice2")
    assert response.status_code == 409


async def test_register_rejects_duplicate_username(client: AsyncClient):
    await _register(client)
    response = await _register(client, email="someoneelse@test.com")
    assert response.status_code == 409


async def test_login_with_correct_credentials_succeeds(client: AsyncClient):
    await _register(client)
    response = await client.post(
        "/auth/login", json={"email": "alice@test.com", "password": "password123"}
    )
    assert response.status_code == 200
    assert "access_token" in response.json()


async def test_login_with_wrong_password_is_rejected(client: AsyncClient):
    await _register(client)
    response = await client.post(
        "/auth/login", json={"email": "alice@test.com", "password": "wrong-password"}
    )
    assert response.status_code == 401


async def test_login_with_unknown_email_is_rejected(client: AsyncClient):
    response = await client.post(
        "/auth/login", json={"email": "nobody@test.com", "password": "password123"}
    )
    assert response.status_code == 401


async def test_me_requires_authentication(client: AsyncClient):
    response = await client.get("/auth/me")
    assert response.status_code == 401


async def test_me_returns_current_user_with_valid_token(client: AsyncClient):
    register_response = await _register(client)
    token = register_response.json()["access_token"]
    response = await client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    assert response.json()["username"] == "alice"


async def test_me_rejects_garbage_token(client: AsyncClient):
    response = await client.get("/auth/me", headers={"Authorization": "Bearer not-a-real-token"})
    assert response.status_code == 401


async def test_concurrent_duplicate_registration_never_returns_500(client: AsyncClient):
    """Both requests pass the pre-check before either commits; the DB unique constraint
    catches the loser — it must surface as a clean 409, never a raw unhandled 500."""
    responses = await asyncio.gather(
        client.post(
            "/auth/register",
            json={"email": "race@test.com", "username": "racer1", "password": "password123"},
        ),
        client.post(
            "/auth/register",
            json={"email": "race@test.com", "username": "racer2", "password": "password123"},
        ),
    )
    assert sorted(r.status_code for r in responses) == [201, 409]


async def test_logout_invalidates_existing_token(client: AsyncClient):
    register_response = await _register(client)
    headers = {"Authorization": f"Bearer {register_response.json()['access_token']}"}

    logout_response = await client.post("/auth/logout", headers=headers)
    assert logout_response.status_code == 204

    me_response = await client.get("/auth/me", headers=headers)
    assert me_response.status_code == 401


async def test_login_after_logout_issues_a_working_token(client: AsyncClient):
    register_response = await _register(client)
    old_headers = {"Authorization": f"Bearer {register_response.json()['access_token']}"}
    await client.post("/auth/logout", headers=old_headers)

    login_response = await client.post(
        "/auth/login", json={"email": "alice@test.com", "password": "password123"}
    )
    new_headers = {"Authorization": f"Bearer {login_response.json()['access_token']}"}

    assert (await client.get("/auth/me", headers=new_headers)).status_code == 200
    assert (await client.get("/auth/me", headers=old_headers)).status_code == 401
