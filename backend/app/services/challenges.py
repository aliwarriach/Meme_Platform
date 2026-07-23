"""Community challenges (Project_Requirements §10) — two shapes sharing one lifecycle:
`intra_community` (Phase 10: members of one community split into 2+ sides, creator
assigns sides/members up front) and `community_vs_community` (Phase 11: two whole
communities challenge each other, every active member of each is implicitly eligible —
no `ChallengeParticipant` roster).

Lifecycle: setup -> active -> evaluated.
- `intra_community` skips `setup` entirely — a single owner call creates it `active`
  directly (Phase 10's confirmed design: no separate launch step).
- `community_vs_community` starts in `setup` (a *proposal* from one community's owner
  naming the opponent community) and only becomes `active` once the opponent community's
  owner accepts (confirmed design: either owner proposes, the other must accept — prevents
  one community unilaterally dragging another's leaderboard into a challenge).
Both converge on `active` -> members submit memes tagged to their side -> `evaluated`
(a background worker closes the window at `end_time` and scores each side via the Phase 8
scoring stub) -> results (winning side/community + points/badge on its members).

Unlike Phase 8/9's live-SQL-on-read precedent, window close here is a **scheduled worker**
(an arq cron job, `app/workers/tasks/challenges.py::close_expired_challenges` — originally
an in-process asyncio polling loop, moved onto arq once a real task queue existed), per
backend/CLAUDE.md's explicit directive for this feature: the window-close moment must be
a single consistent event, not recomputed differently on every read — a submission and an
evaluation racing the same instant must resolve the same way regardless of which request
got there first.
"""

import datetime
import uuid

from sqlalchemy import exists, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import (
    CannotChallengeSameCommunityError,
    ChallengeNotActiveError,
    ChallengeNotEvaluatedError,
    ChallengeNotFoundError,
    ChallengeNotPendingError,
    ChallengeSetupInvalidError,
    ChallengeWindowClosedError,
    CommunityAccessDeniedError,
    MemeNotEligibleForChallengeError,
    NotChallengeOpponentOwnerError,
    NotChallengeParticipantError,
    NotCommunityOwnerError,
)
from app.models.badge import Badge, BadgeType
from app.models.challenge import Challenge, ChallengeStatus, ChallengeType
from app.models.challenge_participant import ChallengeParticipant
from app.models.challenge_side import ChallengeSide
from app.models.challenge_submission import ChallengeSubmission
from app.models.community import Community
from app.models.community_membership import CommunityMembership, MembershipStatus
from app.models.meme import Meme
from app.models.post_audience import AudienceType, PostAudience
from app.models.user import User
from app.schemas.auth import UserOut
from app.schemas.challenges import (
    ChallengeCreate,
    ChallengeOut,
    ChallengeProposalCreate,
    ChallengeResultsOut,
    ChallengeSideOut,
    ChallengeSubmissionOut,
)
from app.services.communities import require_active_membership
from app.services.memes import build_meme_out
from app.services.scoring import meme_score_expr

WINNER_POINTS = 100


async def _is_active_member(db: AsyncSession, community_id: uuid.UUID, user_id: uuid.UUID) -> bool:
    return bool(
        await db.scalar(
            select(
                exists().where(
                    CommunityMembership.community_id == community_id,
                    CommunityMembership.user_id == user_id,
                    CommunityMembership.status == MembershipStatus.active,
                )
            )
        )
    )


async def _require_involved_member(db: AsyncSession, challenge: Challenge, user_id: uuid.UUID) -> None:
    """Any caller who can view/act on a challenge must be an active member of one of its
    participating communities — `challenge.community_id` always, plus
    `opponent_community_id` for a community_vs_community challenge.
    """
    community_ids = [challenge.community_id]
    if challenge.opponent_community_id is not None:
        community_ids.append(challenge.opponent_community_id)
    for community_id in community_ids:
        if await _is_active_member(db, community_id, user_id):
            return
    raise CommunityAccessDeniedError("Only members of a participating community can do this")


async def _get_challenge_or_404(db: AsyncSession, challenge_id: uuid.UUID) -> Challenge:
    challenge = await db.get(Challenge, challenge_id)
    if challenge is None:
        raise ChallengeNotFoundError("Challenge not found")
    return challenge


def _build_side_out(side: ChallengeSide, member_ids: list[uuid.UUID]) -> ChallengeSideOut:
    return ChallengeSideOut(
        id=side.id,
        name=side.name,
        community_id=side.community_id,
        member_ids=member_ids,
    )


async def _build_challenge_out(db: AsyncSession, challenge: Challenge) -> ChallengeOut:
    side_member_ids: dict[uuid.UUID, list[uuid.UUID]] = {side.id: [] for side in challenge.sides}
    if side_member_ids:
        result = await db.execute(
            select(ChallengeParticipant).where(
                ChallengeParticipant.challenge_id == challenge.id
            )
        )
        for participant in result.scalars().all():
            side_member_ids.setdefault(participant.side_id, []).append(participant.user_id)

    creator = await db.get(User, challenge.creator_id)

    return ChallengeOut(
        id=challenge.id,
        community_id=challenge.community_id,
        opponent_community_id=challenge.opponent_community_id,
        creator=UserOut.model_validate(creator),
        title=challenge.title,
        challenge_type=challenge.challenge_type,
        status=challenge.status,
        start_time=challenge.start_time,
        end_time=challenge.end_time,
        winning_side_id=challenge.winning_side_id,
        sides=[
            _build_side_out(side, side_member_ids.get(side.id, [])) for side in challenge.sides
        ],
    )


async def create_challenge(
    db: AsyncSession, current_user: User, community_id: uuid.UUID, payload: ChallengeCreate
) -> ChallengeOut:
    """Owner-only, matching the existing precedent that only the community owner acts on
    community-wide moderation state (join-request approve/reject). Sides + member
    assignment are fixed at setup time — no self-signup/reassignment endpoint (Phase 10
    scope, see the confirmed design decision in `.claude/memory/challenges.md`).
    """
    community = await db.get(Community, community_id)
    if community is None:
        raise ChallengeNotFoundError("Community not found")
    if community.owner_id != current_user.id:
        raise NotCommunityOwnerError("Only the community owner can set up a challenge")

    if payload.end_time <= payload.start_time:
        raise ChallengeSetupInvalidError("end_time must be after start_time")

    all_member_ids = [uid for side in payload.sides for uid in side.member_ids]
    if len(all_member_ids) != len(set(all_member_ids)):
        raise ChallengeSetupInvalidError("A member can only be assigned to one side")

    active_member_ids = set(
        (
            await db.execute(
                select(CommunityMembership.user_id).where(
                    CommunityMembership.community_id == community_id,
                    CommunityMembership.status == MembershipStatus.active,
                )
            )
        ).scalars()
    )
    if not set(all_member_ids).issubset(active_member_ids):
        raise ChallengeSetupInvalidError(
            "Every assigned member must be an active member of this community"
        )

    challenge = Challenge(
        community_id=community_id,
        creator_id=current_user.id,
        title=payload.title,
        challenge_type=ChallengeType.intra_community,
        status=ChallengeStatus.active,
        start_time=payload.start_time,
        end_time=payload.end_time,
    )
    db.add(challenge)
    await db.flush()

    for side_setup in payload.sides:
        side = ChallengeSide(challenge_id=challenge.id, name=side_setup.name)
        db.add(side)
        await db.flush()
        for user_id in side_setup.member_ids:
            db.add(
                ChallengeParticipant(challenge_id=challenge.id, side_id=side.id, user_id=user_id)
            )

    await db.commit()
    await db.refresh(challenge)
    return await _build_challenge_out(db, challenge)


async def propose_challenge(
    db: AsyncSession,
    current_user: User,
    community_id: uuid.UUID,
    opponent_community_id: uuid.UUID,
    payload: ChallengeProposalCreate,
) -> ChallengeOut:
    """A community_vs_community proposal — owner-only (matching intra_community's
    precedent), starts in `setup` and stays there until the opponent community's owner
    accepts (`accept_challenge`). No member/side assignment here: every active member of
    each community is implicitly eligible once the challenge goes active, one side per
    community.
    """
    community = await db.get(Community, community_id)
    if community is None:
        raise ChallengeNotFoundError("Community not found")
    if community.owner_id != current_user.id:
        raise NotCommunityOwnerError("Only the community owner can propose a challenge")

    if opponent_community_id == community_id:
        raise CannotChallengeSameCommunityError("A community can't challenge itself")

    opponent = await db.get(Community, opponent_community_id)
    if opponent is None:
        raise ChallengeNotFoundError("Opponent community not found")

    if payload.end_time <= payload.start_time:
        raise ChallengeSetupInvalidError("end_time must be after start_time")

    challenge = Challenge(
        community_id=community_id,
        opponent_community_id=opponent_community_id,
        creator_id=current_user.id,
        title=payload.title,
        challenge_type=ChallengeType.community_vs_community,
        status=ChallengeStatus.setup,
        start_time=payload.start_time,
        end_time=payload.end_time,
    )
    db.add(challenge)
    await db.flush()

    db.add(ChallengeSide(challenge_id=challenge.id, name=community.name, community_id=community_id))
    db.add(
        ChallengeSide(
            challenge_id=challenge.id, name=opponent.name, community_id=opponent_community_id
        )
    )

    await db.commit()
    await db.refresh(challenge)
    return await _build_challenge_out(db, challenge)


async def _get_pending_proposal_for_opponent_owner(
    db: AsyncSession, current_user: User, challenge_id: uuid.UUID
) -> Challenge:
    challenge = await _get_challenge_or_404(db, challenge_id)
    if challenge.opponent_community_id is None:
        raise ChallengeNotFoundError("This challenge has no pending proposal")
    if challenge.status != ChallengeStatus.setup:
        raise ChallengeNotPendingError("This challenge is no longer awaiting a response")

    opponent = await db.get(Community, challenge.opponent_community_id)
    if opponent is None or opponent.owner_id != current_user.id:
        raise NotChallengeOpponentOwnerError(
            "Only the challenged community's owner can respond to this proposal"
        )
    return challenge


async def accept_challenge(
    db: AsyncSession, current_user: User, challenge_id: uuid.UUID
) -> ChallengeOut:
    challenge = await _get_pending_proposal_for_opponent_owner(db, current_user, challenge_id)
    challenge.status = ChallengeStatus.active
    await db.commit()
    await db.refresh(challenge)
    return await _build_challenge_out(db, challenge)


async def decline_challenge(db: AsyncSession, current_user: User, challenge_id: uuid.UUID) -> None:
    challenge = await _get_pending_proposal_for_opponent_owner(db, current_user, challenge_id)
    await db.execute(
        ChallengeSide.__table__.delete().where(ChallengeSide.challenge_id == challenge.id)
    )
    await db.delete(challenge)
    await db.commit()


async def get_challenge(
    db: AsyncSession, current_user: User, challenge_id: uuid.UUID
) -> ChallengeOut:
    challenge = await _get_challenge_or_404(db, challenge_id)
    await _require_involved_member(db, challenge, current_user.id)
    return await _build_challenge_out(db, challenge)


async def list_community_challenges(
    db: AsyncSession, current_user: User, community_id: uuid.UUID
) -> list[ChallengeOut]:
    """Every challenge this community is involved in — as proposer/host
    (`community_id`) or, for a community_vs_community proposal, as the challenged
    opponent (`opponent_community_id`) — including still-pending proposals awaiting this
    community owner's accept/decline.
    """
    await require_active_membership(db, community_id, current_user.id)
    result = await db.execute(
        select(Challenge)
        .where(
            or_(
                Challenge.community_id == community_id,
                Challenge.opponent_community_id == community_id,
            )
        )
        .order_by(Challenge.created_at.desc())
    )
    return [await _build_challenge_out(db, challenge) for challenge in result.scalars().all()]


async def _get_caller_side_intra_community(
    db: AsyncSession, challenge_id: uuid.UUID, user_id: uuid.UUID
) -> uuid.UUID:
    side_id = await db.scalar(
        select(ChallengeParticipant.side_id).where(
            ChallengeParticipant.challenge_id == challenge_id,
            ChallengeParticipant.user_id == user_id,
        )
    )
    if side_id is None:
        raise NotChallengeParticipantError("You aren't assigned to a side in this challenge")
    return side_id


async def _get_caller_side_vs_community(
    db: AsyncSession, challenge: Challenge, user_id: uuid.UUID
) -> ChallengeSide:
    """A community_vs_community challenge has no participant roster — the caller's side
    is whichever of the two participating communities they're an active member of. A
    member of *both* communities is rejected rather than silently picking one, since which
    side they're submitting for would be ambiguous.
    """
    is_home_member = await _is_active_member(db, challenge.community_id, user_id)
    is_opponent_member = (
        challenge.opponent_community_id is not None
        and await _is_active_member(db, challenge.opponent_community_id, user_id)
    )
    if is_home_member and is_opponent_member:
        raise NotChallengeParticipantError(
            "You belong to both participating communities — ambiguous which side to submit for"
        )
    side_community_id = (
        challenge.community_id
        if is_home_member
        else challenge.opponent_community_id
        if is_opponent_member
        else None
    )
    if side_community_id is None:
        raise NotChallengeParticipantError(
            "You aren't an active member of either community in this challenge"
        )

    side = (
        await db.execute(
            select(ChallengeSide).where(
                ChallengeSide.challenge_id == challenge.id,
                ChallengeSide.community_id == side_community_id,
            )
        )
    ).scalar_one()
    return side


async def submit_to_challenge(
    db: AsyncSession, current_user: User, challenge_id: uuid.UUID, meme_id: uuid.UUID
) -> ChallengeSubmissionOut:
    """Rejects: challenge not in its active window (setup never reached / already
    evaluated — client-side timing is never trusted, this checks `status` +
    `now < end_time` server-side), submitter not assigned to (intra_community) or not an
    active member of (community_vs_community) a side, meme not authored by the submitter,
    or a meme already submitted to this challenge. For community_vs_community, the meme
    must also already be a **community post targeting the submitter's side-community**
    (a `community`-typed `PostAudience` row) — this is what makes challenge results flow
    into that community's leaderboard standing (§10.2) via the existing live-SQL
    leaderboard query, with no separate scoring path needed.
    """
    challenge = await _get_challenge_or_404(db, challenge_id)

    now = datetime.datetime.now(datetime.timezone.utc)
    if challenge.status != ChallengeStatus.active:
        raise ChallengeNotActiveError("This challenge isn't accepting submissions")
    if now >= challenge.end_time:
        raise ChallengeWindowClosedError("The submission window for this challenge has closed")

    if challenge.challenge_type == ChallengeType.community_vs_community:
        side = await _get_caller_side_vs_community(db, challenge, current_user.id)
        side_id = side.id
    else:
        side_id = await _get_caller_side_intra_community(db, challenge_id, current_user.id)

    author_id = await db.scalar(select(Meme.author_id).where(Meme.id == meme_id))
    if author_id is None or author_id != current_user.id:
        raise MemeNotEligibleForChallengeError("You can only submit your own memes")

    if challenge.challenge_type == ChallengeType.community_vs_community:
        targets_side_community = await db.scalar(
            select(
                exists().where(
                    PostAudience.meme_id == meme_id,
                    PostAudience.audience_type == AudienceType.community,
                    PostAudience.community_id == side.community_id,
                )
            )
        )
        if not targets_side_community:
            raise MemeNotEligibleForChallengeError(
                "This meme must be posted in your community to submit it to this challenge"
            )

    already_submitted = await db.scalar(
        select(exists().where(ChallengeSubmission.challenge_id == challenge_id, ChallengeSubmission.meme_id == meme_id))
    )
    if already_submitted:
        raise MemeNotEligibleForChallengeError("This meme was already submitted to this challenge")

    submission = ChallengeSubmission(
        challenge_id=challenge_id, side_id=side_id, submitter_id=current_user.id, meme_id=meme_id
    )
    db.add(submission)
    await db.commit()
    await db.refresh(submission)

    submitter = await db.get(User, current_user.id)

    return ChallengeSubmissionOut(
        id=submission.id,
        side_id=side_id,
        submitter=UserOut.model_validate(submitter),
        meme=build_meme_out(submission.meme, reaction_count=0, comment_count=0, viewer_has_reacted=False),
        created_at=submission.created_at,
    )


async def _side_score(db: AsyncSession, challenge_id: uuid.UUID, side_id: uuid.UUID) -> float:
    total = await db.scalar(
        select(func.coalesce(func.sum(meme_score_expr()), 0))
        .select_from(Meme)
        .join(ChallengeSubmission, ChallengeSubmission.meme_id == Meme.id)
        .where(
            ChallengeSubmission.challenge_id == challenge_id,
            ChallengeSubmission.side_id == side_id,
        )
    )
    return float(total or 0)


async def evaluate_challenge(db: AsyncSession, challenge_id: uuid.UUID) -> Challenge:
    """Scores every side via the Phase 8 scoring stub, marks the challenge `evaluated`,
    and awards points + a badge to every member of the winning side. Idempotent by
    caller contract (the worker only calls this once per challenge, gated on `status ==
    active`), but re-running is harmless beyond duplicate badge rows, which the worker's
    single-pass status transition prevents.
    """
    challenge = await _get_challenge_or_404(db, challenge_id)
    if challenge.status != ChallengeStatus.active:
        return challenge

    sides = (
        await db.execute(select(ChallengeSide).where(ChallengeSide.challenge_id == challenge_id))
    ).scalars().all()

    scores = {side.id: await _side_score(db, challenge_id, side.id) for side in sides}
    winning_side_id = max(scores, key=lambda sid: scores[sid]) if scores else None

    # A true tie (including "nobody submitted anything") crowns no winner rather than an
    # arbitrary one — `max` alone would silently pick the first side in that case.
    if winning_side_id is not None:
        top_score = scores[winning_side_id]
        if list(scores.values()).count(top_score) > 1:
            winning_side_id = None

    challenge.status = ChallengeStatus.evaluated
    challenge.winning_side_id = winning_side_id

    if winning_side_id is not None:
        winning_side = next(s for s in sides if s.id == winning_side_id)
        if challenge.challenge_type == ChallengeType.community_vs_community:
            # No ChallengeParticipant roster for this shape — every active member of the
            # winning side's community gets the badge, per §10.2 ("winners" = the whole
            # community's participating members, not a pre-picked sub-roster).
            winner_ids = (
                await db.execute(
                    select(CommunityMembership.user_id).where(
                        CommunityMembership.community_id == winning_side.community_id,
                        CommunityMembership.status == MembershipStatus.active,
                    )
                )
            ).scalars().all()
        else:
            winner_ids = (
                await db.execute(
                    select(ChallengeParticipant.user_id).where(
                        ChallengeParticipant.challenge_id == challenge_id,
                        ChallengeParticipant.side_id == winning_side_id,
                    )
                )
            ).scalars().all()
        for user_id in winner_ids:
            db.add(
                Badge(
                    user_id=user_id,
                    badge_type=BadgeType.challenge_winner,
                    challenge_id=challenge_id,
                    points=WINNER_POINTS,
                    label=f"Won challenge: {challenge.title}"[:100],
                )
            )

    await db.commit()
    await db.refresh(challenge)
    return challenge


async def get_results(
    db: AsyncSession, current_user: User, challenge_id: uuid.UUID
) -> ChallengeResultsOut:
    challenge = await _get_challenge_or_404(db, challenge_id)
    await _require_involved_member(db, challenge, current_user.id)
    if challenge.status != ChallengeStatus.evaluated:
        raise ChallengeNotEvaluatedError("This challenge hasn't been evaluated yet")

    submissions_result = await db.execute(
        select(ChallengeSubmission)
        .where(ChallengeSubmission.challenge_id == challenge_id)
        .order_by(ChallengeSubmission.created_at)
    )

    submissions = []
    for submission in submissions_result.scalars().all():
        submitter = await db.get(User, submission.submitter_id)
        submissions.append(
            ChallengeSubmissionOut(
                id=submission.id,
                side_id=submission.side_id,
                submitter=UserOut.model_validate(submitter),
                meme=build_meme_out(
                    submission.meme, reaction_count=0, comment_count=0, viewer_has_reacted=False
                ),
                created_at=submission.created_at,
            )
        )

    return ChallengeResultsOut(
        challenge=await _build_challenge_out(db, challenge), submissions=submissions
    )
