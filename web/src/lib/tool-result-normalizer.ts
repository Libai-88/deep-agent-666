import type {
  WorkbenchArtifact,
  WorkbenchTaskKind,
  ThreadWorkbenchState,
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

type StructuredEditResult = {
  summary?: unknown;
  path?: unknown;
  change_type?: unknown;
  before?: unknown;
  after?: unknown;
  a2ui_operations?: unknown;
};

function parseStructuredToolResult(result: unknown): StructuredEditResult | null {
  if (result && typeof result === "object") {
    return result as StructuredEditResult;
  }

  if (typeof result !== "string") {
    return null;
  }

  try {
    const parsed = JSON.parse(result) as unknown;
    return parsed && typeof parsed === "object"
      ? (parsed as StructuredEditResult)
      : null;
  } catch {
    return null;
  }
}

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
    const structuredResult = parseStructuredToolResult(payload.result);
    const path =
      typeof payload.args?.file_path === "string"
        ? payload.args.file_path
        : typeof payload.args?.path === "string"
          ? payload.args.path
          : typeof structuredResult?.path === "string"
            ? structuredResult.path
          : "";
    const summary =
      typeof structuredResult?.summary === "string"
        ? structuredResult.summary
        : null;
    return [
      {
        id: `artifact-${Date.now()}-file`,
        kind: "file",
        title: path || "Written file",
        path: path || undefined,
        content:
          summary
            ? summary
            : typeof payload.result === "string"
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
  const structuredResult = parseStructuredToolResult(result);
  if (structuredResult?.a2ui_operations) {
    return null;
  }
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

function normalizeCoordinatorToolName(
  name: string | undefined,
): DelegationPayload["sub_agent"] | null {
  if (name === "planner_tool") return "planner";
  if (name === "executor_tool") return "executor";
  if (name === "reviewer_tool") return "reviewer";
  return null;
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

export function applyCoordinatorToolCallFallback(
  state: ThreadWorkbenchState,
  payload: ToolPayload,
): ThreadWorkbenchState {
  const subAgent = normalizeCoordinatorToolName(payload.name);
  const task =
    typeof payload.args?.task === "string" ? payload.args.task.trim() : "";

  if (!subAgent || !task) {
    return state;
  }

  const todoStatus =
    payload.status === "complete"
      ? "completed"
      : payload.status === "executing"
        ? "in_progress"
        : "pending";
  const todo: WorkbenchTodo = {
    id: `coordinator-tool-${subAgent}`,
    content: task,
    status: todoStatus,
    source: "agent",
  };

  const shouldResetCoordinatorFallback = subAgent === "planner";
  const nextTodosBase = shouldResetCoordinatorFallback
    ? state.todos.filter((existingTodo) => existingTodo.source === "user")
    : state.todos;
  const nextArtifactsBase = shouldResetCoordinatorFallback
    ? state.artifacts.filter((artifact) => artifact.source !== "delegation")
    : state.artifacts;

  const nextTodos = [
    ...nextTodosBase.filter((existingTodo) => existingTodo.id !== todo.id),
    todo,
  ];

  const resultText =
    typeof payload.result === "string" ? payload.result.trim() : "";
  const artifactId = `delegation-coordinator-tool-${subAgent}`;
  const nextArtifacts: WorkbenchArtifact[] =
    payload.status === "complete" && resultText
      ? [
          ...nextArtifactsBase.filter(
            (artifact) => artifact.id !== artifactId,
          ),
          {
            id: artifactId,
            kind: subAgent === "reviewer" ? "summary" : "finding",
            title: delegationTitle(subAgent),
            content: resultText,
            createdAt: Date.now(),
            source: "delegation",
          },
        ]
      : nextArtifactsBase;

  const nextFinalSummary =
    subAgent === "reviewer" && payload.status === "complete" && resultText
      ? resultText
      : state.finalSummary;

  return {
    ...state,
    todos: nextTodos,
    artifacts: nextArtifacts,
    finalSummary: nextFinalSummary,
    updatedAt: Date.now(),
  };
}
