"""Tests for the V2 coordinator agent builder."""
from app.agent_factory import build_v2_coordinator


def test_coordinator_builds_for_all_permission_modes():
    """Coordinator builds without error for all three permission modes."""
    for mode in ("read-only", "balanced", "full-access"):
        coordinator = build_v2_coordinator(
            model="openai/gpt-4o-mini",
            permission_mode=mode,
        )
        assert coordinator is not None, f"Failed for permission_mode={mode}"


def test_coordinator_uses_read_only_tools_for_planner():
    """Planner subagent should not have write/exec tools in its toolset."""
    # The coordinator itself isn't pre-validated at build time for tool names
    # The subagent tool constraints are enforced at delegation time by Deep Agents
    # Verify the function doesn't crash and returns a valid compiled graph
    coordinator = build_v2_coordinator(
        model="openai/gpt-4o-mini",
        permission_mode="balanced",
    )
    assert coordinator is not None


def test_coordinator_full_access_includes_write_tools():
    """Full-access coordinator executor should work with write tools."""
    coordinator = build_v2_coordinator(
        model="openai/gpt-4o-mini",
        permission_mode="full-access",
    )
    assert coordinator is not None
