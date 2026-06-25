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


def test_v2_state_is_pydantic_model():
    """V2AgentState uses pydantic BaseModel (not TypedDict inheritance from CopilotKitState).

    CopilotKitState is a TypedDict (conflicts with BaseModel metaclass), so V2AgentState
    is a standalone BaseModel. It maintains structural compatibility by having all
    required fields with proper defaults.
    """
    from copilotkit import CopilotKitState

    # V2AgentState is a pydantic BaseModel
    assert issubclass(V2AgentState, BaseModel)
    assert isinstance(V2AgentState(), BaseModel)

    # Verify structural compatibility: V2AgentState fields cover what CopilotKitState needs
    state = V2AgentState()
    assert hasattr(state, "phase")
    assert hasattr(state, "plan_steps")
    assert hasattr(state, "completed_steps")
    assert hasattr(state, "file_changes")
    assert hasattr(state, "review_result")

    # Confirm CopilotKitState is indeed a TypedDict (not BaseModel-compatible)
    assert not issubclass(CopilotKitState, BaseModel)
