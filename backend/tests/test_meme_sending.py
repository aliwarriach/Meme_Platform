"""Covers what's left of the pre-Phase-19 meme-sending API: the `/meme-sending/send` shim.

The inbox/sent/seen/react endpoints are gone — their behaviour now lives in
`test_messaging.py`, including the ported `test_cannot_send_a_meme_you_cannot_see` IDOR
regression. These tests exist to prove the feed's shipped "↗ Send" button keeps working
and that its writes land in the new conversation model.
"""

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


async def _post_meme(client: AsyncClient, user: dict, audience: str = "public") -> str:
    files = {"image": ("test.png", b"fake-bytes", "image/png")}
    response = await client.post(
        "/memes", files=files, data={"caption": "hi", "audiences": [audience]}, headers=auth_header(user)
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


async def test_send_shim_opens_a_conversation_and_posts_a_meme_message(client: AsyncClient):
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
    assert body["meme"]["id"] == meme_id
    assert body["status"] == "pending"  # recipient not connected to the socket in this test

    # The send is a message in a real thread now, not an isolated inbox row.
    conversations = await client.get("/messaging/conversations", headers=auth_header(bob))
    conversation = conversations.json()[0]
    assert conversation["other_user"]["username"] == "alice"
    assert conversation["unread_count"] == 1
    assert conversation["last_message"]["id"] == body["id"]
    assert conversation["last_message"]["kind"] == "meme"


async def test_send_shim_reuses_an_existing_conversation(client: AsyncClient):
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")
    await _become_friends(client, alice, bob)

    for _ in range(2):
        meme_id = await _post_meme(client, alice)
        response = await client.post(
            "/meme-sending/send",
            json={"recipient_id": bob["user"]["id"], "meme_id": meme_id},
            headers=auth_header(alice),
        )
        assert response.status_code == 201

    conversations = await client.get("/messaging/conversations", headers=auth_header(alice))
    assert len(conversations.json()) == 1


async def test_cannot_send_a_meme_you_cannot_see_through_the_shim(client: AsyncClient):
    """The Phase 16 IDOR fix must survive the shim's extra hop into messaging."""
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")
    carol = await create_user(client, "carol")
    await _become_friends(client, bob, carol)
    meme_id = await _post_meme(client, alice, audience="friends")

    response = await client.post(
        "/meme-sending/send",
        json={"recipient_id": carol["user"]["id"], "meme_id": meme_id},
        headers=auth_header(bob),
    )
    assert response.status_code == 404


def test_websocket_delivers_a_shimmed_send_in_real_time():
    with TestClient(app) as test_client:
        alice = test_client.post(
            "/auth/register",
            json={"email": "alice@ws.com", "username": "alice", "password": "password123"},
        ).json()
        bob = test_client.post(
            "/auth/register",
            json={"email": "bob@ws.com", "username": "bob", "password": "password123"},
        ).json()

        friendship_id = test_client.post(
            "/friends/requests", json={"username": "bob"}, headers=auth_header(alice)
        ).json()["id"]
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

            # A shimmed send is indistinguishable from any other meme message on the wire.
            frame = ws.receive_json()
            assert frame["type"] == "message_received"
            assert frame["message"]["kind"] == "meme"
            assert frame["message"]["sender"]["username"] == "alice"
