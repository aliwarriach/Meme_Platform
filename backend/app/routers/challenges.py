import uuid

from fastapi import APIRouter

from app.core.deps import CurrentUser, DbSession
from app.schemas.challenges import (
    ChallengeCreate,
    ChallengeOut,
    ChallengeProposalCreate,
    ChallengeResultsOut,
    ChallengeSubmissionOut,
)
from app.services import challenges as challenges_service

router = APIRouter(prefix="/communities/{community_id}/challenges", tags=["challenges"])


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
