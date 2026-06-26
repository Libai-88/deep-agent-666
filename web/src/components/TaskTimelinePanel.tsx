import type {
  WorkbenchTaskKind,
  WorkbenchTodo,
} from "@/lib/workbench-state";

function taskKindLabel(taskKind: WorkbenchTaskKind): string {
  if (taskKind === "engineering") return "Engineering";
  if (taskKind === "research") return "Research";
  return "General";
}

export function TaskTimelinePanel({
  taskKind,
  todos,
}: {
  taskKind: WorkbenchTaskKind;
  todos: WorkbenchTodo[];
}) {
  return (
    <section className="flex h-full flex-col border-r border-border bg-card/30">
      <header className="border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold">{taskKindLabel(taskKind)}</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Task timeline
        </p>
      </header>
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {todos.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No tracked tasks yet.
          </p>
        ) : (
          todos.map((todo) => (
            <div
              key={todo.id}
              className="mb-3 rounded-lg border border-border bg-background p-3"
            >
              <div className="text-sm font-medium">{todo.content}</div>
              <div className="mt-1 text-xs text-muted-foreground">
                {todo.status}
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
