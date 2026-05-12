from pydantic import BaseModel


class ValidationResponse(BaseModel):
    valid: bool
    error: str | None = None