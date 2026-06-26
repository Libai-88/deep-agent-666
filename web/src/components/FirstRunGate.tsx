import type { RecoverableAction } from "@/lib/runtime-errors";

export function FirstRunGate({
  title,
  description,
  actions,
  onAction,
}: {
  title: string;
  description: string;
  actions: RecoverableAction[];
  onAction: (action: RecoverableAction["action"]) => void;
}) {
  return (
    <section className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold">{title}</h2>
        <p className="max-w-lg text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        {actions.map((action) => (
          <button
            key={action.action}
            type="button"
            className="rounded-md border border-border px-3 py-2 text-sm"
            onClick={() => onAction(action.action)}
          >
            {action.label}
          </button>
        ))}
      </div>
    </section>
  );
}
