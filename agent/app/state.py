"""Agent state schemas for V1 and V2 agents."""

import typing
from operator import add
from typing import Annotated, Literal

from langchain.agents import AgentState as BaseAgentState

from app.task_profile import TaskKind


# ── Subagent Coordinator State ──────────────────────────────────────────
# Reference: showcase/integrations/langgraph-fastapi/src/agents/src/subagents.py


class Delegation(typing.TypedDict):
    """A single sub-agent delegation entry for real-time UI rendering."""

    id: str
    sub_agent: Literal["planner", "executor", "reviewer"]
    task: str
    status: Literal["running", "completed", "failed"]
    result: str


class WorkbenchEvent(typing.TypedDict):
    """A normalized workbench event for timeline and artifact rendering."""

    id: str
    kind: Literal["delegation", "status", "artifact"]
    status: Literal["running", "completed", "failed", "info"]
    title: str
    message: str
    source: Literal["planner", "executor", "reviewer", "tool", "system"]
    artifact_path: str | None
    artifact_kind: Literal["file", "finding", "summary"] | None


class CoordinatorState(BaseAgentState):
    """Supervisor coordinator state with delegation tracking.

    `delegations` uses `operator.add` as its channel reducer so concurrent
    tool calls within a single supervisor turn each contribute their own
    entry (instead of last-write-wins).
    """

    delegations: Annotated[list[Delegation], add]
    workbench_events: Annotated[list[WorkbenchEvent], add]
    task_kind: TaskKind
    final_summary: str
