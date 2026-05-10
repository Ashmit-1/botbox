import json
import logging
from typing import AsyncGenerator

logging.basicConfig(level=logging.INFO)


def _sse_event(event: str, data: dict) -> str:
    """Formats a single SSE event string."""
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


def token_event(content: str) -> str:
    return _sse_event("token", {"content": content})


def metadata_event(
    input_tokens: int | None,
    output_tokens: int | None,
    total_tokens: int | None,
    trim_boundary: int,
    messages_in_context: int,
) -> str:
    logging.info(
        {
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "total_tokens": total_tokens,
            "trim_boundary": trim_boundary,
            "messages_in_context": messages_in_context,
        }
    )
    return _sse_event(
        "metadata",
        {
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "total_tokens": total_tokens,
            "trim_boundary": trim_boundary,
            "messages_in_context": messages_in_context,
        },
    )


def error_event(code: str, message: str) -> str:
    return _sse_event("error", {"code": code, "message": message})


def cancelled_event() -> str:
    return _sse_event("cancelled", {"message": "Generation cancelled."})


def done_event() -> str:
    return _sse_event("done", {})
