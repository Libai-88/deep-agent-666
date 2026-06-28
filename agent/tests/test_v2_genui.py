"""Tests for the GenUI middleware."""
import asyncio
import sys
import types

import pytest

from app.middleware.genui import GenUIMiddleware, genui_middleware


@pytest.fixture()
def emit_spy(monkeypatch):
    """Inject a fake copilotkit_emit_state and return the recorded emissions."""
    emissions: list[dict] = []

    async def fake_emit(_config, payload):
        emissions.append(payload)

    langgraph_mod = types.ModuleType("copilotkit.langgraph")
    langgraph_mod.copilotkit_emit_state = fake_emit
    copilotkit_mod = types.ModuleType("copilotkit")
    copilotkit_mod.langgraph = langgraph_mod

    monkeypatch.setitem(sys.modules, "copilotkit", copilotkit_mod)
    monkeypatch.setitem(sys.modules, "copilotkit.langgraph", langgraph_mod)

    return emissions


def test_genui_middleware_emits_delegations(emit_spy):
    delegations = [{"id": "1", "sub_agent": "planner", "task": "plan", "status": "running", "result": ""}]
    asyncio.run(genui_middleware({"delegations": delegations}, {}))
    assert {"delegations": delegations} in emit_spy


def test_genui_middleware_emits_phase(emit_spy):
    asyncio.run(genui_middleware({"phase": "planning"}, {}))
    assert {"phase": "planning"} in emit_spy


def test_genui_middleware_idle_phase_not_emitted(emit_spy):
    asyncio.run(genui_middleware({"phase": "idle"}, {}))
    assert not any("phase" in e for e in emit_spy)


def test_genui_middleware_emits_genui_plan(emit_spy):
    steps = [{"step": "analyze", "file": "main.py"}]
    asyncio.run(genui_middleware({"plan_steps": steps}, {}))
    assert {"genui_plan": steps} in emit_spy


def test_genui_middleware_emits_genui_diff_last_item(emit_spy):
    changes = [
        {"file_path": "a.py", "before": "old_a", "after": "new_a"},
        {"file_path": "b.py", "before": "old_b", "after": "new_b"},
    ]
    asyncio.run(genui_middleware({"file_changes": changes}, {}))
    assert {"genui_diff": {"file_path": "b.py", "before": "old_b", "after": "new_b"}} in emit_spy


def test_genui_middleware_empty_file_changes_not_emitted(emit_spy):
    asyncio.run(genui_middleware({"file_changes": []}, {}))
    assert not any("genui_diff" in e for e in emit_spy)


def test_genui_middleware_emits_review_result(emit_spy):
    asyncio.run(genui_middleware({"review_result": "LGTM"}, {}))
    assert {"genui_review": "LGTM"} in emit_spy


def test_genui_middleware_empty_state_no_emissions(emit_spy):
    asyncio.run(genui_middleware({}, {}))
    assert emit_spy == []


def test_genui_middleware_control_state(emit_spy):
    control = {
        "status": "waiting_approval",
        "current_step": "Planner review",
        "available_actions": ["resume", "edit_plan"],
        "pending_approval": True,
    }
    asyncio.run(genui_middleware({"control_state": control}, {}))
    assert {"control_state": control} in emit_spy


def test_coordinator_state_tracks_task_kind_and_final_summary():
    state = {"task_kind": "research", "final_summary": "Research complete"}
    assert state["task_kind"] == "research"
    assert state["final_summary"] == "Research complete"


def test_genui_middleware_is_agent_middleware():
    mw = GenUIMiddleware()
    from langchain.agents.middleware import AgentMiddleware
    assert isinstance(mw, AgentMiddleware)
    assert hasattr(mw, "aafter_model")
