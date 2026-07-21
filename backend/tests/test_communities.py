from httpx import AsyncClient

from tests.conftest import auth_header, create_user


async def _create_community(
    client: AsyncClient,
    owner: dict,
    name: str = "Meme Lords",
    privacy: str = "open",
    description: str | None = "a community",
) -> object:
    data = {"name": name, "privacy": privacy}
    if description is not None:
        data["description"] = description
    return await client.post("/communities", data=data, headers=auth_header(owner))


async def test_create_community_makes_owner_an_active_member(client: AsyncClient):
    alice = await create_user(client, "alice")
    response = await _create_community(client, alice, privacy="open")
    assert response.status_code == 201
    body = response.json()
    assert body["owner"]["username"] == "alice"
    assert body["privacy"] == "open"
    assert body["member_count"] == 1
    assert body["viewer_membership_status"] == "active"


async def test_get_community_returns_detail_with_viewer_status(client: AsyncClient):
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")
    community = (await _create_community(client, alice, privacy="open")).json()

    as_owner = await client.get(f"/communities/{community['id']}", headers=auth_header(alice))
    assert as_owner.status_code == 200
    assert as_owner.json()["viewer_membership_status"] == "active"

    as_stranger = await client.get(f"/communities/{community['id']}", headers=auth_header(bob))
    assert as_stranger.status_code == 200
    assert as_stranger.json()["viewer_membership_status"] is None


async def test_get_community_not_found(client: AsyncClient):
    alice = await create_user(client, "alice")
    response = await client.get(
        "/communities/00000000-0000-0000-0000-000000000000", headers=auth_header(alice)
    )
    assert response.status_code == 404


async def test_open_community_join_grants_active_membership_immediately(client: AsyncClient):
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")
    community = (await _create_community(client, alice, privacy="open")).json()

    response = await client.post(
        f"/communities/{community['id']}/join", headers=auth_header(bob)
    )
    assert response.status_code == 201
    assert response.json()["status"] == "active"

    members = await client.get(
        f"/communities/{community['id']}/members", headers=auth_header(bob)
    )
    usernames = [m["user"]["username"] for m in members.json()]
    assert set(usernames) == {"alice", "bob"}


async def test_invite_only_community_join_requires_owner_approval(client: AsyncClient):
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")
    community = (await _create_community(client, alice, privacy="invite_only")).json()

    join_response = await client.post(
        f"/communities/{community['id']}/join", headers=auth_header(bob)
    )
    assert join_response.status_code == 201
    assert join_response.json()["status"] == "pending"
    membership_id = join_response.json()["id"]

    # not yet a member — members list is gated for invite-only communities
    members_before = await client.get(
        f"/communities/{community['id']}/members", headers=auth_header(bob)
    )
    assert members_before.status_code == 403

    requests = await client.get(
        f"/communities/{community['id']}/join-requests", headers=auth_header(alice)
    )
    assert requests.status_code == 200
    assert len(requests.json()) == 1

    approve = await client.post(
        f"/communities/{community['id']}/join-requests/{membership_id}/approve",
        headers=auth_header(alice),
    )
    assert approve.status_code == 200
    assert approve.json()["status"] == "active"

    members_after = await client.get(
        f"/communities/{community['id']}/members", headers=auth_header(bob)
    )
    assert members_after.status_code == 200
    assert len(members_after.json()) == 2


async def test_reject_join_request_removes_it(client: AsyncClient):
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")
    community = (await _create_community(client, alice, privacy="invite_only")).json()

    join_response = await client.post(
        f"/communities/{community['id']}/join", headers=auth_header(bob)
    )
    membership_id = join_response.json()["id"]

    reject = await client.delete(
        f"/communities/{community['id']}/join-requests/{membership_id}",
        headers=auth_header(alice),
    )
    assert reject.status_code == 204

    requests = await client.get(
        f"/communities/{community['id']}/join-requests", headers=auth_header(alice)
    )
    assert requests.json() == []

    # bob can now request again since the old pending row is gone
    second_request = await client.post(
        f"/communities/{community['id']}/join", headers=auth_header(bob)
    )
    assert second_request.status_code == 201


async def test_non_owner_cannot_view_or_approve_join_requests(client: AsyncClient):
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")
    carol = await create_user(client, "carol")
    community = (await _create_community(client, alice, privacy="invite_only")).json()

    join_response = await client.post(
        f"/communities/{community['id']}/join", headers=auth_header(bob)
    )
    membership_id = join_response.json()["id"]

    requests = await client.get(
        f"/communities/{community['id']}/join-requests", headers=auth_header(carol)
    )
    assert requests.status_code == 403

    approve = await client.post(
        f"/communities/{community['id']}/join-requests/{membership_id}/approve",
        headers=auth_header(carol),
    )
    assert approve.status_code == 403


async def test_joining_twice_is_rejected(client: AsyncClient):
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")
    community = (await _create_community(client, alice, privacy="open")).json()

    await client.post(f"/communities/{community['id']}/join", headers=auth_header(bob))
    second = await client.post(f"/communities/{community['id']}/join", headers=auth_header(bob))
    assert second.status_code == 409


async def test_leave_community_removes_membership(client: AsyncClient):
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")
    community = (await _create_community(client, alice, privacy="open")).json()
    await client.post(f"/communities/{community['id']}/join", headers=auth_header(bob))

    leave = await client.delete(
        f"/communities/{community['id']}/membership", headers=auth_header(bob)
    )
    assert leave.status_code == 204

    members = await client.get(
        f"/communities/{community['id']}/members", headers=auth_header(alice)
    )
    usernames = [m["user"]["username"] for m in members.json()]
    assert usernames == ["alice"]


async def test_owner_cannot_leave_own_community(client: AsyncClient):
    alice = await create_user(client, "alice")
    community = (await _create_community(client, alice, privacy="open")).json()

    response = await client.delete(
        f"/communities/{community['id']}/membership", headers=auth_header(alice)
    )
    assert response.status_code == 400


async def test_leave_rejected_if_not_a_member(client: AsyncClient):
    alice = await create_user(client, "alice")
    carol = await create_user(client, "carol")
    community = (await _create_community(client, alice, privacy="open")).json()

    response = await client.delete(
        f"/communities/{community['id']}/membership", headers=auth_header(carol)
    )
    assert response.status_code == 404


async def test_open_community_members_list_visible_to_non_members(client: AsyncClient):
    alice = await create_user(client, "alice")
    carol = await create_user(client, "carol")
    community = (await _create_community(client, alice, privacy="open")).json()

    response = await client.get(
        f"/communities/{community['id']}/members", headers=auth_header(carol)
    )
    assert response.status_code == 200
    assert len(response.json()) == 1


async def test_list_my_communities_only_returns_active_memberships(client: AsyncClient):
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")
    open_community = (await _create_community(client, alice, name="Open Club", privacy="open")).json()
    invite_only_community = (
        await _create_community(client, alice, name="Secret Club", privacy="invite_only")
    ).json()

    await client.post(f"/communities/{open_community['id']}/join", headers=auth_header(bob))
    await client.post(f"/communities/{invite_only_community['id']}/join", headers=auth_header(bob))

    mine = await client.get("/communities/mine", headers=auth_header(bob))
    names = [c["name"] for c in mine.json()]
    assert names == ["Open Club"]


async def test_discover_communities_pagination_returns_next_cursor_and_respects_it(
    client: AsyncClient,
):
    alice = await create_user(client, "alice")
    for i in range(3):
        await _create_community(client, alice, name=f"Community {i}")

    first_page = await client.get(
        "/communities", params={"limit": 2}, headers=auth_header(alice)
    )
    first_body = first_page.json()
    assert len(first_body["items"]) == 2
    assert first_body["next_cursor"] is not None

    second_page = await client.get(
        "/communities",
        params={"limit": 2, "cursor": first_body["next_cursor"]},
        headers=auth_header(alice),
    )
    second_body = second_page.json()
    assert len(second_body["items"]) == 1
    assert second_body["next_cursor"] is None


async def test_communities_endpoints_require_authentication(client: AsyncClient):
    response = await client.get("/communities")
    assert response.status_code == 401

    response = await client.post("/communities", data={"name": "x", "privacy": "open"})
    assert response.status_code == 401
