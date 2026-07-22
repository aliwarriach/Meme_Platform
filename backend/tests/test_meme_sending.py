from fastapi.testclient import TestClient
from httpx import AsyncClient

from app.main import app
from tests.conftest import auth_header, create_user


async def _become_friends(client: AsyncClient, alice: dict, bob: dict) -> None:
    request_response = await client.post(
        "/friends/requests", json={"username": bob["user"]["username"]}, headers=auth_header(alice)
    )
    friendship_id = request_response.json()["id"]
    await client.post(f"/friends/requests/{friendship_id}/accept", headers=auth_header(bob))


async def _post_meme(client: AsyncClient, user: dict) -> str:
    files = {"image": ("test.png", b"fake-bytes", "image/png")}
    response = await client.post(
        "/memes", files=files, data={"caption": "hi", "audiences": ["public"]}, headers=auth_header(user)
    )
    return response.json()["id"]


async def test_send_meme_requires_friendship(client: AsyncClient):
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")
    meme_id = await _post_meme(client, alice)

    response = await client.post(
        "/meme-sending/send",
        json={"recipient_id": bob["user"]["id"], "meme_id": meme_id},
        headers=auth_header(alice),
    )
    assert response.status_code == 403


async def test_send_meme_between_friends_succeeds_and_lands_in_inbox(client: AsyncClient):
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")
    await _become_friends(client, alice, bob)
    meme_id = await _post_meme(client, alice)

    send_response = await client.post(
        "/meme-sending/send",
        json={"recipient_id": bob["user"]["id"], "meme_id": meme_id},
        headers=auth_header(alice),
    )
    assert send_response.status_code == 201
    body = send_response.json()
    assert body["sender"]["username"] == "alice"
    assert body["recipient"]["username"] == "bob"
    assert body["status"] == "pending"  # recipient not connected to the socket in this test

    inbox_response = await client.get("/meme-sending/inbox", headers=auth_header(bob))
    assert inbox_response.status_code == 200
    inbox = inbox_response.json()
    assert len(inbox) == 1
    assert inbox[0]["id"] == body["id"]

    sent_response = await client.get("/meme-sending/sent", headers=auth_header(alice))
    assert len(sent_response.json()) == 1


async def test_send_nonexistent_meme_rejected(client: AsyncClient):
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")
    await _become_friends(client, alice, bob)

    response = await client.post(
        "/meme-sending/send",
        json={"recipient_id": bob["user"]["id"], "meme_id": "00000000-0000-0000-0000-000000000000"},
        headers=auth_header(alice),
    )
    assert response.status_code == 404


async def test_recipient_can_mark_seen(client: AsyncClient):
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")
    await _become_friends(client, alice, bob)
    meme_id = await _post_meme(client, alice)

    send_response = await client.post(
        "/meme-sending/send",
        json={"recipient_id": bob["user"]["id"], "meme_id": meme_id},
        headers=auth_header(alice),
    )
    send_id = send_response.json()["id"]

    seen_response = await client.post(f"/meme-sending/inbox/{send_id}/seen", headers=auth_header(bob))
    assert seen_response.status_code == 200
    assert seen_response.json()["status"] == "seen"


async def test_sender_cannot_mark_own_send_seen(client: AsyncClient):
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")
    await _become_friends(client, alice, bob)
    meme_id = await _post_meme(client, alice)

    send_response = await client.post(
        "/meme-sending/send",
        json={"recipient_id": bob["user"]["id"], "meme_id": meme_id},
        headers=auth_header(alice),
    )
    send_id = send_response.json()["id"]

    response = await client.post(f"/meme-sending/inbox/{send_id}/seen", headers=auth_header(alice))
    assert response.status_code == 403


async def test_recipient_can_react_and_sender_sees_reaction(client: AsyncClient):
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")
    await _become_friends(client, alice, bob)
    meme_id = await _post_meme(client, alice)

    send_response = await client.post(
        "/meme-sending/send",
        json={"recipient_id": bob["user"]["id"], "meme_id": meme_id},
        headers=auth_header(alice),
    )
    send_id = send_response.json()["id"]

    react_response = await client.post(
        f"/meme-sending/inbox/{send_id}/react",
        json={"reaction": "😂"},
        headers=auth_header(bob),
    )
    assert react_response.status_code == 200
    assert react_response.json()["reaction"] == "😂"

    sent_response = await client.get("/meme-sending/sent", headers=auth_header(alice))
    assert sent_response.json()[0]["reaction"] == "😂"


async def test_websocket_delivers_meme_in_real_time():
    with TestClient(app) as test_client:
        alice = test_client.post(
            "/auth/register",
            json={"email": "alice@ws.com", "username": "alice", "password": "password123"},
        ).json()
        bob = test_client.post(
            "/auth/register",
            json={"email": "bob@ws.com", "username": "bob", "password": "password123"},
        ).json()

        request_response = test_client.post(
            "/friends/requests",
            json={"username": "bob"},
            headers=auth_header(alice),
        )
        friendship_id = request_response.json()["id"]
        test_client.post(f"/friends/requests/{friendship_id}/accept", headers=auth_header(bob))

        files = {"image": ("test.png", b"fake-bytes", "image/png")}
        meme_id = test_client.post(
            "/memes",
            files=files,
            data={"caption": "hi", "audiences": ["public"]},
            headers=auth_header(alice),
        ).json()["id"]

        with test_client.websocket_connect(f"/meme-sending/ws?token={bob['access_token']}") as ws:
            send_response = test_client.post(
                "/meme-sending/send",
                json={"recipient_id": bob["user"]["id"], "meme_id": meme_id},
                headers=auth_header(alice),
            )
            assert send_response.status_code == 201
            assert send_response.json()["status"] == "delivered"

            message = ws.receive_json()
            assert message["type"] == "meme_received"
            assert message["send"]["sender"]["username"] == "alice"
