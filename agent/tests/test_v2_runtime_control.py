"""Tests for runtime control snapshot helpers."""

from app.state import RuntimeControlAction
from app.state import build_default_runtime_control_snapshot


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
    action: RuntimeControlAction = "request_stop"

    assert action == "request_stop"
