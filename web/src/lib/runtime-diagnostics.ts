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

export type RuntimeDiagnosticsRegistryProvider = {
  id: string;
  label: string;
  protocol: string;
  authScheme: string;
  baseUrl: string | null;
  enabled: boolean;
  apiKeyPresent: boolean;
  modelCount: number;
  defaultModel: string | null;
};

export type RuntimeDiagnostics = {
  status: RuntimeDiagnosticsStatus;
  backendReachable: boolean;
  catalogSource: CatalogSource;
  launchablePresetCount: number;
  configuredProviderCount: number;
  workspaceRoot: string | null;
  providers: RuntimeSettings["providers"];
  registryProviders: RuntimeDiagnosticsRegistryProvider[];
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
  const registryProviders = input.runtimeSettings.providerProfiles.map((profile) => {
    const linkedModels = input.runtimeSettings.modelProfiles.filter(
      (model) => model.providerId === profile.id,
    );
    const defaultModel =
      linkedModels.find((model) => model.enabled && model.isDefault)?.label ??
      linkedModels.find((model) => model.enabled)?.label ??
      null;

    return {
      id: profile.id,
      label: profile.label,
      protocol: profile.protocol,
      authScheme: profile.authScheme,
      baseUrl: profile.baseUrl,
      enabled: profile.enabled,
      apiKeyPresent: profile.apiKeyPresent,
      modelCount: linkedModels.length,
      defaultModel,
    };
  });

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
    registryProviders,
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
    providerProfiles: payload.providerProfiles,
    modelProfiles: payload.modelProfiles,
    providers: payload.providers,
  });

  const fallbackDiagnostics = buildRuntimeDiagnostics({
    backendReachable: normalizeBoolean(payload.backendReachable),
    catalogSource: normalizeCatalogSource(payload.catalogSource),
    launchablePresetCount: normalizeCount(payload.launchablePresetCount),
    runtimeSettings,
    checkedAt: normalizeCheckedAt(payload.checkedAt),
  });

  return {
    status: normalizeStatus(payload.status),
    backendReachable: normalizeBoolean(payload.backendReachable),
    catalogSource: normalizeCatalogSource(payload.catalogSource),
    launchablePresetCount: normalizeCount(payload.launchablePresetCount),
    configuredProviderCount: normalizeCount(payload.configuredProviderCount),
    workspaceRoot: runtimeSettings.workspaceRoot,
    providers: runtimeSettings.providers,
    registryProviders: Array.isArray(payload.registryProviders)
      ? payload.registryProviders.filter(isRecord).map((provider) => ({
          id: typeof provider.id === "string" ? provider.id : "",
          label: typeof provider.label === "string" ? provider.label : "",
          protocol:
            typeof provider.protocol === "string" ? provider.protocol : "",
          authScheme:
            typeof provider.authScheme === "string"
              ? provider.authScheme
              : typeof provider.auth_scheme === "string"
                ? provider.auth_scheme
                : "api_key",
          baseUrl:
            typeof provider.baseUrl === "string"
              ? provider.baseUrl
              : typeof provider.base_url === "string"
                ? provider.base_url
                : null,
          enabled: normalizeBoolean(provider.enabled),
          apiKeyPresent:
            provider.apiKeyPresent === true || provider.api_key_present === true,
          modelCount: normalizeCount(provider.modelCount ?? provider.model_count),
          defaultModel:
            typeof provider.defaultModel === "string"
              ? provider.defaultModel
              : typeof provider.default_model === "string"
                ? provider.default_model
                : null,
        }))
      : fallbackDiagnostics.registryProviders,
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
