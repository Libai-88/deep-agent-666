import type {
  WorkbenchTaskKind,
  WorkbenchTodo,
} from "@/lib/workbench-state";
import type { WorkbenchEvent } from "@/lib/runtime-events";

function taskKindLabel(taskKind: WorkbenchTaskKind): string {
  if (taskKind === "engineering") return "Engineering";
  if (taskKind === "research") return "Research";
  return "General";
}

function todoStatusLabel(status: WorkbenchTodo["status"]): string {
  if (status === "completed") return "Completed";
  if (status === "in_progress") return "In progress";
  return "Pending";
}

export function TaskTimelinePanel({
  taskKind,
  events = [],
  todos,
}: {
  taskKind: WorkbenchTaskKind;
  events?: WorkbenchEvent[];
  todos: WorkbenchTodo[];
}) {
  const timelineEvents = events.filter((event) => event.kind === "delegation");

  return (
    <section
      data-testid="task-timeline-panel"
      className="flex h-full flex-col border-r border-border bg-card/30"
    >
      <header className="border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold">{taskKindLabel(taskKind)}</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Task timeline
        </p>
      </header>
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {timelineEvents.length === 0 && todos.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No tracked tasks yet.
          </p>
        ) : (
          timelineEvents.length > 0
            ? timelineEvents.map((event) => (
                <div
                  key={event.id}
                  data-testid={`timeline-todo-${event.id}`}
                  className="mb-3 rounded-lg border border-border bg-background p-3"
                >
                  <div className="text-sm font-medium">{event.title}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {event.message}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {todoStatusLabel(
                      event.status === "completed"
                        ? "completed"
                        : event.status === "running"
                          ? "in_progress"
                          : "pending",
                    )}
                  </div>
                </div>
              ))
            : todos.map((todo) => (
                <div
                  key={todo.id}
                  data-testid={`timeline-todo-${todo.id}`}
                  className="mb-3 rounded-lg border border-border bg-background p-3"
                >
                  <div className="text-sm font-medium">{todo.content}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {todoStatusLabel(todo.status)}
                  </div>
                </div>
              ))
        )}
      </div>
    </section>
  );
}
