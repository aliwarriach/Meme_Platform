from httpx import AsyncClient

from tests.conftest import auth_header, create_user


async def _post_meme(
    client: AsyncClient,
    user: dict,
    audiences: list[str] | None = None,
    caption: str = "hello world",
    content_type: str = "image/png",
) -> object:
    files = {"image": ("test.png", b"fake-bytes", content_type)}
    data: dict[str, object] = {"caption": caption}
    if audiences is not None:
        data["audiences"] = audiences
    return await client.post(
        "/memes", files=files, data=data, headers=auth_header(user)
    )


async def _post_community_meme(
    client: AsyncClient,
    user: dict,
    community_id: str,
    caption: str = "hello community",
    content_type: str = "image/png",
) -> object:
    files = {"image": ("test.png", b"fake-bytes", content_type)}
    return await client.post(
        f"/communities/{community_id}/memes",
        files=files,
        data={"caption": caption},
        headers=auth_header(user),
    )


async def _create_community(client: AsyncClient, owner: dict, privacy: str = "open") -> dict:
    response = await client.post(
        "/communities", data={"name": "Meme Lords", "privacy": privacy}, headers=auth_header(owner)
    )
    return response.json()


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
    assert response.status_code == 400


async def test_create_meme_rejects_community_literal_in_audiences(client: AsyncClient):
    alice = await create_user(client, "alice")
    response = await _post_meme(client, alice, audiences=["community"])
    assert response.status_code == 400


async def test_create_community_meme_requires_active_membership(client: AsyncClient):
    alice = await create_user(client, "alice")
    carol = await create_user(client, "carol")
    community = await _create_community(client, alice)

    response = await _post_community_meme(client, carol, community["id"])
    assert response.status_code == 403


async def test_create_community_meme_to_nonexistent_community_rejected(client: AsyncClient):
    alice = await create_user(client, "alice")
    response = await _post_community_meme(
        client, alice, "00000000-0000-0000-0000-000000000000"
    )
    assert response.status_code == 404


async def test_community_meme_returns_community_badge(client: AsyncClient):
    alice = await create_user(client, "alice")
    community = await _create_community(client, alice)

    response = await _post_community_meme(client, alice, community["id"])
    assert response.status_code == 201
    body = response.json()
    assert body["community"] == {"id": community["id"], "name": community["name"]}


async def test_open_community_meme_is_automatically_public_with_community_badge(
    client: AsyncClient,
):
    alice = await create_user(client, "alice")
    carol = await create_user(client, "carol")
    community = await _create_community(client, alice, privacy="open")

    response = await _post_community_meme(client, alice, community["id"], caption="open post")
    assert set(response.json()["audiences"]) == {"community", "public"}

    # a non-member sees it in the global public feed, with the community badge attached
    carol_feed = await client.get("/memes/feed", headers=auth_header(carol))
    item = next(i for i in carol_feed.json()["items"] if i["caption"] == "open post")
    assert item["community"]["id"] == community["id"]


async def test_invite_only_community_meme_is_not_public(client: AsyncClient):
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")
    carol = await create_user(client, "carol")
    community = await _create_community(client, alice, privacy="invite_only")
    await client.post(f"/communities/{community['id']}/join", headers=auth_header(bob))
    join_requests = await client.get(
        f"/communities/{community['id']}/join-requests", headers=auth_header(alice)
    )
    bob_request_id = join_requests.json()[0]["id"]
    await client.post(
        f"/communities/{community['id']}/join-requests/{bob_request_id}/approve",
        headers=auth_header(alice),
    )

    response = await _post_community_meme(client, alice, community["id"], caption="private post")
    assert response.json()["audiences"] == ["community"]

    bob_feed = await client.get("/memes/feed", headers=auth_header(bob))
    assert any(item["caption"] == "private post" for item in bob_feed.json()["items"])

    carol_feed = await client.get("/memes/feed", headers=auth_header(carol))
    assert carol_feed.json()["items"] == []


async def test_community_feed_shows_only_that_communitys_posts(client: AsyncClient):
    alice = await create_user(client, "alice")
    community_a = await _create_community(client, alice)
    community_b = await _create_community(client, alice, privacy="invite_only")

    await _post_community_meme(client, alice, community_a["id"], caption="for A")
    await _post_meme(client, alice, audiences=["public"], caption="public only")

    feed = await client.get(f"/communities/{community_a['id']}/feed", headers=auth_header(alice))
    assert feed.status_code == 200
    captions = [item["caption"] for item in feed.json()["items"]]
    assert captions == ["for A"]


async def test_community_feed_requires_active_membership(client: AsyncClient):
    alice = await create_user(client, "alice")
    carol = await create_user(client, "carol")
    community = await _create_community(client, alice)

    response = await client.get(f"/communities/{community['id']}/feed", headers=auth_header(carol))
    assert response.status_code == 403


async def test_posting_in_an_open_community_shows_in_both_public_and_community_feed_not_others(
    client: AsyncClient,
):
    alice = await create_user(client, "alice")
    community_a = await _create_community(client, alice)
    community_b = await _create_community(client, alice)

    await _post_community_meme(client, alice, community_a["id"], caption="dual")

    public_feed = await client.get("/memes/feed", headers=auth_header(alice))
    assert any(item["caption"] == "dual" for item in public_feed.json()["items"])

    feed_a = await client.get(f"/communities/{community_a['id']}/feed", headers=auth_header(alice))
    assert any(item["caption"] == "dual" for item in feed_a.json()["items"])

    feed_b = await client.get(f"/communities/{community_b['id']}/feed", headers=auth_header(alice))
    assert feed_b.json()["items"] == []


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
