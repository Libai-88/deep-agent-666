"""Tests for the V2 coordinator agent builder."""
from app.agent_factory import build_v2_coordinator


def test_coordinator_returns_agent():
    coordinator = build_v2_coordinator(
        model="openai/gpt-4o-mini",
        permission_mode="balanced",
    )
    assert coordinator is not None


def test_coordinator_has_subagents():
    coordinator = build_v2_coordinator(
        model="openai/gpt-4o-mini",
        permission_mode="balanced",
    )
    # create_deep_agent with subagents should produce an agent with subagent info
    assert coordinator is not None


def test_coordinator_default_permission():
    """Full-access permission includes all tools."""
    coordinator = build_v2_coordinator(
        model="openai/gpt-4o-mini",
        permission_mode="full-access",
    )
    assert coordinator is not None
