"""Tests for runtime control snapshot helpers."""

import asyncio
import importlib
import json
import sys
from typing import get_args
from unittest.mock import patch

import pytest

from app.state import RuntimeControlAction
from app.state import build_default_runtime_control_snapshot


def _reload_main(monkeypatch, tmp_path):
    """Helper: reload main module with test env vars."""
    workspace = tmp_path / "workspace"
    workspace.mkdir()
    registry_path = tmp_path / "provider-registry.json"
    monkeypatch.setenv("AGENT_WORKSPACE_ROOT", str(workspace))
    monkeypatch.setenv("AGENT_PROVIDER_REGISTRY_PATH", str(registry_path))
    sys.modules.pop("app.main", None)
    import app.main as main_module

    return importlib.reload(main_module)


def test_build_default_runtime_control_snapshot_is_idle() -> None:
    snapshot = build_default_runtime_control_snapshot()

    assert snapshot == {
        "phase": "idle",
        "reason": "none",
        "available_actions": [],
        "status_message": "Idle",
        "current_step": None,
        "interrupt_payload": None,
        "checkpoint_id": None,
        "active_delegation": None,
        "last_error": None,
        "updated_at": snapshot["updated_at"],
    }
    assert isinstance(snapshot["updated_at"], str)


def test_runtime_control_action_type_uses_canonical_vocabulary() -> None:
    assert set(get_args(RuntimeControlAction)) == {
        "approve_plan",
        "edit_plan",
        "retry_last",
        "request_stop",
    }


def test_run_control_request_stop_transitions_to_cancellation_requested(
    monkeypatch,
    tmp_path,
) -> None:
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    main_module = _reload_main(monkeypatch, tmp_path)
    main_module.record_thread_runtime_snapshot(
        "thread-1",
        {
            **build_default_runtime_control_snapshot(),
            "phase": "running",
            "available_actions": ["request_stop"],
            "status_message": "Executor running",
        },
    )

    response = asyncio.run(
        main_module.run_control(
            main_module.RunControlRequest(thread_id="thread-1", action="request_stop")
        )
    )

    payload = json.loads(response.body)
    assert response.status_code == 200
    assert payload["runtime_control"]["phase"] == "cancellation_requested"
    assert payload["runtime_control"]["reason"] == "user_stop"


def test_run_control_edit_plan_requires_interrupted_plan_approval(
    monkeypatch,
    tmp_path,
) -> None:
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    main_module = _reload_main(monkeypatch, tmp_path)
    main_module.record_thread_runtime_snapshot(
        "thread-1",
        {
            **build_default_runtime_control_snapshot(),
            "phase": "running",
            "available_actions": ["request_stop"],
            "status_message": "Still running",
        },
    )

    response = asyncio.run(
        main_module.run_control(
            main_module.RunControlRequest(
                thread_id="thread-1",
                action="edit_plan",
                plan_patch="1. New step",
            )
        )
    )

    assert response.status_code == 409
    payload = json.loads(response.body)
    assert payload["code"] == "control_action_not_allowed"


# ── Consumer tests (Fix 1: event_generator wires consume) ──────────────


def test_consume_request_stop_transitions_to_cancelling(
    monkeypatch,
    tmp_path,
) -> None:
    """C1: request_stop consumed → snapshot phase = cancelling."""
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    main_module = _reload_main(monkeypatch, tmp_path)
    main_module.record_thread_runtime_snapshot(
        "thread-1",
        {
            **build_default_runtime_control_snapshot(),
            "phase": "running",
            "available_actions": ["request_stop"],
            "status_message": "Running",
        },
    )

    main_module.queue_thread_control_command(
        "thread-1", {"action": "request_stop"}
    )
    cmd = main_module.consume_thread_control_command("thread-1")
    assert cmd is not None
    assert cmd["action"] == "request_stop"
    snapshot = main_module.get_thread_runtime_snapshot("thread-1")
    assert snapshot["phase"] == "cancelling"
    assert snapshot["status_message"] == "Cancelling"


def test_consume_approve_plan_transitions_to_resuming(
    monkeypatch,
    tmp_path,
) -> None:
    """C2: approve_plan consumed → snapshot phase = resuming."""
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    main_module = _reload_main(monkeypatch, tmp_path)
    main_module.record_thread_runtime_snapshot(
        "thread-1",
        {
            **build_default_runtime_control_snapshot(),
            "phase": "interrupted",
            "reason": "plan_approval",
            "available_actions": ["approve_plan", "edit_plan"],
            "status_message": "Planner review required",
            "interrupt_payload": {"plan": "steps", "task": "task"},
        },
    )

    main_module.queue_thread_control_command(
        "thread-1", {"action": "approve_plan"}
    )
    cmd = main_module.consume_thread_control_command("thread-1")
    assert cmd is not None
    assert cmd["action"] == "approve_plan"
    snapshot = main_module.get_thread_runtime_snapshot("thread-1")
    assert snapshot["phase"] == "resuming"
    assert snapshot["status_message"] == "Approved, resuming"


def test_consume_retry_last_transitions_to_running(
    monkeypatch,
    tmp_path,
) -> None:
    """C3: retry_last consumed → snapshot phase = running."""
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    main_module = _reload_main(monkeypatch, tmp_path)
    main_module.record_thread_runtime_snapshot(
        "thread-1",
        {
            **build_default_runtime_control_snapshot(),
            "phase": "interrupted",
            "reason": "error",
            "available_actions": ["retry_last"],
            "status_message": "Failed",
            "last_error": "Something broke",
        },
    )

    main_module.queue_thread_control_command(
        "thread-1", {"action": "retry_last"}
    )
    cmd = main_module.consume_thread_control_command("thread-1")
    assert cmd is not None
    assert cmd["action"] == "retry_last"
    snapshot = main_module.get_thread_runtime_snapshot("thread-1")
    assert snapshot["phase"] == "running"
    assert snapshot["status_message"] == "Retrying"


def test_consume_no_pending_command_returns_none(
    monkeypatch,
    tmp_path,
) -> None:
    """C4: no pending command → consume returns None, snapshot unchanged."""
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    main_module = _reload_main(monkeypatch, tmp_path)
    main_module.record_thread_runtime_snapshot(
        "thread-1",
        {
            **build_default_runtime_control_snapshot(),
            "phase": "running",
            "available_actions": ["request_stop"],
            "status_message": "Running",
        },
    )

    snapshot_before = dict(main_module.get_thread_runtime_snapshot("thread-1"))
    cmd = main_module.consume_thread_control_command("thread-1")
    assert cmd is None
    snapshot_after = main_module.get_thread_runtime_snapshot("thread-1")
    assert snapshot_after["phase"] == snapshot_before["phase"]
    assert snapshot_after["status_message"] == snapshot_before["status_message"]


def test_middleware_skips_control_state_when_runtime_control_present() -> None:
    """C5: middleware emits runtime_control but NOT control_state when both present."""
    from app.middleware.genui import genui_middleware

    emitted: dict[str, object] = {}

    async def mock_emit(config, payload):
        emitted.update(payload)

    async def run():
        import copilotkit.langgraph
        with patch.object(
            copilotkit.langgraph, "copilotkit_emit_state", mock_emit
        ):
            state = {
                "runtime_control": {"phase": "running"},
                "control_state": {
                    "status": "running",
                    "available_actions": ["stop"],
                },
            }
            await genui_middleware(state, {})

    asyncio.run(run())
    assert "runtime_control" in emitted
    assert "control_state" not in emitted
