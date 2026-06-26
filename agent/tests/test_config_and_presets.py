from pathlib import Path

from app.config import AgentSettings, load_settings
from app.presets import ALL_PRESETS, DEFAULT_PRESET_ID, get_preset


def test_default_preset_exists() -> None:
    assert DEFAULT_PRESET_ID in ALL_PRESETS


def test_all_model_permission_pairs_exist() -> None:
    expected = {
        "openai-read-only",
        "openai-balanced",
        "openai-full-access",
        "anthropic-read-only",
        "anthropic-balanced",
        "anthropic-full-access",
        "google-read-only",
        "google-balanced",
        "google-full-access",
    }
    assert set(ALL_PRESETS) == expected


def test_get_preset_returns_metadata() -> None:
    preset = get_preset("openai-balanced")
    assert preset.model == "openai:gpt-4.1-mini"
    assert preset.permission_mode == "balanced"


def test_openai_presets_use_openai_models() -> None:
    for preset_id, preset in ALL_PRESETS.items():
        if not preset_id.startswith("openai-"):
            continue

        assert preset.model.startswith("openai:")
        assert "openrouter/" not in preset.model


def test_agent_settings_reads_expected_environment_variables(monkeypatch) -> None:
    workspace_root = Path("C:/tmp/deepagents-workspace")
    monkeypatch.setenv("AGENT_WORKSPACE_ROOT", str(workspace_root))
    monkeypatch.setenv("OPENAI_API_KEY", "openai-key")
    monkeypatch.setenv("ANTHROPIC_API_KEY", "anthropic-key")
    monkeypatch.setenv("GOOGLE_API_KEY", "google-key")

    settings = AgentSettings()

    assert settings.workspace_root == workspace_root
    assert settings.openai_api_key == "openai-key"
    assert settings.anthropic_api_key == "anthropic-key"
    assert settings.google_api_key == "google-key"


def test_load_settings_is_read_only_and_does_not_create_workspace(monkeypatch, tmp_path) -> None:
    workspace_root = tmp_path / "workspace"
    monkeypatch.setenv("AGENT_WORKSPACE_ROOT", str(workspace_root))
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    monkeypatch.delenv("OPENAI_BASE_URL", raising=False)
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.delenv("GOOGLE_API_KEY", raising=False)

    settings = AgentSettings(_env_file="")

    assert settings.workspace_root == workspace_root
    assert settings.openai_api_key is None
    assert settings.openai_base_url is None
    assert settings.anthropic_api_key is None
    assert settings.google_api_key is None
    assert not workspace_root.exists()
