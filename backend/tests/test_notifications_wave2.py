"""Second notification wave (2026-08-31): event-driven hooks added to existing services —
friend requests, community join requests/resolutions, community-owner post moderation, and
meme comments. The two new *cron* jobs (competition wins, batched meme upvotes) are covered
separately in test_notification_crons_wave2.py, matching how the original challenge crons
got their own file (test_challenge_notification_crons.py) instead of living here.
"""

from httpx import AsyncClient

from tests.conftest import auth_header, create_user

IMAGE = {"image": ("test.png", b"fake-bytes", "image/png")}


def _types(notifications_body: dict) -> list[str]:
    return [n["type"] for n in notifications_body["items"]]


async def _post_meme(client: AsyncClient, user: dict) -> dict:
    response = await client.post(
        "/memes", files=IMAGE, data={"audiences": ["public"]}, headers=auth_header(user)
    )
    return response.json()


async def _create_community(client: AsyncClient, owner: dict, privacy: str = "open") -> dict:
    response = await client.post(
        "/communities", data={"name": "Meme Lords", "privacy": privacy}, headers=auth_header(owner)
    )
    return response.json()


async def test_friend_request_notifies_recipient(client: AsyncClient):
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")

    response = await client.post(
        "/friends/requests", json={"username": "bob"}, headers=auth_header(alice)
    )
    friendship_id = response.json()["id"]

    notifications = (await client.get("/notifications", headers=auth_header(bob))).json()
    assert "friend_request_received" in _types(notifications)
    notif = next(n for n in notifications["items"] if n["type"] == "friend_request_received")
    assert notif["data"]["friendship_id"] == friendship_id
    assert "alice" in notif["title"]


async def test_friend_request_accept_notifies_requester(client: AsyncClient):
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")

    friendship_id = (
        await client.post("/friends/requests", json={"username": "bob"}, headers=auth_header(alice))
    ).json()["id"]
    await client.post(f"/friends/requests/{friendship_id}/accept", headers=auth_header(bob))

    notifications = (await client.get("/notifications", headers=auth_header(alice))).json()
    assert "friend_request_accepted" in _types(notifications)
    notif = next(n for n in notifications["items"] if n["type"] == "friend_request_accepted")
    assert "bob" in notif["title"]


async def test_invite_only_join_request_notifies_owner(client: AsyncClient):
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")
    community = await _create_community(client, alice, privacy="invite_only")

    await client.post(f"/communities/{community['id']}/join", headers=auth_header(bob))

    notifications = (await client.get("/notifications", headers=auth_header(alice))).json()
    assert "community_join_request" in _types(notifications)
    notif = next(n for n in notifications["items"] if n["type"] == "community_join_request")
    assert notif["data"]["community_id"] == community["id"]
    assert "bob" in notif["body"]


async def test_open_community_self_join_does_not_notify_owner(client: AsyncClient):
    """An open community's immediate self-join is not a moderation event — only a genuine
    invite-only *request* (owner action required) should page the owner."""
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")
    community = await _create_community(client, alice, privacy="open")

    await client.post(f"/communities/{community['id']}/join", headers=auth_header(bob))

    notifications = (await client.get("/notifications", headers=auth_header(alice))).json()
    assert "community_join_request" not in _types(notifications)


async def test_join_request_approval_notifies_requester(client: AsyncClient):
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")
    community = await _create_community(client, alice, privacy="invite_only")
    await client.post(f"/communities/{community['id']}/join", headers=auth_header(bob))

    requests = (
        await client.get(f"/communities/{community['id']}/join-requests", headers=auth_header(alice))
    ).json()
    membership_id = requests[0]["id"]
    await client.post(
        f"/communities/{community['id']}/join-requests/{membership_id}/approve",
        headers=auth_header(alice),
    )

    notifications = (await client.get("/notifications", headers=auth_header(bob))).json()
    assert "community_join_approved" in _types(notifications)


async def test_join_request_rejection_notifies_requester(client: AsyncClient):
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")
    community = await _create_community(client, alice, privacy="invite_only")
    await client.post(f"/communities/{community['id']}/join", headers=auth_header(bob))

    requests = (
        await client.get(f"/communities/{community['id']}/join-requests", headers=auth_header(alice))
    ).json()
    membership_id = requests[0]["id"]
    response = await client.delete(
        f"/communities/{community['id']}/join-requests/{membership_id}",
        headers=auth_header(alice),
    )
    assert response.status_code == 204

    notifications = (await client.get("/notifications", headers=auth_header(bob))).json()
    assert "community_join_rejected" in _types(notifications)


async def test_owner_removing_a_members_post_notifies_the_author(
    client: AsyncClient, mock_media_delete
):
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")
    community = await _create_community(client, alice, privacy="open")
    await client.post(f"/communities/{community['id']}/join", headers=auth_header(bob))

    meme = (
        await client.post(
            f"/communities/{community['id']}/memes",
            files=IMAGE,
            data={"caption": "bob's post"},
            headers=auth_header(bob),
        )
    ).json()

    response = await client.delete(f"/memes/{meme['id']}", headers=auth_header(alice))
    assert response.status_code == 204

    notifications = (await client.get("/notifications", headers=auth_header(bob))).json()
    assert "community_post_removed" in _types(notifications)
    notif = next(n for n in notifications["items"] if n["type"] == "community_post_removed")
    assert notif["data"]["community_id"] == community["id"]


async def test_author_deleting_their_own_post_does_not_self_notify(
    client: AsyncClient, mock_media_delete
):
    alice = await create_user(client, "alice")
    meme = await _post_meme(client, alice)

    response = await client.delete(f"/memes/{meme['id']}", headers=auth_header(alice))
    assert response.status_code == 204

    notifications = (await client.get("/notifications", headers=auth_header(alice))).json()
    assert "community_post_removed" not in _types(notifications)


async def test_comment_notifies_meme_author(client: AsyncClient):
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")
    meme = await _post_meme(client, alice)

    await client.post(
        f"/memes/{meme['id']}/comments", json={"body": "lol nice one"}, headers=auth_header(bob)
    )

    notifications = (await client.get("/notifications", headers=auth_header(alice))).json()
    assert "meme_comment_received" in _types(notifications)
    notif = next(n for n in notifications["items"] if n["type"] == "meme_comment_received")
    assert notif["data"]["meme_id"] == meme["id"]
    assert notif["body"] == "lol nice one"
    assert "bob" in notif["title"]


async def test_commenting_on_your_own_meme_does_not_self_notify(client: AsyncClient):
    alice = await create_user(client, "alice")
    meme = await _post_meme(client, alice)

    await client.post(
        f"/memes/{meme['id']}/comments", json={"body": "haha"}, headers=auth_header(alice)
    )

    notifications = (await client.get("/notifications", headers=auth_header(alice))).json()
    assert "meme_comment_received" not in _types(notifications)


async def test_long_comment_body_is_truncated_in_the_notification_preview(client: AsyncClient):
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")
    meme = await _post_meme(client, alice)
    long_body = "a" * 300

    await client.post(
        f"/memes/{meme['id']}/comments", json={"body": long_body}, headers=auth_header(bob)
    )

    notifications = (await client.get("/notifications", headers=auth_header(alice))).json()
    notif = next(n for n in notifications["items"] if n["type"] == "meme_comment_received")
    assert len(notif["body"]) <= 151
    assert notif["body"].endswith("…")
