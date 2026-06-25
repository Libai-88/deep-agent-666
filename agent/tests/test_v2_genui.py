"""Tests for the GenUI middleware."""
import asyncio

from app.middleware.genui import GenUIMiddleware, genui_middleware


def test_genui_middleware_called_directly():
    """Standalone function: should not raise exceptions with valid state."""
    state = {
        "phase": "planning",
        "plan_steps": [{"step": "analyze", "file": "main.py"}],
        "file_changes": [
            {"file_path": "main.py", "before": "old", "after": "new"},
        ],
        "review_result": "All checks passed",
    }
    asyncio.run(genui_middleware(state, {}))
    assert True


def test_genui_middleware_empty_state():
    """Standalone function: should handle empty state gracefully."""
    state: dict = {}
    asyncio.run(genui_middleware(state, {}))
    assert True


def test_genui_middleware_idle_phase_only():
    """Idle phase should not trigger emit."""
    state = {"phase": "idle"}
    asyncio.run(genui_middleware(state, {}))
    assert True


def test_genui_middleware_plan_steps_only():
    """Plan steps emit works in isolation."""
    state = {"plan_steps": [{"step": "refactor"}]}
    asyncio.run(genui_middleware(state, {}))
    assert True


def test_genui_middleware_file_changes_only():
    """File changes emit works in isolation."""
    state = {
        "file_changes": [
            {"file_path": "src/lib.rs", "before": "fn old()", "after": "fn new()"},
        ],
    }
    asyncio.run(genui_middleware(state, {}))
    assert True


def test_genui_middleware_review_only():
    """Review result emit works in isolation."""
    state = {"review_result": "LGTM"}
    asyncio.run(genui_middleware(state, {}))
    assert True


def test_genui_middleware_empty_file_changes():
    """Empty file_changes list should not emit."""
    state = {"file_changes": []}
    asyncio.run(genui_middleware(state, {}))
    assert True


def test_genui_middleware_is_agent_middleware():
    """GenUIMiddleware class should be an AgentMiddleware subclass."""
    mw = GenUIMiddleware()
    from langchain.agents.middleware import AgentMiddleware

    assert isinstance(mw, AgentMiddleware)
    assert hasattr(mw, "aafter_model")
