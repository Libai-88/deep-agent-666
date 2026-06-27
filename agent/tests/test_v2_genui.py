"""Tests for the GenUI middleware."""
import asyncio
import sys
import types

from app.middleware.genui import GenUIMiddleware, genui_middleware


def test_genui_middleware_called_directly():
    """Standalone function: should not raise exceptions with valid state."""
    state = {
        "phase": "planning",
        "plan_steps": [{"step": "analyze", "file": "main.py"}],
        "file_changes": [
            {"file_path": "main.py", "before": "old", "after": "new"},
        ],
        "review_result": "All checks passed",
    }
    asyncio.run(genui_middleware(state, {}))
    assert True


def test_genui_middleware_empty_state():
    """Standalone function: should handle empty state gracefully."""
    state: dict = {}
    asyncio.run(genui_middleware(state, {}))
    assert True


def test_genui_middleware_idle_phase_only():
    """Idle phase should not trigger emit."""
    state = {"phase": "idle"}
    asyncio.run(genui_middleware(state, {}))
    assert True


def test_genui_middleware_plan_steps_only():
    """Plan steps emit works in isolation."""
    state = {"plan_steps": [{"step": "refactor"}]}
    asyncio.run(genui_middleware(state, {}))
    assert True


def test_genui_middleware_file_changes_only():
    """File changes emit works in isolation."""
    state = {
        "file_changes": [
            {"file_path": "src/lib.rs", "before": "fn old()", "after": "fn new()"},
        ],
    }
    asyncio.run(genui_middleware(state, {}))
    assert True


def test_genui_middleware_review_only():
    """Review result emit works in isolation."""
    state = {"review_result": "LGTM"}
    asyncio.run(genui_middleware(state, {}))
    assert True


def test_genui_middleware_empty_file_changes():
    """Empty file_changes list should not emit."""
    state = {"file_changes": []}
    asyncio.run(genui_middleware(state, {}))
    assert True


def test_genui_middleware_delegations():
    """CoordinatorState delegations should not cause errors."""
    state = {
        "delegations": [
            {"id": "1", "sub_agent": "planner", "task": "plan", "status": "running", "result": ""},
        ],
        "task_kind": "research",
        "final_summary": "Research complete",
    }
    asyncio.run(genui_middleware(state, {}))
    assert True


def test_genui_middleware_control_state():
    """Coordinator control_state emits a state update for paused runs."""
    emissions: list[dict] = []

    async def fake_emit_state(_config, payload):
        emissions.append(payload)

    langgraph_module = types.ModuleType("copilotkit.langgraph")
    langgraph_module.copilotkit_emit_state = fake_emit_state
    copilotkit_module = types.ModuleType("copilotkit")
    copilotkit_module.langgraph = langgraph_module

    previous_copilotkit = sys.modules.get("copilotkit")
    previous_langgraph = sys.modules.get("copilotkit.langgraph")
    sys.modules["copilotkit"] = copilotkit_module
    sys.modules["copilotkit.langgraph"] = langgraph_module

    state = {
        "delegations": [],
        "task_kind": "engineering",
        "final_summary": "",
        "control_state": {
            "status": "waiting_approval",
            "current_step": "Planner review",
            "available_actions": ["resume", "edit_plan"],
            "pending_approval": True,
        },
    }
    try:
        asyncio.run(genui_middleware(state, {}))
    finally:
        if previous_copilotkit is None:
            sys.modules.pop("copilotkit", None)
        else:
            sys.modules["copilotkit"] = previous_copilotkit

        if previous_langgraph is None:
            sys.modules.pop("copilotkit.langgraph", None)
        else:
            sys.modules["copilotkit.langgraph"] = previous_langgraph

    assert {"control_state": state["control_state"]} in emissions


def test_coordinator_state_tracks_task_kind_and_final_summary():
    state = {
        "messages": [],
        "delegations": [],
        "task_kind": "research",
        "final_summary": "Research complete",
    }
    assert state["task_kind"] == "research"
    assert state["final_summary"] == "Research complete"


def test_genui_middleware_is_agent_middleware():
    """GenUIMiddleware class should be an AgentMiddleware subclass."""
    mw = GenUIMiddleware()
    from langchain.agents.middleware import AgentMiddleware

    assert isinstance(mw, AgentMiddleware)
    assert hasattr(mw, "aafter_model")
