"""Tests for V2 coordinator AG-UI endpoint registration in main.py."""

import asyncio
import importlib
import json
import sys

from app.config import AgentSettings
from app.presets import ALL_PRESETS


def test_coordinator_endpoints_registered(monkeypatch, tmp_path) -> None:
    """Coordinator endpoints are registered for balanced and full-access presets."""
    workspace = tmp_path / "workspace"
    workspace.mkdir()
    monkeypatch.setenv("AGENT_WORKSPACE_ROOT", str(workspace))
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
    monkeypatch.setenv("GOOGLE_API_KEY", "test-key")

    sys.modules.pop("app.main", None)
    import app.main as main_module

    main_module = importlib.reload(main_module)

    route_paths = {route.path for route in main_module.app.routes}

    # Expect coordinator endpoints for all balanced and full-access presets
    expected_coordinator_paths = set()
    for preset_id, preset in ALL_PRESETS.items():
        if preset.permission_mode.value in ("balanced", "full-access"):
            expected_coordinator_paths.add(f"/coordinator-{preset_id}")

    for path in expected_coordinator_paths:
        assert path in route_paths, f"Missing coordinator endpoint: {path}"

    # Read-only presets should NOT have coordinator endpoints
    for preset_id, preset in ALL_PRESETS.items():
        if preset.permission_mode.value == "read-only":
            assert (
                f"/coordinator-{preset_id}" not in route_paths
            ), f"Unexpected coordinator endpoint for read-only preset: {preset_id}"


def test_v1_endpoints_still_registered(monkeypatch, tmp_path) -> None:
    """V1 agent endpoints remain registered alongside V2 coordinators."""
    workspace = tmp_path / "workspace"
    workspace.mkdir()
    monkeypatch.setenv("AGENT_WORKSPACE_ROOT", str(workspace))
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")

    sys.modules.pop("app.main", None)
    import app.main as main_module

    main_module = importlib.reload(main_module)

    route_paths = {route.path for route in main_module.app.routes}

    # V1 endpoints
    assert "/openai-balanced" in route_paths
    assert "/openai-read-only" in route_paths
    assert "/openai-full-access" in route_paths

    # Coordinator endpoint for balanced preset
    assert "/coordinator-openai-balanced" in route_paths
    assert "/coordinator-openai-full-access" in route_paths

    # V1 endpoints for unconfigured providers should NOT be registered
    assert "/anthropic-balanced" not in route_paths
    assert "/google-balanced" not in route_paths


def test_coordinators_skipped_for_read_only_presets(monkeypatch, tmp_path) -> None:
    """Read-only presets should not have coordinator endpoints."""
    workspace = tmp_path / "workspace"
    workspace.mkdir()
    monkeypatch.setenv("AGENT_WORKSPACE_ROOT", str(workspace))
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
    monkeypatch.setenv("GOOGLE_API_KEY", "test-key")

    sys.modules.pop("app.main", None)
    import app.main as main_module

    main_module = importlib.reload(main_module)

    route_paths = {route.path for route in main_module.app.routes}

    # Read-only presets should not get coordinators
    assert "/coordinator-openai-read-only" not in route_paths
    assert "/coordinator-anthropic-read-only" not in route_paths
    assert "/coordinator-google-read-only" not in route_paths


def test_health_endpoint_works_with_coordinators(monkeypatch, tmp_path) -> None:
    """The /health endpoint still works with coordinator endpoints registered."""
    workspace = tmp_path / "workspace"
    workspace.mkdir()
    monkeypatch.setenv("AGENT_WORKSPACE_ROOT", str(workspace))
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")

    sys.modules.pop("app.main", None)
    import app.main as main_module

    main_module = importlib.reload(main_module)

    response = asyncio.run(main_module.health())
    assert response.status_code == 200
    payload = json.loads(response.body)
    assert payload["status"] == "ok"
    assert payload["preset_count"] > 0


def test_coordinators_not_registered_for_missing_api_keys(monkeypatch, tmp_path) -> None:
    """Coordinators for providers without API keys should not be registered."""
    workspace = tmp_path / "workspace"
    workspace.mkdir()
    monkeypatch.setenv("AGENT_WORKSPACE_ROOT", str(workspace))
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.delenv("GOOGLE_API_KEY", raising=False)

    sys.modules.pop("app.main", None)
    import app.main as main_module

    main_module = importlib.reload(main_module)

    route_paths = {route.path for route in main_module.app.routes}

    # Coordinator for OpenAI balanced/full-access should be registered
    assert "/coordinator-openai-balanced" in route_paths
    assert "/coordinator-openai-full-access" in route_paths

    # Coordinators for unconfigured providers should NOT be registered
    assert "/coordinator-anthropic-balanced" not in route_paths
    assert "/coordinator-google-balanced" not in route_paths
