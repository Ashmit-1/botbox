from langchain.agents import create_agent
from langchain_core.language_models import BaseChatModel
from langchain_core.tools import BaseTool


def create_agent_instance(model: BaseChatModel, tools: list[BaseTool], system_prompt: str):
    return create_agent(
        model=model,
        tools=tools,
        system_prompt=system_prompt,
    )