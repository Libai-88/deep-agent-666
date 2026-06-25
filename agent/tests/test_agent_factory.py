import asyncio
import importlib
import importlib.util
import json
import sys

from app.agent_factory import build_graph_map
from app.config import AgentSettings
from app.presets import ALL_PRESETS


def test_provider_integrations_exist_for_advertised_presets() -> None:
    assert importlib.util.find_spec("langchain_openai") is not None
    assert importlib.util.find_spec("langchain_anthropic") is not None
    assert importlib.util.find_spec("langchain_google_genai") is not None


def test_build_graph_map_covers_every_preset(tmp_path) -> None:
    settings = AgentSettings.model_validate(
        {
            "AGENT_WORKSPACE_ROOT": str(tmp_path / "workspace"),
            "OPENAI_API_KEY": "test-key",
            "ANTHROPIC_API_KEY": "test-key",
            "GOOGLE_API_KEY": "test-key",
        }
    )

    graph_map = build_graph_map(settings)

    assert set(graph_map) == set(ALL_PRESETS)


def test_main_starts_with_only_openai_configured(monkeypatch, tmp_path) -> None:
    workspace = tmp_path / "workspace"
    workspace.mkdir()
    monkeypatch.setenv("AGENT_WORKSPACE_ROOT", str(workspace))
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.delenv("GOOGLE_API_KEY", raising=False)

    sys.modules.pop("app.main", None)
    import app.main as main_module

    main_module = importlib.reload(main_module)
    response = asyncio.run(main_module.presets())

    assert response.status_code == 200
    payload = json.loads(response.body)
    assert payload["defaultPresetId"] == "openai-balanced"
    assert {preset["id"] for preset in payload["presets"]} == {
        preset_id for preset_id in ALL_PRESETS if preset_id.startswith("openai-")
    }

    # SDK agent names should only include OpenAI presets + their coordinators
    agent_names = {a.name for a in main_module.sdk.agents}
    expected_openai = {pid for pid in ALL_PRESETS if pid.startswith("openai-")}
    expected_coordinators = {f"coordinator-{pid}" for pid in expected_openai
                            if ALL_PRESETS[pid].permission_mode.value in ("balanced", "full-access")}
    assert expected_openai.issubset(agent_names), "Missing V1 OpenAI agents"
    assert expected_coordinators.issubset(agent_names), "Missing coordinator agents"
    assert not any("anthropic" in n or "google" in n for n in agent_names), "Unconfigured providers appeared"

    route_paths = {route.path for route in main_module.app.routes}
    assert "/copilotkit/{path:path}" in route_paths
