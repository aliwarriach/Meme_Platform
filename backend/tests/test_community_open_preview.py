"""2026-08-27 — a non-member browsing an **open** community can read its feed and internal
leaderboard (but never post into it — that stays member-only regardless of privacy); a
non-member of an **invite-only** community is still rejected from both. See
`services/communities.py::require_membership_or_open_community`.
"""

from httpx import AsyncClient
from tests.conftest import auth_header, create_user


async def _create_community(client: AsyncClient, owner: dict, privacy: str = "open") -> dict:
    response = await client.post(
        "/communities", data={"name": "Meme Lords", "privacy": privacy}, headers=auth_header(owner)
    )
    assert response.status_code == 201
    return response.json()


async def test_non_member_can_read_open_community_feed(client: AsyncClient):
    alice = await create_user(client, "alice")
    outsider = await create_user(client, "outsider")
    community = await _create_community(client, alice, privacy="open")

    response = await client.get(f"/communities/{community['id']}/feed", headers=auth_header(outsider))
    assert response.status_code == 200


async def test_non_member_cannot_read_invite_only_community_feed(client: AsyncClient):
    alice = await create_user(client, "alice")
    outsider = await create_user(client, "outsider")
    community = await _create_community(client, alice, privacy="invite_only")

    response = await client.get(f"/communities/{community['id']}/feed", headers=auth_header(outsider))
    assert response.status_code == 403


async def test_non_member_cannot_post_into_open_community(client: AsyncClient):
    """Reading an open community's feed is allowed for a non-member; posting into it is not
    — deliberately unaffected by the read-side relaxation."""
    alice = await create_user(client, "alice")
    outsider = await create_user(client, "outsider")
    community = await _create_community(client, alice, privacy="open")

    response = await client.post(
        f"/communities/{community['id']}/memes",
        files={"image": ("test.png", b"fake-bytes", "image/png")},
        headers=auth_header(outsider),
    )
    assert response.status_code == 403


async def test_non_member_can_read_open_community_leaderboard(client: AsyncClient):
    alice = await create_user(client, "alice")
    outsider = await create_user(client, "outsider")
    community = await _create_community(client, alice, privacy="open")

    response = await client.get(
        f"/communities/{community['id']}/leaderboard", headers=auth_header(outsider)
    )
    assert response.status_code == 200


async def test_non_member_cannot_read_invite_only_community_leaderboard(client: AsyncClient):
    alice = await create_user(client, "alice")
    outsider = await create_user(client, "outsider")
    community = await _create_community(client, alice, privacy="invite_only")

    response = await client.get(
        f"/communities/{community['id']}/leaderboard", headers=auth_header(outsider)
    )
    assert response.status_code == 403
