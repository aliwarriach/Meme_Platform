"""Phase 18 — the pieces that make challenges findable and enterable:
a cross-community `GET /challenges/mine` list, live per-side scores on every challenge
read, and `POST /challenges/{id}/submissions` which creates a meme and enters it into the
challenge in one transaction (replacing the old post-then-navigate-then-submit flow).
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


async def _create_community(client: AsyncClient, owner: dict, name: str, privacy: str = "open") -> dict:
    response = await client.post(
        "/communities", data={"name": name, "privacy": privacy}, headers=auth_header(owner)
    )
    return response.json()


async def _join(client: AsyncClient, user: dict, community_id: str) -> None:
    await client.post(f"/communities/{community_id}/join", headers=auth_header(user))


async def _create_intra_challenge(
    client: AsyncClient,
    owner: dict,
    member_b: dict,
    community_id: str,
    end_time: str | None = None,
    start_time: str | None = None,
) -> dict:
    payload = {
        "title": "Meme War",
        "start_time": start_time or PAST(5),
        "end_time": end_time or FUTURE(10),
        "sides": [
            {"name": "Team A", "member_ids": [owner["user"]["id"]]},
            {"name": "Team B", "member_ids": [member_b["user"]["id"]]},
        ],
    }
    response = await client.post(
        f"/communities/{community_id}/challenges", json=payload, headers=auth_header(owner)
    )
    return response.json()


async def _create_and_submit(client: AsyncClient, user: dict, challenge_id: str, caption: str = "hi"):
    return await client.post(
        f"/challenges/{challenge_id}/submissions",
        files=IMAGE,
        data={"caption": caption},
        headers=auth_header(user),
    )


def _side(challenge: dict, name: str) -> dict:
    return next(s for s in challenge["sides"] if s["name"] == name)


# --- GET /challenges/mine ----------------------------------------------------------


async def test_mine_lists_challenges_across_every_community_the_caller_is_in(client: AsyncClient):
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")

    own_community = await _create_community(client, alice, "Alice Town")
    await _join(client, bob, own_community["id"])
    await _create_intra_challenge(client, alice, bob, own_community["id"])

    # A second community alice merely joined — its challenges must show up too, which is
    # the whole point of the cross-community list.
    other_community = await _create_community(client, bob, "Bob City")
    await _join(client, alice, other_community["id"])
    await _create_intra_challenge(client, bob, alice, other_community["id"])

    response = await client.get("/challenges/mine", headers=auth_header(alice))

    assert response.status_code == 200
    body = response.json()
    assert len(body) == 2
    assert {c["community_name"] for c in body} == {"Alice Town", "Bob City"}


async def test_mine_excludes_challenges_from_communities_the_caller_is_not_in(client: AsyncClient):
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")
    carol = await create_user(client, "carol")

    community = await _create_community(client, alice, "Alice Town")
    await _join(client, bob, community["id"])
    await _create_intra_challenge(client, alice, bob, community["id"])

    response = await client.get("/challenges/mine", headers=auth_header(carol))

    assert response.status_code == 200
    assert response.json() == []


async def test_mine_includes_a_vs_proposal_where_the_caller_is_the_opponent(client: AsyncClient):
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")
    home = await _create_community(client, alice, "Alice Town")
    away = await _create_community(client, bob, "Bob City")

    await client.post(
        f"/communities/{home['id']}/challenges/vs/{away['id']}",
        json={"title": "Clash", "start_time": PAST(1), "end_time": FUTURE(10)},
        headers=auth_header(alice),
    )

    # This list is how the challenged community's owner discovers a pending proposal —
    # there is no separate incoming-proposals inbox.
    response = await client.get("/challenges/mine", headers=auth_header(bob))

    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    assert body[0]["status"] == "setup"
    assert body[0]["community_name"] == "Alice Town"
    assert body[0]["opponent_community_name"] == "Bob City"


async def test_mine_orders_active_challenges_before_finished_ones(client: AsyncClient):
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")
    community = await _create_community(client, alice, "Alice Town")
    await _join(client, bob, community["id"])

    await _create_intra_challenge(client, alice, bob, community["id"], end_time=FUTURE(60))
    await _create_intra_challenge(client, alice, bob, community["id"], end_time=FUTURE(5))

    body = (await client.get("/challenges/mine", headers=auth_header(alice))).json()

    # Soonest deadline first among live challenges — that's the urgent one.
    assert [c["status"] for c in body] == ["active", "active"]
    assert body[0]["end_time"] < body[1]["end_time"]


async def test_mine_requires_auth(client: AsyncClient):
    assert (await client.get("/challenges/mine")).status_code == 401


# --- live side scores --------------------------------------------------------------


async def test_side_scores_are_live_during_the_active_window(client: AsyncClient):
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")
    community = await _create_community(client, alice, "Alice Town")
    await _join(client, bob, community["id"])
    challenge = await _create_intra_challenge(client, alice, bob, community["id"])

    assert _side(challenge, "Team A")["score"] == 0

    submission = (await _create_and_submit(client, alice, challenge["id"])).json()
    await client.post(
        f"/memes/{submission['meme']['id']}/votes", json={"value": 1}, headers=auth_header(alice)
    )

    refreshed = (
        await client.get(
            f"/communities/{community['id']}/challenges/{challenge['id']}",
            headers=auth_header(alice),
        )
    ).json()

    # One upvote, no recorded views — the scoring atom's documented value for that is 25.
    assert refreshed["status"] == "active"
    assert _side(refreshed, "Team A")["score"] == 25
    assert _side(refreshed, "Team B")["score"] == 0


# --- POST /challenges/{id}/submissions (create + submit in one call) ----------------


async def test_create_and_submit_posts_the_meme_and_enters_it_in_one_call(client: AsyncClient):
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")
    community = await _create_community(client, alice, "Alice Town")
    await _join(client, bob, community["id"])
    challenge = await _create_intra_challenge(client, alice, bob, community["id"])

    response = await _create_and_submit(client, alice, challenge["id"], caption="for the team")

    assert response.status_code == 201
    body = response.json()
    assert body["side_id"] == _side(challenge, "Team A")["id"]
    assert body["meme"]["caption"] == "for the team"
    # The meme is a real community post, not a submission-only artifact — it carries the
    # community audience that makes it visible in the community feed and countable on the
    # community leaderboard.
    assert body["meme"]["community"]["id"] == community["id"]

    feed = (
        await client.get(f"/communities/{community['id']}/feed", headers=auth_header(bob))
    ).json()
    assert [m["id"] for m in feed["items"]] == [body["meme"]["id"]]


async def test_create_and_submit_works_for_a_community_vs_community_challenge(client: AsyncClient):
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")
    home = await _create_community(client, alice, "Alice Town")
    away = await _create_community(client, bob, "Bob City")

    proposal = (
        await client.post(
            f"/communities/{home['id']}/challenges/vs/{away['id']}",
            json={"title": "Clash", "start_time": PAST(1), "end_time": FUTURE(10)},
            headers=auth_header(alice),
        )
    ).json()
    await client.post(
        f"/communities/{away['id']}/challenges/{proposal['id']}/accept", headers=auth_header(bob)
    )

    response = await _create_and_submit(client, bob, proposal["id"])

    assert response.status_code == 201
    body = response.json()
    # Posted into bob's own side-community, not the proposing one.
    assert body["meme"]["community"]["id"] == away["id"]
    assert body["side_id"] == next(s for s in proposal["sides"] if s["community_id"] == away["id"])["id"]


async def test_create_and_submit_rejects_a_non_participant(client: AsyncClient):
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")
    carol = await create_user(client, "carol")
    community = await _create_community(client, alice, "Alice Town")
    await _join(client, bob, community["id"])
    await _join(client, carol, community["id"])
    challenge = await _create_intra_challenge(client, alice, bob, community["id"])

    # carol is a community member but was never assigned to a side.
    response = await _create_and_submit(client, carol, challenge["id"])

    assert response.status_code == 403


async def test_create_and_submit_rejects_after_the_window_closes(client: AsyncClient):
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")
    community = await _create_community(client, alice, "Alice Town")
    await _join(client, bob, community["id"])
    challenge = await _create_intra_challenge(
        client, alice, bob, community["id"], start_time=PAST(10), end_time=PAST(1)
    )

    response = await _create_and_submit(client, alice, challenge["id"])

    assert response.status_code == 400


async def test_create_and_submit_rejects_a_pending_proposal(client: AsyncClient):
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")
    home = await _create_community(client, alice, "Alice Town")
    away = await _create_community(client, bob, "Bob City")

    proposal = (
        await client.post(
            f"/communities/{home['id']}/challenges/vs/{away['id']}",
            json={"title": "Clash", "start_time": PAST(1), "end_time": FUTURE(10)},
            headers=auth_header(alice),
        )
    ).json()

    # Still `setup` — the opponent hasn't accepted, so nothing can be submitted yet.
    response = await _create_and_submit(client, alice, proposal["id"])

    assert response.status_code == 400


async def test_create_and_submit_requires_auth(client: AsyncClient):
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")
    community = await _create_community(client, alice, "Alice Town")
    await _join(client, bob, community["id"])
    challenge = await _create_intra_challenge(client, alice, bob, community["id"])

    response = await client.post(f"/challenges/{challenge['id']}/submissions", files=IMAGE)

    assert response.status_code == 401
