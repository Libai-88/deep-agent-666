import type { AgentPresetId, PermissionMode } from "./agent-presets";

export function resolveThreadAgentId(
  presetId: AgentPresetId,
  permissionMode: PermissionMode,
): string {
  if (permissionMode === "read-only") {
    return presetId;
  }

  return `coordinator-${presetId}`;
}
