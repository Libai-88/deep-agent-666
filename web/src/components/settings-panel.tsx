"use client";

import type { PermissionMode, ProviderKey } from "@/lib/agent-presets";

type SettingsPanelProps = {
  provider: ProviderKey;
  permissionMode: PermissionMode;
  onProviderChange: (provider: ProviderKey) => void;
  onPermissionModeChange: (mode: PermissionMode) => void;
};

export function SettingsPanel({
  provider,
  permissionMode,
  onProviderChange,
  onPermissionModeChange,
}: SettingsPanelProps) {
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
          <option value="openai">OpenAI</option>
          <option value="anthropic">Anthropic</option>
          <option value="google">Google</option>
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
          <option value="read-only">Read-only</option>
          <option value="balanced">Balanced</option>
          <option value="full-access">Full access</option>
        </select>
      </label>
    </div>
  );
}
