"""Tests for runtime control snapshot helpers."""

import asyncio
import importlib
import json
import sys
from typing import get_args

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
