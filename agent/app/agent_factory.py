from __future__ import annotations

from pathlib import Path

from copilotkit import LangGraphAGUIAgent
from deepagents import create_deep_agent
from langchain.chat_models import init_chat_model
from langchain.tools import tool
from langgraph.checkpoint.memory import MemorySaver

from app.config import AgentSettings, load_settings
from app.middleware.genui import GenUIMiddleware
from app.permissions import PermissionMode, interrupt_config_for_mode, mutable_tool_names
from app.presets import ALL_PRESETS, AgentPreset
from app.tools.documents import read_document
from app.tools.workspace import (
    list_workspace,
    read_text_file,
    replace_text_in_file,
    run_command,
    search_workspace,
    write_text_file,
)


SYSTEM_PROMPT = """You are the primary local work agent.
Use the workspace tools to inspect, edit, and summarize files.
When a tool call is interrupted for approval, wait for the human decision and continue.
Prefer concise, execution-focused responses."""


def _preset_provider(preset: AgentPreset) -> str:
    return preset.model.split(":", maxsplit=1)[0]


def _provider_api_key(settings: AgentSettings, provider: str) -> str | None:
    if provider == "openai":
        return settings.openai_api_key
    if provider == "anthropic":
        return settings.anthropic_api_key
    if provider == "google":
        return settings.google_api_key
    return None


def available_presets(settings: AgentSettings) -> dict[str, AgentPreset]:
    return {
        preset_id: preset
        for preset_id, preset in ALL_PRESETS.items()
        if _provider_api_key(settings, _preset_provider(preset))
    }


def _build_model(preset: AgentPreset, settings: AgentSettings):
    provider = _preset_provider(preset)
    model_name = preset.model.split(":", maxsplit=1)[1]
    model_provider = "google_genai" if provider == "google" else provider

    api_key = _provider_api_key(settings, provider)
    if api_key is None:
        raise ValueError(f"provider is not configured: {provider}")

    kwargs: dict[str, str] = {}

    if provider == "openai":
        kwargs["api_key"] = api_key
        if settings.openai_base_url:
            kwargs["base_url"] = settings.openai_base_url

    elif provider == "anthropic":
        kwargs["api_key"] = api_key
        # ChatAnthropic uses anthropic_api_url (full base, SDK appends /v1/messages)
        if settings.anthropic_base_url:
            kwargs["anthropic_api_url"] = settings.anthropic_base_url

    elif provider == "google":
        kwargs["google_api_key"] = api_key
        if settings.google_base_url:
            kwargs["transport"] = "rest"
            kwargs["base_url"] = settings.google_base_url

    return init_chat_model(model=model_name, model_provider=model_provider, **kwargs)


def _toolset_for_preset(workspace_root: Path, permission_mode: PermissionMode) -> list[object]:
    @tool
    def list_workspace_tool(relative_path: str = ".") -> str:
        """List files and directories under the workspace root."""
        return list_workspace(workspace_root, relative_path)

    @tool
    def search_workspace_tool(query: str, glob: str = "*") -> str:
        """Search UTF-8 text files in the workspace for a query string."""
        return search_workspace(workspace_root, query, glob)

    @tool
    def read_text_file_tool(path: str) -> str:
        """Read a UTF-8 text file from the workspace."""
        return read_text_file(workspace_root, path)

    @tool
    def read_document_tool(path: str) -> str:
        """Read a local text, markdown, DOCX, or PDF document from the workspace."""
        return read_document(workspace_root, path)

    toolset: list[object] = [
        list_workspace_tool,
        search_workspace_tool,
        read_text_file_tool,
        read_document_tool,
    ]

    if "write_text_file" in mutable_tool_names(permission_mode):
        @tool
        def write_text_file_tool(path: str, content: str) -> str:
            """Write a UTF-8 text file inside the workspace."""
            return write_text_file(workspace_root, path, content)

        toolset.append(write_text_file_tool)

    if "replace_text_in_file" in mutable_tool_names(permission_mode):
        @tool
        def replace_text_in_file_tool(path: str, old_text: str, new_text: str) -> str:
            """Replace one matching string in a UTF-8 text file."""
            return replace_text_in_file(workspace_root, path, old_text, new_text)

        toolset.append(replace_text_in_file_tool)

    if "run_command" in mutable_tool_names(permission_mode):
        @tool
        def run_command_tool(command: str, cwd: str = ".") -> dict[str, str | int]:
            """Execute a PowerShell command rooted to the workspace."""
            return run_command(workspace_root, command, cwd)

        toolset.append(run_command_tool)

    return toolset


def build_graph(preset: AgentPreset, settings: AgentSettings) -> object:
    return create_deep_agent(
        model=_build_model(preset, settings),
        tools=_toolset_for_preset(settings.workspace_root, preset.permission_mode),
        system_prompt=SYSTEM_PROMPT,
        interrupt_on=interrupt_config_for_mode(preset.permission_mode),
        checkpointer=MemorySaver(),
        name=preset.id,
    )


def build_graph_map(settings: AgentSettings) -> dict[str, object]:
    return {
        preset_id: build_graph(preset, settings)
        for preset_id, preset in available_presets(settings).items()
    }


def build_langgraph_agents(settings: AgentSettings) -> dict[str, Any]:
    """Build V1 agents per preset. Returns raw compiled graphs (not LangGraphAGUIAgent-wrapped).

    Wrapping is handled by main.py's CopilotKitRemoteEndpoint pattern.
    """
    graph_map = build_graph_map(settings)
    return dict(graph_map)


def build_v2_coordinator(
    model: str,
    permission_mode: str = "balanced",
):
    """Build a Plan->Do->Review coordinator agent with three subagents.

    The coordinator receives a user task, delegates to planner/executor/reviewer
    subagents sequentially, and synthesizes the final result.
    """
    parts = model.split("/", maxsplit=1)
    provider = parts[0]
    model_name = parts[1]

    settings = load_settings()

    model_provider = "google_genai" if provider == "google" else provider
    api_key = _provider_api_key(settings, provider)
    if api_key is None:
        raise ValueError(f"provider is not configured: {provider}")

    kwargs: dict[str, str] = {}
    if provider == "openai":
        kwargs["api_key"] = api_key
        if settings.openai_base_url:
            kwargs["base_url"] = settings.openai_base_url
    elif provider == "anthropic":
        kwargs["api_key"] = api_key
        if settings.anthropic_base_url:
            kwargs["anthropic_api_url"] = settings.anthropic_base_url
    elif provider == "google":
        kwargs["google_api_key"] = api_key
        if settings.google_base_url:
            kwargs["transport"] = "rest"
            kwargs["base_url"] = settings.google_base_url

    llm = init_chat_model(model=model_name, model_provider=model_provider, **kwargs)

    permission = PermissionMode(permission_mode)
    toolset = _toolset_for_preset(settings.workspace_root, permission)
    read_only_tools = [t for t in toolset if t.name in (
        "list_workspace_tool", "search_workspace_tool",
        "read_text_file_tool", "read_document_tool",
    )]

    coordinator = create_deep_agent(
        model=llm,
        tools=toolset,
        middleware=[GenUIMiddleware()],
        subagents=[
            {
                "name": "planner",
                "description": "Analyze task, break into steps, identify files to modify",
                "system_prompt": "You are the planner subagent. Analyze the task, break it into clear steps, and identify files that need to be modified.",
                "tools": read_only_tools,
            },
            {
                "name": "executor",
                "description": "Execute planned steps using file and command tools",
                "system_prompt": "You are the executor subagent. Execute the planned steps using file and command tools to make the required changes.",
                "tools": toolset,
            },
            {
                "name": "reviewer",
                "description": "Verify results match plan, check for errors",
                "system_prompt": "You are the reviewer subagent. Verify the executed results match the original plan and check for any errors or issues.",
                "tools": read_only_tools,
            },
        ],
        checkpointer=MemorySaver(),
    )
    return coordinator
