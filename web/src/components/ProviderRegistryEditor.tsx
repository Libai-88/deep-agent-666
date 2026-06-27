import { Label } from "@/components/ui/label";
import type {
  RuntimeModelProfile,
  RuntimeProviderProfile,
} from "@/lib/runtime-settings";

type ProviderRegistryEditorProps = {
  providerProfiles: RuntimeProviderProfile[];
  modelProfiles: RuntimeModelProfile[];
  onProviderChange: (profiles: RuntimeProviderProfile[]) => void;
  onModelChange: (profiles: RuntimeModelProfile[]) => void;
};

export function ProviderRegistryEditor({
  providerProfiles,
  modelProfiles,
}: ProviderRegistryEditorProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Provider Registry
        </Label>
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
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {profile.label}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {profile.protocol}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {profile.apiKeyPresent ? "Configured" : "Missing key"}
                    </span>
                  </div>
                  {profile.baseUrl ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      {profile.baseUrl}
                    </p>
                  ) : null}
                  {linkedModels.length > 0 ? (
                    <div className="mt-3 space-y-1">
                      {linkedModels.map((model) => (
                        <div
                          key={model.id}
                          className="flex items-center justify-between rounded-md bg-muted/40 px-2 py-1 text-xs"
                        >
                          <span>{model.modelName}</span>
                          <span>
                            {model.isDefault ? "Default" : "Enabled"}
                          </span>
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
