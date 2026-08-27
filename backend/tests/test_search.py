"""Roadmap_Search.md S3 — the global search aggregator.

The worked example at the top is the reason this phase exists: the original design
(whole-query prefix matching) returned zero results for its own worked example. If that
test regresses, the whole feature has regressed.
"""

import datetime
import uuid

from httpx import AsyncClient
from sqlalchemy import exists, select

from app.models.challenge import Challenge
from app.services.challenges import (
    _get_challenge_or_404,
    _require_involved_member,
    challenge_visibility_clause,
)
from tests.conftest import TestSessionFactory, auth_header, create_user

FUTURE = lambda minutes=10: (  # noqa: E731
    datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(minutes=minutes)
).isoformat()
PAST = lambda minutes=10: (  # noqa: E731
    datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(minutes=minutes)
).isoformat()

IMAGE = {"image": ("test.png", b"fake-bytes", "image/png")}


async def _post_meme(client: AsyncClient, user: dict, **overrides) -> dict:
    data = {"audiences": ["public"], **overrides}
    response = await client.post("/memes", files=IMAGE, data=data, headers=auth_header(user))
    return response.json()


async def _create_open_challenge(client: AsyncClient, user: dict, title: str, hashtag: str) -> dict:
    response = await client.post(
        "/challenges/open",
        json={
            "title": title,
            "hashtag": hashtag,
            "start_time": PAST(5),
            "end_time": FUTURE(60),
            "sides": [{"name": "A"}, {"name": "B"}],
        },
        headers=auth_header(user),
    )
    return response.json()


async def _befriend(client: AsyncClient, alice: dict, bob: dict) -> None:
    response = await client.post(
        "/friends/requests", json={"username": bob["user"]["username"]}, headers=auth_header(alice)
    )
    await client.post(f"/friends/requests/{response.json()['id']}/accept", headers=auth_header(bob))


async def _create_community(client: AsyncClient, owner: dict, name: str, privacy: str = "open") -> dict:
    response = await client.post(
        "/communities", data={"name": name, "privacy": privacy}, headers=auth_header(owner)
    )
    return response.json()


async def test_worked_example_barcelona_vs_real_madrid(client: AsyncClient):
    """The design-review-failing example: search "Barcelona vs Real Madrid" must surface
    #ElClasico (via its owning challenge's title), #RealMadrid, #Barcelona in Tags; the
    challenge itself in Challenges; and their memes in Posts."""
    alice = await create_user(client, "alice")
    challenge = await _create_open_challenge(client, alice, "Barcelona vs Real Madrid", "ElClasico")

    await _post_meme(client, alice, hashtags=["RealMadrid"])
    await _post_meme(client, alice, hashtags=["Barcelona"])

    side_id = challenge["sides"][0]["id"]
    await client.post(
        f"/challenges/{challenge['id']}/join", json={"side_id": side_id}, headers=auth_header(alice)
    )
    entry = await client.post(
        f"/challenges/{challenge['id']}/submissions",
        files=IMAGE,
        data={"caption": "clasico time"},
        headers=auth_header(alice),
    )
    assert entry.status_code == 201

    body = (
        await client.get(
            "/search", params={"q": "Barcelona vs Real Madrid"}, headers=auth_header(alice)
        )
    ).json()

    tag_slugs = {item["slug"] for item in body["tags"]["items"]}
    assert {"elclasico", "realmadrid", "barcelona"} <= tag_slugs

    challenge_ids = {item["id"] for item in body["challenges"]["items"]}
    assert challenge["id"] in challenge_ids

    post_ids = {item["id"] for item in body["posts"]["items"]}
    assert entry.json()["meme"]["id"] in post_ids


async def test_tag_matching_two_tokens_outranks_one_token(client: AsyncClient):
    alice = await create_user(client, "alice")
    await _post_meme(client, alice, hashtags=["dogsvscats"])
    await _post_meme(client, alice, hashtags=["dogsarecute"])

    body = (
        await client.get("/search", params={"q": "dogs cats", "scope": "tags"}, headers=auth_header(alice))
    ).json()

    slugs = [item["slug"] for item in body["items"]]
    assert slugs.index("dogsvscats") < slugs.index("dogsarecute")


async def test_posts_returns_caption_only_and_tag_only_matches(client: AsyncClient):
    alice = await create_user(client, "alice")
    caption_only = await _post_meme(client, alice, caption="a wild giraffe appears")
    tag_only = await _post_meme(client, alice, hashtags=["giraffelovers"])

    body = (
        await client.get(
            "/search", params={"q": "giraffe", "scope": "posts"}, headers=auth_header(alice)
        )
    ).json()

    post_ids = {item["id"] for item in body["items"]}
    assert caption_only["id"] in post_ids
    assert tag_only["id"] in post_ids


async def test_friends_only_meme_visible_to_friend_not_stranger(client: AsyncClient):
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")
    stranger = await create_user(client, "stranger")
    await _befriend(client, alice, bob)

    meme = await _post_meme(client, alice, audiences=["friends"], caption="secretgiraffe")

    stranger_body = (
        await client.get(
            "/search", params={"q": "secretgiraffe", "scope": "posts"}, headers=auth_header(stranger)
        )
    ).json()
    assert meme["id"] not in {item["id"] for item in stranger_body["items"]}

    bob_body = (
        await client.get(
            "/search", params={"q": "secretgiraffe", "scope": "posts"}, headers=auth_header(bob)
        )
    ).json()
    assert meme["id"] in {item["id"] for item in bob_body["items"]}


async def test_community_private_post_visible_to_member_not_outsider(client: AsyncClient):
    alice = await create_user(client, "alice")
    outsider = await create_user(client, "outsider")
    community = await _create_community(client, alice, "Private Crew", privacy="invite_only")

    files = {"image": ("test.png", b"fake-bytes", "image/png")}
    meme = (
        await client.post(
            f"/communities/{community['id']}/memes",
            files=files,
            data={"caption": "communitygiraffe"},
            headers=auth_header(alice),
        )
    ).json()

    outsider_body = (
        await client.get(
            "/search", params={"q": "communitygiraffe", "scope": "posts"}, headers=auth_header(outsider)
        )
    ).json()
    assert meme["id"] not in {item["id"] for item in outsider_body["items"]}

    alice_body = (
        await client.get(
            "/search", params={"q": "communitygiraffe", "scope": "posts"}, headers=auth_header(alice)
        )
    ).json()
    assert meme["id"] in {item["id"] for item in alice_body["items"]}


async def test_soft_deleted_meme_never_appears(client: AsyncClient):
    alice = await create_user(client, "alice")
    meme = await _post_meme(client, alice, caption="deletedgiraffe")
    await client.delete(f"/memes/{meme['id']}", headers=auth_header(alice))

    body = (
        await client.get(
            "/search", params={"q": "deletedgiraffe", "scope": "posts"}, headers=auth_header(alice)
        )
    ).json()
    assert meme["id"] not in {item["id"] for item in body["items"]}


async def test_intra_community_challenge_invisible_to_non_member(client: AsyncClient):
    alice = await create_user(client, "alice")
    teammate = await create_user(client, "teammate")
    outsider = await create_user(client, "outsider")
    # Open privacy so `teammate` can self-join immediately — irrelevant to the assertion:
    # intra_community visibility never gets the open-community non-member carve-out
    # regardless of privacy, unlike community_vs_community.
    community = await _create_community(client, alice, "Team Corp", privacy="open")
    await client.post(f"/communities/{community['id']}/join", headers=auth_header(teammate))
    challenge = (
        await client.post(
            f"/communities/{community['id']}/challenges",
            json={
                "title": "Corp Intra Skirmish",
                "start_time": PAST(5),
                "end_time": FUTURE(60),
                "sides": [
                    {"name": "A", "member_ids": [alice["user"]["id"]]},
                    {"name": "B", "member_ids": [teammate["user"]["id"]]},
                ],
            },
            headers=auth_header(alice),
        )
    ).json()

    body = (
        await client.get(
            "/search",
            params={"q": "Corp Intra Skirmish", "scope": "challenges"},
            headers=auth_header(outsider),
        )
    ).json()
    assert challenge["id"] not in {item["id"] for item in body["items"]}

    alice_body = (
        await client.get(
            "/search",
            params={"q": "Corp Intra Skirmish", "scope": "challenges"},
            headers=auth_header(alice),
        )
    ).json()
    assert challenge["id"] in {item["id"] for item in alice_body["items"]}


async def test_duel_invisible_to_third_party(client: AsyncClient):
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")
    third_party = await create_user(client, "thirdparty")
    await _befriend(client, alice, bob)

    duel = (
        await client.post(
            f"/challenges/duels/{bob['user']['id']}",
            json={"title": "Giraffe Duel Special", "start_time": PAST(1), "end_time": FUTURE(10)},
            headers=auth_header(alice),
        )
    ).json()

    outsider_body = (
        await client.get(
            "/search",
            params={"q": "Giraffe Duel Special", "scope": "challenges"},
            headers=auth_header(third_party),
        )
    ).json()
    assert duel["id"] not in {item["id"] for item in outsider_body["items"]}

    alice_body = (
        await client.get(
            "/search",
            params={"q": "Giraffe Duel Special", "scope": "challenges"},
            headers=auth_header(alice),
        )
    ).json()
    assert duel["id"] in {item["id"] for item in alice_body["items"]}


async def test_open_community_vs_challenge_visible_to_non_member_invite_only_is_not(
    client: AsyncClient,
):
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")
    outsider = await create_user(client, "outsider")
    open_home = await _create_community(client, alice, "Open Home Turf", privacy="open")
    invite_only_home = await _create_community(client, alice, "Invite Home Turf", privacy="invite_only")
    open_opponent = await _create_community(client, bob, "Open Opponent Turf", privacy="open")
    invite_only_opponent = await _create_community(
        client, bob, "Invite Opponent Turf", privacy="invite_only"
    )

    open_challenge = (
        await client.post(
            f"/communities/{open_home['id']}/challenges/vs/{open_opponent['id']}",
            json={"title": "Open Turf Showdown", "start_time": PAST(1), "end_time": FUTURE(60)},
            headers=auth_header(alice),
        )
    ).json()
    await client.post(
        f"/communities/{open_opponent['id']}/challenges/{open_challenge['id']}/accept",
        headers=auth_header(bob),
    )

    # Both sides invite-only this time — the open-community carve-out requires *either*
    # side to be open, so neither being open must keep this genuinely invisible.
    invite_challenge = (
        await client.post(
            f"/communities/{invite_only_home['id']}/challenges/vs/{invite_only_opponent['id']}",
            json={"title": "Invite Turf Showdown", "start_time": PAST(1), "end_time": FUTURE(60)},
            headers=auth_header(alice),
        )
    ).json()
    await client.post(
        f"/communities/{invite_only_opponent['id']}/challenges/{invite_challenge['id']}/accept",
        headers=auth_header(bob),
    )

    open_result = (
        await client.get(
            "/search",
            params={"q": "Open Turf Showdown", "scope": "challenges"},
            headers=auth_header(outsider),
        )
    ).json()
    assert open_challenge["id"] in {item["id"] for item in open_result["items"]}

    invite_result = (
        await client.get(
            "/search",
            params={"q": "Invite Turf Showdown", "scope": "challenges"},
            headers=auth_header(outsider),
        )
    ).json()
    assert invite_challenge["id"] not in {item["id"] for item in invite_result["items"]}


async def test_challenge_visibility_clause_matches_require_involved_member(client: AsyncClient):
    """Drift between `challenge_visibility_clause` and `_require_involved_member` is an
    information leak, not a cosmetic bug — this checks every shape agrees for every viewer
    scenario the two guards actually branch on.
    """
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")
    outsider = await create_user(client, "outsider")
    await _befriend(client, alice, bob)

    open_challenge = await _create_open_challenge(client, alice, "Parity Open", "parityopen")

    community = await _create_community(client, alice, "Parity Intra", privacy="open")
    await client.post(f"/communities/{community['id']}/join", headers=auth_header(bob))
    intra = (
        await client.post(
            f"/communities/{community['id']}/challenges",
            json={
                "title": "Parity Intra Challenge",
                "start_time": PAST(5),
                "end_time": FUTURE(60),
                "sides": [
                    {"name": "A", "member_ids": [alice["user"]["id"]]},
                    {"name": "B", "member_ids": [bob["user"]["id"]]},
                ],
            },
            headers=auth_header(alice),
        )
    ).json()

    duel = (
        await client.post(
            f"/challenges/duels/{bob['user']['id']}",
            json={"title": "Parity Duel", "start_time": PAST(1), "end_time": FUTURE(10)},
            headers=auth_header(alice),
        )
    ).json()

    open_home = await _create_community(client, alice, "Parity VS Open Home", privacy="open")
    opponent = await _create_community(client, bob, "Parity VS Opponent")
    vs_challenge = (
        await client.post(
            f"/communities/{open_home['id']}/challenges/vs/{opponent['id']}",
            json={"title": "Parity VS Challenge", "start_time": PAST(1), "end_time": FUTURE(60)},
            headers=auth_header(alice),
        )
    ).json()
    await client.post(
        f"/communities/{opponent['id']}/challenges/{vs_challenge['id']}/accept",
        headers=auth_header(bob),
    )

    challenge_ids = [open_challenge["id"], intra["id"], duel["id"], vs_challenge["id"]]
    viewer_ids = [
        uuid.UUID(alice["user"]["id"]),
        uuid.UUID(bob["user"]["id"]),
        uuid.UUID(outsider["user"]["id"]),
    ]

    async with TestSessionFactory() as session:
        for challenge_id_str in challenge_ids:
            challenge_id = uuid.UUID(challenge_id_str)
            challenge = await _get_challenge_or_404(session, challenge_id)
            for viewer_id in viewer_ids:
                try:
                    await _require_involved_member(session, challenge, viewer_id)
                    require_allows = True
                except Exception:
                    require_allows = False

                clause_allows = bool(
                    await session.scalar(
                        select(
                            exists().where(
                                challenge_visibility_clause(viewer_id), Challenge.id == challenge_id
                            )
                        )
                    )
                )
                assert clause_allows == require_allows, (
                    f"parity mismatch: challenge={challenge_id_str} viewer={viewer_id} "
                    f"clause={clause_allows} require={require_allows}"
                )


async def test_scope_all_caps_every_section_at_10_and_sets_capped(client: AsyncClient):
    alice = await create_user(client, "alice")
    for _ in range(12):
        await _post_meme(client, alice, caption="cappedgiraffe repeated post")

    body = (
        await client.get(
            "/search", params={"q": "cappedgiraffe"}, headers=auth_header(alice)
        )
    ).json()

    assert body["posts"]["count"] == 10
    assert body["posts"]["capped"] is True
    assert body["posts"]["has_more"] is True


async def test_short_query_returns_empty_sections_with_200(client: AsyncClient):
    alice = await create_user(client, "alice")
    body = (await client.get("/search", params={"q": "a"}, headers=auth_header(alice))).json()

    assert body["tags"]["items"] == []
    assert body["posts"]["items"] == []
    assert body["people"]["items"] == []
    assert body["communities"]["items"] == []
    assert body["challenges"]["items"] == []


async def test_search_requires_auth(client: AsyncClient):
    response = await client.get("/search", params={"q": "anything"})
    assert response.status_code == 401
