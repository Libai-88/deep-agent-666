from typing import Any

from pydantic import BaseModel


class V2AgentState(BaseModel):
    """V2 agent state with CopilotKit-compatible fields.

    Designed to be a drop-in replacement for TypedDict-based state schemas
    used in LangGraph, while providing attribute access and default values
    that TypedDict does not support.

    Fields mirror the CopilotKit protocol (copilotkit, messages) alongside
    V2-specific fields (phase, plan_steps, etc.).
    """

    phase: str = "idle"  # idle | planning | executing | reviewing | done
    plan_steps: list[dict[str, Any]] = []
    completed_steps: list[dict[str, Any]] = []
    file_changes: list[dict[str, Any]] = []
    review_result: str | None = None
