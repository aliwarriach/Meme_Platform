"""Scoring atom + view-tracking + profile score.

Covers the reach-weighted MemeScore atom (services/scoring.py) end-to-end through the API:
impression counting, the deliberate reach-beats-quality behavior, and the lifetime profile
score. Vote/comment-driven ranking is additionally exercised by test_leaderboards.py and
test_competitions.py against this same atom.
"""

import uuid

from httpx import AsyncClient
from sqlalchemy import update

from app.models.meme import Meme
from tests.conftest import TestSessionFactory, auth_header, create_user


async def _post_meme(client: AsyncClient, user: dict, audiences: list[str] = ["public"]) -> dict:
    files = {"image": ("test.png", b"fake-bytes", "image/png")}
    response = await client.post(
        "/memes", files=files, data={"audiences": audiences}, headers=auth_header(user)
    )
    return response.json()


async def _upvote(client: AsyncClient, user: dict, meme_id: str) -> None:
    response = await client.post(
        f"/memes/{meme_id}/votes", json={"value": 1}, headers=auth_header(user)
    )
    assert response.status_code == 201


async def _seed_views(meme_id: str, views: int) -> None:
    """Sets a meme's impression counter directly — cheaper than calling the view endpoint
    thousands of times to simulate a viral reach."""
    async with TestSessionFactory() as session:
        await session.execute(
            update(Meme).where(Meme.id == uuid.UUID(meme_id)).values(view_count=views)
        )
        await session.commit()


async def test_record_meme_view_increments_counter(client: AsyncClient):
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")
    carol = await create_user(client, "carol")
    meme = await _post_meme(client, alice)

    first = await client.post(f"/memes/{meme['id']}/views", headers=auth_header(bob))
    assert first.status_code == 201
    assert first.json() == {"meme_id": meme["id"], "view_count": 1}

    # a different viewer bumps the counter again...
    second = await client.post(f"/memes/{meme['id']}/views", headers=auth_header(carol))
    assert second.json()["view_count"] == 2


async def test_record_meme_view_deduped_per_user(client: AsyncClient):
    """A repeat view from the SAME user must not move the counter — at most one view per
    (meme, user), ever (confirmed with user)."""
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")
    meme = await _post_meme(client, alice)

    first = await client.post(f"/memes/{meme['id']}/views", headers=auth_header(bob))
    assert first.json()["view_count"] == 1

    repeat = await client.post(f"/memes/{meme['id']}/views", headers=auth_header(bob))
    assert repeat.status_code == 201
    assert repeat.json()["view_count"] == 1  # unchanged, not 2


async def test_record_view_gated_by_visibility(client: AsyncClient):
    alice = await create_user(client, "alice")
    stranger = await create_user(client, "stranger")
    # Friends-only meme; stranger is not a friend -> can't even see it, so can't inflate views.
    meme = await _post_meme(client, alice, audiences=["friends"])

    response = await client.post(f"/memes/{meme['id']}/views", headers=auth_header(stranger))
    assert response.status_code == 404


async def test_view_count_visible_only_to_author(client: AsyncClient):
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")
    meme = await _post_meme(client, alice)
    await client.post(f"/memes/{meme['id']}/views", headers=auth_header(bob))

    # bob (a non-author viewer) fetches the feed — view_count must be hidden (null)
    feed = await client.get("/memes/feed", headers=auth_header(bob))
    bob_sees = next(
        i["meme"] for i in feed.json()["items"] if i["kind"] == "meme" and i["meme"]["id"] == meme["id"]
    )
    assert bob_sees["view_count"] is None

    # alice (the author) fetches the feed — view_count must be visible
    feed_as_author = await client.get("/memes/feed", headers=auth_header(alice))
    alice_sees = next(
        i["meme"]
        for i in feed_as_author.json()["items"]
        if i["kind"] == "meme" and i["meme"]["id"] == meme["id"]
    )
    assert alice_sees["view_count"] == 1


async def test_view_count_visible_to_community_owner(client: AsyncClient):
    alice = await create_user(client, "alice")  # community owner
    bob = await create_user(client, "bob")  # community member, posts the meme
    carol = await create_user(client, "carol")  # community member, just viewing

    community = (
        await client.post(
            "/communities", data={"name": "Meme Lords", "privacy": "open"}, headers=auth_header(alice)
        )
    ).json()
    await client.post(f"/communities/{community['id']}/join", headers=auth_header(bob))
    await client.post(f"/communities/{community['id']}/join", headers=auth_header(carol))

    files = {"image": ("test.png", b"fake-bytes", "image/png")}
    meme = (
        await client.post(
            f"/communities/{community['id']}/memes", files=files, headers=auth_header(bob)
        )
    ).json()
    await client.post(f"/memes/{meme['id']}/views", headers=auth_header(carol))

    # carol (a member, not the author or owner) must not see the count
    as_carol = await client.get(
        f"/communities/{community['id']}/feed", headers=auth_header(carol)
    )
    carol_sees = next(i for i in as_carol.json()["items"] if i["id"] == meme["id"])
    assert carol_sees["view_count"] is None

    # alice (the community owner/"admin") must see it, same as bob (the author)
    as_owner = await client.get(
        f"/communities/{community['id']}/feed", headers=auth_header(alice)
    )
    owner_sees = next(i for i in as_owner.json()["items"] if i["id"] == meme["id"])
    assert owner_sees["view_count"] == 1

    as_author = await client.get(
        f"/communities/{community['id']}/feed", headers=auth_header(bob)
    )
    author_sees = next(i for i in as_author.json()["items"] if i["id"] == meme["id"])
    assert author_sees["view_count"] == 1


async def test_record_container_view_increments_counter(client: AsyncClient):
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")
    create = await client.post(
        "/instagram/containers",
        json={"source_url": "https://www.instagram.com/reel/abc123/"},
        headers=auth_header(alice),
    )
    container = create.json()
    assert container["view_count"] == 0  # alice is the submitter, so she can see it

    response = await client.post(
        f"/instagram/containers/{container['id']}/views", headers=auth_header(bob)
    )
    assert response.status_code == 201
    assert response.json() == {"meme_container_id": container["id"], "view_count": 1}

    # bob is not the submitter -> can't see the count
    as_bob = await client.get(f"/instagram/containers/{container['id']}", headers=auth_header(bob))
    assert as_bob.json()["view_count"] is None

    # alice (submitter) sees it
    as_alice = await client.get(
        f"/instagram/containers/{container['id']}", headers=auth_header(alice)
    )
    assert as_alice.json()["view_count"] == 1


async def test_container_view_deduped_per_user(client: AsyncClient):
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")
    container = (
        await client.post(
            "/instagram/containers",
            json={"source_url": "https://www.instagram.com/reel/xyz/"},
            headers=auth_header(alice),
        )
    ).json()

    await client.post(f"/instagram/containers/{container['id']}/views", headers=auth_header(bob))
    repeat = await client.post(
        f"/instagram/containers/{container['id']}/views", headers=auth_header(bob)
    )
    assert repeat.json()["view_count"] == 1


async def test_reach_beats_quality(client: AsyncClient):
    """The core product decision: a widely-seen meme outranks a better-loved but small one.
    `reachy` (1 upvote, 100k views) must beat `quality` (3 upvotes, ~no views)."""
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")
    carol = await create_user(client, "carol")
    dave = await create_user(client, "dave")

    quality = await _post_meme(client, alice)
    await _upvote(client, bob, quality["id"])
    await _upvote(client, carol, quality["id"])
    await _upvote(client, dave, quality["id"])

    reachy = await _post_meme(client, alice)
    await _upvote(client, bob, reachy["id"])
    await _seed_views(reachy["id"], 100_000)

    response = await client.get("/competitions/day/current", headers=auth_header(alice))
    items = response.json()["items"]
    ids_in_order = [i["content"]["meme"]["id"] for i in items]
    assert ids_in_order.index(reachy["id"]) < ids_in_order.index(quality["id"])

    reachy_score = next(i for i in items if i["content"]["meme"]["id"] == reachy["id"])["score"]
    quality_score = next(i for i in items if i["content"]["meme"]["id"] == quality["id"])["score"]
    # reachy: round((log10(100001) * (0.4+0.6*0.7)) * 100) = round(5.0*0.82*100) = 410
    # quality: round((log10(4) * (0.4+0.6*0.75)) * 100) = round(0.602*0.85*100) = 51
    assert reachy_score == 410
    assert quality_score == 51


async def test_downvotes_never_raise_score(client: AsyncClient):
    """A downvote can only lower quality; it's excluded from the reach floor, so it can never
    push a meme's score up. A 0-view meme with only downvotes bottoms out at 0."""
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")
    meme = await _post_meme(client, alice)
    await client.post(f"/memes/{meme['id']}/votes", json={"value": -1}, headers=auth_header(bob))

    response = await client.get(f"/leaderboards/profile/{alice['user']['id']}", headers=auth_header(alice))
    assert response.status_code == 200
    assert response.json()["score"] == 0


async def test_profile_score_is_lifetime_cumulative(client: AsyncClient):
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")
    carol = await create_user(client, "carol")

    meme1 = await _post_meme(client, alice)
    await _upvote(client, bob, meme1["id"])  # 1 up -> atom 25

    meme2 = await _post_meme(client, alice)
    await _upvote(client, carol, meme2["id"])  # 1 up -> atom 25

    response = await client.get(
        f"/leaderboards/profile/{alice['user']['id']}", headers=auth_header(alice)
    )
    assert response.status_code == 200
    body = response.json()
    assert body["user"]["username"] == "alice"
    assert body["score"] == 50  # lifetime sum, no window


async def test_profile_score_zero_for_user_without_memes(client: AsyncClient):
    alice = await create_user(client, "alice")
    response = await client.get(
        f"/leaderboards/profile/{alice['user']['id']}", headers=auth_header(alice)
    )
    assert response.status_code == 200
    assert response.json()["score"] == 0


async def test_profile_score_unknown_user_404(client: AsyncClient):
    alice = await create_user(client, "alice")
    response = await client.get(
        f"/leaderboards/profile/{uuid.uuid4()}", headers=auth_header(alice)
    )
    assert response.status_code == 404
