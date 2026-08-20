from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError

from app.core.logging import log_security_event


class DomainError(Exception):
    status_code = status.HTTP_400_BAD_REQUEST

    def __init__(self, message: str):
        self.message = message
        super().__init__(message)


class EmailAlreadyExistsError(DomainError):
    status_code = status.HTTP_409_CONFLICT


class UsernameAlreadyExistsError(DomainError):
    status_code = status.HTTP_409_CONFLICT


class InvalidCredentialsError(DomainError):
    status_code = status.HTTP_401_UNAUTHORIZED


class UserNotFoundError(DomainError):
    status_code = status.HTTP_404_NOT_FOUND


class CannotFriendSelfError(DomainError):
    status_code = status.HTTP_400_BAD_REQUEST


class FriendshipAlreadyExistsError(DomainError):
    status_code = status.HTTP_409_CONFLICT


class FriendshipNotFoundError(DomainError):
    status_code = status.HTTP_404_NOT_FOUND


class NotFriendshipParticipantError(DomainError):
    status_code = status.HTTP_403_FORBIDDEN


class FriendshipNotPendingError(DomainError):
    status_code = status.HTTP_409_CONFLICT


class UnsupportedMediaTypeError(DomainError):
    status_code = status.HTTP_400_BAD_REQUEST


class EmptyUploadError(DomainError):
    status_code = status.HTTP_400_BAD_REQUEST


class MediaTooLargeError(DomainError):
    status_code = status.HTTP_400_BAD_REQUEST


class MediaUploadFailedError(DomainError):
    status_code = status.HTTP_502_BAD_GATEWAY


class MemeNotFoundError(DomainError):
    status_code = status.HTTP_404_NOT_FOUND


class NotMemeAuthorError(DomainError):
    status_code = status.HTTP_403_FORBIDDEN


class CommentNotFoundError(DomainError):
    status_code = status.HTTP_404_NOT_FOUND


class NotCommentAuthorError(DomainError):
    status_code = status.HTTP_403_FORBIDDEN


class InvalidCursorError(DomainError):
    status_code = status.HTTP_400_BAD_REQUEST


class InvalidVoteValueError(DomainError):
    status_code = status.HTTP_400_BAD_REQUEST


class CommunityNotFoundError(DomainError):
    status_code = status.HTTP_404_NOT_FOUND


class NotCommunityOwnerError(DomainError):
    status_code = status.HTTP_403_FORBIDDEN


class CommunityAccessDeniedError(DomainError):
    status_code = status.HTTP_403_FORBIDDEN


class AlreadyMemberOrRequestedError(DomainError):
    status_code = status.HTTP_409_CONFLICT


class CommunityMembershipNotFoundError(DomainError):
    status_code = status.HTTP_404_NOT_FOUND


class CannotLeaveAsOwnerError(DomainError):
    status_code = status.HTTP_400_BAD_REQUEST


class InvalidAudienceSelectionError(DomainError):
    status_code = status.HTTP_400_BAD_REQUEST


class InvalidPeriodError(DomainError):
    status_code = status.HTTP_400_BAD_REQUEST


class ChallengeNotFoundError(DomainError):
    status_code = status.HTTP_404_NOT_FOUND


class ChallengeSetupInvalidError(DomainError):
    status_code = status.HTTP_400_BAD_REQUEST


class ChallengeNotActiveError(DomainError):
    status_code = status.HTTP_400_BAD_REQUEST


class ChallengeWindowClosedError(DomainError):
    status_code = status.HTTP_400_BAD_REQUEST


class NotChallengeParticipantError(DomainError):
    status_code = status.HTTP_403_FORBIDDEN


class ChallengeNotEvaluatedError(DomainError):
    status_code = status.HTTP_400_BAD_REQUEST


class MemeNotEligibleForChallengeError(DomainError):
    status_code = status.HTTP_400_BAD_REQUEST


class HashtagInvalidError(DomainError):
    status_code = status.HTTP_400_BAD_REQUEST


class HashtagNotFoundError(DomainError):
    status_code = status.HTTP_404_NOT_FOUND


class HashtagAlreadyReservedError(DomainError):
    """A challenge already owns this tag — reserving it twice would make entry ambiguous."""

    status_code = status.HTTP_409_CONFLICT


class ChallengeNotOpenError(DomainError):
    """Self-service join/leave only applies to `open` challenges; the community shapes
    assign sides via the owner or via membership."""

    status_code = status.HTTP_400_BAD_REQUEST


class AlreadyJoinedChallengeError(DomainError):
    status_code = status.HTTP_400_BAD_REQUEST


class ChallengeNotPendingError(DomainError):
    status_code = status.HTTP_400_BAD_REQUEST


class CannotChallengeSameCommunityError(DomainError):
    status_code = status.HTTP_400_BAD_REQUEST


class NotChallengeOpponentOwnerError(DomainError):
    status_code = status.HTTP_403_FORBIDDEN


class CannotDuelSelfError(DomainError):
    status_code = status.HTTP_400_BAD_REQUEST


class NotChallengeInviteeError(DomainError):
    """Only the challenged friend can accept/decline a pending duel."""

    status_code = status.HTTP_403_FORBIDDEN


class NotFriendsError(DomainError):
    status_code = status.HTTP_403_FORBIDDEN


class CannotBlockSelfError(DomainError):
    status_code = status.HTTP_400_BAD_REQUEST


class BlockNotFoundError(DomainError):
    status_code = status.HTTP_404_NOT_FOUND


class UnderMinimumAgeError(DomainError):
    """Registration rejected outright for an under-13 signup (SecurityFeatures.md F-13)
    — no row is ever created, so there is nothing to delete or retain afterward."""

    status_code = status.HTTP_400_BAD_REQUEST


class UserBlockedError(DomainError):
    """A block exists between the two users (either direction). Message text is
    deliberately generic ("can't send this request") rather than confirming a block
    exists — telling a harasser specifically that they've been blocked can itself invite
    retaliation, so this fails the same way a request to a nonexistent flow would."""

    status_code = status.HTTP_403_FORBIDDEN


class ConversationNotFoundError(DomainError):
    status_code = status.HTTP_404_NOT_FOUND


class NotConversationParticipantError(DomainError):
    status_code = status.HTTP_403_FORBIDDEN


class CaptionGenerationFailedError(DomainError):
    status_code = status.HTTP_502_BAD_GATEWAY


class MemeContainerNotFoundError(DomainError):
    status_code = status.HTTP_404_NOT_FOUND


class InvalidSourceUrlError(DomainError):
    status_code = status.HTTP_400_BAD_REQUEST


class NotificationNotFoundError(DomainError):
    status_code = status.HTTP_404_NOT_FOUND


class EmailNotVerifiedError(DomainError):
    """The action requires a verified email — see SecurityFeatures.md F-1. Deliberately
    never raised by login/registration itself, only by the specific capabilities gated
    on verification (AI captions, voting, starting a new DM, creating a community)."""

    status_code = status.HTTP_403_FORBIDDEN


class EmailAlreadyVerifiedError(DomainError):
    status_code = status.HTTP_409_CONFLICT


class NoVerificationCodeRequestedError(DomainError):
    status_code = status.HTTP_400_BAD_REQUEST


class InvalidVerificationCodeError(DomainError):
    status_code = status.HTTP_400_BAD_REQUEST


class TooManyVerificationAttemptsError(DomainError):
    status_code = status.HTTP_429_TOO_MANY_REQUESTS


class InvalidGoogleTokenError(DomainError):
    """The Google ID token failed verification (bad signature per Google, wrong
    audience, unverified email, or Google sign-in isn't configured) — see
    SecurityFeatures.md F-7. Never distinguishes *why* in the response message; the
    reason is only in the security log."""

    status_code = status.HTTP_401_UNAUTHORIZED


class InvalidPendingRegistrationError(DomainError):
    """The pending-registration ticket from `POST /auth/google` is missing, expired, or
    already used — the client needs to restart the Google sign-in flow."""

    status_code = status.HTTP_400_BAD_REQUEST


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(DomainError)
    async def _handle_domain_error(request: Request, exc: DomainError) -> JSONResponse:
        if exc.status_code in (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN):
            # Every domain-level auth/authorization rejection, caught at one choke
            # point rather than instrumented per-service (SecurityFeatures.md F-6).
            # Never includes exc.message itself here beyond the error type — it's
            # already returned to the caller; the log's value is the who/where/when.
            log_security_event(
                "security.forbidden",
                status_code=exc.status_code,
                error_type=type(exc).__name__,
                path=request.url.path,
                method=request.method,
                client_ip=request.client.host if request.client else None,
            )
        return JSONResponse(status_code=exc.status_code, content={"detail": exc.message})

    @app.exception_handler(IntegrityError)
    async def _handle_integrity_error(request: Request, exc: IntegrityError) -> JSONResponse:
        # Safety net for any check-then-insert race that slips past a service-level
        # try/except onto a DB unique/foreign-key constraint — keeps the API's
        # `{detail: "..."}` error contract instead of leaking a raw 500.
        return JSONResponse(
            status_code=status.HTTP_409_CONFLICT,
            content={"detail": "This action conflicts with existing data — it may have already been done"},
        )
