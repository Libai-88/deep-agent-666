import importlib
import json
import sys

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


def test_provider_probe_returns_ready_for_stubbed_model(
    monkeypatch,
    tmp_path,
) -> None:
    monkeypatch.setenv("OPENAI_API_KEY", "test-openai-key")

    main_module = _reload_main(monkeypatch, tmp_path)
    client = TestClient(main_module.app)

    monkeypatch.setattr(
        main_module,
        "probe_provider_model",
        lambda provider_profile, model_profile: {
            "status": "ready",
            "code": None,
            "message": "ok",
            "providerId": provider_profile["id"],
            "modelId": model_profile["id"],
        },
    )

    response = client.post(
        "/providers/probe",
        json={
            "providerProfile": {
                "id": "lab-gateway",
                "label": "Lab Gateway",
                "protocol": "openai-compatible",
                "baseUrl": "https://gateway.example.com/v1",
                "apiKey": "secret",
                "authScheme": "bearer_token",
                "enabled": True,
                "headers": {"X-Team": "chem"},
            },
            "modelProfile": {
                "id": "lab-gpt5",
                "providerId": "lab-gateway",
                "modelName": "gpt-5.4",
                "label": "GPT 5.4",
                "capabilities": ["chat", "tools"],
                "isDefault": True,
                "enabled": True,
            },
        },
    )

    assert response.status_code == 200
    assert response.json() == {
        "status": "ready",
        "code": None,
        "message": "ok",
        "providerId": "lab-gateway",
        "modelId": "lab-gpt5",
    }


def test_provider_probe_returns_invalid_config_for_bad_payload(
    monkeypatch,
    tmp_path,
) -> None:
    monkeypatch.setenv("OPENAI_API_KEY", "test-openai-key")

    main_module = _reload_main(monkeypatch, tmp_path)
    client = TestClient(main_module.app)

    response = client.post(
        "/providers/probe",
        json={
            "providerProfile": {
                "id": "lab-gateway",
                "label": "Lab Gateway",
                "protocol": "openai-compatible",
                "baseUrl": "https://gateway.example.com/v1",
                "apiKey": "secret",
                "authScheme": "bearer_token",
                "enabled": True,
                "headers": {},
            },
            "modelProfile": {
                "id": "lab-gpt5",
                "providerId": "missing-provider",
                "modelName": "gpt-5.4",
                "label": "GPT 5.4",
                "capabilities": ["chat", "tools"],
                "isDefault": True,
                "enabled": True,
            },
        },
    )

    assert response.status_code == 400
    assert response.json()["status"] == "invalid_config"
    assert response.json()["code"] == "provider_invalid_config"
