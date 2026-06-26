import { describe, expect, it } from "vitest";

import {
  appendWorkbenchArtifacts,
  createEmptyWorkbenchState,
  loadWorkbenchState,
  replaceWorkbenchArtifacts,
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

  it("replaces artifacts by source without removing artifacts from other sources", () => {
    const base = createEmptyWorkbenchState();
    const withArtifacts = appendWorkbenchArtifacts(base, [
      {
        id: "tool-1",
        kind: "file",
        title: "report.md",
        path: "report.md",
        content: "# Report",
        createdAt: 1,
        source: "tool",
      },
      {
        id: "delegation-1",
        kind: "summary",
        title: "Review verdict",
        content: "Looks good",
        createdAt: 2,
        source: "delegation",
      },
    ]);

    const replaced = replaceWorkbenchArtifacts(
      withArtifacts,
      [
        {
          id: "delegation-2",
          kind: "summary",
          title: "Updated review verdict",
          content: "Still good",
          createdAt: 3,
          source: "delegation",
        },
      ],
      "delegation",
    );

    expect(withArtifacts.artifacts).toHaveLength(2);
    expect(replaced.artifacts).toHaveLength(2);
    expect(replaced.artifacts.find((artifact) => artifact.id === "tool-1")).toBeDefined();
    expect(replaced.artifacts.find((artifact) => artifact.id === "delegation-1")).toBeUndefined();
    expect(replaced.artifacts.find((artifact) => artifact.id === "delegation-2")).toBeDefined();
  });
});
