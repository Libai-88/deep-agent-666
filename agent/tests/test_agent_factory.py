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
    assert set(main_module.agents) == {
        preset_id for preset_id in ALL_PRESETS if preset_id.startswith("openai-")
    }

    route_paths = {route.path for route in main_module.app.routes}
    assert "/openai-balanced" in route_paths
    assert "/anthropic-balanced" not in route_paths
    assert "/google-balanced" not in route_paths
