"""GenUI middleware — intercepts model responses, emits state for frontend rendering.

Uses copilotkit_emit_state to push structured data that the frontend
consumes via useAgent().state subscriptions.

Adapted for CoordinatorState with delegations field.
"""
from typing import Any

from langchain.agents.middleware import AgentMiddleware
from langchain_core.runnables import RunnableConfig
from langgraph.config import get_config


async def genui_middleware(state: dict[str, Any], config: RunnableConfig) -> None:
    """Emit structured GenUI state for the frontend.

    Silently no-ops if copilotkit_emit_state is not available or if called
    outside a LangGraph runnable context (e.g., during testing).

    Args:
        state: The current agent state dict (must include phase, plan_steps, etc.).
        config: LangGraph RunnableConfig for copilotkit_emit_state.
    """
    try:
        from copilotkit.langgraph import copilotkit_emit_state
    except ImportError:
        return  # copilotkit not installed

    async def _emit(key: str, payload: Any) -> None:
        """Emit a single state event, swallowing run-context errors."""
        try:
            await copilotkit_emit_state(config, {key: payload})
        except RuntimeError:
            pass  # Outside a runnable context (e.g., tests, startup)

    # Emit delegations from CoordinatorState
    delegations = _get_state_field(state, "delegations", [])
    if delegations:
        await _emit("delegations", delegations)

    control_state = _get_state_field(state, "control_state")
    if control_state:
        await _emit("control_state", control_state)

    runtime_control = _get_state_field(state, "runtime_control")
    if runtime_control:
        await _emit("runtime_control", runtime_control)

    # Also check for legacy V2 fields (backward compat)
    phase = _get_state_field(state, "phase")
    if phase and phase != "idle":
        await _emit("phase", phase)

    plan_steps = _get_state_field(state, "plan_steps")
    if plan_steps:
        await _emit("genui_plan", plan_steps)

    file_changes = _get_state_field(state, "file_changes", [])
    if file_changes:
        latest = file_changes[-1]
        await _emit(
            "genui_diff",
            {
                "file_path": latest.get("file_path", "unknown"),
                "before": latest.get("before", ""),
                "after": latest.get("after", ""),
            },
        )

    review_result = _get_state_field(state, "review_result")
    if review_result:
        await _emit("genui_review", review_result)


def _get_state_field(state: Any, key: str, default: Any = None) -> Any:
    """Safely extract a field from state (dict, BaseModel, or similar)."""
    if isinstance(state, dict):
        return state.get(key, default)
    return getattr(state, key, default)


class GenUIMiddleware(AgentMiddleware):
    """AgentMiddleware that emits GenUI state via CopilotKit after model calls.

    Register with create_deep_agent(middleware=[GenUIMiddleware()]).
    """

    async def aafter_model(
        self,
        state: Any,
        runtime: Any,  # Runtime[ContextT] — unused but required by interface
    ) -> None:
        """Emit GenUI state after each model call completes."""
        try:
            config: RunnableConfig = get_config()
        except RuntimeError:
            return  # Not inside a runnable context

        await genui_middleware(state, config)
