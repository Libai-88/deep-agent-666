import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type {
  RuntimeModelCapability,
  RuntimeModelProfile,
  RuntimeProviderAuthScheme,
  RuntimeProviderProfile,
} from "@/lib/runtime-settings";

const BUILTIN_PROVIDER_IDS = new Set(["openai", "anthropic", "google"]);
const CAPABILITIES: RuntimeModelCapability[] = [
  "chat",
  "tools",
  "vision",
  "long_context",
];

export type ProviderProbeStatus =
  | "idle"
  | "pending"
  | "ready"
  | "auth_failed"
  | "access_denied"
  | "model_unavailable"
  | "unreachable"
  | "invalid_config";

export type ProviderProbeState = Record<
  string,
  {
    status: ProviderProbeStatus;
    message: string | null;
    checkedAt: string | null;
  }
>;

type ProviderRegistryEditorProps = {
  apiKeys: Record<string, string>;
  providerProfiles: RuntimeProviderProfile[];
  modelProfiles: RuntimeModelProfile[];
  probeState: ProviderProbeState;
  onProbe: (providerId: string) => void;
  onProviderChange: (profiles: RuntimeProviderProfile[]) => void;
  onModelChange: (profiles: RuntimeModelProfile[]) => void;
  onApiKeyChange: (next: Record<string, string>) => void;
};

function createProviderId(index: number): string {
  return `custom-provider-${index}`;
}

function createModelId(index: number): string {
  return `custom-model-${index}`;
}

function toggleCapability(
  capabilities: RuntimeModelCapability[],
  capability: RuntimeModelCapability,
): RuntimeModelCapability[] {
  if (capabilities.includes(capability)) {
    return capabilities.filter((entry) => entry !== capability);
  }
  return [...capabilities, capability];
}

function resolveProbeLabel(status: ProviderProbeStatus): string {
  switch (status) {
    case "pending":
      return "Checking connection...";
    case "ready":
      return "Ready";
    case "auth_failed":
      return "Authentication failed";
    case "access_denied":
      return "Access denied";
    case "model_unavailable":
      return "Model unavailable";
    case "unreachable":
      return "Provider unreachable";
    case "invalid_config":
      return "Invalid configuration";
    case "idle":
      return "Not checked";
  }
}

export function ProviderRegistryEditor({
  apiKeys,
  providerProfiles,
  modelProfiles,
  probeState,
  onProbe,
  onProviderChange,
  onModelChange,
  onApiKeyChange,
}: ProviderRegistryEditorProps) {
  const [draftHeaders, setDraftHeaders] = useState<
    Record<string, { key: string; value: string }>
  >({});

  const handleAddProvider = () => {
    const nextProviderId = createProviderId(providerProfiles.length + 1);
    const nextModelId = createModelId(modelProfiles.length + 1);

    onProviderChange([
      ...providerProfiles,
      {
        id: nextProviderId,
        label: "Custom provider",
        protocol: "openai-compatible",
        authScheme: "bearer_token",
        baseUrl: null,
        apiKeyPresent: false,
        headers: {},
        enabled: true,
      },
    ]);
    onModelChange([
      ...modelProfiles,
      {
        id: nextModelId,
        providerId: nextProviderId,
        modelName: "",
        label: "",
        capabilities: ["chat", "tools"],
        isDefault: true,
        enabled: true,
      },
    ]);
  };

  const handleAddModel = (providerId: string) => {
    const nextModelId = createModelId(modelProfiles.length + 1);
    const linkedModels = modelProfiles.filter((model) => model.providerId === providerId);

    onModelChange([
      ...modelProfiles,
      {
        id: nextModelId,
        providerId,
        modelName: "",
        label: "",
        capabilities: ["chat", "tools"],
        isDefault: linkedModels.length === 0,
        enabled: true,
      },
    ]);
  };

  const handleRemoveProvider = (providerId: string) => {
    onProviderChange(
      providerProfiles.filter((profile) => profile.id !== providerId),
    );
    onModelChange(
      modelProfiles.filter((model) => model.providerId !== providerId),
    );
    const nextApiKeys = { ...apiKeys };
    delete nextApiKeys[providerId];
    onApiKeyChange(nextApiKeys);
  };

  const handleRemoveModel = (modelId: string) => {
    const currentModel = modelProfiles.find((model) => model.id === modelId);
    if (!currentModel) {
      return;
    }

    const remainingModels = modelProfiles.filter((model) => model.id !== modelId);
    const providerModels = remainingModels.filter(
      (model) => model.providerId === currentModel.providerId,
    );
    const hasDefault = providerModels.some(
      (model) => model.enabled && model.isDefault,
    );

    onModelChange(
      !hasDefault && providerModels.length > 0
        ? remainingModels.map((model, index) =>
            model.providerId === currentModel.providerId && index === remainingModels.indexOf(providerModels[0]!)
              ? { ...model, isDefault: true }
              : model,
          )
        : remainingModels,
    );
  };

  const updateProvider = (
    providerId: string,
    updater: (profile: RuntimeProviderProfile) => RuntimeProviderProfile,
  ) => {
    onProviderChange(
      providerProfiles.map((profile) =>
        profile.id === providerId ? updater(profile) : profile,
      ),
    );
  };

  const updateModel = (
    modelId: string,
    updater: (profile: RuntimeModelProfile) => RuntimeModelProfile,
  ) => {
    onModelChange(
      modelProfiles.map((profile) =>
        profile.id === modelId ? updater(profile) : profile,
      ),
    );
  };

  const setDefaultModel = (providerId: string, modelId: string) => {
    onModelChange(
      modelProfiles.map((profile) =>
        profile.providerId === providerId
          ? { ...profile, isDefault: profile.id === modelId }
          : profile,
      ),
    );
  };

  const updateHeader = (
    providerId: string,
    currentKey: string,
    nextKey: string,
    nextValue: string,
  ) => {
    updateProvider(providerId, (current) => {
      const nextHeaders = Object.fromEntries(
        Object.entries(current.headers).filter(([key]) => key !== currentKey),
      );
      const trimmedKey = nextKey.trim();
      if (trimmedKey) {
        nextHeaders[trimmedKey] = nextValue;
      }
      return {
        ...current,
        headers: nextHeaders,
      };
    });
  };

  const addHeader = (providerId: string) => {
    const draft = draftHeaders[providerId];
    if (!draft?.key.trim()) {
      return;
    }

    updateProvider(providerId, (current) => ({
      ...current,
      headers: {
        ...current.headers,
        [draft.key.trim()]: draft.value,
      },
    }));
    setDraftHeaders((current) => ({
      ...current,
      [providerId]: { key: "", value: "" },
    }));
  };

  const removeHeader = (providerId: string, keyToRemove: string) => {
    updateProvider(providerId, (current) => ({
      ...current,
      headers: Object.fromEntries(
        Object.entries(current.headers).filter(([key]) => key !== keyToRemove),
      ),
    }));
  };

  return (
    <div data-testid="provider-registry-editor" className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Provider Registry
          </Label>
          <Button type="button" size="sm" variant="outline" onClick={handleAddProvider}>
            Add provider
          </Button>
        </div>
        {providerProfiles.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No custom providers configured yet.
          </p>
        ) : (
          <div className="space-y-3">
            {providerProfiles.map((profile) => {
              const linkedModels = modelProfiles.filter(
                (model) => model.providerId === profile.id,
              );
              const isBuiltin = BUILTIN_PROVIDER_IDS.has(profile.id);
              const probe = probeState[profile.id] ?? {
                status: "idle" as const,
                message: null,
                checkedAt: null,
              };
              return (
                <div
                  key={profile.id}
                  className="rounded-lg border border-border bg-card/30 p-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-foreground">
                        {profile.label || profile.id}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {isBuiltin
                          ? "Built-in provider. Manage credentials above."
                          : "Custom provider"}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {!isBuiltin ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => handleRemoveProvider(profile.id)}
                        >
                          Remove provider
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => onProbe(profile.id)}
                        disabled={probe.status === "pending"}
                      >
                        Test connection
                      </Button>
                    </div>
                  </div>

                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    {!isBuiltin ? (
                      <div className="space-y-1.5">
                        <Label htmlFor={`${profile.id}-provider-id`}>Provider ID</Label>
                        <Input
                          id={`${profile.id}-provider-id`}
                          aria-label="Provider ID"
                          value={profile.id}
                          onChange={(event) =>
                            onProviderChange(
                              providerProfiles.map((currentProfile) =>
                                currentProfile.id === profile.id
                                  ? {
                                      ...currentProfile,
                                      id: event.target.value,
                                    }
                                  : currentProfile,
                              ),
                            )
                          }
                        />
                      </div>
                    ) : null}
                    <div className="space-y-1.5">
                      <Label htmlFor={`${profile.id}-label`}>Provider label</Label>
                      <Input
                        id={`${profile.id}-label`}
                        aria-label="Provider label"
                        value={profile.label}
                        onChange={(event) =>
                          updateProvider(profile.id, (current) => ({
                            ...current,
                            label: event.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor={`${profile.id}-protocol`}>Protocol</Label>
                      <select
                        id={`${profile.id}-protocol`}
                        aria-label="Protocol"
                        value={profile.protocol}
                        disabled={isBuiltin}
                        onChange={(event) =>
                          updateProvider(profile.id, (current) => ({
                            ...current,
                            protocol: event.target.value as RuntimeProviderProfile["protocol"],
                          }))
                        }
                        className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                      >
                        <option value="openai-compatible">openai-compatible</option>
                        <option value="openai">openai</option>
                        <option value="anthropic">anthropic</option>
                        <option value="google">google</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor={`${profile.id}-auth-scheme`}>Authentication</Label>
                      <select
                        id={`${profile.id}-auth-scheme`}
                        aria-label="Authentication"
                        value={profile.authScheme}
                        disabled={isBuiltin}
                        onChange={(event) =>
                          updateProvider(profile.id, (current) => ({
                            ...current,
                            authScheme: event.target
                              .value as RuntimeProviderAuthScheme,
                          }))
                        }
                        className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                      >
                        <option value="bearer_token">bearer_token</option>
                        <option value="api_key">api_key</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor={`${profile.id}-base-url`}>Base URL</Label>
                      <Input
                        id={`${profile.id}-base-url`}
                        aria-label="Base URL"
                        value={profile.baseUrl ?? ""}
                        onChange={(event) =>
                          updateProvider(profile.id, (current) => ({
                            ...current,
                            baseUrl: event.target.value || null,
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor={`${profile.id}-api-key`}>API key</Label>
                      <Input
                        id={`${profile.id}-api-key`}
                        aria-label="API key"
                        type="password"
                        value={apiKeys[profile.id] ?? ""}
                        placeholder={
                          profile.apiKeyPresent ? "Stored key retained" : "sk-..."
                        }
                        onChange={(event) =>
                          onApiKeyChange({
                            ...apiKeys,
                            [profile.id]: event.target.value,
                          })
                        }
                      />
                    </div>
                    <label className="flex items-center gap-2 text-sm text-foreground">
                      <input
                        type="checkbox"
                        checked={profile.enabled}
                        onChange={(event) =>
                          updateProvider(profile.id, (current) => ({
                            ...current,
                            enabled: event.target.checked,
                          }))
                        }
                      />
                      Enabled
                    </label>
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    {apiKeys[profile.id]?.trim() || profile.apiKeyPresent
                      ? "Configured"
                      : "Missing key"}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {resolveProbeLabel(probe.status)}
                    {probe.message ? ` - ${probe.message}` : ""}
                  </div>
                  <div className="mt-3 space-y-2 rounded-md bg-muted/30 p-3">
                    <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Headers
                    </div>
                    {Object.entries(profile.headers).length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        No static headers configured.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {Object.entries(profile.headers).map(([headerKey, headerValue]) => (
                          <div key={headerKey} className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
                            <Input
                              aria-label="Header key"
                              value={headerKey}
                              onChange={(event) =>
                                updateHeader(
                                  profile.id,
                                  headerKey,
                                  event.target.value,
                                  headerValue,
                                )
                              }
                            />
                            <Input
                              aria-label="Header value"
                              value={headerValue}
                              onChange={(event) =>
                                updateHeader(
                                  profile.id,
                                  headerKey,
                                  headerKey,
                                  event.target.value,
                                )
                              }
                            />
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => removeHeader(profile.id, headerKey)}
                            >
                              Remove
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
                      <Input
                        aria-label="New header key"
                        placeholder="Header key"
                        value={draftHeaders[profile.id]?.key ?? ""}
                        onChange={(event) =>
                          setDraftHeaders((current) => ({
                            ...current,
                            [profile.id]: {
                              key: event.target.value,
                              value: current[profile.id]?.value ?? "",
                            },
                          }))
                        }
                      />
                      <Input
                        aria-label="New header value"
                        placeholder="Header value"
                        value={draftHeaders[profile.id]?.value ?? ""}
                        onChange={(event) =>
                          setDraftHeaders((current) => ({
                            ...current,
                            [profile.id]: {
                              key: current[profile.id]?.key ?? "",
                              value: event.target.value,
                            },
                          }))
                        }
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => addHeader(profile.id)}
                      >
                        Add header
                      </Button>
                    </div>
                  </div>
                  {linkedModels.length > 0 ? (
                    <div className="mt-3 space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Models
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => handleAddModel(profile.id)}
                        >
                          Add model
                        </Button>
                      </div>
                      {linkedModels.map((model) => (
                        <div key={model.id} className="space-y-3 rounded-md bg-muted/40 p-3">
                          <div className="grid gap-3 md:grid-cols-2">
                            <div className="space-y-1.5">
                              <Label htmlFor={`${model.id}-model-label`}>Model label</Label>
                              <Input
                                id={`${model.id}-model-label`}
                                aria-label="Model label"
                                value={model.label}
                                onChange={(event) =>
                                  updateModel(model.id, (current) => ({
                                    ...current,
                                    label: event.target.value,
                                  }))
                                }
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label htmlFor={`${model.id}-model-name`}>Model name</Label>
                              <Input
                                id={`${model.id}-model-name`}
                                aria-label="Model name"
                                value={model.modelName}
                                onChange={(event) =>
                                  updateModel(model.id, (current) => ({
                                    ...current,
                                    modelName: event.target.value,
                                    label: current.label || event.target.value,
                                  }))
                                }
                              />
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                            <label className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={model.enabled}
                                onChange={(event) =>
                                  updateModel(model.id, (current) => ({
                                    ...current,
                                    enabled: event.target.checked,
                                  }))
                                }
                              />
                              Enabled
                            </label>
                            <label className="flex items-center gap-2">
                              <input
                                type="radio"
                                name={`${profile.id}-default-model`}
                                checked={model.isDefault}
                                onChange={() => setDefaultModel(profile.id, model.id)}
                              />
                              Default model
                            </label>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => handleRemoveModel(model.id)}
                            >
                              Remove model
                            </Button>
                          </div>
                          <div className="space-y-2">
                            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              Capabilities
                            </div>
                            <div className="flex flex-wrap gap-3 text-sm text-foreground">
                              {CAPABILITIES.map((capability) => (
                                <label key={capability} className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={model.capabilities.includes(capability)}
                                    onChange={() =>
                                      updateModel(model.id, (current) => ({
                                        ...current,
                                        capabilities: toggleCapability(
                                          current.capabilities,
                                          capability,
                                        ),
                                      }))
                                    }
                                  />
                                  {capability}
                                </label>
                              ))}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-3">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => handleAddModel(profile.id)}
                      >
                        Add model
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
