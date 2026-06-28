import {
  DEFAULT_AGENT_PRESET_ID,
  type AgentPresetCatalog,
  type AgentPresetDefinition,
  type AgentPresetId,
  parsePresetId,
  resolveDefaultPresetId,
  type PermissionMode,
} from "./agent-presets";

export type CatalogSource = "live" | "fallback";
export type CatalogState = {
  catalog: AgentPresetCatalog;
  source: CatalogSource;
};

const DEFAULT_CATALOG: AgentPresetCatalog = {
  defaultPresetId: DEFAULT_AGENT_PRESET_ID,
  presets: [],
};

function isPresetRecord(value: unknown): value is {
  id: string;
  label: string;
  permission_mode: string;
} {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  // Accept both snake_case (raw backend) and camelCase (already-normalized) formats
  return (
    typeof candidate.id === "string" &&
    typeof candidate.label === "string" &&
    (typeof candidate.permission_mode === "string" ||
     typeof candidate.permissionMode === "string")
  );
}

function normalizePermissionMode(value: unknown): PermissionMode | null {
  if (
    value === "read-only" ||
    value === "balanced" ||
    value === "full-access"
  ) {
    return value;
  }

  return null;
}

function toPresetDefinition(value: {
  id: AgentPresetId;
  label: string;
  provider?: string;
  permissionMode?: PermissionMode | null;
}): AgentPresetDefinition {
  const parsed = parsePresetId(value.id);

  return {
    id: value.id,
    label: value.label,
    provider: value.provider ?? parsed.provider,
    permissionMode: value.permissionMode ?? parsed.permissionMode,
  };
}

export function normalizePresetCatalog(payload: unknown): AgentPresetCatalog {
  if (!payload || typeof payload !== "object") {
    return DEFAULT_CATALOG;
  }

  const candidate = payload as Record<string, unknown>;
  const rawPresets = Array.isArray(candidate.presets) ? candidate.presets : [];
  const presets = rawPresets.reduce<AgentPresetDefinition[]>((result, preset) => {
    if (!isPresetRecord(preset)) {
      return result;
    }

    const provider =
      typeof (preset as Record<string, unknown>).provider === "string"
        ? ((preset as Record<string, unknown>).provider as string)
        : typeof (preset as Record<string, unknown>).provider_id === "string"
          ? ((preset as Record<string, unknown>).provider_id as string)
          : undefined;
    const permissionMode = normalizePermissionMode(
      (preset as Record<string, unknown>).permissionMode ??
        (preset as Record<string, unknown>).permission_mode,
    );
    if (!permissionMode) {
      return result;
    }

    result.push(
      toPresetDefinition({
        id: preset.id,
        label: preset.label,
        provider,
        permissionMode,
      }),
    );
    return result;
  }, []);

  const rawDefaultPresetId =
    typeof candidate.defaultPresetId === "string"
      ? candidate.defaultPresetId
      : typeof candidate.default_preset_id === "string"
        ? candidate.default_preset_id
        : null;
  const defaultPresetId =
    typeof rawDefaultPresetId === "string" &&
    presets.some((preset) => preset.id === rawDefaultPresetId)
      ? rawDefaultPresetId
      : null;

  const catalog = {
    defaultPresetId,
    presets,
  };

  return {
    defaultPresetId: resolveDefaultPresetId(catalog),
    presets,
  };
}

export async function fetchPresetCatalog(
  baseUrl: string,
  init?: RequestInit,
): Promise<AgentPresetCatalog> {
  return fetchPresetCatalogFromUrl(
    `${baseUrl.replace(/\/$/, "")}/presets`,
    init,
  );
}

export async function fetchPresetCatalogFromUrl(
  url: string,
  init?: RequestInit,
): Promise<AgentPresetCatalog> {
  const response = await fetch(url, init);

  if (!response.ok) {
    throw new Error(`Failed to load presets: ${response.status}`);
  }

  const payload = (await response.json()) as unknown;

  return normalizePresetCatalog(payload);
}

export async function fetchCatalogStateFromUrl(
  url: string,
  init?: RequestInit,
): Promise<CatalogState> {
  const response = await fetch(url, init);

  if (!response.ok) {
    throw new Error(`Failed to load preset state: ${response.status}`);
  }

  const payload = (await response.json()) as {
    source?: unknown;
  };

  return {
    catalog: normalizePresetCatalog(payload),
    source: payload.source === "live" ? "live" : "fallback",
  };
}
