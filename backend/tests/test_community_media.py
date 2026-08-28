"""`PATCH /communities/{id}` — owner-only icon/banner updates. Icon supports the same
built-in-avatar-preset system as `PATCH /auth/me` (`services/users.py::ALLOWED_AVATAR_PRESETS`);
banner is upload/clear only. See `services/communities.py::update_community_media`.
"""

import app.services.media as media_service
from httpx import AsyncClient
from tests.conftest import auth_header, create_user


def _fake_resource(bytes_: int = 1000, format_: str = "png"):
    async def _get(public_id: str) -> dict:
        return {
            "public_id": public_id,
            "bytes": bytes_,
            "format": format_,
            "secure_url": f"https://res.cloudinary.com/test/image/upload/{public_id}.{format_}",
        }

    return _get


async def _issue_signature(client: AsyncClient, user: dict, context: str) -> dict:
    response = await client.post(
        "/media/upload-signature", json={"context": context}, headers=auth_header(user)
    )
    assert response.status_code == 200
    return response.json()


async def _create_community(client: AsyncClient, owner: dict, name: str = "Meme Lords") -> dict:
    response = await client.post(
        "/communities", data={"name": name, "privacy": "open"}, headers=auth_header(owner)
    )
    assert response.status_code == 201
    return response.json()


async def test_owner_sets_icon_preset(client: AsyncClient):
    alice = await create_user(client, "alice")
    community = await _create_community(client, alice)

    response = await client.patch(
        f"/communities/{community['id']}", data={"icon_preset": "royal"}, headers=auth_header(alice)
    )
    assert response.status_code == 200
    body = response.json()
    assert body["icon_preset"] == "royal"
    assert body["icon_url"] is None


async def test_non_owner_cannot_update_community_media(client: AsyncClient):
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")
    community = await _create_community(client, alice)

    response = await client.patch(
        f"/communities/{community['id']}", data={"icon_preset": "frog"}, headers=auth_header(bob)
    )
    assert response.status_code == 403


async def test_rejects_unknown_icon_preset(client: AsyncClient):
    alice = await create_user(client, "alice")
    community = await _create_community(client, alice)

    response = await client.patch(
        f"/communities/{community['id']}",
        data={"icon_preset": "not-a-real-preset"},
        headers=auth_header(alice),
    )
    assert response.status_code == 400


async def test_uploading_an_icon_clears_a_previously_chosen_preset(
    client: AsyncClient, monkeypatch
):
    alice = await create_user(client, "alice")
    community = await _create_community(client, alice)
    await client.patch(
        f"/communities/{community['id']}", data={"icon_preset": "chill"}, headers=auth_header(alice)
    )

    sig = await _issue_signature(client, alice, "communities")
    monkeypatch.setattr(media_service, "get_image_resource", _fake_resource())
    response = await client.patch(
        f"/communities/{community['id']}",
        data={"icon_public_id": sig["public_id"]},
        headers=auth_header(alice),
    )
    assert response.status_code == 200
    body = response.json()
    assert body["icon_url"] == (
        f"https://res.cloudinary.com/test/image/upload/{sig['folder']}/{sig['public_id']}.png"
    )
    assert body["icon_preset"] is None


async def test_clear_icon_resets_both_photo_and_preset(client: AsyncClient):
    alice = await create_user(client, "alice")
    community = await _create_community(client, alice)
    await client.patch(
        f"/communities/{community['id']}", data={"icon_preset": "blaze"}, headers=auth_header(alice)
    )

    response = await client.patch(
        f"/communities/{community['id']}", data={"clear_icon": "true"}, headers=auth_header(alice)
    )
    assert response.status_code == 200
    body = response.json()
    assert body["icon_url"] is None
    assert body["icon_preset"] is None


async def test_owner_sets_and_clears_banner(client: AsyncClient, monkeypatch):
    alice = await create_user(client, "alice")
    community = await _create_community(client, alice)

    sig = await _issue_signature(client, alice, "communities")
    monkeypatch.setattr(media_service, "get_image_resource", _fake_resource())
    set_response = await client.patch(
        f"/communities/{community['id']}",
        data={"banner_public_id": sig["public_id"]},
        headers=auth_header(alice),
    )
    assert set_response.status_code == 200
    assert set_response.json()["banner_url"] == (
        f"https://res.cloudinary.com/test/image/upload/{sig['folder']}/{sig['public_id']}.png"
    )

    clear_response = await client.patch(
        f"/communities/{community['id']}", data={"clear_banner": "true"}, headers=auth_header(alice)
    )
    assert clear_response.status_code == 200
    assert clear_response.json()["banner_url"] is None


async def test_update_community_media_requires_auth(client: AsyncClient):
    alice = await create_user(client, "alice")
    community = await _create_community(client, alice)

    response = await client.patch(f"/communities/{community['id']}", data={"icon_preset": "frog"})
    assert response.status_code == 401
