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
import math
import uuid

from fastapi import UploadFile
from sqlalchemy import case, exists, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import (
    AlreadyJoinedChallengeError,
    CannotChallengeSameCommunityError,
    CannotDuelSelfError,
    ChallengeNotOpenError,
    HashtagAlreadyReservedError,
    ChallengeNotActiveError,
    ChallengeNotEvaluatedError,
    ChallengeNotFoundError,
    ChallengeNotPendingError,
    ChallengeSetupInvalidError,
    ChallengeWindowClosedError,
    CommunityAccessDeniedError,
    MemeNotEligibleForChallengeError,
    NotChallengeInviteeError,
    NotChallengeOpponentOwnerError,
    NotChallengeParticipantError,
    NotCommunityOwnerError,
    NotFriendsError,
)
from app.core.security import hash_password
from app.models.badge import Badge, BadgeType
from app.models.challenge import Challenge, ChallengeStatus, ChallengeType
from app.models.challenge_participant import ChallengeParticipant
from app.models.challenge_side import ChallengeSide
from app.models.challenge_submission import ChallengeSubmission
from app.models.community import Community
from app.models.community_membership import CommunityMembership, MembershipStatus
from app.models.hashtag import Hashtag, MemeHashtag
from app.models.meme import Meme
from app.models.notification import NotificationType
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
    DuelCreate,
    OpenChallengeCreate,
    OpenChallengeSideSetup,
)
from app.services import friends as friends_service
from app.services import notifications as notifications_service
from app.services.communities import require_active_membership
from app.services.hashtags import get_or_create_hashtag
from app.services.memes import build_meme_out, stage_community_meme, stage_personal_meme
from app.services.scoring import meme_score_expr

WINNER_POINTS = 100

# Cold-start weekly platform challenge (Roadmap §3.3) — a seeded system account, never a
# real login (unguessable random password), so a brand-new user's Compete tab is never
# empty. See create_weekly_open_challenge / _get_or_create_platform_user.
PLATFORM_USERNAME = "memeversehq"
PLATFORM_EMAIL = "platform@memeverse.internal"
WEEKLY_CHALLENGE_SIDE_NAMES = ("Team Alpha", "Team Beta")
WEEKLY_CHALLENGE_DURATION_DAYS = 7

# Anti-gaming tunables for `_side_scores` — see its docstring for why each exists. Kept as
# module constants like the [[scoring-engine]] atom's own tunables, so they're one edit to
# retune once there's real data rather than magic numbers inline.
MAX_COUNTED_PER_USER = 3


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

    `open` challenges are platform-level and deliberately ungated: the whole point is that
    anyone can find one and join it, so there's no membership to check.
    """
    if challenge.challenge_type == ChallengeType.open:
        return

    if challenge.challenge_type == ChallengeType.duel:
        # Involvement = the two named participants. Checked against creator_id/invitee_id
        # directly (not just ChallengeParticipant) so the invitee can view/accept a pending
        # duel before their participant row exists.
        if user_id in (challenge.creator_id, challenge.invitee_id):
            return
        raise CommunityAccessDeniedError("Only the two duelists can do this")

    community_ids = [cid for cid in (challenge.community_id,) if cid is not None]
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


async def _side_scores(db: AsyncSession, challenge_id: uuid.UUID) -> dict[uuid.UUID, float]:
    """Live per-side totals via the [[scoring-engine]] atom, in one query rather than one
    per side. Sides with no submissions are absent from the result — callers must default
    them to 0.0 (`evaluate_challenge`'s tie detection depends on every side having a score,
    including the all-zero case).

    Two anti-gaming levers are baked in, and they are what make `open` challenges — where
    anyone can join any side — safe to run at all. A plain `SUM` means the side that posts
    the *most* wins regardless of quality, and one prolific account can single-handedly
    decide every challenge. Project_Requirements §7 sets resistance to exactly that
    (brigading, low-effort mass-posting) as the bar.

    1. **Per-user cap** — only a contributor's `MAX_COUNTED_PER_USER` best memes count, so
       flooding stops paying after the third submission.
    2. **Breadth weighting** — the capped total is multiplied by
       `1 + log10(distinct contributors)`, so a side of 20 people each landing one good
       meme beats one person landing three great ones. Log-compressed for the same reason
       the atom itself is: it rewards breadth without letting it run away.

    Applied to every challenge shape, not just `open` — the property should hold whether
    the roster is assigned or self-selected, and one code path is easier to reason about
    than two. With one submission per side (the common community case) neither lever binds:
    the cap doesn't bite and a single contributor's multiplier is exactly 1.
    """
    atom = meme_score_expr()
    ranked = (
        select(
            ChallengeSubmission.side_id.label("side_id"),
            ChallengeSubmission.submitter_id.label("submitter_id"),
            atom.label("score"),
            func.row_number()
            .over(
                partition_by=(ChallengeSubmission.side_id, ChallengeSubmission.submitter_id),
                order_by=atom.desc(),
            )
            .label("rank"),
        )
        .select_from(ChallengeSubmission)
        .join(Meme, Meme.id == ChallengeSubmission.meme_id)
        .where(ChallengeSubmission.challenge_id == challenge_id)
        .subquery()
    )

    result = await db.execute(
        select(
            ranked.c.side_id,
            func.coalesce(func.sum(ranked.c.score), 0),
            func.count(func.distinct(ranked.c.submitter_id)),
        )
        .where(ranked.c.rank <= MAX_COUNTED_PER_USER)
        .group_by(ranked.c.side_id)
    )

    return {
        side_id: float(total or 0) * (1 + math.log10(contributors)) if contributors else 0.0
        for side_id, total, contributors in result.all()
    }


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

    # Live scoreboard: a competitor must be able to see whether their side is winning
    # *during* the window, not only at results time.
    scores = await _side_scores(db, challenge.id)

    participant_counts = dict(
        (
            await db.execute(
                select(ChallengeParticipant.side_id, func.count(ChallengeParticipant.id))
                .where(ChallengeParticipant.challenge_id == challenge.id)
                .group_by(ChallengeParticipant.side_id)
            )
        ).all()
    )

    creator = await db.get(User, challenge.creator_id)
    invitee = (
        await db.get(User, challenge.invitee_id) if challenge.invitee_id is not None else None
    )
    community = (
        await db.get(Community, challenge.community_id)
        if challenge.community_id is not None
        else None
    )
    opponent = (
        await db.get(Community, challenge.opponent_community_id)
        if challenge.opponent_community_id is not None
        else None
    )
    hashtag = (
        await db.get(Hashtag, challenge.hashtag_id) if challenge.hashtag_id is not None else None
    )

    return ChallengeOut(
        id=challenge.id,
        community_id=challenge.community_id,
        community_name=community.name if community else None,
        opponent_community_id=challenge.opponent_community_id,
        opponent_community_name=opponent.name if opponent else None,
        hashtag=hashtag.slug if hashtag else None,
        creator=UserOut.model_validate(creator),
        invitee_id=challenge.invitee_id,
        invitee=UserOut.model_validate(invitee) if invitee else None,
        title=challenge.title,
        challenge_type=challenge.challenge_type,
        status=challenge.status,
        start_time=challenge.start_time,
        end_time=challenge.end_time,
        winning_side_id=challenge.winning_side_id,
        sides=[
            ChallengeSideOut(
                id=side.id,
                name=side.name,
                community_id=side.community_id,
                # An open challenge's roster is unbounded — send the count, not thousands
                # of ids. Community shapes keep the explicit roster the UI already uses.
                member_ids=(
                    []
                    if challenge.challenge_type == ChallengeType.open
                    else side_member_ids.get(side.id, [])
                ),
                participant_count=participant_counts.get(side.id, 0),
                score=scores.get(side.id, 0.0),
            )
            for side in challenge.sides
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

    if all_member_ids:
        await notifications_service.notify_many(
            db,
            set(all_member_ids),
            NotificationType.challenge_starting,
            title=f"{challenge.title} has started",
            body="You've been placed on a side — get your first submission in.",
            data={"challenge_id": str(challenge.id)},
        )

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

    await notifications_service.notify_one(
        db,
        opponent.owner_id,
        NotificationType.challenge_invite,
        title=f"{community.name} challenged {opponent.name}",
        body=f'"{challenge.title}" is awaiting your response.',
        data={"challenge_id": str(challenge.id)},
    )

    return await _build_challenge_out(db, challenge)


async def create_open_challenge(
    db: AsyncSession, current_user: User, payload: OpenChallengeCreate
) -> ChallengeOut:
    """A platform-level challenge anyone can create and anyone can join.

    This is the shape that lifts challenges out of communities entirely — previously only a
    community *owner* could start one, so a regular user could never challenge anyone. No
    membership, no roster: sides are named at setup and filled by self-service `join`.

    The challenge reserves its hashtag exclusively (unique FK), so posting with that tag is
    an unambiguous entry into exactly one competition.
    """
    if payload.end_time <= payload.start_time:
        raise ChallengeSetupInvalidError("end_time must be after start_time")

    names = [side.name.strip() for side in payload.sides]
    if len(set(names)) != len(names):
        raise ChallengeSetupInvalidError("Every side needs a distinct name")

    hashtag = await get_or_create_hashtag(db, payload.hashtag)
    already_reserved = await db.scalar(
        select(exists().where(Challenge.hashtag_id == hashtag.id))
    )
    if already_reserved:
        raise HashtagAlreadyReservedError(
            f"#{hashtag.slug} is already the entry tag for another challenge"
        )

    challenge = Challenge(
        creator_id=current_user.id,
        title=payload.title,
        challenge_type=ChallengeType.open,
        status=ChallengeStatus.active,
        start_time=payload.start_time,
        end_time=payload.end_time,
        hashtag_id=hashtag.id,
    )
    db.add(challenge)
    await db.flush()

    for side_setup in payload.sides:
        db.add(ChallengeSide(challenge_id=challenge.id, name=side_setup.name))

    try:
        await db.commit()
    except IntegrityError:
        # Two creators reserving the same tag at once — the unique FK is the real gate,
        # the check above is just the friendly path.
        await db.rollback()
        raise HashtagAlreadyReservedError(
            f"#{hashtag.slug} is already the entry tag for another challenge"
        ) from None

    await db.refresh(challenge)
    return await _build_challenge_out(db, challenge)


async def join_open_challenge(
    db: AsyncSession, current_user: User, challenge_id: uuid.UUID, side_id: uuid.UUID
) -> ChallengeOut:
    """Self-service side pick — the `open` shape's answer to the owner-assigned roster.
    Deliberately allowed for the whole active window, not just before it starts: an open
    challenge you can't join after seeing it is one nobody joins.
    """
    challenge = await _get_challenge_or_404(db, challenge_id)
    if challenge.challenge_type != ChallengeType.open:
        raise ChallengeNotOpenError("Only open challenges can be joined directly")
    _require_open_window(challenge)

    side = await db.get(ChallengeSide, side_id)
    if side is None or side.challenge_id != challenge.id:
        raise ChallengeSetupInvalidError("That side doesn't belong to this challenge")

    existing = await db.scalar(
        select(ChallengeParticipant.side_id).where(
            ChallengeParticipant.challenge_id == challenge.id,
            ChallengeParticipant.user_id == current_user.id,
        )
    )
    if existing is not None:
        # Switching sides mid-challenge would let someone follow the winner, so a pick is
        # final for the duration.
        raise AlreadyJoinedChallengeError("You've already picked a side in this challenge")

    db.add(
        ChallengeParticipant(challenge_id=challenge.id, side_id=side.id, user_id=current_user.id)
    )
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise AlreadyJoinedChallengeError("You've already picked a side in this challenge") from None

    await db.refresh(challenge)
    return await _build_challenge_out(db, challenge)


async def list_open_challenges(db: AsyncSession, current_user: User) -> list[ChallengeOut]:
    """Discovery for the Compete tab's "open to join" section — every live open challenge,
    soonest deadline first. No membership gate: that's what makes them open."""
    result = await db.execute(
        select(Challenge)
        .where(
            Challenge.challenge_type == ChallengeType.open,
            Challenge.status == ChallengeStatus.active,
        )
        .order_by(Challenge.end_time.asc())
    )
    return [await _build_challenge_out(db, challenge) for challenge in result.scalars().all()]


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
    proposer_id = challenge.creator_id
    challenge.status = ChallengeStatus.active
    await db.commit()
    await db.refresh(challenge)

    await notifications_service.notify_one(
        db,
        proposer_id,
        NotificationType.challenge_invite_accepted,
        title=f"{challenge.title} was accepted",
        body="The challenge is now active — good luck.",
        data={"challenge_id": str(challenge.id)},
    )
    participant_ids = await challenge_participant_user_ids(db, challenge)
    if participant_ids:
        await notifications_service.notify_many(
            db,
            participant_ids,
            NotificationType.challenge_starting,
            title=f"{challenge.title} has started",
            body="Submit a meme for your community's side.",
            data={"challenge_id": str(challenge.id)},
        )

    return await _build_challenge_out(db, challenge)


async def decline_challenge(db: AsyncSession, current_user: User, challenge_id: uuid.UUID) -> None:
    challenge = await _get_pending_proposal_for_opponent_owner(db, current_user, challenge_id)
    proposer_id = challenge.creator_id
    title = challenge.title
    challenge_id_str = str(challenge.id)
    await db.execute(
        ChallengeSide.__table__.delete().where(ChallengeSide.challenge_id == challenge.id)
    )
    await db.delete(challenge)
    await db.commit()

    await notifications_service.notify_one(
        db,
        proposer_id,
        NotificationType.challenge_invite_declined,
        title=f"{title} was declined",
        body="The challenged community's owner declined this proposal.",
        data={"challenge_id": challenge_id_str},
    )


async def propose_duel(
    db: AsyncSession, current_user: User, opponent_id: uuid.UUID, payload: DuelCreate
) -> ChallengeOut:
    """A 1v1 friend challenge — no community, no roster assignment beyond the two named
    players. Reuses the `intra_community`-shaped participant-roster scoring/submission/
    evaluation path (see module docstring); the only new behaviour is this propose/accept/
    decline flow, gated on `invitee_id` rather than a community owner.
    """
    if opponent_id == current_user.id:
        raise CannotDuelSelfError("You can't duel yourself")
    if not await friends_service.are_friends(db, current_user.id, opponent_id):
        raise NotFriendsError("You can only duel accepted friends")
    if payload.end_time <= payload.start_time:
        raise ChallengeSetupInvalidError("end_time must be after start_time")

    opponent = await db.get(User, opponent_id)
    if opponent is None:
        raise ChallengeNotFoundError("User not found")

    challenge = Challenge(
        creator_id=current_user.id,
        invitee_id=opponent_id,
        title=payload.title,
        challenge_type=ChallengeType.duel,
        status=ChallengeStatus.setup,
        start_time=payload.start_time,
        end_time=payload.end_time,
    )
    db.add(challenge)
    await db.flush()

    creator_side = ChallengeSide(challenge_id=challenge.id, name=current_user.username)
    db.add(creator_side)
    db.add(ChallengeSide(challenge_id=challenge.id, name=opponent.username))
    await db.flush()
    db.add(
        ChallengeParticipant(
            challenge_id=challenge.id, side_id=creator_side.id, user_id=current_user.id
        )
    )

    await db.commit()
    await db.refresh(challenge)

    await notifications_service.notify_one(
        db,
        opponent_id,
        NotificationType.challenge_invite,
        title=f"{current_user.username} challenged you to a duel",
        body=f'"{challenge.title}" is awaiting your response.',
        data={"challenge_id": str(challenge.id)},
    )

    return await _build_challenge_out(db, challenge)


async def _get_pending_duel_for_invitee(
    db: AsyncSession, current_user: User, challenge_id: uuid.UUID
) -> Challenge:
    challenge = await _get_challenge_or_404(db, challenge_id)
    if challenge.challenge_type != ChallengeType.duel:
        raise ChallengeNotFoundError("This challenge has no pending invite")
    if challenge.status != ChallengeStatus.setup:
        raise ChallengeNotPendingError("This duel is no longer awaiting a response")
    if challenge.invitee_id != current_user.id:
        raise NotChallengeInviteeError("Only the challenged friend can respond to this duel")
    return challenge


async def accept_duel(db: AsyncSession, current_user: User, challenge_id: uuid.UUID) -> ChallengeOut:
    challenge = await _get_pending_duel_for_invitee(db, current_user, challenge_id)

    invitee_side = (
        await db.execute(
            select(ChallengeSide)
            .where(ChallengeSide.challenge_id == challenge.id)
            .order_by(ChallengeSide.created_at)
        )
    ).scalars().all()[1]
    db.add(
        ChallengeParticipant(
            challenge_id=challenge.id, side_id=invitee_side.id, user_id=current_user.id
        )
    )
    challenge.status = ChallengeStatus.active
    await db.commit()
    await db.refresh(challenge)

    await notifications_service.notify_one(
        db,
        challenge.creator_id,
        NotificationType.challenge_invite_accepted,
        title=f"{current_user.username} accepted your duel",
        body=f'"{challenge.title}" is on — submit your first meme.',
        data={"challenge_id": str(challenge.id)},
    )
    await notifications_service.notify_one(
        db,
        current_user.id,
        NotificationType.challenge_starting,
        title=f"Your duel \"{challenge.title}\" has started",
        body="Submit a meme to get on the board.",
        data={"challenge_id": str(challenge.id)},
    )

    return await _build_challenge_out(db, challenge)


async def decline_duel(db: AsyncSession, current_user: User, challenge_id: uuid.UUID) -> None:
    challenge = await _get_pending_duel_for_invitee(db, current_user, challenge_id)
    creator_id = challenge.creator_id
    title = challenge.title
    challenge_id_str = str(challenge.id)
    await db.execute(
        ChallengeSide.__table__.delete().where(ChallengeSide.challenge_id == challenge.id)
    )
    await db.delete(challenge)
    await db.commit()

    await notifications_service.notify_one(
        db,
        creator_id,
        NotificationType.challenge_invite_declined,
        title=f"{current_user.username} declined your duel",
        body=f'"{title}" was declined.',
        data={"challenge_id": challenge_id_str},
    )


async def challenge_participant_user_ids(db: AsyncSession, challenge: Challenge) -> set[uuid.UUID]:
    """Every user who should hear about this challenge's lifecycle events. Mirrors the same
    branch `evaluate_challenge` uses for badge winners: a `community_vs_community` side has
    no roster (every active member of its community is implicitly eligible), every other
    shape has an explicit `ChallengeParticipant` roster. For a pending duel, the invitee is
    included even before they've accepted (no participant row yet), so they still get the
    invite notification.
    """
    if challenge.challenge_type == ChallengeType.community_vs_community:
        community_ids = [cid for cid in (challenge.community_id, challenge.opponent_community_id) if cid]
        result = await db.execute(
            select(CommunityMembership.user_id).where(
                CommunityMembership.community_id.in_(community_ids),
                CommunityMembership.status == MembershipStatus.active,
            )
        )
        return set(result.scalars().all())

    result = await db.execute(
        select(ChallengeParticipant.user_id).where(ChallengeParticipant.challenge_id == challenge.id)
    )
    user_ids = set(result.scalars().all())
    if challenge.challenge_type == ChallengeType.duel and challenge.invitee_id is not None:
        user_ids.add(challenge.invitee_id)
    return user_ids


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


def _require_open_window(challenge: Challenge) -> None:
    """Client-side timing is never trusted — `status` and `end_time` are both re-checked
    server-side on every submission path."""
    if challenge.status != ChallengeStatus.active:
        raise ChallengeNotActiveError("This challenge isn't accepting submissions")
    if datetime.datetime.now(datetime.timezone.utc) >= challenge.end_time:
        raise ChallengeWindowClosedError("The submission window for this challenge has closed")


async def _resolve_caller_side(
    db: AsyncSession, challenge: Challenge, user_id: uuid.UUID
) -> ChallengeSide:
    """Which side the caller submits for — an assigned roster slot for `intra_community`,
    or derived live from community membership for `community_vs_community`."""
    if challenge.challenge_type == ChallengeType.community_vs_community:
        return await _get_caller_side_vs_community(db, challenge, user_id)

    side_id = await _get_caller_side_intra_community(db, challenge.id, user_id)
    return (
        await db.execute(select(ChallengeSide).where(ChallengeSide.id == side_id))
    ).scalar_one()


def _submission_target_community_id(
    challenge: Challenge, side: ChallengeSide
) -> uuid.UUID | None:
    """Which community a challenge meme is posted into. For `community_vs_community` that's
    the caller's own side-community (its `community` audience row is what feeds the global
    community leaderboard, see `submit_to_challenge`); for `intra_community` both sides live
    in the one host community. `None` for `open` challenges, which have no community — their
    entries are public personal posts carrying the challenge's hashtag instead.
    """
    return side.community_id if side.community_id is not None else challenge.community_id


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
    _require_open_window(challenge)

    side = await _resolve_caller_side(db, challenge, current_user.id)
    side_id = side.id

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
    try:
        await db.commit()
    except IntegrityError:
        # Two concurrent submit calls for the same meme both passed the check above.
        await db.rollback()
        raise MemeNotEligibleForChallengeError(
            "This meme was already submitted to this challenge"
        ) from None
    await db.refresh(submission)

    submitter = await db.get(User, current_user.id)

    return ChallengeSubmissionOut(
        id=submission.id,
        side_id=side_id,
        submitter=UserOut.model_validate(submitter),
        meme=build_meme_out(
            submission.meme, upvote_count=0, downvote_count=0, comment_count=0, viewer_vote=None
        ),
        created_at=submission.created_at,
    )


async def create_and_submit_to_challenge(
    db: AsyncSession,
    current_user: User,
    challenge_id: uuid.UUID,
    caption: str | None,
    image: UploadFile,
) -> ChallengeSubmissionOut:
    """Create a meme **and** enter it into a challenge in one transaction.

    This is the guided path behind the creator's "competing in X" banner. Previously a user
    had to post a meme into the community, navigate to the challenge, find their meme and
    submit it — seven steps across three screens, with nothing in the creator hinting the
    challenge existed. Doing it as two client calls instead would strand memes in a
    "posted but not submitted" state whenever the second call failed, which is the same
    confusing half-state, just automated.

    No "already submitted" check is needed here: the meme is created by this call, so it
    cannot already belong to a submission.
    """
    challenge = await _get_challenge_or_404(db, challenge_id)
    _require_open_window(challenge)

    side = await _resolve_caller_side(db, challenge, current_user.id)
    target_community_id = _submission_target_community_id(challenge, side)

    if target_community_id is None:
        # Open challenge: no community to post into, so the entry is a public personal post
        # carrying the challenge's reserved tag — which is also what makes it show up in
        # that tag's feed alongside everyone else's entries.
        meme = await stage_personal_meme(
            db, current_user.id, caption, {AudienceType.public}, image
        )
        if challenge.hashtag_id is not None:
            # Attached by id rather than via `challenge.hashtag.slug`: `_get_challenge_or_404`
            # goes through `db.get`, which returns an identity-mapped object whose eager
            # relationships may not have been loaded on this path.
            db.add(MemeHashtag(meme_id=meme.id, hashtag_id=challenge.hashtag_id))
    else:
        # Membership (and the community's privacy, which decides whether the post also goes
        # public) is resolved *before* the Cloudinary upload, so a rejected submission never
        # wastes an upload — same ordering as `create_community_meme`.
        community = await require_active_membership(db, target_community_id, current_user.id)
        meme = await stage_community_meme(db, community, current_user.id, caption, image)

    submission = ChallengeSubmission(
        challenge_id=challenge.id,
        side_id=side.id,
        submitter_id=current_user.id,
        meme_id=meme.id,
    )
    db.add(submission)

    await db.commit()
    await db.refresh(submission)
    await db.refresh(meme)

    return ChallengeSubmissionOut(
        id=submission.id,
        side_id=side.id,
        submitter=UserOut.model_validate(current_user),
        meme=build_meme_out(
            meme,
            upvote_count=0,
            downvote_count=0,
            comment_count=0,
            viewer_vote=None,
            viewer_id=current_user.id,
        ),
        created_at=submission.created_at,
    )


async def list_my_challenges(db: AsyncSession, current_user: User) -> list[ChallengeOut]:
    """Every challenge the caller can see, across all of their communities — the
    cross-community surface behind the Compete tab. Without this a user in three communities
    had no single place to see what they were competing in or when it ended; challenges were
    only reachable by opening each community and its Challenges tab in turn.

    Gated by active membership in the home *or* opponent community, matching
    `_require_involved_member`, so everything listed is also individually viewable.
    """
    my_community_ids = (
        select(CommunityMembership.community_id)
        .where(
            CommunityMembership.user_id == current_user.id,
            CommunityMembership.status == MembershipStatus.active,
        )
        .scalar_subquery()
    )

    # Live challenges first, then pending proposals, then history. Within a group: soonest
    # deadline first while it's still running (that's the urgent one), most recent first once
    # it's over — hence negating the epoch for evaluated rows so one ascending sort does both.
    status_rank = case(
        (Challenge.status == ChallengeStatus.active, 0),
        (Challenge.status == ChallengeStatus.setup, 1),
        else_=2,
    )
    end_time_epoch = func.extract("epoch", Challenge.end_time)
    sort_time = case(
        (Challenge.status == ChallengeStatus.evaluated, -end_time_epoch), else_=end_time_epoch
    )

    # Open challenges have no community — the caller is "in" one by having picked a side.
    joined_open = select(ChallengeParticipant.challenge_id).where(
        ChallengeParticipant.user_id == current_user.id
    )

    result = await db.execute(
        select(Challenge)
        .where(
            or_(
                Challenge.community_id.in_(my_community_ids),
                Challenge.opponent_community_id.in_(my_community_ids),
                Challenge.id.in_(joined_open),
            )
        )
        .order_by(status_rank, sort_time)
    )
    return [await _build_challenge_out(db, challenge) for challenge in result.scalars().all()]


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

    # Sides with zero submissions are absent from the grouped query — default them to 0.0,
    # or the all-zero tie below (nobody submitted anything) wouldn't be detected.
    scored = await _side_scores(db, challenge_id)
    scores = {side.id: scored.get(side.id, 0.0) for side in sides}
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

    all_participant_ids = await challenge_participant_user_ids(db, challenge)
    winner_id_set = set(winner_ids) if winning_side_id is not None else set()
    loser_ids = all_participant_ids - winner_id_set
    if winner_id_set:
        await notifications_service.notify_many(
            db,
            winner_id_set,
            NotificationType.challenge_results,
            title=f"You won {challenge.title}!",
            body="Your side came out on top — check your badge.",
            data={"challenge_id": str(challenge.id)},
        )
    if loser_ids:
        await notifications_service.notify_many(
            db,
            loser_ids,
            NotificationType.challenge_results,
            title=f"{challenge.title} has ended",
            body="Results are in — see how you did.",
            data={"challenge_id": str(challenge.id)},
        )

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
                    submission.meme,
                    upvote_count=0,
                    downvote_count=0,
                    comment_count=0,
                    viewer_vote=None,
                ),
                created_at=submission.created_at,
            )
        )

    return ChallengeResultsOut(
        challenge=await _build_challenge_out(db, challenge), submissions=submissions
    )


async def _get_or_create_platform_user(db: AsyncSession) -> User:
    user = await db.scalar(select(User).where(User.username == PLATFORM_USERNAME))
    if user is not None:
        return user

    user = User(
        email=PLATFORM_EMAIL,
        username=PLATFORM_USERNAME,
        # Unguessable random password — this account is never meant to log in, it only
        # exists as a `creator_id` for platform-run challenges.
        hashed_password=hash_password(uuid.uuid4().hex),
        bio="Official MemeVerse account — runs the weekly platform challenge.",
    )
    db.add(user)
    try:
        await db.commit()
    except IntegrityError:
        # A concurrent cron run (or a real user, vanishingly unlikely) raced to create the
        # same username — re-read the winner's row rather than failing.
        await db.rollback()
        user = await db.scalar(select(User).where(User.username == PLATFORM_USERNAME))
        if user is None:
            raise
        return user

    await db.refresh(user)
    return user


async def create_weekly_open_challenge(db: AsyncSession) -> bool:
    """Platform-run weekly open challenge (Roadmap §3.3, "cold start") — a new user with no
    community and nobody to duel would otherwise find the Compete tab empty. Idempotent for
    free: the hashtag slug is deterministic per ISO week, and `create_open_challenge`
    already turns a duplicate reservation into `HashtagAlreadyReservedError`, so re-running
    this within the same week is a harmless no-op rather than needing its own "already ran"
    flag. Returns whether a new challenge was actually created.
    """
    platform_user = await _get_or_create_platform_user(db)
    now = datetime.datetime.now(datetime.timezone.utc)
    iso_year, iso_week, _ = now.isocalendar()

    payload = OpenChallengeCreate(
        title=f"Weekly Meme Showdown — Week {iso_week}",
        hashtag=f"weekly{iso_year}w{iso_week:02d}",
        start_time=now,
        end_time=now + datetime.timedelta(days=WEEKLY_CHALLENGE_DURATION_DAYS),
        sides=[OpenChallengeSideSetup(name=name) for name in WEEKLY_CHALLENGE_SIDE_NAMES],
    )
    try:
        await create_open_challenge(db, platform_user, payload)
    except HashtagAlreadyReservedError:
        return False
    return True
