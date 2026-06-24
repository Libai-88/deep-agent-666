import importlib.util

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
