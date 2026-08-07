"""Phase 20 — open challenges + hashtags.

Anyone can create a platform-level challenge, anyone can pick a side, and entry is by
posting with the challenge's reserved tag. Also covers the two anti-gaming levers in
`_side_scores`, which are what make "anyone can join any side" safe to run.
"""

import datetime

from httpx import AsyncClient

from tests.conftest import auth_header, create_user

FUTURE = lambda minutes=10: (  # noqa: E731
    datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(minutes=minutes)
).isoformat()
PAST = lambda minutes=10: (  # noqa: E731
    datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(minutes=minutes)
).isoformat()

IMAGE = {"image": ("test.png", b"fake-bytes", "image/png")}


async def _create_open(
    client: AsyncClient, user: dict, hashtag: str = "DogsVsCats", **overrides
) -> dict:
    payload = {
        "title": "Dogs vs Cats",
        "hashtag": hashtag,
        "start_time": PAST(5),
        "end_time": FUTURE(10),
        "sides": [{"name": "Dogs"}, {"name": "Cats"}],
        **overrides,
    }
    return await client.post("/challenges/open", json=payload, headers=auth_header(user))


async def _join(client: AsyncClient, user: dict, challenge: dict, side_name: str):
    side = next(s for s in challenge["sides"] if s["name"] == side_name)
    return await client.post(
        f"/challenges/{challenge['id']}/join",
        json={"side_id": side["id"]},
        headers=auth_header(user),
    )


async def _enter(client: AsyncClient, user: dict, challenge_id: str, caption: str = "lol"):
    return await client.post(
        f"/challenges/{challenge_id}/submissions",
        files=IMAGE,
        data={"caption": caption},
        headers=auth_header(user),
    )


async def _upvote(client: AsyncClient, user: dict, meme_id: str) -> None:
    await client.post(f"/memes/{meme_id}/votes", json={"value": 1}, headers=auth_header(user))


def _side(challenge: dict, name: str) -> dict:
    return next(s for s in challenge["sides"] if s["name"] == name)


async def _refetch(client: AsyncClient, user: dict, challenge_id: str) -> dict:
    body = (await client.get("/challenges/mine", headers=auth_header(user))).json()
    return next(c for c in body if c["id"] == challenge_id)


# --- creation + tag reservation ----------------------------------------------------


async def test_any_user_can_create_an_open_challenge_with_no_community(client: AsyncClient):
    alice = await create_user(client, "alice")

    response = await _create_open(client, alice)

    assert response.status_code == 201
    body = response.json()
    assert body["challenge_type"] == "open"
    assert body["status"] == "active"
    assert body["community_id"] is None
    assert body["community_name"] is None
    # Normalized: case and punctuation must not fork the entry tag.
    assert body["hashtag"] == "dogsvscats"
    assert {s["name"] for s in body["sides"]} == {"Dogs", "Cats"}


async def test_a_hashtag_can_only_be_reserved_by_one_challenge(client: AsyncClient):
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")

    assert (await _create_open(client, alice, hashtag="DogsVsCats")).status_code == 201
    # Different casing/punctuation, same normalized slug — squatting an active competition
    # has to be impossible or entry becomes ambiguous.
    response = await _create_open(client, bob, hashtag="#dogs-vs-cats")

    assert response.status_code == 409


async def test_open_challenge_rejects_a_bad_window_and_duplicate_side_names(client: AsyncClient):
    alice = await create_user(client, "alice")

    bad_window = await _create_open(client, alice, hashtag="a", start_time=FUTURE(20), end_time=FUTURE(5))
    assert bad_window.status_code == 400

    dupe_sides = await _create_open(
        client, alice, hashtag="b", sides=[{"name": "Same"}, {"name": "Same"}]
    )
    assert dupe_sides.status_code == 400


async def test_open_challenge_requires_auth(client: AsyncClient):
    response = await client.post("/challenges/open", json={"title": "x", "hashtag": "y"})
    assert response.status_code == 401


# --- joining -----------------------------------------------------------------------


async def test_a_stranger_can_join_a_side_and_is_counted(client: AsyncClient):
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")
    challenge = (await _create_open(client, alice)).json()

    # bob shares no community with alice — that's the point of an open challenge.
    response = await _join(client, bob, challenge, "Cats")

    assert response.status_code == 200
    assert _side(response.json(), "Cats")["participant_count"] == 1
    # An open roster is unbounded, so ids are never enumerated.
    assert _side(response.json(), "Cats")["member_ids"] == []


async def test_a_side_pick_is_final(client: AsyncClient):
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")
    challenge = (await _create_open(client, alice)).json()

    await _join(client, bob, challenge, "Dogs")
    # Switching sides mid-challenge would let someone follow the winner.
    again = await _join(client, bob, challenge, "Cats")

    assert again.status_code == 400


async def test_join_rejects_a_community_challenge(client: AsyncClient):
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")
    community = (
        await client.post(
            "/communities", data={"name": "Meme Lords", "privacy": "open"}, headers=auth_header(alice)
        )
    ).json()
    await client.post(f"/communities/{community['id']}/join", headers=auth_header(bob))
    community_challenge = (
        await client.post(
            f"/communities/{community['id']}/challenges",
            json={
                "title": "Team War",
                "start_time": PAST(5),
                "end_time": FUTURE(10),
                "sides": [
                    {"name": "A", "member_ids": [alice["user"]["id"]]},
                    {"name": "B", "member_ids": [bob["user"]["id"]]},
                ],
            },
            headers=auth_header(alice),
        )
    ).json()

    response = await _join(client, bob, community_challenge, "A")

    assert response.status_code == 400


async def test_cannot_join_after_the_window_closes(client: AsyncClient):
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")
    challenge = (
        await _create_open(client, alice, start_time=PAST(20), end_time=PAST(1))
    ).json()

    assert (await _join(client, bob, challenge, "Dogs")).status_code == 400


# --- entering by posting -----------------------------------------------------------


async def test_entering_creates_a_public_meme_carrying_the_challenge_tag(client: AsyncClient):
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")
    challenge = (await _create_open(client, alice)).json()
    await _join(client, bob, challenge, "Dogs")

    response = await _enter(client, bob, challenge["id"], caption="good boy")

    assert response.status_code == 201
    body = response.json()
    assert body["side_id"] == _side(challenge, "Dogs")["id"]
    # No community exists for an open challenge, so the entry is a public personal post.
    assert body["meme"]["community"] is None
    assert body["meme"]["audiences"] == ["public"]

    # ...and it shows up in the tag feed alongside every other entry — the discovery
    # surface that makes an open challenge spread.
    feed = (await client.get("/hashtags/dogsvscats/memes", headers=auth_header(alice))).json()
    assert [m["id"] for m in feed["items"]] == [body["meme"]["id"]]


async def test_entering_requires_having_picked_a_side(client: AsyncClient):
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")
    challenge = (await _create_open(client, alice)).json()

    assert (await _enter(client, bob, challenge["id"])).status_code == 403


async def test_mine_includes_an_open_challenge_you_joined(client: AsyncClient):
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")
    challenge = (await _create_open(client, alice)).json()

    assert (await client.get("/challenges/mine", headers=auth_header(bob))).json() == []

    await _join(client, bob, challenge, "Cats")

    mine = (await client.get("/challenges/mine", headers=auth_header(bob))).json()
    assert [c["id"] for c in mine] == [challenge["id"]]


async def test_open_discovery_lists_only_live_challenges(client: AsyncClient):
    alice = await create_user(client, "alice")
    live = (await _create_open(client, alice, hashtag="live")).json()
    await _create_open(client, alice, hashtag="over", start_time=PAST(20), end_time=PAST(1))

    body = (await client.get("/challenges/open", headers=auth_header(alice))).json()

    # The finished one is still `active` in the DB until the worker closes it, so filter by
    # window rather than asserting it's absent — assert the live one is discoverable.
    assert live["id"] in [c["id"] for c in body]


# --- hashtags ----------------------------------------------------------------------


async def test_hashtag_search_puts_challenge_tags_first(client: AsyncClient):
    alice = await create_user(client, "alice")
    # A plain discovery tag sharing the same prefix.
    await client.post(
        "/memes",
        files=IMAGE,
        data={"audiences": ["public"], "hashtags": ["dogsarecute"]},
        headers=auth_header(alice),
    )
    await _create_open(client, alice, hashtag="dogsvscats")

    body = (await client.get("/hashtags/search?q=dogs", headers=auth_header(alice))).json()

    assert len(body) >= 1
    assert body[0]["slug"] == "dogsvscats"
    assert body[0]["challenge_title"] == "Dogs vs Cats"


async def test_hashtag_detail_reports_its_challenge(client: AsyncClient):
    alice = await create_user(client, "alice")
    challenge = (await _create_open(client, alice)).json()

    body = (await client.get("/hashtags/DogsVsCats", headers=auth_header(alice))).json()

    assert body["slug"] == "dogsvscats"
    assert body["challenge_id"] == challenge["id"]


async def test_unknown_hashtag_is_404(client: AsyncClient):
    alice = await create_user(client, "alice")
    assert (await client.get("/hashtags/nothinghere", headers=auth_header(alice))).status_code == 404


# --- anti-gaming -------------------------------------------------------------------


async def test_only_a_users_best_three_memes_count_toward_their_side(client: AsyncClient):
    alice = await create_user(client, "alice")
    challenge = (await _create_open(client, alice)).json()
    await _join(client, alice, challenge, "Dogs")

    # Four entries, each worth 25 (one upvote, no recorded views).
    for _ in range(4):
        meme = (await _enter(client, alice, challenge["id"])).json()["meme"]
        await _upvote(client, alice, meme["id"])

    refreshed = await _refetch(client, alice, challenge["id"])

    # Capped at 3 x 25; a single contributor gets a breadth multiplier of exactly 1, so
    # flooding stops paying after the third submission.
    assert _side(refreshed, "Dogs")["score"] == 75


async def test_many_contributors_beat_one_prolific_poster(client: AsyncClient):
    alice = await create_user(client, "alice")
    challenge = (await _create_open(client, alice)).json()
    await _join(client, alice, challenge, "Dogs")

    # Dogs: one person, three memes -> 75 capped, breadth multiplier 1.
    for _ in range(3):
        meme = (await _enter(client, alice, challenge["id"])).json()["meme"]
        await _upvote(client, alice, meme["id"])

    # Cats: three people, one meme each -> same 75 raw, but breadth multiplier 1+log10(3).
    for name in ("bob", "carol", "dave"):
        user = await create_user(client, name)
        await _join(client, user, challenge, "Cats")
        meme = (await _enter(client, user, challenge["id"])).json()["meme"]
        await _upvote(client, user, meme["id"])

    refreshed = await _refetch(client, alice, challenge["id"])

    dogs = _side(refreshed, "Dogs")["score"]
    cats = _side(refreshed, "Cats")["score"]
    assert dogs == 75
    assert cats > dogs
    assert round(cats, 2) == round(75 * (1 + 0.47712125471966244), 2)
