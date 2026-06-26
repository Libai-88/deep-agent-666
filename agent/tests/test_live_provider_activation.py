import asyncio
import importlib
import json
import sys

from fastapi.testclient import TestClient


def _reload_main(monkeypatch, tmp_path):
    workspace = tmp_path / "workspace"
    workspace.mkdir()
    monkeypatch.setenv("AGENT_WORKSPACE_ROOT", str(workspace))
    sys.modules.pop("app.main", None)
    import app.main as main_module

    return importlib.reload(main_module)


def test_configure_live_activates_new_provider_agents(monkeypatch, tmp_path) -> None:
    monkeypatch.setenv("OPENAI_API_KEY", "test-openai-key")
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.delenv("GOOGLE_API_KEY", raising=False)

    main_module = _reload_main(monkeypatch, tmp_path)

    initial_presets = json.loads(asyncio.run(main_module.presets()).body)
    assert {preset["id"] for preset in initial_presets["presets"]} == {
        "openai-read-only",
        "openai-balanced",
        "openai-full-access",
    }

    initial_agent_names = {agent.name for agent in main_module.sdk.agents}
    assert "anthropic-balanced" not in initial_agent_names
    assert "coordinator-anthropic-balanced" not in initial_agent_names

    response = asyncio.run(
        main_module.configure(
            main_module.ConfigureRequest(anthropic_api_key="test-anthropic-key"),
        )
    )
    payload = json.loads(response.body)
    assert response.status_code == 200
    assert "anthropic-balanced" in payload["preset_ids"]

    updated_presets = json.loads(asyncio.run(main_module.presets()).body)
    assert {
        preset["id"] for preset in updated_presets["presets"]
    } >= {
        "anthropic-read-only",
        "anthropic-balanced",
        "anthropic-full-access",
    }

    updated_agent_names = {agent.name for agent in main_module.sdk.agents}
    assert "anthropic-balanced" in updated_agent_names
    assert "coordinator-anthropic-balanced" in updated_agent_names


def test_health_reflects_live_provider_activation(monkeypatch, tmp_path) -> None:
    monkeypatch.setenv("OPENAI_API_KEY", "test-openai-key")
    monkeypatch.delenv("GOOGLE_API_KEY", raising=False)

    main_module = _reload_main(monkeypatch, tmp_path)

    before = json.loads(asyncio.run(main_module.health()).body)
    assert "google-balanced" not in before["agents"]

    asyncio.run(
        main_module.configure(
            main_module.ConfigureRequest(google_api_key="test-google-key"),
        )
    )

    after = json.loads(asyncio.run(main_module.health()).body)
    assert "google-balanced" in after["agents"]
    assert "coordinator-google-balanced" in after["agents"]


def test_direct_agent_health_route_activates_after_configure(monkeypatch, tmp_path) -> None:
    monkeypatch.setenv("OPENAI_API_KEY", "test-openai-key")
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)

    main_module = _reload_main(monkeypatch, tmp_path)
    client = TestClient(main_module.app)

    before = client.get("/anthropic-balanced/health")
    assert before.status_code == 404

    response = asyncio.run(
        main_module.configure(
            main_module.ConfigureRequest(anthropic_api_key="test-anthropic-key"),
        )
    )
    assert response.status_code == 200

    after = client.get("/anthropic-balanced/health")
    assert after.status_code == 200
    assert after.json()["agent"]["name"] == "anthropic-balanced"
