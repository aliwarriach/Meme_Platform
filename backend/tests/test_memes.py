from httpx import AsyncClient

from tests.conftest import auth_header, create_user


async def _post_meme(
    client: AsyncClient,
    user: dict,
    audiences: list[str],
    caption: str = "hello world",
    content_type: str = "image/png",
) -> object:
    files = {"image": ("test.png", b"fake-bytes", content_type)}
    data = {"caption": caption, "audiences": audiences}
    return await client.post(
        "/memes", files=files, data=data, headers=auth_header(user)
    )


async def test_create_meme_returns_meme_with_chosen_audiences(client: AsyncClient):
    alice = await create_user(client, "alice")
    response = await _post_meme(client, alice, audiences=["public", "friends"])
    assert response.status_code == 201
    body = response.json()
    assert body["author"]["username"] == "alice"
    assert set(body["audiences"]) == {"public", "friends"}
    assert body["reaction_count"] == 0
    assert body["comment_count"] == 0
    assert body["viewer_has_reacted"] is False


async def test_create_meme_rejects_non_image_content_type(client: AsyncClient):
    alice = await create_user(client, "alice")
    response = await _post_meme(
        client, alice, audiences=["public"], content_type="text/plain"
    )
    assert response.status_code == 400


async def test_create_meme_rejects_empty_audiences(client: AsyncClient):
    alice = await create_user(client, "alice")
    files = {"image": ("test.png", b"fake-bytes", "image/png")}
    response = await client.post(
        "/memes", files=files, data={"caption": "hi"}, headers=auth_header(alice)
    )
    assert response.status_code == 422


async def test_create_meme_rejects_empty_file(client: AsyncClient):
    alice = await create_user(client, "alice")
    files = {"image": ("test.png", b"", "image/png")}
    response = await client.post(
        "/memes",
        files=files,
        data={"caption": "hi", "audiences": ["public"]},
        headers=auth_header(alice),
    )
    assert response.status_code == 400


async def test_public_meme_visible_to_unrelated_third_user(client: AsyncClient):
    alice = await create_user(client, "alice")
    carol = await create_user(client, "carol")

    await _post_meme(client, alice, audiences=["public"])

    feed = await client.get("/memes/feed", headers=auth_header(carol))
    usernames = [item["author"]["username"] for item in feed.json()["items"]]
    assert "alice" in usernames


async def test_friends_only_meme_visible_only_to_accepted_friend(client: AsyncClient):
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")

    request_response = await client.post(
        "/friends/requests", json={"username": "bob"}, headers=auth_header(alice)
    )
    friendship_id = request_response.json()["id"]
    await client.post(f"/friends/requests/{friendship_id}/accept", headers=auth_header(bob))

    await _post_meme(client, alice, audiences=["friends"])

    bob_feed = await client.get("/memes/feed", headers=auth_header(bob))
    assert any(item["author"]["username"] == "alice" for item in bob_feed.json()["items"])


async def test_friends_only_meme_not_visible_to_non_friend(client: AsyncClient):
    alice = await create_user(client, "alice")
    carol = await create_user(client, "carol")

    await _post_meme(client, alice, audiences=["friends"])

    carol_feed = await client.get("/memes/feed", headers=auth_header(carol))
    assert carol_feed.json()["items"] == []


async def test_author_can_always_see_own_meme_regardless_of_audience(client: AsyncClient):
    alice = await create_user(client, "alice")
    await _post_meme(client, alice, audiences=["friends"])

    alice_feed = await client.get("/memes/feed", headers=auth_header(alice))
    assert len(alice_feed.json()["items"]) == 1


async def test_feed_pagination_returns_next_cursor_and_respects_it(client: AsyncClient):
    alice = await create_user(client, "alice")
    for i in range(3):
        await _post_meme(client, alice, audiences=["public"], caption=f"meme {i}")

    first_page = await client.get(
        "/memes/feed", params={"limit": 2}, headers=auth_header(alice)
    )
    first_body = first_page.json()
    assert len(first_body["items"]) == 2
    assert first_body["next_cursor"] is not None

    second_page = await client.get(
        "/memes/feed",
        params={"limit": 2, "cursor": first_body["next_cursor"]},
        headers=auth_header(alice),
    )
    second_body = second_page.json()
    assert len(second_body["items"]) == 1
    assert second_body["next_cursor"] is None

    first_ids = {item["id"] for item in first_body["items"]}
    second_ids = {item["id"] for item in second_body["items"]}
    assert first_ids.isdisjoint(second_ids)


async def test_feed_rejects_invalid_cursor(client: AsyncClient):
    alice = await create_user(client, "alice")
    response = await client.get(
        "/memes/feed", params={"cursor": "not-a-real-cursor"}, headers=auth_header(alice)
    )
    assert response.status_code == 400


async def test_add_and_remove_reaction_round_trip(client: AsyncClient):
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")
    meme_response = await _post_meme(client, alice, audiences=["public"])
    meme_id = meme_response.json()["id"]

    react_response = await client.post(
        f"/memes/{meme_id}/reactions", headers=auth_header(bob)
    )
    assert react_response.status_code == 201

    feed = await client.get("/memes/feed", headers=auth_header(bob))
    meme_in_feed = next(item for item in feed.json()["items"] if item["id"] == meme_id)
    assert meme_in_feed["reaction_count"] == 1
    assert meme_in_feed["viewer_has_reacted"] is True

    remove_response = await client.delete(
        f"/memes/{meme_id}/reactions", headers=auth_header(bob)
    )
    assert remove_response.status_code == 204

    feed_after = await client.get("/memes/feed", headers=auth_header(bob))
    meme_after = next(item for item in feed_after.json()["items"] if item["id"] == meme_id)
    assert meme_after["reaction_count"] == 0
    assert meme_after["viewer_has_reacted"] is False


async def test_duplicate_reaction_rejected(client: AsyncClient):
    alice = await create_user(client, "alice")
    meme_response = await _post_meme(client, alice, audiences=["public"])
    meme_id = meme_response.json()["id"]

    await client.post(f"/memes/{meme_id}/reactions", headers=auth_header(alice))
    second = await client.post(f"/memes/{meme_id}/reactions", headers=auth_header(alice))
    assert second.status_code == 409


async def test_remove_nonexistent_reaction_rejected(client: AsyncClient):
    alice = await create_user(client, "alice")
    meme_response = await _post_meme(client, alice, audiences=["public"])
    meme_id = meme_response.json()["id"]

    response = await client.delete(f"/memes/{meme_id}/reactions", headers=auth_header(alice))
    assert response.status_code == 404


async def test_add_and_list_comments_round_trip(client: AsyncClient):
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")
    meme_response = await _post_meme(client, alice, audiences=["public"])
    meme_id = meme_response.json()["id"]

    comment_response = await client.post(
        f"/memes/{meme_id}/comments", json={"body": "lol nice"}, headers=auth_header(bob)
    )
    assert comment_response.status_code == 201
    assert comment_response.json()["author"]["username"] == "bob"

    list_response = await client.get(
        f"/memes/{meme_id}/comments", headers=auth_header(alice)
    )
    bodies = [c["body"] for c in list_response.json()]
    assert bodies == ["lol nice"]


async def test_reaction_and_comment_rejected_for_non_visible_meme(client: AsyncClient):
    alice = await create_user(client, "alice")
    carol = await create_user(client, "carol")
    meme_response = await _post_meme(client, alice, audiences=["friends"])
    meme_id = meme_response.json()["id"]

    react_response = await client.post(f"/memes/{meme_id}/reactions", headers=auth_header(carol))
    assert react_response.status_code == 404

    comment_response = await client.post(
        f"/memes/{meme_id}/comments", json={"body": "hey"}, headers=auth_header(carol)
    )
    assert comment_response.status_code == 404


async def test_memes_endpoints_require_authentication(client: AsyncClient):
    response = await client.get("/memes/feed")
    assert response.status_code == 401

    files = {"image": ("test.png", b"fake-bytes", "image/png")}
    response = await client.post(
        "/memes", files=files, data={"caption": "hi", "audiences": ["public"]}
    )
    assert response.status_code == 401
