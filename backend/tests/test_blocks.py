from httpx import AsyncClient

from tests.conftest import auth_header, create_user


def _meme_items(feed_body: dict) -> list[dict]:
    return [item["meme"] for item in feed_body["items"] if item["kind"] == "meme"]


async def _post_meme(client: AsyncClient, user: dict, audiences: list[str], caption: str) -> dict:
    files = {"image": ("test.png", b"fake-bytes", "image/png")}
    response = await client.post(
        "/memes",
        files=files,
        data={"caption": caption, "audiences": audiences},
        headers=auth_header(user),
    )
    assert response.status_code == 201
    return response.json()


async def _become_friends(client: AsyncClient, alice: dict, bob: dict) -> None:
    request = await client.post(
        "/friends/requests", json={"username": bob["user"]["username"]}, headers=auth_header(alice)
    )
    await client.post(
        f"/friends/requests/{request.json()['id']}/accept", headers=auth_header(bob)
    )


async def test_block_and_list(client: AsyncClient):
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")

    response = await client.post(
        "/blocks", json={"user_id": bob["user"]["id"]}, headers=auth_header(alice)
    )
    assert response.status_code == 201
    assert response.json()["blocked"]["username"] == "bob"

    listed = await client.get("/blocks", headers=auth_header(alice))
    assert [b["blocked"]["username"] for b in listed.json()] == ["bob"]

    # Bob blocking Alice back is a separate row — blocking is directional.
    bob_blocked = await client.get("/blocks", headers=auth_header(bob))
    assert bob_blocked.json() == []


async def test_block_is_idempotent(client: AsyncClient):
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")

    first = await client.post(
        "/blocks", json={"user_id": bob["user"]["id"]}, headers=auth_header(alice)
    )
    second = await client.post(
        "/blocks", json={"user_id": bob["user"]["id"]}, headers=auth_header(alice)
    )
    assert second.status_code == 201
    assert first.json()["id"] == second.json()["id"]

    listed = await client.get("/blocks", headers=auth_header(alice))
    assert len(listed.json()) == 1


async def test_cannot_block_self(client: AsyncClient):
    alice = await create_user(client, "alice")
    response = await client.post(
        "/blocks", json={"user_id": alice["user"]["id"]}, headers=auth_header(alice)
    )
    assert response.status_code == 400


async def test_unblock(client: AsyncClient):
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")

    await client.post("/blocks", json={"user_id": bob["user"]["id"]}, headers=auth_header(alice))
    response = await client.delete(f"/blocks/{bob['user']['id']}", headers=auth_header(alice))
    assert response.status_code == 204

    listed = await client.get("/blocks", headers=auth_header(alice))
    assert listed.json() == []


async def test_unblock_when_not_blocked_is_404(client: AsyncClient):
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")

    response = await client.delete(f"/blocks/{bob['user']['id']}", headers=auth_header(alice))
    assert response.status_code == 404


async def test_blocking_hides_content_both_directions(client: AsyncClient):
    """A block gates future visibility symmetrically: neither side sees the other's
    public posts, even though nothing about the post's audience changed."""
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")

    await _post_meme(client, alice, ["public"], "alice's meme")
    await _post_meme(client, bob, ["public"], "bob's meme")

    await client.post("/blocks", json={"user_id": bob["user"]["id"]}, headers=auth_header(alice))

    alice_feed = await client.get("/memes/feed", headers=auth_header(alice))
    bob_feed = await client.get("/memes/feed", headers=auth_header(bob))

    assert "bob's meme" not in [m["caption"] for m in _meme_items(alice_feed.json())]
    assert "alice's meme" not in [m["caption"] for m in _meme_items(bob_feed.json())]
    # Each still sees their own content.
    assert "alice's meme" in [m["caption"] for m in _meme_items(alice_feed.json())]
    assert "bob's meme" in [m["caption"] for m in _meme_items(bob_feed.json())]


async def test_blocking_overrides_existing_friendship_visibility(client: AsyncClient):
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")
    await _become_friends(client, alice, bob)
    await _post_meme(client, bob, ["friends"], "friends only meme")

    # Sanity check: visible before the block.
    before = await client.get("/memes/feed", headers=auth_header(alice))
    assert "friends only meme" in [m["caption"] for m in _meme_items(before.json())]

    await client.post("/blocks", json={"user_id": bob["user"]["id"]}, headers=auth_header(alice))

    after = await client.get("/memes/feed", headers=auth_header(alice))
    assert "friends only meme" not in [m["caption"] for m in _meme_items(after.json())]


async def test_blocked_user_cannot_send_friend_request(client: AsyncClient):
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")

    await client.post("/blocks", json={"user_id": bob["user"]["id"]}, headers=auth_header(alice))

    # Bob doesn't know he's blocked — the request just fails, same as any other
    # forbidden action, with no message confirming a block exists.
    response = await client.post(
        "/friends/requests", json={"username": "alice"}, headers=auth_header(bob)
    )
    assert response.status_code == 403


async def test_blocking_a_friend_stops_new_messages(client: AsyncClient):
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")
    await _become_friends(client, alice, bob)

    conversation = await client.post(
        "/messaging/conversations", json={"user_id": bob["user"]["id"]}, headers=auth_header(alice)
    )
    conversation_id = conversation.json()["id"]

    await client.post("/blocks", json={"user_id": bob["user"]["id"]}, headers=auth_header(alice))

    response = await client.post(
        f"/messaging/conversations/{conversation_id}/messages",
        json={"kind": "text", "body": "hello?"},
        headers=auth_header(bob),
    )
    assert response.status_code == 403
