import uuid

from fastapi.testclient import TestClient
from httpx import AsyncClient
from sqlalchemy import select

from app.main import app
from app.models.notification import NotificationType, PushToken
from app.services import notifications as notifications_service
from tests.conftest import TestSessionFactory, auth_header, create_user


async def _seed_notifications(user_id: str, count: int) -> None:
    async with TestSessionFactory() as session:
        for i in range(count):
            await notifications_service.notify_one(
                session,
                uuid.UUID(user_id),
                NotificationType.challenge_results,
                title=f"Notification {i}",
                body="body",
                data={},
            )


async def test_push_token_register_is_idempotent_upsert(client: AsyncClient):
    alice = await create_user(client, "alice")

    first = await client.post(
        "/notifications/push-token",
        json={"token": "expo-token-1", "platform": "android"},
        headers=auth_header(alice),
    )
    assert first.status_code == 204

    # Registering the same token again (e.g. app relaunch) must not error or duplicate.
    second = await client.post(
        "/notifications/push-token",
        json={"token": "expo-token-1", "platform": "android"},
        headers=auth_header(alice),
    )
    assert second.status_code == 204


async def test_push_token_moves_to_new_owner_on_reregister(client: AsyncClient):
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")

    await client.post(
        "/notifications/push-token",
        json={"token": "shared-device", "platform": "ios"},
        headers=auth_header(alice),
    )
    # bob logs into the same device — the token must move to him, not duplicate.
    response = await client.post(
        "/notifications/push-token",
        json={"token": "shared-device", "platform": "ios"},
        headers=auth_header(bob),
    )
    assert response.status_code == 204

    async with TestSessionFactory() as session:
        rows = (
            await session.execute(select(PushToken).where(PushToken.token == "shared-device"))
        ).scalars().all()
    assert len(rows) == 1
    assert str(rows[0].user_id) == bob["user"]["id"]


async def test_push_token_unregister(client: AsyncClient):
    alice = await create_user(client, "alice")
    await client.post(
        "/notifications/push-token",
        json={"token": "expo-token-2", "platform": "android"},
        headers=auth_header(alice),
    )
    response = await client.delete(
        "/notifications/push-token",
        params={"token": "expo-token-2"},
        headers=auth_header(alice),
    )
    assert response.status_code == 204


async def test_list_notifications_keyset_pagination(client: AsyncClient):
    alice = await create_user(client, "alice")
    await _seed_notifications(alice["user"]["id"], 5)

    first_page = await client.get(
        "/notifications", params={"limit": 2}, headers=auth_header(alice)
    )
    assert first_page.status_code == 200
    body = first_page.json()
    assert len(body["items"]) == 2
    assert body["next_cursor"] is not None

    second_page = await client.get(
        "/notifications",
        params={"limit": 2, "cursor": body["next_cursor"]},
        headers=auth_header(alice),
    )
    assert len(second_page.json()["items"]) == 2
    assert {i["id"] for i in body["items"]}.isdisjoint(
        {i["id"] for i in second_page.json()["items"]}
    )


async def test_unread_count_and_mark_read(client: AsyncClient):
    alice = await create_user(client, "alice")
    await _seed_notifications(alice["user"]["id"], 3)

    unread = await client.get("/notifications/unread-count", headers=auth_header(alice))
    assert unread.json()["count"] == 3

    items = (await client.get("/notifications", headers=auth_header(alice))).json()["items"]
    read = await client.post(
        f"/notifications/{items[0]['id']}/read", headers=auth_header(alice)
    )
    assert read.status_code == 200
    assert read.json()["read_at"] is not None

    unread = await client.get("/notifications/unread-count", headers=auth_header(alice))
    assert unread.json()["count"] == 2


async def test_mark_read_is_scoped_to_owner(client: AsyncClient):
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")
    await _seed_notifications(alice["user"]["id"], 1)
    items = (await client.get("/notifications", headers=auth_header(alice))).json()["items"]

    response = await client.post(
        f"/notifications/{items[0]['id']}/read", headers=auth_header(bob)
    )
    assert response.status_code == 404


async def test_mark_all_read(client: AsyncClient):
    alice = await create_user(client, "alice")
    await _seed_notifications(alice["user"]["id"], 4)

    response = await client.post("/notifications/read-all", headers=auth_header(alice))
    assert response.status_code == 200
    assert response.json()["read_count"] == 4

    # Idempotent — nothing left to mark.
    response = await client.post("/notifications/read-all", headers=auth_header(alice))
    assert response.json()["read_count"] == 0

    unread = await client.get("/notifications/unread-count", headers=auth_header(alice))
    assert unread.json()["count"] == 0


def test_websocket_delivers_notification_in_real_time():
    with TestClient(app) as test_client:
        alice = test_client.post(
            "/auth/register",
            json={"email": "alice@notif.com", "username": "alice", "password": "password123"},
        ).json()
        bob = test_client.post(
            "/auth/register",
            json={"email": "bob@notif.com", "username": "bob", "password": "password123"},
        ).json()

        friendship_id = test_client.post(
            "/friends/requests", json={"username": "bob"}, headers=auth_header(alice)
        ).json()["id"]
        test_client.post(f"/friends/requests/{friendship_id}/accept", headers=auth_header(bob))

        with test_client.websocket_connect(f"/meme-sending/ws?token={bob['access_token']}") as ws:
            propose = test_client.post(
                f"/challenges/duels/{bob['user']['id']}",
                json={
                    "title": "Live Duel",
                    "start_time": "2020-01-01T00:00:00+00:00",
                    "end_time": "2099-01-01T00:00:00+00:00",
                },
                headers=auth_header(alice),
            )
            assert propose.status_code == 201

            frame = ws.receive_json()
            assert frame["type"] == "notification"
            assert frame["notification"]["type"] == "challenge_invite"
