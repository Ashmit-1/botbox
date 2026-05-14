from fastapi import Request
from langchain_core.messages import BaseMessage, HumanMessage, AIMessage, SystemMessage

from app.schemas.chat import ChatRequest, Message, MessageRole
from app.core.llm import create_chat_model
from app.core.trimming import trim_and_get_boundary
from app.core.tools import get_tools
from app.core.streaming import (
    token_event, metadata_event, error_event, cancelled_event, done_event
)
from app.core.errors import ErrorCode
from app.core.exceptions import AuthenticationError, ProviderError
from app.core.context import RequestContext
from app.services.agent_factory import create_agent_instance
from typing import AsyncGenerator


_ROLE_MAP = {
    MessageRole.SYSTEM: SystemMessage,
    MessageRole.USER: HumanMessage,
    MessageRole.ASSISTANT: AIMessage,
}

_DEFAULT_SYSTEM = "You are a helpful AI assistant."


class ChatService:

    async def stream(
        self,
        request_data: ChatRequest,
        http_request: Request,
        ctx: RequestContext,
    ) -> AsyncGenerator[str, None]:

        # 1. Build LangChain message list
        messages = self._to_lc_messages(request_data.messages)

        # 2. Inject default system prompt if absent
        if not isinstance(messages[0], SystemMessage):
            messages.insert(0, SystemMessage(content=_DEFAULT_SYSTEM))

        # 3. Trim messages to context window
        trimmed_messages, trim_boundary = trim_and_get_boundary(
            create_chat_model(request_data.model_config_data), 
            messages, 
            request_data.context_window
        )
        messages_in_context = len(trimmed_messages)

        # 4. Build LLM and agent
        try:
            model = create_chat_model(request_data.model_config_data)
            tools = get_tools()
            system_prompt = trimmed_messages[0].content if isinstance(trimmed_messages[0], SystemMessage) else _DEFAULT_SYSTEM
            non_system_messages = [m for m in trimmed_messages if not isinstance(m, SystemMessage)]
            agent = create_agent_instance(model, tools, system_prompt)
        except Exception as e:
            yield error_event(ErrorCode.CONFIGURATION_ERROR, str(e))
            yield done_event()
            return

        # 5. Stream tokens
        input_tokens = None
        output_tokens = None
        total_tokens = None

        try:
            async for event in agent.astream_events(
                {"messages": non_system_messages},
                version="v2",
            ):
                if await http_request.is_disconnected():
                    yield cancelled_event()
                    yield done_event()
                    return

                if event["event"] == "on_chat_model_stream":
                    content = event["data"]["chunk"].content
                    if content:
                        yield token_event(content)

                if event["event"] == "on_chat_model_end":
                    usage = event["data"]["output"].usage_metadata or {}
                    input_tokens = usage.get("input_tokens")
                    output_tokens = usage.get("output_tokens")
                    total_tokens = usage.get("total_tokens")

        except Exception as e:
            sanitized = self._sanitize(str(e), request_data.model_config_data.api_key)
            yield error_event(ErrorCode.PROVIDER_ERROR, sanitized)
            yield done_event()
            return

        # 6. Emit metadata then done
        yield metadata_event(
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            total_tokens=total_tokens,
            trim_boundary=trim_boundary,
            messages_in_context=messages_in_context,
        )
        yield done_event()

    def _to_lc_messages(self, messages: list[Message]) -> list[BaseMessage]:
        return [_ROLE_MAP[m.role](content=m.content) for m in messages]

    def _sanitize(self, text: str, api_key: str) -> str:
        """Remove API key from any error message."""
        if api_key and api_key in text:
            text = text.replace(api_key, "[REDACTED]")
        return text