"""Tests for CopilotKitRemoteEndpoint agent registration."""

import asyncio
import importlib
import json
import sys

from app.presets import ALL_PRESETS


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


def test_run_control_endpoint_accepts_stop_action(monkeypatch, tmp_path) -> None:
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")

    main_module = _reload_main(monkeypatch, tmp_path)

    response = asyncio.run(
        main_module.run_control(
            main_module.RunControlRequest(
                thread_id="thread-1",
                action="stop",
            )
        )
    )

    assert response.status_code == 200
    payload = json.loads(response.body)
    assert payload == {
        "status": "ok",
        "threadId": "thread-1",
        "action": "stop",
        "runStatus": "stopped",
    }
