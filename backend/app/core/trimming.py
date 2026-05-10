from langchain_core.messages import BaseMessage, SystemMessage
from langchain_core.messages import trim_messages
from langchain_core.language_models import BaseChatModel

def trim_and_get_boundary(
    model : BaseChatModel,
    messages: list[BaseMessage],
    context_window: int,
) -> tuple[list[BaseMessage], int]:
    """
    Trims messages to fit within context_window tokens.

    Returns:
        trimmed_messages: the messages to send to the model
        trim_boundary: count of non-system messages dropped in this pass
    """
    try:
        # Use the approximate token counter for now
        trimmed = trim_messages(
            messages,
            max_tokens=context_window,
            strategy="last",
            token_counter="approximate",
            include_system=True,
            allow_partial=False,
        )
    except Exception:
        # Actual model token counter -> Not used for now, only present as a backup method
        trimmed = trim_messages(
            messages,
            max_tokens=context_window,
            strategy="last",
            token_counter=model,
            include_system=True,
            allow_partial=False,
        )

    original_non_system = [m for m in messages if not isinstance(m, SystemMessage)]

    # Change the return to strip the system message out:
    trimmed_non_system = [m for m in trimmed if not isinstance(m, SystemMessage)]

    trim_boundary = len(original_non_system) - len(trimmed_non_system)

    return trimmed_non_system, trim_boundary  # return only non-system messages
