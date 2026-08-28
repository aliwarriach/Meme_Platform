"""`PATCH /auth/me` avatar state — an uploaded photo, a built-in preset (`avatar_preset`),
or no avatar at all (`clear_avatar`) are mutually exclusive; whichever is sent always
replaces whatever avatar state currently exists. See `services/users.py::update_profile`.
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


async def _issue_avatar_signature(client: AsyncClient, user: dict) -> dict:
    response = await client.post(
        "/media/upload-signature", json={"context": "avatars"}, headers=auth_header(user)
    )
    assert response.status_code == 200
    return response.json()


async def test_update_me_sets_avatar_preset(client: AsyncClient):
    alice = await create_user(client, "alice")
    response = await client.patch(
        "/auth/me", data={"avatar_preset": "blaze"}, headers=auth_header(alice)
    )
    assert response.status_code == 200
    body = response.json()
    assert body["avatar_preset"] == "blaze"
    assert body["avatar_url"] is None


async def test_update_me_rejects_unknown_avatar_preset(client: AsyncClient):
    alice = await create_user(client, "alice")
    response = await client.patch(
        "/auth/me", data={"avatar_preset": "not-a-real-preset"}, headers=auth_header(alice)
    )
    assert response.status_code == 400


async def test_uploading_a_photo_clears_a_previously_chosen_preset(
    client: AsyncClient, monkeypatch
):
    alice = await create_user(client, "alice")
    await client.patch("/auth/me", data={"avatar_preset": "chill"}, headers=auth_header(alice))

    sig = await _issue_avatar_signature(client, alice)
    monkeypatch.setattr(media_service, "get_image_resource", _fake_resource())
    response = await client.patch(
        "/auth/me", data={"avatar_public_id": sig["public_id"]}, headers=auth_header(alice)
    )
    assert response.status_code == 200
    body = response.json()
    assert body["avatar_url"] == (
        f"https://res.cloudinary.com/test/image/upload/{sig['folder']}/{sig['public_id']}.png"
    )
    assert body["avatar_preset"] is None


async def test_picking_a_preset_clears_a_previously_uploaded_photo(
    client: AsyncClient, monkeypatch
):
    alice = await create_user(client, "alice")
    sig = await _issue_avatar_signature(client, alice)
    monkeypatch.setattr(media_service, "get_image_resource", _fake_resource())
    await client.patch(
        "/auth/me", data={"avatar_public_id": sig["public_id"]}, headers=auth_header(alice)
    )

    response = await client.patch(
        "/auth/me", data={"avatar_preset": "royal"}, headers=auth_header(alice)
    )
    assert response.status_code == 200
    body = response.json()
    assert body["avatar_preset"] == "royal"
    assert body["avatar_url"] is None


async def test_clear_avatar_resets_both_photo_and_preset(client: AsyncClient):
    alice = await create_user(client, "alice")
    await client.patch("/auth/me", data={"avatar_preset": "frog"}, headers=auth_header(alice))

    response = await client.patch(
        "/auth/me", data={"clear_avatar": "true"}, headers=auth_header(alice)
    )
    assert response.status_code == 200
    body = response.json()
    assert body["avatar_url"] is None
    assert body["avatar_preset"] is None


async def test_new_user_has_no_avatar_url_or_preset(client: AsyncClient):
    alice = await create_user(client, "alice")
    response = await client.get("/auth/me", headers=auth_header(alice))
    assert response.status_code == 200
    body = response.json()
    assert body["avatar_url"] is None
    assert body["avatar_preset"] is None
