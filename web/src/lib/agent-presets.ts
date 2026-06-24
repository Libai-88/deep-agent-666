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

type AgentPresetDefinition = {
  id: AgentPresetId;
  provider: ProviderKey;
  permissionMode: PermissionMode;
  label: string;
};

export const ALL_AGENT_PRESETS = [
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

export const DEFAULT_AGENT_PRESET_ID: AgentPresetId = ALL_AGENT_PRESETS.some(
  (preset) => preset.id === process.env.NEXT_PUBLIC_DEFAULT_AGENT_PRESET,
)
  ? (process.env.NEXT_PUBLIC_DEFAULT_AGENT_PRESET as AgentPresetId)
  : "openai-balanced";

export function resolvePresetId(
  provider: ProviderKey,
  permissionMode: PermissionMode,
): AgentPresetId {
  return `${provider}-${permissionMode}` as AgentPresetId;
}
