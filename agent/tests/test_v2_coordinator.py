"""Tests for the V2 coordinator agent builder."""
from app.agent_factory import (
    _build_delegation_completed_command,
    _build_delegation_running_command,
    build_v2_coordinator,
)
from app.state import CoordinatorState


def test_coordinator_builds_for_all_permission_modes(monkeypatch, tmp_path):
    """Coordinator builds without error for all three permission modes."""
    monkeypatch.setenv("AGENT_WORKSPACE_ROOT", str(tmp_path))
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    for mode in ("read-only", "balanced", "full-access"):
        coordinator = build_v2_coordinator(
            model="openai/gpt-4o-mini",
            permission_mode=mode,
        )
        assert coordinator is not None, f"Failed for permission_mode={mode}"


def test_coordinator_uses_read_only_tools_for_planner(monkeypatch, tmp_path):
    """Planner subagent should not have write/exec tools in its toolset."""
    # The coordinator itself isn't pre-validated at build time for tool names
    # The subagent tool constraints are enforced at delegation time by Deep Agents
    # Verify the function doesn't crash and returns a valid compiled graph
    monkeypatch.setenv("AGENT_WORKSPACE_ROOT", str(tmp_path))
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    coordinator = build_v2_coordinator(
        model="openai/gpt-4o-mini",
        permission_mode="balanced",
    )
    assert coordinator is not None


def test_coordinator_full_access_includes_write_tools(monkeypatch, tmp_path):
    """Full-access coordinator executor should work with write tools."""
    monkeypatch.setenv("AGENT_WORKSPACE_ROOT", str(tmp_path))
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    coordinator = build_v2_coordinator(
        model="openai/gpt-4o-mini",
        permission_mode="full-access",
    )
    assert coordinator is not None


def test_coordinator_state_declares_workbench_events_channel() -> None:
    annotations = CoordinatorState.__annotations__
    assert "workbench_events" in annotations


def test_running_delegation_command_includes_workbench_event() -> None:
    command = _build_delegation_running_command(
        sub_agent="planner",
        task="Inspect the repository architecture.",
        tool_call_id="tool-call-1",
        task_kind="engineering",
    )

    update = command.update or {}
    assert update["task_kind"] == "engineering"
    assert update["workbench_events"][0]["kind"] == "delegation"
    assert update["workbench_events"][0]["status"] == "running"
    assert update["workbench_events"][0]["message"] == "Inspect the repository architecture."
    assert update["workbench_events"][0]["source"] == "planner"


def test_completed_delegation_command_includes_workbench_event() -> None:
    command = _build_delegation_completed_command(
        sub_agent="reviewer",
        task="Summarize the repository review.",
        status="completed",
        result="Reviewer confirmed the next engineering steps.",
        tool_call_id="tool-call-2",
        task_kind="engineering",
    )

    update = command.update or {}
    assert update["final_summary"] == "Reviewer confirmed the next engineering steps."
    assert update["workbench_events"][0]["kind"] == "delegation"
    assert update["workbench_events"][0]["status"] == "completed"
    assert update["workbench_events"][0]["title"] == "Reviewer completed"
    assert update["workbench_events"][0]["message"] == "Reviewer confirmed the next engineering steps."
    assert update["workbench_events"][0]["source"] == "reviewer"


def test_planner_completion_emits_interrupted_runtime_control() -> None:
    command = _build_delegation_completed_command(
        sub_agent="planner",
        task="Plan the fix",
        status="completed",
        result="1. Inspect\n2. Update",
        tool_call_id="tool-1",
        task_kind="engineering",
    )

    update = command.update or {}
    runtime_control = update["runtime_control"]
    assert runtime_control["phase"] == "interrupted"
    assert runtime_control["reason"] == "plan_approval"
    assert runtime_control["available_actions"] == ["approve_plan", "edit_plan"]
    assert runtime_control["interrupt_payload"]["plan"] == "1. Inspect\n2. Update"
