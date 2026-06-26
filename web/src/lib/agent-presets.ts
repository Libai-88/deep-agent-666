export type ProviderKey = "openai" | "anthropic" | "google";
export type PermissionMode = "read-only" | "balanced" | "full-access";
export type AgentPresetId =
  | "openai-read-only"
  | "openai-balanced"
  | "openai-full-access"
  | "anthropic-read-only"
  | "anthropic-balanced"
  | "anthropic-full-access"
  | "google-read-only"
  | "google-balanced"
  | "google-full-access";

export type AgentPresetDefinition = {
  id: AgentPresetId;
  provider: ProviderKey;
  permissionMode: PermissionMode;
  label: string;
};

export type AgentPresetCatalog = {
  defaultPresetId: AgentPresetId | null;
  presets: AgentPresetDefinition[];
};

// Static preset definitions (must match agent/app/presets.py)
// If you add/remove/rename presets in presets.py, update this list too.
export const ALL_AGENT_PRESETS: AgentPresetDefinition[] = [
  {
    id: "openai-read-only",
    provider: "openai",
    permissionMode: "read-only",
    label: "OpenAI / Read-only",
  },
  {
    id: "openai-balanced",
    provider: "openai",
    permissionMode: "balanced",
    label: "OpenAI / Balanced",
  },
  {
    id: "openai-full-access",
    provider: "openai",
    permissionMode: "full-access",
    label: "OpenAI / Full access",
  },
  {
    id: "anthropic-read-only",
    provider: "anthropic",
    permissionMode: "read-only",
    label: "Anthropic / Read-only",
  },
  {
    id: "anthropic-balanced",
    provider: "anthropic",
    permissionMode: "balanced",
    label: "Anthropic / Balanced",
  },
  {
    id: "anthropic-full-access",
    provider: "anthropic",
    permissionMode: "full-access",
    label: "Anthropic / Full access",
  },
  {
    id: "google-read-only",
    provider: "google",
    permissionMode: "read-only",
    label: "Google / Read-only",
  },
  {
    id: "google-balanced",
    provider: "google",
    permissionMode: "balanced",
    label: "Google / Balanced",
  },
  {
    id: "google-full-access",
    provider: "google",
    permissionMode: "full-access",
    label: "Google / Full access",
  },
] as const satisfies readonly AgentPresetDefinition[];

export const KNOWN_AGENT_PRESET_IDS = ALL_AGENT_PRESETS.map(
  (preset) => preset.id,
);

export const DEFAULT_AGENT_PRESET_ID: AgentPresetId = ALL_AGENT_PRESETS.some(
  (preset) => preset.id === process.env.NEXT_PUBLIC_DEFAULT_AGENT_PRESET,
)
  ? (process.env.NEXT_PUBLIC_DEFAULT_AGENT_PRESET as AgentPresetId)
  : "openai-balanced";

export const STATIC_AGENT_PRESET_CATALOG: AgentPresetCatalog = {
  defaultPresetId: DEFAULT_AGENT_PRESET_ID,
  presets: [...ALL_AGENT_PRESETS],
};

export function isAgentPresetId(value: string): value is AgentPresetId {
  return KNOWN_AGENT_PRESET_IDS.includes(value as AgentPresetId);
}

export function parsePresetId(presetId: AgentPresetId): {
  provider: ProviderKey;
  permissionMode: PermissionMode;
} {
  const separatorIndex = presetId.indexOf("-");

  return {
    provider: presetId.slice(0, separatorIndex) as ProviderKey,
    permissionMode: presetId.slice(separatorIndex + 1) as PermissionMode,
  };
}

export function findPresetById(
  presets: readonly AgentPresetDefinition[],
  presetId: AgentPresetId,
): AgentPresetDefinition | undefined {
  return presets.find((preset) => preset.id === presetId);
}

export function resolveDefaultPresetId(
  catalog: AgentPresetCatalog,
): AgentPresetId | null {
  if (
    catalog.defaultPresetId &&
    findPresetById(catalog.presets, catalog.defaultPresetId)
  ) {
    return catalog.defaultPresetId;
  }

  return catalog.presets[0]?.id ?? null;
}

export function resolvePresetId(
  provider: ProviderKey,
  permissionMode: PermissionMode,
): AgentPresetId {
  return `${provider}-${permissionMode}` as AgentPresetId;
}
