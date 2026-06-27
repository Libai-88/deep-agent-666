from app.config import AgentSettings
from app.provider_registry import (
    load_provider_registry_from_settings,
    normalize_provider_registry_payload,
)


def test_load_provider_registry_from_legacy_settings_builds_builtin_profiles(tmp_path) -> None:
    settings = AgentSettings.model_construct(
        workspace_root=tmp_path,
        openai_api_key="sk-openai",
        openai_base_url="https://api.openai.com/v1",
        anthropic_api_key=None,
        anthropic_base_url=None,
        google_api_key=None,
        google_base_url=None,
    )

    snapshot = load_provider_registry_from_settings(settings)

    assert [provider.id for provider in snapshot.provider_profiles] == ["openai"]
    assert snapshot.provider_profiles[0].protocol == "openai"
    assert snapshot.provider_profiles[0].api_key_present is True
    assert snapshot.model_profiles[0].provider_id == "openai"
    assert snapshot.model_profiles[0].model_name == "gpt-4.1-mini"
    assert snapshot.model_profiles[0].is_default is True


def test_normalize_provider_registry_payload_accepts_custom_openai_compatible() -> None:
    payload = normalize_provider_registry_payload(
        {
            "workspaceRoot": "D:/AgentBuild",
            "providerProfiles": [
                {
                    "id": "lab-gateway",
                    "label": "Lab Gateway",
                    "protocol": "openai-compatible",
                    "baseUrl": "https://gateway.example.com/v1",
                    "apiKey": "secret",
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
        }
    )

    assert str(payload.workspace_root) == "D:\\AgentBuild"
    assert payload.provider_profiles[0].protocol == "openai-compatible"
    assert payload.provider_profiles[0].headers == {"X-Team": "chem"}
    assert payload.model_profiles[0].provider_id == "lab-gateway"
    assert payload.model_profiles[0].model_name == "gpt-5.4"
