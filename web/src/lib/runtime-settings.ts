type ProviderKey = "openai" | "anthropic" | "google";

type RuntimeProviderSettings = {
  configured: boolean;
  baseUrl: string | null;
};

export type RuntimeSettings = {
  workspaceRoot: string | null;
  providers: Record<ProviderKey, RuntimeProviderSettings>;
};

type RuntimeConfigInput = {
  workspaceRoot: string;
  apiKeys: Record<ProviderKey, string>;
  baseUrls: Record<ProviderKey, string>;
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

export function normalizeRuntimeSettings(payload: unknown): RuntimeSettings {
  const candidate = isRecord(payload) ? payload : {};
  const providers = isRecord(candidate.providers) ? candidate.providers : {};

  return {
    workspaceRoot:
      typeof candidate.workspaceRoot === "string"
        ? candidate.workspaceRoot
        : typeof candidate.workspace_root === "string"
          ? candidate.workspace_root
          : null,
    providers: {
      openai: normalizeProviderSettings(providers.openai),
      anthropic: normalizeProviderSettings(providers.anthropic),
      google: normalizeProviderSettings(providers.google),
    },
  };
}

export function buildRuntimeConfigRequestBody(
  input: RuntimeConfigInput,
): Record<string, string> {
  const body: Record<string, string> = {};
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

  return body;
}
