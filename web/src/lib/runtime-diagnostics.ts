import type { CatalogSource } from "./preset-catalog";
import {
  normalizeRuntimeSettings,
  type RuntimeSettings,
} from "./runtime-settings";

export type RuntimeDiagnosticsStatus =
  | "healthy"
  | "setup-required"
  | "degraded"
  | "offline";

export type RuntimeDiagnostics = {
  status: RuntimeDiagnosticsStatus;
  backendReachable: boolean;
  catalogSource: CatalogSource;
  launchablePresetCount: number;
  configuredProviderCount: number;
  workspaceRoot: string | null;
  providers: RuntimeSettings["providers"];
  checkedAt: string;
};

type RuntimeDiagnosticsInput = {
  backendReachable: boolean;
  catalogSource: CatalogSource;
  launchablePresetCount: number;
  runtimeSettings: RuntimeSettings;
  checkedAt?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function normalizeBoolean(value: unknown): boolean {
  return value === true;
}

function normalizeStatus(value: unknown): RuntimeDiagnosticsStatus {
  switch (value) {
    case "healthy":
    case "setup-required":
    case "degraded":
    case "offline":
      return value;
    default:
      return "offline";
  }
}

function normalizeCatalogSource(value: unknown): CatalogSource {
  return value === "live" ? "live" : "fallback";
}

function normalizeCheckedAt(value: unknown): string {
  return typeof value === "string" && value ? value : new Date(0).toISOString();
}

function normalizeCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : 0;
}

export function countConfiguredProviders(settings: RuntimeSettings): number {
  return Object.values(settings.providers).filter(
    (provider) => provider.configured,
  ).length;
}

export function resolveRuntimeDiagnosticsStatus(
  input: Omit<RuntimeDiagnosticsInput, "runtimeSettings" | "checkedAt"> & {
    configuredProviderCount: number;
  },
): RuntimeDiagnosticsStatus {
  if (!input.backendReachable) {
    return input.launchablePresetCount > 0 ? "degraded" : "offline";
  }

  if (input.launchablePresetCount === 0 || input.configuredProviderCount === 0) {
    return "setup-required";
  }

  if (input.catalogSource === "fallback") {
    return "degraded";
  }

  return "healthy";
}

export function buildRuntimeDiagnostics(
  input: RuntimeDiagnosticsInput,
): RuntimeDiagnostics {
  const configuredProviderCount = countConfiguredProviders(input.runtimeSettings);

  return {
    status: resolveRuntimeDiagnosticsStatus({
      backendReachable: input.backendReachable,
      catalogSource: input.catalogSource,
      launchablePresetCount: input.launchablePresetCount,
      configuredProviderCount,
    }),
    backendReachable: input.backendReachable,
    catalogSource: input.catalogSource,
    launchablePresetCount: input.launchablePresetCount,
    configuredProviderCount,
    workspaceRoot: input.runtimeSettings.workspaceRoot,
    providers: input.runtimeSettings.providers,
    checkedAt: input.checkedAt ?? new Date().toISOString(),
  };
}

export function normalizeRuntimeDiagnostics(
  payload: unknown,
): RuntimeDiagnostics {
  if (!isRecord(payload)) {
    return buildRuntimeDiagnostics({
      backendReachable: false,
      catalogSource: "fallback",
      launchablePresetCount: 0,
      runtimeSettings: normalizeRuntimeSettings(null),
      checkedAt: new Date(0).toISOString(),
    });
  }

  const runtimeSettings = normalizeRuntimeSettings({
    workspaceRoot: payload.workspaceRoot,
    providers: payload.providers,
  });

  return {
    status: normalizeStatus(payload.status),
    backendReachable: normalizeBoolean(payload.backendReachable),
    catalogSource: normalizeCatalogSource(payload.catalogSource),
    launchablePresetCount: normalizeCount(payload.launchablePresetCount),
    configuredProviderCount: normalizeCount(payload.configuredProviderCount),
    workspaceRoot: runtimeSettings.workspaceRoot,
    providers: runtimeSettings.providers,
    checkedAt: normalizeCheckedAt(payload.checkedAt),
  };
}

export function resolveRuntimeDiagnosticsLabel(
  status: RuntimeDiagnosticsStatus,
): string {
  switch (status) {
    case "healthy":
      return "Healthy";
    case "setup-required":
      return "Setup required";
    case "degraded":
      return "Degraded";
    case "offline":
      return "Offline";
  }
}
