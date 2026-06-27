import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type {
  RuntimeModelProfile,
  RuntimeProviderProfile,
} from "@/lib/runtime-settings";

type ProviderRegistryEditorProps = {
  apiKeys: Record<string, string>;
  providerProfiles: RuntimeProviderProfile[];
  modelProfiles: RuntimeModelProfile[];
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

export function ProviderRegistryEditor({
  apiKeys,
  providerProfiles,
  modelProfiles,
  onProviderChange,
  onModelChange,
  onApiKeyChange,
}: ProviderRegistryEditorProps) {
  const handleAddProvider = () => {
    const nextProviderId = createProviderId(providerProfiles.length + 1);
    const nextModelId = createModelId(modelProfiles.length + 1);

    onProviderChange([
      ...providerProfiles,
      {
        id: nextProviderId,
        label: "Custom provider",
        protocol: "openai-compatible",
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
              return (
                <div
                  key={profile.id}
                  className="rounded-lg border border-border bg-card/30 p-3"
                >
                  <div className="grid gap-3 md:grid-cols-2">
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
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    {apiKeys[profile.id]?.trim() || profile.apiKeyPresent
                      ? "Configured"
                      : "Missing key"}
                  </div>
                  {linkedModels.length > 0 ? (
                    <div className="mt-3 space-y-1">
                      {linkedModels.map((model) => (
                        <div key={model.id} className="grid gap-3 rounded-md bg-muted/40 p-3 md:grid-cols-2">
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
                                  label: event.target.value || current.label,
                                }))
                              }
                            />
                          </div>
                          <div className="flex items-end text-xs text-muted-foreground">
                            {model.isDefault ? "Default model" : "Enabled model"}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
