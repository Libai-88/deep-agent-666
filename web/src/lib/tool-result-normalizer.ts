import type {
  WorkbenchArtifact,
  WorkbenchTaskKind,
  WorkbenchTodo,
} from "./workbench-state";

type ToolPayload = {
  name?: string;
  status?: string;
  args?: Record<string, unknown> | null;
  result?: unknown;
};

export function inferTaskKindFromMessage(message: string): WorkbenchTaskKind {
  const lower = message.toLowerCase();
  if (
    lower.includes("research") ||
    lower.includes("summary") ||
    lower.includes("report")
  ) {
    return "research";
  }
  if (
    lower.includes("test") ||
    lower.includes("fix") ||
    lower.includes("refactor") ||
    lower.includes("implement")
  ) {
    return "engineering";
  }
  return "general";
}

export function normalizeToolCallToTodos(
  payload: ToolPayload,
): WorkbenchTodo[] {
  if (payload.name !== "write_todos" || payload.status !== "complete") {
    return [];
  }

  const todos = Array.isArray(payload.args?.todos) ? payload.args.todos : [];
  return (todos as Array<Record<string, unknown>>).map((todo, index) => ({
    id: `todo-${Date.now()}-${index}`,
    content: String(todo.content ?? ""),
    status: (todo.status as WorkbenchTodo["status"]) ?? "pending",
    source: "agent",
  }));
}

export function normalizeToolCallToArtifacts(
  payload: ToolPayload,
): WorkbenchArtifact[] {
  if (payload.status !== "complete") {
    return [];
  }

  if (payload.name === "write_file") {
    return [
      {
        id: `artifact-${Date.now()}-file`,
        kind: "file",
        title: String(payload.args?.file_path ?? "Written file"),
        path: String(payload.args?.file_path ?? ""),
        content:
          typeof payload.result === "string"
            ? payload.result
            : String(payload.args?.content ?? ""),
        createdAt: Date.now(),
      },
    ];
  }

  if (
    payload.name === "read_document_tool" ||
    payload.name === "inspect_document_tool"
  ) {
    return [
      {
        id: `artifact-${Date.now()}-finding`,
        kind: "finding",
        title: String(payload.args?.path ?? payload.name),
        content:
          typeof payload.result === "string"
            ? payload.result
            : JSON.stringify(payload.result),
        createdAt: Date.now(),
      },
    ];
  }

  return [];
}

export function extractFinalSummary(result: unknown): string | null {
  if (typeof result === "string" && result.trim()) {
    return result;
  }
  if (result && typeof result === "object" && "summary" in result) {
    return String((result as { summary: unknown }).summary);
  }
  return null;
}
