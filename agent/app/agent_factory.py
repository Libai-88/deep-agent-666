from __future__ import annotations

import uuid
from pathlib import Path
from typing import Literal

from copilotkit import CopilotKitMiddleware, LangGraphAGUIAgent
from deepagents import create_deep_agent
from langchain.agents import create_agent
from langchain.chat_models import init_chat_model
from langchain.tools import ToolRuntime, tool
from langchain_core.messages import HumanMessage, ToolMessage
from langgraph.checkpoint.memory import MemorySaver
from langgraph.types import Command

from app.config import AgentSettings, load_settings
from app.middleware.genui import GenUIMiddleware
from app.permissions import PermissionMode, interrupt_config_for_mode, mutable_tool_names
from app.presets import ALL_PRESETS, AgentPreset
from app.state import CoordinatorState, Delegation
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


def build_langgraph_agents(settings: AgentSettings) -> dict[str, LangGraphAGUIAgent]:
    """Build V1 agents per preset. Returns LangGraphAGUIAgent-wrapped agents.

    Wrapped agents are compatible with both add_langgraph_fastapi_endpoint
    and CopilotKitRemoteEndpoint.
    """
    graph_map = build_graph_map(settings)
    configured_presets = available_presets(settings)
    return {
        preset_id: LangGraphAGUIAgent(
            name=preset_id,
            description=configured_presets[preset_id].label,
            graph=graph,
        )
        for preset_id, graph in graph_map.items()
    }


def build_v2_coordinator(
    model: str,
    permission_mode: str = "balanced",
):
    """Build a supervisor coordinator that delegates to planner/executor/reviewer sub-agents.

    Uses the official LangGraph supervisor+@tool+Command pattern from CopilotKit's
    subagents.py reference. Each sub-agent is a full create_agent wrapped as a @tool.
    Delegations are appended to shared state for real-time frontend rendering.
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

    # ── Shared state ──────────────────────────────────────────────────
    # CoordinatorState and Delegation are defined in app/state.py

    # ── Sub-agents (full create_agent instances) ──────────────────────
    _planner_agent = create_agent(
        model=llm,
        tools=read_only_tools,
        system_prompt=(
            "You are the planner sub-agent. Given a task, produce a "
            "numbered step-by-step plan. Identify files to read or modify. "
            "Be concrete and specific. No preamble."
        ),
    )

    _executor_agent = create_agent(
        model=llm,
        tools=toolset,
        system_prompt=(
            "You are the executor sub-agent. Given a plan, execute the "
            "steps using file and command tools. Read files before editing. "
            "Report what you did. No preamble."
        ),
    )

    _reviewer_agent = create_agent(
        model=llm,
        tools=read_only_tools,
        system_prompt=(
            "You are the reviewer sub-agent. Given a plan and execution "
            "results, verify correctness. Check: (1) all planned files "
            "were modified, (2) changes are correct, (3) no errors. "
            "Provide a pass/fail verdict with evidence. No preamble."
        ),
    )

    # ── Invoke helpers ────────────────────────────────────────────────
    def _invoke_sub_agent(agent, task: str) -> str:
        result = agent.invoke({"messages": [HumanMessage(content=task)]})
        messages = result.get("messages", [])
        if not messages:
            return ""
        return str(messages[-1].content)

    def _delegation_command(
        sub_agent: str,
        task: str,
        status: Literal["completed", "failed"],
        result: str,
        tool_call_id: str,
    ) -> Command:
        entry: Delegation = {
            "id": str(uuid.uuid4()),
            "sub_agent": sub_agent,  # type: ignore[typeddict-item]
            "task": task,
            "status": status,
            "result": result,
        }
        return Command(
            update={
                "delegations": [entry],
                "messages": [
                    ToolMessage(content=result, tool_call_id=tool_call_id)
                ],
            }
        )

    def _delegate(
        sub_agent_name: str,
        agent,
        task: str,
        tool_call_id: str,
    ) -> Command:
        try:
            result = _invoke_sub_agent(agent, task)
            return _delegation_command(
                sub_agent_name, task, "completed", result, tool_call_id
            )
        except Exception as exc:
            message = (
                f"sub-agent call failed: {exc.__class__.__name__} "
                f"(see server logs for details)"
            )
            return _delegation_command(
                sub_agent_name, task, "failed", message, tool_call_id
            )

    # ── Supervisor tools ──────────────────────────────────────────────
    @tool
    def planner_tool(task: str, runtime: ToolRuntime) -> Command:
        """Delegate planning to the planner sub-agent.
        Use for: breaking down tasks, identifying files, creating step-by-step plans."""
        return _delegate("planner", _planner_agent, task, runtime.tool_call_id)

    @tool
    def executor_tool(task: str, runtime: ToolRuntime) -> Command:
        """Delegate execution to the executor sub-agent.
        Use for: making file changes, running commands, implementing the plan."""
        return _delegate("executor", _executor_agent, task, runtime.tool_call_id)

    @tool
    def reviewer_tool(task: str, runtime: ToolRuntime) -> Command:
        """Delegate review to the reviewer sub-agent.
        Use for: verifying results, checking correctness, providing pass/fail verdict."""
        return _delegate("reviewer", _reviewer_agent, task, runtime.tool_call_id)

    # ── Supervisor graph ──────────────────────────────────────────────
    coordinator = create_agent(
        model=llm,
        tools=[planner_tool, executor_tool, reviewer_tool],
        middleware=[CopilotKitMiddleware()],
        state_schema=CoordinatorState,
        checkpointer=MemorySaver(),
        system_prompt=(
            "You are a supervisor agent that coordinates three specialized "
            "sub-agents to produce high-quality results.\n\n"
            "Available sub-agents (call them as tools):\n"
            "  - planner_tool: breaks a task into steps and identifies files.\n"
            "  - executor_tool: executes planned steps using file/command tools.\n"
            "  - reviewer_tool: verifies results match the plan.\n\n"
            "For most user requests, delegate in sequence: "
            "plan -> execute -> review. "
            "Pass relevant context through the `task` argument of each tool. "
            "Keep your own messages short. "
            "The UI shows the user a live log of every delegation."
        ),
    )
    return coordinator
