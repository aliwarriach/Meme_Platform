from httpx import AsyncClient

from tests.conftest import auth_header, create_user


async def test_friend_request_notification_does_not_hang(client: AsyncClient):
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")
    response = await client.post(
        "/friends/requests", json={"username": bob["user"]["username"]}, headers=auth_header(alice)
    )
    assert response.status_code == 201


async def test_a_second_test_after_a_notification_runs_fine(client: AsyncClient):
    alice = await create_user(client, "alice")
    assert alice["user"]["username"] == "alice"
