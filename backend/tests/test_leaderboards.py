from httpx import AsyncClient

from tests.conftest import auth_header, create_user


async def _create_community(
    client: AsyncClient, owner: dict, privacy: str = "open", name: str = "Meme Lords"
) -> dict:
    response = await client.post(
        "/communities", data={"name": name, "privacy": privacy}, headers=auth_header(owner)
    )
    return response.json()


async def _post_meme(client: AsyncClient, user: dict, audiences: list[str] = ["public"]) -> dict:
    files = {"image": ("test.png", b"fake-bytes", "image/png")}
    response = await client.post(
        "/memes", files=files, data={"audiences": audiences}, headers=auth_header(user)
    )
    return response.json()


async def _post_community_meme(client: AsyncClient, user: dict, community_id: str) -> dict:
    files = {"image": ("test.png", b"fake-bytes", "image/png")}
    response = await client.post(
        f"/communities/{community_id}/memes", files=files, headers=auth_header(user)
    )
    return response.json()


async def _react(client: AsyncClient, user: dict, meme_id: str) -> None:
    response = await client.post(f"/memes/{meme_id}/reactions", headers=auth_header(user))
    assert response.status_code == 201


async def _comment(client: AsyncClient, user: dict, meme_id: str) -> None:
    response = await client.post(
        f"/memes/{meme_id}/comments", json={"body": "lol"}, headers=auth_header(user)
    )
    assert response.status_code == 201


async def test_individual_leaderboard_ranks_by_reactions_and_comments(client: AsyncClient):
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")
    carol = await create_user(client, "carol")

    alice_meme = await _post_meme(client, alice)
    await _react(client, bob, alice_meme["id"])
    await _react(client, carol, alice_meme["id"])
    await _comment(client, bob, alice_meme["id"])
    # alice's score: 2 reactions * 1 + 1 comment * 2 = 4

    bob_meme = await _post_meme(client, bob)
    await _react(client, alice, bob_meme["id"])
    # bob's score: 1 reaction * 1 = 1

    response = await client.get("/leaderboards/individual", headers=auth_header(alice))
    assert response.status_code == 200
    body = response.json()
    usernames_in_order = [item["user"]["username"] for item in body["items"]]
    assert usernames_in_order.index("alice") < usernames_in_order.index("bob")

    alice_entry = next(i for i in body["items"] if i["user"]["username"] == "alice")
    assert alice_entry["score"] == 4
    assert alice_entry["rank"] == usernames_in_order.index("alice") + 1

    # carol never posted — she must still appear, at score 0, ranked last among the three
    carol_entry = next(i for i in body["items"] if i["user"]["username"] == "carol")
    assert carol_entry["score"] == 0


async def test_individual_leaderboard_requires_auth(client: AsyncClient):
    response = await client.get("/leaderboards/individual")
    assert response.status_code == 401


async def test_global_community_leaderboard_ranks_by_community_post_scores(client: AsyncClient):
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")
    carol = await create_user(client, "carol")

    community_a = await _create_community(client, alice, privacy="open", name="Community A")
    community_b = await _create_community(client, bob, privacy="open", name="Community B")

    meme_a = await _post_community_meme(client, alice, community_a["id"])
    await _react(client, bob, meme_a["id"])
    await _react(client, carol, meme_a["id"])
    # community_a score: 2

    meme_b = await _post_community_meme(client, bob, community_b["id"])
    await _react(client, alice, meme_b["id"])
    # community_b score: 1

    response = await client.get("/leaderboards/communities", headers=auth_header(alice))
    assert response.status_code == 200
    body = response.json()
    names_in_order = [item["community_name"] for item in body["items"]]
    assert names_in_order.index(community_a["name"]) < names_in_order.index(community_b["name"])

    entry_a = next(i for i in body["items"] if i["community_id"] == community_a["id"])
    assert entry_a["score"] == 2


async def test_global_community_leaderboard_visible_to_non_member(client: AsyncClient):
    alice = await create_user(client, "alice")
    carol = await create_user(client, "carol")
    community = await _create_community(client, alice, privacy="invite_only")

    response = await client.get("/leaderboards/communities", headers=auth_header(carol))
    assert response.status_code == 200
    assert any(i["community_id"] == community["id"] for i in response.json()["items"])


async def test_internal_community_leaderboard_requires_membership(client: AsyncClient):
    alice = await create_user(client, "alice")
    carol = await create_user(client, "carol")
    community = await _create_community(client, alice)

    response = await client.get(
        f"/communities/{community['id']}/leaderboard", headers=auth_header(carol)
    )
    assert response.status_code == 403


async def test_internal_community_leaderboard_nonexistent_community_404(client: AsyncClient):
    alice = await create_user(client, "alice")
    response = await client.get(
        "/communities/00000000-0000-0000-0000-000000000000/leaderboard",
        headers=auth_header(alice),
    )
    assert response.status_code == 404


async def test_internal_community_leaderboard_ranks_members_by_community_score_only(
    client: AsyncClient,
):
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")
    community = await _create_community(client, alice, privacy="open")
    await client.post(f"/communities/{community['id']}/join", headers=auth_header(bob))

    # alice posts personally (public) — must NOT count toward her internal community score
    personal_meme = await _post_meme(client, alice)
    await _react(client, bob, personal_meme["id"])
    await _react(client, alice, personal_meme["id"])

    # bob posts into the community and gets reactions
    community_meme = await _post_community_meme(client, bob, community["id"])
    await _react(client, alice, community_meme["id"])
    await _react(client, bob, community_meme["id"])
    # bob's internal community score: 2, alice's internal community score: 0

    response = await client.get(
        f"/communities/{community['id']}/leaderboard", headers=auth_header(alice)
    )
    assert response.status_code == 200
    body = response.json()
    bob_entry = next(i for i in body["items"] if i["user"]["username"] == "bob")
    alice_entry = next(i for i in body["items"] if i["user"]["username"] == "alice")
    assert bob_entry["score"] == 2
    assert alice_entry["score"] == 0
    assert bob_entry["rank"] < alice_entry["rank"]


async def test_internal_community_leaderboard_excludes_other_communities_scores(
    client: AsyncClient,
):
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")
    community_a = await _create_community(client, alice, privacy="open")
    community_b = await _create_community(client, bob, privacy="open")
    await client.post(f"/communities/{community_a['id']}/join", headers=auth_header(bob))

    # bob posts into community_b, a community alice isn't scoped to when viewing community_a
    meme_b = await _post_community_meme(client, bob, community_b["id"])
    await _react(client, alice, meme_b["id"])

    response = await client.get(
        f"/communities/{community_a['id']}/leaderboard", headers=auth_header(alice)
    )
    body = response.json()
    bob_entry = next(i for i in body["items"] if i["user"]["username"] == "bob")
    assert bob_entry["score"] == 0
