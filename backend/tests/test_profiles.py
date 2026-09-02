from httpx import AsyncClient

from tests.conftest import auth_header, create_user


async def _post_meme(client: AsyncClient, user: dict, audiences: list[str] = ["public"]) -> dict:
    files = {"image": ("test.png", b"fake-bytes", "image/png")}
    response = await client.post(
        "/memes", files=files, data={"audiences": audiences}, headers=auth_header(user)
    )
    return response.json()


async def _befriend(client: AsyncClient, a: dict, b: dict) -> None:
    request = await client.post(
        "/friends/requests", json={"username": b["user"]["username"]}, headers=auth_header(a)
    )
    await client.post(
        f"/friends/requests/{request.json()['id']}/accept", headers=auth_header(b)
    )


async def test_own_profile_is_unlocked_and_shows_own_posts(client: AsyncClient):
    alice = await create_user(client, "alice")
    await _post_meme(client, alice)

    response = await client.get(f"/users/{alice['user']['id']}/profile", headers=auth_header(alice))
    assert response.status_code == 200
    body = response.json()
    assert body["is_self"] is True
    assert body["is_friend"] is True
    assert body["posts_locked"] is False

    posts = await client.get(f"/users/{alice['user']['id']}/posts", headers=auth_header(alice))
    assert posts.status_code == 200
    assert len(posts.json()["items"]) == 1


async def test_friend_profile_is_unlocked(client: AsyncClient):
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")
    await _befriend(client, alice, bob)
    await _post_meme(client, bob, audiences=["friends"])

    response = await client.get(f"/users/{bob['user']['id']}/profile", headers=auth_header(alice))
    assert response.status_code == 200
    body = response.json()
    assert body["is_self"] is False
    assert body["is_friend"] is True
    assert body["posts_locked"] is False
    assert body["friend_count"] == 1

    posts = await client.get(f"/users/{bob['user']['id']}/posts", headers=auth_header(alice))
    assert posts.status_code == 200
    assert len(posts.json()["items"]) == 1


async def test_non_friend_profile_shows_stats_but_locks_posts(client: AsyncClient):
    alice = await create_user(client, "alice")
    carol = await create_user(client, "carol")
    await _post_meme(client, carol)

    response = await client.get(
        f"/users/{carol['user']['id']}/profile", headers=auth_header(alice)
    )
    assert response.status_code == 200
    body = response.json()
    assert body["is_self"] is False
    assert body["is_friend"] is False
    assert body["posts_locked"] is True
    # Score/badge/friend counts (and the actual badge list) still visible to a non-friend.
    assert body["friend_count"] == 0
    assert body["badge_count"] == 0
    assert body["badges"] == []
    assert "score" in body

    posts = await client.get(f"/users/{carol['user']['id']}/posts", headers=auth_header(alice))
    assert posts.status_code == 403


async def test_profile_requires_auth(client: AsyncClient):
    alice = await create_user(client, "alice")
    response = await client.get(f"/users/{alice['user']['id']}/profile")
    assert response.status_code == 401


async def test_profile_nonexistent_user_404(client: AsyncClient):
    alice = await create_user(client, "alice")
    response = await client.get(
        "/users/00000000-0000-0000-0000-000000000000/profile", headers=auth_header(alice)
    )
    assert response.status_code == 404


async def test_profile_flags_pending_outgoing_request(client: AsyncClient):
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")

    before = await client.get(f"/users/{bob['user']['id']}/profile", headers=auth_header(alice))
    assert before.json()["friend_request_sent"] is False

    await client.post("/friends/requests", json={"username": "bob"}, headers=auth_header(alice))

    after = await client.get(f"/users/{bob['user']['id']}/profile", headers=auth_header(alice))
    assert after.json()["friend_request_sent"] is True

    # Direction matters — bob is the addressee, not the requester, so his own view of
    # alice's profile must not show a request as sent by him.
    reverse = await client.get(f"/users/{alice['user']['id']}/profile", headers=auth_header(bob))
    assert reverse.json()["friend_request_sent"] is False


async def test_profile_pending_request_clears_once_accepted(client: AsyncClient):
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")

    request = await client.post(
        "/friends/requests", json={"username": "bob"}, headers=auth_header(alice)
    )
    await client.post(
        f"/friends/requests/{request.json()['id']}/accept", headers=auth_header(bob)
    )

    response = await client.get(f"/users/{bob['user']['id']}/profile", headers=auth_header(alice))
    body = response.json()
    assert body["is_friend"] is True
    assert body["friend_request_sent"] is False
