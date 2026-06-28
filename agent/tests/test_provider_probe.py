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


def test_provider_probe_reuses_stored_secret_when_not_resubmitted(
    monkeypatch,
    tmp_path,
) -> None:
    monkeypatch.setenv("OPENAI_API_KEY", "test-openai-key")

    main_module = _reload_main(monkeypatch, tmp_path)
    client = TestClient(main_module.app)

    configure_response = client.post(
      "/configure",
      json={
          "providerProfiles": [
              {
                  "id": "lab-gateway",
                  "label": "Lab Gateway",
                  "protocol": "openai-compatible",
                  "baseUrl": "https://gateway.example.com/v1",
                  "apiKey": "secret",
                  "authScheme": "bearer_token",
                  "enabled": True,
                  "headers": {"X-Team": "chem"},
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
    assert configure_response.status_code == 200

    captured: dict[str, str | None] = {"api_key": None}

    class _StubModel:
        def invoke(self, _prompt: str) -> str:
            return "ok"

    def _fake_build_runtime_model(**kwargs):
        registry_snapshot = kwargs["registry_snapshot"]
        captured["api_key"] = registry_snapshot.provider_profiles[0].api_key
        return _StubModel()

    monkeypatch.setattr(main_module, "build_runtime_model", _fake_build_runtime_model)

    response = client.post(
        "/providers/probe",
        json={
            "providerProfile": {
                "id": "lab-gateway",
                "label": "Lab Gateway",
                "protocol": "openai-compatible",
                "baseUrl": "https://gateway.example.com/v1",
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
    assert response.json()["status"] == "ready"
    assert captured["api_key"] == "secret"
