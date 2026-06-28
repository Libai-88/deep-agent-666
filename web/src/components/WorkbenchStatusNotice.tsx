import { cn } from "@/lib/utils";
import type { RecoverableAction } from "@/lib/runtime-errors";

export function WorkbenchStatusNotice({
  title,
  description,
  actions,
  onAction,
  tone = "info",
}: {
  title: string;
  description: string;
  actions: RecoverableAction[];
  onAction: (action: RecoverableAction["action"]) => void;
  tone?: "info" | "approval" | "danger";
}) {
  return (
    <div
      data-testid="workbench-status-notice"
      className={cn(
        "border-b px-4 py-3",
        tone === "approval" && "border-[rgb(var(--accent-soft))] bg-[rgb(var(--surface-approval))]",
        tone === "danger" && "border-red-200 bg-[rgb(var(--surface-danger))]",
        tone === "info" && "border-border bg-amber-50",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm font-semibold">{title}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {actions.map((action) => (
            <button
              key={action.action}
              type="button"
              className="rounded-md border border-border bg-background px-3 py-1.5 text-xs"
              onClick={() => onAction(action.action)}
            >
              {action.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
