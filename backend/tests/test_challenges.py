import asyncio
import datetime
import uuid

from httpx import AsyncClient

from app.services.challenges import evaluate_challenge
from tests.conftest import TestSessionFactory, auth_header, create_user

FUTURE = lambda minutes=10: (  # noqa: E731
    datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(minutes=minutes)
).isoformat()
PAST = lambda minutes=10: (  # noqa: E731
    datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(minutes=minutes)
).isoformat()


async def _create_community(client: AsyncClient, owner: dict, privacy: str = "open") -> dict:
    response = await client.post(
        "/communities", data={"name": "Meme Lords", "privacy": privacy}, headers=auth_header(owner)
    )
    return response.json()


async def _join(client: AsyncClient, user: dict, community_id: str) -> None:
    await client.post(f"/communities/{community_id}/join", headers=auth_header(user))


async def _post_meme(client: AsyncClient, user: dict) -> dict:
    files = {"image": ("test.png", b"fake-bytes", "image/png")}
    response = await client.post(
        "/memes", files=files, data={"audiences": ["public"]}, headers=auth_header(user)
    )
    return response.json()


async def _setup_two_side_challenge(
    client: AsyncClient, owner: dict, member_b: dict, community_id: str,
    start_time: str | None = None, end_time: str | None = None,
) -> dict:
    """Owner is placed on Team A, `member_b` on Team B."""
    payload = {
        "title": "Meme War",
        "start_time": start_time or PAST(1),
        "end_time": end_time or FUTURE(10),
        "sides": [
            {"name": "Team A", "member_ids": [owner["user"]["id"]]},
            {"name": "Team B", "member_ids": [member_b["user"]["id"]]},
        ],
    }
    response = await client.post(
        f"/communities/{community_id}/challenges", json=payload, headers=auth_header(owner)
    )
    return response


async def test_owner_can_create_challenge_non_owner_cannot(client: AsyncClient):
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")
    community = await _create_community(client, alice)
    await _join(client, bob, community["id"])

    response = await _setup_two_side_challenge(client, alice, bob, community["id"])
    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "active"
    assert len(body["sides"]) == 2

    non_owner_response = await client.post(
        f"/communities/{community['id']}/challenges",
        json={
            "title": "X", "start_time": PAST(1), "end_time": FUTURE(10),
            "sides": [
                {"name": "A", "member_ids": [alice["user"]["id"]]},
                {"name": "B", "member_ids": [bob["user"]["id"]]},
            ],
        },
        headers=auth_header(bob),
    )
    assert non_owner_response.status_code == 403


async def test_create_challenge_rejects_non_member_assignment(client: AsyncClient):
    alice = await create_user(client, "alice")
    outsider = await create_user(client, "outsider")
    community = await _create_community(client, alice)

    response = await client.post(
        f"/communities/{community['id']}/challenges",
        json={
            "title": "X", "start_time": PAST(1), "end_time": FUTURE(10),
            "sides": [
                {"name": "A", "member_ids": [alice["user"]["id"]]},
                {"name": "B", "member_ids": [outsider["user"]["id"]]},
            ],
        },
        headers=auth_header(alice),
    )
    assert response.status_code == 400


async def test_create_challenge_rejects_member_on_two_sides(client: AsyncClient):
    alice = await create_user(client, "alice")
    community = await _create_community(client, alice)

    response = await client.post(
        f"/communities/{community['id']}/challenges",
        json={
            "title": "X", "start_time": PAST(1), "end_time": FUTURE(10),
            "sides": [
                {"name": "A", "member_ids": [alice["user"]["id"]]},
                {"name": "B", "member_ids": [alice["user"]["id"]]},
            ],
        },
        headers=auth_header(alice),
    )
    assert response.status_code == 400


async def test_create_challenge_rejects_bad_time_window(client: AsyncClient):
    alice = await create_user(client, "alice")
    community = await _create_community(client, alice)

    response = await client.post(
        f"/communities/{community['id']}/challenges",
        json={
            "title": "X", "start_time": FUTURE(10), "end_time": PAST(10),
            "sides": [
                {"name": "A", "member_ids": [alice["user"]["id"]]},
                {"name": "B", "member_ids": [alice["user"]["id"]]},
            ],
        },
        headers=auth_header(alice),
    )
    assert response.status_code == 400


async def test_submission_succeeds_for_assigned_participant(client: AsyncClient):
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")
    community = await _create_community(client, alice)
    await _join(client, bob, community["id"])
    challenge = (await _setup_two_side_challenge(client, alice, bob, community["id"])).json()

    meme = await _post_meme(client, alice)
    response = await client.post(
        f"/communities/{community['id']}/challenges/{challenge['id']}/submissions",
        params={"meme_id": meme["id"]},
        headers=auth_header(alice),
    )
    assert response.status_code == 201
    body = response.json()
    assert body["meme"]["id"] == meme["id"]


async def test_submission_rejected_for_non_participant(client: AsyncClient):
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")
    outsider = await create_user(client, "outsider")
    community = await _create_community(client, alice)
    await _join(client, bob, community["id"])
    challenge = (await _setup_two_side_challenge(client, alice, bob, community["id"])).json()

    meme = await _post_meme(client, outsider)
    response = await client.post(
        f"/communities/{community['id']}/challenges/{challenge['id']}/submissions",
        params={"meme_id": meme["id"]},
        headers=auth_header(outsider),
    )
    assert response.status_code == 403


async def test_submission_rejected_for_someone_elses_meme(client: AsyncClient):
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")
    community = await _create_community(client, alice)
    await _join(client, bob, community["id"])
    challenge = (await _setup_two_side_challenge(client, alice, bob, community["id"])).json()

    meme = await _post_meme(client, bob)
    response = await client.post(
        f"/communities/{community['id']}/challenges/{challenge['id']}/submissions",
        params={"meme_id": meme["id"]},
        headers=auth_header(alice),
    )
    assert response.status_code == 400


async def test_submission_rejected_after_window_close(client: AsyncClient):
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")
    community = await _create_community(client, alice)
    await _join(client, bob, community["id"])
    challenge = (
        await _setup_two_side_challenge(
            client, alice, bob, community["id"], start_time=PAST(20), end_time=PAST(1)
        )
    ).json()

    meme = await _post_meme(client, alice)
    response = await client.post(
        f"/communities/{community['id']}/challenges/{challenge['id']}/submissions",
        params={"meme_id": meme["id"]},
        headers=auth_header(alice),
    )
    assert response.status_code == 400


async def test_submission_rejected_for_a_deleted_meme(client: AsyncClient):
    """A deleted post can never be *freshly* nominated for a challenge — see
    services/challenges.py::submit_to_challenge's deleted-meme check."""
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")
    community = await _create_community(client, alice)
    await _join(client, bob, community["id"])
    challenge = (await _setup_two_side_challenge(client, alice, bob, community["id"])).json()

    meme = await _post_meme(client, alice)
    delete_response = await client.delete(f"/memes/{meme['id']}", headers=auth_header(alice))
    assert delete_response.status_code == 204

    response = await client.post(
        f"/communities/{community['id']}/challenges/{challenge['id']}/submissions",
        params={"meme_id": meme["id"]},
        headers=auth_header(alice),
    )
    assert response.status_code == 400


async def test_challenge_score_survives_meme_deletion_after_submission(client: AsyncClient):
    """A meme submitted *before* being deleted keeps counting toward its side's score —
    only a *fresh* nomination is blocked by deletion (test_submission_rejected_for_a_deleted_meme
    above), not an existing one. Confirmed product decision, see
    services/challenges.py::_side_scores's header comment."""
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")
    community = await _create_community(client, alice)
    await _join(client, bob, community["id"])
    challenge = (await _setup_two_side_challenge(client, alice, bob, community["id"])).json()

    winning_meme = await _post_meme(client, alice)
    await client.post(
        f"/communities/{community['id']}/challenges/{challenge['id']}/submissions",
        params={"meme_id": winning_meme["id"]}, headers=auth_header(alice),
    )
    carol = await create_user(client, "carol")
    await client.post(
        f"/memes/{winning_meme['id']}/votes", json={"value": 1}, headers=auth_header(carol)
    )

    losing_meme = await _post_meme(client, bob)
    await client.post(
        f"/communities/{community['id']}/challenges/{challenge['id']}/submissions",
        params={"meme_id": losing_meme["id"]}, headers=auth_header(bob),
    )

    # Alice deletes her already-submitted, already-winning meme — the submission and its
    # score must still stand at evaluation time.
    delete_response = await client.delete(f"/memes/{winning_meme['id']}", headers=auth_header(alice))
    assert delete_response.status_code == 204

    async with TestSessionFactory() as session:
        evaluated = await evaluate_challenge(session, uuid.UUID(challenge["id"]))
    assert evaluated.status.value == "evaluated"

    winning_side_id = evaluated.winning_side_id
    assert winning_side_id is not None
    winning_side = next(s for s in challenge["sides"] if s["id"] == str(winning_side_id))
    assert winning_side["name"] == "Team A"


async def test_concurrent_submission_of_same_meme_never_returns_500(client: AsyncClient):
    """Both requests pass the "already submitted?" check before either commits; the DB
    unique constraint catches the loser — must be a clean 400, never a raw 500."""
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")
    community = await _create_community(client, alice)
    await _join(client, bob, community["id"])
    challenge = (await _setup_two_side_challenge(client, alice, bob, community["id"])).json()
    meme = await _post_meme(client, alice)

    responses = await asyncio.gather(
        client.post(
            f"/communities/{community['id']}/challenges/{challenge['id']}/submissions",
            params={"meme_id": meme["id"]},
            headers=auth_header(alice),
        ),
        client.post(
            f"/communities/{community['id']}/challenges/{challenge['id']}/submissions",
            params={"meme_id": meme["id"]},
            headers=auth_header(alice),
        ),
    )
    assert sorted(r.status_code for r in responses) == [201, 400]


async def test_evaluate_challenge_picks_winner_and_awards_points_and_badge(client: AsyncClient):
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")
    community = await _create_community(client, alice)
    await _join(client, bob, community["id"])
    challenge = (await _setup_two_side_challenge(client, alice, bob, community["id"])).json()

    # Team A (alice) submits a meme, then gets it upvoted via an extra account to
    # make its score (net votes + 2*comments, the Phase 8 stub) beat Team B's meme.
    winning_meme = await _post_meme(client, alice)
    await client.post(
        f"/communities/{community['id']}/challenges/{challenge['id']}/submissions",
        params={"meme_id": winning_meme["id"]}, headers=auth_header(alice),
    )
    carol = await create_user(client, "carol")
    await client.post(
        f"/memes/{winning_meme['id']}/votes", json={"value": 1}, headers=auth_header(carol)
    )

    losing_meme = await _post_meme(client, bob)
    await client.post(
        f"/communities/{community['id']}/challenges/{challenge['id']}/submissions",
        params={"meme_id": losing_meme["id"]}, headers=auth_header(bob),
    )

    async with TestSessionFactory() as session:
        evaluated = await evaluate_challenge(session, uuid.UUID(challenge["id"]))
    assert evaluated.status.value == "evaluated"

    winning_side_id = evaluated.winning_side_id
    assert winning_side_id is not None
    winning_side = next(s for s in challenge["sides"] if s["id"] == str(winning_side_id))
    assert winning_side["name"] == "Team A"

    results = await client.get(
        f"/communities/{community['id']}/challenges/{challenge['id']}/results",
        headers=auth_header(alice),
    )
    assert results.status_code == 200
    assert results.json()["challenge"]["status"] == "evaluated"

    badges = await client.get("/auth/me/badges", headers=auth_header(alice))
    assert badges.status_code == 200
    assert len(badges.json()) == 1
    assert badges.json()[0]["points"] == 100

    loser_badges = await client.get("/auth/me/badges", headers=auth_header(bob))
    assert loser_badges.json() == []


async def test_results_rejected_before_evaluation(client: AsyncClient):
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")
    community = await _create_community(client, alice)
    await _join(client, bob, community["id"])
    challenge = (await _setup_two_side_challenge(client, alice, bob, community["id"])).json()

    response = await client.get(
        f"/communities/{community['id']}/challenges/{challenge['id']}/results",
        headers=auth_header(alice),
    )
    assert response.status_code == 400


async def test_non_member_cannot_view_challenge(client: AsyncClient):
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")
    outsider = await create_user(client, "outsider")
    community = await _create_community(client, alice)
    await _join(client, bob, community["id"])
    challenge = (await _setup_two_side_challenge(client, alice, bob, community["id"])).json()

    response = await client.get(
        f"/communities/{community['id']}/challenges/{challenge['id']}",
        headers=auth_header(outsider),
    )
    assert response.status_code == 403


async def test_challenge_requires_auth(client: AsyncClient):
    alice = await create_user(client, "alice")
    community = await _create_community(client, alice)
    response = await client.get(f"/communities/{community['id']}/challenges")
    assert response.status_code == 401
