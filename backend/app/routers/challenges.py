import uuid

from fastapi import APIRouter, Form, UploadFile

from app.core.deps import CurrentUser, DbSession
from app.schemas.challenges import (
    ChallengeCreate,
    ChallengeJoin,
    ChallengeOut,
    ChallengeProposalCreate,
    ChallengeResultsOut,
    ChallengeSubmissionOut,
    DuelCreate,
    OpenChallengeCreate,
)
from app.services import challenges as challenges_service

router = APIRouter(prefix="/communities/{community_id}/challenges", tags=["challenges"])

# Challenges are also reachable outside a single community's context — the Compete tab
# lists everything the caller is in, and the creator submits straight into a challenge
# without the client needing to know which community it belongs to.
flat_router = APIRouter(prefix="/challenges", tags=["challenges"])


@flat_router.get("/mine", response_model=list[ChallengeOut])
async def list_my_challenges(current_user: CurrentUser, db: DbSession) -> list[ChallengeOut]:
    return await challenges_service.list_my_challenges(db, current_user)


@flat_router.post("/open", response_model=ChallengeOut, status_code=201)
async def create_open_challenge(
    payload: OpenChallengeCreate, current_user: CurrentUser, db: DbSession
) -> ChallengeOut:
    """Anyone can start one — no community, no ownership. Reserves the entry hashtag."""
    return await challenges_service.create_open_challenge(db, current_user, payload)


@flat_router.get("/open", response_model=list[ChallengeOut])
async def list_open_challenges(current_user: CurrentUser, db: DbSession) -> list[ChallengeOut]:
    return await challenges_service.list_open_challenges(db, current_user)


@flat_router.post("/{challenge_id}/join", response_model=ChallengeOut)
async def join_open_challenge(
    challenge_id: uuid.UUID, payload: ChallengeJoin, current_user: CurrentUser, db: DbSession
) -> ChallengeOut:
    return await challenges_service.join_open_challenge(
        db, current_user, challenge_id, payload.side_id
    )


@flat_router.post("/{challenge_id}/submissions", response_model=ChallengeSubmissionOut, status_code=201)
async def create_and_submit_to_challenge(
    challenge_id: uuid.UUID,
    current_user: CurrentUser,
    db: DbSession,
    image: UploadFile | None = None,
    image_public_id: str | None = Form(None),
    caption: str | None = Form(None),
    editor_document_json: str | None = Form(None),
) -> ChallengeSubmissionOut:
    """Creates the meme and enters it into the challenge in one transaction. Distinct from
    the community-scoped `POST .../challenges/{id}/submissions?meme_id=`, which enters a
    meme that already exists. `image` (legacy multipart upload) and `image_public_id`
    (Roadmap_Scaling.md A4's direct-to-Cloudinary flow — confirm the `public_id` from
    `POST /media/upload-signature`) are mutually exclusive; exactly one is required.
    `editor_document_json` (optional) mirrors `POST /memes`'s — see there.
    """
    return await challenges_service.create_and_submit_to_challenge(
        db, current_user, challenge_id, caption, image,
        image_public_id=image_public_id, editor_document_json=editor_document_json,
    )


@flat_router.post("/duels/{opponent_id}", response_model=ChallengeOut, status_code=201)
async def propose_duel(
    opponent_id: uuid.UUID, payload: DuelCreate, current_user: CurrentUser, db: DbSession
) -> ChallengeOut:
    """A 1v1 friend challenge — no community. Requires an accepted friendship."""
    return await challenges_service.propose_duel(db, current_user, opponent_id, payload)


@flat_router.post("/duels/{challenge_id}/accept", response_model=ChallengeOut)
async def accept_duel(challenge_id: uuid.UUID, current_user: CurrentUser, db: DbSession) -> ChallengeOut:
    return await challenges_service.accept_duel(db, current_user, challenge_id)


@flat_router.delete("/duels/{challenge_id}/decline", status_code=204)
async def decline_duel(challenge_id: uuid.UUID, current_user: CurrentUser, db: DbSession) -> None:
    await challenges_service.decline_duel(db, current_user, challenge_id)


@flat_router.get("/{challenge_id}", response_model=ChallengeOut)
async def get_challenge_flat(
    challenge_id: uuid.UUID, current_user: CurrentUser, db: DbSession
) -> ChallengeOut:
    """Community-less lookup — needed for duels (and usable for `open` challenges too),
    which have no `communityId` to put in the URL the way the community-scoped route does.
    """
    return await challenges_service.get_challenge(db, current_user, challenge_id)


@flat_router.get("/{challenge_id}/results", response_model=ChallengeResultsOut)
async def get_results_flat(
    challenge_id: uuid.UUID, current_user: CurrentUser, db: DbSession
) -> ChallengeResultsOut:
    return await challenges_service.get_results(db, current_user, challenge_id)


@router.post("", response_model=ChallengeOut, status_code=201)
async def create_challenge(
    community_id: uuid.UUID,
    payload: ChallengeCreate,
    current_user: CurrentUser,
    db: DbSession,
) -> ChallengeOut:
    return await challenges_service.create_challenge(db, current_user, community_id, payload)


@router.post("/vs/{opponent_community_id}", response_model=ChallengeOut, status_code=201)
async def propose_challenge(
    community_id: uuid.UUID,
    opponent_community_id: uuid.UUID,
    payload: ChallengeProposalCreate,
    current_user: CurrentUser,
    db: DbSession,
) -> ChallengeOut:
    return await challenges_service.propose_challenge(
        db, current_user, community_id, opponent_community_id, payload
    )


@router.post("/{challenge_id}/accept", response_model=ChallengeOut)
async def accept_challenge(
    community_id: uuid.UUID, challenge_id: uuid.UUID, current_user: CurrentUser, db: DbSession
) -> ChallengeOut:
    return await challenges_service.accept_challenge(db, current_user, challenge_id)


@router.delete("/{challenge_id}/decline", status_code=204)
async def decline_challenge(
    community_id: uuid.UUID, challenge_id: uuid.UUID, current_user: CurrentUser, db: DbSession
) -> None:
    await challenges_service.decline_challenge(db, current_user, challenge_id)


@router.get("", response_model=list[ChallengeOut])
async def list_community_challenges(
    community_id: uuid.UUID, current_user: CurrentUser, db: DbSession
) -> list[ChallengeOut]:
    return await challenges_service.list_community_challenges(db, current_user, community_id)


@router.get("/{challenge_id}", response_model=ChallengeOut)
async def get_challenge(
    community_id: uuid.UUID, challenge_id: uuid.UUID, current_user: CurrentUser, db: DbSession
) -> ChallengeOut:
    return await challenges_service.get_challenge(db, current_user, challenge_id)


@router.post("/{challenge_id}/submissions", response_model=ChallengeSubmissionOut, status_code=201)
async def submit_to_challenge(
    community_id: uuid.UUID,
    challenge_id: uuid.UUID,
    meme_id: uuid.UUID,
    current_user: CurrentUser,
    db: DbSession,
) -> ChallengeSubmissionOut:
    return await challenges_service.submit_to_challenge(db, current_user, challenge_id, meme_id)


@router.get("/{challenge_id}/results", response_model=ChallengeResultsOut)
async def get_results(
    community_id: uuid.UUID, challenge_id: uuid.UUID, current_user: CurrentUser, db: DbSession
) -> ChallengeResultsOut:
    return await challenges_service.get_results(db, current_user, challenge_id)
