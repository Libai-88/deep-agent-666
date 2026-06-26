from pydantic import BaseModel

from app.permissions import PermissionMode


class AgentPreset(BaseModel):
    id: str
    label: str
    model: str
    permission_mode: PermissionMode


DEFAULT_PRESET_ID = "openai-balanced"


ALL_PRESETS: dict[str, AgentPreset] = {
    "openai-read-only": AgentPreset(
        id="openai-read-only",
        label="OpenAI / Read-only",
        model="openai:gpt-4.1-mini",
        permission_mode=PermissionMode.READ_ONLY,
    ),
    "openai-balanced": AgentPreset(
        id="openai-balanced",
        label="OpenAI / Balanced",
        model="openai:gpt-4.1-mini",
        permission_mode=PermissionMode.BALANCED,
    ),
    "openai-full-access": AgentPreset(
        id="openai-full-access",
        label="OpenAI / Full access",
        model="openai:gpt-4.1-mini",
        permission_mode=PermissionMode.FULL_ACCESS,
    ),
    "anthropic-read-only": AgentPreset(
        id="anthropic-read-only",
        label="Anthropic / Read-only",
        model="anthropic:claude-sonnet-4.5",
        permission_mode=PermissionMode.READ_ONLY,
    ),
    "anthropic-balanced": AgentPreset(
        id="anthropic-balanced",
        label="Anthropic / Balanced",
        model="anthropic:claude-sonnet-4.5",
        permission_mode=PermissionMode.BALANCED,
    ),
    "anthropic-full-access": AgentPreset(
        id="anthropic-full-access",
        label="Anthropic / Full access",
        model="anthropic:claude-sonnet-4.5",
        permission_mode=PermissionMode.FULL_ACCESS,
    ),
    "google-read-only": AgentPreset(
        id="google-read-only",
        label="Google / Read-only",
        model="google:gemini-2.5-flash",
        permission_mode=PermissionMode.READ_ONLY,
    ),
    "google-balanced": AgentPreset(
        id="google-balanced",
        label="Google / Balanced",
        model="google:gemini-2.5-flash",
        permission_mode=PermissionMode.BALANCED,
    ),
    "google-full-access": AgentPreset(
        id="google-full-access",
        label="Google / Full access",
        model="google:gemini-2.5-flash",
        permission_mode=PermissionMode.FULL_ACCESS,
    ),
}


def get_preset(preset_id: str) -> AgentPreset:
    return ALL_PRESETS[preset_id]
