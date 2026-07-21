from httpx import AsyncClient

from tests.conftest import auth_header as _auth_header
from tests.conftest import create_user as _create_user


async def test_send_request_creates_pending_friendship(client: AsyncClient):
    alice = await _create_user(client, "alice")
    await _create_user(client, "bob")

    response = await client.post(
        "/friends/requests", json={"username": "bob"}, headers=_auth_header(alice)
    )
    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "pending"
    assert body["requester"]["username"] == "alice"
    assert body["addressee"]["username"] == "bob"


async def test_accept_creates_mutual_friendship(client: AsyncClient):
    alice = await _create_user(client, "alice")
    bob = await _create_user(client, "bob")

    request_response = await client.post(
        "/friends/requests", json={"username": "bob"}, headers=_auth_header(alice)
    )
    friendship_id = request_response.json()["id"]

    accept_response = await client.post(
        f"/friends/requests/{friendship_id}/accept", headers=_auth_header(bob)
    )
    assert accept_response.status_code == 200
    assert accept_response.json()["status"] == "accepted"

    alice_friends = await client.get("/friends", headers=_auth_header(alice))
    bob_friends = await client.get("/friends", headers=_auth_header(bob))
    assert [f["user"]["username"] for f in alice_friends.json()] == ["bob"]
    assert [f["user"]["username"] for f in bob_friends.json()] == ["alice"]
    assert alice_friends.json()[0]["friendship_id"] == friendship_id


async def test_third_user_does_not_see_others_as_friends(client: AsyncClient):
    alice = await _create_user(client, "alice")
    bob = await _create_user(client, "bob")
    carol = await _create_user(client, "carol")

    request_response = await client.post(
        "/friends/requests", json={"username": "bob"}, headers=_auth_header(alice)
    )
    friendship_id = request_response.json()["id"]
    await client.post(f"/friends/requests/{friendship_id}/accept", headers=_auth_header(bob))

    carol_friends = await client.get("/friends", headers=_auth_header(carol))
    assert carol_friends.json() == []


async def test_cannot_send_duplicate_request(client: AsyncClient):
    alice = await _create_user(client, "alice")
    await _create_user(client, "bob")

    await client.post("/friends/requests", json={"username": "bob"}, headers=_auth_header(alice))
    response = await client.post(
        "/friends/requests", json={"username": "bob"}, headers=_auth_header(alice)
    )
    assert response.status_code == 409


async def test_cannot_send_request_in_reverse_direction_when_pending_exists(client: AsyncClient):
    alice = await _create_user(client, "alice")
    bob = await _create_user(client, "bob")

    await client.post("/friends/requests", json={"username": "bob"}, headers=_auth_header(alice))
    response = await client.post(
        "/friends/requests", json={"username": "alice"}, headers=_auth_header(bob)
    )
    assert response.status_code == 409


async def test_cannot_send_request_to_self(client: AsyncClient):
    alice = await _create_user(client, "alice")

    response = await client.post(
        "/friends/requests", json={"username": "alice"}, headers=_auth_header(alice)
    )
    assert response.status_code == 400


async def test_cannot_send_request_to_unknown_username(client: AsyncClient):
    alice = await _create_user(client, "alice")

    response = await client.post(
        "/friends/requests", json={"username": "nobody"}, headers=_auth_header(alice)
    )
    assert response.status_code == 404


async def test_only_addressee_can_accept(client: AsyncClient):
    alice = await _create_user(client, "alice")
    await _create_user(client, "bob")

    request_response = await client.post(
        "/friends/requests", json={"username": "bob"}, headers=_auth_header(alice)
    )
    friendship_id = request_response.json()["id"]

    response = await client.post(
        f"/friends/requests/{friendship_id}/accept", headers=_auth_header(alice)
    )
    assert response.status_code == 403


async def test_cannot_accept_already_accepted_request(client: AsyncClient):
    alice = await _create_user(client, "alice")
    bob = await _create_user(client, "bob")

    request_response = await client.post(
        "/friends/requests", json={"username": "bob"}, headers=_auth_header(alice)
    )
    friendship_id = request_response.json()["id"]
    await client.post(f"/friends/requests/{friendship_id}/accept", headers=_auth_header(bob))

    response = await client.post(
        f"/friends/requests/{friendship_id}/accept", headers=_auth_header(bob)
    )
    assert response.status_code == 409


async def test_either_participant_can_remove_friendship(client: AsyncClient):
    alice = await _create_user(client, "alice")
    bob = await _create_user(client, "bob")

    request_response = await client.post(
        "/friends/requests", json={"username": "bob"}, headers=_auth_header(alice)
    )
    friendship_id = request_response.json()["id"]
    await client.post(f"/friends/requests/{friendship_id}/accept", headers=_auth_header(bob))

    response = await client.delete(f"/friends/{friendship_id}", headers=_auth_header(bob))
    assert response.status_code == 204

    alice_friends = await client.get("/friends", headers=_auth_header(alice))
    assert alice_friends.json() == []


async def test_non_participant_cannot_remove_friendship(client: AsyncClient):
    alice = await _create_user(client, "alice")
    bob = await _create_user(client, "bob")
    carol = await _create_user(client, "carol")

    request_response = await client.post(
        "/friends/requests", json={"username": "bob"}, headers=_auth_header(alice)
    )
    friendship_id = request_response.json()["id"]

    response = await client.delete(f"/friends/{friendship_id}", headers=_auth_header(carol))
    assert response.status_code == 403


async def test_incoming_requests_lists_only_pending_for_addressee(client: AsyncClient):
    alice = await _create_user(client, "alice")
    bob = await _create_user(client, "bob")

    await client.post("/friends/requests", json={"username": "bob"}, headers=_auth_header(alice))

    bob_requests = await client.get("/friends/requests", headers=_auth_header(bob))
    alice_requests = await client.get("/friends/requests", headers=_auth_header(alice))
    assert len(bob_requests.json()) == 1
    assert bob_requests.json()[0]["requester"]["username"] == "alice"
    assert alice_requests.json() == []


async def test_friends_endpoints_require_authentication(client: AsyncClient):
    response = await client.get("/friends")
    assert response.status_code == 401

    response = await client.get("/friends/requests")
    assert response.status_code == 401

    response = await client.post("/friends/requests", json={"username": "bob"})
    assert response.status_code == 401
