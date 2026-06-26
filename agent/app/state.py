"""Agent state schemas for V1 and V2 agents."""

import typing
from operator import add
from typing import Annotated, Literal

from langchain.agents import AgentState as BaseAgentState


# ── Subagent Coordinator State ──────────────────────────────────────────
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
