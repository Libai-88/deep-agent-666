import { Button } from "@/components/ui/button";
import type {
  RunControlAction,
  RunControlState,
} from "@/lib/run-control-state";

type RunControlBarProps = {
  state: RunControlState;
  onAction: (action: RunControlAction) => void;
};

function actionLabel(action: RunControlAction): string {
  switch (action) {
    case "request_stop": return "Stop";
    case "approve_plan": return "Approve plan";
    case "edit_plan": return "Edit plan";
    case "retry_last": return "Retry";
    default: {
      const _exhaustive: never = action;
      return _exhaustive;
    }
  }
}

const variantMap: Record<RunControlAction, "destructive" | "outline" | "default"> = {
  request_stop: "destructive",
  approve_plan: "default",
  edit_plan: "outline",
  retry_last: "outline",
};

export function RunControlBar({ state, onAction }: RunControlBarProps) {
  return (
    <section
      data-testid="run-control-bar"
      className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card/40 px-3 py-2"
    >
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">
          {state.currentStep ?? "Idle"}
        </p>
        <p className="text-xs text-muted-foreground">
          {state.activeProviderId ?? "no-provider"} /{" "}
          {state.activeModelId ?? "no-model"}
        </p>
      </div>
      <div className="flex items-center gap-2">
        {state.availableActions.map((action) => (
          <Button
            key={action}
            variant={variantMap[action]}
            size="sm"
            onClick={() => onAction(action)}
          >
            {actionLabel(action)}
          </Button>
        ))}
      </div>
    </section>
  );
}
