import { describe, expect, it } from "vitest";

import {
  appendWorkbenchArtifacts,
  createEmptyWorkbenchState,
  loadWorkbenchState,
  replaceWorkbenchTodos,
  saveWorkbenchState,
} from "../workbench-state";

describe("workbench-state", () => {
  it("persists state per thread id", () => {
    const storage = window.localStorage;
    storage.clear();

    const first = createEmptyWorkbenchState();
    const second = createEmptyWorkbenchState();

    saveWorkbenchState(
      "thread-a",
      {
        ...first,
        finalSummary: "engineering summary",
      },
      storage,
    );
    saveWorkbenchState(
      "thread-b",
      {
        ...second,
        finalSummary: "research summary",
      },
      storage,
    );

    expect(loadWorkbenchState("thread-a", storage).finalSummary).toBe(
      "engineering summary",
    );
    expect(loadWorkbenchState("thread-b", storage).finalSummary).toBe(
      "research summary",
    );
  });

  it("replaces todos and appends artifacts without mutating the original state", () => {
    const base = createEmptyWorkbenchState();
    const withTodos = replaceWorkbenchTodos(base, [
      {
        id: "todo-1",
        content: "Inspect repo",
        status: "pending",
        source: "agent",
      },
    ]);
    const withArtifacts = appendWorkbenchArtifacts(withTodos, [
      {
        id: "artifact-1",
        kind: "finding",
        title: "Finding",
        content: "Summary",
        createdAt: 1,
      },
    ]);

    expect(base.todos).toHaveLength(0);
    expect(withTodos.todos).toHaveLength(1);
    expect(withArtifacts.artifacts).toHaveLength(1);
  });
});
