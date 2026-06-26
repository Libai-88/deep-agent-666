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

type DelegationStatus = "running" | "completed" | "failed";

type DelegationPayload = {
  id: string;
  sub_agent: "planner" | "executor" | "reviewer";
  task: string;
  status: DelegationStatus;
  result: string;
};

export function inferTaskKindFromMessage(message: string): WorkbenchTaskKind {
  const lower = message.toLowerCase();
  if (
    lower.includes("research") ||
    lower.includes("summary") ||
    lower.includes("report") ||
    lower.includes("调研") ||
    lower.includes("简报") ||
    lower.includes("总结") ||
    lower.includes("文档")
  ) {
    return "research";
  }
  if (
    lower.includes("test") ||
    lower.includes("fix") ||
    lower.includes("refactor") ||
    lower.includes("implement") ||
    lower.includes("修复") ||
    lower.includes("代码") ||
    lower.includes("测试")
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

  if (
    payload.name === "write_file" ||
    payload.name === "write_text_file_tool" ||
    payload.name === "replace_text_in_file_tool"
  ) {
    const path =
      typeof payload.args?.file_path === "string"
        ? payload.args.file_path
        : typeof payload.args?.path === "string"
          ? payload.args.path
          : "";
    return [
      {
        id: `artifact-${Date.now()}-file`,
        kind: "file",
        title: path || "Written file",
        path: path || undefined,
        content:
          typeof payload.result === "string"
            ? payload.result
            : JSON.stringify(payload.result ?? payload.args?.content ?? "", null, 2),
        createdAt: Date.now(),
        source: "tool",
      },
    ];
  }

  if (
    payload.name === "read_document_tool" ||
    payload.name === "inspect_document_tool" ||
    payload.name === "read_text_file_tool"
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
        source: "tool",
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
  if (result && typeof result === "object" && "final_summary" in result) {
    return String((result as { final_summary: unknown }).final_summary);
  }
  return null;
}

function normalizeTodoStatus(
  status: DelegationStatus,
): WorkbenchTodo["status"] {
  if (status === "completed") return "completed";
  if (status === "running") return "in_progress";
  return "pending";
}

function delegationTitle(subAgent: DelegationPayload["sub_agent"]): string {
  if (subAgent === "planner") return "Planner result";
  if (subAgent === "executor") return "Executor result";
  return "Reviewer result";
}

export function normalizeDelegationsToTodos(
  delegations: readonly DelegationPayload[],
): WorkbenchTodo[] {
  return delegations.map((delegation) => ({
    id: delegation.id,
    content: delegation.task,
    status: normalizeTodoStatus(delegation.status),
    source: "agent",
  }));
}

export function normalizeDelegationArtifacts(
  delegations: readonly DelegationPayload[],
): WorkbenchArtifact[] {
  return delegations
    .filter((delegation) => delegation.status === "completed" && delegation.result.trim())
    .map((delegation, index) => ({
      id: `delegation-${delegation.id}`,
      kind: delegation.sub_agent === "reviewer" ? "summary" : "finding",
      title: delegationTitle(delegation.sub_agent),
      content: delegation.result,
      createdAt: Date.now() + index,
      source: "delegation",
    }));
}
