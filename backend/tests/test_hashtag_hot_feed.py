"""Roadmap_Search.md S5 step 1 — GET /hashtags/{slug}/memes/hot, the Hot-ranked companion
to the existing keyset-paginated tag feed. Visibility must be identical between the two;
only the ranking/pagination scheme differs.
"""

from httpx import AsyncClient

from tests.conftest import auth_header, create_user

IMAGE = {"image": ("test.png", b"fake-bytes", "image/png")}


async def _post(client: AsyncClient, user: dict, audience: str) -> dict:
    response = await client.post(
        "/memes",
        files=IMAGE,
        data={"audiences": [audience], "hashtags": ["hotfeedtag"]},
        headers=auth_header(user),
    )
    return response.json()


async def _befriend(client: AsyncClient, alice: dict, bob: dict) -> None:
    response = await client.post(
        "/friends/requests", json={"username": bob["user"]["username"]}, headers=auth_header(alice)
    )
    await client.post(f"/friends/requests/{response.json()['id']}/accept", headers=auth_header(bob))


async def test_hot_feed_is_visibility_gated_identically_to_the_keyset_feed(client: AsyncClient):
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")
    stranger = await create_user(client, "stranger")
    await _befriend(client, alice, bob)

    public_meme = await _post(client, alice, "public")
    friends_meme = await _post(client, alice, "friends")

    for path in ("/hashtags/hotfeedtag/memes", "/hashtags/hotfeedtag/memes/hot"):
        stranger_body = (await client.get(path, headers=auth_header(stranger))).json()
        stranger_ids = {m["id"] for m in stranger_body["items"]}
        assert public_meme["id"] in stranger_ids
        assert friends_meme["id"] not in stranger_ids

        bob_body = (await client.get(path, headers=auth_header(bob))).json()
        bob_ids = {m["id"] for m in bob_body["items"]}
        assert public_meme["id"] in bob_ids
        assert friends_meme["id"] in bob_ids


async def test_hot_feed_rejects_negative_offset(client: AsyncClient):
    alice = await create_user(client, "alice")
    await _post(client, alice, "public")

    response = await client.get(
        "/hashtags/hotfeedtag/memes/hot", params={"offset": -1}, headers=auth_header(alice)
    )
    assert response.status_code == 422
