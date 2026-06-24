from __future__ import annotations

from pathlib import Path

from copilotkit import LangGraphAGUIAgent
from deepagents import create_deep_agent
from langchain.chat_models import init_chat_model
from langchain.tools import tool
from langgraph.checkpoint.memory import InMemorySaver

from app.config import AgentSettings
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


def _build_model(preset: AgentPreset, settings: AgentSettings):
    provider, model_name = preset.model.split(":", maxsplit=1)
    model_provider = "google_genai" if provider == "google" else provider

    kwargs: dict[str, str] = {}
    if provider == "openai" and settings.openai_api_key:
        kwargs["api_key"] = settings.openai_api_key
    elif provider == "anthropic" and settings.anthropic_api_key:
        kwargs["api_key"] = settings.anthropic_api_key
    elif provider == "google" and settings.google_api_key:
        kwargs["google_api_key"] = settings.google_api_key

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
        checkpointer=InMemorySaver(),
        name=preset.id,
    )


def build_graph_map(settings: AgentSettings) -> dict[str, object]:
    return {preset_id: build_graph(preset, settings) for preset_id, preset in ALL_PRESETS.items()}


def build_langgraph_agents(settings: AgentSettings) -> dict[str, LangGraphAGUIAgent]:
    graph_map = build_graph_map(settings)
    return {
        preset_id: LangGraphAGUIAgent(
            name=preset_id,
            description=ALL_PRESETS[preset_id].label,
            graph=graph,
        )
        for preset_id, graph in graph_map.items()
    }
