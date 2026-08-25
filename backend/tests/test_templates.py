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


async def _issue_signature(client: AsyncClient, user: dict, context: str = "templates") -> dict:
    response = await client.post(
        "/media/upload-signature", json={"context": context}, headers=auth_header(user)
    )
    assert response.status_code == 200
    return response.json()


async def _post_template(
    client: AsyncClient,
    user: dict,
    name: str = "drake",
    content_type: str = "image/png",
    file_bytes: bytes = b"fake-bytes",
    community_id: str | None = None,
) -> object:
    files = {"image": ("template.png", file_bytes, content_type)}
    data = {"name": name}
    if community_id is not None:
        data["community_id"] = community_id
    return await client.post("/templates", files=files, data=data, headers=auth_header(user))


async def _create_community(client: AsyncClient, owner: dict, privacy: str = "open") -> object:
    response = await client.post(
        "/communities",
        data={"name": "Meme Lords", "privacy": privacy},
        headers=auth_header(owner),
    )
    return response.json()


async def test_create_template_returns_template(client: AsyncClient):
    alice = await create_user(client, "alice")
    response = await _post_template(client, alice)
    assert response.status_code == 201
    body = response.json()
    assert body["name"] == "drake"
    assert body["uploader"]["username"] == "alice"
    assert body["image_url"]


async def test_create_template_rejects_non_image_content_type(client: AsyncClient):
    alice = await create_user(client, "alice")
    response = await _post_template(client, alice, content_type="text/plain")
    assert response.status_code == 400


async def test_create_template_rejects_empty_file(client: AsyncClient):
    alice = await create_user(client, "alice")
    response = await _post_template(client, alice, file_bytes=b"")
    assert response.status_code == 400


async def test_create_template_rejects_missing_name(client: AsyncClient):
    alice = await create_user(client, "alice")
    files = {"image": ("template.png", b"fake-bytes", "image/png")}
    response = await client.post("/templates", files=files, headers=auth_header(alice))
    assert response.status_code == 422


async def test_create_template_via_direct_upload_confirms_and_creates(
    client: AsyncClient, monkeypatch
):
    """Roadmap_Scaling.md A4 — `POST /templates` migrated to the signed-upload pattern."""
    alice = await create_user(client, "alice")
    sig = await _issue_signature(client, alice)
    monkeypatch.setattr(media_service, "get_image_resource", _fake_resource())

    response = await client.post(
        "/templates",
        data={"name": "drake", "image_public_id": sig["public_id"]},
        headers=auth_header(alice),
    )
    assert response.status_code == 201
    assert response.json()["image_url"] == (
        f"https://res.cloudinary.com/test/image/upload/{sig['public_id']}.png"
    )


async def test_create_template_requires_exactly_one_image_source(client: AsyncClient):
    alice = await create_user(client, "alice")

    neither = await client.post(
        "/templates", data={"name": "drake"}, headers=auth_header(alice)
    )
    assert neither.status_code == 400

    both = await client.post(
        "/templates",
        files={"image": ("test.png", b"fake-bytes", "image/png")},
        data={"name": "drake", "image_public_id": "some-id"},
        headers=auth_header(alice),
    )
    assert both.status_code == 400


async def test_list_templates_is_global_and_visible_to_any_authenticated_user(
    client: AsyncClient,
):
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")
    await _post_template(client, alice, name="drake")

    response = await client.get("/templates", headers=auth_header(bob))
    assert response.status_code == 200
    names = [item["name"] for item in response.json()["items"]]
    assert "drake" in names


async def test_list_templates_pagination_returns_next_cursor_and_respects_it(
    client: AsyncClient,
):
    alice = await create_user(client, "alice")
    for i in range(3):
        await _post_template(client, alice, name=f"template {i}")

    first_page = await client.get(
        "/templates", params={"limit": 2}, headers=auth_header(alice)
    )
    first_body = first_page.json()
    assert len(first_body["items"]) == 2
    assert first_body["next_cursor"] is not None

    second_page = await client.get(
        "/templates",
        params={"limit": 2, "cursor": first_body["next_cursor"]},
        headers=auth_header(alice),
    )
    second_body = second_page.json()
    assert len(second_body["items"]) == 1
    assert second_body["next_cursor"] is None

    first_ids = {item["id"] for item in first_body["items"]}
    second_ids = {item["id"] for item in second_body["items"]}
    assert first_ids.isdisjoint(second_ids)


async def test_list_templates_rejects_invalid_cursor(client: AsyncClient):
    alice = await create_user(client, "alice")
    response = await client.get(
        "/templates", params={"cursor": "not-a-real-cursor"}, headers=auth_header(alice)
    )
    assert response.status_code == 400


async def test_member_can_upload_community_template(client: AsyncClient):
    alice = await create_user(client, "alice")
    community = await _create_community(client, alice)

    response = await _post_template(client, alice, name="community drake", community_id=community["id"])
    assert response.status_code == 201
    body = response.json()
    assert body["community_id"] == community["id"]


async def test_non_member_cannot_upload_community_template(client: AsyncClient):
    alice = await create_user(client, "alice")
    carol = await create_user(client, "carol")
    community = await _create_community(client, alice)

    response = await _post_template(client, carol, community_id=community["id"])
    assert response.status_code == 403


async def test_upload_to_nonexistent_community_rejected(client: AsyncClient):
    alice = await create_user(client, "alice")
    response = await _post_template(
        client, alice, community_id="00000000-0000-0000-0000-000000000000"
    )
    assert response.status_code == 404


async def test_global_template_list_excludes_community_templates(client: AsyncClient):
    alice = await create_user(client, "alice")
    community = await _create_community(client, alice)

    await _post_template(client, alice, name="global one")
    await _post_template(client, alice, name="community one", community_id=community["id"])

    response = await client.get("/templates", headers=auth_header(alice))
    names = [item["name"] for item in response.json()["items"]]
    assert "global one" in names
    assert "community one" not in names


async def test_community_templates_endpoint_requires_membership(client: AsyncClient):
    alice = await create_user(client, "alice")
    carol = await create_user(client, "carol")
    community = await _create_community(client, alice)
    await _post_template(client, alice, name="community one", community_id=community["id"])

    as_member = await client.get(
        f"/communities/{community['id']}/templates", headers=auth_header(alice)
    )
    assert as_member.status_code == 200
    names = [item["name"] for item in as_member.json()["items"]]
    assert "community one" in names

    as_non_member = await client.get(
        f"/communities/{community['id']}/templates", headers=auth_header(carol)
    )
    assert as_non_member.status_code == 403


async def test_community_templates_gated_even_for_open_community(client: AsyncClient):
    alice = await create_user(client, "alice")
    carol = await create_user(client, "carol")
    community = await _create_community(client, alice, privacy="open")

    response = await client.get(
        f"/communities/{community['id']}/templates", headers=auth_header(carol)
    )
    assert response.status_code == 403


async def test_templates_endpoints_require_authentication(client: AsyncClient):
    response = await client.get("/templates")
    assert response.status_code == 401

    files = {"image": ("template.png", b"fake-bytes", "image/png")}
    response = await client.post("/templates", files=files, data={"name": "x"})
    assert response.status_code == 401
