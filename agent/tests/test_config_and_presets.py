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
    assert preset.model == "openai:gpt-5-mini"
    assert preset.permission_mode == "balanced"
