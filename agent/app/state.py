"""Agent state schemas for V1 and V2 agents."""

import typing
import uuid
from operator import add
from typing import Annotated, Any, Literal

from copilotkit import CopilotKitState
from langchain.agents import AgentState as BaseAgentState
from pydantic import BaseModel


class V2AgentState(BaseModel):
    """Legacy V2 agent state (kept for backward compatibility).

    Will be replaced by CoordinatorState in Phase 2.
    """

    phase: str = "idle"  # idle | planning | executing | reviewing | done
    plan_steps: list[dict[str, Any]] = []
    completed_steps: list[dict[str, Any]] = []
    file_changes: list[dict[str, Any]] = []
    review_result: str | None = None


# ── Phase 2: Subagent Coordinator State ────────────────────────────────
# Reference: showcase/integrations/langgraph-fastapi/src/agents/src/subagents.py


class Delegation(typing.TypedDict):
    """A single sub-agent delegation entry for real-time UI rendering."""

    id: str
    sub_agent: Literal["planner", "executor", "reviewer"]
    task: str
    status: Literal["running", "completed", "failed"]
    result: str


class CoordinatorState(BaseAgentState):
    """Supervisor coordinator state with delegation tracking.

    `delegations` uses `operator.add` as its channel reducer so concurrent
    tool calls within a single supervisor turn each contribute their own
    entry (instead of last-write-wins).
    """

    delegations: Annotated[list[Delegation], add]
