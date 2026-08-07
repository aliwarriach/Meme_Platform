from fastapi.testclient import TestClient
from httpx import AsyncClient

from app.main import app
from tests.conftest import auth_header, create_user


async def _become_friends(client: AsyncClient, alice: dict, bob: dict) -> str:
    request_response = await client.post(
        "/friends/requests", json={"username": bob["user"]["username"]}, headers=auth_header(alice)
    )
    friendship_id = request_response.json()["id"]
    await client.post(f"/friends/requests/{friendship_id}/accept", headers=auth_header(bob))
    return friendship_id


async def _post_meme(client: AsyncClient, user: dict, audience: str = "public") -> str:
    files = {"image": ("test.png", b"fake-bytes", "image/png")}
    response = await client.post(
        "/memes", files=files, data={"caption": "hi", "audiences": [audience]}, headers=auth_header(user)
    )
    return response.json()["id"]


async def _open_conversation(client: AsyncClient, user: dict, other: dict) -> str:
    response = await client.post(
        "/messaging/conversations", json={"user_id": other["user"]["id"]}, headers=auth_header(user)
    )
    assert response.status_code == 201
    return response.json()["id"]


async def _send_text(client: AsyncClient, user: dict, conversation_id: str, body: str):
    return await client.post(
        f"/messaging/conversations/{conversation_id}/messages",
        json={"kind": "text", "body": body},
        headers=auth_header(user),
    )


async def test_cannot_open_conversation_with_non_friend(client: AsyncClient):
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")

    response = await client.post(
        "/messaging/conversations", json={"user_id": bob["user"]["id"]}, headers=auth_header(alice)
    )
    assert response.status_code == 403


async def test_opening_a_conversation_is_idempotent_from_both_sides(client: AsyncClient):
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")
    await _become_friends(client, alice, bob)

    first = await _open_conversation(client, alice, bob)
    # Same pair, opened from the other direction — the canonical participant ordering must
    # collapse this onto the same row rather than creating a mirrored duplicate thread.
    second = await _open_conversation(client, bob, alice)
    assert first == second

    alice_list = await client.get("/messaging/conversations", headers=auth_header(alice))
    assert len(alice_list.json()) == 1


async def test_text_conversation_round_trip(client: AsyncClient):
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")
    await _become_friends(client, alice, bob)
    conversation_id = await _open_conversation(client, alice, bob)

    assert (await _send_text(client, alice, conversation_id, "yo")).status_code == 201
    assert (await _send_text(client, bob, conversation_id, "sup")).status_code == 201

    history = await client.get(
        f"/messaging/conversations/{conversation_id}/messages", headers=auth_header(alice)
    )
    assert history.status_code == 200
    items = history.json()["items"]
    assert [m["body"] for m in items] == ["sup", "yo"]  # newest first
    assert items[0]["sender"]["username"] == "bob"
    assert items[0]["kind"] == "text"
    assert items[0]["meme"] is None

    conversations = await client.get("/messaging/conversations", headers=auth_header(alice))
    conversation = conversations.json()[0]
    assert conversation["other_user"]["username"] == "bob"
    assert conversation["last_message"]["body"] == "sup"
    assert conversation["unread_count"] == 1  # bob's message, not alice's own


async def test_meme_message_carries_the_full_meme(client: AsyncClient):
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")
    await _become_friends(client, alice, bob)
    conversation_id = await _open_conversation(client, alice, bob)
    meme_id = await _post_meme(client, alice)

    response = await client.post(
        f"/messaging/conversations/{conversation_id}/messages",
        json={"kind": "meme", "meme_id": meme_id},
        headers=auth_header(alice),
    )
    assert response.status_code == 201
    body = response.json()
    assert body["kind"] == "meme"
    assert body["meme"]["id"] == meme_id
    assert body["body"] is None


async def test_cannot_send_a_meme_you_cannot_see(client: AsyncClient):
    """Ported from `test_meme_sending.py` — the Phase 16 IDOR fix has to hold on the new
    endpoint, not just on the old one it replaced."""
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")
    carol = await create_user(client, "carol")
    await _become_friends(client, bob, carol)
    # bob is not friends with alice, so bob cannot see alice's friends-only meme — but if
    # he learns its ID, he must not be able to forward it to carol anyway.
    meme_id = await _post_meme(client, alice, audience="friends")
    conversation_id = await _open_conversation(client, bob, carol)

    response = await client.post(
        f"/messaging/conversations/{conversation_id}/messages",
        json={"kind": "meme", "meme_id": meme_id},
        headers=auth_header(bob),
    )
    assert response.status_code == 404


async def test_non_participant_cannot_read_or_write_a_conversation(client: AsyncClient):
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")
    mallory = await create_user(client, "mallory")
    await _become_friends(client, alice, bob)
    await _become_friends(client, alice, mallory)
    conversation_id = await _open_conversation(client, alice, bob)

    read = await client.get(
        f"/messaging/conversations/{conversation_id}/messages", headers=auth_header(mallory)
    )
    assert read.status_code == 403

    write = await _send_text(client, mallory, conversation_id, "let me in")
    assert write.status_code == 403


async def test_cannot_message_after_the_friendship_is_removed(client: AsyncClient):
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")
    friendship_id = await _become_friends(client, alice, bob)
    conversation_id = await _open_conversation(client, alice, bob)
    assert (await _send_text(client, alice, conversation_id, "hi")).status_code == 201

    await client.delete(f"/friends/{friendship_id}", headers=auth_header(alice))

    # The thread still exists, but an unfriended participant must not be able to write to it.
    assert (await _send_text(client, alice, conversation_id, "still here?")).status_code == 403


async def test_marking_read_clears_the_unread_count(client: AsyncClient):
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")
    await _become_friends(client, alice, bob)
    conversation_id = await _open_conversation(client, alice, bob)
    await _send_text(client, alice, conversation_id, "one")
    await _send_text(client, alice, conversation_id, "two")

    read = await client.post(
        f"/messaging/conversations/{conversation_id}/read", headers=auth_header(bob)
    )
    assert read.status_code == 200
    assert read.json()["read_count"] == 2

    conversations = await client.get("/messaging/conversations", headers=auth_header(bob))
    assert conversations.json()[0]["unread_count"] == 0

    # Idempotent: nothing left unread to mark.
    again = await client.post(
        f"/messaging/conversations/{conversation_id}/read", headers=auth_header(bob)
    )
    assert again.json()["read_count"] == 0


async def test_read_receipts_are_visible_to_the_sender(client: AsyncClient):
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")
    await _become_friends(client, alice, bob)
    conversation_id = await _open_conversation(client, alice, bob)
    await _send_text(client, alice, conversation_id, "seen this?")
    await client.post(f"/messaging/conversations/{conversation_id}/read", headers=auth_header(bob))

    history = await client.get(
        f"/messaging/conversations/{conversation_id}/messages", headers=auth_header(alice)
    )
    assert history.json()["items"][0]["read_at"] is not None


async def test_message_payload_must_match_its_kind(client: AsyncClient):
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")
    await _become_friends(client, alice, bob)
    conversation_id = await _open_conversation(client, alice, bob)
    meme_id = await _post_meme(client, alice)
    url = f"/messaging/conversations/{conversation_id}/messages"

    blank_text = await client.post(
        url, json={"kind": "text", "body": "   "}, headers=auth_header(alice)
    )
    assert blank_text.status_code == 422

    text_with_meme = await client.post(
        url, json={"kind": "text", "body": "hi", "meme_id": meme_id}, headers=auth_header(alice)
    )
    assert text_with_meme.status_code == 422

    meme_without_id = await client.post(url, json={"kind": "meme"}, headers=auth_header(alice))
    assert meme_without_id.status_code == 422


async def test_thread_history_is_keyset_paginated(client: AsyncClient):
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")
    await _become_friends(client, alice, bob)
    conversation_id = await _open_conversation(client, alice, bob)
    for i in range(5):
        await _send_text(client, alice, conversation_id, f"msg-{i}")

    first = await client.get(
        f"/messaging/conversations/{conversation_id}/messages?limit=2", headers=auth_header(bob)
    )
    first_page = first.json()
    assert [m["body"] for m in first_page["items"]] == ["msg-4", "msg-3"]
    assert first_page["next_cursor"] is not None

    second = await client.get(
        f"/messaging/conversations/{conversation_id}/messages?limit=2&cursor={first_page['next_cursor']}",
        headers=auth_header(bob),
    )
    second_page = second.json()
    assert [m["body"] for m in second_page["items"]] == ["msg-2", "msg-1"]

    last = await client.get(
        f"/messaging/conversations/{conversation_id}/messages?limit=2&cursor={second_page['next_cursor']}",
        headers=auth_header(bob),
    )
    assert [m["body"] for m in last.json()["items"]] == ["msg-0"]
    assert last.json()["next_cursor"] is None


async def test_conversations_are_ordered_by_most_recent_activity(client: AsyncClient):
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")
    carol = await create_user(client, "carol")
    await _become_friends(client, alice, bob)
    await _become_friends(client, alice, carol)

    with_bob = await _open_conversation(client, alice, bob)
    with_carol = await _open_conversation(client, alice, carol)
    await _send_text(client, alice, with_carol, "first")
    await _send_text(client, alice, with_bob, "later")

    conversations = await client.get("/messaging/conversations", headers=auth_header(alice))
    assert [c["id"] for c in conversations.json()] == [with_bob, with_carol]


async def test_websocket_delivers_message_in_real_time():
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

        conversation_id = test_client.post(
            "/messaging/conversations",
            json={"user_id": bob["user"]["id"]},
            headers=auth_header(alice),
        ).json()["id"]

        with test_client.websocket_connect(f"/meme-sending/ws?token={bob['access_token']}") as ws:
            send = test_client.post(
                f"/messaging/conversations/{conversation_id}/messages",
                json={"kind": "text", "body": "live"},
                headers=auth_header(alice),
            )
            assert send.status_code == 201

            frame = ws.receive_json()
            assert frame["type"] == "message_received"
            assert frame["conversation_id"] == conversation_id
            assert frame["message"]["body"] == "live"
            assert frame["message"]["sender"]["username"] == "alice"

        # Read receipts travel the other way: alice is the one who must learn bob read it.
        with test_client.websocket_connect(f"/meme-sending/ws?token={alice['access_token']}") as ws:
            test_client.post(
                f"/messaging/conversations/{conversation_id}/read", headers=auth_header(bob)
            )
            frame = ws.receive_json()
            assert frame["type"] == "message_read"
            assert frame["conversation_id"] == conversation_id
            assert frame["reader_id"] == bob["user"]["id"]
