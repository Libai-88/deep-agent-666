import type { RunControlAction, RunControlSnapshot } from "@/lib/run-control-state";
import type { WorkbenchEvent } from "./runtime-events";

export type WorkbenchTaskKind = "engineering" | "research" | "general";

export type WorkbenchTodo = {
  id: string;
  content: string;
  status: "pending" | "in_progress" | "completed";
  source: "agent" | "user";
};

export type WorkbenchArtifact = {
  id: string;
  kind: "file" | "finding" | "summary";
  title: string;
  path?: string;
  content: string;
  createdAt: number;
  source?: "tool" | "delegation";
};

export type ThreadWorkbenchState = {
  taskKind: WorkbenchTaskKind;
  todos: WorkbenchTodo[];
  artifacts: WorkbenchArtifact[];
  events: WorkbenchEvent[];
  finalSummary: string | null;
  lastUserPrompt: string | null;
  updatedAt: number;
};

const STORAGE_KEY_PREFIX = "deep-agent-666.workbench";

export function createEmptyWorkbenchState(): ThreadWorkbenchState {
  return {
    taskKind: "general",
    todos: [],
    artifacts: [],
    events: [],
    finalSummary: null,
    lastUserPrompt: null,
    updatedAt: Date.now(),
  };
}

export function loadWorkbenchState(
  threadId: string,
  storage: Storage = window.localStorage,
): ThreadWorkbenchState {
  const raw = storage.getItem(`${STORAGE_KEY_PREFIX}.${threadId}`);
  if (!raw) {
    return createEmptyWorkbenchState();
  }

  try {
    const parsed = JSON.parse(raw) as Partial<ThreadWorkbenchState>;
    return {
      ...createEmptyWorkbenchState(),
      ...parsed,
      lastUserPrompt:
        typeof parsed.lastUserPrompt === "string" ? parsed.lastUserPrompt : null,
    };
  } catch {
    return createEmptyWorkbenchState();
  }
}

export function saveWorkbenchState(
  threadId: string,
  state: ThreadWorkbenchState,
  storage: Storage = window.localStorage,
): void {
  storage.setItem(`${STORAGE_KEY_PREFIX}.${threadId}`, JSON.stringify(state));
}

export function removeWorkbenchState(
  threadId: string,
  storage: Storage = window.localStorage,
): void {
  storage.removeItem(`${STORAGE_KEY_PREFIX}.${threadId}`);
}

export function replaceWorkbenchTodos(
  state: ThreadWorkbenchState,
  todos: WorkbenchTodo[],
): ThreadWorkbenchState {
  return {
    ...state,
    todos,
    updatedAt: Date.now(),
  };
}

export function appendWorkbenchArtifacts(
  state: ThreadWorkbenchState,
  artifacts: WorkbenchArtifact[],
): ThreadWorkbenchState {
  return {
    ...state,
    artifacts: [...state.artifacts, ...artifacts],
    updatedAt: Date.now(),
  };
}

export function replaceWorkbenchArtifacts(
  state: ThreadWorkbenchState,
  artifacts: WorkbenchArtifact[],
  source: NonNullable<WorkbenchArtifact["source"]>,
): ThreadWorkbenchState {
  return {
    ...state,
    artifacts: [
      ...state.artifacts.filter((artifact) => artifact.source !== source),
      ...artifacts,
    ],
    updatedAt: Date.now(),
  };
}

export function resetWorkbenchStateForTaskKind(
  taskKind: WorkbenchTaskKind,
): ThreadWorkbenchState {
  return {
    ...createEmptyWorkbenchState(),
    taskKind,
  };
}

export async function postRuntimeControlCommand(payload: {
  thread_id: string;
  action: RunControlAction;
  plan_patch?: string;
}): Promise<RunControlSnapshot | null> {
  const response = await fetch("/api/runtime-control", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) return null;
  const data = (await response.json()) as Record<string, unknown>;
  return (data.runtime_control ?? null) as RunControlSnapshot | null;
}
