import json
import logging
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

from app.provider_registry import (
    ProviderRegistrySnapshot,
    load_provider_registry_from_settings,
    normalize_provider_registry_payload,
    serialize_provider_registry_snapshot,
)
from app.presets import BUILTIN_PROVIDER_DEFAULT_MODELS

logger = logging.getLogger(__name__)


class AgentSettings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    workspace_root: Path = Field(alias="AGENT_WORKSPACE_ROOT")
    openai_api_key: str | None = Field(default=None, alias="OPENAI_API_KEY")
    openai_base_url: str | None = Field(default=None, alias="OPENAI_BASE_URL")
    anthropic_api_key: str | None = Field(default=None, alias="ANTHROPIC_API_KEY")
    anthropic_base_url: str | None = Field(default=None, alias="ANTHROPIC_BASE_URL")
    google_api_key: str | None = Field(default=None, alias="GOOGLE_API_KEY")
    google_base_url: str | None = Field(default=None, alias="GOOGLE_BASE_URL")
    provider_registry_path: Path = Field(
        default=Path("data/provider-registry.json"),
        alias="AGENT_PROVIDER_REGISTRY_PATH",
    )


def load_settings() -> AgentSettings:
    return AgentSettings()


def normalize_runtime_workspace_root(value: str | Path) -> Path:
    candidate = Path(value).expanduser().resolve()
    if not candidate.exists():
        raise ValueError("workspace root does not exist")
    if not candidate.is_dir():
        raise ValueError("workspace root is not a directory")
    return candidate


class ConfigStore:
    """Runtime-mutable configuration, reloadable without restarting the process."""

    def __init__(self, settings: AgentSettings) -> None:
        self._settings = settings
        self._provider_registry_path = settings.provider_registry_path.expanduser().resolve()
        self._provider_registry_snapshot = load_provider_registry_from_settings(settings)
        persisted_snapshot = self._load_persisted_provider_registry_snapshot()
        if persisted_snapshot is not None:
            self.provider_registry_snapshot = persisted_snapshot
        else:
            self._persist_provider_registry_snapshot()

    def _load_persisted_provider_registry_snapshot(
        self,
    ) -> ProviderRegistrySnapshot | None:
        if not self._provider_registry_path.exists():
            return None

        try:
            payload = json.loads(
                self._provider_registry_path.read_text(encoding="utf-8")
            )
            return normalize_provider_registry_payload(payload)
        except Exception as exc:  # noqa: BLE001
            logger.warning(
                "Failed to load persisted provider registry from %s: %s",
                self._provider_registry_path,
                exc,
            )
            return None

    def _persist_provider_registry_snapshot(self) -> None:
        self._provider_registry_path.parent.mkdir(parents=True, exist_ok=True)
        payload = serialize_provider_registry_snapshot(
            self._provider_registry_snapshot,
            include_secrets=True,
        )
        temp_path = self._provider_registry_path.with_suffix(
            f"{self._provider_registry_path.suffix}.tmp"
        )
        temp_path.write_text(
            json.dumps(payload, indent=2),
            encoding="utf-8",
        )
        temp_path.replace(self._provider_registry_path)

    def snapshot(self) -> AgentSettings:
        return self._settings.model_copy(deep=True)

    @property
    def provider_registry_snapshot(self) -> ProviderRegistrySnapshot:
        return self._provider_registry_snapshot.model_copy(deep=True)

    @provider_registry_snapshot.setter
    def provider_registry_snapshot(self, value: ProviderRegistrySnapshot) -> None:
        self._settings.workspace_root = value.workspace_root
        builtin_profiles = {
            profile.id: profile
            for profile in value.provider_profiles
            if profile.id in BUILTIN_PROVIDER_DEFAULT_MODELS
        }
        openai = builtin_profiles.get("openai")
        anthropic = builtin_profiles.get("anthropic")
        google = builtin_profiles.get("google")

        self._settings.openai_api_key = openai.api_key if openai else None
        self._settings.openai_base_url = openai.base_url if openai else None
        self._settings.anthropic_api_key = anthropic.api_key if anthropic else None
        self._settings.anthropic_base_url = anthropic.base_url if anthropic else None
        self._settings.google_api_key = google.api_key if google else None
        self._settings.google_base_url = google.base_url if google else None
        self._provider_registry_snapshot = value.model_copy(deep=True)
        self._persist_provider_registry_snapshot()

    def _sync_builtin_provider_registry_entries(self) -> None:
        builtin_snapshot = load_provider_registry_from_settings(self._settings)
        custom_provider_profiles = [
            profile
            for profile in self._provider_registry_snapshot.provider_profiles
            if profile.id not in BUILTIN_PROVIDER_DEFAULT_MODELS
        ]
        custom_model_profiles = [
            profile
            for profile in self._provider_registry_snapshot.model_profiles
            if profile.provider_id not in BUILTIN_PROVIDER_DEFAULT_MODELS
        ]
        self._provider_registry_snapshot = ProviderRegistrySnapshot(
            workspace_root=self._settings.workspace_root,
            provider_profiles=[
                *builtin_snapshot.provider_profiles,
                *custom_provider_profiles,
            ],
            model_profiles=[
                *builtin_snapshot.model_profiles,
                *custom_model_profiles,
            ],
        )
        self._persist_provider_registry_snapshot()

    @property
    def workspace_root(self) -> Path:
        return self._settings.workspace_root

    @workspace_root.setter
    def workspace_root(self, value: Path) -> None:
        self._settings.workspace_root = value
        self._provider_registry_snapshot.workspace_root = value
        self._persist_provider_registry_snapshot()

    @property
    def openai_api_key(self) -> str | None:
        return self._settings.openai_api_key

    @openai_api_key.setter
    def openai_api_key(self, value: str | None) -> None:
        self._settings.openai_api_key = value
        self._sync_builtin_provider_registry_entries()

    @property
    def openai_base_url(self) -> str | None:
        return self._settings.openai_base_url

    @openai_base_url.setter
    def openai_base_url(self, value: str | None) -> None:
        self._settings.openai_base_url = value
        self._sync_builtin_provider_registry_entries()

    @property
    def anthropic_api_key(self) -> str | None:
        return self._settings.anthropic_api_key

    @anthropic_api_key.setter
    def anthropic_api_key(self, value: str | None) -> None:
        self._settings.anthropic_api_key = value
        self._sync_builtin_provider_registry_entries()

    @property
    def anthropic_base_url(self) -> str | None:
        return self._settings.anthropic_base_url

    @anthropic_base_url.setter
    def anthropic_base_url(self, value: str | None) -> None:
        self._settings.anthropic_base_url = value
        self._sync_builtin_provider_registry_entries()

    @property
    def google_api_key(self) -> str | None:
        return self._settings.google_api_key

    @google_api_key.setter
    def google_api_key(self, value: str | None) -> None:
        self._settings.google_api_key = value
        self._sync_builtin_provider_registry_entries()

    @property
    def google_base_url(self) -> str | None:
        return self._settings.google_base_url

    @google_base_url.setter
    def google_base_url(self, value: str | None) -> None:
        self._settings.google_base_url = value
        self._sync_builtin_provider_registry_entries()
