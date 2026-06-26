import type { ReactNode } from "react";

import { FirstRunGate } from "./FirstRunGate";
import { StarterTemplatePanel } from "./StarterTemplatePanel";
import type { FirstRunState } from "@/lib/first-run-state";
import type { RecoverableAction } from "@/lib/runtime-errors";
import type { StarterTemplate } from "@/lib/starter-templates";

type HomePageShellProps = {
  state: FirstRunState;
  starterTemplates: readonly StarterTemplate[];
  gateTitle: string;
  gateDescription: string;
  gateActions: RecoverableAction[];
  onGateAction: (action: RecoverableAction["action"]) => void;
  onStarterSelect: (template: StarterTemplate) => void;
  children: ReactNode;
};

export function HomePageShell({
  state,
  starterTemplates,
  gateTitle,
  gateDescription,
  gateActions,
  onGateAction,
  onStarterSelect,
  children,
}: HomePageShellProps) {
  if (state === "checking") {
    return (
      <section className="flex h-full items-center justify-center px-8">
        <p className="text-sm text-muted-foreground">Loading agent presets...</p>
      </section>
    );
  }

  if (state === "unconfigured" || state === "recoverable-error") {
    return (
      <FirstRunGate
        title={gateTitle}
        description={gateDescription}
        actions={gateActions}
        onAction={onGateAction}
      />
    );
  }

  if (state === "ready-no-thread") {
    return (
      <StarterTemplatePanel
        templates={starterTemplates}
        onSelect={onStarterSelect}
      />
    );
  }

  return <>{children}</>;
}
