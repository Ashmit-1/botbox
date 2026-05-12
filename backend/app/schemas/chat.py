from enum import Enum
from pydantic import BaseModel, field_validator, model_validator, Field
from app.schemas.model import ModelConfig


class MessageRole(str, Enum):
    SYSTEM = "system"
    USER = "user"
    ASSISTANT = "assistant"


class Message(BaseModel):
    role: MessageRole
    content: str

    @field_validator("content")
    @classmethod
    def content_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Message content must not be empty.")
        return v


class ChatRequest(BaseModel):
    model_config_data: ModelConfig = Field(alias="model_config")
    messages: list[Message]
    context_window: int = Field(default=8000, ge=2000)

    @model_validator(mode="after")
    def validate_messages(self) -> "ChatRequest":
        msgs = self.messages

        if not msgs:
            raise ValueError("At least one message is required.")

        system_messages = [m for m in msgs if m.role == MessageRole.SYSTEM]

        if len(system_messages) > 1:
            raise ValueError("Only one system message is allowed.")

        if system_messages and msgs[0].role != MessageRole.SYSTEM:
            raise ValueError("System message must be the first message.")

        if msgs[-1].role != MessageRole.USER:
            raise ValueError("The last message must be from the user.")

        return self

    model_config = {"populate_by_name": True}