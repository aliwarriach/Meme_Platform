from httpx import AsyncClient

from tests.conftest import auth_header, create_user


def _meme_items(feed_body: dict) -> list[dict]:
    return [item["meme"] for item in feed_body["items"] if item["kind"] == "meme"]


async def _post_meme(client: AsyncClient, user: dict, caption: str = "hi") -> dict:
    files = {"image": ("test.png", b"fake-bytes", "image/png")}
    response = await client.post(
        "/memes",
        files=files,
        data={"caption": caption, "audiences": ["public"]},
        headers=auth_header(user),
    )
    assert response.status_code == 201
    return response.json()


async def test_author_can_delete_their_own_meme(client: AsyncClient, mock_media_delete):
    alice = await create_user(client, "alice")
    meme = await _post_meme(client, alice)

    response = await client.delete(f"/memes/{meme['id']}", headers=auth_header(alice))
    assert response.status_code == 204
    assert len(mock_media_delete) == 1

    feed = await client.get("/memes/feed", headers=auth_header(alice))
    assert meme["id"] not in [m["id"] for m in _meme_items(feed.json())]

    # Deleting it again 404s — it's gone, not "already deleted".
    again = await client.delete(f"/memes/{meme['id']}", headers=auth_header(alice))
    assert again.status_code == 404


async def test_non_author_cannot_delete_a_meme(client: AsyncClient):
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")
    meme = await _post_meme(client, alice)

    response = await client.delete(f"/memes/{meme['id']}", headers=auth_header(bob))
    assert response.status_code == 403

    feed = await client.get("/memes/feed", headers=auth_header(alice))
    assert meme["id"] in [m["id"] for m in _meme_items(feed.json())]


async def test_deleted_meme_reference_degrades_to_null(client: AsyncClient):
    """A meme referenced in a DM must not 500 or vanish the whole message once its
    author deletes it — see services/messaging.py's pre-existing null-meme handling."""
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")
    meme = await _post_meme(client, alice)

    request = await client.post(
        "/friends/requests", json={"username": "bob"}, headers=auth_header(alice)
    )
    await client.post(f"/friends/requests/{request.json()['id']}/accept", headers=auth_header(bob))
    conversation = await client.post(
        "/messaging/conversations", json={"user_id": bob["user"]["id"]}, headers=auth_header(alice)
    )
    message = await client.post(
        f"/messaging/conversations/{conversation.json()['id']}/messages",
        json={"kind": "meme", "meme_id": meme["id"]},
        headers=auth_header(alice),
    )
    assert message.status_code == 201

    await client.delete(f"/memes/{meme['id']}", headers=auth_header(alice))

    thread = await client.get(
        f"/messaging/conversations/{conversation.json()['id']}/messages", headers=auth_header(bob)
    )
    assert thread.json()["items"][0]["meme"] is None


async def test_author_can_delete_their_own_comment(client: AsyncClient):
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")
    meme = await _post_meme(client, alice)

    comment = await client.post(
        f"/memes/{meme['id']}/comments", json={"body": "nice one"}, headers=auth_header(bob)
    )
    comment_id = comment.json()["id"]

    response = await client.delete(
        f"/memes/{meme['id']}/comments/{comment_id}", headers=auth_header(bob)
    )
    assert response.status_code == 204

    comments = await client.get(f"/memes/{meme['id']}/comments", headers=auth_header(alice))
    assert comments.json() == []


async def test_non_author_cannot_delete_a_comment(client: AsyncClient):
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")
    meme = await _post_meme(client, alice)

    comment = await client.post(
        f"/memes/{meme['id']}/comments", json={"body": "nice one"}, headers=auth_header(bob)
    )
    comment_id = comment.json()["id"]

    # Even the meme's own author can't delete someone else's comment on it.
    response = await client.delete(
        f"/memes/{meme['id']}/comments/{comment_id}", headers=auth_header(alice)
    )
    assert response.status_code == 403


async def test_update_profile_bio(client: AsyncClient):
    alice = await create_user(client, "alice")

    response = await client.patch(
        "/auth/me", data={"bio": "hello world"}, headers=auth_header(alice)
    )
    assert response.status_code == 200
    assert response.json()["bio"] == "hello world"

    cleared = await client.patch(
        "/auth/me", data={"clear_bio": "true"}, headers=auth_header(alice)
    )
    assert cleared.json()["bio"] is None

    # Omitting bio entirely leaves it untouched.
    untouched = await client.patch("/auth/me", data={}, headers=auth_header(alice))
    assert untouched.json()["bio"] is None


async def test_update_profile_avatar(client: AsyncClient, mock_media_delete):
    alice = await create_user(client, "alice")

    files = {"avatar": ("avatar.png", b"fake-bytes", "image/png")}
    first = await client.patch("/auth/me", files=files, headers=auth_header(alice))
    assert first.status_code == 200
    assert first.json()["avatar_url"] is not None
    assert len(mock_media_delete) == 0

    second = await client.patch("/auth/me", files=files, headers=auth_header(alice))
    assert second.status_code == 200
    # Replacing the avatar cleans up the old Cloudinary asset.
    assert len(mock_media_delete) == 1
