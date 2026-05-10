from langchain_core.language_models import BaseChatModel
from langchain_openai import ChatOpenAI
from langchain_google_genai import ChatGoogleGenerativeAI

from app.schemas.model import ModelConfig, Provider
from app.core.exceptions import ConfigurationError


def create_chat_model(model_config: ModelConfig) -> BaseChatModel:
    """
    Returns a LangChain BaseChatModel for the given provider config.
    All provider-specific configuration is done here.
    """
    provider = model_config.provider

    if provider == Provider.OPENAI:
        return ChatOpenAI(
            model=model_config.model_name,
            api_key=model_config.api_key,
            temperature=model_config.temperature,
        )

    elif provider == Provider.GEMINI:
        return ChatGoogleGenerativeAI(
            model=model_config.model_name,
            google_api_key=model_config.api_key,
            temperature=model_config.temperature,
        )

    elif provider == Provider.OPENAI_COMPATIBLE:
        if not model_config.base_url:
            raise ConfigurationError(
                "base_url is required for openai_compatible provider."
            )
        return ChatOpenAI(
            model=model_config.model_name,
            api_key=model_config.api_key,
            base_url=model_config.base_url,
            temperature=model_config.temperature,
        )

    else:
        raise ConfigurationError(f"Unsupported provider: {provider}")