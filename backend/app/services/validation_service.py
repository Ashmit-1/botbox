import httpx
from app.schemas.model import ModelConfig, Provider
from app.schemas.common import ValidationResponse


class ValidationService:

    async def validate(self, model_config: ModelConfig) -> ValidationResponse:
        try:
            if model_config.provider == Provider.OPENAI:
                return await self._validate_openai(model_config)
            elif model_config.provider == Provider.GEMINI:
                return await self._validate_gemini(model_config)
            elif model_config.provider == Provider.OPENAI_COMPATIBLE:
                return await self._validate_openai_compatible(model_config)
            else:
                return ValidationResponse(valid=False, error="Unknown provider.")
        except Exception as e:
            sanitized = self._sanitize(str(e), model_config.api_key)
            return ValidationResponse(valid=False, error=sanitized)

    async def _validate_openai(self, config: ModelConfig) -> ValidationResponse:
        async with httpx.AsyncClient() as client:
            r = await client.get(
                "https://api.openai.com/v1/models",
                headers={"Authorization": f"Bearer {config.api_key}"},
            )
        if r.is_success:
            return ValidationResponse(valid=True)
        return ValidationResponse(valid=False, error=self._sanitize(r.text, config.api_key))

    async def _validate_gemini(self, config: ModelConfig) -> ValidationResponse:
        async with httpx.AsyncClient() as client:
            r = await client.get(
                f"https://generativelanguage.googleapis.com/v1beta/models",
                params={"key": config.api_key},
            )
        if r.is_success:
            return ValidationResponse(valid=True)
        return ValidationResponse(valid=False, error=self._sanitize(r.text, config.api_key))

    async def _validate_openai_compatible(self, config: ModelConfig) -> ValidationResponse:
        if not config.base_url:
            return ValidationResponse(valid=False, error="base_url is required.")
        async with httpx.AsyncClient() as client:
            try:
                r = await client.get(
                    f"{config.base_url.rstrip('/')}/models",
                    headers={"Authorization": f"Bearer {config.api_key}"},
                    timeout=10.0,
                )
                # Any non-error HTTP response is treated as valid
                if not r.is_server_error:
                    return ValidationResponse(valid=True)
                return ValidationResponse(valid=False, error=self._sanitize(r.text, config.api_key))
            except httpx.RequestError as e:
                return ValidationResponse(valid=False, error="Could not reach the provided base_url.")

    def _sanitize(self, text: str, api_key: str) -> str:
        if api_key and api_key in text:
            text = text.replace(api_key, "[REDACTED]")
        return text