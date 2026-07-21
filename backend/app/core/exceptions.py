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


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(DomainError)
    async def _handle_domain_error(request: Request, exc: DomainError) -> JSONResponse:
        return JSONResponse(status_code=exc.status_code, content={"detail": exc.message})
