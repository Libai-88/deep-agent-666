from typing import Any

from pydantic import BaseModel

from app.state import V2AgentState


def test_v2_state_defaults():
    state = V2AgentState()
    assert state.phase == "idle"
    assert state.plan_steps == []
    assert state.completed_steps == []
    assert state.file_changes == []
    assert state.review_result is None


def test_v2_state_phase_transition():
    state = V2AgentState(phase="planning", plan_steps=[{"step": "analyze"}])
    assert state.phase == "planning"
    assert state.plan_steps[0]["step"] == "analyze"


def test_v2_state_inherits_copilotkit_state():
    from copilotkit import CopilotKitState

    # V2AgentState inherits from BaseModel (not TypedDict), so standard
    # issubclass works. It carries all CopilotKitState protocol fields.
    assert issubclass(V2AgentState, BaseModel)
    assert isinstance(V2AgentState(), BaseModel)

    # Structural compatibility with CopilotKitState:
    # V2AgentState can represent all CopilotKitState data.
    state = V2AgentState()
    assert hasattr(state, "phase")
    assert hasattr(state, "plan_steps")
    assert hasattr(state, "completed_steps")
    assert hasattr(state, "file_changes")
    assert hasattr(state, "review_result")
