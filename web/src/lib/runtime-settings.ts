type ProviderKey = "openai" | "anthropic" | "google";
export type RuntimeProviderProtocol =
  | "openai"
  | "anthropic"
  | "google"
  | "openai-compatible";
export type RuntimeProviderAuthScheme = "api_key" | "bearer_token";

export type RuntimeModelCapability =
  | "chat"
  | "tools"
  | "vision"
  | "long_context";

type RuntimeProviderSettings = {
  configured: boolean;
  baseUrl: string | null;
};

export type RuntimeProviderProfile = {
  id: string;
  label: string;
  protocol: RuntimeProviderProtocol;
  authScheme: RuntimeProviderAuthScheme;
  baseUrl: string | null;
  apiKeyPresent: boolean;
  headers: Record<string, string>;
  enabled: boolean;
};

export type RuntimeModelProfile = {
  id: string;
  providerId: string;
  modelName: string;
  label: string;
  capabilities: RuntimeModelCapability[];
  isDefault: boolean;
  enabled: boolean;
};

export type RuntimeSettings = {
  workspaceRoot: string | null;
  providerProfiles: RuntimeProviderProfile[];
  modelProfiles: RuntimeModelProfile[];
  providers: Record<ProviderKey, RuntimeProviderSettings>;
};

type RuntimeConfigInput = {
  workspaceRoot: string;
  apiKeys: Record<ProviderKey, string>;
  baseUrls: Record<ProviderKey, string>;
  providerProfiles?: Array<{
    id: string;
    label: string;
    protocol: RuntimeProviderProtocol;
    authScheme: RuntimeProviderAuthScheme;
    baseUrl: string | null;
    apiKey?: string;
    enabled: boolean;
    headers: Record<string, string>;
  }>;
  modelProfiles?: Array<{
    id: string;
    providerId: string;
    modelName: string;
    label: string;
    capabilities: RuntimeModelCapability[];
    isDefault: boolean;
    enabled: boolean;
  }>;
};

const PROVIDER_KEYS: ProviderKey[] = ["openai", "anthropic", "google"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function normalizeProviderSettings(value: unknown): RuntimeProviderSettings {
  if (!isRecord(value)) {
    return {
      configured: false,
      baseUrl: null,
    };
  }

  return {
    configured: value.configured === true,
    baseUrl:
      typeof value.baseUrl === "string"
        ? value.baseUrl
        : typeof value.base_url === "string"
          ? value.base_url
          : null,
  };
}

function normalizeProviderProfile(value: unknown): RuntimeProviderProfile | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = typeof value.id === "string" ? value.id : null;
  const label = typeof value.label === "string" ? value.label : null;
  const protocol = typeof value.protocol === "string" ? value.protocol : null;
  if (!id || !label || !protocol) {
    return null;
  }
  const authScheme =
    typeof value.authScheme === "string"
      ? value.authScheme
      : typeof value.auth_scheme === "string"
        ? value.auth_scheme
        : "api_key";

  return {
    id,
    label,
    protocol: protocol as RuntimeProviderProtocol,
    authScheme: authScheme as RuntimeProviderAuthScheme,
    baseUrl:
      typeof value.baseUrl === "string"
        ? value.baseUrl
        : typeof value.base_url === "string"
          ? value.base_url
          : null,
    apiKeyPresent:
      value.apiKeyPresent === true || value.api_key_present === true,
    headers: isRecord(value.headers)
      ? Object.fromEntries(
          Object.entries(value.headers).filter(
            (entry): entry is [string, string] => typeof entry[1] === "string",
          ),
        )
      : {},
    enabled: value.enabled !== false,
  };
}

function normalizeModelProfile(value: unknown): RuntimeModelProfile | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = typeof value.id === "string" ? value.id : null;
  const providerId =
    typeof value.providerId === "string"
      ? value.providerId
      : typeof value.provider_id === "string"
        ? value.provider_id
        : null;
  const modelName =
    typeof value.modelName === "string"
      ? value.modelName
      : typeof value.model_name === "string"
        ? value.model_name
        : null;
  const label = typeof value.label === "string" ? value.label : null;
  if (!id || !providerId || !modelName || !label) {
    return null;
  }

  const capabilities = Array.isArray(value.capabilities)
    ? value.capabilities.filter(
        (item): item is RuntimeModelCapability => typeof item === "string",
      )
    : [];

  return {
    id,
    providerId,
    modelName,
    label,
    capabilities,
    isDefault: value.isDefault === true || value.is_default === true,
    enabled: value.enabled !== false,
  };
}

export function normalizeRuntimeSettings(payload: unknown): RuntimeSettings {
  const candidate = isRecord(payload) ? payload : {};
  const providers = isRecord(candidate.providers) ? candidate.providers : {};
  const providerProfiles = Array.isArray(candidate.providerProfiles)
    ? candidate.providerProfiles
    : Array.isArray(candidate.provider_profiles)
      ? candidate.provider_profiles
      : [];
  const modelProfiles = Array.isArray(candidate.modelProfiles)
    ? candidate.modelProfiles
    : Array.isArray(candidate.model_profiles)
      ? candidate.model_profiles
      : [];

  return {
    workspaceRoot:
      typeof candidate.workspaceRoot === "string"
        ? candidate.workspaceRoot
        : typeof candidate.workspace_root === "string"
          ? candidate.workspace_root
          : null,
    providerProfiles: providerProfiles
      .map((value) => normalizeProviderProfile(value))
      .filter((value): value is RuntimeProviderProfile => value !== null),
    modelProfiles: modelProfiles
      .map((value) => normalizeModelProfile(value))
      .filter((value): value is RuntimeModelProfile => value !== null),
    providers: {
      openai: normalizeProviderSettings(providers.openai),
      anthropic: normalizeProviderSettings(providers.anthropic),
      google: normalizeProviderSettings(providers.google),
    },
  };
}

export function buildRuntimeConfigRequestBody(
  input: RuntimeConfigInput,
): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  const workspaceRoot = input.workspaceRoot.trim();
  if (workspaceRoot) {
    body.agent_workspace_root = workspaceRoot;
  }

  for (const provider of PROVIDER_KEYS) {
    const apiKey = input.apiKeys[provider]?.trim();
    if (apiKey) {
      body[`${provider}_api_key`] = apiKey;
    }

    const baseUrl = input.baseUrls[provider]?.trim();
    if (baseUrl) {
      body[`${provider}_base_url`] = baseUrl;
    }
  }

  if (input.providerProfiles?.length) {
    body.providerProfiles = input.providerProfiles.map((profile) => ({
      id: profile.id,
      label: profile.label,
      protocol: profile.protocol,
      authScheme: profile.authScheme,
      baseUrl: profile.baseUrl,
      apiKey: profile.apiKey?.trim() || undefined,
      enabled: profile.enabled,
      headers: profile.headers,
    }));
  }

  if (input.modelProfiles?.length) {
    body.modelProfiles = input.modelProfiles.map((profile) => ({
      id: profile.id,
      providerId: profile.providerId,
      modelName: profile.modelName,
      label: profile.label,
      capabilities: profile.capabilities,
      isDefault: profile.isDefault,
      enabled: profile.enabled,
    }));
  }

  return body;
}
