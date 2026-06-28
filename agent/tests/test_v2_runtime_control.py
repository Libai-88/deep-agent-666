"""Tests for runtime control snapshot helpers."""

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
