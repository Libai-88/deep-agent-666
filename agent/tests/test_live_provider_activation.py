import asyncio
import importlib
import json
import sys
from pathlib import Path

from fastapi.testclient import TestClient


def _reload_main(monkeypatch, tmp_path):
    workspace = tmp_path / "workspace"
    workspace.mkdir()
    registry_path = tmp_path / "provider-registry.json"
    monkeypatch.setenv("AGENT_WORKSPACE_ROOT", str(workspace))
    monkeypatch.setenv("AGENT_PROVIDER_REGISTRY_PATH", str(registry_path))
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


def test_configure_updates_workspace_root_and_exposes_runtime_config(
    monkeypatch,
    tmp_path,
) -> None:
    monkeypatch.setenv("OPENAI_API_KEY", "test-openai-key")

    main_module = _reload_main(monkeypatch, tmp_path)
    client = TestClient(main_module.app)

    initial_config = client.get("/config")
    assert initial_config.status_code == 200
    initial_workspace_root = Path(initial_config.json()["workspaceRoot"])
    assert initial_workspace_root.exists()

    next_workspace = tmp_path / "second-workspace"
    next_workspace.mkdir()
    (next_workspace / "note.txt").write_text("hello", encoding="utf-8")

    response = client.post(
        "/configure",
        json={"agent_workspace_root": str(next_workspace)},
    )
    assert response.status_code == 200
    assert Path(response.json()["workspaceRoot"]) == next_workspace.resolve()

    updated_config = client.get("/config")
    assert updated_config.status_code == 200
    payload = updated_config.json()
    assert Path(payload["workspaceRoot"]) == next_workspace.resolve()
    assert payload["providers"]["openai"]["configured"] is True
    assert payload["providers"]["anthropic"]["configured"] is False

    workspace_listing = client.get("/workspace/files")
    assert workspace_listing.status_code == 200
    assert workspace_listing.json()["items"][0]["name"] == "note.txt"


def test_configure_rejects_invalid_workspace_root_without_mutating_snapshot(
    monkeypatch,
    tmp_path,
) -> None:
    monkeypatch.setenv("OPENAI_API_KEY", "test-openai-key")

    main_module = _reload_main(monkeypatch, tmp_path)
    client = TestClient(main_module.app)

    before = client.get("/config")
    assert before.status_code == 200
    original_workspace_root = before.json()["workspaceRoot"]

    missing_workspace = tmp_path / "missing-workspace"
    response = client.post(
        "/configure",
        json={"agent_workspace_root": str(missing_workspace)},
    )
    assert response.status_code == 400
    assert response.json() == {
        "detail": "workspace root does not exist",
        "code": "workspace_root_invalid",
    }

    after = client.get("/config")
    assert after.status_code == 200
    assert after.json()["workspaceRoot"] == original_workspace_root


def test_config_snapshot_returns_provider_and_model_profiles(
    monkeypatch,
    tmp_path,
) -> None:
    monkeypatch.setenv("OPENAI_API_KEY", "test-openai-key")

    main_module = _reload_main(monkeypatch, tmp_path)
    client = TestClient(main_module.app)

    response = client.get("/config")

    assert response.status_code == 200
    payload = response.json()
    assert "providerProfiles" in payload
    assert "modelProfiles" in payload
    assert payload["providerProfiles"][0]["id"] == "openai"
    assert payload["providerProfiles"][0]["authScheme"] == "api_key"
    assert payload["providerProfiles"][0]["apiKeyPresent"] is True
    assert payload["modelProfiles"][0]["provider_id"] == "openai"


def test_configure_custom_openai_compatible_provider_creates_launchable_presets(
    monkeypatch,
    tmp_path,
) -> None:
    monkeypatch.setenv("OPENAI_API_KEY", "test-openai-key")

    main_module = _reload_main(monkeypatch, tmp_path)
    client = TestClient(main_module.app)

    response = client.post(
        "/configure",
        json={
            "providerProfiles": [
                {
                    "id": "lab-gateway",
                    "label": "Lab Gateway",
                    "protocol": "openai-compatible",
                    "baseUrl": "https://gateway.example.com/v1",
                    "apiKey": "secret",
                    "enabled": True,
                }
            ],
            "modelProfiles": [
                {
                    "id": "lab-gpt5",
                    "providerId": "lab-gateway",
                    "modelName": "gpt-5.4",
                    "label": "GPT 5.4",
                    "capabilities": ["chat", "tools"],
                    "isDefault": True,
                    "enabled": True,
                }
            ],
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert any(
        preset_id.startswith("lab-gateway-")
        for preset_id in payload["preset_ids"]
    )


def test_configure_custom_provider_preserves_existing_builtin_provider_agents(
    monkeypatch,
    tmp_path,
) -> None:
    monkeypatch.setenv("OPENAI_API_KEY", "test-openai-key")

    main_module = _reload_main(monkeypatch, tmp_path)
    client = TestClient(main_module.app)

    response = client.post(
        "/configure",
        json={
            "providerProfiles": [
                {
                    "id": "lab-gateway",
                    "label": "Lab Gateway",
                    "protocol": "openai-compatible",
                    "baseUrl": "https://gateway.example.com/v1",
                    "apiKey": "secret",
                    "enabled": True,
                }
            ],
            "modelProfiles": [
                {
                    "id": "lab-gpt5",
                    "providerId": "lab-gateway",
                    "modelName": "gpt-5.4",
                    "label": "GPT 5.4",
                    "capabilities": ["chat", "tools"],
                    "isDefault": True,
                    "enabled": True,
                }
            ],
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert "openai-balanced" in payload["preset_ids"]
    assert any(
        preset_id.startswith("lab-gateway-")
        for preset_id in payload["preset_ids"]
    )
