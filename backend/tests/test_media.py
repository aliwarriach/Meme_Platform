"""Roadmap_Scaling.md A4 — direct signed Cloudinary uploads.

These tests exercise the shared signing/verification mechanism
(`POST /media/upload-signature`, `confirm_pending_upload`) via `POST /memes`, the
flagship migrated endpoint. Every other call site (`POST /templates`, community
icon/banner, challenge images, avatar upload) repeats the same mechanism mechanically —
see their own per-endpoint direct-upload tests in `test_templates.py`,
`test_communities.py`, `test_challenge_compete.py`, and `test_content_deletion.py`
rather than duplicating the full negative-path matrix here. The legacy proxied
`validate_and_upload_image` path is kept working alongside the new flow until the
frontend finishes migrating (IMPLEMENT step 6).

Cloudinary itself is never called for real here — `get_image_resource` (the Admin API
verification call) is monkeypatched per test to return a plausible resource, since these
tests are about this app's own signing/verification logic, not Cloudinary connectivity.
"""

import asyncio
import uuid

import app.services.media as media_service
from httpx import AsyncClient
from tests.conftest import auth_header, create_user


def _fake_resource(bytes_: int = 1000, format_: str = "png"):
    async def _get(public_id: str) -> dict:
        return {
            "bytes": bytes_,
            "format": format_,
            "secure_url": f"https://res.cloudinary.com/test/image/upload/{public_id}.{format_}",
        }

    return _get


async def _issue_signature(client: AsyncClient, user: dict, context: str = "memes") -> dict:
    response = await client.post(
        "/media/upload-signature", json={"context": context}, headers=auth_header(user)
    )
    assert response.status_code == 200
    return response.json()


def test_signing_is_deterministic_for_fixed_params():
    from app.integrations.cloudinary_client import sign_upload_params

    params = {
        "folder": "memes",
        "public_id": "fixed-id",
        "timestamp": 1735689600,
        "allowed_formats": "gif,jpeg,jpg,png,webp",
    }
    assert sign_upload_params(params) == sign_upload_params(params)


async def test_create_upload_signature_requires_auth(client: AsyncClient):
    response = await client.post("/media/upload-signature", json={"context": "memes"})
    assert response.status_code == 401


async def test_create_upload_signature_issues_a_pending_upload(client: AsyncClient):
    alice = await create_user(client, "alice")
    body = await _issue_signature(client, alice)
    assert body["folder"] == "memes"
    assert body["public_id"]
    assert body["signature"]
    assert body["cloud_name"]
    assert body["api_key"]


async def test_meme_creation_via_direct_upload_confirms_and_creates(
    client: AsyncClient, monkeypatch
):
    alice = await create_user(client, "alice")
    sig = await _issue_signature(client, alice)
    monkeypatch.setattr(media_service, "get_image_resource", _fake_resource())

    response = await client.post(
        "/memes",
        data={"image_public_id": sig["public_id"], "audiences": ["public"], "caption": "hi"},
        headers=auth_header(alice),
    )
    assert response.status_code == 201
    assert response.json()["image_url"] == (
        f"https://res.cloudinary.com/test/image/upload/{sig['public_id']}.png"
    )


async def test_user_b_cannot_claim_a_public_id_issued_to_user_a(
    client: AsyncClient, monkeypatch
):
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")
    sig = await _issue_signature(client, alice)
    monkeypatch.setattr(media_service, "get_image_resource", _fake_resource())

    response = await client.post(
        "/memes",
        data={"image_public_id": sig["public_id"], "audiences": ["public"]},
        headers=auth_header(bob),
    )
    assert response.status_code == 403


async def test_a_public_id_never_issued_by_the_server_is_rejected(client: AsyncClient):
    alice = await create_user(client, "alice")
    response = await client.post(
        "/memes",
        data={"image_public_id": str(uuid.uuid4()), "audiences": ["public"]},
        headers=auth_header(alice),
    )
    assert response.status_code == 400


async def test_an_expired_pending_upload_is_rejected(client: AsyncClient, monkeypatch):
    monkeypatch.setattr(media_service, "MEDIA_PENDING_TTL_SECONDS", 1)
    alice = await create_user(client, "alice")
    sig = await _issue_signature(client, alice)

    await asyncio.sleep(1.2)

    response = await client.post(
        "/memes",
        data={"image_public_id": sig["public_id"], "audiences": ["public"]},
        headers=auth_header(alice),
    )
    assert response.status_code == 400


async def test_confirming_the_same_public_id_twice_is_rejected(
    client: AsyncClient, monkeypatch
):
    alice = await create_user(client, "alice")
    sig = await _issue_signature(client, alice)
    monkeypatch.setattr(media_service, "get_image_resource", _fake_resource())

    first = await client.post(
        "/memes",
        data={"image_public_id": sig["public_id"], "audiences": ["public"]},
        headers=auth_header(alice),
    )
    assert first.status_code == 201

    second = await client.post(
        "/memes",
        data={"image_public_id": sig["public_id"], "audiences": ["public"]},
        headers=auth_header(alice),
    )
    assert second.status_code == 400


async def test_oversized_uploaded_resource_is_rejected_and_deleted(
    client: AsyncClient, monkeypatch
):
    alice = await create_user(client, "alice")
    sig = await _issue_signature(client, alice)
    deleted: list[str] = []

    monkeypatch.setattr(
        media_service, "get_image_resource", _fake_resource(bytes_=999_999_999)
    )

    async def _fake_delete(public_id: str) -> None:
        deleted.append(public_id)

    monkeypatch.setattr(media_service, "delete_image", _fake_delete)

    response = await client.post(
        "/memes",
        data={"image_public_id": sig["public_id"], "audiences": ["public"]},
        headers=auth_header(alice),
    )
    assert response.status_code == 400
    assert deleted == [sig["public_id"]]


async def test_disallowed_format_on_the_uploaded_resource_is_rejected_and_deleted(
    client: AsyncClient, monkeypatch
):
    alice = await create_user(client, "alice")
    sig = await _issue_signature(client, alice)
    deleted: list[str] = []

    monkeypatch.setattr(media_service, "get_image_resource", _fake_resource(format_="pdf"))

    async def _fake_delete(public_id: str) -> None:
        deleted.append(public_id)

    monkeypatch.setattr(media_service, "delete_image", _fake_delete)

    response = await client.post(
        "/memes",
        data={"image_public_id": sig["public_id"], "audiences": ["public"]},
        headers=auth_header(alice),
    )
    assert response.status_code == 400
    assert deleted == [sig["public_id"]]


async def test_meme_creation_requires_exactly_one_image_source(client: AsyncClient):
    alice = await create_user(client, "alice")

    neither = await client.post(
        "/memes", data={"audiences": ["public"]}, headers=auth_header(alice)
    )
    assert neither.status_code == 400

    both = await client.post(
        "/memes",
        files={"image": ("test.png", b"fake-bytes", "image/png")},
        data={"image_public_id": str(uuid.uuid4()), "audiences": ["public"]},
        headers=auth_header(alice),
    )
    assert both.status_code == 400


async def test_legacy_file_upload_still_works(client: AsyncClient):
    """The existing multipart path must keep working unchanged while the frontend
    migrates (Roadmap_Scaling.md A4 IMPLEMENT step 6)."""
    alice = await create_user(client, "alice")
    response = await client.post(
        "/memes",
        files={"image": ("test.png", b"fake-bytes", "image/png")},
        data={"audiences": ["public"], "caption": "still works"},
        headers=auth_header(alice),
    )
    assert response.status_code == 201
