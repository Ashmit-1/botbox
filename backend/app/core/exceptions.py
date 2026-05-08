from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError

from app.core.errors import ErrorCode
from app.schemas.error import ErrorDetail, ErrorResponse


# --- Custom exception classes ---

class AppBaseException(Exception):
    def __init__(self, code: ErrorCode, message: str):
        self.code = code
        self.message = message
        super().__init__(message)


class AuthenticationError(AppBaseException):
    def __init__(self, message: str = "Authentication failed."):
        super().__init__(ErrorCode.AUTHENTICATION_ERROR, message)


class ProviderError(AppBaseException):
    def __init__(self, message: str = "Provider error."):
        super().__init__(ErrorCode.PROVIDER_ERROR, message)


class ConfigurationError(AppBaseException):
    def __init__(self, message: str = "Configuration error."):
        super().__init__(ErrorCode.CONFIGURATION_ERROR, message)


# --- Handler registration ---

def _error_response(code: str, message: str, status_code: int) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content=ErrorResponse(
            error=ErrorDetail(code=code, message=message)
        ).model_dump(),
    )


def register_exception_handlers(app: FastAPI) -> None:

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError):
        messages = "; ".join(
            str(err["msg"]) for err in exc.errors()
        )
        return _error_response(
            code=ErrorCode.VALIDATION_ERROR,
            message=messages,
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        )

    @app.exception_handler(AppBaseException)
    async def app_exception_handler(request: Request, exc: AppBaseException):
        return _error_response(
            code=exc.code,
            message=exc.message,
            status_code=status.HTTP_200_OK,  # Validation endpoint always 200
        )

    @app.exception_handler(Exception)
    async def generic_exception_handler(request: Request, exc: Exception):
        return _error_response(
            code=ErrorCode.INTERNAL_ERROR,
            message="An unexpected error occurred.",
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )