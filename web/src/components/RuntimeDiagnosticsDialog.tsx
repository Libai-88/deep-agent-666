"use client";

import { RefreshCw, ServerCog } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  resolveRuntimeDiagnosticsLabel,
  type RuntimeDiagnostics,
  type RuntimeDiagnosticsStatus,
} from "@/lib/runtime-diagnostics";

const STATUS_BADGE_CLASSNAMES: Record<RuntimeDiagnosticsStatus, string> = {
  healthy:
    "border-emerald-200 bg-emerald-50 text-emerald-800",
  "setup-required":
    "border-sky-200 bg-sky-50 text-sky-800",
  degraded:
    "border-amber-200 bg-amber-50 text-amber-800",
  offline:
    "border-rose-200 bg-rose-50 text-rose-800",
};

export function RuntimeStatusBadge({
  status,
  loading = false,
  onClick,
}: {
  status: RuntimeDiagnosticsStatus;
  loading?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      data-testid="runtime-status-badge"
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${loading ? "border-border bg-background text-muted-foreground" : STATUS_BADGE_CLASSNAMES[status]}`}
      onClick={onClick}
    >
      {loading ? "Checking..." : resolveRuntimeDiagnosticsLabel(status)}
    </button>
  );
}

function resolveStatusDescription(status: RuntimeDiagnosticsStatus): string {
  switch (status) {
    case "healthy":
      return "The local backend is reachable and live presets are available.";
    case "setup-required":
      return "The backend is reachable, but no launchable presets are ready yet.";
    case "degraded":
      return "The app is relying on fallback state or partial runtime availability.";
    case "offline":
      return "The backend could not be reached for a fresh runtime snapshot.";
  }
}

function resolveProviderLabel(configured: boolean): string {
  return configured ? "Configured" : "Not configured";
}

export function RuntimeDiagnosticsPanel({
  diagnostics,
}: {
  diagnostics: RuntimeDiagnostics;
}) {
  return (
    <div
      data-testid="runtime-diagnostics-dialog"
      className="space-y-4 text-sm"
    >
      <div data-testid="settings-section-status" className="flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${STATUS_BADGE_CLASSNAMES[diagnostics.status]}`}
        >
          {resolveRuntimeDiagnosticsLabel(diagnostics.status)}
        </span>
        <span className="text-xs text-muted-foreground">
          Checked at {new Date(diagnostics.checkedAt).toLocaleString()}
        </span>
      </div>

      <dl data-testid="settings-section-environment" className="grid gap-3 sm:grid-cols-2">
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">
            Backend
          </dt>
          <dd>{diagnostics.backendReachable ? "Reachable" : "Unreachable"}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">
            Preset catalog
          </dt>
          <dd>{diagnostics.catalogSource === "live" ? "Live" : "Fallback cache"}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">
            Launchable presets
          </dt>
          <dd>{diagnostics.launchablePresetCount}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">
            Configured providers
          </dt>
          <dd>{diagnostics.configuredProviderCount}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">
            Workspace root
          </dt>
          <dd className="break-all">
            {diagnostics.workspaceRoot ?? "Unknown"}
          </dd>
        </div>
      </dl>

      <div data-testid="settings-section-providers" className="space-y-2">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          Providers
        </p>
        <ul className="grid gap-2 sm:grid-cols-3">
          {Object.entries(diagnostics.providers).map(([provider, settings]) => (
            <li
              key={provider}
              className="rounded-md border border-border bg-muted/30 p-3"
            >
              <p className="font-medium capitalize">{provider}</p>
              <p className="text-xs text-muted-foreground">
                {resolveProviderLabel(settings.configured)}
              </p>
              <p className="mt-1 break-all text-xs text-muted-foreground">
                {settings.baseUrl ?? "Default base URL"}
              </p>
            </li>
          ))}
        </ul>
      </div>

      {diagnostics.registryProviders.length > 0 ? (
        <div data-testid="settings-section-models-presets" className="space-y-2">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Registry Providers
          </p>
          <ul className="grid gap-2">
            {diagnostics.registryProviders.map((provider) => (
              <li
                key={provider.id}
                className="rounded-md border border-border bg-muted/20 p-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium">{provider.label}</p>
                  <span className="text-xs text-muted-foreground">
                    {provider.protocol}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {provider.authScheme} · {provider.apiKeyPresent ? "Stored key" : "Missing key"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {provider.defaultModel
                    ? `Default model: ${provider.defaultModel}`
                    : "No default model"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {provider.modelCount} model{provider.modelCount === 1 ? "" : "s"} ·{" "}
                  {provider.enabled ? "Enabled" : "Disabled"}
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export function RuntimeDiagnosticsDialog({
  open,
  onOpenChange,
  diagnostics,
  refreshing = false,
  onRefresh,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  diagnostics: RuntimeDiagnostics;
  refreshing?: boolean;
  onRefresh: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton className="sm:max-w-xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <ServerCog className="h-5 w-5 text-primary" />
            <DialogTitle>Runtime diagnostics</DialogTitle>
          </div>
          <DialogDescription>
            {resolveStatusDescription(diagnostics.status)}
          </DialogDescription>
        </DialogHeader>
        <RuntimeDiagnosticsPanel diagnostics={diagnostics} />

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onRefresh}
            disabled={refreshing}
            data-testid="runtime-diagnostics-refresh"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            Refresh status
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
