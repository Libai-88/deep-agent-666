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
from app.permissions import PermissionMode, mutable_tool_names
from app.presets import ALL_PRESETS, AgentPreset
from app.provider_registry import (
    ProviderRegistrySnapshot,
    find_default_model_profile,
    find_provider_profile,
    load_provider_registry_from_settings,
)
from app.state import (
    CoordinatorControlState,
    CoordinatorState,
    Delegation,
    WorkbenchEvent,
)
from app.task_profile import infer_task_kind, task_prompt_fragment
from app.tools.documents import inspect_document, read_document
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


def _compose_task_prompt(base_prompt: str, task_kind: str) -> str:
    return f"{base_prompt}\n\nTask profile:\n{task_prompt_fragment(task_kind)}"


def _preset_provider(preset: AgentPreset) -> str:
    return preset.model.split(":", maxsplit=1)[0]


def _provider_api_key(
    settings: AgentSettings,
    provider: str,
    *,
    provider_id: str | None = None,
    registry_snapshot: ProviderRegistrySnapshot | None = None,
) -> str | None:
    if registry_snapshot is not None:
        profile = find_provider_profile(registry_snapshot, provider_id or provider)
        if profile and profile.enabled:
            return profile.api_key

    if provider == "openai":
        return settings.openai_api_key
    if provider == "anthropic":
        return settings.anthropic_api_key
    if provider == "google":
        return settings.google_api_key
    return None


def _resolve_registry_snapshot(
    settings: AgentSettings,
    registry_snapshot: ProviderRegistrySnapshot | None,
) -> ProviderRegistrySnapshot:
    return registry_snapshot or load_provider_registry_from_settings(settings)


def _custom_provider_presets(
    registry_snapshot: ProviderRegistrySnapshot,
) -> dict[str, AgentPreset]:
    presets: dict[str, AgentPreset] = {}
    permission_labels = {
        PermissionMode.READ_ONLY: "Read-only",
        PermissionMode.BALANCED: "Balanced",
        PermissionMode.FULL_ACCESS: "Full access",
    }
    for profile in registry_snapshot.provider_profiles:
        if profile.id in {"openai", "anthropic", "google"}:
            continue
        if not profile.enabled or not profile.api_key_present:
            continue
        if profile.protocol != "openai-compatible":
            continue

        model_profile = find_default_model_profile(registry_snapshot, profile.id)
        if model_profile is None:
            continue

        for permission_mode in PermissionMode:
            preset_id = f"{profile.id}-{permission_mode.value}"
            presets[preset_id] = AgentPreset(
                id=preset_id,
                label=f"{profile.label} / {permission_labels[permission_mode]}",
                model=f"openai:{model_profile.model_name}",
                permission_mode=permission_mode,
                provider_id=profile.id,
            )
    return presets


def available_presets(
    settings: AgentSettings,
    registry_snapshot: ProviderRegistrySnapshot | None = None,
) -> dict[str, AgentPreset]:
    snapshot = _resolve_registry_snapshot(settings, registry_snapshot)
    presets = {
        preset_id: preset
        for preset_id, preset in ALL_PRESETS.items()
        if _provider_api_key(
            settings,
            _preset_provider(preset),
            provider_id=preset.provider_id,
            registry_snapshot=snapshot,
        )
    }
    presets.update(_custom_provider_presets(snapshot))
    return presets


def _build_model(
    preset: AgentPreset,
    settings: AgentSettings,
    registry_snapshot: ProviderRegistrySnapshot | None = None,
):
    provider = _preset_provider(preset)
    model_name = preset.model.split(":", maxsplit=1)[1]
    model_provider = "google_genai" if provider == "google" else provider
    snapshot = _resolve_registry_snapshot(settings, registry_snapshot)
    api_key = _provider_api_key(
        settings,
        provider,
        provider_id=preset.provider_id,
        registry_snapshot=snapshot,
    )
    if api_key is None:
        raise ValueError(f"provider is not configured: {preset.provider_id or provider}")
    kwargs = _build_model_kwargs(
        provider,
        api_key,
        settings,
        provider_id=preset.provider_id,
        registry_snapshot=snapshot,
    )
    return init_chat_model(model=model_name, model_provider=model_provider, **kwargs)


def _build_model_kwargs(
    provider: str,
    api_key: str,
    settings: AgentSettings,
    *,
    provider_id: str | None = None,
    registry_snapshot: ProviderRegistrySnapshot | None = None,
) -> dict[str, str]:
    """Build provider-specific init_chat_model kwargs.

    Extracted to avoid duplication between _build_model and build_v2_coordinator.
    """
    kwargs: dict[str, str] = {"api_key": api_key}
    provider_profile = (
        find_provider_profile(registry_snapshot, provider_id)
        if registry_snapshot is not None and provider_id
        else None
    )

    if provider == "openai":
        base_url = provider_profile.base_url if provider_profile else settings.openai_base_url
        if base_url:
            kwargs["base_url"] = base_url

    elif provider == "anthropic":
        # ChatAnthropic uses anthropic_api_url (full base, SDK appends /v1/messages)
        base_url = provider_profile.base_url if provider_profile else settings.anthropic_base_url
        if base_url:
            kwargs["anthropic_api_url"] = base_url

    elif provider == "google":
        kwargs["google_api_key"] = api_key
        base_url = provider_profile.base_url if provider_profile else settings.google_base_url
        if base_url:
            kwargs["transport"] = "rest"
            kwargs["base_url"] = base_url

    return kwargs


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

    @tool
    def inspect_document_tool(path: str) -> str:
        """Inspect a local document and return metadata plus a bounded excerpt."""
        return inspect_document(workspace_root, path)

    toolset: list[object] = [
        list_workspace_tool,
        search_workspace_tool,
        read_text_file_tool,
        read_document_tool,
        inspect_document_tool,
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
        def run_command_tool(command: str, cwd: str = ".") -> str:
            """Execute a PowerShell command rooted to the workspace."""
            return run_command(workspace_root, command, cwd)

        toolset.append(run_command_tool)

    return toolset


def build_graph(
    preset: AgentPreset,
    settings: AgentSettings,
    registry_snapshot: ProviderRegistrySnapshot | None = None,
) -> object:
    return create_deep_agent(
        model=_build_model(preset, settings, registry_snapshot),
        tools=_toolset_for_preset(settings.workspace_root, preset.permission_mode),
        system_prompt=SYSTEM_PROMPT,
        checkpointer=MemorySaver(),
        name=preset.id,
    )


def build_graph_map(
    settings: AgentSettings,
    registry_snapshot: ProviderRegistrySnapshot | None = None,
) -> dict[str, object]:
    return {
        preset_id: build_graph(preset, settings, registry_snapshot)
        for preset_id, preset in available_presets(settings, registry_snapshot).items()
    }


def build_langgraph_agents(
    settings: AgentSettings,
    registry_snapshot: ProviderRegistrySnapshot | None = None,
) -> dict[str, LangGraphAGUIAgent]:
    """Build V1 agents per preset. Returns LangGraphAGUIAgent-wrapped agents.

    Wrapped agents are compatible with both add_langgraph_fastapi_endpoint
    and CopilotKitRemoteEndpoint.
    """
    graph_map = build_graph_map(settings, registry_snapshot)
    configured_presets = available_presets(settings, registry_snapshot)
    return {
        preset_id: LangGraphAGUIAgent(
            name=preset_id,
            description=configured_presets[preset_id].label,
            graph=graph,
        )
        for preset_id, graph in graph_map.items()
    }


def _build_workbench_event(
    *,
    kind: Literal["delegation", "status", "artifact"],
    status: Literal["running", "completed", "failed", "info"],
    title: str,
    message: str,
    source: Literal["planner", "executor", "reviewer", "tool", "system"],
    artifact_path: str | None = None,
    artifact_kind: Literal["file", "finding", "summary"] | None = None,
) -> WorkbenchEvent:
    return {
        "id": str(uuid.uuid4()),
        "kind": kind,
        "status": status,
        "title": title,
        "message": message,
        "source": source,
        "artifact_path": artifact_path,
        "artifact_kind": artifact_kind,
    }


def _build_delegation_running_command(
    *,
    sub_agent: Literal["planner", "executor", "reviewer"],
    task: str,
    tool_call_id: str,
    task_kind: str,
) -> Command:
    entry: Delegation = {
        "id": str(uuid.uuid4()),
        "sub_agent": sub_agent,
        "task": task,
        "status": "running",
        "result": "",
    }
    control_state: CoordinatorControlState = {
        "status": "running",
        "current_step": f"{sub_agent.title()} running",
        "available_actions": ["stop"],
        "pending_approval": False,
    }
    return Command(
        update={
            "delegations": [entry],
            "workbench_events": [
                _build_workbench_event(
                    kind="delegation",
                    status="running",
                    title=f"{sub_agent.title()} started",
                    message=task,
                    source=sub_agent,
                )
            ],
            "control_state": control_state,
            "task_kind": task_kind,
            "messages": [
                ToolMessage(content="starting...", tool_call_id=tool_call_id)
            ],
        }
    )


def _build_delegation_completed_command(
    *,
    sub_agent: Literal["planner", "executor", "reviewer"],
    task: str,
    status: Literal["running", "completed", "failed"],
    result: str,
    tool_call_id: str,
    task_kind: str,
) -> Command:
    entry: Delegation = {
        "id": str(uuid.uuid4()),
        "sub_agent": sub_agent,
        "task": task,
        "status": status,
        "result": result,
    }
    status_title = "completed" if status == "completed" else "failed"
    if sub_agent == "planner" and status == "completed":
        control_state: CoordinatorControlState = {
            "status": "waiting_approval",
            "current_step": "Planner review",
            "available_actions": ["resume", "edit_plan"],
            "pending_approval": True,
        }
    elif status == "failed":
        control_state = {
            "status": "failed",
            "current_step": f"{sub_agent.title()} failed",
            "available_actions": ["retry"],
            "pending_approval": False,
        }
    elif sub_agent == "reviewer" and status == "completed":
        control_state = {
            "status": "completed",
            "current_step": "Review complete",
            "available_actions": [],
            "pending_approval": False,
        }
    else:
        control_state = {
            "status": "running",
            "current_step": f"{sub_agent.title()} completed",
            "available_actions": ["stop"],
            "pending_approval": False,
        }
    return Command(
        update={
            "delegations": [entry],
            "workbench_events": [
                _build_workbench_event(
                    kind="delegation",
                    status=status,
                    title=f"{sub_agent.title()} {status_title}",
                    message=result if result else task,
                    source=sub_agent,
                    artifact_kind="summary" if sub_agent == "reviewer" and status == "completed" else None,
                )
            ],
            "control_state": control_state,
            "task_kind": task_kind,
            "final_summary": result if status == "completed" else "",
            "messages": [
                ToolMessage(content=result, tool_call_id=tool_call_id)
            ],
        }
    )


def build_v2_coordinator(
    model: str,
    permission_mode: str = "balanced",
    settings: AgentSettings | None = None,
    provider_id: str | None = None,
    registry_snapshot: ProviderRegistrySnapshot | None = None,
):
    """Build a supervisor coordinator that delegates to planner/executor/reviewer sub-agents.

    Uses the official LangGraph supervisor+@tool+Command pattern from CopilotKit's
    subagents.py reference. Each sub-agent is a full create_agent wrapped as a @tool.
    Delegations are appended to shared state for real-time frontend rendering.
    """
    parts = model.split("/", maxsplit=1)
    provider = parts[0]
    model_name = parts[1]

    settings = settings or load_settings()

    model_provider = "google_genai" if provider == "google" else provider
    snapshot = _resolve_registry_snapshot(settings, registry_snapshot)
    api_key = _provider_api_key(
        settings,
        provider,
        provider_id=provider_id,
        registry_snapshot=snapshot,
    )
    if api_key is None:
        raise ValueError(f"provider is not configured: {provider_id or provider}")

    kwargs = _build_model_kwargs(
        provider,
        api_key,
        settings,
        provider_id=provider_id,
        registry_snapshot=snapshot,
    )
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
            "Be concrete and specific. No preamble.\n\n"
            "Respect the task profile passed inside the task text."
        ),
    )

    _executor_agent = create_agent(
        model=llm,
        tools=toolset,
        system_prompt=(
            "You are the executor sub-agent. Given a plan, execute the "
            "steps using file and command tools. Read files before editing. "
            "Report what you did. No preamble.\n\n"
            "Respect the task profile passed inside the task text."
        ),
    )

    _reviewer_agent = create_agent(
        model=llm,
        tools=read_only_tools,
        system_prompt=(
            "You are the reviewer sub-agent. Given a plan and execution "
            "results, verify correctness. Check: (1) all planned files "
            "were modified, (2) changes are correct, (3) no errors. "
            "Provide a pass/fail verdict with evidence. No preamble.\n\n"
            "Respect the task profile passed inside the task text."
        ),
    )

    # ── Invoke helpers ────────────────────────────────────────────────
    def _invoke_sub_agent(agent, task: str) -> str:
        result = agent.invoke({"messages": [HumanMessage(content=task)]})
        messages = result.get("messages", [])
        if not messages:
            return ""
        return str(messages[-1].content)

    def _delegate(
        sub_agent_name: Literal["planner", "executor", "reviewer"],
        agent,
        task: str,
        tool_call_id: str,
    ) -> Command:
        task_kind = infer_task_kind(task)
        enriched_task = (
            f"Task kind: {task_kind}\n"
            f"Task profile: {task_prompt_fragment(task_kind)}\n\n"
            f"Original task:\n{task}"
        )
        try:
            # First emit running status
            running_cmd = _build_delegation_running_command(
                sub_agent=sub_agent_name,
                task=task,
                tool_call_id=tool_call_id,
                task_kind=task_kind,
            )
            _ = running_cmd
            result = _invoke_sub_agent(agent, enriched_task)
            # Then emit completed
            return _build_delegation_completed_command(
                sub_agent=sub_agent_name,
                task=task,
                status="completed",
                result=result,
                tool_call_id=tool_call_id,
                task_kind=task_kind,
            )
        except Exception as exc:
            message = (
                f"sub-agent call failed: {exc.__class__.__name__} "
                f"(see server logs for details)"
            )
            return _build_delegation_completed_command(
                sub_agent=sub_agent_name,
                task=task,
                status="failed",
                result=message,
                tool_call_id=tool_call_id,
                task_kind=task_kind,
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
            "The UI shows the user a live log of every delegation.\n\n"
            "Infer whether the task is engineering, research, or general work. "
            "Bias file/document summarization requests toward research behavior, "
            "and code/test/change requests toward engineering behavior."
        ),
    )
    return coordinator
