from enum import Enum
from pydantic import BaseModel, Field


class Provider(str, Enum):
    OPENAI = "openai"
    GEMINI = "gemini"
    OPENAI_COMPATIBLE = "openai_compatible"


class ModelConfig(BaseModel):
    provider: Provider
    model_name: str
    api_key: str
    temperature: float = Field(default=0.7, ge=0.0, le=2.0)
    base_url: str | None = None   # Required only for openai_compatible

    model_config = {"populate_by_name": True}