"""Agent state schemas for V1 and V2 agents."""

import typing
from datetime import datetime, timezone
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


class CoordinatorControlState(typing.TypedDict, total=False):
    """A normalized control surface for paused or running coordinator work."""

    status: Literal[
        "idle",
        "running",
        "waiting_approval",
        "stopped",
        "failed",
        "completed",
    ]
    current_step: str
    available_actions: list[Literal["stop", "retry", "resume", "edit_plan"]]
    pending_approval: bool


RuntimeControlPhase = Literal[
    "idle",
    "running",
    "interrupted",
    "resuming",
    "completed",
    "failed",
    "cancellation_requested",
    "cancelled",
    "cancelling",
]

RuntimeControlAction = Literal[
    "approve_plan",
    "edit_plan",
    "retry_last",
    "request_stop",
]


class RuntimeControlSnapshot(typing.TypedDict):
    """运行时控制快照，供后续 control plane 扩展复用。"""

    phase: RuntimeControlPhase
    reason: Literal["none", "plan_approval", "tool_approval", "user_stop", "error"]
    available_actions: list[str]
    status_message: str
    current_step: str | None
    interrupt_payload: dict[str, typing.Any] | None
    checkpoint_id: str | None
    active_delegation: str | None
    last_error: str | None
    updated_at: str


def build_default_runtime_control_snapshot() -> RuntimeControlSnapshot:
    """构建默认的 idle 运行时控制快照。"""

    return {
        "phase": "idle",
        "reason": "none",
        "available_actions": [],
        "status_message": "Idle",
        "current_step": None,
        "interrupt_payload": None,
        "checkpoint_id": None,
        "active_delegation": None,
        "last_error": None,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }


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
    control_state: CoordinatorControlState
