import json

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


async def _issue_signature(client: AsyncClient, user: dict, context: str = "avatars") -> dict:
    response = await client.post(
        "/media/upload-signature", json={"context": context}, headers=auth_header(user)
    )
    assert response.status_code == 200
    return response.json()


def _meme_items(feed_body: dict) -> list[dict]:
    return [item["meme"] for item in feed_body["items"] if item["kind"] == "meme"]


async def _post_meme(client: AsyncClient, user: dict, caption: str = "hi") -> dict:
    files = {"image": ("test.png", b"fake-bytes", "image/png")}
    response = await client.post(
        "/memes",
        files=files,
        data={"caption": caption, "audiences": ["public"]},
        headers=auth_header(user),
    )
    assert response.status_code == 201
    return response.json()


async def test_author_can_delete_their_own_meme(client: AsyncClient, mock_media_delete):
    alice = await create_user(client, "alice")
    meme = await _post_meme(client, alice)

    response = await client.delete(f"/memes/{meme['id']}", headers=auth_header(alice))
    assert response.status_code == 204
    assert len(mock_media_delete) == 1

    feed = await client.get("/memes/feed", headers=auth_header(alice))
    assert meme["id"] not in [m["id"] for m in _meme_items(feed.json())]

    # Deleting it again 404s — it's gone, not "already deleted".
    again = await client.delete(f"/memes/{meme['id']}", headers=auth_header(alice))
    assert again.status_code == 404


async def test_non_author_cannot_delete_a_meme(client: AsyncClient):
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")
    meme = await _post_meme(client, alice)

    response = await client.delete(f"/memes/{meme['id']}", headers=auth_header(bob))
    assert response.status_code == 403

    feed = await client.get("/memes/feed", headers=auth_header(alice))
    assert meme["id"] in [m["id"] for m in _meme_items(feed.json())]


async def test_community_owner_can_delete_a_members_post(client: AsyncClient, mock_media_delete):
    """2026-08-30 — closes a previously-flagged gap: a community owner can now remove a
    member's post from their own community's feed, same moderation precedent as managing
    members/challenges/templates there."""
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")
    community = (
        await client.post(
            "/communities", data={"name": "Meme Lords", "privacy": "open"}, headers=auth_header(alice)
        )
    ).json()
    await client.post(f"/communities/{community['id']}/join", headers=auth_header(bob))

    meme = (
        await client.post(
            f"/communities/{community['id']}/memes",
            files={"image": ("test.png", b"fake-bytes", "image/png")},
            data={"caption": "bob's post"},
            headers=auth_header(bob),
        )
    ).json()

    response = await client.delete(f"/memes/{meme['id']}", headers=auth_header(alice))
    assert response.status_code == 204
    assert len(mock_media_delete) == 1

    feed = await client.get(f"/communities/{community['id']}/feed", headers=auth_header(bob))
    assert meme["id"] not in [m["id"] for m in feed.json()["items"]]


async def test_non_owner_member_cannot_delete_someone_elses_community_post(client: AsyncClient):
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")
    carol = await create_user(client, "carol")
    community = (
        await client.post(
            "/communities", data={"name": "Meme Lords", "privacy": "open"}, headers=auth_header(alice)
        )
    ).json()
    await client.post(f"/communities/{community['id']}/join", headers=auth_header(bob))
    await client.post(f"/communities/{community['id']}/join", headers=auth_header(carol))

    meme = (
        await client.post(
            f"/communities/{community['id']}/memes",
            files={"image": ("test.png", b"fake-bytes", "image/png")},
            data={"caption": "bob's post"},
            headers=auth_header(bob),
        )
    ).json()

    # Carol is a fellow member, not the owner — still can't delete bob's post.
    response = await client.delete(f"/memes/{meme['id']}", headers=auth_header(carol))
    assert response.status_code == 403


async def test_community_owner_cannot_delete_a_personal_post(client: AsyncClient):
    """Owning a community grants no authority over a user's unrelated personal (Public/
    Friends) posts — the moderation carve-out only ever applies to that community's own
    posts."""
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")
    await client.post(
        "/communities", data={"name": "Meme Lords", "privacy": "open"}, headers=auth_header(alice)
    )
    personal_meme = await _post_meme(client, bob)

    response = await client.delete(f"/memes/{personal_meme['id']}", headers=auth_header(alice))
    assert response.status_code == 403


async def test_deleted_meme_reference_degrades_to_null(client: AsyncClient):
    """A meme referenced in a DM must not 500 or vanish the whole message once its
    author deletes it — see services/messaging.py's pre-existing null-meme handling."""
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")
    meme = await _post_meme(client, alice)

    request = await client.post(
        "/friends/requests", json={"username": "bob"}, headers=auth_header(alice)
    )
    await client.post(f"/friends/requests/{request.json()['id']}/accept", headers=auth_header(bob))
    conversation = await client.post(
        "/messaging/conversations", json={"user_id": bob["user"]["id"]}, headers=auth_header(alice)
    )
    message = await client.post(
        f"/messaging/conversations/{conversation.json()['id']}/messages",
        json={"kind": "meme", "meme_id": meme["id"]},
        headers=auth_header(alice),
    )
    assert message.status_code == 201

    await client.delete(f"/memes/{meme['id']}", headers=auth_header(alice))

    thread = await client.get(
        f"/messaging/conversations/{conversation.json()['id']}/messages", headers=auth_header(bob)
    )
    assert thread.json()["items"][0]["meme"] is None


async def test_author_can_delete_their_own_comment(client: AsyncClient):
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")
    meme = await _post_meme(client, alice)

    comment = await client.post(
        f"/memes/{meme['id']}/comments", json={"body": "nice one"}, headers=auth_header(bob)
    )
    comment_id = comment.json()["id"]

    response = await client.delete(
        f"/memes/{meme['id']}/comments/{comment_id}", headers=auth_header(bob)
    )
    assert response.status_code == 204

    comments = await client.get(f"/memes/{meme['id']}/comments", headers=auth_header(alice))
    assert comments.json() == []


async def test_non_author_cannot_delete_a_comment(client: AsyncClient):
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")
    meme = await _post_meme(client, alice)

    comment = await client.post(
        f"/memes/{meme['id']}/comments", json={"body": "nice one"}, headers=auth_header(bob)
    )
    comment_id = comment.json()["id"]

    # Even the meme's own author can't delete someone else's comment on it.
    response = await client.delete(
        f"/memes/{meme['id']}/comments/{comment_id}", headers=auth_header(alice)
    )
    assert response.status_code == 403


async def test_author_can_edit_caption_and_tags(client: AsyncClient):
    alice = await create_user(client, "alice")
    meme = await client.post(
        "/memes",
        files={"image": ("test.png", b"fake-bytes", "image/png")},
        data={"caption": "original", "audiences": ["public"], "hashtags": ["dogs"]},
        headers=auth_header(alice),
    )
    meme = meme.json()

    response = await client.patch(
        f"/memes/{meme['id']}",
        data={"caption": "updated caption", "hashtags_provided": "true", "hashtags": ["cats", "memes"]},
        headers=auth_header(alice),
    )
    assert response.status_code == 200
    body = response.json()
    assert body["caption"] == "updated caption"

    edit_data = await client.get(f"/memes/{meme['id']}/edit", headers=auth_header(alice))
    assert edit_data.status_code == 200
    assert sorted(edit_data.json()["hashtags"]) == ["cats", "memes"]


async def test_edit_omitting_hashtags_leaves_them_untouched(client: AsyncClient):
    alice = await create_user(client, "alice")
    meme = (
        await client.post(
            "/memes",
            files={"image": ("test.png", b"fake-bytes", "image/png")},
            data={"audiences": ["public"], "hashtags": ["dogs"]},
            headers=auth_header(alice),
        )
    ).json()

    response = await client.patch(
        f"/memes/{meme['id']}", data={"caption": "new caption"}, headers=auth_header(alice)
    )
    assert response.status_code == 200

    edit_data = await client.get(f"/memes/{meme['id']}/edit", headers=auth_header(alice))
    assert edit_data.json()["hashtags"] == ["dogs"]


async def test_edit_hashtags_provided_true_with_empty_list_clears_tags(client: AsyncClient):
    alice = await create_user(client, "alice")
    meme = (
        await client.post(
            "/memes",
            files={"image": ("test.png", b"fake-bytes", "image/png")},
            data={"audiences": ["public"], "hashtags": ["dogs"]},
            headers=auth_header(alice),
        )
    ).json()

    response = await client.patch(
        f"/memes/{meme['id']}", data={"hashtags_provided": "true"}, headers=auth_header(alice)
    )
    assert response.status_code == 200

    edit_data = await client.get(f"/memes/{meme['id']}/edit", headers=auth_header(alice))
    assert edit_data.json()["hashtags"] == []


async def test_non_author_cannot_edit_or_view_edit_data(client: AsyncClient):
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")
    meme = await _post_meme(client, alice)

    edit_response = await client.patch(
        f"/memes/{meme['id']}", data={"caption": "hijacked"}, headers=auth_header(bob)
    )
    assert edit_response.status_code == 403

    edit_data = await client.get(f"/memes/{meme['id']}/edit", headers=auth_header(bob))
    assert edit_data.status_code == 403


async def test_edit_replaces_image_and_cleans_up_old_asset(client: AsyncClient, mock_media_delete):
    alice = await create_user(client, "alice")
    meme = await _post_meme(client, alice)
    original_image_url = meme["image_url"]

    response = await client.patch(
        f"/memes/{meme['id']}",
        files={"image": ("new.png", b"new-fake-bytes", "image/png")},
        headers=auth_header(alice),
    )
    assert response.status_code == 200
    assert response.json()["image_url"] != original_image_url
    assert len(mock_media_delete) == 1


async def test_edit_rejects_both_image_and_image_public_id(client: AsyncClient):
    alice = await create_user(client, "alice")
    meme = await _post_meme(client, alice)

    response = await client.patch(
        f"/memes/{meme['id']}",
        files={"image": ("new.png", b"new-fake-bytes", "image/png")},
        data={"image_public_id": "some-id"},
        headers=auth_header(alice),
    )
    assert response.status_code == 400


async def test_edit_stores_and_returns_editor_document(client: AsyncClient):
    """This is what lets a later edit rehydrate the real Skia layers instead of only ever
    having the flattened PNG to work from (see features/creator/persistDocument.ts)."""
    alice = await create_user(client, "alice")
    meme = await _post_meme(client, alice)
    document = {
        "baseImageUri": "https://res.cloudinary.com/test/image/upload/memes/base.png",
        "canvas": {"aspectId": "square", "fit": "contain", "bg": "#000000"},
        "layers": [{"id": "layer-1", "kind": "text", "text": "top text", "pos": {"x": 0.5, "y": 0.1}}],
        "selectedId": None,
    }
    response = await client.patch(
        f"/memes/{meme['id']}",
        data={"editor_document_json": json.dumps(document)},
        headers=auth_header(alice),
    )
    assert response.status_code == 200

    edit_data = await client.get(f"/memes/{meme['id']}/edit", headers=auth_header(alice))
    assert edit_data.json()["editor_document"] == document


async def test_new_meme_with_no_editor_document_reports_null_on_edit(client: AsyncClient):
    alice = await create_user(client, "alice")
    meme = await _post_meme(client, alice)

    edit_data = await client.get(f"/memes/{meme['id']}/edit", headers=auth_header(alice))
    assert edit_data.status_code == 200
    assert edit_data.json()["editor_document"] is None


async def test_edit_rejects_malformed_editor_document_json(client: AsyncClient):
    alice = await create_user(client, "alice")
    meme = await _post_meme(client, alice)

    response = await client.patch(
        f"/memes/{meme['id']}",
        data={"editor_document_json": "not-json"},
        headers=auth_header(alice),
    )
    assert response.status_code == 400


async def test_edit_rejects_a_deleted_meme(client: AsyncClient):
    alice = await create_user(client, "alice")
    meme = await _post_meme(client, alice)
    await client.delete(f"/memes/{meme['id']}", headers=auth_header(alice))

    response = await client.patch(
        f"/memes/{meme['id']}", data={"caption": "too late"}, headers=auth_header(alice)
    )
    assert response.status_code == 404


async def test_update_profile_bio(client: AsyncClient):
    alice = await create_user(client, "alice")

    response = await client.patch(
        "/auth/me", data={"bio": "hello world"}, headers=auth_header(alice)
    )
    assert response.status_code == 200
    assert response.json()["bio"] == "hello world"

    cleared = await client.patch(
        "/auth/me", data={"clear_bio": "true"}, headers=auth_header(alice)
    )
    assert cleared.json()["bio"] is None

    # Omitting bio entirely leaves it untouched.
    untouched = await client.patch("/auth/me", data={}, headers=auth_header(alice))
    assert untouched.json()["bio"] is None


async def test_update_profile_bio_rejects_too_many_lines(client: AsyncClient):
    alice = await create_user(client, "alice")

    seven_lines = "\n".join(str(i) for i in range(7))  # 7 lines = 6 newlines, allowed
    ok = await client.patch("/auth/me", data={"bio": seven_lines}, headers=auth_header(alice))
    assert ok.status_code == 200
    assert ok.json()["bio"] == seven_lines

    eight_lines = "\n".join(str(i) for i in range(8))  # 8 lines = 7 newlines, rejected
    rejected = await client.patch(
        "/auth/me", data={"bio": eight_lines}, headers=auth_header(alice)
    )
    assert rejected.status_code == 400


async def test_update_profile_bio_rejects_over_150_chars(client: AsyncClient):
    alice = await create_user(client, "alice")

    response = await client.patch(
        "/auth/me", data={"bio": "a" * 151}, headers=auth_header(alice)
    )
    assert response.status_code == 422


async def test_update_profile_avatar(client: AsyncClient, mock_media_delete):
    alice = await create_user(client, "alice")

    files = {"avatar": ("avatar.png", b"fake-bytes", "image/png")}
    first = await client.patch("/auth/me", files=files, headers=auth_header(alice))
    assert first.status_code == 200
    assert first.json()["avatar_url"] is not None
    assert len(mock_media_delete) == 0

    second = await client.patch("/auth/me", files=files, headers=auth_header(alice))
    assert second.status_code == 200
    # Replacing the avatar cleans up the old Cloudinary asset.
    assert len(mock_media_delete) == 1


async def test_update_profile_avatar_via_direct_upload(
    client: AsyncClient, mock_media_delete, monkeypatch
):
    """Roadmap_Scaling.md A4 — avatar upload migrated to the signed-upload pattern."""
    alice = await create_user(client, "alice")
    sig = await _issue_signature(client, alice)
    monkeypatch.setattr(media_service, "get_image_resource", _fake_resource())

    response = await client.patch(
        "/auth/me", data={"avatar_public_id": sig["public_id"]}, headers=auth_header(alice)
    )
    assert response.status_code == 200
    assert response.json()["avatar_url"] == (
        f"https://res.cloudinary.com/test/image/upload/{sig['folder']}/{sig['public_id']}.png"
    )
    assert len(mock_media_delete) == 0


async def test_update_profile_avatar_rejects_both_file_and_public_id(client: AsyncClient):
    alice = await create_user(client, "alice")

    files = {"avatar": ("avatar.png", b"fake-bytes", "image/png")}
    response = await client.patch(
        "/auth/me",
        files=files,
        data={"avatar_public_id": "some-id"},
        headers=auth_header(alice),
    )
    assert response.status_code == 400
