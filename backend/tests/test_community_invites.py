"""`POST /communities/{id}/invites` — any active member invites another user (friend or not)
by username. The invitee accepts via the existing `POST /communities/{id}/join` (flips
`invited` -> `active`) or declines via the existing `DELETE /communities/{id}/membership`
(deletes their own row, whatever its status). See `services/communities.py::invite_to_community`.
"""

from httpx import AsyncClient
from tests.conftest import auth_header, create_user


async def _create_community(client: AsyncClient, owner: dict, privacy: str = "open") -> dict:
    response = await client.post(
        "/communities", data={"name": "Meme Lords", "privacy": privacy}, headers=auth_header(owner)
    )
    assert response.status_code == 201
    return response.json()


async def test_member_invites_a_user_and_they_accept(client: AsyncClient):
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")
    community = await _create_community(client, alice)

    invite_response = await client.post(
        f"/communities/{community['id']}/invites", data={"username": "bob"}, headers=auth_header(alice)
    )
    assert invite_response.status_code == 201
    assert invite_response.json()["status"] == "invited"

    as_invitee = await client.get(f"/communities/{community['id']}", headers=auth_header(bob))
    assert as_invitee.json()["viewer_membership_status"] == "invited"

    accept_response = await client.post(f"/communities/{community['id']}/join", headers=auth_header(bob))
    assert accept_response.status_code == 201
    assert accept_response.json()["status"] == "active"

    members = await client.get(f"/communities/{community['id']}/members", headers=auth_header(bob))
    usernames = {m["user"]["username"] for m in members.json()}
    assert usernames == {"alice", "bob"}


async def test_invitee_can_decline_via_leave(client: AsyncClient):
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")
    community = await _create_community(client, alice)

    await client.post(
        f"/communities/{community['id']}/invites", data={"username": "bob"}, headers=auth_header(alice)
    )

    decline_response = await client.delete(
        f"/communities/{community['id']}/membership", headers=auth_header(bob)
    )
    assert decline_response.status_code == 204

    as_invitee = await client.get(f"/communities/{community['id']}", headers=auth_header(bob))
    assert as_invitee.json()["viewer_membership_status"] is None


async def test_cannot_invite_someone_already_a_member(client: AsyncClient):
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")
    community = await _create_community(client, alice)
    await client.post(f"/communities/{community['id']}/join", headers=auth_header(bob))

    response = await client.post(
        f"/communities/{community['id']}/invites", data={"username": "bob"}, headers=auth_header(alice)
    )
    assert response.status_code == 409


async def test_cannot_invite_unknown_username(client: AsyncClient):
    alice = await create_user(client, "alice")
    community = await _create_community(client, alice)

    response = await client.post(
        f"/communities/{community['id']}/invites",
        data={"username": "nobody-by-this-name"},
        headers=auth_header(alice),
    )
    assert response.status_code == 404


async def test_non_member_cannot_invite(client: AsyncClient):
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")
    carol = await create_user(client, "carol")
    community = await _create_community(client, alice)

    response = await client.post(
        f"/communities/{community['id']}/invites", data={"username": "carol"}, headers=auth_header(bob)
    )
    assert response.status_code == 403


async def test_any_active_member_can_invite_not_just_owner(client: AsyncClient):
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")
    carol = await create_user(client, "carol")
    community = await _create_community(client, alice)
    await client.post(f"/communities/{community['id']}/join", headers=auth_header(bob))

    response = await client.post(
        f"/communities/{community['id']}/invites", data={"username": "carol"}, headers=auth_header(bob)
    )
    assert response.status_code == 201


async def test_search_users_excludes_self_and_matches_partial_username(client: AsyncClient):
    alice = await create_user(client, "alice")
    await create_user(client, "alicia")
    await create_user(client, "bob")

    response = await client.get("/users/search?q=ali", headers=auth_header(alice))
    assert response.status_code == 200
    usernames = {u["username"] for u in response.json()}
    assert usernames == {"alicia"}


async def test_search_users_requires_auth(client: AsyncClient):
    response = await client.get("/users/search?q=ali")
    assert response.status_code == 401
