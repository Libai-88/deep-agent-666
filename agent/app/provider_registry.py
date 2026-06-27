from __future__ import annotations

from pathlib import Path
from typing import Literal

from pydantic import BaseModel, Field

from app.config import AgentSettings, normalize_runtime_workspace_root
from app.presets import BUILTIN_PROVIDER_DEFAULT_MODELS


ProviderProtocol = Literal["openai", "anthropic", "google", "openai-compatible"]
ModelCapability = Literal["chat", "tools", "vision", "long_context"]


class ProviderProfile(BaseModel):
    id: str
    label: str
    protocol: ProviderProtocol
    base_url: str | None = None
    auth_scheme: str = "api_key"
    api_key: str | None = Field(default=None, repr=False)
    headers: dict[str, str] = Field(default_factory=dict)
    enabled: bool = True

    @property
    def api_key_present(self) -> bool:
        return bool(self.api_key)


class ModelProfile(BaseModel):
    id: str
    provider_id: str
    model_name: str
    label: str
    capabilities: list[ModelCapability] = Field(default_factory=list)
    is_default: bool = False
    enabled: bool = True


class ProviderRegistrySnapshot(BaseModel):
    workspace_root: Path
    provider_profiles: list[ProviderProfile] = Field(default_factory=list)
    model_profiles: list[ModelProfile] = Field(default_factory=list)


def _provider_label(provider_id: str) -> str:
    if provider_id == "openai":
        return "OpenAI"
    if provider_id == "anthropic":
        return "Anthropic"
    if provider_id == "google":
        return "Google"
    return provider_id


def _provider_api_key(settings: AgentSettings, provider_id: str) -> str | None:
    if provider_id == "openai":
        return settings.openai_api_key
    if provider_id == "anthropic":
        return settings.anthropic_api_key
    if provider_id == "google":
        return settings.google_api_key
    return None


def _provider_base_url(settings: AgentSettings, provider_id: str) -> str | None:
    if provider_id == "openai":
        return settings.openai_base_url
    if provider_id == "anthropic":
        return settings.anthropic_base_url
    if provider_id == "google":
        return settings.google_base_url
    return None


def load_provider_registry_from_settings(
    settings: AgentSettings,
) -> ProviderRegistrySnapshot:
    provider_profiles: list[ProviderProfile] = []
    model_profiles: list[ModelProfile] = []

    for provider_id, model_name in BUILTIN_PROVIDER_DEFAULT_MODELS.items():
        api_key = _provider_api_key(settings, provider_id)
        if not api_key:
            continue

        provider_profiles.append(
            ProviderProfile(
                id=provider_id,
                label=_provider_label(provider_id),
                protocol=provider_id,
                base_url=_provider_base_url(settings, provider_id),
                api_key=api_key,
            )
        )
        model_profiles.append(
            ModelProfile(
                id=f"{provider_id}-default",
                provider_id=provider_id,
                model_name=model_name,
                label=model_name,
                capabilities=["chat", "tools"],
                is_default=True,
            )
        )

    return ProviderRegistrySnapshot(
        workspace_root=settings.workspace_root,
        provider_profiles=provider_profiles,
        model_profiles=model_profiles,
    )


def _normalize_provider_profile(value: object) -> ProviderProfile:
    if not isinstance(value, dict):
        raise ValueError("provider profile must be an object")

    profile = ProviderProfile(
        id=str(value["id"]),
        label=str(value["label"]),
        protocol=str(value["protocol"]),
        base_url=_read_optional_string(value, "baseUrl", "base_url"),
        auth_scheme=_read_optional_string(value, "authScheme", "auth_scheme")
        or "api_key",
        api_key=_read_optional_string(value, "apiKey", "api_key"),
        headers=_read_string_map(value.get("headers")),
        enabled=_read_optional_bool(value, "enabled", default=True),
    )
    return profile


def _normalize_model_profile(value: object) -> ModelProfile:
    if not isinstance(value, dict):
        raise ValueError("model profile must be an object")

    raw_capabilities = value.get("capabilities")
    capabilities: list[ModelCapability] = []
    if isinstance(raw_capabilities, list):
        capabilities = [str(item) for item in raw_capabilities]

    return ModelProfile(
        id=str(value["id"]),
        provider_id=str(value.get("providerId") or value["provider_id"]),
        model_name=str(value.get("modelName") or value["model_name"]),
        label=str(value["label"]),
        capabilities=capabilities,
        is_default=_read_optional_bool(value, "isDefault", "is_default", default=False),
        enabled=_read_optional_bool(value, "enabled", default=True),
    )


def _read_optional_string(
    value: dict[str, object],
    *keys: str,
) -> str | None:
    for key in keys:
        candidate = value.get(key)
        if isinstance(candidate, str):
            text = candidate.strip()
            return text or None
    return None


def _read_optional_bool(
    value: dict[str, object],
    *keys: str,
    default: bool,
) -> bool:
    for key in keys:
        candidate = value.get(key)
        if isinstance(candidate, bool):
            return candidate
    return default


def _read_string_map(value: object) -> dict[str, str]:
    if not isinstance(value, dict):
        return {}

    headers: dict[str, str] = {}
    for key, item in value.items():
        if isinstance(key, str) and isinstance(item, str):
            headers[key] = item
    return headers


def normalize_provider_registry_payload(
    payload: object,
) -> ProviderRegistrySnapshot:
    if not isinstance(payload, dict):
        raise ValueError("provider registry payload must be an object")

    workspace_root = normalize_runtime_workspace_root(
        payload.get("workspaceRoot") or payload["workspace_root"]
    )
    provider_profiles = [
        _normalize_provider_profile(item)
        for item in payload.get("providerProfiles", payload.get("provider_profiles", []))
    ]
    model_profiles = [
        _normalize_model_profile(item)
        for item in payload.get("modelProfiles", payload.get("model_profiles", []))
    ]

    return ProviderRegistrySnapshot(
        workspace_root=workspace_root,
        provider_profiles=provider_profiles,
        model_profiles=model_profiles,
    )
