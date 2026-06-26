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
