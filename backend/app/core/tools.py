from langchain_core.tools import BaseTool

# Phase 1: empty registry.
# Phase 2+: register tools here and expose via get_tools().

def get_tools() -> list[BaseTool]:
    return []