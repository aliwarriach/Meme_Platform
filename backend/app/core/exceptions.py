from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse


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


class InvalidCursorError(DomainError):
    status_code = status.HTTP_400_BAD_REQUEST


class AlreadyReactedError(DomainError):
    status_code = status.HTTP_409_CONFLICT


class ReactionNotFoundError(DomainError):
    status_code = status.HTTP_404_NOT_FOUND


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


class AlreadyVotedError(DomainError):
    status_code = status.HTTP_409_CONFLICT


class MemeNotVotableError(DomainError):
    status_code = status.HTTP_400_BAD_REQUEST


class SelfVoteNotAllowedError(DomainError):
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


class ChallengeNotPendingError(DomainError):
    status_code = status.HTTP_400_BAD_REQUEST


class CannotChallengeSameCommunityError(DomainError):
    status_code = status.HTTP_400_BAD_REQUEST


class NotChallengeOpponentOwnerError(DomainError):
    status_code = status.HTTP_403_FORBIDDEN


class NotFriendsError(DomainError):
    status_code = status.HTTP_403_FORBIDDEN


class MemeSendNotFoundError(DomainError):
    status_code = status.HTTP_404_NOT_FOUND


class NotMemeSendRecipientError(DomainError):
    status_code = status.HTTP_403_FORBIDDEN


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(DomainError)
    async def _handle_domain_error(request: Request, exc: DomainError) -> JSONResponse:
        return JSONResponse(status_code=exc.status_code, content={"detail": exc.message})
