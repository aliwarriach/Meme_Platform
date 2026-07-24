import pytest
from httpx import AsyncClient

from tests.conftest import auth_header, create_user


async def _create_container(
    client: AsyncClient, user: dict, source_url: str = "https://www.instagram.com/reel/abc123/"
):
    return await client.post(
        "/instagram/containers", json={"source_url": source_url}, headers=auth_header(user)
    )


@pytest.mark.asyncio
async def test_create_container_requires_auth(client: AsyncClient):
    response = await client.post(
        "/instagram/containers", json={"source_url": "https://www.instagram.com/reel/abc123/"}
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_create_container_rejects_non_instagram_url(client: AsyncClient):
    alice = await create_user(client, "alice")
    response = await _create_container(client, alice, source_url="https://tiktok.com/@x/video/1")
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_create_container_starts_pending_then_metadata_fills_in(client: AsyncClient):
    alice = await create_user(client, "alice")
    response = await _create_container(client, alice)
    assert response.status_code == 201
    body = response.json()
    # The response body is built from the in-memory container *before* the metadata job
    # runs, so it always reports "pending" here regardless of how fast the job completes —
    # this is the real behavior (intake must never block on the external fetch), not a
    # race the test is trying to win.
    assert body["metadata_status"] == "pending"
    assert body["title"] is None
    container_id = body["id"]

    # `FakeArqPool` (see conftest.py) runs the metadata-fetch job inline/synchronously as
    # part of `enqueue_job`, so by the time `create_container` has returned, the job has
    # already committed its update — no wait/poll needed here, unlike the old
    # `asyncio.create_task` fire-and-forget version of this test.
    response = await client.get(f"/instagram/containers/{container_id}", headers=auth_header(alice))
    assert response.status_code == 200
    body = response.json()
    assert body["metadata_status"] == "ready"
    assert body["title"] is not None


@pytest.mark.asyncio
async def test_get_nonexistent_container_404(client: AsyncClient):
    alice = await create_user(client, "alice")
    response = await client.get(
        "/instagram/containers/00000000-0000-0000-0000-000000000000", headers=auth_header(alice)
    )
    assert response.status_code == 404


async def _vote_container(
    client: AsyncClient, user: dict, container_id: str, value: int
) -> object:
    return await client.post(
        f"/instagram/containers/{container_id}/votes",
        json={"value": value},
        headers=auth_header(user),
    )


@pytest.mark.asyncio
async def test_container_upvote(client: AsyncClient):
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")
    container_id = (await _create_container(client, alice)).json()["id"]

    response = await _vote_container(client, bob, container_id, 1)
    assert response.status_code == 201
    body = response.json()
    assert body["upvote_count"] == 1
    assert body["downvote_count"] == 0
    assert body["score"] == 1
    assert body["viewer_vote"] == 1

    get_response = await client.get(
        f"/instagram/containers/{container_id}", headers=auth_header(bob)
    )
    assert get_response.json()["upvote_count"] == 1
    assert get_response.json()["viewer_vote"] == 1


@pytest.mark.asyncio
async def test_container_downvote(client: AsyncClient):
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")
    container_id = (await _create_container(client, alice)).json()["id"]

    response = await _vote_container(client, bob, container_id, -1)
    assert response.status_code == 201
    body = response.json()
    assert body["upvote_count"] == 0
    assert body["downvote_count"] == 1
    assert body["score"] == -1
    assert body["viewer_vote"] == -1


@pytest.mark.asyncio
async def test_container_upvote_twice_removes_the_vote(client: AsyncClient):
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")
    container_id = (await _create_container(client, alice)).json()["id"]

    await _vote_container(client, bob, container_id, 1)
    second = await _vote_container(client, bob, container_id, 1)
    assert second.status_code == 201
    body = second.json()
    assert body["upvote_count"] == 0
    assert body["downvote_count"] == 0
    assert body["score"] == 0
    assert body["viewer_vote"] is None


@pytest.mark.asyncio
async def test_container_upvote_then_downvote_flips_the_vote(client: AsyncClient):
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")
    container_id = (await _create_container(client, alice)).json()["id"]

    await _vote_container(client, bob, container_id, 1)
    flipped = await _vote_container(client, bob, container_id, -1)
    assert flipped.status_code == 201
    body = flipped.json()
    assert body["upvote_count"] == 0
    assert body["downvote_count"] == 1
    assert body["score"] == -1
    assert body["viewer_vote"] == -1


@pytest.mark.asyncio
async def test_container_vote_for_own_submission_allowed(client: AsyncClient):
    """A container has no self-vote restriction — confirmed in
    services/instagram.py::cast_container_vote's docstring."""
    alice = await create_user(client, "alice")
    container_id = (await _create_container(client, alice)).json()["id"]

    response = await _vote_container(client, alice, container_id, 1)
    assert response.status_code == 201


@pytest.mark.asyncio
async def test_container_comments_add_and_list(client: AsyncClient):
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")
    container_id = (await _create_container(client, alice)).json()["id"]

    response = await client.post(
        f"/instagram/containers/{container_id}/comments",
        json={"body": "lol"},
        headers=auth_header(bob),
    )
    assert response.status_code == 201
    assert response.json()["body"] == "lol"

    list_response = await client.get(
        f"/instagram/containers/{container_id}/comments", headers=auth_header(alice)
    )
    assert list_response.status_code == 200
    assert len(list_response.json()) == 1


@pytest.mark.asyncio
async def test_feed_includes_both_memes_and_containers(client: AsyncClient):
    alice = await create_user(client, "alice")
    files = {"image": ("test.png", b"fake-bytes", "image/png")}
    await client.post(
        "/memes", files=files, data={"audiences": ["public"]}, headers=auth_header(alice)
    )
    await _create_container(client, alice)

    response = await client.get("/memes/feed", headers=auth_header(alice))
    assert response.status_code == 200
    body = response.json()
    kinds = {item["kind"] for item in body["items"]}
    assert kinds == {"meme", "container"}


@pytest.mark.asyncio
async def test_container_cannot_be_submitted_to_challenge(client: AsyncClient):
    """Project_Requirements §13: MemeContainers are never challenge-eligible — rejected by
    construction since submit_to_challenge looks up Meme.author_id, which no container ID
    will ever match."""
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")
    container_id = (await _create_container(client, alice)).json()["id"]

    community_response = await client.post(
        "/communities", data={"name": "Test Community", "privacy": "open"}, headers=auth_header(alice)
    )
    community_id = community_response.json()["id"]
    await client.post(f"/communities/{community_id}/join", headers=auth_header(bob))

    challenge_response = await client.post(
        f"/communities/{community_id}/challenges",
        json={
            "title": "Test Challenge",
            "start_time": "2020-01-01T00:00:00Z",
            "end_time": "2999-01-01T00:00:00Z",
            "sides": [
                {"name": "A", "member_ids": [alice["user"]["id"]]},
                {"name": "B", "member_ids": [bob["user"]["id"]]},
            ],
        },
        headers=auth_header(alice),
    )
    challenge_id = challenge_response.json()["id"]

    submit_response = await client.post(
        f"/communities/{community_id}/challenges/{challenge_id}/submissions",
        params={"meme_id": container_id},
        headers=auth_header(alice),
    )
    assert submit_response.status_code == 400
