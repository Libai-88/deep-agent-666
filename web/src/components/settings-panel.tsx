"use client";

import type {
  AgentPresetDefinition,
  PermissionMode,
  ProviderKey,
} from "@/lib/agent-presets";

type SettingsPanelProps = {
  provider: ProviderKey;
  permissionMode: PermissionMode;
  presets: readonly AgentPresetDefinition[];
  onProviderChange: (provider: ProviderKey) => void;
  onPermissionModeChange: (mode: PermissionMode) => void;
};

export function SettingsPanel({
  provider,
  permissionMode,
  presets,
  onProviderChange,
  onPermissionModeChange,
}: SettingsPanelProps) {
  const providers = Array.from(new Set(presets.map((preset) => preset.provider)));
  const permissionModes = Array.from(
    new Set(
      presets
        .filter((preset) => preset.provider === provider)
        .map((preset) => preset.permissionMode),
    ),
  );

  return (
    <div
      style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12 }}
    >
      <label>
        Model
        <select
          value={provider}
          onChange={(event) =>
            onProviderChange(event.target.value as ProviderKey)
          }
        >
          {providers.map((availableProvider) => (
            <option key={availableProvider} value={availableProvider}>
              {availableProvider === "openai"
                ? "OpenAI"
                : availableProvider === "anthropic"
                  ? "Anthropic"
                  : "Google"}
            </option>
          ))}
        </select>
      </label>
      <label>
        Permission
        <select
          value={permissionMode}
          onChange={(event) =>
            onPermissionModeChange(event.target.value as PermissionMode)
          }
        >
          {permissionModes.map((availableMode) => (
            <option key={availableMode} value={availableMode}>
              {availableMode === "read-only"
                ? "Read-only"
                : availableMode === "balanced"
                  ? "Balanced"
                  : "Full access"}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
