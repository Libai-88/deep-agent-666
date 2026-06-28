"""Tests for CopilotKitRemoteEndpoint agent registration."""

import asyncio
import importlib
import json
import sys

from ag_ui.core.events import RunStartedEvent
from fastapi.testclient import TestClient

from app.presets import ALL_PRESETS
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


def test_coordinator_agents_in_sdk(monkeypatch, tmp_path) -> None:
    """Coordinator LangGraphAGUIAgents are included in the CopilotKitRemoteEndpoint SDK."""
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
    monkeypatch.setenv("GOOGLE_API_KEY", "test-key")

    main_module = _reload_main(monkeypatch, tmp_path)

    agent_names = {a.name for a in main_module.sdk.agents}
    for preset_id, preset in ALL_PRESETS.items():
        if preset.permission_mode.value in ("balanced", "full-access"):
            assert f"coordinator-{preset_id}" in agent_names, \
                f"Missing coordinator: coordinator-{preset_id}"
        else:
            assert f"coordinator-{preset_id}" not in agent_names, \
                f"Unexpected coordinator for read-only: coordinator-{preset_id}"


def test_v1_agents_in_sdk(monkeypatch, tmp_path) -> None:
    """V1 agents are registered alongside coordinators."""
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")

    main_module = _reload_main(monkeypatch, tmp_path)

    agent_names = {a.name for a in main_module.sdk.agents}
    assert "openai-balanced" in agent_names
    assert "openai-read-only" in agent_names
    assert "openai-full-access" in agent_names

    # Unconfigured providers should not appear
    assert "anthropic-balanced" not in agent_names
    assert "google-balanced" not in agent_names


def test_copilotkit_route_registered(monkeypatch, tmp_path) -> None:
    """The CopilotKit endpoint route is registered at /copilotkit/{path:path}."""
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")

    main_module = _reload_main(monkeypatch, tmp_path)

    route_paths = {route.path for route in main_module.app.routes}
    assert "/copilotkit/{path:path}" in route_paths, \
        "CopilotKitRemoteEndpoint route not found"


def test_health_endpoint_works(monkeypatch, tmp_path) -> None:
    """The /health endpoint still returns preset_count."""
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")

    main_module = _reload_main(monkeypatch, tmp_path)

    response = asyncio.run(main_module.health())
    assert response.status_code == 200
    payload = json.loads(response.body)
    assert payload["status"] == "ok"
    assert payload["preset_count"] > 0


def test_agents_skip_unconfigured_providers(monkeypatch, tmp_path) -> None:
    """Agents for providers without API keys are not in the SDK."""
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.delenv("GOOGLE_API_KEY", raising=False)

    main_module = _reload_main(monkeypatch, tmp_path)

    agent_names = {a.name for a in main_module.sdk.agents}
    assert "coordinator-openai-balanced" in agent_names
    assert "coordinator-openai-full-access" in agent_names

    # Unconfigured providers should not have coordinators
    assert "coordinator-anthropic-balanced" not in agent_names
    assert "coordinator-google-balanced" not in agent_names


def test_run_control_endpoint_accepts_request_stop_action(monkeypatch, tmp_path) -> None:
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")

    main_module = _reload_main(monkeypatch, tmp_path)
    snapshot = build_default_runtime_control_snapshot()
    snapshot["phase"] = "running"
    snapshot["available_actions"] = ["request_stop"]
    snapshot["status_message"] = "Running"
    main_module.record_thread_runtime_snapshot("thread-1", snapshot)

    response = asyncio.run(
        main_module.run_control(
            main_module.RunControlRequest(
                thread_id="thread-1",
                action="request_stop",
            )
        )
    )

    assert response.status_code == 200
    payload = json.loads(response.body)
    assert payload["status"] == "ok"
    assert payload["threadId"] == "thread-1"
    assert payload["action"] == "request_stop"
    rc = payload["runtime_control"]
    assert rc["phase"] == "cancellation_requested"
    assert rc["available_actions"] == []
    assert rc["status_message"] == "Cancellation requested"
    rc2 = payload["runtimeControl"]
    assert rc2["phase"] == "cancellation_requested"


def test_run_control_request_rejects_legacy_stop_action(monkeypatch, tmp_path) -> None:
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")

    main_module = _reload_main(monkeypatch, tmp_path)

    try:
        main_module.RunControlRequest.model_validate(
            {
                "thread_id": "thread-legacy",
                "action": "stop",
            }
        )
    except Exception as exc:
        assert "request_stop" in str(exc)
        assert "stop" in str(exc)
    else:
        raise AssertionError("legacy stop action should be rejected")


def test_run_control_rejects_unknown_thread_without_runtime_snapshot(monkeypatch, tmp_path) -> None:
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    main_module = _reload_main(monkeypatch, tmp_path)

    response = asyncio.run(
        main_module.run_control(
            main_module.RunControlRequest(
                thread_id="missing-thread",
                action="request_stop",
            )
        )
    )

    assert response.status_code == 404
    payload = json.loads(response.body)
    assert payload["status"] == "error"
    assert payload["code"] == "thread_runtime_not_found"


class _SuccessfulAgent:
    name = "openai-balanced"

    def clone(self):
        return _SuccessfulAgent()

    async def run(self, input_data):
        yield RunStartedEvent(
            thread_id=input_data.thread_id,
            run_id=input_data.run_id,
        )


def test_direct_agui_route_records_runtime_snapshot_for_real_thread(
    monkeypatch,
    tmp_path,
) -> None:
    main_module = _reload_main(monkeypatch, tmp_path)
    monkeypatch.setattr(
        main_module,
        "_resolve_route_agent",
        lambda _name: _SuccessfulAgent(),
    )
    client = TestClient(main_module.app)

    response = client.post(
        "/openai-balanced",
        json={
            "threadId": "thread-real-run",
            "runId": "run-real-run",
            "messages": [{"id": "m1", "role": "user", "content": "hello"}],
            "state": {},
            "tools": [],
            "context": [],
            "forwardedProps": {},
        },
        headers={"accept": "text/event-stream"},
    )

    assert response.status_code == 200
    snapshot = main_module.get_thread_runtime_snapshot("thread-real-run")
    assert snapshot is not None
    assert snapshot["phase"] == "completed"
    assert snapshot["status_message"] == "Completed"
    assert snapshot["available_actions"] == []
